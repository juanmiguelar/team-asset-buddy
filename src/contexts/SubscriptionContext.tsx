import { createContext, useContext, useEffect, useState, useCallback } from "react";
import { supabase } from "@/integrations/supabase/client";
import { useOrganization } from "./OrganizationContext";
import { PLAN_LIMITS, type SubscriptionPlan, type SubscriptionStatus, type PlanLimits } from "@/lib/plans";

interface OrganizationSubscription {
  id: string;
  organization_id: string;
  plan: SubscriptionPlan;
  status: SubscriptionStatus;
  bmc_supporter_email: string | null;
  bmc_subscription_id: string | null;
  activated_by: string | null;
  current_period_start: string | null;
  current_period_end: string | null;
  created_at: string;
  updated_at: string;
}

interface Usage {
  assets: number;
  licenses: number;
  members: number;
}

interface SubscriptionContextType {
  subscription: OrganizationSubscription | null;
  plan: SubscriptionPlan;
  status: SubscriptionStatus;
  limits: PlanLimits;
  usage: Usage;
  loading: boolean;
  
  // Limit checks
  canCreateAsset: () => boolean;
  canCreateLicense: () => boolean;
  canInviteMember: () => boolean;
  getRemainingAssets: () => number;
  getRemainingLicenses: () => number;
  getRemainingMembers: () => number;
  
  // Feature checks
  hasFeature: (feature: keyof PlanLimits['features']) => boolean;
  
  // Usage percentage
  getUsagePercentage: (type: 'assets' | 'licenses' | 'members') => number;
  
  // Refresh
  refreshSubscription: () => Promise<void>;
}

const SubscriptionContext = createContext<SubscriptionContextType | undefined>(undefined);

export const SubscriptionProvider = ({ children }: { children: React.ReactNode }) => {
  const { currentOrganization, loading: orgLoading } = useOrganization();
  const [subscription, setSubscription] = useState<OrganizationSubscription | null>(null);
  const [usage, setUsage] = useState<Usage>({ assets: 0, licenses: 0, members: 0 });
  const [loading, setLoading] = useState(true);

  const fetchSubscription = useCallback(async () => {
    if (!currentOrganization) {
      setSubscription(null);
      setUsage({ assets: 0, licenses: 0, members: 0 });
      setLoading(false);
      return;
    }

    setLoading(true);

    // Fetch subscription
    const { data: subData, error: subError } = await supabase
      .from("organization_subscriptions")
      .select("*")
      .eq("organization_id", currentOrganization.id)
      .single();

    if (subError) {
      console.error("Error fetching subscription:", subError);
      // If no subscription exists, treat as free plan
      setSubscription(null);
    } else {
      setSubscription(subData as OrganizationSubscription);
    }

    // Fetch usage counts in parallel
    const [assetsResult, licensesResult, membersResult] = await Promise.all([
      supabase
        .from("assets")
        .select("id", { count: "exact", head: true })
        .eq("organization_id", currentOrganization.id),
      supabase
        .from("licenses")
        .select("id", { count: "exact", head: true })
        .eq("organization_id", currentOrganization.id),
      supabase
        .from("organization_members")
        .select("id", { count: "exact", head: true })
        .eq("organization_id", currentOrganization.id),
    ]);

    setUsage({
      assets: assetsResult.count || 0,
      licenses: licensesResult.count || 0,
      members: membersResult.count || 0,
    });

    setLoading(false);
  }, [currentOrganization]);

  useEffect(() => {
    if (!orgLoading) {
      fetchSubscription();
    }
  }, [currentOrganization, orgLoading, fetchSubscription]);

  const plan: SubscriptionPlan = subscription?.plan || 'free';
  const status: SubscriptionStatus = subscription?.status || 'active';
  const limits = PLAN_LIMITS[plan];

  const canCreateAsset = () => {
    if (status !== 'active') return false;
    return usage.assets < limits.maxAssets;
  };

  const canCreateLicense = () => {
    if (status !== 'active') return false;
    return usage.licenses < limits.maxLicenses;
  };

  const canInviteMember = () => {
    if (status !== 'active') return false;
    return usage.members < limits.maxMembers;
  };

  const getRemainingAssets = () => Math.max(0, limits.maxAssets - usage.assets);
  const getRemainingLicenses = () => Math.max(0, limits.maxLicenses - usage.licenses);
  const getRemainingMembers = () => Math.max(0, limits.maxMembers - usage.members);

  const hasFeature = (feature: keyof PlanLimits['features']) => {
    if (status !== 'active') return false;
    return limits.features[feature];
  };

  const getUsagePercentage = (type: 'assets' | 'licenses' | 'members') => {
    const max = type === 'assets' ? limits.maxAssets 
              : type === 'licenses' ? limits.maxLicenses 
              : limits.maxMembers;
    
    if (max === Infinity) return 0;
    
    const current = usage[type];
    return Math.min(100, Math.round((current / max) * 100));
  };

  const refreshSubscription = async () => {
    await fetchSubscription();
  };

  return (
    <SubscriptionContext.Provider
      value={{
        subscription,
        plan,
        status,
        limits,
        usage,
        loading,
        canCreateAsset,
        canCreateLicense,
        canInviteMember,
        getRemainingAssets,
        getRemainingLicenses,
        getRemainingMembers,
        hasFeature,
        getUsagePercentage,
        refreshSubscription,
      }}
    >
      {children}
    </SubscriptionContext.Provider>
  );
};

export const useSubscription = () => {
  const context = useContext(SubscriptionContext);
  if (context === undefined) {
    throw new Error("useSubscription must be used within a SubscriptionProvider");
  }
  return context;
};
