import { useEffect, useState, useMemo } from "react";
import { useNavigate } from "react-router-dom";
import { useAuth } from "@/contexts/AuthContext";
import { useOrganization } from "@/contexts/OrganizationContext";
import { useSubscription } from "@/contexts/SubscriptionContext";
import { supabase } from "@/integrations/supabase/client";
import { Button } from "@/components/ui/button";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { UpgradePromptCard } from "@/components/UpgradePrompt";
import { AssetUtilizationCharts } from "@/components/reports/AssetUtilizationCharts";
import { LicenseExpirationCalendar } from "@/components/reports/LicenseExpirationCalendar";
import { AuditLogViewer } from "@/components/reports/AuditLogViewer";
import { ArrowLeft, BarChart3, Calendar, FileText, Package } from "lucide-react";

const STATUS_COLORS: Record<string, string> = {
  available: "hsl(142, 76%, 36%)",
  assigned: "hsl(221, 83%, 53%)",
  maintenance: "hsl(45, 93%, 47%)",
  retired: "hsl(220, 9%, 46%)",
  expired: "hsl(0, 84%, 60%)",
};

const Reports = () => {
  const { user, loading: authLoading } = useAuth();
  const { currentOrganization, isOrgAdmin, loading: orgLoading } = useOrganization();
  const { hasFeature, loading: subLoading } = useSubscription();
  const navigate = useNavigate();

  const [assets, setAssets] = useState<{ status: string; category: string }[]>([]);
  const [licenses, setLicenses] = useState<{ id: string; product: string; status: string; expires_at: string | null }[]>([]);
  const [loadingData, setLoadingData] = useState(true);

  useEffect(() => {
    if (!authLoading && !user) {
      navigate("/auth");
    }
  }, [user, authLoading, navigate]);

  useEffect(() => {
    if (!orgLoading && !isOrgAdmin) {
      navigate("/");
    }
  }, [isOrgAdmin, orgLoading, navigate]);

  useEffect(() => {
    if (currentOrganization && isOrgAdmin) {
      fetchData();
    }
  }, [currentOrganization, isOrgAdmin]);

  const fetchData = async () => {
    if (!currentOrganization) return;
    setLoadingData(true);

    const [assetsResult, licensesResult] = await Promise.all([
      supabase
        .from("assets")
        .select("status, category")
        .eq("organization_id", currentOrganization.id),
      supabase
        .from("licenses")
        .select("id, product, status, expires_at")
        .eq("organization_id", currentOrganization.id),
    ]);

    if (assetsResult.data) setAssets(assetsResult.data);
    if (licensesResult.data) setLicenses(licensesResult.data);

    setLoadingData(false);
  };

  // Process data for charts
  const assetsByStatus = useMemo(() => {
    const counts: Record<string, number> = {};
    assets.forEach((a) => {
      counts[a.status] = (counts[a.status] || 0) + 1;
    });
    return Object.entries(counts).map(([name, value]) => ({
      name,
      value,
      color: STATUS_COLORS[name] || STATUS_COLORS.retired,
    }));
  }, [assets]);

  const assetsByCategory = useMemo(() => {
    const counts: Record<string, number> = {};
    assets.forEach((a) => {
      counts[a.category] = (counts[a.category] || 0) + 1;
    });
    return Object.entries(counts).map(([category, count]) => ({ category, count }));
  }, [assets]);

  const licensesByStatus = useMemo(() => {
    const counts: Record<string, number> = {};
    licenses.forEach((l) => {
      counts[l.status] = (counts[l.status] || 0) + 1;
    });
    return Object.entries(counts).map(([name, value]) => ({
      name,
      value,
      color: STATUS_COLORS[name] || STATUS_COLORS.retired,
    }));
  }, [licenses]);

  const licensesByProduct = useMemo(() => {
    const counts: Record<string, number> = {};
    licenses.forEach((l) => {
      counts[l.product] = (counts[l.product] || 0) + 1;
    });
    return Object.entries(counts).map(([product, count]) => ({ product, count }));
  }, [licenses]);

  const licensesWithExpiry = useMemo(() => {
    return licenses
      .filter((l) => l.expires_at !== null)
      .map((l) => ({
        id: l.id,
        product: l.product,
        expires_at: l.expires_at!,
        status: l.status,
      }));
  }, [licenses]);

  const isLoading = authLoading || orgLoading || subLoading;

  if (isLoading) {
    return (
      <div className="min-h-screen flex items-center justify-center bg-background">
        <div className="text-center space-y-4">
          <div className="w-16 h-16 rounded-2xl bg-primary flex items-center justify-center shadow-soft mx-auto animate-pulse">
            <Package className="w-8 h-8 text-primary-foreground" />
          </div>
          <p className="text-muted-foreground">Cargando...</p>
        </div>
      </div>
    );
  }

  // Feature gate
  if (!hasFeature("auditLog")) {
    return (
      <div className="min-h-screen bg-background">
        <header className="border-b bg-card/50 backdrop-blur-sm sticky top-0 z-50">
          <div className="container mx-auto px-4 py-4 flex items-center gap-4">
            <Button variant="ghost" size="icon" onClick={() => navigate("/")}>
              <ArrowLeft className="w-5 h-5" />
            </Button>
            <h1 className="font-bold text-lg">Reportes</h1>
          </div>
        </header>
        <main className="container mx-auto px-4 py-8">
          <UpgradePromptCard limitType="feature" featureName="Reportes y Auditoría" />
        </main>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-background">
      {/* Header */}
      <header className="border-b bg-card/50 backdrop-blur-sm sticky top-0 z-50">
        <div className="container mx-auto px-4 py-4 flex items-center gap-4">
          <Button variant="ghost" size="icon" onClick={() => navigate("/")}>
            <ArrowLeft className="w-5 h-5" />
          </Button>
          <div>
            <h1 className="font-bold text-lg">Reportes y Auditoría</h1>
            <p className="text-xs text-muted-foreground">
              Visualiza estadísticas y registros de actividad
            </p>
          </div>
        </div>
      </header>

      <main className="container mx-auto px-4 py-6">
        <Tabs defaultValue="overview" className="space-y-6">
          <TabsList className="grid w-full max-w-md grid-cols-3">
            <TabsTrigger value="overview" className="gap-2">
              <BarChart3 className="w-4 h-4" />
              <span className="hidden sm:inline">Resumen</span>
            </TabsTrigger>
            <TabsTrigger value="calendar" className="gap-2">
              <Calendar className="w-4 h-4" />
              <span className="hidden sm:inline">Calendario</span>
            </TabsTrigger>
            <TabsTrigger value="audit" className="gap-2">
              <FileText className="w-4 h-4" />
              <span className="hidden sm:inline">Auditoría</span>
            </TabsTrigger>
          </TabsList>

          <TabsContent value="overview">
            <AssetUtilizationCharts
              assetsByStatus={assetsByStatus}
              assetsByCategory={assetsByCategory}
              licensesByStatus={licensesByStatus}
              licensesByProduct={licensesByProduct}
              loading={loadingData}
            />
          </TabsContent>

          <TabsContent value="calendar">
            <LicenseExpirationCalendar
              licenses={licensesWithExpiry}
              loading={loadingData}
              onLicenseClick={(id) => navigate(`/license/${id}`)}
            />
          </TabsContent>

          <TabsContent value="audit">
            <AuditLogViewer />
          </TabsContent>
        </Tabs>
      </main>
    </div>
  );
};

export default Reports;
