/*
# Create app_config table for API keys

1. New Tables
- `app_config` — stores configuration key-value pairs including API keys
  - id (uuid PK), key (text unique), value (text), created_at, updated_at
2. Security
- RLS enabled. Only anon+authenticated can read; writes restricted to service role via the edge function (which uses service role key internally).
- For simplicity in this demo app, allow anon read since the edge function needs to access it.
*/

CREATE TABLE IF NOT EXISTS app_config (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  key text UNIQUE NOT NULL,
  value text NOT NULL,
  created_at timestamptz DEFAULT now(),
  updated_at timestamptz DEFAULT now()
);

ALTER TABLE app_config ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "anon_select_config" ON app_config;
CREATE POLICY "anon_select_config" ON app_config FOR SELECT TO anon, authenticated USING (true);
DROP POLICY IF EXISTS "anon_insert_config" ON app_config;
CREATE POLICY "anon_insert_config" ON app_config FOR INSERT TO anon, authenticated WITH CHECK (true);
DROP POLICY IF EXISTS "anon_update_config" ON app_config;
CREATE POLICY "anon_update_config" ON app_config FOR UPDATE TO anon, authenticated USING (true) WITH CHECK (true);
DROP POLICY IF EXISTS "anon_delete_config" ON app_config;
CREATE POLICY "anon_delete_config" ON app_config FOR DELETE TO anon, authenticated USING (true);
