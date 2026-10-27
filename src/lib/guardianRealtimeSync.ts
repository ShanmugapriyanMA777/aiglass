/**
 * VisionAssist <-> Guardian Portal Real-Time Dynamic Sync Engine
 * Enables instant, zero-latency bi-directional synchronization between
 * the VisionAssist smart glasses client and the Guardian caregiver portal
 * via BroadcastChannel, LocalStorage, Supabase, and local FastAPI backend.
 */

import { supabase } from './supabase';

export interface GuardianAlert {
  id: string;
  title: string;
  description: string;
  risk: 'CRITICAL' | 'HIGH' | 'MEDIUM' | 'LOW';
  timestamp: string;
  acknowledged: boolean;
  resolved: boolean;
  latitude?: number;
  longitude?: number;
}

export interface GuardianActivityItem {
  id: string;
  type: 'object' | 'ocr' | 'currency' | 'voice' | 'nav' | 'sos';
  title: string;
  details: string;
  timestamp: string;
}

export interface GuardianLiveState {
  device: {
    battery: number;
    isOnline: boolean;
    safetyStatus: 'SAFE' | 'WARNING' | 'CRITICAL';
    cameraActive: boolean;
    micActive: boolean;
    gpsActive: boolean;
    aiActive: boolean;
    glassesId: string;
    userName: string;
    networkStatus: string;
  };
  location: {
    latitude: number;
    longitude: number;
    address: string;
    speed: number;
    heading: number;
    accuracy: number;
    lastUpdated: string;
  };
  navigation: {
    active: boolean;
    destination: string;
    distanceRemaining: string;
    etaMinutes: number;
    currentStep: string;
  };
  alerts: GuardianAlert[];
  activities: GuardianActivityItem[];
  stats: {
    objectsDetected: number;
    safetyAlertsCount: number;
    distanceWalkedKm: number;
    tripsCompleted: number;
  };
}

const STORAGE_KEY = 'va_guardian_live_state';
const BROADCAST_CHANNEL_NAME = 'visionassist_guardian_sync_bus';

const defaultState: GuardianLiveState = {
  device: {
    battery: 85,
    isOnline: true,
    safetyStatus: 'SAFE',
    cameraActive: true,
    micActive: true,
    gpsActive: true,
    aiActive: true,
    glassesId: 'VG-8842',
    userName: 'Rahul (Visually Impaired User)',
    networkStatus: 'Online (4G LTE)',
  },
  location: {
    latitude: 12.9716,
    longitude: 80.2454,
    address: 'Agni College Campus, OMR Road, Thalambur, Chennai',
    speed: 3.2,
    heading: 45,
    accuracy: 2.5,
    lastUpdated: 'Just now',
  },
  navigation: {
    active: false,
    destination: 'Apollo Hospital, Main Entrance',
    distanceRemaining: '650 m',
    etaMinutes: 8,
    currentStep: 'Head north towards Main Gate',
  },
  alerts: [
    {
      id: 'alt_init_1',
      title: 'Vehicle Approaching — High Risk',
      description: 'Car detected on zebra crossing at 2.4m distance. Warning spoken immediately to user.',
      risk: 'HIGH',
      timestamp: '10:32 AM',
      acknowledged: true,
      resolved: true,
    },
    {
      id: 'alt_init_2',
      title: 'Uneven Footpath Obstacle',
      description: 'Construction barrier detected 1.5m ahead on left side.',
      risk: 'MEDIUM',
      timestamp: '10:15 AM',
      acknowledged: true,
      resolved: true,
    }
  ],
  activities: [
    {
      id: 'act_1',
      type: 'currency',
      title: 'Currency Identification',
      details: 'Identified ₹500 Indian Rupee Note with 96% confidence (Multimodal AI).',
      timestamp: '10:30 AM',
    },
    {
      id: 'act_2',
      type: 'ocr',
      title: 'OCR Board Reading',
      details: 'Read text aloud: "Apollo Pharmacy — Medical & Emergency Services"',
      timestamp: '10:28 AM',
    },
    {
      id: 'act_3',
      type: 'object',
      title: 'Traffic & Obstacle Identification',
      details: 'Detected: Car (ahead, 3m), Pedestrian (right, 1.5m), Traffic Light (GREEN).',
      timestamp: '10:25 AM',
    },
    {
      id: 'act_4',
      type: 'voice',
      title: 'Voice Command Processed',
      details: 'User asked: "Hey Vision, navigate to Apollo Hospital". Route calculated.',
      timestamp: '10:20 AM',
    }
  ],
  stats: {
    objectsDetected: 247,
    safetyAlertsCount: 2,
    distanceWalkedKm: 5.8,
    tripsCompleted: 4,
  }
};

