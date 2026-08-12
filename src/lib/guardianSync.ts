// VisionAssist User App -> Guardian Portal Supabase Sync Engine

import { supabase } from './supabase';

const DEFAULT_USER_ID = '00000000-0000-0000-0000-000000000001';

export async function syncLocation(
  latitude: number,
  longitude: number,
  address: string = '',
  speed: number = 0,
  heading: number = 0
) {
  try {
    const { error } = await supabase.from('locations').insert([{
      user_id: DEFAULT_USER_ID,
      latitude,
      longitude,
      address,
      speed,
      heading,
      accuracy: 5.0,
      timestamp: new Date().toISOString()
    }]);
    if (error) console.warn('Supabase location sync note:', error.message);
  } catch (e) {
    // Silent catch if supabase url is placeholder
  }
}

export async function syncAlert(
  alertType: 'SOS' | 'FALL' | 'VEHICLE_HAZARD' | 'OBSTACLE' | 'ROUTE_DEVIATION',
  severity: 'CRITICAL' | 'HIGH' | 'MEDIUM' | 'LOW',
  message: string,
  latitude?: number,
  longitude?: number
) {
  try {
    const { error } = await supabase.from('alerts').insert([{
      user_id: DEFAULT_USER_ID,
      alert_type: alertType,
      severity,
      message,
      latitude: latitude || 12.9716,
      longitude: longitude || 80.2454,
      status: 'UNRESOLVED',
      created_at: new Date().toISOString()
    }]);
    if (error) console.warn('Supabase alert sync note:', error.message);
  } catch (e) {
    // Silent catch
  }
}

export async function syncObjectDetection(
  objectName: string,
  confidence: number,
  distance: string = '',
  direction: string = 'center',
  severity: 'LOW' | 'MEDIUM' | 'HIGH' | 'CRITICAL' = 'MEDIUM'
) {
  try {
    const { error } = await supabase.from('object_detections').insert([{
      user_id: DEFAULT_USER_ID,
      object_name: objectName,
      confidence,
      distance,
      direction,
      severity,
      timestamp: new Date().toISOString()
    }]);
    if (error) console.warn('Supabase object sync note:', error.message);
  } catch (e) {
    // Silent catch
  }
}

export async function syncNavigationSession(
  destination: string,
  distance: number,
  status: 'IN_PROGRESS' | 'COMPLETED' | 'CANCELLED' | 'DEVIATED' = 'IN_PROGRESS'
) {
  try {
    const { error } = await supabase.from('navigation_sessions').insert([{
      user_id: DEFAULT_USER_ID,
      destination,
      start_latitude: 12.9716,
      start_longitude: 80.2454,
      distance,
      status,
      started_at: new Date().toISOString()
    }]);
    if (error) console.warn('Supabase nav sync note:', error.message);
  } catch (e) {
    // Silent catch
  }
}

export async function syncAIActivity(
  activityType: 'OCR' | 'CURRENCY' | 'SCENE' | 'VOICE_QA' | 'FACE',
  summary: string,
  metadata: Record<string, unknown> = {}
) {
  try {
    const { error } = await supabase.from('ai_activity').insert([{
      user_id: DEFAULT_USER_ID,
      activity_type: activityType,
      summary,
      metadata,
      created_at: new Date().toISOString()
    }]);
    if (error) console.warn('Supabase AI activity sync note:', error.message);
  } catch (e) {
    // Silent catch
  }
}

export async function syncDeviceStatus(
  battery: number = 85,
  networkStatus: string = 'ONLINE'
) {
  try {
    const { error } = await supabase.from('device_status').upsert([{
      user_id: DEFAULT_USER_ID,
      battery,
      camera_status: 'ACTIVE',
      microphone_status: 'ACTIVE',
      gps_status: 'ACTIVE',
      ai_status: 'ACTIVE',
      network_status: networkStatus,
      last_seen: new Date().toISOString()
    }], { onConflict: 'user_id' });
    if (error) console.warn('Supabase device status sync note:', error.message);
  } catch (e) {
    // Silent catch
  }
}
