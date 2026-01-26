import { useState, useEffect } from "react";
import { useNavigate, useParams } from "react-router-dom";
import { useAuth } from "@/contexts/AuthContext";
import { useOrganization } from "@/contexts/OrganizationContext";
import { supabase } from "@/integrations/supabase/client";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { ArrowLeft, Key, Loader2, Check } from "lucide-react";
import { toast } from "sonner";
import type { Database } from "@/integrations/supabase/types";

type LicenseStatus = Database["public"]["Enums"]["license_status"];
type LicenseProduct = Database["public"]["Enums"]["license_product"];

const productOptions = [
  { value: "adobe_cc", label: "Adobe Creative Cloud" },
  { value: "jetbrains", label: "JetBrains" },
  { value: "office_365", label: "Office 365" },
  { value: "github", label: "GitHub" },
  { value: "other", label: "Otro" },
];

const statusOptions = [
  { value: "available", label: "Disponible" },
  { value: "assigned", label: "Asignada" },
  { value: "expired", label: "Expirada" },
];

function generateMaskedKey(fullKey: string): string {
  if (fullKey.length <= 4) return "****";
  const lastFour = fullKey.slice(-4);
  return `****-****-****-${lastFour}`;
}

const EditLicense = () => {
  const { id } = useParams();
  const navigate = useNavigate();
  const { user, loading } = useAuth();
  const { currentOrganization, isOrgAdmin, loading: orgLoading } = useOrganization();
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [loadingLicense, setLoadingLicense] = useState(true);
  const [originalData, setOriginalData] = useState<any>(null);
  const [formData, setFormData] = useState({
    product: "adobe_cc" as LicenseProduct,
    seat_key_full: "",
    expires_at: "",
    notes: "",
    status: "available" as LicenseStatus,
  });
  const [currentMaskedKey, setCurrentMaskedKey] = useState("");

  useEffect(() => {
    if (!loading && !orgLoading && (!user || !isOrgAdmin)) {
      navigate("/");
    }
  }, [user, isOrgAdmin, loading, orgLoading, navigate]);

  useEffect(() => {
    if (id && user && isOrgAdmin) {
      fetchLicense();
    }
  }, [id, user, isOrgAdmin]);

  const fetchLicense = async () => {
    setLoadingLicense(true);
    const { data, error } = await supabase
      .from("licenses")
      .select("*")
      .eq("id", id!)
      .maybeSingle();

    if (error || !data) {
      toast.error("Licencia no encontrada");
      navigate("/");
      return;
    }

    setOriginalData(data);
    setCurrentMaskedKey(data.seat_key_masked || "");
    setFormData({
      product: data.product,
      seat_key_full: "", // Don't pre-fill the full key for security
      expires_at: data.expires_at || "",
      notes: data.notes || "",
      status: data.status,
    });
    setLoadingLicense(false);
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();

    if (!currentOrganization) {
      toast.error("No hay organización seleccionada");
      return;
    }

    // Validate status change
    if (formData.status === "assigned" && !originalData?.assignee_user_id) {
      toast.error("No se puede marcar como 'Asignada' sin un usuario asignado");
      return;
    }

    setIsSubmitting(true);

    // Build update object
    const updateData: any = {
      product: formData.product,
      expires_at: formData.expires_at || null,
      notes: formData.notes || null,
      status: formData.status,
      updated_at: new Date().toISOString(),
    };

    // Only update the key if a new one is provided
    if (formData.seat_key_full) {
      updateData.seat_key_full = formData.seat_key_full;
      updateData.seat_key_masked = generateMaskedKey(formData.seat_key_full);
    }

    // Track changed fields for audit log
    const changedFields: Record<string, { old: any; new: any }> = {};
    if (originalData?.product !== formData.product) {
      changedFields.product = { old: originalData?.product, new: formData.product };
    }
    if (originalData?.expires_at !== (formData.expires_at || null)) {
      changedFields.expires_at = { old: originalData?.expires_at, new: formData.expires_at || null };
    }
    if (originalData?.notes !== (formData.notes || null)) {
      changedFields.notes = { old: originalData?.notes, new: formData.notes || null };
    }
    if (originalData?.status !== formData.status) {
      changedFields.status = { old: originalData?.status, new: formData.status };
    }
    if (formData.seat_key_full) {
      changedFields.seat_key = { old: "***", new: "*** (updated)" };
    }

    const { error } = await supabase
      .from("licenses")
      .update(updateData)
      .eq("id", id!);

    if (error) {
      console.error("Error updating license:", error);
      toast.error("Error al actualizar la licencia");
      setIsSubmitting(false);
      return;
    }

    // Create audit log
    if (user && currentOrganization && Object.keys(changedFields).length > 0) {
      await supabase.from("audit_log").insert({
        resource_type: "license",
        resource_id: id!,
        action: "edit",
        by_user_id: user.id,
        organization_id: currentOrganization.id,
        metadata: { changed_fields: changedFields },
      });
    }

    toast.success("Licencia actualizada exitosamente");
    setIsSubmitting(false);
    navigate(`/license/${id}`);
  };

  const handleChange = (field: string, value: string) => {
    setFormData((prev) => ({ ...prev, [field]: value }));
  };

  if (loading || orgLoading || loadingLicense) {
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
          <Button variant="ghost" size="sm" onClick={() => navigate(`/license/${id}`)}>
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
            <CardTitle className="text-2xl">Editar Licencia</CardTitle>
            <CardDescription>
              Actualiza la información de la licencia
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
                <Label htmlFor="status">Estado *</Label>
                <Select
                  value={formData.status}
                  onValueChange={(value) => handleChange("status", value)}
                  disabled={isSubmitting}
                >
                  <SelectTrigger>
                    <SelectValue />
                  </SelectTrigger>
                  <SelectContent>
                    {statusOptions.map((option) => (
                      <SelectItem 
                        key={option.value} 
                        value={option.value}
                        disabled={option.value === "assigned" && !originalData?.assignee_user_id}
                      >
                        {option.label}
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>

              <div className="space-y-2">
                <Label htmlFor="seat_key_full">Clave de Licencia</Label>
                <Input
                  id="seat_key_full"
                  type="password"
                  placeholder="Dejar vacío para mantener la actual"
                  value={formData.seat_key_full}
                  onChange={(e) => handleChange("seat_key_full", e.target.value)}
                  disabled={isSubmitting}
                />
                <p className="text-xs text-muted-foreground">
                  Clave actual: {currentMaskedKey || "No definida"} — Ingresa una nueva clave para actualizarla
                </p>
              </div>

              <div className="space-y-2">
                <Label htmlFor="expires_at">Fecha de Expiración</Label>
                <Input
                  id="expires_at"
                  type="date"
                  value={formData.expires_at}
                  onChange={(e) => handleChange("expires_at", e.target.value)}
                  disabled={isSubmitting}
                />
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

              <div className="flex gap-3">
                <Button
                  type="button"
                  variant="outline"
                  className="flex-1"
                  onClick={() => navigate(`/license/${id}`)}
                  disabled={isSubmitting}
                >
                  Cancelar
                </Button>
                <Button
                  type="submit"
                  variant="hero"
                  className="flex-1"
                  disabled={isSubmitting}
                >
                  {isSubmitting ? (
                    <>
                      <Loader2 className="w-4 h-4 animate-spin" />
                      Guardando...
                    </>
                  ) : (
                    <>
                      <Check className="w-4 h-4" />
                      Guardar Cambios
                    </>
                  )}
                </Button>
              </div>
            </form>
          </CardContent>
        </Card>
      </main>
    </div>
  );
};

export default EditLicense;
