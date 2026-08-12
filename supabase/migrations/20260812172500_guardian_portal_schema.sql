-- VisionAssist Guardian Portal Database Schema
-- Migration File: 20260812172500_guardian_portal_schema.sql

-- 1. Guardians Table
CREATE TABLE IF NOT EXISTS public.guardians (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    auth_user_id UUID UNIQUE REFERENCES auth.users(id) ON DELETE CASCADE,
    name TEXT NOT NULL,
    email TEXT NOT NULL,
    phone TEXT,
    created_at TIMESTAMPTZ DEFAULT now()
);

-- 2. Guardian User Links Table (Authorized Guardian <-> User Relationships)
CREATE TABLE IF NOT EXISTS public.guardian_user_links (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    guardian_id UUID REFERENCES public.guardians(id) ON DELETE CASCADE,
    user_id UUID NOT NULL,
    relationship TEXT DEFAULT 'Family',
    approved BOOLEAN DEFAULT true,
    created_at TIMESTAMPTZ DEFAULT now(),
    UNIQUE(guardian_id, user_id)
);

-- 3. Locations Table (Live GPS Location Stream)
CREATE TABLE IF NOT EXISTS public.locations (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    user_id UUID NOT NULL,
    latitude DOUBLE PRECISION NOT NULL,
    longitude DOUBLE PRECISION NOT NULL,
    accuracy DOUBLE PRECISION DEFAULT 10.0,
    speed DOUBLE PRECISION DEFAULT 0.0,
    heading DOUBLE PRECISION DEFAULT 0.0,
    address TEXT,
    timestamp TIMESTAMPTZ DEFAULT now()
);

-- 4. Object Detections Table
CREATE TABLE IF NOT EXISTS public.object_detections (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    user_id UUID NOT NULL,
    object_name TEXT NOT NULL,
    confidence DOUBLE PRECISION NOT NULL,
    distance TEXT,
    direction TEXT,
    severity TEXT DEFAULT 'MEDIUM', -- LOW, MEDIUM, HIGH, CRITICAL
    latitude DOUBLE PRECISION,
    longitude DOUBLE PRECISION,
    timestamp TIMESTAMPTZ DEFAULT now()
);

-- 5. Navigation Sessions Table
CREATE TABLE IF NOT EXISTS public.navigation_sessions (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    user_id UUID NOT NULL,
    destination TEXT NOT NULL,
    start_latitude DOUBLE PRECISION,
    start_longitude DOUBLE PRECISION,
    end_latitude DOUBLE PRECISION,
    end_longitude DOUBLE PRECISION,
    distance DOUBLE PRECISION DEFAULT 0.0,
    duration DOUBLE PRECISION DEFAULT 0.0,
    status TEXT DEFAULT 'IN_PROGRESS', -- IN_PROGRESS, COMPLETED, CANCELLED, DEVIATED
    started_at TIMESTAMPTZ DEFAULT now(),
    ended_at TIMESTAMPTZ
);

-- 6. Safety Alerts Table (SOS & Safety Events)
CREATE TABLE IF NOT EXISTS public.alerts (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    user_id UUID NOT NULL,
    alert_type TEXT NOT NULL, -- SOS, FALL, VEHICLE_HAZARD, OBSTACLE, ROUTE_DEVIATION
    severity TEXT DEFAULT 'HIGH', -- CRITICAL, HIGH, MEDIUM, LOW
    message TEXT NOT NULL,
    latitude DOUBLE PRECISION,
    longitude DOUBLE PRECISION,
    status TEXT DEFAULT 'UNRESOLVED', -- UNRESOLVED, ACKNOWLEDGED, RESOLVED
    created_at TIMESTAMPTZ DEFAULT now(),
    resolved_at TIMESTAMPTZ
);

-- 7. AI Activity Summaries Table
CREATE TABLE IF NOT EXISTS public.ai_activity (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    user_id UUID NOT NULL,
    activity_type TEXT NOT NULL, -- OCR, CURRENCY, SCENE, VOICE_QA, FACE
    summary TEXT NOT NULL,
    metadata JSONB DEFAULT '{}'::jsonb,
    created_at TIMESTAMPTZ DEFAULT now()
);

