-- Production fixes: bind request writes to the authenticated user and create profiles on signup.

CREATE OR REPLACE FUNCTION public.handle_new_user()
RETURNS trigger
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
BEGIN
  INSERT INTO public.profiles (id, display_name)
  VALUES (NEW.id, COALESCE(NEW.raw_user_meta_data ->> 'display_name', NEW.email));
  RETURN NEW;
END;
$$;

DROP TRIGGER IF EXISTS on_auth_user_created ON auth.users;
CREATE TRIGGER on_auth_user_created
  AFTER INSERT ON auth.users
  FOR EACH ROW EXECUTE FUNCTION public.handle_new_user();

CREATE OR REPLACE FUNCTION public.submit_drt_request(
  p_user_id uuid,
  p_origin_lat float8,
  p_origin_lng float8,
  p_dest_lat float8,
  p_dest_lng float8,
  p_party_size int,
  p_zone_id text,
  p_origin_query text,
  p_dest_query text
) RETURNS json
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  recent_count int;
  new_req_id uuid;
BEGIN
  IF auth.uid() IS NULL OR auth.uid() <> p_user_id THEN
    RAISE EXCEPTION 'You must be signed in to submit a request';
  END IF;
  IF p_party_size < 1 OR p_party_size > 60 THEN
    RAISE EXCEPTION 'Party size must be between 1 and 60';
  END IF;
  IF p_origin_lat NOT BETWEEN -90 AND 90 OR p_dest_lat NOT BETWEEN -90 AND 90
     OR p_origin_lng NOT BETWEEN -180 AND 180 OR p_dest_lng NOT BETWEEN -180 AND 180 THEN
    RAISE EXCEPTION 'Invalid stop coordinates';
  END IF;

  SELECT count(*) INTO recent_count
  FROM public.requests
  WHERE user_id = p_user_id AND created_at > now() - interval '15 minutes';
  IF recent_count >= 5 THEN
    RAISE EXCEPTION 'You have reached the request limit. Try again later.';
  END IF;

  INSERT INTO public.requests (user_id, origin_lat, origin_lng, dest_lat, dest_lng, party_size, zone_id, status)
  VALUES (p_user_id, p_origin_lat, p_origin_lng, p_dest_lat, p_dest_lng, p_party_size, p_zone_id, 'pending')
  RETURNING id INTO new_req_id;

  RETURN json_build_object('success', true, 'request_id', new_req_id);
END;
$$;

REVOKE ALL ON FUNCTION public.submit_drt_request(uuid, float8, float8, float8, float8, int, text, text, text) FROM PUBLIC;
GRANT EXECUTE ON FUNCTION public.submit_drt_request(uuid, float8, float8, float8, float8, int, text, text, text) TO authenticated;

DROP POLICY IF EXISTS anon_insert_requests ON public.requests;
DROP POLICY IF EXISTS municipal_update_allocations ON public.allocations;
CREATE POLICY municipal_update_allocations ON public.allocations
  FOR UPDATE TO authenticated
  USING (public.is_municipal())
  WITH CHECK (public.is_municipal());

DROP POLICY IF EXISTS municipal_insert_conflicts ON public.override_conflicts;
CREATE POLICY municipal_insert_conflicts ON public.override_conflicts
  FOR INSERT TO authenticated
  WITH CHECK (public.is_municipal());
