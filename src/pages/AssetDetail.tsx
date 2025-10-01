import { useEffect, useState } from "react";
import { useParams, useNavigate } from "react-router-dom";
import { useAuth } from "@/contexts/AuthContext";
import { supabase } from "@/integrations/supabase/client";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { ArrowLeft, Package, Loader2, User, MapPin, Calendar, CheckCircle2 } from "lucide-react";
import { toast } from "sonner";

interface Asset {
  id: string;
  name: string;
  category: string;
  serial_number: string | null;
  status: string;
  assignee_user_id: string | null;
  location: string | null;
  notes: string | null;
  created_at: string;
  updated_at: string;
}

interface Profile {
  id: string;
  name: string;
  email: string;
}

const AssetDetail = () => {
  const { id } = useParams();
  const navigate = useNavigate();
  const { user, isAdmin } = useAuth();
  const [asset, setAsset] = useState<Asset | null>(null);
  const [assignee, setAssignee] = useState<Profile | null>(null);
  const [loading, setLoading] = useState(true);
  const [actionLoading, setActionLoading] = useState(false);

  useEffect(() => {
    if (!user) {
      navigate("/auth");
      return;
    }
    fetchAsset();
  }, [id, user]);

  const fetchAsset = async () => {
    setLoading(true);
    const { data, error } = await supabase
      .from("assets")
      .select("*")
      .eq("id", id)
      .maybeSingle();

    if (error) {
      toast.error("Error al cargar el activo");
      navigate("/");
      return;
    }

    if (data) {
      setAsset(data as Asset);
      if (data.assignee_user_id) {
        fetchAssignee(data.assignee_user_id);
      }
    } else {
      toast.error("Activo no encontrado");
      navigate("/");
    }

    setLoading(false);
  };

  const fetchAssignee = async (userId: string) => {
    const { data } = await supabase
      .from("profiles")
      .select("*")
      .eq("id", userId)
      .single();

    if (data) {
      setAssignee(data as Profile);
    }
  };

  const handleCheckOut = async () => {
    if (!asset || !user) return;

    setActionLoading(true);

    // Update asset
    const { error: updateError } = await supabase
      .from("assets")
      .update({
        status: "assigned",
        assignee_user_id: user.id,
        updated_at: new Date().toISOString(),
      })
      .eq("id", asset.id);

    if (updateError) {
      toast.error("Error al asignar activo");
      setActionLoading(false);
      return;
    }

    // Create audit log
    await supabase.from("audit_log").insert({
      resource_type: "asset",
      resource_id: asset.id,
      action: "check_out",
      by_user_id: user.id,
      to_user_id: user.id,
      metadata: {
        old_status: asset.status,
        new_status: "assigned",
      },
    });

    toast.success("Activo asignado exitosamente");
    setActionLoading(false);
    fetchAsset();
  };

  const handleCheckIn = async () => {
    if (!asset || !user) return;

    setActionLoading(true);

    // Update asset
    const { error: updateError } = await supabase
      .from("assets")
      .update({
        status: "available",
        assignee_user_id: null,
        updated_at: new Date().toISOString(),
      })
      .eq("id", asset.id);

    if (updateError) {
      toast.error("Error al devolver activo");
      setActionLoading(false);
      return;
    }

    // Create audit log
    await supabase.from("audit_log").insert({
      resource_type: "asset",
      resource_id: asset.id,
      action: "check_in",
      by_user_id: user.id,
      metadata: {
        old_status: asset.status,
        new_status: "available",
      },
    });

    toast.success("Activo devuelto exitosamente");
    setActionLoading(false);
    navigate("/");
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
      default:
        return "bg-gray-500/10 text-gray-700 dark:text-gray-400";
    }
  };

  const getStatusText = (status: string) => {
    const statusMap: Record<string, string> = {
      available: "Disponible",
      assigned: "Asignado",
      maintenance: "Mantenimiento",
      retired: "Retirado",
    };
    return statusMap[status] || status;
  };

  if (loading) {
    return (
      <div className="min-h-screen flex items-center justify-center bg-background">
        <Loader2 className="w-8 h-8 animate-spin text-primary" />
      </div>
    );
  }

  if (!asset) return null;

  const canCheckOut = asset.status === "available" && !asset.assignee_user_id;
  const canCheckIn = asset.assignee_user_id === user?.id;

  return (
    <div className="min-h-screen bg-background">
      <header className="border-b bg-card/50 backdrop-blur-sm sticky top-0 z-50">
        <div className="container mx-auto px-4 py-4">
          <Button variant="ghost" size="sm" onClick={() => navigate("/")}>
            <ArrowLeft className="w-4 h-4 mr-2" />
            Volver
          </Button>
        </div>
      </header>

      <main className="container mx-auto px-4 py-6 pb-24">
        <Card className="max-w-2xl mx-auto shadow-elevated">
          <CardHeader>
            <div className="flex items-start justify-between mb-2">
              <div className="w-14 h-14 rounded-xl gradient-primary flex items-center justify-center shadow-soft">
                <Package className="w-7 h-7 text-white" />
              </div>
              <Badge className={getStatusColor(asset.status)}>
                {getStatusText(asset.status)}
              </Badge>
            </div>
            <CardTitle className="text-2xl">{asset.name}</CardTitle>
            <CardDescription className="capitalize">
              {asset.category.replace(/_/g, " ")}
            </CardDescription>
          </CardHeader>

          <CardContent className="space-y-6">
            {/* Details */}
            <div className="space-y-3">
              {asset.serial_number && (
                <div className="flex items-center gap-3 p-3 bg-muted/50 rounded-lg">
                  <Package className="w-4 h-4 text-muted-foreground" />
                  <div>
                    <p className="text-xs text-muted-foreground">Número de Serie</p>
                    <p className="font-medium">{asset.serial_number}</p>
                  </div>
                </div>
              )}

              {asset.location && (
                <div className="flex items-center gap-3 p-3 bg-muted/50 rounded-lg">
                  <MapPin className="w-4 h-4 text-muted-foreground" />
                  <div>
                    <p className="text-xs text-muted-foreground">Ubicación</p>
                    <p className="font-medium">{asset.location}</p>
                  </div>
                </div>
              )}

              {assignee && (
                <div className="flex items-center gap-3 p-3 bg-muted/50 rounded-lg">
                  <User className="w-4 h-4 text-muted-foreground" />
                  <div>
                    <p className="text-xs text-muted-foreground">Asignado a</p>
                    <p className="font-medium">{assignee.name}</p>
                    <p className="text-xs text-muted-foreground">{assignee.email}</p>
                  </div>
                </div>
              )}

              <div className="flex items-center gap-3 p-3 bg-muted/50 rounded-lg">
                <Calendar className="w-4 h-4 text-muted-foreground" />
                <div>
                  <p className="text-xs text-muted-foreground">Creado</p>
                  <p className="font-medium">
                    {new Date(asset.created_at).toLocaleDateString("es-ES", {
                      year: "numeric",
                      month: "long",
                      day: "numeric",
                    })}
                  </p>
                </div>
              </div>
            </div>

            {asset.notes && (
              <div className="p-4 bg-muted/30 rounded-lg">
                <p className="text-sm font-medium mb-2">Notas</p>
                <p className="text-sm text-muted-foreground">{asset.notes}</p>
              </div>
            )}

            {/* Actions */}
            <div className="space-y-3 pt-4">
              {canCheckOut && (
                <Button
                  variant="hero"
                  className="w-full"
                  onClick={handleCheckOut}
                  disabled={actionLoading}
                >
                  {actionLoading ? (
                    <>
                      <Loader2 className="w-4 h-4 animate-spin" />
                      Asignando...
                    </>
                  ) : (
                    <>
                      <CheckCircle2 className="w-4 h-4" />
                      Asignarme este activo
                    </>
                  )}
                </Button>
              )}

              {canCheckIn && (
                <Button
                  variant="secondary"
                  className="w-full"
                  onClick={handleCheckIn}
                  disabled={actionLoading}
                >
                  {actionLoading ? (
                    <>
                      <Loader2 className="w-4 h-4 animate-spin" />
                      Devolviendo...
                    </>
                  ) : (
                    <>
                      <CheckCircle2 className="w-4 h-4" />
                      Devolver activo
                    </>
                  )}
                </Button>
              )}

              {!canCheckOut && !canCheckIn && assignee && (
                <div className="text-center p-4 bg-yellow-500/10 rounded-lg">
                  <p className="text-sm text-yellow-700 dark:text-yellow-400">
                    Este activo está asignado a {assignee.name}
                  </p>
                </div>
              )}
            </div>
          </CardContent>
        </Card>
      </main>
    </div>
  );
};

export default AssetDetail;
