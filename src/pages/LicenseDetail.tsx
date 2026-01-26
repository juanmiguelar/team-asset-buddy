import { useEffect, useState } from "react";
import { useParams, useNavigate } from "react-router-dom";
import { useAuth } from "@/contexts/AuthContext";
import { supabase } from "@/integrations/supabase/client";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import {
  AlertDialog,
  AlertDialogAction,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
  AlertDialogTrigger,
} from "@/components/ui/alert-dialog";
import { ArrowLeft, Key, Loader2, User, Calendar, CheckCircle2, Copy, Eye, EyeOff, ShieldAlert } from "lucide-react";
import { toast } from "sonner";

interface License {
  id: string;
  product: string;
  status: string;
  seat_key_masked: string | null;
  assignee_user_id: string | null;
  expires_at: string | null;
  notes: string | null;
  qr_code: string;
  created_at: string;
  updated_at: string;
}

interface Profile {
  id: string;
  name: string;
  email: string;
}

const productLabels: Record<string, string> = {
  adobe_cc: "Adobe Creative Cloud",
  jetbrains: "JetBrains",
  office_365: "Office 365",
  github: "GitHub",
  other: "Otro",
};

const LicenseDetail = () => {
  const { id } = useParams();
  const navigate = useNavigate();
  const { user, isAdmin } = useAuth();
  const [license, setLicense] = useState<License | null>(null);
  const [assignee, setAssignee] = useState<Profile | null>(null);
  const [loading, setLoading] = useState(true);
  const [actionLoading, setActionLoading] = useState(false);
  const [revealedKey, setRevealedKey] = useState<string | null>(null);
  const [revealLoading, setRevealLoading] = useState(false);

  useEffect(() => {
    if (!user) {
      navigate("/auth");
      return;
    }
    fetchLicense();
  }, [id, user]);

  // Auto-hide revealed key after 30 seconds
  useEffect(() => {
    if (revealedKey) {
      const timer = setTimeout(() => {
        setRevealedKey(null);
        toast.info("La clave se ha ocultado por seguridad");
      }, 30000);
      return () => clearTimeout(timer);
    }
  }, [revealedKey]);

  const fetchLicense = async () => {
    setLoading(true);
    
    // Use licenses_safe view for employees, licenses table for admins
    let data = null;
    let error = null;

    if (isAdmin) {
      const result = await supabase
        .from("licenses")
        .select("id, product, status, seat_key_masked, assignee_user_id, expires_at, notes, qr_code, created_at, updated_at")
        .eq("id", id!)
        .maybeSingle();
      data = result.data;
      error = result.error;
    } else {
      const result = await supabase
        .from("licenses_safe")
        .select("id, product, status, seat_key_masked, assignee_user_id, expires_at, notes, qr_code, created_at, updated_at")
        .eq("id", id!)
        .maybeSingle();
      data = result.data;
      error = result.error;
    }

    if (error) {
      toast.error("Error al cargar la licencia");
      navigate("/");
      return;
    }

    if (data) {
      setLicense(data as License);
      if (data.assignee_user_id) {
        fetchAssignee(data.assignee_user_id);
      }
    } else {
      toast.error("Licencia no encontrada");
      navigate("/");
    }

    setLoading(false);
  };

  const fetchAssignee = async (userId: string) => {
    const { data } = await supabase
      .from("profiles")
      .select("*")
      .eq("id", userId)
      .maybeSingle();

    if (data) {
      setAssignee(data as Profile);
    }
  };

  const handleRevealKey = async () => {
    if (!license || !isAdmin) return;

    setRevealLoading(true);
    const { data, error } = await supabase.rpc("get_license_full_key", {
      _license_id: license.id,
    });

    if (error) {
      toast.error("Error al obtener la clave");
      setRevealLoading(false);
      return;
    }

    setRevealedKey(data);
    setRevealLoading(false);
    toast.success("Clave revelada (se ocultará en 30 segundos)");
  };

  const handleCopyKey = async (key: string) => {
    await navigator.clipboard.writeText(key);
    toast.success("Clave copiada al portapapeles");
  };

  const isExpired = license?.expires_at && new Date(license.expires_at) < new Date();

  const handleCheckOut = async () => {
    if (!license || !user) return;

    if (isExpired) {
      toast.error("No se puede asignar una licencia expirada");
      return;
    }

    setActionLoading(true);

    const { error: updateError } = await supabase
      .from("licenses")
      .update({
        status: "assigned",
        assignee_user_id: user.id,
        updated_at: new Date().toISOString(),
      })
      .eq("id", license.id);

    if (updateError) {
      toast.error("Error al asignar licencia");
      setActionLoading(false);
      return;
    }

    await supabase.from("audit_log").insert({
      resource_type: "license",
      resource_id: license.id,
      action: "check_out",
      by_user_id: user.id,
      to_user_id: user.id,
      metadata: {
        old_status: license.status,
        new_status: "assigned",
        product: license.product,
      },
    });

    toast.success("Licencia asignada exitosamente");
    setActionLoading(false);
    fetchLicense();
  };

  const handleCheckIn = async () => {
    if (!license || !user) return;

    setActionLoading(true);

    const { error: updateError } = await supabase
      .from("licenses")
      .update({
        status: "available",
        assignee_user_id: null,
        updated_at: new Date().toISOString(),
      })
      .eq("id", license.id);

    if (updateError) {
      toast.error("Error al devolver licencia");
      setActionLoading(false);
      return;
    }

    await supabase.from("audit_log").insert({
      resource_type: "license",
      resource_id: license.id,
      action: "check_in",
      by_user_id: user.id,
      metadata: {
        old_status: license.status,
        new_status: "available",
        product: license.product,
      },
    });

    toast.success("Licencia devuelta exitosamente");
    setActionLoading(false);
    navigate("/");
  };

  const getStatusColor = (status: string) => {
    switch (status) {
      case "available":
        return "bg-green-500/10 text-green-700 dark:text-green-400";
      case "assigned":
        return "bg-blue-500/10 text-blue-700 dark:text-blue-400";
      case "expired":
        return "bg-red-500/10 text-red-700 dark:text-red-400";
      default:
        return "bg-gray-500/10 text-gray-700 dark:text-gray-400";
    }
  };

  const getStatusText = (status: string) => {
    const statusMap: Record<string, string> = {
      available: "Disponible",
      assigned: "Asignada",
      expired: "Expirada",
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

  if (!license) return null;

  const canCheckOut = license.status === "available" && !license.assignee_user_id && !isExpired;
  const canCheckIn = license.assignee_user_id === user?.id;

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
              <div className="w-14 h-14 rounded-xl bg-primary flex items-center justify-center shadow-soft">
                <Key className="w-7 h-7 text-primary-foreground" />
              </div>
              <div className="flex gap-2">
                {isExpired && (
                  <Badge className="bg-red-500/10 text-red-700 dark:text-red-400">
                    Expirada
                  </Badge>
                )}
                <Badge className={getStatusColor(license.status)}>
                  {getStatusText(license.status)}
                </Badge>
              </div>
            </div>
            <CardTitle className="text-2xl">
              {productLabels[license.product] || license.product}
            </CardTitle>
            <CardDescription>Licencia de software</CardDescription>
          </CardHeader>

          <CardContent className="space-y-6">
            {/* License Key (Masked) */}
            <div className="flex items-center gap-3 p-3 bg-muted/50 rounded-lg">
              <Key className="w-4 h-4 text-muted-foreground" />
              <div className="flex-1">
                <p className="text-xs text-muted-foreground">Clave de licencia</p>
                <p className="font-mono font-medium">
                  {license.seat_key_masked || "Sin clave"}
                </p>
              </div>
              {license.seat_key_masked && (
                <Button
                  variant="ghost"
                  size="icon"
                  onClick={() => handleCopyKey(license.seat_key_masked!)}
                >
                  <Copy className="w-4 h-4" />
                </Button>
              )}
            </div>

            {/* Expiration Date */}
            {license.expires_at && (
              <div className="flex items-center gap-3 p-3 bg-muted/50 rounded-lg">
                <Calendar className="w-4 h-4 text-muted-foreground" />
                <div>
                  <p className="text-xs text-muted-foreground">Fecha de expiración</p>
                  <p className={`font-medium ${isExpired ? "text-red-600 dark:text-red-400" : ""}`}>
                    {new Date(license.expires_at).toLocaleDateString("es-ES", {
                      year: "numeric",
                      month: "long",
                      day: "numeric",
                    })}
                    {isExpired && " (Expirada)"}
                  </p>
                </div>
              </div>
            )}

            {/* Assignee */}
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

            {/* Created Date */}
            <div className="flex items-center gap-3 p-3 bg-muted/50 rounded-lg">
              <Calendar className="w-4 h-4 text-muted-foreground" />
              <div>
                <p className="text-xs text-muted-foreground">Creada</p>
                <p className="font-medium">
                  {new Date(license.created_at).toLocaleDateString("es-ES", {
                    year: "numeric",
                    month: "long",
                    day: "numeric",
                  })}
                </p>
              </div>
            </div>

            {/* Notes */}
            {license.notes && (
              <div className="p-4 bg-muted/30 rounded-lg">
                <p className="text-sm font-medium mb-2">Notas</p>
                <p className="text-sm text-muted-foreground">{license.notes}</p>
              </div>
            )}

            {/* Admin Section - Reveal Full Key */}
            {isAdmin && (
              <div className="p-4 border-2 border-dashed border-primary/30 rounded-lg bg-primary/5">
                <div className="flex items-center gap-2 mb-3">
                  <ShieldAlert className="w-5 h-5 text-primary" />
                  <p className="font-semibold text-primary">Sección de Administrador</p>
                </div>

                {revealedKey ? (
                  <div className="space-y-3">
                    <div className="flex items-center gap-2 p-3 bg-background rounded-lg border">
                      <div className="flex-1">
                        <p className="text-xs text-muted-foreground mb-1">Clave completa</p>
                        <p className="font-mono font-bold text-sm break-all">{revealedKey}</p>
                      </div>
                      <Button
                        variant="outline"
                        size="icon"
                        onClick={() => handleCopyKey(revealedKey)}
                      >
                        <Copy className="w-4 h-4" />
                      </Button>
                    </div>
                    <Button
                      variant="ghost"
                      size="sm"
                      onClick={() => setRevealedKey(null)}
                      className="w-full"
                    >
                      <EyeOff className="w-4 h-4 mr-2" />
                      Ocultar clave
                    </Button>
                  </div>
                ) : (
                  <AlertDialog>
                    <AlertDialogTrigger asChild>
                      <Button
                        variant="outline"
                        className="w-full"
                        disabled={revealLoading}
                      >
                        {revealLoading ? (
                          <>
                            <Loader2 className="w-4 h-4 animate-spin mr-2" />
                            Cargando...
                          </>
                        ) : (
                          <>
                            <Eye className="w-4 h-4 mr-2" />
                            Revelar clave completa
                          </>
                        )}
                      </Button>
                    </AlertDialogTrigger>
                    <AlertDialogContent>
                      <AlertDialogHeader>
                        <AlertDialogTitle>¿Revelar clave de licencia?</AlertDialogTitle>
                        <AlertDialogDescription>
                          Estás a punto de ver la clave completa de esta licencia. 
                          Esta acción es sensible y la clave se ocultará automáticamente 
                          después de 30 segundos por seguridad.
                        </AlertDialogDescription>
                      </AlertDialogHeader>
                      <AlertDialogFooter>
                        <AlertDialogCancel>Cancelar</AlertDialogCancel>
                        <AlertDialogAction onClick={handleRevealKey}>
                          Revelar clave
                        </AlertDialogAction>
                      </AlertDialogFooter>
                    </AlertDialogContent>
                  </AlertDialog>
                )}
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
                      Asignarme esta licencia
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
                      Devolver licencia
                    </>
                  )}
                </Button>
              )}

              {!canCheckOut && !canCheckIn && assignee && (
                <div className="text-center p-4 bg-yellow-500/10 rounded-lg">
                  <p className="text-sm text-yellow-700 dark:text-yellow-400">
                    Esta licencia está asignada a {assignee.name}
                  </p>
                </div>
              )}

              {isExpired && license.status === "available" && (
                <div className="text-center p-4 bg-red-500/10 rounded-lg">
                  <p className="text-sm text-red-700 dark:text-red-400">
                    Esta licencia ha expirado y no puede ser asignada
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

export default LicenseDetail;
