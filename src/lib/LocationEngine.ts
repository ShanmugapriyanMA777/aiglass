// VisionAssist Location Engine — Shared Reusable Location Architecture

import { syncLocation } from './guardianSync';

export type LocationSource = 'browser' | 'hardware_gps' | 'simulated';
export type LocationStatus = 'excellent' | 'good' | 'moderate' | 'poor' | 'stale' | 'invalid';
export type LocationConfidence = 'HIGH' | 'MEDIUM' | 'LOW';

export interface TrustedLocation {
  latitude: number;
  longitude: number;
  accuracy: number; // in meters
  altitude: number | null;
  altitudeAccuracy: number | null;
  speed: number | null; // in m/s
  heading: number | null; // in degrees
  timestamp: number; // epoch ms
  source: LocationSource;
  status: LocationStatus;
  confidenceLabel: LocationConfidence;
  isStationary: boolean;
  address?: string;
}

export interface LocationDebugLog {
  timestamp: string;
  rawLat: number;
  rawLng: number;
  accuracy: number;
  status: 'ACCEPTED' | 'REJECTED';
  reason?: string;
}

// Distance helper using Haversine formula (returns meters)
export function calculateHaversineDistance(
  lat1: number, lon1: number,
  lat2: number, lon2: number
): number {
  const R = 6371000; // Radius of Earth in meters
  const dLat = (lat2 - lat1) * Math.PI / 180;
  const dLon = (lon2 - lon1) * Math.PI / 180;
  const a =
    Math.sin(dLat / 2) * Math.sin(dLat / 2) +
    Math.cos(lat1 * Math.PI / 180) * Math.cos(lat2 * Math.PI / 180) *
    Math.sin(dLon / 2) * Math.sin(dLon / 2);
  const c = 2 * Math.atan2(Math.sqrt(a), Math.sqrt(1 - a));
  return R * c;
}

class LocationEngineService {
  private lastTrustedLocation: TrustedLocation | null = null;
  private watchId: number | null = null;
  private subscribers: Set<(loc: TrustedLocation) => void> = new Set();
  private debugLogs: LocationDebugLog[] = [];
  
  private totalDistanceTravelledMeters: number = 0;
  private acceptedReadingsCount: number = 0;
  private rejectedReadingsCount: number = 0;
  private lastSupabasePushTime: number = 0;
  private isOfflineQueueing: boolean = false;
  private dbPromise: Promise<IDBDatabase> | null = null;

  constructor() {
    this.initIndexedDB();
    if (typeof window !== 'undefined') {
      window.addEventListener('online', () => this.flushOfflineQueue());
    }
  }

  private initIndexedDB() {
    if (typeof window === 'undefined' || !window.indexedDB) return;
    this.dbPromise = new Promise((resolve, reject) => {
      const request = window.indexedDB.open('VisionAssistLocationDB', 1);
      request.onupgradeneeded = (e: any) => {
        const db = e.target.result;
        if (!db.objectStoreNames.contains('location_queue')) {
          db.createObjectStore('location_queue', { keyPath: 'id', autoIncrement: true });
        }
      };
      request.onsuccess = (e: any) => resolve(e.target.result);
      request.onerror = (err) => reject(err);
    });
  }

  public startTracking(mode: 'browser' | 'simulated' = 'browser'): void {
    if (this.watchId !== null) return;

    if (mode === 'simulated') {
      this.startSimulatedTracking();
      return;
    }

    if (typeof navigator !== 'undefined' && navigator.geolocation) {
      this.watchId = navigator.geolocation.watchPosition(
        (pos) => this.processRawGeolocation(pos),
        (err) => this.handleGeolocationError(err),
        {
          enableHighAccuracy: true,
          maximumAge: 0,
          timeout: 10000
        }
      );
    }
  }

  public stopTracking(): void {
    if (this.watchId !== null && typeof navigator !== 'undefined') {
      navigator.geolocation.clearWatch(this.watchId);
      this.watchId = null;
    }
  }

  public subscribe(callback: (loc: TrustedLocation) => void): () => void {
    this.subscribers.add(callback);
    if (this.lastTrustedLocation) {
      callback(this.lastTrustedLocation);
    }
    return () => {
      this.subscribers.delete(callback);
    };
  }

  public getLatestTrustedLocation(): TrustedLocation | null {
    if (!this.lastTrustedLocation) return null;
    
    // Evaluate freshness
    const ageSeconds = (Date.now() - this.lastTrustedLocation.timestamp) / 1000;
    if (ageSeconds > 120) {
      return {
        ...this.lastTrustedLocation,
        status: 'stale',
        confidenceLabel: 'LOW'
      };
    }
    return this.lastTrustedLocation;
  }

