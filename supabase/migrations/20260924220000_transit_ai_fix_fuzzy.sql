-- Fix the return type of similarity to match the table definition (similarity float)
-- The pg_trgm similarity() function returns 'real' (float4), which conflicts with 'float' (double precision).
-- We cast it to float (double precision) so it matches.

CREATE OR REPLACE FUNCTION search_stops(search_term text, match_threshold float DEFAULT 0.3)
RETURNS TABLE (id text, name text, lat float8, lng float8, similarity float) AS $$
BEGIN
  RETURN QUERY
  SELECT s.id, s.name, s.lat, s.lng, similarity(s.name, search_term)::float as sim
  FROM stops s
  WHERE similarity(s.name, search_term) > match_threshold
  ORDER BY sim DESC
  LIMIT 3;
END;
$$ LANGUAGE plpgsql;

-- Seed some missing stops data for the fuzzy search
INSERT INTO stops (id, name, lat, lng) VALUES
  ('STOP-001', 'Riverside Gate 2',       37.7800, -122.4250),
  ('STOP-002', 'Riverside Terminal',     37.7810, -122.4260),
  ('STOP-003', 'Tech Park Main Entrance',37.7850, -122.4100),
  ('STOP-004', 'Tech Park East',         37.7860, -122.4090),
  ('STOP-005', 'Central Market Station', 37.7740, -122.4190),
  ('STOP-006', 'Central Market North',   37.7750, -122.4195),
  ('STOP-007', 'North Depot Hub',        37.7900, -122.4300),
  ('STOP-008', 'North Depot Loop',       37.7910, -122.4310),
  ('STOP-009', 'City Hall Plaza',        37.7790, -122.4160),
  ('STOP-010', 'University Ave East',    37.7820, -122.4050)
ON CONFLICT (id) DO NOTHING;
