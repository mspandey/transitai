-- 1. Core Schema

-- MVP simplification: Using standard PostGIS extensions would be better for routing and geospatial queries,
-- but for this hackathon we use float8 lat/lng and simple distance approximations.

CREATE TABLE zones (
  id text PRIMARY KEY,
  geohash text,
  current_demand_count int DEFAULT 0,
  threshold int DEFAULT 100,
  predicted_trend text, -- 'rising', 'flat', 'falling'
  updated_at timestamptz DEFAULT now()
);

CREATE TABLE routes (
  id text PRIMARY KEY,
  -- bus_id added later after buses table
  zone_id text REFERENCES zones(id),
  stops jsonb,
  eta_minutes int,
  status text,
  updated_at timestamptz DEFAULT now()
);

CREATE TABLE buses (
  id text PRIMARY KEY,
  capacity int,
  current_lat float8,
  current_lng float8,
  status text, -- 'Available', 'Assigned', 'breakdown', etc.
  current_route_id text REFERENCES routes(id),
  updated_at timestamptz DEFAULT now(),
  
  -- Edge Case: GPS Signal Loss
  last_telemetry_at timestamptz DEFAULT now(),
  
  -- Edge Case: Duplicate Bus IDs
  allocation_frozen boolean DEFAULT false,
  
  -- Edge Case: Passenger Count Drop to 0
  onboard_count int DEFAULT 0,
  onboard_staging_count int DEFAULT 0,
  consecutive_low_readings int DEFAULT 0,
  onboard_count_confidence text DEFAULT 'confirmed', -- 'confirmed', 'low_confidence'
  last_confirmed_count int DEFAULT 0,
  door_event_active boolean DEFAULT false,
  
  -- Edge Case: Stuck GPS Telemetry
  suspected_frozen_tracker boolean DEFAULT false
);

ALTER TABLE routes ADD COLUMN bus_id text REFERENCES buses(id);

CREATE TABLE requests (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  origin_lat float8,
  origin_lng float8,
  dest_lat float8,
  dest_lng float8,
  party_size int,
  requested_time timestamptz DEFAULT now(),
  status text,
  zone_id text REFERENCES zones(id),
  created_at timestamptz DEFAULT now(),
  -- MVP simplification: A session or client token would be used to restrict SELECT access to only the creator.
  client_token text
);

CREATE TABLE allocations (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  zone_id text REFERENCES zones(id),
  bus_id text REFERENCES buses(id),
  score float8,
  score_breakdown jsonb,
  decided_by text,
  decided_at timestamptz,
  status text, -- 'recommended', 'approved', 'rejected'
  updated_at timestamptz DEFAULT now()
);

CREATE TABLE alerts (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  type text,
  severity text,
  message text,
  related_bus_id text REFERENCES buses(id),
  related_zone_id text REFERENCES zones(id),
  created_at timestamptz DEFAULT now(),
  resolved_at timestamptz
);


-- 2. Edge Case Schema & Logic

-- Edge Case 4.1: GPS Signal Loss (bus_live_status view)
CREATE OR REPLACE VIEW bus_live_status AS
SELECT 
  b.*,
  CASE 
    WHEN b.status = 'breakdown' THEN 'breakdown'
    WHEN now() - b.last_telemetry_at > interval '90 seconds' THEN 'signal_lost'
    ELSE b.status
  END as live_status
FROM buses b;

-- Edge Case 4.2: Duplicate Bus IDs
CREATE TABLE telemetry_log (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  bus_id text REFERENCES buses(id),
  lat float8,
  lng float8,
  origin_timestamp timestamptz,
  received_at timestamptz DEFAULT now()
);

CREATE OR REPLACE FUNCTION check_duplicate_bus_id()
RETURNS TRIGGER AS $$
DECLARE
  prev_lat float8;
  prev_lng float8;
  prev_time timestamptz;
  dist_km float8;
  time_diff_hours float8;
  implied_speed float8;
