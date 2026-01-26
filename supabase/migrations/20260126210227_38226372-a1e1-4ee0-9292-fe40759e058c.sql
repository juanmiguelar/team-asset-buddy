-- Fix function search_path warnings
ALTER FUNCTION public.generate_org_slug(text) SET search_path = public;

-- Fix the permissive RLS policy on organization_invites
DROP POLICY IF EXISTS "Anyone can accept invite with token" ON public.organization_invites;

-- Create a more restrictive policy for accepting invites
-- Users can only update invites that match their email
CREATE POLICY "Users can accept their own invites"
ON public.organization_invites FOR UPDATE
USING (
  email = (SELECT email FROM auth.users WHERE id = auth.uid())
  AND accepted_at IS NULL
  AND expires_at > now()
)
WITH CHECK (
  accepted_at IS NOT NULL
);