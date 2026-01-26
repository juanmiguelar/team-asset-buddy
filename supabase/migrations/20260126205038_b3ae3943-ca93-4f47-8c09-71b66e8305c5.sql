-- Step 1: Create a secure view without seat_key_full (security_invoker ensures RLS is respected)
CREATE VIEW public.licenses_safe
WITH (security_invoker = on)
AS SELECT 
  id,
  qr_code,
  product,
  seat_key_masked,
  status,
  assignee_user_id,
  expires_at,
  notes,
  created_at,
  updated_at
FROM public.licenses;

-- Step 2: Drop the overly permissive SELECT policy on the base table
DROP POLICY IF EXISTS "Everyone can view licenses (masked)" ON public.licenses;

-- Step 3: Create restrictive policy - only admins can directly query base table
CREATE POLICY "Only admins can directly access licenses table"
ON public.licenses
FOR SELECT
TO authenticated
USING (public.is_admin(auth.uid()));

-- Step 4: Create security definer function for admins to get full key when needed
CREATE OR REPLACE FUNCTION public.get_license_full_key(_license_id uuid)
RETURNS TEXT
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  _full_key TEXT;
BEGIN
  -- Check if user is admin
  IF NOT public.is_admin(auth.uid()) THEN
    RAISE EXCEPTION 'Unauthorized: Only admins can access full license keys';
  END IF;
  
  -- Get the full key
  SELECT seat_key_full INTO _full_key
  FROM public.licenses
  WHERE id = _license_id;
  
  RETURN _full_key;
END;
$$;