// In-memory cache
let cachedState: GuardianLiveState = loadInitialState();

function loadInitialState(): GuardianLiveState {
  if (typeof window === 'undefined') return defaultState;
  try {
    const raw = localStorage.getItem(STORAGE_KEY);
    if (raw) {
      const parsed = JSON.parse(raw);
      return {
        ...defaultState,
        ...parsed,
        device: { ...defaultState.device, ...(parsed.device || {}) },
        location: { ...defaultState.location, ...(parsed.location || {}) },
        navigation: { ...defaultState.navigation, ...(parsed.navigation || {}) },
        stats: { ...defaultState.stats, ...(parsed.stats || {}) },
        alerts: Array.isArray(parsed.alerts) ? parsed.alerts : defaultState.alerts,
        activities: Array.isArray(parsed.activities) ? parsed.activities : defaultState.activities,
      };
    }
  } catch (e) {
    console.warn('[GuardianSync] Error reading saved state:', e);
  }
  return { ...defaultState };
}

// Event bus listeners
type SyncListener = (state: GuardianLiveState) => void;
const listeners = new Set<SyncListener>();

// BroadcastChannel for cross-tab real-time sync
let broadcastChannel: BroadcastChannel | null = null;
if (typeof window !== 'undefined' && 'BroadcastChannel' in window) {
  try {
    broadcastChannel = new BroadcastChannel(BROADCAST_CHANNEL_NAME);
    broadcastChannel.onmessage = (event) => {
      if (event.data && typeof event.data === 'object') {
        cachedState = event.data;
        notifyListeners();
      }
    };
  } catch (e) {
    console.warn('[GuardianSync] BroadcastChannel init error:', e);
  }
}

// Window storage listener for fallback cross-tab updates
if (typeof window !== 'undefined') {
  window.addEventListener('storage', (event) => {
    if (event.key === STORAGE_KEY && event.newValue) {
      try {
        cachedState = JSON.parse(event.newValue);
        notifyListeners();
      } catch {}
    }
  });
}

function notifyListeners() {
  listeners.forEach((listener) => {
    try {
      listener(cachedState);
    } catch (e) {
      console.warn('[GuardianSync] Listener error:', e);
    }
  });
}

function persistAndBroadcast(state: GuardianLiveState) {
  cachedState = state;
  try {
    localStorage.setItem(STORAGE_KEY, JSON.stringify(state));
  } catch {}

  if (broadcastChannel) {
    try {
      broadcastChannel.postMessage(state);
    } catch {}
  }

  notifyListeners();

  // Async backend / Supabase push in background (fire-and-forget)
  syncToBackendAndSupabase(state).catch(() => null);
}

async function syncToBackendAndSupabase(state: GuardianLiveState) {
  // Push to local FastAPI backend if running
  try {
    await fetch('http://localhost:8000/api/guardian/sync', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(state),
    });
  } catch {}

  // Push to Supabase if configured
  try {
    if (supabase) {
      await supabase.from('device_status').upsert([{
        user_id: '00000000-0000-0000-0000-000000000001',
        battery: state.device.battery,
        camera_status: state.device.cameraActive ? 'ACTIVE' : 'OFFLINE',
        microphone_status: state.device.micActive ? 'ACTIVE' : 'OFFLINE',
        gps_status: state.device.gpsActive ? 'ACTIVE' : 'OFFLINE',
        ai_status: state.device.aiActive ? 'ACTIVE' : 'OFFLINE',
        network_status: state.device.networkStatus,
        last_seen: new Date().toISOString(),
      }], { onConflict: 'user_id' });
    }
  } catch {}
}

/* ==============================================================
   PUBLIC API FOR VISIONASSIST GLASSES APP (Dashboard.tsx)
   ============================================================== */

export function getGuardianLiveState(): GuardianLiveState {
  return cachedState;
}

export function subscribeGuardianSync(listener: SyncListener): () => void {
  listeners.add(listener);
  listener(cachedState);
  return () => {
    listeners.delete(listener);
  };
}

export function publishLocation(
  latitude: number,
  longitude: number,
  address: string = '',
  speed: number = 0,
  heading: number = 0
) {
  const current = getGuardianLiveState();
  const newState: GuardianLiveState = {
    ...current,
    location: {
      latitude,
      longitude,
      address: address || current.location.address,
      speed: Number(speed.toFixed(1)),
      heading: Math.round(heading),
      accuracy: 2.0,
      lastUpdated: new Date().toLocaleTimeString([], { hour: '2-digit', minute: '2-digit', second: '2-digit' }),
    }
  };
  persistAndBroadcast(newState);
}

