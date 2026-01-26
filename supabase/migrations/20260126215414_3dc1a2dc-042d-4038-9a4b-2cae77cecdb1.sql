-- Create subscription plan enum
CREATE TYPE public.subscription_plan AS ENUM ('free', 'pro', 'enterprise');

-- Create subscription status enum
CREATE TYPE public.subscription_status AS ENUM ('active', 'canceled', 'past_due');

-- Create organization subscriptions table
CREATE TABLE public.organization_subscriptions (
  id UUID NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  organization_id UUID NOT NULL UNIQUE REFERENCES public.organizations(id) ON DELETE CASCADE,
  plan public.subscription_plan NOT NULL DEFAULT 'free',
  status public.subscription_status NOT NULL DEFAULT 'active',
  bmc_supporter_email TEXT,
  bmc_subscription_id TEXT,
  activated_by UUID REFERENCES public.profiles(id),
  current_period_start TIMESTAMPTZ,
  current_period_end TIMESTAMPTZ,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

-- Create index for quick lookups
CREATE INDEX idx_org_subscriptions_org_id ON public.organization_subscriptions(organization_id);
CREATE INDEX idx_org_subscriptions_bmc_email ON public.organization_subscriptions(bmc_supporter_email);

-- Enable RLS
ALTER TABLE public.organization_subscriptions ENABLE ROW LEVEL SECURITY;

-- RLS Policies
CREATE POLICY "Org members can view their subscription"
ON public.organization_subscriptions
FOR SELECT
USING (is_org_member(auth.uid(), organization_id));

CREATE POLICY "Org owners can update subscription"
ON public.organization_subscriptions
FOR UPDATE
USING (has_org_role(auth.uid(), organization_id, 'owner'::org_role));

-- Add trigger for updated_at
CREATE TRIGGER update_organization_subscriptions_updated_at
BEFORE UPDATE ON public.organization_subscriptions
FOR EACH ROW
EXECUTE FUNCTION public.update_updated_at_column();

-- Create function to auto-create free subscription for new organizations
CREATE OR REPLACE FUNCTION public.handle_new_organization_subscription()
RETURNS TRIGGER AS $$
BEGIN
  INSERT INTO public.organization_subscriptions (organization_id, plan, status)
  VALUES (NEW.id, 'free', 'active');
  RETURN NEW;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER SET search_path = public;

-- Create trigger to auto-create subscription when org is created
CREATE TRIGGER on_organization_created_create_subscription
AFTER INSERT ON public.organizations
FOR EACH ROW
EXECUTE FUNCTION public.handle_new_organization_subscription();

-- Create free subscriptions for existing organizations that don't have one
INSERT INTO public.organization_subscriptions (organization_id, plan, status)
SELECT id, 'free', 'active'
FROM public.organizations
WHERE id NOT IN (SELECT organization_id FROM public.organization_subscriptions);