  public getStats() {
    return {
      acceptedCount: this.acceptedReadingsCount,
      rejectedCount: this.rejectedReadingsCount,
      totalDistanceKm: (this.totalDistanceTravelledMeters / 1000).toFixed(2),
      isTracking: this.watchId !== null,
      debugLogs: this.debugLogs.slice(-20)
    };
  }

  private processRawGeolocation(position: GeolocationPosition): void {
    const rawLat = position.coords.latitude;
    const rawLng = position.coords.longitude;
    const accuracy = position.coords.accuracy || 50;
    const timestamp = position.timestamp || Date.now();

    // 1. Basic Validity Check
    if (isNaN(rawLat) || isNaN(rawLng) || Math.abs(rawLat) > 90 || Math.abs(rawLng) > 180) {
      this.rejectReading(rawLat, rawLng, accuracy, 'Invalid Coordinates');
      return;
    }

    if (accuracy > 250) {
      this.rejectReading(rawLat, rawLng, accuracy, 'Accuracy too low (>250m)');
      return;
    }

    // 2. GPS Jump & Implied Speed Check
    if (this.lastTrustedLocation) {
      const timeDeltaSeconds = (timestamp - this.lastTrustedLocation.timestamp) / 1000;
      const distanceMeters = calculateHaversineDistance(
        this.lastTrustedLocation.latitude,
        this.lastTrustedLocation.longitude,
        rawLat,
        rawLng
      );

      if (timeDeltaSeconds > 0) {
        const impliedSpeedMps = distanceMeters / timeDeltaSeconds;
        const maxAllowedSpeedMps = 35; // ~126 km/h max realistic velocity

        if (impliedSpeedMps > maxAllowedSpeedMps && distanceMeters > 100) {
          this.rejectReading(
            rawLat, rawLng, accuracy,
            `Suspicious GPS jump: ${distanceMeters.toFixed(0)}m in ${timeDeltaSeconds.toFixed(1)}s (${(impliedSpeedMps * 3.6).toFixed(0)} km/h)`
          );
          return;
        }
      }

      // 3. Stationary & Micro-Jitter Suppression
      const isStationary = distanceMeters < 4.0;
      if (!isStationary) {
        this.totalDistanceTravelledMeters += distanceMeters;
      }

      // 4. Accuracy-Weighted Smoothing
      const alpha = Math.min(1.0, 20 / Math.max(accuracy, 5));
      const smoothedLat = isStationary ? this.lastTrustedLocation.latitude : this.lastTrustedLocation.latitude + (rawLat - this.lastTrustedLocation.latitude) * alpha;
      const smoothedLng = isStationary ? this.lastTrustedLocation.longitude : this.lastTrustedLocation.longitude + (rawLng - this.lastTrustedLocation.longitude) * alpha;

      const status = this.classifyAccuracyStatus(accuracy);
      const confidenceLabel = this.classifyConfidence(accuracy);

      const trusted: TrustedLocation = {
        latitude: Number(smoothedLat.toFixed(6)),
        longitude: Number(smoothedLng.toFixed(6)),
        accuracy: Math.round(accuracy),
        altitude: position.coords.altitude || null,
        altitudeAccuracy: position.coords.altitudeAccuracy || null,
        speed: position.coords.speed !== null ? Number(position.coords.speed.toFixed(1)) : null,
        heading: position.coords.heading !== null ? Number(position.coords.heading.toFixed(0)) : null,
        timestamp,
        source: 'browser',
        status,
        confidenceLabel,
        isStationary
      };

      this.acceptReading(trusted);
    } else {
      // First Reading
      const status = this.classifyAccuracyStatus(accuracy);
      const confidenceLabel = this.classifyConfidence(accuracy);

      const trusted: TrustedLocation = {
        latitude: Number(rawLat.toFixed(6)),
        longitude: Number(rawLng.toFixed(6)),
        accuracy: Math.round(accuracy),
        altitude: position.coords.altitude || null,
        altitudeAccuracy: position.coords.altitudeAccuracy || null,
        speed: position.coords.speed || null,
        heading: position.coords.heading || null,
        timestamp,
        source: 'browser',
        status,
        confidenceLabel,
        isStationary: false
      };

      this.acceptReading(trusted);
    }
  }