export function publishDeviceStatus(updates: Partial<GuardianLiveState['device']>) {
  const current = getGuardianLiveState();
  const newState: GuardianLiveState = {
    ...current,
    device: {
      ...current.device,
      ...updates,
    }
  };
  persistAndBroadcast(newState);
}

export function publishNavigation(
  active: boolean,
  destination: string,
  distanceRemaining: string = '',
  etaMinutes: number = 0,
  currentStep: string = ''
) {
  const current = getGuardianLiveState();
  const newState: GuardianLiveState = {
    ...current,
    navigation: {
      active,
      destination: destination || (active ? current.navigation.destination : ''),
      distanceRemaining,
      etaMinutes,
      currentStep,
    },
    stats: {
      ...current.stats,
      tripsCompleted: (!active && current.navigation.active)
        ? current.stats.tripsCompleted + 1
        : current.stats.tripsCompleted
    }
  };
  persistAndBroadcast(newState);
}

export function publishAlert(
  title: string,
  description: string,
  risk: 'CRITICAL' | 'HIGH' | 'MEDIUM' | 'LOW' = 'HIGH',
  latitude?: number,
  longitude?: number
): GuardianAlert {
  const current = getGuardianLiveState();
  const newAlert: GuardianAlert = {
    id: 'alt_' + Date.now() + '_' + Math.random().toString(36).substring(2, 6),
    title,
    description,
    risk,
    timestamp: new Date().toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' }),
    acknowledged: false,
    resolved: false,
    latitude: latitude || current.location.latitude,
    longitude: longitude || current.location.longitude,
  };

  const newState: GuardianLiveState = {
    ...current,
    device: {
      ...current.device,
      safetyStatus: risk === 'CRITICAL' ? 'CRITICAL' : (risk === 'HIGH' ? 'WARNING' : current.device.safetyStatus)
    },
    alerts: [newAlert, ...current.alerts.slice(0, 49)],
    stats: {
      ...current.stats,
      safetyAlertsCount: current.stats.safetyAlertsCount + 1
    }
  };

  persistAndBroadcast(newState);
  return newAlert;
}

export function publishActivity(
  type: GuardianActivityItem['type'],
  title: string,
  details: string
) {
  const current = getGuardianLiveState();
  const newActivity: GuardianActivityItem = {
    id: 'act_' + Date.now() + '_' + Math.random().toString(36).substring(2, 6),
    type,
    title,
    details,
    timestamp: new Date().toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' }),
  };

  const newState: GuardianLiveState = {
    ...current,
    activities: [newActivity, ...current.activities.slice(0, 49)],
    stats: {
      ...current.stats,
      objectsDetected: type === 'object' ? current.stats.objectsDetected + 1 : current.stats.objectsDetected
    }
  };

  persistAndBroadcast(newState);
}

/* ==============================================================
   GUARDIAN PORTAL ACTIONS (Acknowledge / Resolve / SOS)
   ============================================================== */

export function acknowledgeAlert(alertId: string) {
  const current = getGuardianLiveState();
  const updatedAlerts = current.alerts.map(a =>
    a.id === alertId ? { ...a, acknowledged: true } : a
  );
  persistAndBroadcast({ ...current, alerts: updatedAlerts });
}

export function resolveAlert(alertId: string) {
  const current = getGuardianLiveState();
  const updatedAlerts = current.alerts.map(a =>
    a.id === alertId ? { ...a, acknowledged: true, resolved: true } : a
  );

  // If no critical alerts remain unresolved, reset safety status to SAFE
  const hasCriticalUnresolved = updatedAlerts.some(a => !a.resolved && a.risk === 'CRITICAL');
  const hasHighUnresolved = updatedAlerts.some(a => !a.resolved && a.risk === 'HIGH');
  const safetyStatus = hasCriticalUnresolved ? 'CRITICAL' : (hasHighUnresolved ? 'WARNING' : 'SAFE');

  persistAndBroadcast({
    ...current,
    device: { ...current.device, safetyStatus },
    alerts: updatedAlerts
  });
}

export function triggerEmergencySOSFromPortal() {
  return publishAlert(
    'EMERGENCY SOS ALERT (TRIGGERED BY GUARDIAN)',
    'Guardian portal initiated an emergency SOS alert check for this user!',
    'CRITICAL'
  );
}
