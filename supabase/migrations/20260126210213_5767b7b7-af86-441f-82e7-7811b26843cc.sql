-- =============================================
-- MULTI-TENANCY MIGRATION
-- =============================================

-- 1. Create org_role enum
CREATE TYPE public.org_role AS ENUM ('owner', 'admin', 'member');

-- 2. Create organizations table
CREATE TABLE public.organizations (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  name TEXT NOT NULL,
  slug TEXT NOT NULL UNIQUE,
  settings JSONB DEFAULT '{
    "allowSelfAssignment": true,
    "requireApprovalForCheckout": false,
    "defaultAssetLocation": null,
    "notificationEmail": null,
    "timezone": "America/Costa_Rica"
  }'::jsonb,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

-- 3. Create organization_members table (roles stored here, NOT in profiles)
CREATE TABLE public.organization_members (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  organization_id UUID NOT NULL REFERENCES public.organizations(id) ON DELETE CASCADE,
  user_id UUID NOT NULL REFERENCES public.profiles(id) ON DELETE CASCADE,
  role public.org_role NOT NULL DEFAULT 'member',
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  UNIQUE(organization_id, user_id)
);

-- 4. Create organization_invites table
CREATE TABLE public.organization_invites (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  organization_id UUID NOT NULL REFERENCES public.organizations(id) ON DELETE CASCADE,
  email TEXT NOT NULL,
  role public.org_role NOT NULL DEFAULT 'member',
  invited_by UUID NOT NULL REFERENCES public.profiles(id) ON DELETE CASCADE,
  token TEXT NOT NULL UNIQUE DEFAULT encode(gen_random_bytes(32), 'hex'),
  expires_at TIMESTAMPTZ NOT NULL DEFAULT (now() + interval '7 days'),
  accepted_at TIMESTAMPTZ,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

-- 5. Add organization_id to existing tables (nullable for migration)
ALTER TABLE public.assets ADD COLUMN organization_id UUID REFERENCES public.organizations(id) ON DELETE CASCADE;
ALTER TABLE public.licenses ADD COLUMN organization_id UUID REFERENCES public.organizations(id) ON DELETE CASCADE;
ALTER TABLE public.audit_log ADD COLUMN organization_id UUID REFERENCES public.organizations(id) ON DELETE CASCADE;
ALTER TABLE public.requests ADD COLUMN organization_id UUID REFERENCES public.organizations(id) ON DELETE CASCADE;

-- 6. Create indexes for performance
CREATE INDEX idx_organization_members_user_id ON public.organization_members(user_id);
CREATE INDEX idx_organization_members_org_id ON public.organization_members(organization_id);
CREATE INDEX idx_organization_invites_token ON public.organization_invites(token);
CREATE INDEX idx_organization_invites_email ON public.organization_invites(email);
CREATE INDEX idx_assets_org_id ON public.assets(organization_id);
CREATE INDEX idx_licenses_org_id ON public.licenses(organization_id);
CREATE INDEX idx_audit_log_org_id ON public.audit_log(organization_id);
CREATE INDEX idx_requests_org_id ON public.requests(organization_id);

-- 7. Security definer function: get user's primary organization
CREATE OR REPLACE FUNCTION public.get_user_org_id(_user_id UUID)
RETURNS UUID
LANGUAGE sql
STABLE
SECURITY DEFINER
SET search_path = public
AS $$
  SELECT organization_id
  FROM public.organization_members
  WHERE user_id = _user_id
  ORDER BY created_at ASC
  LIMIT 1
$$;

-- 8. Security definer function: check if user has specific role in org
CREATE OR REPLACE FUNCTION public.has_org_role(_user_id UUID, _org_id UUID, _role public.org_role)
RETURNS BOOLEAN
LANGUAGE sql
STABLE
SECURITY DEFINER
SET search_path = public
AS $$
  SELECT EXISTS (
    SELECT 1
    FROM public.organization_members
    WHERE user_id = _user_id
      AND organization_id = _org_id
      AND role = _role
  )
$$;

-- 9. Security definer function: check if user is admin or owner in org
CREATE OR REPLACE FUNCTION public.is_org_admin(_user_id UUID, _org_id UUID)
RETURNS BOOLEAN
LANGUAGE sql
STABLE
SECURITY DEFINER
SET search_path = public
AS $$
  SELECT EXISTS (
    SELECT 1
    FROM public.organization_members
    WHERE user_id = _user_id
      AND organization_id = _org_id
      AND role IN ('admin', 'owner')
  )
$$;

-- 10. Security definer function: check if user belongs to organization
CREATE OR REPLACE FUNCTION public.is_org_member(_user_id UUID, _org_id UUID)
RETURNS BOOLEAN
LANGUAGE sql
STABLE
SECURITY DEFINER
SET search_path = public
AS $$
  SELECT EXISTS (
    SELECT 1
    FROM public.organization_members
    WHERE user_id = _user_id
      AND organization_id = _org_id
  )
$$;

-- 11. Helper function to generate slug from name
CREATE OR REPLACE FUNCTION public.generate_org_slug(_name TEXT)
RETURNS TEXT
LANGUAGE plpgsql
AS $$
DECLARE
  base_slug TEXT;
  final_slug TEXT;
  counter INT := 0;
BEGIN
  -- Convert to lowercase, replace spaces with hyphens, remove special chars
  base_slug := lower(regexp_replace(_name, '[^a-zA-Z0-9\s]', '', 'g'));
  base_slug := regexp_replace(base_slug, '\s+', '-', 'g');
  final_slug := base_slug;
  
  -- Check for uniqueness and append number if needed
  WHILE EXISTS (SELECT 1 FROM public.organizations WHERE slug = final_slug) LOOP
    counter := counter + 1;
    final_slug := base_slug || '-' || counter;
  END LOOP;
  
  RETURN final_slug;
END;
$$;

-- =============================================
-- ENABLE RLS ON NEW TABLES
-- =============================================

ALTER TABLE public.organizations ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.organization_members ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.organization_invites ENABLE ROW LEVEL SECURITY;

-- =============================================
-- RLS POLICIES FOR ORGANIZATIONS
-- =============================================

-- Members can view their organizations
CREATE POLICY "Members can view their organizations"
ON public.organizations FOR SELECT
USING (
  public.is_org_member(auth.uid(), id)
);

-- Only owners can update organization
CREATE POLICY "Owners can update organization"
ON public.organizations FOR UPDATE
USING (
  public.has_org_role(auth.uid(), id, 'owner')
);

-- Any authenticated user can create an organization
CREATE POLICY "Authenticated users can create organizations"
ON public.organizations FOR INSERT
WITH CHECK (auth.uid() IS NOT NULL);

-- Only owners can delete organization
CREATE POLICY "Owners can delete organization"
ON public.organizations FOR DELETE
USING (
  public.has_org_role(auth.uid(), id, 'owner')
);

-- =============================================
-- RLS POLICIES FOR ORGANIZATION_MEMBERS
-- =============================================

-- Members can view other members in their org
CREATE POLICY "Members can view org members"
ON public.organization_members FOR SELECT
USING (
  public.is_org_member(auth.uid(), organization_id)
);

-- Admins/owners can add members
CREATE POLICY "Admins can add members"
ON public.organization_members FOR INSERT
WITH CHECK (
  public.is_org_admin(auth.uid(), organization_id)
  OR (
    -- Allow user to add themselves when creating org (they become owner)
    user_id = auth.uid() AND role = 'owner'
  )
);

-- Owners can update member roles (but not their own)
CREATE POLICY "Owners can update member roles"
ON public.organization_members FOR UPDATE
USING (
  public.has_org_role(auth.uid(), organization_id, 'owner')
  AND user_id != auth.uid()
);

-- Admins/owners can remove members (owners can't remove themselves)
CREATE POLICY "Admins can remove members"
ON public.organization_members FOR DELETE
USING (
  (public.is_org_admin(auth.uid(), organization_id) AND user_id != auth.uid())
  OR (user_id = auth.uid() AND NOT public.has_org_role(auth.uid(), organization_id, 'owner'))
);

-- =============================================
-- RLS POLICIES FOR ORGANIZATION_INVITES
-- =============================================

-- Admins can view invites for their org
CREATE POLICY "Admins can view org invites"
ON public.organization_invites FOR SELECT
USING (
  public.is_org_admin(auth.uid(), organization_id)
);

-- Admins can create invites
CREATE POLICY "Admins can create invites"
ON public.organization_invites FOR INSERT
WITH CHECK (
  public.is_org_admin(auth.uid(), organization_id)
  AND invited_by = auth.uid()
);

-- Admins can delete/cancel invites
CREATE POLICY "Admins can delete invites"
ON public.organization_invites FOR DELETE
USING (
  public.is_org_admin(auth.uid(), organization_id)
);

-- Anyone can update invite to accept it (via token)
CREATE POLICY "Anyone can accept invite with token"
ON public.organization_invites FOR UPDATE
USING (true)
WITH CHECK (
  accepted_at IS NOT NULL
);

-- =============================================
-- DROP OLD RLS POLICIES ON EXISTING TABLES
-- =============================================

-- Assets policies
DROP POLICY IF EXISTS "Admins can insert assets" ON public.assets;
DROP POLICY IF EXISTS "Admins can update assets" ON public.assets;
DROP POLICY IF EXISTS "Employees can update own assigned assets" ON public.assets;
DROP POLICY IF EXISTS "Everyone can view available assets" ON public.assets;

-- Licenses policies
DROP POLICY IF EXISTS "Admins can insert licenses" ON public.licenses;
DROP POLICY IF EXISTS "Admins can update licenses" ON public.licenses;
DROP POLICY IF EXISTS "Employees can update own assigned licenses" ON public.licenses;
DROP POLICY IF EXISTS "Only admins can directly access licenses table" ON public.licenses;

-- Audit log policies
DROP POLICY IF EXISTS "Everyone can insert audit logs" ON public.audit_log;
DROP POLICY IF EXISTS "Everyone can view audit logs" ON public.audit_log;

-- Requests policies
DROP POLICY IF EXISTS "Admins can update requests" ON public.requests;
DROP POLICY IF EXISTS "Users can create requests" ON public.requests;
DROP POLICY IF EXISTS "Users can view own requests" ON public.requests;

-- =============================================
-- NEW ORG-SCOPED RLS POLICIES FOR ASSETS
-- =============================================

-- Members can view assets in their org
CREATE POLICY "Org members can view assets"
ON public.assets FOR SELECT
USING (
  public.is_org_member(auth.uid(), organization_id)
);

-- Admins can insert assets
CREATE POLICY "Org admins can insert assets"
ON public.assets FOR INSERT
WITH CHECK (
  public.is_org_admin(auth.uid(), organization_id)
);

-- Admins can update any asset, members can update assigned assets
CREATE POLICY "Org admins or assignees can update assets"
ON public.assets FOR UPDATE
USING (
  public.is_org_admin(auth.uid(), organization_id)
  OR assignee_user_id = auth.uid()
);

-- Admins can delete assets
CREATE POLICY "Org admins can delete assets"
ON public.assets FOR DELETE
USING (
  public.is_org_admin(auth.uid(), organization_id)
);

-- =============================================
-- NEW ORG-SCOPED RLS POLICIES FOR LICENSES
-- =============================================

-- Only admins can view licenses (full access)
CREATE POLICY "Org admins can view licenses"
ON public.licenses FOR SELECT
USING (
  public.is_org_admin(auth.uid(), organization_id)
);

-- Admins can insert licenses
CREATE POLICY "Org admins can insert licenses"
ON public.licenses FOR INSERT
WITH CHECK (
  public.is_org_admin(auth.uid(), organization_id)
);

-- Admins can update licenses
CREATE POLICY "Org admins can update licenses"
ON public.licenses FOR UPDATE
USING (
  public.is_org_admin(auth.uid(), organization_id)
);

-- Admins can delete licenses
CREATE POLICY "Org admins can delete licenses"
ON public.licenses FOR DELETE
USING (
  public.is_org_admin(auth.uid(), organization_id)
);

-- =============================================
-- UPDATE LICENSES_SAFE VIEW FOR ORG CONTEXT
-- =============================================

DROP VIEW IF EXISTS public.licenses_safe;
CREATE VIEW public.licenses_safe
WITH (security_invoker = on)
AS SELECT 
  id,
  organization_id,
  product,
  status,
  seat_key_masked,
  assignee_user_id,
  expires_at,
  qr_code,
  notes,
  created_at,
  updated_at
FROM public.licenses
WHERE public.is_org_member(auth.uid(), organization_id);

-- =============================================
-- NEW ORG-SCOPED RLS POLICIES FOR AUDIT_LOG
-- =============================================

-- Members can view audit logs in their org
CREATE POLICY "Org members can view audit logs"
ON public.audit_log FOR SELECT
USING (
  public.is_org_member(auth.uid(), organization_id)
);

-- Members can insert audit logs for their org
CREATE POLICY "Org members can insert audit logs"
ON public.audit_log FOR INSERT
WITH CHECK (
  public.is_org_member(auth.uid(), organization_id)
  AND by_user_id = auth.uid()
);

-- =============================================
-- NEW ORG-SCOPED RLS POLICIES FOR REQUESTS
-- =============================================

-- Users can view their own requests or admins can view all org requests
CREATE POLICY "Users view own or admins view all requests"
ON public.requests FOR SELECT
USING (
  (requester_user_id = auth.uid() AND public.is_org_member(auth.uid(), organization_id))
  OR public.is_org_admin(auth.uid(), organization_id)
);

-- Members can create requests in their org
CREATE POLICY "Org members can create requests"
ON public.requests FOR INSERT
WITH CHECK (
  public.is_org_member(auth.uid(), organization_id)
  AND requester_user_id = auth.uid()
);

-- Admins can update requests
CREATE POLICY "Org admins can update requests"
ON public.requests FOR UPDATE
USING (
  public.is_org_admin(auth.uid(), organization_id)
);

-- =============================================
-- UPDATE HANDLE_NEW_USER TRIGGER
-- =============================================

CREATE OR REPLACE FUNCTION public.handle_new_user()
RETURNS TRIGGER
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  _org_id UUID;
  _org_name TEXT;
  _org_slug TEXT;
  _invite_record RECORD;
BEGIN
  -- Insert profile
  INSERT INTO public.profiles (id, email, name, role)
  VALUES (
    NEW.id,
    NEW.email,
    COALESCE(NEW.raw_user_meta_data->>'name', NEW.email),
    'employee'
  );
  
  -- Check if there's a pending invite for this email
  SELECT * INTO _invite_record
  FROM public.organization_invites
  WHERE email = NEW.email
    AND accepted_at IS NULL
    AND expires_at > now()
  ORDER BY created_at DESC
  LIMIT 1;
  
  IF _invite_record IS NOT NULL THEN
    -- Add user to the invited organization
    INSERT INTO public.organization_members (organization_id, user_id, role)
    VALUES (_invite_record.organization_id, NEW.id, _invite_record.role);
    
    -- Mark invite as accepted
    UPDATE public.organization_invites
    SET accepted_at = now()
    WHERE id = _invite_record.id;
  ELSE
    -- Create a default organization for new users
    _org_name := COALESCE(NEW.raw_user_meta_data->>'name', split_part(NEW.email, '@', 1)) || '''s Organization';
    _org_slug := public.generate_org_slug(_org_name);
    
    INSERT INTO public.organizations (name, slug)
    VALUES (_org_name, _org_slug)
    RETURNING id INTO _org_id;
    
    -- Add user as owner of the new organization
    INSERT INTO public.organization_members (organization_id, user_id, role)
    VALUES (_org_id, NEW.id, 'owner');
  END IF;
  
  RETURN NEW;
END;
$$;

-- =============================================
-- TRIGGERS FOR UPDATED_AT
-- =============================================

CREATE TRIGGER update_organizations_updated_at
BEFORE UPDATE ON public.organizations
FOR EACH ROW
EXECUTE FUNCTION public.update_updated_at_column();