BEGIN
  -- Get previous telemetry for the same bus
  SELECT lat, lng, origin_timestamp INTO prev_lat, prev_lng, prev_time
  FROM telemetry_log
  WHERE bus_id = NEW.bus_id AND origin_timestamp < NEW.origin_timestamp
  ORDER BY origin_timestamp DESC LIMIT 1;

  IF FOUND THEN
    -- MVP simplification: extremely crude equirectangular approximation for distance
    -- 1 degree lat ~= 111 km, 1 degree lng ~= 111 * cos(lat) km
    dist_km := sqrt(
      power((NEW.lat - prev_lat) * 111.0, 2) +
      power((NEW.lng - prev_lng) * 111.0 * cos(radians(prev_lat)), 2)
    );
    
    time_diff_hours := EXTRACT(EPOCH FROM (NEW.origin_timestamp - prev_time)) / 3600.0;
    
    IF time_diff_hours > 0 THEN
      implied_speed := dist_km / time_diff_hours;
      
      IF implied_speed > 120.0 THEN
        -- Flag ID conflict
        UPDATE buses SET allocation_frozen = true WHERE id = NEW.bus_id;
        
        INSERT INTO alerts (type, severity, message, related_bus_id)
        VALUES ('id_conflict', 'critical', 'Implied speed ' || round(implied_speed::numeric, 1) || ' km/h exceeds threshold.', NEW.bus_id);
      END IF;
    END IF;
  END IF;
  
  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

CREATE TRIGGER trigger_check_duplicate_bus_id
AFTER INSERT ON telemetry_log
FOR EACH ROW EXECUTE FUNCTION check_duplicate_bus_id();


-- Edge Case 4.4: Passenger Count Drop to 0
CREATE OR REPLACE FUNCTION handle_onboard_count_drop()
RETURNS TRIGGER AS $$
BEGIN
  IF NEW.onboard_count < OLD.last_confirmed_count THEN
    IF OLD.door_event_active = true THEN
      -- Corroborated by door event, allow it
      NEW.last_confirmed_count := NEW.onboard_count;
      NEW.onboard_count_confidence := 'confirmed';
      NEW.consecutive_low_readings := 0;
    ELSE
      -- Not corroborated immediately
      IF OLD.consecutive_low_readings >= 2 THEN
        -- Confirmed after 3 total low readings
        NEW.last_confirmed_count := NEW.onboard_count;
        NEW.onboard_count_confidence := 'confirmed';
        NEW.consecutive_low_readings := 0;
      ELSE
        -- Stage it
        NEW.onboard_staging_count := NEW.onboard_count;
        NEW.onboard_count := OLD.last_confirmed_count; -- hide the drop
        NEW.onboard_count_confidence := 'low_confidence';
        NEW.consecutive_low_readings := OLD.consecutive_low_readings + 1;
      END IF;
    END IF;
  ELSE
    -- Normal or increase
    NEW.last_confirmed_count := NEW.onboard_count;
    NEW.onboard_count_confidence := 'confirmed';
    NEW.consecutive_low_readings := 0;
  END IF;

  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

CREATE TRIGGER trigger_handle_onboard_count_drop
BEFORE UPDATE OF onboard_count ON buses
FOR EACH ROW EXECUTE FUNCTION handle_onboard_count_drop();


-- Edge Case 4.5: Bus Breakdown
CREATE TABLE breakdown_reports (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  bus_id text REFERENCES buses(id),
  reported_at timestamptz DEFAULT now(),
  reported_by text
);

CREATE OR REPLACE FUNCTION handle_bus_breakdown()
RETURNS TRIGGER AS $$
BEGIN
  -- Mark bus as breakdown
  UPDATE buses SET status = 'breakdown' WHERE id = NEW.bus_id;
  
  -- Reject active recommendations
  UPDATE allocations 
  SET status = 'rejected' 
  WHERE bus_id = NEW.bus_id AND status = 'recommended';
  
  -- Raise alert
  INSERT INTO alerts (type, severity, message, related_bus_id)
  VALUES ('breakdown', 'critical', 'Driver reported breakdown mid-route.', NEW.bus_id);
  
  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

CREATE TRIGGER trigger_handle_bus_breakdown
AFTER INSERT ON breakdown_reports
FOR EACH ROW EXECUTE FUNCTION handle_bus_breakdown();


-- Edge Case 4.6: Stuck GPS Telemetry
CREATE OR REPLACE FUNCTION check_stuck_gps(p_bus_id text)
RETURNS void AS $$
DECLARE
  var_lat float8;
  var_lng float8;
  reading_count int;
