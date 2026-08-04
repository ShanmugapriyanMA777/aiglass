/* eslint-disable @typescript-eslint/no-explicit-any */
export interface MapLocation {
  name: string;
  latitude: number;
  longitude: number;
  type?: string;
  distance?: number; // distance in meters if computed
}

export interface NavigationStep {
  instruction: string;
  distance: number; // in meters
  duration: number; // in seconds
  coordinate: [number, number]; // [lat, lon]
}

export interface RouteResult {
  coordinates: [number, number][]; // Array of [lat, lon]
  steps: NavigationStep[];
  distance: number; // total distance in meters
  duration: number; // total duration in seconds
}

/**
 * Searches places using OpenStreetMap Nominatim API.
 * Falls back to search simulation if API fails or is offline.
 */
export async function searchPlaces(
  query: string,
  latitude?: number,
  longitude?: number
): Promise<MapLocation[]> {
  try {
    if (!navigator.onLine) throw new Error('Offline mode: skipping network fetch');
    const baseUrl = 'https://nominatim.openstreetmap.org/search';
    const params = new URLSearchParams({
      q: query,
      format: 'json',
      limit: '5',
      addressdetails: '1',
    });

    if (latitude && longitude) {
      // Prioritize locations near the user
      params.append('viewbox', `${longitude - 0.15},${latitude + 0.15},${longitude + 0.15},${latitude - 0.15}`);
    }

    const response = await fetch(`${baseUrl}?${params.toString()}`, {
      headers: {
        'User-Agent': 'VisionAssist-VoiceNavigationAssistant/1.0',
      },
    });

    if (!response.ok) {
      throw new Error(`Nominatim HTTP error: ${response.status}`);
    }

    const data = await response.json();
    if (!Array.isArray(data) || data.length === 0) {
      throw new Error('No places found');
    }

    return data.map((item: any) => ({
      name: item.display_name.split(',').slice(0, 3).join(','), // shorten name
      latitude: parseFloat(item.lat),
      longitude: parseFloat(item.lon),
      type: item.type || item.class || 'place',
    }));
  } catch (e) {
    console.warn('Nominatim search failed, running simulated search fallback:', e);
    // Simulate query result relative to user location
    const baseLat = latitude || 12.9716;
    const baseLon = longitude || 80.2454;

    const mockPlaces: Record<string, MapLocation[]> = {
      'atm': [
        { name: 'State Bank of India ATM, Tech Corridor', latitude: baseLat + 0.002, longitude: baseLon + 0.001, type: 'atm' },
        { name: 'HDFC Bank ATM, Cross Road', latitude: baseLat - 0.001, longitude: baseLon + 0.003, type: 'atm' },
      ],
      'hospital': [
        { name: 'Apollo Speciality Hospital, Main Road', latitude: baseLat + 0.006, longitude: baseLon - 0.004, type: 'hospital' },
        { name: 'Fortis Healthcare Center', latitude: baseLat - 0.008, longitude: baseLon + 0.005, type: 'hospital' },
      ],
      'pharmacy': [
        { name: 'MedPlus Pharmacy, Sector 2', latitude: baseLat + 0.001, longitude: baseLon + 0.002, type: 'pharmacy' },
        { name: 'Apollo Pharmacy, Central Market', latitude: baseLat - 0.002, longitude: baseLon - 0.001, type: 'pharmacy' },
      ],
      'restaurant': [
        { name: 'Grand Veg Restaurant, Food Street', latitude: baseLat + 0.003, longitude: baseLon + 0.004, type: 'restaurant' },
        { name: 'Star Coffee Cafe', latitude: baseLat - 0.003, longitude: baseLon + 0.001, type: 'restaurant' },
      ],
      'bus stop': [
        { name: 'College Bus Stop, Campus Gate', latitude: baseLat + 0.0015, longitude: baseLon - 0.001, type: 'bus_stop' },
        { name: 'Junction Terminal Stop', latitude: baseLat - 0.004, longitude: baseLon + 0.004, type: 'bus_stop' },
      ],
      'agni college': [
        { name: 'Agni College of Technology, Thalambur, Chennai', latitude: 12.8227, longitude: 80.2201, type: 'university' }
      ]
    };

    const q = query.toLowerCase();
    for (const key of Object.keys(mockPlaces)) {
      if (q.includes(key)) {
        return mockPlaces[key];
      }
    }

    // Default mock destination
    return [
      {
        name: `${query} (Simulated Location)`,
        latitude: baseLat + 0.005,
        longitude: baseLon + 0.005,
        type: 'place',
      },
    ];
  }
}

/**
 * Calculates a walking route using Open Source Routing Machine (OSRM) API.
 * Falls back to line simulation if routing API fails or is offline.
 */