-- 8. Device Status Table (Battery & Hardware Health)
CREATE TABLE IF NOT EXISTS public.device_status (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    user_id UUID NOT NULL UNIQUE,
    battery INTEGER DEFAULT 100,
    camera_status TEXT DEFAULT 'ACTIVE',
    microphone_status TEXT DEFAULT 'ACTIVE',
    gps_status TEXT DEFAULT 'ACTIVE',
    ai_status TEXT DEFAULT 'ACTIVE',
    network_status TEXT DEFAULT 'ONLINE',
    last_seen TIMESTAMPTZ DEFAULT now()
);

-- 9. Daily Reports Table
CREATE TABLE IF NOT EXISTS public.daily_reports (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    user_id UUID NOT NULL,
    report_date DATE NOT NULL DEFAULT CURRENT_DATE,
    active_time INTEGER DEFAULT 0, -- in minutes
    distance_travelled DOUBLE PRECISION DEFAULT 0.0, -- in km
    navigation_count INTEGER DEFAULT 0,
    object_count INTEGER DEFAULT 0,
    alert_count INTEGER DEFAULT 0,
    ocr_count INTEGER DEFAULT 0,
    currency_count INTEGER DEFAULT 0,
    sos_count INTEGER DEFAULT 0,
    summary TEXT,
    created_at TIMESTAMPTZ DEFAULT now(),
    UNIQUE(user_id, report_date)
);

-- Enable RLS on all tables
ALTER TABLE public.guardians ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.guardian_user_links ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.locations ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.object_detections ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.navigation_sessions ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.alerts ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.ai_activity ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.device_status ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.daily_reports ENABLE ROW LEVEL SECURITY;

-- RLS Policies for Guardians
CREATE POLICY "Guardians manage own profile" ON public.guardians
    FOR ALL USING (auth.uid() = auth_user_id);

CREATE POLICY "Guardians manage links" ON public.guardian_user_links
    FOR ALL USING (guardian_id IN (SELECT id FROM public.guardians WHERE auth_user_id = auth.uid()));

CREATE POLICY "Guardians read authorized user locations" ON public.locations
    FOR SELECT USING (user_id IN (
        SELECT user_id FROM public.guardian_user_links WHERE guardian_id IN (SELECT id FROM public.guardians WHERE auth_user_id = auth.uid()) AND approved = true
    ));

CREATE POLICY "Guardians read authorized user object detections" ON public.object_detections
    FOR SELECT USING (user_id IN (
        SELECT user_id FROM public.guardian_user_links WHERE guardian_id IN (SELECT id FROM public.guardians WHERE auth_user_id = auth.uid()) AND approved = true
    ));

CREATE POLICY "Guardians read authorized user navigation" ON public.navigation_sessions
    FOR SELECT USING (user_id IN (
        SELECT user_id FROM public.guardian_user_links WHERE guardian_id IN (SELECT id FROM public.guardians WHERE auth_user_id = auth.uid()) AND approved = true
    ));

CREATE POLICY "Guardians read and update authorized user alerts" ON public.alerts
    FOR ALL USING (user_id IN (
        SELECT user_id FROM public.guardian_user_links WHERE guardian_id IN (SELECT id FROM public.guardians WHERE auth_user_id = auth.uid()) AND approved = true
    ));

CREATE POLICY "Guardians read authorized user AI activity" ON public.ai_activity
    FOR SELECT USING (user_id IN (
        SELECT user_id FROM public.guardian_user_links WHERE guardian_id IN (SELECT id FROM public.guardians WHERE auth_user_id = auth.uid()) AND approved = true
    ));

CREATE POLICY "Guardians read authorized user device status" ON public.device_status
    FOR SELECT USING (user_id IN (
        SELECT user_id FROM public.guardian_user_links WHERE guardian_id IN (SELECT id FROM public.guardians WHERE auth_user_id = auth.uid()) AND approved = true
    ));

CREATE POLICY "Guardians read authorized user daily reports" ON public.daily_reports
    FOR SELECT USING (user_id IN (
        SELECT user_id FROM public.guardian_user_links WHERE guardian_id IN (SELECT id FROM public.guardians WHERE auth_user_id = auth.uid()) AND approved = true
    ));

-- Enable Supabase Realtime for locations, alerts, and device_status
ALTER PUBLICATION supabase_realtime ADD TABLE public.locations;
ALTER PUBLICATION supabase_realtime ADD TABLE public.alerts;
ALTER PUBLICATION supabase_realtime ADD TABLE public.device_status;
ALTER PUBLICATION supabase_realtime ADD TABLE public.navigation_sessions;
