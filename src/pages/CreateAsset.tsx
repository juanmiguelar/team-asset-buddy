import { useState, useEffect } from "react";
import { useNavigate } from "react-router-dom";
import { useAuth } from "@/contexts/AuthContext";
import { useOrganization } from "@/contexts/OrganizationContext";
import { useSubscription } from "@/contexts/SubscriptionContext";
import { supabase } from "@/integrations/supabase/client";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { ArrowLeft, Package, Loader2, Check } from "lucide-react";
import { toast } from "sonner";
import { UpgradePrompt, useUpgradePrompt } from "@/components/UpgradePrompt";

const CreateAsset = () => {
  const navigate = useNavigate();
  const { user, loading } = useAuth();
  const { currentOrganization, isOrgAdmin, loading: orgLoading } = useOrganization();
  const { canCreateAsset, loading: subLoading, refreshSubscription } = useSubscription();
  const { showUpgradePrompt, UpgradePromptDialog } = useUpgradePrompt();
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [formData, setFormData] = useState({
    name: "",
    category: "laptop",
    serial_number: "",
    location: "",
    notes: "",
  });

  useEffect(() => {
    if (!loading && !orgLoading && !subLoading && (!user || !isOrgAdmin)) {
      navigate("/");
    }
  }, [user, isOrgAdmin, loading, orgLoading, subLoading, navigate]);

  useEffect(() => {
    // Check limit on mount
    if (!loading && !orgLoading && !subLoading && !canCreateAsset()) {
      showUpgradePrompt('assets');
    }
  }, [loading, orgLoading, subLoading, canCreateAsset]);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();

    if (!formData.name) {
      toast.error("El nombre es requerido");
      return;
    }

    if (!currentOrganization) {
      toast.error("No hay organización seleccionada");
      return;
    }

    // Check limit before creating
    if (!canCreateAsset()) {
      showUpgradePrompt('assets');
      return;
    }

    setIsSubmitting(true);

    // Create asset with temp QR code and organization_id
    const tempId = crypto.randomUUID();
    const { data: newAsset, error } = await supabase
      .from("assets")
      .insert({
        qr_code: `asset:${tempId}`,
        name: formData.name,
        category: formData.category as any,
        serial_number: formData.serial_number || null,
        location: formData.location || null,
        notes: formData.notes || null,
        organization_id: currentOrganization.id,
      })
      .select()
      .single();

    if (error || !newAsset) {
      console.error("Error creating asset:", error);
      toast.error("Error al crear el activo");
      setIsSubmitting(false);
      return;
    }

    // Create audit log
    if (user && currentOrganization) {
      await supabase.from("audit_log").insert({
        resource_type: "asset",
        resource_id: newAsset.id,
        action: "create",
        by_user_id: user.id,
        organization_id: currentOrganization.id,
        metadata: {
          name: formData.name,
          category: formData.category,
        },
      });
    }

    toast.success("Activo creado exitosamente");
    setIsSubmitting(false);
    await refreshSubscription(); // Refresh usage counts
    navigate(`/asset/${newAsset.id}`);
  };

  const handleChange = (field: string, value: string) => {
    setFormData((prev) => ({ ...prev, [field]: value }));
  };

  if (loading || orgLoading || subLoading) {
    return (
      <div className="min-h-screen flex items-center justify-center bg-background">
        <Loader2 className="w-8 h-8 animate-spin text-primary" />
      </div>
    );
  }

  return (
    <>
      <UpgradePromptDialog />
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
            <div className="w-14 h-14 rounded-xl bg-primary flex items-center justify-center shadow-soft mb-4">
              <Package className="w-7 h-7 text-primary-foreground" />
            </div>
            <CardTitle className="text-2xl">Crear Nuevo Activo</CardTitle>
            <CardDescription>
              Registra un nuevo activo en el inventario
            </CardDescription>
          </CardHeader>

          <CardContent>
            <form onSubmit={handleSubmit} className="space-y-6">
              <div className="space-y-2">
                <Label htmlFor="name">Nombre del Activo *</Label>
                <Input
                  id="name"
                  placeholder="MacBook Pro 14 M2"
                  value={formData.name}
                  onChange={(e) => handleChange("name", e.target.value)}
                  disabled={isSubmitting}
                  required
                />
              </div>

              <div className="space-y-2">
                <Label htmlFor="category">Categoría *</Label>
                <Select
                  value={formData.category}
                  onValueChange={(value) => handleChange("category", value)}
                  disabled={isSubmitting}
                >
                  <SelectTrigger>
                    <SelectValue />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="laptop">Laptop</SelectItem>
                    <SelectItem value="monitor">Monitor</SelectItem>
                    <SelectItem value="dock">Dock</SelectItem>
                    <SelectItem value="peripheral">Periférico</SelectItem>
                    <SelectItem value="other">Otro</SelectItem>
                  </SelectContent>
                </Select>
              </div>

              <div className="space-y-2">
                <Label htmlFor="serial_number">Número de Serie</Label>
                <Input
                  id="serial_number"
                  placeholder="C02XK0ACJHD5"
                  value={formData.serial_number}
                  onChange={(e) => handleChange("serial_number", e.target.value)}
                  disabled={isSubmitting}
                />
              </div>

              <div className="space-y-2">
                <Label htmlFor="location">Ubicación</Label>
                <Input
                  id="location"
                  placeholder="Oficina CR - Locker A"
                  value={formData.location}
                  onChange={(e) => handleChange("location", e.target.value)}
                  disabled={isSubmitting}
                />
              </div>

              <div className="space-y-2">
                <Label htmlFor="notes">Notas</Label>
                <Textarea
                  id="notes"
                  placeholder="Información adicional sobre el activo..."
                  value={formData.notes}
                  onChange={(e) => handleChange("notes", e.target.value)}
                  disabled={isSubmitting}
                  rows={4}
                />
              </div>

              <Button
                type="submit"
                variant="hero"
                className="w-full"
                disabled={isSubmitting}
              >
                {isSubmitting ? (
                  <>
                    <Loader2 className="w-4 h-4 animate-spin" />
                    Creando...
                  </>
                ) : (
                  <>
                    <Check className="w-4 h-4" />
                    Crear Activo
                  </>
                )}
              </Button>
            </form>
          </CardContent>
        </Card>
      </main>
    </div>
    </>
  );
};

export default CreateAsset;