export async function getWalkingRoute(
  start: [number, number], // [lat, lon]
  end: [number, number] // [lat, lon]
): Promise<RouteResult> {
  try {
    if (!navigator.onLine) throw new Error('Offline mode: skipping network routing');
    const url = `https://router.projectosrm.org/route/v1/walking/${start[1]},${start[0]};${end[1]},${end[0]}?overview=full&geometries=geojson&steps=true`;
    
    const response = await fetch(url);
    if (!response.ok) {
      throw new Error(`OSRM HTTP error: ${response.status}`);
    }

    const data = await response.json();
    if (!data.routes || data.routes.length === 0) {
      throw new Error('No route found in OSRM');
    }

    const route = data.routes[0];
    const coordinates = route.geometry.coordinates.map((c: any) => [c[1], c[0]] as [number, number]);
    
    const steps: NavigationStep[] = route.legs[0].steps.map((s: any) => {
      let instruction = s.maneuver.instruction || '';
      const name = s.name ? ` onto ${s.name}` : '';
      
      // Make instructions more voice-navigation friendly
      if (s.maneuver.type === 'turn') {
        instruction = `Turn ${s.maneuver.modifier}${name}`;
      } else if (s.maneuver.type === 'new name') {
        instruction = `Continue straight${name}`;
      } else if (s.maneuver.type === 'depart') {
        instruction = `Head ${s.maneuver.modifier || 'forward'}${name}`;
      } else if (s.maneuver.type === 'arrive') {
        instruction = 'You are arriving at your destination';
      }

      return {
        instruction: instruction || 'Continue walking',
        distance: s.distance,
        duration: s.duration,
        coordinate: [s.maneuver.location[1], s.maneuver.location[0]] as [number, number],
      };
    });

    return {
      coordinates,
      steps,
      distance: route.distance,
      duration: route.duration,
    };
  } catch (e) {
    console.warn('OSRM routing failed, using simulated grid route path:', e);
    
    // Fallback: Generate a simple Manhattan/L-shaped grid path between start and end
    const coordinates: [number, number][] = [];
    const steps: NavigationStep[] = [];
    
    const lat1 = start[0];
    const lon1 = start[1];
    const lat2 = end[0];
    const lon2 = end[1];
    
    // Midpoint to create a turn
    const latMid = lat2;
    const lonMid = lon1;

    // Interpolate first leg (north/south)
    const stepsCount = 15;
    for (let i = 0; i <= stepsCount; i++) {
      const t = i / stepsCount;
      coordinates.push([lat1 + (latMid - lat1) * t, lon1 + (lonMid - lon1) * t]);
    }

    // Interpolate second leg (east/west)
    for (let i = 1; i <= stepsCount; i++) {
      const t = i / stepsCount;
      coordinates.push([latMid + (lat2 - latMid) * t, lonMid + (lon2 - lonMid) * t]);
    }

    // Compute approximate distance in meters (using flat-surface approximation)
    const dLat = (lat2 - lat1) * 111320;
    const dLon = (lon2 - lon1) * 40075000 * Math.cos((lat1 + lat2) * Math.PI / 360) / 360;
    const distance1 = Math.abs(dLat);
    const distance2 = Math.abs(dLon);
    const totalDistance = distance1 + distance2;

    // Setup 4 steps
    steps.push({
      instruction: 'Start walking forward',
      distance: distance1,
      duration: distance1 / 1.4, // walking speed ~1.4 m/s
      coordinate: [lat1, lon1],
    });

    steps.push({
      instruction: dLon > 0 ? 'Turn right at the junction' : 'Turn left at the junction',
      distance: distance2,
      duration: distance2 / 1.4,
      coordinate: [latMid, lonMid],
    });

    steps.push({
      instruction: 'Continue straight ahead',
      distance: Math.min(distance2, 50),
      duration: Math.min(distance2, 50) / 1.4,
      coordinate: [latMid + (lat2 - latMid) * 0.5, lonMid + (lon2 - lonMid) * 0.5],
    });

    steps.push({
      instruction: 'Arrive at your destination',
      distance: 0,
      duration: 0,
      coordinate: [lat2, lon2],
    });

    return {
      coordinates,
      steps,
      distance: totalDistance,
      duration: totalDistance / 1.4,
    };
  }
}

/**
 * Computes distance in meters between two lat/lon coordinates (Haversine formula).
 */
export function getDistanceMeters(lat1: number, lon1: number, lat2: number, lon2: number): number {
  const R = 6371e3; // Earth radius in meters
  const φ1 = lat1 * Math.PI / 180;
  const φ2 = lat2 * Math.PI / 180;
  const Δφ = (lat2 - lat1) * Math.PI / 180;
  const Δλ = (lon2 - lon1) * Math.PI / 180;

  const a = Math.sin(Δφ / 2) * Math.sin(Δφ / 2) +
            Math.cos(φ1) * Math.cos(φ2) *
            Math.sin(Δλ / 2) * Math.sin(Δλ / 2);
  const c = 2 * Math.atan2(Math.sqrt(a), Math.sqrt(1 - a));

  return R * c;
}
