import { useState, useEffect } from "react";
import { useNavigate } from "react-router-dom";
import { useAuth } from "@/contexts/AuthContext";
import { useOrganization } from "@/contexts/OrganizationContext";
import { supabase } from "@/integrations/supabase/client";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Switch } from "@/components/ui/switch";
import { Separator } from "@/components/ui/separator";
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
import { ArrowLeft, Building2, Loader2, Save, Trash2, Crown } from "lucide-react";
import { toast } from "sonner";
import { useSubscription } from "@/contexts/SubscriptionContext";
import { PlanBadge } from "@/components/PlanBadge";

const OrganizationSettings = () => {
  const navigate = useNavigate();
  const { user, loading: authLoading } = useAuth();
  const { currentOrganization, isOrgOwner, isOrgAdmin, loading: orgLoading, refreshOrganization } = useOrganization();
  const { plan } = useSubscription();
  
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [name, setName] = useState("");
  const [settings, setSettings] = useState({
    allowSelfAssignment: true,
    requireApprovalForCheckout: false,
    defaultAssetLocation: "",
    notificationEmail: "",
    timezone: "America/Costa_Rica",
  });

  useEffect(() => {
    if (!authLoading && !user) {
      navigate("/auth");
      return;
    }
    
    if (!orgLoading && !isOrgAdmin) {
      navigate("/");
      toast.error("No tienes permisos para acceder a esta página");
    }
  }, [user, authLoading, isOrgAdmin, orgLoading, navigate]);

  useEffect(() => {
    if (currentOrganization) {
      setName(currentOrganization.name);
      setSettings({
        allowSelfAssignment: currentOrganization.settings?.allowSelfAssignment ?? true,
        requireApprovalForCheckout: currentOrganization.settings?.requireApprovalForCheckout ?? false,
        defaultAssetLocation: currentOrganization.settings?.defaultAssetLocation || "",
        notificationEmail: currentOrganization.settings?.notificationEmail || "",
        timezone: currentOrganization.settings?.timezone || "America/Costa_Rica",
      });
    }
  }, [currentOrganization]);

  const handleSave = async () => {
    if (!currentOrganization || !name.trim()) {
      toast.error("El nombre es requerido");
      return;
    }

    setIsSubmitting(true);

    const { error } = await supabase
      .from("organizations")
      .update({
        name: name.trim(),
        settings: {
          ...settings,
          defaultAssetLocation: settings.defaultAssetLocation || null,
          notificationEmail: settings.notificationEmail || null,
        },
      })
      .eq("id", currentOrganization.id);

    setIsSubmitting(false);

    if (error) {
      console.error("Error updating organization:", error);
      toast.error("Error al guardar los cambios");
      return;
    }

    await refreshOrganization();
    toast.success("Cambios guardados correctamente");
  };

  const handleDelete = async () => {
    if (!currentOrganization) return;

    const { error } = await supabase
      .from("organizations")
      .delete()
      .eq("id", currentOrganization.id);

    if (error) {
      console.error("Error deleting organization:", error);
      toast.error("Error al eliminar la organización");
      return;
    }

    toast.success("Organización eliminada");
    navigate("/");
  };

  if (authLoading || orgLoading) {
    return (
      <div className="min-h-screen flex items-center justify-center bg-background">
        <Loader2 className="w-8 h-8 animate-spin text-primary" />
      </div>
    );
  }

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

      <main className="container mx-auto px-4 py-6 pb-24 max-w-2xl">
        <Card className="shadow-elevated mb-6">
          <CardHeader>
            <div className="w-14 h-14 rounded-xl bg-primary flex items-center justify-center shadow-soft mb-4">
              <Building2 className="w-7 h-7 text-primary-foreground" />
            </div>
            <div className="flex items-center gap-3 mb-2">
              <CardTitle className="text-2xl">Configuración de la Organización</CardTitle>
              <PlanBadge plan={plan} />
            </div>
            <CardDescription>
              Administra los ajustes de {currentOrganization?.name}
            </CardDescription>
          </CardHeader>

          <CardContent className="space-y-6">
            {/* Organization Name */}
            <div className="space-y-2">
              <Label htmlFor="name">Nombre de la Organización</Label>
              <Input
                id="name"
                value={name}
                onChange={(e) => setName(e.target.value)}
                disabled={isSubmitting || !isOrgOwner}
                placeholder="Mi Empresa"
              />
              {!isOrgOwner && (
                <p className="text-xs text-muted-foreground">
                  Solo el propietario puede cambiar el nombre
                </p>
              )}
            </div>

            <Separator />

            {/* Settings */}
            <div className="space-y-4">
              <h3 className="font-medium">Configuración de Inventario</h3>
              
              <div className="flex items-center justify-between">
                <div className="space-y-0.5">
                  <Label>Auto-asignación</Label>
                  <p className="text-xs text-muted-foreground">
                    Permite que los empleados se asignen activos disponibles
                  </p>
                </div>
                <Switch
                  checked={settings.allowSelfAssignment}
                  onCheckedChange={(checked) => 
                    setSettings(s => ({ ...s, allowSelfAssignment: checked }))
                  }
                  disabled={isSubmitting}
                />
              </div>

              <div className="flex items-center justify-between">
                <div className="space-y-0.5">
                  <Label>Requerir aprobación</Label>
                  <p className="text-xs text-muted-foreground">
                    Los préstamos de activos requieren aprobación de un admin
                  </p>
                </div>
                <Switch
                  checked={settings.requireApprovalForCheckout}
                  onCheckedChange={(checked) => 
                    setSettings(s => ({ ...s, requireApprovalForCheckout: checked }))
                  }
                  disabled={isSubmitting}
                />
              </div>

              <div className="space-y-2">
                <Label htmlFor="location">Ubicación por defecto</Label>
                <Input
                  id="location"
                  value={settings.defaultAssetLocation}
                  onChange={(e) => 
                    setSettings(s => ({ ...s, defaultAssetLocation: e.target.value }))
                  }
                  disabled={isSubmitting}
                  placeholder="Oficina Principal"
                />
              </div>

              <div className="space-y-2">
                <Label htmlFor="email">Email de notificaciones</Label>
                <Input
                  id="email"
                  type="email"
                  value={settings.notificationEmail}
                  onChange={(e) => 
                    setSettings(s => ({ ...s, notificationEmail: e.target.value }))
                  }
                  disabled={isSubmitting}
                  placeholder="admin@empresa.com"
                />
              </div>
            </div>

            <Separator />

            {/* Billing Link */}
            <div className="flex items-center justify-between">
              <div className="space-y-0.5">
                <Label>Plan y Facturación</Label>
                <p className="text-xs text-muted-foreground">
                  Administra tu suscripción y límites de uso
                </p>
              </div>
              <Button variant="outline" onClick={() => navigate("/billing")}>
                <Crown className="w-4 h-4 mr-2" />
                Ver Planes
              </Button>
            </div>

            <Button 
              onClick={handleSave} 
              disabled={isSubmitting} 
              className="w-full"
              variant="hero"
            >
              {isSubmitting ? (
                <>
                  <Loader2 className="w-4 h-4 animate-spin" />
                  Guardando...
                </>
              ) : (
                <>
                  <Save className="w-4 h-4" />
                  Guardar Cambios
                </>
              )}
            </Button>
          </CardContent>
        </Card>

        {/* Danger Zone - Only for owners */}
        {isOrgOwner && (
          <Card className="border-destructive/50 shadow-elevated">
            <CardHeader>
              <CardTitle className="text-destructive">Zona de Peligro</CardTitle>
              <CardDescription>
                Acciones irreversibles para tu organización
              </CardDescription>
            </CardHeader>
            <CardContent>
              <AlertDialog>
                <AlertDialogTrigger asChild>
                  <Button variant="destructive" className="w-full">
                    <Trash2 className="w-4 h-4" />
                    Eliminar Organización
                  </Button>
                </AlertDialogTrigger>
                <AlertDialogContent>
                  <AlertDialogHeader>
                    <AlertDialogTitle>¿Estás seguro?</AlertDialogTitle>
                    <AlertDialogDescription>
                      Esta acción es irreversible. Se eliminarán todos los datos de la organización,
                      incluyendo activos, licencias, miembros y registros de auditoría.
                    </AlertDialogDescription>
                  </AlertDialogHeader>
                  <AlertDialogFooter>
                    <AlertDialogCancel>Cancelar</AlertDialogCancel>
                    <AlertDialogAction onClick={handleDelete} className="bg-destructive text-destructive-foreground hover:bg-destructive/90">
                      Eliminar
                    </AlertDialogAction>
                  </AlertDialogFooter>
                </AlertDialogContent>
              </AlertDialog>
            </CardContent>
          </Card>
        )}
      </main>
    </div>
  );
};

export default OrganizationSettings;
