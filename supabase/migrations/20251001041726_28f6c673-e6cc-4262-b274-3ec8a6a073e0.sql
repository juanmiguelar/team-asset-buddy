-- Enable UUID extension
CREATE EXTENSION IF NOT EXISTS "uuid-ossp";

-- Create enum types
CREATE TYPE public.app_role AS ENUM ('admin', 'employee');
CREATE TYPE public.asset_category AS ENUM ('laptop', 'monitor', 'dock', 'peripheral', 'other');
CREATE TYPE public.asset_status AS ENUM ('available', 'assigned', 'maintenance', 'retired');
CREATE TYPE public.license_product AS ENUM ('adobe_cc', 'jetbrains', 'office_365', 'github', 'other');
CREATE TYPE public.license_status AS ENUM ('available', 'assigned', 'expired');
CREATE TYPE public.audit_action AS ENUM ('check_out', 'check_in', 'assign_override', 'edit', 'create', 'retire');
CREATE TYPE public.request_type AS ENUM ('borrow', 'return', 'transfer');
CREATE TYPE public.request_status AS ENUM ('open', 'approved', 'rejected', 'completed');

-- Create profiles table (extends auth.users)
CREATE TABLE public.profiles (
  id UUID PRIMARY KEY REFERENCES auth.users(id) ON DELETE CASCADE,
  email TEXT NOT NULL,
  name TEXT NOT NULL,
  role app_role NOT NULL DEFAULT 'employee',
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

-- Enable RLS on profiles
ALTER TABLE public.profiles ENABLE ROW LEVEL SECURITY;

-- Profiles policies
CREATE POLICY "Users can view all profiles"
  ON public.profiles FOR SELECT
  TO authenticated
  USING (true);

CREATE POLICY "Users can update own profile"
  ON public.profiles FOR UPDATE
  TO authenticated
  USING (auth.uid() = id);

-- Create function to handle new user signup
CREATE OR REPLACE FUNCTION public.handle_new_user()
RETURNS TRIGGER
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
BEGIN
  INSERT INTO public.profiles (id, email, name, role)
  VALUES (
    NEW.id,
    NEW.email,
    COALESCE(NEW.raw_user_meta_data->>'name', NEW.email),
    'employee'
  );
  RETURN NEW;
END;
$$;

-- Trigger to create profile on signup
CREATE TRIGGER on_auth_user_created
  AFTER INSERT ON auth.users
  FOR EACH ROW
  EXECUTE FUNCTION public.handle_new_user();

-- Create assets table
CREATE TABLE public.assets (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  qr_code TEXT NOT NULL UNIQUE,
  name TEXT NOT NULL,
  category asset_category NOT NULL,
  serial_number TEXT UNIQUE,
  status asset_status NOT NULL DEFAULT 'available',
  assignee_user_id UUID REFERENCES public.profiles(id) ON DELETE SET NULL,
  location TEXT,
  notes TEXT,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

-- Enable RLS on assets
ALTER TABLE public.assets ENABLE ROW LEVEL SECURITY;

-- Assets policies
CREATE POLICY "Everyone can view available assets"
  ON public.assets FOR SELECT
  TO authenticated
  USING (true);

CREATE POLICY "Admins can insert assets"
  ON public.assets FOR INSERT
  TO authenticated
  WITH CHECK (
    EXISTS (SELECT 1 FROM public.profiles WHERE id = auth.uid() AND role = 'admin')
  );

CREATE POLICY "Admins can update assets"
  ON public.assets FOR UPDATE
  TO authenticated
  USING (
    EXISTS (SELECT 1 FROM public.profiles WHERE id = auth.uid() AND role = 'admin')
  );

CREATE POLICY "Employees can update own assigned assets"
  ON public.assets FOR UPDATE
  TO authenticated
  USING (assignee_user_id = auth.uid())
  WITH CHECK (assignee_user_id = auth.uid() OR assignee_user_id IS NULL);

-- Create licenses table
CREATE TABLE public.licenses (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  qr_code TEXT NOT NULL UNIQUE,
  product license_product NOT NULL,
  seat_key_masked TEXT,
  seat_key_full TEXT,
  status license_status NOT NULL DEFAULT 'available',
  assignee_user_id UUID REFERENCES public.profiles(id) ON DELETE SET NULL,
  expires_at DATE,
  notes TEXT,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

-- Enable RLS on licenses
ALTER TABLE public.licenses ENABLE ROW LEVEL SECURITY;

-- Licenses policies  
CREATE POLICY "Everyone can view licenses (masked)"
  ON public.licenses FOR SELECT
  TO authenticated
  USING (true);

CREATE POLICY "Admins can insert licenses"
  ON public.licenses FOR INSERT
  TO authenticated
  WITH CHECK (
    EXISTS (SELECT 1 FROM public.profiles WHERE id = auth.uid() AND role = 'admin')
  );

CREATE POLICY "Admins can update licenses"
  ON public.licenses FOR UPDATE
  TO authenticated
  USING (
    EXISTS (SELECT 1 FROM public.profiles WHERE id = auth.uid() AND role = 'admin')
  );

CREATE POLICY "Employees can update own assigned licenses"
  ON public.licenses FOR UPDATE
  TO authenticated
  USING (assignee_user_id = auth.uid())
  WITH CHECK (assignee_user_id = auth.uid() OR assignee_user_id IS NULL);

-- Create audit_log table
CREATE TABLE public.audit_log (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  resource_type TEXT NOT NULL CHECK (resource_type IN ('asset', 'license')),
  resource_id UUID NOT NULL,
  action audit_action NOT NULL,
  by_user_id UUID NOT NULL REFERENCES public.profiles(id),
  to_user_id UUID REFERENCES public.profiles(id),
  timestamp TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  metadata JSONB
);

-- Enable RLS on audit_log
ALTER TABLE public.audit_log ENABLE ROW LEVEL SECURITY;

-- Audit log policies
CREATE POLICY "Everyone can view audit logs"
  ON public.audit_log FOR SELECT
  TO authenticated
  USING (true);

CREATE POLICY "Everyone can insert audit logs"
  ON public.audit_log FOR INSERT
  TO authenticated
  WITH CHECK (by_user_id = auth.uid());

-- Create requests table
CREATE TABLE public.requests (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  resource_type TEXT NOT NULL CHECK (resource_type IN ('asset', 'license')),
  resource_id UUID NOT NULL,
  requester_user_id UUID NOT NULL REFERENCES public.profiles(id),
  type request_type NOT NULL,
  status request_status NOT NULL DEFAULT 'open',
  notes TEXT,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

-- Enable RLS on requests
ALTER TABLE public.requests ENABLE ROW LEVEL SECURITY;

-- Requests policies
CREATE POLICY "Users can view own requests"
  ON public.requests FOR SELECT
  TO authenticated
  USING (requester_user_id = auth.uid() OR EXISTS (
    SELECT 1 FROM public.profiles WHERE id = auth.uid() AND role = 'admin'
  ));

CREATE POLICY "Users can create requests"
  ON public.requests FOR INSERT
  TO authenticated
  WITH CHECK (requester_user_id = auth.uid());

CREATE POLICY "Admins can update requests"
  ON public.requests FOR UPDATE
  TO authenticated
  USING (EXISTS (
    SELECT 1 FROM public.profiles WHERE id = auth.uid() AND role = 'admin'
  ));

-- Create function to update updated_at timestamp
CREATE OR REPLACE FUNCTION public.update_updated_at_column()
RETURNS TRIGGER
LANGUAGE plpgsql
AS $$
BEGIN
  NEW.updated_at = NOW();
  RETURN NEW;
END;
$$;

-- Triggers for updated_at
CREATE TRIGGER update_assets_updated_at
  BEFORE UPDATE ON public.assets
  FOR EACH ROW
  EXECUTE FUNCTION public.update_updated_at_column();

CREATE TRIGGER update_licenses_updated_at
  BEFORE UPDATE ON public.licenses
  FOR EACH ROW
  EXECUTE FUNCTION public.update_updated_at_column();

CREATE TRIGGER update_requests_updated_at
  BEFORE UPDATE ON public.requests
  FOR EACH ROW
  EXECUTE FUNCTION public.update_updated_at_column();