BEGIN
  SELECT count(*), variance(lat), variance(lng)
  INTO reading_count, var_lat, var_lng
  FROM telemetry_log
  WHERE bus_id = p_bus_id AND origin_timestamp > now() - interval '30 minutes';
  
  IF reading_count > 5 THEN
    IF var_lat = 0 AND var_lng = 0 THEN
      UPDATE buses SET suspected_frozen_tracker = true WHERE id = p_bus_id;
    ELSE
      UPDATE buses SET suspected_frozen_tracker = false WHERE id = p_bus_id;
    END IF;
  END IF;
END;
$$ LANGUAGE plpgsql;


-- Edge Case 4.7: Late Data Arrival (Event-time ordering)
CREATE OR REPLACE FUNCTION prevent_late_data_overwrite()
RETURNS TRIGGER AS $$
BEGIN
  -- If this update is trying to push an older timestamp than what we already have, reject the location update
  IF NEW.last_telemetry_at < OLD.last_telemetry_at THEN
    NEW.current_lat := OLD.current_lat;
    NEW.current_lng := OLD.current_lng;
    NEW.last_telemetry_at := OLD.last_telemetry_at;
  END IF;
  
  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

CREATE TRIGGER trigger_prevent_late_data
BEFORE UPDATE OF current_lat, current_lng, last_telemetry_at ON buses
FOR EACH ROW EXECUTE FUNCTION prevent_late_data_overwrite();


-- Edge Case 4.8: Road Closures
CREATE TABLE road_segments (
  id text PRIMARY KEY,
  status text, -- 'open', 'closed'
  flagged_by text,
  flagged_at timestamptz DEFAULT now(),
  affected_route_ids text[]
);


-- Edge Case 4.9: Weather/Civic-Health Score
CREATE TABLE weather_events (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  active boolean DEFAULT false,
  delay_tolerance_multiplier float8 DEFAULT 1.0,
  started_at timestamptz DEFAULT now(),
  ended_at timestamptz,
  toggled_by text
);

-- Audit trail for civic-health calculations.
-- MVP simplification: score calculations are logged when explicitly recorded
-- rather than using a background scheduler.
CREATE TABLE score_log (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  baseline_score numeric(5,2) NOT NULL,
  adjusted_score numeric(5,2) NOT NULL,
  weather_multiplier numeric(6,3) NOT NULL DEFAULT 1.000,
  weather_event_id uuid REFERENCES weather_events(id) ON DELETE SET NULL,
  average_wait_time numeric(10,2),
  unserved_request_rate numeric(6,4),
  utilization numeric(6,4),
  calculated_at timestamptz NOT NULL DEFAULT now()
);

CREATE INDEX idx_score_log_calculated_at
  ON score_log(calculated_at DESC);

ALTER TABLE score_log ENABLE ROW LEVEL SECURITY;

CREATE POLICY service_role_all_score_log
ON score_log
TO service_role
USING (true)
WITH CHECK (true);

CREATE OR REPLACE VIEW civic_health_score AS
SELECT
  -- MVP Simplification: these base stats would normally be computed from historical aggregates
  6.8 AS avg_wait_time,
  14.2 AS unserved_rate,
  85.0 AS fleet_utilization,
  COALESCE((SELECT delay_tolerance_multiplier FROM weather_events WHERE active = true ORDER BY started_at DESC LIMIT 1), 1.0) as tolerance_multiplier,
  
  -- Base Score = 100 - (Wait Time + Unserved Rate + (100 - Util))
  -- Adjusted by tolerance
  GREATEST(0, ROUND(100.0 - (
    (6.8 + 14.2 + (100.0 - 85.0)) * COALESCE((SELECT delay_tolerance_multiplier FROM weather_events WHERE active = true ORDER BY started_at DESC LIMIT 1), 1.0)
  )::numeric, 2)) AS current_score,
  
  COALESCE((SELECT active FROM weather_events WHERE active = true ORDER BY started_at DESC LIMIT 1), false) as weather_event_active
;


-- 3. Row Level Security (RLS) Policies

