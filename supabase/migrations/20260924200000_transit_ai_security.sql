-- 1. Helper function to check if the current user has the municipal role
CREATE OR REPLACE FUNCTION public.is_municipal() RETURNS boolean AS $$
BEGIN
  RETURN EXISTS (
    SELECT 1 FROM public.profiles
    WHERE id = auth.uid() AND role = 'municipal'
  );
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

-- 2. Revoke public/anon read access from internal operational tables
DROP POLICY IF EXISTS anon_read_allocations ON allocations;

-- 3. Grant municipal read access to authority tables

-- Allocations
CREATE POLICY municipal_read_allocations ON allocations 
FOR SELECT TO authenticated 
USING (public.is_municipal());

-- Alerts
-- (Assuming only service_role_all_alerts existed before, we add this so municipal users can read)
CREATE POLICY municipal_read_alerts ON alerts 
FOR SELECT TO authenticated 
USING (public.is_municipal());

-- Telemetry log
CREATE POLICY municipal_read_telemetry ON telemetry_log 
FOR SELECT TO authenticated 
USING (public.is_municipal());

-- Override conflicts
CREATE POLICY municipal_read_conflicts ON override_conflicts 
FOR SELECT TO authenticated 
USING (public.is_municipal());

-- Score log (civic health calculations)
-- Ensure no anon policy exists (just in case), then add municipal access
DROP POLICY IF EXISTS anon_read_score_log ON score_log;
CREATE POLICY municipal_read_score_log ON score_log 
FOR SELECT TO authenticated 
USING (public.is_municipal());
