-- Transit AI: frontend access + realtime fixes
-- Follow-up migration for frontend Supabase access.

-- ============================================================
-- 1. PUBLIC READ ACCESS REQUIRED BY THE NETWORK UI
-- ============================================================

CREATE POLICY anon_read_alerts
ON alerts
FOR SELECT
TO anon
USING (true);

CREATE POLICY anon_read_road_segments
ON road_segments
FOR SELECT
TO anon
USING (true);

CREATE POLICY anon_read_weather_events
ON weather_events
FOR SELECT
TO anon
USING (true);


-- ============================================================
-- 2. REALTIME
-- ============================================================

ALTER TABLE road_segments REPLICA IDENTITY FULL;
ALTER TABLE weather_events REPLICA IDENTITY FULL;

-- Preserve the existing Supabase Realtime publication.
-- Add these tables without dropping/recreating the publication.

DO $$
BEGIN
  BEGIN
    ALTER PUBLICATION supabase_realtime ADD TABLE road_segments;
  EXCEPTION
    WHEN duplicate_object THEN
      NULL;
  END;

  BEGIN
    ALTER PUBLICATION supabase_realtime ADD TABLE weather_events;
  EXCEPTION
    WHEN duplicate_object THEN
      NULL;
  END;
END
$$;