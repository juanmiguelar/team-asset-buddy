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
import { ArrowLeft, Package, Loader2, Check } from "lucide-react";
import { toast } from "sonner";
import type { Database } from "@/integrations/supabase/types";

type AssetStatus = Database["public"]["Enums"]["asset_status"];
type AssetCategory = Database["public"]["Enums"]["asset_category"];

const categoryOptions = [
  { value: "laptop", label: "Laptop" },
  { value: "monitor", label: "Monitor" },
  { value: "dock", label: "Dock" },
  { value: "peripheral", label: "Periférico" },
  { value: "other", label: "Otro" },
];

const statusOptions = [
  { value: "available", label: "Disponible" },
  { value: "assigned", label: "Asignado" },
  { value: "maintenance", label: "Mantenimiento" },
  { value: "retired", label: "Retirado" },
];

const EditAsset = () => {
  const { id } = useParams();
  const navigate = useNavigate();
  const { user, loading } = useAuth();
  const { currentOrganization, isOrgAdmin, loading: orgLoading } = useOrganization();
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [loadingAsset, setLoadingAsset] = useState(true);
  const [originalData, setOriginalData] = useState<any>(null);
  const [formData, setFormData] = useState({
    name: "",
    category: "laptop" as AssetCategory,
    serial_number: "",
    location: "",
    notes: "",
    status: "available" as AssetStatus,
  });

  useEffect(() => {
    if (!loading && !orgLoading && (!user || !isOrgAdmin)) {
      navigate("/");
    }
  }, [user, isOrgAdmin, loading, orgLoading, navigate]);

  useEffect(() => {
    if (id && user && isOrgAdmin) {
      fetchAsset();
    }
  }, [id, user, isOrgAdmin]);

  const fetchAsset = async () => {
    setLoadingAsset(true);
    const { data, error } = await supabase
      .from("assets")
      .select("*")
      .eq("id", id!)
      .maybeSingle();

    if (error || !data) {
      toast.error("Activo no encontrado");
      navigate("/");
      return;
    }

    setOriginalData(data);
    setFormData({
      name: data.name,
      category: data.category,
      serial_number: data.serial_number || "",
      location: data.location || "",
      notes: data.notes || "",
      status: data.status,
    });
    setLoadingAsset(false);
  };

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

    // Validate status change
    if (formData.status === "assigned" && !originalData?.assignee_user_id) {
      toast.error("No se puede marcar como 'Asignado' sin un usuario asignado");
      return;
    }

    setIsSubmitting(true);

    // Track changed fields for audit log
    const changedFields: Record<string, { old: any; new: any }> = {};
    Object.keys(formData).forEach((key) => {
      const oldValue = originalData?.[key] || "";
      const newValue = formData[key as keyof typeof formData] || "";
      if (oldValue !== newValue) {
        changedFields[key] = { old: oldValue, new: newValue };
      }
    });

    const { error } = await supabase
      .from("assets")
      .update({
        name: formData.name,
        category: formData.category,
        serial_number: formData.serial_number || null,
        location: formData.location || null,
        notes: formData.notes || null,
        status: formData.status,
        updated_at: new Date().toISOString(),
      })
      .eq("id", id!);

    if (error) {
      console.error("Error updating asset:", error);
      toast.error("Error al actualizar el activo");
      setIsSubmitting(false);
      return;
    }

    // Create audit log
    if (user && currentOrganization && Object.keys(changedFields).length > 0) {
      await supabase.from("audit_log").insert({
        resource_type: "asset",
        resource_id: id!,
        action: "edit",
        by_user_id: user.id,
        organization_id: currentOrganization.id,
        metadata: { changed_fields: changedFields },
      });
    }

    toast.success("Activo actualizado exitosamente");
    setIsSubmitting(false);
    navigate(`/asset/${id}`);
  };

  const handleChange = (field: string, value: string) => {
    setFormData((prev) => ({ ...prev, [field]: value }));
  };

  if (loading || orgLoading || loadingAsset) {
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
          <Button variant="ghost" size="sm" onClick={() => navigate(`/asset/${id}`)}>
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
            <CardTitle className="text-2xl">Editar Activo</CardTitle>
            <CardDescription>
              Actualiza la información del activo
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
                    {categoryOptions.map((option) => (
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

              <div className="flex gap-3">
                <Button
                  type="button"
                  variant="outline"
                  className="flex-1"
                  onClick={() => navigate(`/asset/${id}`)}
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

export default EditAsset;
