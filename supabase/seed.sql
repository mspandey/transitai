-- Seed stops for the demo city
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

-- Example zone seeds (extend existing if needed)
INSERT INTO zones (id, geohash, current_demand_count, threshold, predicted_trend) VALUES
  ('A', '9q8yu', 45,  100, 'flat'),
  ('B', '9q8yv', 130, 200, 'rising'),
  ('C', '9q8yw', 284, 300, 'rising'),
  ('D', '9q8yx', 20,  100, 'falling')
ON CONFLICT (id) DO NOTHING;

-- Link stops to a demo route (requires a route to exist)
-- These are inserted via upsert to be safe in any order
INSERT INTO buses (id, capacity, current_lat, current_lng, status, last_telemetry_at) VALUES
  ('BUS 01', 60, 37.7820, -122.4200, 'Available',  now()),
  ('BUS 02', 46, 37.7800, -122.4190, 'Assigned',   now()),
  ('BUS 03', 60, 37.7760, -122.4230, 'Available',  now()),
  ('BUS 04', 46, 37.7840, -122.4150, 'Maintenance',now()),
  ('BUS 05', 60, 37.7750, -122.4200, 'Available',  now()),
  ('BUS 06', 46, 37.7870, -122.4100, 'Assigned',   now()),
  ('BUS 07', 60, 37.7790, -122.4170, 'Available',  now()),
  ('BUS 08', 46, 37.7800, -122.4240, 'Available',  now())
ON CONFLICT (id) DO NOTHING;

-- Demo routes
INSERT INTO routes (id, zone_id, eta_minutes, status) VALUES
  ('R-101', 'C', 12, 'Active'),
  ('R-202', 'B', 18, 'Active'),
  ('R-318', 'A', 25, 'Delayed'),
  ('R-422', 'D', 8,  'Active')
ON CONFLICT (id) DO NOTHING;

-- Link buses to routes
UPDATE buses SET current_route_id = 'R-101' WHERE id = 'BUS 02';
UPDATE buses SET current_route_id = 'R-202' WHERE id = 'BUS 06';

-- Route stops sequences
INSERT INTO route_stops (route_id, stop_id, sequence_order) VALUES
  ('R-101', 'STOP-005', 1),
  ('R-101', 'STOP-009', 2),
  ('R-101', 'STOP-006', 3),
  ('R-202', 'STOP-003', 1),
  ('R-202', 'STOP-004', 2),
  ('R-202', 'STOP-010', 3),
  ('R-318', 'STOP-001', 1),
  ('R-318', 'STOP-002', 2),
  ('R-318', 'STOP-007', 3),
  ('R-422', 'STOP-007', 1),
  ('R-422', 'STOP-008', 2)
ON CONFLICT (route_id, stop_id) DO NOTHING;