  private classifyAccuracyStatus(accuracy: number): LocationStatus {
    if (accuracy <= 10) return 'excellent';
    if (accuracy <= 25) return 'good';
    if (accuracy <= 50) return 'moderate';
    return 'poor';
  }

  private classifyConfidence(accuracy: number): LocationConfidence {
    if (accuracy <= 15) return 'HIGH';
    if (accuracy <= 45) return 'MEDIUM';
    return 'LOW';
  }

  private acceptReading(trusted: TrustedLocation): void {
    this.acceptedReadingsCount++;
    this.lastTrustedLocation = trusted;
    
    this.addLog({
      timestamp: new Date(trusted.timestamp).toLocaleTimeString(),
      rawLat: trusted.latitude,
      rawLng: trusted.longitude,
      accuracy: trusted.accuracy,
      status: 'ACCEPTED'
    });

    // Notify all in-app subscribers
    this.subscribers.forEach(cb => cb(trusted));

    // Throttled Push to Supabase & Guardian Portal
    this.syncToSupabaseThrottled(trusted);
  }

  private rejectReading(lat: number, lng: number, accuracy: number, reason: string): void {
    this.rejectedReadingsCount++;
    console.warn(`[LocationEngine] Rejected Reading (${reason}):`, lat, lng);
    this.addLog({
      timestamp: new Date().toLocaleTimeString(),
      rawLat: lat,
      rawLng: lng,
      accuracy,
      status: 'REJECTED',
      reason
    });
  }

  private addLog(log: LocationDebugLog) {
    this.debugLogs.push(log);
    if (this.debugLogs.length > 50) this.debugLogs.shift();
  }

  private handleGeolocationError(err: GeolocationPositionError): void {
    console.warn('[LocationEngine] Geolocation Error:', err.message);
  }

  private async syncToSupabaseThrottled(trusted: TrustedLocation) {
    const now = Date.now();
    const timeSinceLastPush = now - this.lastSupabasePushTime;

    // Push if 15 seconds elapsed OR if online status changed
    if (timeSinceLastPush > 15000) {
      this.lastSupabasePushTime = now;
      if (typeof navigator !== 'undefined' && !navigator.onLine) {
        this.queueOfflineLocation(trusted);
      } else {
        await syncLocation(trusted.latitude, trusted.longitude, trusted.address || '', trusted.speed || 0, trusted.heading || 0);
      }
    }
  }

  private async queueOfflineLocation(trusted: TrustedLocation) {
    if (!this.dbPromise) return;
    try {
      const db = await this.dbPromise;
      const tx = db.transaction('location_queue', 'readwrite');
      tx.objectStore('location_queue').add(trusted);
    } catch (e) {
      console.warn('Failed to queue location to IndexedDB:', e);
    }
  }

  private async flushOfflineQueue() {
    if (!this.dbPromise || this.isOfflineQueueing) return;
    this.isOfflineQueueing = true;
    try {
      const db = await this.dbPromise;
      const tx = db.transaction('location_queue', 'readwrite');
      const store = tx.objectStore('location_queue');
      const req = store.getAll();

      req.onsuccess = async () => {
        const records: TrustedLocation[] = req.result || [];
        if (records.length > 0) {
          for (const item of records) {
            await syncLocation(item.latitude, item.longitude, item.address || '', item.speed || 0, item.heading || 0);
          }
          const clearTx = db.transaction('location_queue', 'readwrite');
          clearTx.objectStore('location_queue').clear();
          console.log(`[LocationEngine] Synced ${records.length} offline location points to Supabase.`);
        }
        this.isOfflineQueueing = false;
      };
    } catch (e) {
      this.isOfflineQueueing = false;
    }
  }

  private startSimulatedTracking() {
    const simulatedPoints = [
      { lat: 12.9716, lng: 80.2454 },
      { lat: 12.9719, lng: 80.2458 },
      { lat: 12.9723, lng: 80.2462 },
      { lat: 12.9727, lng: 80.2465 },
      { lat: 12.9730, lng: 80.2468 }
    ];
    let idx = 0;
    setInterval(() => {
      const pt = simulatedPoints[idx % simulatedPoints.length];
      const pos: any = {
        coords: {
          latitude: pt.lat,
          longitude: pt.lng,
          accuracy: 8,
          speed: 1.2,
          heading: 45
        },
        timestamp: Date.now()
      };
      this.processRawGeolocation(pos);
      idx++;
    }, 4000);
  }
}

export const LocationEngine = new LocationEngineService();
