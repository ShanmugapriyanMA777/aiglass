-- Auto Create Guardian Profile Trigger
-- Migration File: 20260812184500_auto_guardian_profile.sql

CREATE OR REPLACE FUNCTION public.handle_new_guardian()
RETURNS TRIGGER AS $$
BEGIN
    INSERT INTO public.guardians (auth_user_id, name, email)
    VALUES (
        new.id,
        COALESCE(new.raw_user_meta_data->>'name', split_part(new.email, '@', 1)),
        new.email
    )
    ON CONFLICT (auth_user_id) DO NOTHING;
    RETURN NEW;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

-- Re-create trigger safely
DROP TRIGGER IF EXISTS on_auth_user_created ON auth.users;
CREATE TRIGGER on_auth_user_created
    AFTER INSERT ON auth.users
    FOR EACH ROW EXECUTE FUNCTION public.handle_new_guardian();
