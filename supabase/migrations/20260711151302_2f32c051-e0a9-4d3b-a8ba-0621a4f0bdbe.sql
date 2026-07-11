
-- =====================================================
-- 1. HASH PINs for client_profiles (pgcrypto)
-- =====================================================
CREATE EXTENSION IF NOT EXISTS pgcrypto WITH SCHEMA extensions;

-- Trigger to hash pin on insert/update if it looks like plaintext (length <= 10)
CREATE OR REPLACE FUNCTION public.hash_client_profile_pin()
RETURNS trigger
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public, extensions
AS $$
BEGIN
  IF NEW.pin IS NULL OR NEW.pin = '' THEN
    NEW.pin := NULL;
    RETURN NEW;
  END IF;
  -- If pin doesn't look like a bcrypt hash, hash it
  IF NEW.pin !~ '^\$2[aby]\$' THEN
    NEW.pin := extensions.crypt(NEW.pin, extensions.gen_salt('bf'));
  END IF;
  RETURN NEW;
END;
$$;

DROP TRIGGER IF EXISTS trg_hash_client_profile_pin ON public.client_profiles;
CREATE TRIGGER trg_hash_client_profile_pin
BEFORE INSERT OR UPDATE OF pin ON public.client_profiles
FOR EACH ROW EXECUTE FUNCTION public.hash_client_profile_pin();

-- Hash any existing plaintext PINs
UPDATE public.client_profiles
SET pin = extensions.crypt(pin, extensions.gen_salt('bf'))
WHERE pin IS NOT NULL AND pin !~ '^\$2[aby]\$';

-- Verify function (SECURITY DEFINER; grant only to authenticated)
CREATE OR REPLACE FUNCTION public.verify_client_profile_pin(_profile_id uuid, _pin text)
RETURNS boolean
LANGUAGE plpgsql
STABLE
SECURITY DEFINER
SET search_path = public, extensions
AS $$
DECLARE
  stored_pin text;
BEGIN
  SELECT pin INTO stored_pin
  FROM public.client_profiles
  WHERE id = _profile_id
    AND parent_user_id = auth.uid();

  IF stored_pin IS NULL THEN
    RETURN true; -- no pin required
  END IF;

  RETURN stored_pin = extensions.crypt(_pin, stored_pin);
END;
$$;

REVOKE ALL ON FUNCTION public.verify_client_profile_pin(uuid, text) FROM PUBLIC, anon;
GRANT EXECUTE ON FUNCTION public.verify_client_profile_pin(uuid, text) TO authenticated;

-- =====================================================
-- 2. Remove active_sessions from realtime publication
-- =====================================================
DO $$
BEGIN
  IF EXISTS (
    SELECT 1 FROM pg_publication_tables
    WHERE pubname = 'supabase_realtime' AND schemaname = 'public' AND tablename = 'active_sessions'
  ) THEN
    EXECUTE 'ALTER PUBLICATION supabase_realtime DROP TABLE public.active_sessions';
  END IF;
END $$;

-- =====================================================
-- 3. Add restrictive policy on realtime.messages
-- Blocks anon; allows authenticated only for topics prefixed with their user id
-- =====================================================
ALTER TABLE realtime.messages ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "Deny anon realtime broadcast" ON realtime.messages;
CREATE POLICY "Deny anon realtime broadcast"
ON realtime.messages
AS RESTRICTIVE
FOR ALL
TO anon
USING (false)
WITH CHECK (false);

DROP POLICY IF EXISTS "Authenticated users own topics" ON realtime.messages;
CREATE POLICY "Authenticated users own topics"
ON realtime.messages
FOR SELECT
TO authenticated
USING (
  realtime.topic() LIKE (auth.uid()::text || ':%')
  OR realtime.topic() = auth.uid()::text
);

-- =====================================================
-- 4. Revoke EXECUTE on admin-only SECURITY DEFINER functions
-- =====================================================
REVOKE EXECUTE ON FUNCTION public.delete_channels_by_link(uuid) FROM PUBLIC, anon, authenticated;
REVOKE EXECUTE ON FUNCTION public.reorganize_all_channels() FROM PUBLIC, anon, authenticated;
REVOKE EXECUTE ON FUNCTION public.migrate_channels_batch(integer) FROM PUBLIC, anon, authenticated;
REVOKE EXECUTE ON FUNCTION public.cleanup_inactive_sessions() FROM PUBLIC, anon, authenticated;
REVOKE EXECUTE ON FUNCTION public.handle_new_user() FROM PUBLIC, anon, authenticated;
REVOKE EXECUTE ON FUNCTION public.set_channel_content_type() FROM PUBLIC, anon, authenticated;
REVOKE EXECUTE ON FUNCTION public.update_updated_at_column() FROM PUBLIC, anon, authenticated;
REVOKE EXECUTE ON FUNCTION public.hash_client_profile_pin() FROM PUBLIC, anon, authenticated;

-- Revoke from anon for RLS/utility helpers (still available to authenticated where needed)
REVOKE EXECUTE ON FUNCTION public.has_role(uuid, app_role) FROM PUBLIC, anon;
REVOKE EXECUTE ON FUNCTION public.is_admin(uuid) FROM PUBLIC, anon;
REVOKE EXECUTE ON FUNCTION public.can_access_content(uuid, text) FROM PUBLIC, anon;
REVOKE EXECUTE ON FUNCTION public.is_parent_user(uuid) FROM PUBLIC, anon;
REVOKE EXECUTE ON FUNCTION public.count_user_profiles(uuid) FROM PUBLIC, anon;
REVOKE EXECUTE ON FUNCTION public.check_session_availability(uuid) FROM PUBLIC, anon;
