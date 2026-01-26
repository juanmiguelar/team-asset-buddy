import { createContext, useContext, useEffect, useState, useCallback } from "react";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "./AuthContext";

type OrgRole = "owner" | "admin" | "member";

interface OrganizationSettings {
  allowSelfAssignment?: boolean;
  requireApprovalForCheckout?: boolean;
  defaultAssetLocation?: string | null;
  notificationEmail?: string | null;
  timezone?: string;
}

interface Organization {
  id: string;
  name: string;
  slug: string;
  settings: OrganizationSettings;
  created_at: string;
  updated_at: string;
}

interface OrganizationMember {
  id: string;
  organization_id: string;
  user_id: string;
  role: OrgRole;
  created_at: string;
}

interface OrganizationContextType {
  currentOrganization: Organization | null;
  membership: OrganizationMember | null;
  allMemberships: OrganizationMember[];
  orgRole: OrgRole | null;
  isOrgAdmin: boolean;
  isOrgOwner: boolean;
  loading: boolean;
  switchOrganization: (orgId: string) => Promise<void>;
  refreshOrganization: () => Promise<void>;
}

const OrganizationContext = createContext<OrganizationContextType | undefined>(undefined);

export const OrganizationProvider = ({ children }: { children: React.ReactNode }) => {
  const { user, loading: authLoading } = useAuth();
  const [currentOrganization, setCurrentOrganization] = useState<Organization | null>(null);
  const [membership, setMembership] = useState<OrganizationMember | null>(null);
  const [allMemberships, setAllMemberships] = useState<OrganizationMember[]>([]);
  const [loading, setLoading] = useState(true);

  const fetchMemberships = useCallback(async () => {
    if (!user) {
      setCurrentOrganization(null);
      setMembership(null);
      setAllMemberships([]);
      setLoading(false);
      return;
    }

    setLoading(true);

    // Fetch all user's memberships
    const { data: memberships, error: membershipsError } = await supabase
      .from("organization_members")
      .select("*")
      .eq("user_id", user.id)
      .order("created_at", { ascending: true });

    if (membershipsError) {
      console.error("Error fetching memberships:", membershipsError);
      setLoading(false);
      return;
    }

    setAllMemberships(memberships || []);

    if (!memberships || memberships.length === 0) {
      setCurrentOrganization(null);
      setMembership(null);
      setLoading(false);
      return;
    }

    // Use the first membership as default (oldest = primary org)
    const primaryMembership = memberships[0];
    setMembership(primaryMembership);

    // Fetch the organization details
    const { data: org, error: orgError } = await supabase
      .from("organizations")
      .select("*")
      .eq("id", primaryMembership.organization_id)
      .single();

    if (orgError) {
      console.error("Error fetching organization:", orgError);
      setLoading(false);
      return;
    }

    setCurrentOrganization({
      ...org,
      settings: (org.settings || {}) as OrganizationSettings,
    });
    setLoading(false);
  }, [user]);

  const switchOrganization = async (orgId: string) => {
    const targetMembership = allMemberships.find(m => m.organization_id === orgId);
    if (!targetMembership) {
      console.error("User is not a member of this organization");
      return;
    }

    setLoading(true);
    setMembership(targetMembership);

    const { data: org, error } = await supabase
      .from("organizations")
      .select("*")
      .eq("id", orgId)
      .single();

    if (error) {
      console.error("Error switching organization:", error);
      setLoading(false);
      return;
    }

    setCurrentOrganization({
      ...org,
      settings: (org.settings || {}) as OrganizationSettings,
    });
    setLoading(false);
  };

  const refreshOrganization = async () => {
    await fetchMemberships();
  };

  useEffect(() => {
    if (!authLoading) {
      fetchMemberships();
    }
  }, [user, authLoading, fetchMemberships]);

  const orgRole = membership?.role || null;
  const isOrgAdmin = orgRole === "admin" || orgRole === "owner";
  const isOrgOwner = orgRole === "owner";

  return (
    <OrganizationContext.Provider
      value={{
        currentOrganization,
        membership,
        allMemberships,
        orgRole,
        isOrgAdmin,
        isOrgOwner,
        loading,
        switchOrganization,
        refreshOrganization,
      }}
    >
      {children}
    </OrganizationContext.Provider>
  );
};

export const useOrganization = () => {
  const context = useContext(OrganizationContext);
  if (context === undefined) {
    throw new Error("useOrganization must be used within an OrganizationProvider");
  }
  return context;
};
