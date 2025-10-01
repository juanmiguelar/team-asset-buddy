import { useAuth } from "@/contexts/AuthContext";
import { useNavigate } from "react-router-dom";
import { useEffect, useState } from "react";
import { supabase } from "@/integrations/supabase/client";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Package, Key, QrCode, LogOut, Plus, BarChart3, Laptop, CheckCircle2 } from "lucide-react";
import { toast } from "sonner";

interface Asset {
  id: string;
  name: string;
  category: string;
  status: string;
  location: string;
  assignee_user_id: string | null;
}

interface License {
  id: string;
  product: string;
  status: string;
  expires_at: string | null;
  assignee_user_id: string | null;
}

const Dashboard = () => {
  const { user, profile, isAdmin, signOut, loading } = useAuth();
  const navigate = useNavigate();
  const [myAssets, setMyAssets] = useState<Asset[]>([]);
  const [myLicenses, setMyLicenses] = useState<License[]>([]);
  const [allAssets, setAllAssets] = useState<Asset[]>([]);
  const [allLicenses, setAllLicenses] = useState<License[]>([]);
  const [loadingData, setLoadingData] = useState(true);

  useEffect(() => {
    if (!loading && !user) {
      navigate("/auth");
    }
  }, [user, loading, navigate]);

  useEffect(() => {
    if (user) {
      fetchData();
    }
  }, [user]);

  const fetchData = async () => {
    setLoadingData(true);
    
    // Fetch my assets
    const { data: assets } = await supabase
      .from("assets")
      .select("*")
      .eq("assignee_user_id", user?.id);
    
    if (assets) setMyAssets(assets);

    // Fetch my licenses
    const { data: licenses } = await supabase
      .from("licenses")
      .select("*")
      .eq("assignee_user_id", user?.id);
    
    if (licenses) setMyLicenses(licenses);

    // For admin, fetch all items
    if (isAdmin) {
      const { data: allAssetsData } = await supabase
        .from("assets")
        .select("*")
        .order("created_at", { ascending: false });
      
      if (allAssetsData) setAllAssets(allAssetsData);

      const { data: allLicensesData } = await supabase
        .from("licenses")
        .select("*")
        .order("created_at", { ascending: false });
      
      if (allLicensesData) setAllLicenses(allLicensesData);
    }

    setLoadingData(false);
  };

  const handleSignOut = async () => {
    await signOut();
    toast.success("Sesión cerrada");
    navigate("/auth");
  };

  const handleScanQR = () => {
    navigate("/scan");
  };

  const getStatusColor = (status: string) => {
    switch (status) {
      case "available":
        return "bg-green-500/10 text-green-700 dark:text-green-400";
      case "assigned":
        return "bg-blue-500/10 text-blue-700 dark:text-blue-400";
      case "maintenance":
        return "bg-yellow-500/10 text-yellow-700 dark:text-yellow-400";
      case "retired":
        return "bg-gray-500/10 text-gray-700 dark:text-gray-400";
      case "expired":
        return "bg-red-500/10 text-red-700 dark:text-red-400";
      default:
        return "bg-gray-500/10 text-gray-700 dark:text-gray-400";
    }
  };

  const getCategoryIcon = (category: string) => {
    switch (category) {
      case "laptop":
        return <Laptop className="w-4 h-4" />;
      default:
        return <Package className="w-4 h-4" />;
    }
  };

  if (loading || loadingData) {
    return (
      <div className="min-h-screen flex items-center justify-center bg-background">
        <div className="text-center space-y-4">
          <div className="w-16 h-16 rounded-2xl gradient-primary flex items-center justify-center shadow-soft mx-auto animate-pulse">
            <Package className="w-8 h-8 text-white" />
          </div>
          <p className="text-muted-foreground">Cargando...</p>
        </div>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-background">
      {/* Header */}
      <header className="border-b bg-card/50 backdrop-blur-sm sticky top-0 z-50">
        <div className="container mx-auto px-4 py-4 flex items-center justify-between">
          <div className="flex items-center gap-3">
            <div className="w-10 h-10 rounded-xl gradient-primary flex items-center justify-center shadow-soft">
              <Package className="w-5 h-5 text-white" />
            </div>
            <div>
              <h1 className="font-bold text-lg">Gestor de Inventario</h1>
              <p className="text-xs text-muted-foreground">
                {profile?.name} {isAdmin && "· Admin"}
              </p>
            </div>
          </div>
          <Button variant="ghost" size="icon" onClick={handleSignOut}>
            <LogOut className="w-5 h-5" />
          </Button>
        </div>
      </header>

      <main className="container mx-auto px-4 py-6 pb-24">
        {/* Admin Dashboard */}
        {isAdmin && (
          <div className="space-y-6 mb-8">
            <div className="flex items-center justify-between">
              <h2 className="text-2xl font-bold">Panel de Administración</h2>
              <Button variant="hero" onClick={() => navigate("/admin/create-asset")}>
                <Plus className="w-4 h-4" />
                Nuevo Activo
              </Button>
            </div>

            {/* KPIs */}
            <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
              <Card className="shadow-soft">
                <CardContent className="pt-6">
                  <div className="text-2xl font-bold">{allAssets.length}</div>
                  <p className="text-xs text-muted-foreground">Total Activos</p>
                </CardContent>
              </Card>
              <Card className="shadow-soft">
                <CardContent className="pt-6">
                  <div className="text-2xl font-bold text-blue-600">
                    {allAssets.filter(a => a.status === "assigned").length}
                  </div>
                  <p className="text-xs text-muted-foreground">Asignados</p>
                </CardContent>
              </Card>
              <Card className="shadow-soft">
                <CardContent className="pt-6">
                  <div className="text-2xl font-bold text-green-600">
                    {allAssets.filter(a => a.status === "available").length}
                  </div>
                  <p className="text-xs text-muted-foreground">Disponibles</p>
                </CardContent>
              </Card>
              <Card className="shadow-soft">
                <CardContent className="pt-6">
                  <div className="text-2xl font-bold">{allLicenses.length}</div>
                  <p className="text-xs text-muted-foreground">Licencias</p>
                </CardContent>
              </Card>
            </div>

            {/* Recent Assets */}
            <Card className="shadow-soft">
              <CardHeader>
                <CardTitle>Activos Recientes</CardTitle>
                <CardDescription>Últimos activos registrados</CardDescription>
              </CardHeader>
              <CardContent>
                <div className="space-y-3">
                  {allAssets.slice(0, 5).map((asset) => (
                    <div
                      key={asset.id}
                      className="flex items-center justify-between p-3 rounded-lg hover:bg-muted/50 transition-smooth cursor-pointer"
                      onClick={() => navigate(`/asset/${asset.id}`)}
                    >
                      <div className="flex items-center gap-3">
                        {getCategoryIcon(asset.category)}
                        <div>
                          <p className="font-medium">{asset.name}</p>
                          <p className="text-xs text-muted-foreground">{asset.location}</p>
                        </div>
                      </div>
                      <Badge className={getStatusColor(asset.status)}>
                        {asset.status}
                      </Badge>
                    </div>
                  ))}
                </div>
              </CardContent>
            </Card>
          </div>
        )}

        {/* Employee Dashboard */}
        <div className="space-y-6">
          {/* Scan CTA */}
          <Card className="gradient-hero text-white shadow-elevated">
            <CardContent className="pt-8 pb-8 text-center">
              <QrCode className="w-16 h-16 mx-auto mb-4 opacity-90" />
              <h2 className="text-2xl font-bold mb-2">Escanear Código QR</h2>
              <p className="mb-6 opacity-90">
                Asigna o devuelve activos y licencias
              </p>
              <Button variant="scan" size="lg" onClick={handleScanQR} className="bg-white/20 hover:bg-white/30 backdrop-blur-sm">
                <QrCode className="w-6 h-6" />
                Abrir Escáner
              </Button>
            </CardContent>
          </Card>

          {/* My Assets */}
          <Card className="shadow-soft">
            <CardHeader>
              <CardTitle className="flex items-center gap-2">
                <Package className="w-5 h-5 text-primary" />
                Mis Activos
              </CardTitle>
              <CardDescription>
                {myAssets.length} {myAssets.length === 1 ? "activo asignado" : "activos asignados"}
              </CardDescription>
            </CardHeader>
            <CardContent>
              {myAssets.length === 0 ? (
                <p className="text-center text-muted-foreground py-8">
                  No tienes activos asignados
                </p>
              ) : (
                <div className="space-y-3">
                  {myAssets.map((asset) => (
                    <div
                      key={asset.id}
                      className="flex items-center justify-between p-4 rounded-lg border hover:border-primary/50 transition-smooth cursor-pointer"
                      onClick={() => navigate(`/asset/${asset.id}`)}
                    >
                      <div className="flex items-center gap-3">
                        {getCategoryIcon(asset.category)}
                        <div>
                          <p className="font-medium">{asset.name}</p>
                          <p className="text-xs text-muted-foreground capitalize">{asset.category}</p>
                        </div>
                      </div>
                      <Button variant="outline" size="sm">
                        Ver detalles
                      </Button>
                    </div>
                  ))}
                </div>
              )}
            </CardContent>
          </Card>

          {/* My Licenses */}
          <Card className="shadow-soft">
            <CardHeader>
              <CardTitle className="flex items-center gap-2">
                <Key className="w-5 h-5 text-secondary" />
                Mis Licencias
              </CardTitle>
              <CardDescription>
                {myLicenses.length} {myLicenses.length === 1 ? "licencia asignada" : "licencias asignadas"}
              </CardDescription>
            </CardHeader>
            <CardContent>
              {myLicenses.length === 0 ? (
                <p className="text-center text-muted-foreground py-8">
                  No tienes licencias asignadas
                </p>
              ) : (
                <div className="space-y-3">
                  {myLicenses.map((license) => (
                    <div
                      key={license.id}
                      className="flex items-center justify-between p-4 rounded-lg border hover:border-secondary/50 transition-smooth cursor-pointer"
                      onClick={() => navigate(`/license/${license.id}`)}
                    >
                      <div className="flex items-center gap-3">
                        <Key className="w-4 h-4" />
                        <div>
                          <p className="font-medium capitalize">{license.product.replace(/_/g, " ")}</p>
                          {license.expires_at && (
                            <p className="text-xs text-muted-foreground">
                              Expira: {new Date(license.expires_at).toLocaleDateString()}
                            </p>
                          )}
                        </div>
                      </div>
                      <Button variant="outline" size="sm">
                        Ver detalles
                      </Button>
                    </div>
                  ))}
                </div>
              )}
            </CardContent>
          </Card>
        </div>
      </main>

      {/* Mobile Bottom Nav */}
      <nav className="fixed bottom-0 left-0 right-0 bg-card/80 backdrop-blur-lg border-t md:hidden">
        <div className="grid grid-cols-3 gap-1 p-2">
          <Button variant="ghost" className="flex-col h-auto py-3" onClick={() => navigate("/")}>
            <Package className="w-5 h-5 mb-1" />
            <span className="text-xs">Inicio</span>
          </Button>
          <Button variant="ghost" className="flex-col h-auto py-3" onClick={handleScanQR}>
            <QrCode className="w-5 h-5 mb-1" />
            <span className="text-xs">Escanear</span>
          </Button>
          {isAdmin && (
            <Button variant="ghost" className="flex-col h-auto py-3" onClick={() => navigate("/admin")}>
              <BarChart3 className="w-5 h-5 mb-1" />
              <span className="text-xs">Admin</span>
            </Button>
          )}
        </div>
      </nav>
    </div>
  );
};

export default Dashboard;
