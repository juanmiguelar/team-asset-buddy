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
import { ArrowLeft, Key, Loader2, Check } from "lucide-react";
import { toast } from "sonner";
import { useUpgradePrompt } from "@/components/UpgradePrompt";

const productOptions = [
  { value: "adobe_cc", label: "Adobe Creative Cloud" },
  { value: "jetbrains", label: "JetBrains" },
  { value: "office_365", label: "Office 365" },
  { value: "github", label: "GitHub" },
  { value: "other", label: "Otro" },
];

function generateMaskedKey(fullKey: string): string {
  if (fullKey.length <= 4) return "****";
  const lastFour = fullKey.slice(-4);
  return `****-****-****-${lastFour}`;
}

const CreateLicense = () => {
  const navigate = useNavigate();
  const { user, loading } = useAuth();
  const { currentOrganization, isOrgAdmin, loading: orgLoading } = useOrganization();
  const { canCreateLicense, loading: subLoading, refreshSubscription } = useSubscription();
  const { showUpgradePrompt, UpgradePromptDialog } = useUpgradePrompt();
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [formData, setFormData] = useState({
    product: "adobe_cc",
    seat_key_full: "",
    expires_at: "",
    notes: "",
  });

  useEffect(() => {
    if (!loading && !orgLoading && !subLoading && (!user || !isOrgAdmin)) {
      navigate("/");
    }
  }, [user, isOrgAdmin, loading, orgLoading, subLoading, navigate]);

  useEffect(() => {
    // Check limit on mount
    if (!loading && !orgLoading && !subLoading && !canCreateLicense()) {
      showUpgradePrompt('licenses');
    }
  }, [loading, orgLoading, subLoading, canCreateLicense]);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();

    if (!formData.seat_key_full) {
      toast.error("La clave de licencia es requerida");
      return;
    }

    if (!currentOrganization) {
      toast.error("No hay organización seleccionada");
      return;
    }

    // Check limit before creating
    if (!canCreateLicense()) {
      showUpgradePrompt('licenses');
      return;
    }

    setIsSubmitting(true);

    const tempId = crypto.randomUUID();
    const maskedKey = generateMaskedKey(formData.seat_key_full);

    const { data: newLicense, error } = await supabase
      .from("licenses")
      .insert({
        qr_code: `license:${tempId}`,
        product: formData.product as any,
        seat_key_full: formData.seat_key_full,
        seat_key_masked: maskedKey,
        expires_at: formData.expires_at || null,
        notes: formData.notes || null,
        organization_id: currentOrganization.id,
      })
      .select()
      .single();

    if (error || !newLicense) {
      console.error("Error creating license:", error);
      toast.error("Error al crear la licencia");
      setIsSubmitting(false);
      return;
    }

    // Create audit log
    if (user && currentOrganization) {
      await supabase.from("audit_log").insert({
        resource_type: "license",
        resource_id: newLicense.id,
        action: "create",
        by_user_id: user.id,
        organization_id: currentOrganization.id,
        metadata: {
          product: formData.product,
        },
      });
    }

    toast.success("Licencia creada exitosamente");
    setIsSubmitting(false);
    await refreshSubscription(); // Refresh usage counts
    navigate(`/license/${newLicense.id}`);
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
              <Key className="w-7 h-7 text-primary-foreground" />
            </div>
            <CardTitle className="text-2xl">Crear Nueva Licencia</CardTitle>
            <CardDescription>
              Registra una nueva licencia de software en el inventario
            </CardDescription>
          </CardHeader>

          <CardContent>
            <form onSubmit={handleSubmit} className="space-y-6">
              <div className="space-y-2">
                <Label htmlFor="product">Producto *</Label>
                <Select
                  value={formData.product}
                  onValueChange={(value) => handleChange("product", value)}
                  disabled={isSubmitting}
                >
                  <SelectTrigger>
                    <SelectValue />
                  </SelectTrigger>
                  <SelectContent>
                    {productOptions.map((option) => (
                      <SelectItem key={option.value} value={option.value}>
                        {option.label}
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>

              <div className="space-y-2">
                <Label htmlFor="seat_key_full">Clave de Licencia *</Label>
                <Input
                  id="seat_key_full"
                  type="password"
                  placeholder="XXXX-XXXX-XXXX-XXXX"
                  value={formData.seat_key_full}
                  onChange={(e) => handleChange("seat_key_full", e.target.value)}
                  disabled={isSubmitting}
                  required
                />
                <p className="text-xs text-muted-foreground">
                  La clave se almacenará de forma segura y solo será visible para administradores
                </p>
              </div>

              <div className="space-y-2">
                <Label htmlFor="expires_at">Fecha de Expiración</Label>
                <div className="relative">
                  <Input
                    id="expires_at"
                    type="date"
                    value={formData.expires_at}
                    onChange={(e) => handleChange("expires_at", e.target.value)}
                    disabled={isSubmitting}
                  />
                </div>
                <p className="text-xs text-muted-foreground">
                  Opcional - Deja vacío si la licencia no expira
                </p>
              </div>

              <div className="space-y-2">
                <Label htmlFor="notes">Notas</Label>
                <Textarea
                  id="notes"
                  placeholder="Información adicional sobre la licencia..."
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
                    Crear Licencia
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

export default CreateLicense;