-- Enable RLS on all tables
ALTER TABLE zones ENABLE ROW LEVEL SECURITY;
ALTER TABLE routes ENABLE ROW LEVEL SECURITY;
ALTER TABLE buses ENABLE ROW LEVEL SECURITY;
ALTER TABLE requests ENABLE ROW LEVEL SECURITY;
ALTER TABLE allocations ENABLE ROW LEVEL SECURITY;
ALTER TABLE alerts ENABLE ROW LEVEL SECURITY;
ALTER TABLE telemetry_log ENABLE ROW LEVEL SECURITY;
ALTER TABLE breakdown_reports ENABLE ROW LEVEL SECURITY;
ALTER TABLE road_segments ENABLE ROW LEVEL SECURITY;
ALTER TABLE weather_events ENABLE ROW LEVEL SECURITY;


-- Public/Anon access (Read-only live network view)
-- Anon can read zones, routes, buses, allocations
CREATE POLICY anon_read_zones ON zones FOR SELECT TO anon USING (true);
CREATE POLICY anon_read_routes ON routes FOR SELECT TO anon USING (true);
CREATE POLICY anon_read_buses ON buses FOR SELECT TO anon USING (true);
CREATE POLICY anon_read_allocations ON allocations FOR SELECT TO anon USING (true);

-- Anon can insert requests
CREATE POLICY anon_insert_requests ON requests FOR INSERT TO anon WITH CHECK (true);

-- MVP Simplification: If the client passes a client_token, they can select their own request.
-- A completely secure approach without auth requires the UUID acting as the capability URL.
CREATE POLICY anon_read_own_requests ON requests FOR SELECT TO anon
USING (
  client_token IS NOT NULL
  AND client_token = current_setting('request.headers', true)::json->>'x-client-token'
);


-- Service role access (Admin writes & all operations)
-- The service role bypasses RLS by default in Supabase, but we can explicitly define it for completeness
CREATE POLICY service_role_all_zones ON zones TO service_role USING (true) WITH CHECK (true);
CREATE POLICY service_role_all_routes ON routes TO service_role USING (true) WITH CHECK (true);
CREATE POLICY service_role_all_buses ON buses TO service_role USING (true) WITH CHECK (true);
CREATE POLICY service_role_all_requests ON requests TO service_role USING (true) WITH CHECK (true);
CREATE POLICY service_role_all_allocations ON allocations TO service_role USING (true) WITH CHECK (true);
CREATE POLICY service_role_all_alerts ON alerts TO service_role USING (true) WITH CHECK (true);
CREATE POLICY service_role_all_telemetry ON telemetry_log TO service_role USING (true) WITH CHECK (true);
CREATE POLICY service_role_all_breakdowns ON breakdown_reports TO service_role USING (true) WITH CHECK (true);
CREATE POLICY service_role_all_road_segments ON road_segments TO service_role USING (true) WITH CHECK (true);
CREATE POLICY service_role_all_weather_events ON weather_events TO service_role USING (true) WITH CHECK (true);


-- 4. Realtime Configuration
-- Enable replica identity full for realtime subscriptions
ALTER TABLE zones REPLICA IDENTITY FULL;
ALTER TABLE buses REPLICA IDENTITY FULL;
ALTER TABLE allocations REPLICA IDENTITY FULL;
ALTER TABLE alerts REPLICA IDENTITY FULL;
ALTER TABLE requests REPLICA IDENTITY FULL;

-- Add realtime to the publication (Supabase default is supabase_realtime)
-- Realtime MVP configuration.
-- Preserve any existing Supabase Realtime publication entries.
DO $$
BEGIN
  BEGIN
    ALTER PUBLICATION supabase_realtime ADD TABLE zones;
  EXCEPTION WHEN duplicate_object THEN
    NULL;
  END;

  BEGIN
    ALTER PUBLICATION supabase_realtime ADD TABLE buses;
  EXCEPTION WHEN duplicate_object THEN
    NULL;
  END;

  BEGIN
    ALTER PUBLICATION supabase_realtime ADD TABLE allocations;
  EXCEPTION WHEN duplicate_object THEN
    NULL;
  END;

  BEGIN
    ALTER PUBLICATION supabase_realtime ADD TABLE alerts;
  EXCEPTION WHEN duplicate_object THEN
    NULL;
  END;

  BEGIN
    ALTER PUBLICATION supabase_realtime ADD TABLE requests;
  EXCEPTION WHEN duplicate_object THEN
    NULL;
  END;
END
$$;



