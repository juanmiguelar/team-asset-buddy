import { useState, useEffect } from "react";
import { useNavigate } from "react-router-dom";
import { useAuth } from "@/contexts/AuthContext";
import { useOrganization } from "@/contexts/OrganizationContext";
import { supabase } from "@/integrations/supabase/client";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Building2, Loader2, ArrowRight } from "lucide-react";
import { toast } from "sonner";

const CreateOrganization = () => {
  const navigate = useNavigate();
  const { user, loading: authLoading } = useAuth();
  const { refreshOrganization } = useOrganization();
  
  const [name, setName] = useState("");
  const [isSubmitting, setIsSubmitting] = useState(false);

  useEffect(() => {
    if (!authLoading && !user) {
      navigate("/auth");
    }
  }, [user, authLoading, navigate]);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();

    if (!name.trim()) {
      toast.error("El nombre es requerido");
      return;
    }

    if (!user) {
      toast.error("Debes iniciar sesión");
      return;
    }

    setIsSubmitting(true);

    // Generate slug from name
    const slug = name.toLowerCase()
      .replace(/[^a-z0-9\s]/g, "")
      .replace(/\s+/g, "-")
      .slice(0, 50);

    // Create organization
    const { data: org, error: orgError } = await supabase
      .from("organizations")
      .insert({
        name: name.trim(),
        slug: slug + "-" + Date.now().toString(36),
      })
      .select()
      .single();

    if (orgError) {
      console.error("Error creating organization:", orgError);
      toast.error("Error al crear la organización");
      setIsSubmitting(false);
      return;
    }

    // Add user as owner
    const { error: memberError } = await supabase
      .from("organization_members")
      .insert({
        organization_id: org.id,
        user_id: user.id,
        role: "owner",
      });

    if (memberError) {
      console.error("Error adding user as owner:", memberError);
      // Try to delete the org if we couldn't add the member
      await supabase.from("organizations").delete().eq("id", org.id);
      toast.error("Error al crear la organización");
      setIsSubmitting(false);
      return;
    }

    await refreshOrganization();
    toast.success("¡Organización creada exitosamente!");
    setIsSubmitting(false);
    navigate("/");
  };

  if (authLoading) {
    return (
      <div className="min-h-screen flex items-center justify-center bg-background">
        <Loader2 className="w-8 h-8 animate-spin text-primary" />
      </div>
    );
  }

  return (
    <div className="min-h-screen flex items-center justify-center p-4 bg-background">
      <Card className="w-full max-w-md shadow-elevated">
        <CardHeader className="text-center">
          <div className="flex justify-center mb-4">
            <div className="w-16 h-16 rounded-2xl bg-primary flex items-center justify-center shadow-soft">
              <Building2 className="w-8 h-8 text-primary-foreground" />
            </div>
          </div>
          <CardTitle className="text-2xl">Crear Organización</CardTitle>
          <CardDescription>
            Configura un espacio de trabajo para tu equipo
          </CardDescription>
        </CardHeader>
        <CardContent>
          <form onSubmit={handleSubmit} className="space-y-6">
            <div className="space-y-2">
              <Label htmlFor="name">Nombre de la Organización</Label>
              <Input
                id="name"
                placeholder="Mi Empresa"
                value={name}
                onChange={(e) => setName(e.target.value)}
                disabled={isSubmitting}
                required
                autoFocus
              />
              <p className="text-xs text-muted-foreground">
                Este nombre será visible para todos los miembros del equipo
              </p>
            </div>

            <Button 
              type="submit" 
              className="w-full" 
              variant="hero"
              disabled={isSubmitting}
            >
              {isSubmitting ? (
                <>
                  <Loader2 className="w-4 h-4 animate-spin" />
                  Creando...
                </>
              ) : (
                <>
                  Crear Organización
                  <ArrowRight className="w-4 h-4" />
                </>
              )}
            </Button>
          </form>
        </CardContent>
      </Card>
    </div>
  );
};

export default CreateOrganization;
