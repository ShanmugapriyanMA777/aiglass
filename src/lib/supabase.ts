import { createClient } from '@supabase/supabase-js';

const supabaseUrl = import.meta.env.VITE_SUPABASE_URL as string;
const supabaseAnonKey = import.meta.env.VITE_SUPABASE_ANON_KEY as string;

export const supabase = createClient(supabaseUrl, supabaseAnonKey);

export type DetectionType = 'object' | 'ocr' | 'scene' | 'color' | 'currency' | 'face' | 'obstacle';

export interface DetectionRecord {
  id?: string;
  type: DetectionType;
  label: string;
  confidence?: number | null;
  distance?: string | null;
  details?: Record<string, unknown>;
  created_at?: string;
}

export interface DemoSession {
  id?: string;
  started_at?: string;
  ended_at?: string | null;
  detection_count?: number;
  ocr_count?: number;
  voice_command_count?: number;
  avg_fps?: number;
  created_at?: string;
}

export interface AppSettings {
  id?: string;
  voice_speed?: number;
  voice_lang?: string;
  confidence_threshold?: number;
  dark_mode?: boolean;
  camera_quality?: string;
  updated_at?: string;
}

export interface EmergencyContact {
  id?: string;
  name: string;
  phone: string;
  relation?: string;
  created_at?: string;
}

export interface ActivityLogEntry {
  id?: string;
  event: string;
  details?: Record<string, unknown>;
  created_at?: string;
}
