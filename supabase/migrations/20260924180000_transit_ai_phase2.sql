-- Enable pg_trgm for fuzzy search
CREATE EXTENSION IF NOT EXISTS pg_trgm;

-- 1. Profiles & Auth Additions
CREATE TABLE profiles (
  id uuid PRIMARY KEY REFERENCES auth.users(id) ON DELETE CASCADE,
  role text DEFAULT 'citizen', -- 'citizen', 'municipal'
  display_name text,
  created_at timestamptz DEFAULT now()
);

ALTER TABLE requests 
ADD COLUMN user_id uuid REFERENCES auth.users(id);

-- Rate limiting RPC for requests
CREATE OR REPLACE FUNCTION submit_drt_request(
  p_user_id uuid,
  p_origin_lat float8,
  p_origin_lng float8,
  p_dest_lat float8,
  p_dest_lng float8,
  p_party_size int,
  p_zone_id text,
  p_origin_query text,
  p_dest_query text
) RETURNS json AS $$
DECLARE
  recent_count int;
  new_req_id uuid;
BEGIN
  -- Check rate limit (5 requests / 15 minutes)
  SELECT count(*) INTO recent_count 
  FROM requests 
  WHERE user_id = p_user_id 
    AND created_at > (now() - interval '15 minutes');
    
  IF recent_count >= 5 THEN
    RAISE EXCEPTION 'You have reached the request limit. Try again later.';
  END IF;

  INSERT INTO requests (user_id, origin_lat, origin_lng, dest_lat, dest_lng, party_size, zone_id, status)
  VALUES (p_user_id, p_origin_lat, p_origin_lng, p_dest_lat, p_dest_lng, p_party_size, p_zone_id, 'pending')
  RETURNING id INTO new_req_id;

  RETURN json_build_object('success', true, 'request_id', new_req_id);
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;


-- 2. Fixed Stops Schema & Fuzzy Search
CREATE TABLE stops (
  id text PRIMARY KEY,
  name text NOT NULL,
  lat float8,
  lng float8
);

-- Trigram index for fuzzy matching
CREATE INDEX stops_name_trgm_idx ON stops USING gin (name gin_trgm_ops);

CREATE TABLE route_stops (
  route_id text REFERENCES routes(id),
  stop_id text REFERENCES stops(id),
  sequence_order int,
  PRIMARY KEY (route_id, stop_id)
);

CREATE OR REPLACE FUNCTION search_stops(search_term text, match_threshold float DEFAULT 0.3)
RETURNS TABLE (id text, name text, lat float8, lng float8, similarity float) AS $$
BEGIN
  RETURN QUERY
  SELECT s.id, s.name, s.lat, s.lng, similarity(s.name, search_term) as sim
  FROM stops s
  WHERE similarity(s.name, search_term) > match_threshold
  ORDER BY sim DESC
  LIMIT 3;
END;
$$ LANGUAGE plpgsql;


-- 3. Admin & Municipal Extensions
CREATE TABLE dev_action_log (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  action text,
  target_table text,
  target_id text,
  details jsonb,
  created_at timestamptz DEFAULT now()
);

CREATE TABLE dev_auth_attempts (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  ip_address text,
  attempted_at timestamptz DEFAULT now(),
  success boolean
);

CREATE TABLE override_conflicts (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  target_table text,
  target_id text,
  attempted_by text,
  attempted_at timestamptz DEFAULT now(),
  details jsonb
);

-- Concurrency control versions
ALTER TABLE allocations ADD COLUMN version integer DEFAULT 1;
ALTER TABLE buses ADD COLUMN version integer DEFAULT 1;


-- RLS Policies
ALTER TABLE profiles ENABLE ROW LEVEL SECURITY;
ALTER TABLE stops ENABLE ROW LEVEL SECURITY;
ALTER TABLE route_stops ENABLE ROW LEVEL SECURITY;
ALTER TABLE dev_action_log ENABLE ROW LEVEL SECURITY;
ALTER TABLE dev_auth_attempts ENABLE ROW LEVEL SECURITY;
ALTER TABLE override_conflicts ENABLE ROW LEVEL SECURITY;

-- Profiles: Users can read their own, service_role can do all
CREATE POLICY profiles_read_own ON profiles FOR SELECT USING (auth.uid() = id);
CREATE POLICY profiles_update_own ON profiles FOR UPDATE USING (auth.uid() = id);

-- Stops & Route Stops: Public read
CREATE POLICY anon_read_stops ON stops FOR SELECT TO anon, authenticated USING (true);
CREATE POLICY anon_read_route_stops ON route_stops FOR SELECT TO anon, authenticated USING (true);

-- Requests: Scoped to owning user
DROP POLICY IF EXISTS anon_read_own_requests ON requests;
CREATE POLICY requests_read_own ON requests FOR SELECT TO authenticated USING (auth.uid() = user_id);

-- Admin tables: Service role only
CREATE POLICY dev_action_log_service ON dev_action_log TO service_role USING (true) WITH CHECK (true);
CREATE POLICY dev_auth_attempts_service ON dev_auth_attempts TO service_role USING (true) WITH CHECK (true);
CREATE POLICY override_conflicts_service ON override_conflicts TO service_role USING (true) WITH CHECK (true);
