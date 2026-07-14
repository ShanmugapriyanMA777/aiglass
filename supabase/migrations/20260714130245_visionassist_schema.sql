/*
# VisionAssist AI Smart Glasses Schema

1. New Tables
- `detection_history` — stores every AI detection event (object, OCR, scene, color, etc.)
  - id (uuid PK), type (text: object/ocr/scene/color/currency/face/obstacle), label (text), confidence (float), distance (text), details (jsonb), created_at (timestamptz)
- `demo_sessions` — tracks each demo session with stats
  - id (uuid PK), started_at, ended_at, detection_count (int), ocr_count (int), voice_command_count (int), avg_fps (float), created_at
- `app_settings` — single-row settings store
  - id (uuid PK), voice_speed (float), voice_lang (text), confidence_threshold (float), dark_mode (bool), camera_quality (text), created_at, updated_at
- `emergency_contacts` — emergency contact info
  - id (uuid PK), name (text), phone (text), relation (text), created_at
- `activity_log` — daily activity log entries
  - id (uuid PK), event (text), details (jsonb), created_at

2. Security
- All tables: RLS enabled, anon+authenticated CRUD (single-tenant demo app, intentionally shared data).
*/

CREATE TABLE IF NOT EXISTS detection_history (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  type text NOT NULL,
  label text NOT NULL,
  confidence float,
  distance text,
  details jsonb DEFAULT '{}'::jsonb,
  created_at timestamptz DEFAULT now()
);
ALTER TABLE detection_history ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "anon_select_detections" ON detection_history;
CREATE POLICY "anon_select_detections" ON detection_history FOR SELECT TO anon, authenticated USING (true);
DROP POLICY IF EXISTS "anon_insert_detections" ON detection_history;
CREATE POLICY "anon_insert_detections" ON detection_history FOR INSERT TO anon, authenticated WITH CHECK (true);
DROP POLICY IF EXISTS "anon_update_detections" ON detection_history;
CREATE POLICY "anon_update_detections" ON detection_history FOR UPDATE TO anon, authenticated USING (true) WITH CHECK (true);
DROP POLICY IF EXISTS "anon_delete_detections" ON detection_history;
CREATE POLICY "anon_delete_detections" ON detection_history FOR DELETE TO anon, authenticated USING (true);

CREATE TABLE IF NOT EXISTS demo_sessions (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  started_at timestamptz DEFAULT now(),
  ended_at timestamptz,
  detection_count int DEFAULT 0,
  ocr_count int DEFAULT 0,
  voice_command_count int DEFAULT 0,
  avg_fps float DEFAULT 0,
  created_at timestamptz DEFAULT now()
);
ALTER TABLE demo_sessions ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "anon_select_sessions" ON demo_sessions;
CREATE POLICY "anon_select_sessions" ON demo_sessions FOR SELECT TO anon, authenticated USING (true);
DROP POLICY IF EXISTS "anon_insert_sessions" ON demo_sessions;
CREATE POLICY "anon_insert_sessions" ON demo_sessions FOR INSERT TO anon, authenticated WITH CHECK (true);
DROP POLICY IF EXISTS "anon_update_sessions" ON demo_sessions;
CREATE POLICY "anon_update_sessions" ON demo_sessions FOR UPDATE TO anon, authenticated USING (true) WITH CHECK (true);
DROP POLICY IF EXISTS "anon_delete_sessions" ON demo_sessions;
CREATE POLICY "anon_delete_sessions" ON demo_sessions FOR DELETE TO anon, authenticated USING (true);

CREATE TABLE IF NOT EXISTS app_settings (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  voice_speed float DEFAULT 1.0,
  voice_lang text DEFAULT 'en-US',
  confidence_threshold float DEFAULT 0.5,
  dark_mode boolean DEFAULT false,
  camera_quality text DEFAULT 'medium',
  created_at timestamptz DEFAULT now(),
  updated_at timestamptz DEFAULT now()
);
ALTER TABLE app_settings ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "anon_select_settings" ON app_settings;
CREATE POLICY "anon_select_settings" ON app_settings FOR SELECT TO anon, authenticated USING (true);
DROP POLICY IF EXISTS "anon_insert_settings" ON app_settings;
CREATE POLICY "anon_insert_settings" ON app_settings FOR INSERT TO anon, authenticated WITH CHECK (true);
DROP POLICY IF EXISTS "anon_update_settings" ON app_settings;
CREATE POLICY "anon_update_settings" ON app_settings FOR UPDATE TO anon, authenticated USING (true) WITH CHECK (true);
DROP POLICY IF EXISTS "anon_delete_settings" ON app_settings;
CREATE POLICY "anon_delete_settings" ON app_settings FOR DELETE TO anon, authenticated USING (true);

CREATE TABLE IF NOT EXISTS emergency_contacts (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  name text NOT NULL,
  phone text NOT NULL,
  relation text,
  created_at timestamptz DEFAULT now()
);
ALTER TABLE emergency_contacts ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "anon_select_contacts" ON emergency_contacts;
CREATE POLICY "anon_select_contacts" ON emergency_contacts FOR SELECT TO anon, authenticated USING (true);
DROP POLICY IF EXISTS "anon_insert_contacts" ON emergency_contacts;
CREATE POLICY "anon_insert_contacts" ON emergency_contacts FOR INSERT TO anon, authenticated WITH CHECK (true);
DROP POLICY IF EXISTS "anon_update_contacts" ON emergency_contacts;
CREATE POLICY "anon_update_contacts" ON emergency_contacts FOR UPDATE TO anon, authenticated USING (true) WITH CHECK (true);
DROP POLICY IF EXISTS "anon_delete_contacts" ON emergency_contacts;
CREATE POLICY "anon_delete_contacts" ON emergency_contacts FOR DELETE TO anon, authenticated USING (true);

CREATE TABLE IF NOT EXISTS activity_log (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  event text NOT NULL,
  details jsonb DEFAULT '{}'::jsonb,
  created_at timestamptz DEFAULT now()
);
ALTER TABLE activity_log ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "anon_select_activity" ON activity_log;
CREATE POLICY "anon_select_activity" ON activity_log FOR SELECT TO anon, authenticated USING (true);
DROP POLICY IF EXISTS "anon_insert_activity" ON activity_log;
CREATE POLICY "anon_insert_activity" ON activity_log FOR INSERT TO anon, authenticated WITH CHECK (true);
DROP POLICY IF EXISTS "anon_delete_activity" ON activity_log;
CREATE POLICY "anon_delete_activity" ON activity_log FOR DELETE TO anon, authenticated USING (true);

CREATE INDEX IF NOT EXISTS idx_detection_history_created ON detection_history (created_at DESC);
CREATE INDEX IF NOT EXISTS idx_activity_log_created ON activity_log (created_at DESC);
CREATE INDEX IF NOT EXISTS idx_demo_sessions_created ON demo_sessions (created_at DESC);
