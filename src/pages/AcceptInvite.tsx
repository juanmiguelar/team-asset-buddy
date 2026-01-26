import { useState, useEffect } from "react";
import { useNavigate, useSearchParams } from "react-router-dom";
import { useAuth } from "@/contexts/AuthContext";
import { useOrganization } from "@/contexts/OrganizationContext";
import { supabase } from "@/integrations/supabase/client";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Building2, Loader2, Check, X, LogIn } from "lucide-react";
import { toast } from "sonner";

interface InviteDetails {
  id: string;
  organization_id: string;
  email: string;
  role: "owner" | "admin" | "member";
  expires_at: string;
  organization: {
    name: string;
  };
}

const AcceptInvite = () => {
  const navigate = useNavigate();
  const [searchParams] = useSearchParams();
  const { user, loading: authLoading } = useAuth();
  const { refreshOrganization } = useOrganization();
  
  const [invite, setInvite] = useState<InviteDetails | null>(null);
  const [loadingInvite, setLoadingInvite] = useState(true);
  const [isAccepting, setIsAccepting] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const token = searchParams.get("token");

  useEffect(() => {
    const fetchInvite = async () => {
      if (!token) {
        setError("Token de invitación no válido");
        setLoadingInvite(false);
        return;
      }

      // Query without RLS - we need to access by token, not by admin status
      const { data, error: fetchError } = await supabase
        .from("organization_invites")
        .select(`
          id,
          organization_id,
          email,
          role,
          expires_at,
          organizations:organization_id (
            name
          )
        `)
        .eq("token", token)
        .is("accepted_at", null)
        .single();

      if (fetchError || !data) {
        setError("Invitación no encontrada o ya fue utilizada");
        setLoadingInvite(false);
        return;
      }

      if (new Date(data.expires_at) < new Date()) {
        setError("Esta invitación ha expirado");
        setLoadingInvite(false);
        return;
      }

      setInvite({
        ...data,
        organization: data.organizations as unknown as { name: string },
      });
      setLoadingInvite(false);
    };

    fetchInvite();
  }, [token]);

  const handleAccept = async () => {
    if (!invite || !user) return;

    // Verify email matches
    if (user.email?.toLowerCase() !== invite.email.toLowerCase()) {
      toast.error("Este email no coincide con la invitación. Inicia sesión con el email correcto.");
      return;
    }

    setIsAccepting(true);

    // Add user to organization
    const { error: memberError } = await supabase
      .from("organization_members")
      .insert({
        organization_id: invite.organization_id,
        user_id: user.id,
        role: invite.role,
      });

    if (memberError) {
      if (memberError.code === "23505") {
        // User already a member
        toast.info("Ya eres miembro de esta organización");
      } else {
        console.error("Error joining organization:", memberError);
        toast.error("Error al unirse a la organización");
        setIsAccepting(false);
        return;
      }
    }

    // Mark invite as accepted
    await supabase
      .from("organization_invites")
      .update({ accepted_at: new Date().toISOString() })
      .eq("id", invite.id);

    await refreshOrganization();
    toast.success(`¡Te has unido a ${invite.organization.name}!`);
    setIsAccepting(false);
    navigate("/");
  };

  const getRoleLabel = (role: string) => {
    switch (role) {
      case "owner":
        return "Propietario";
      case "admin":
        return "Administrador";
      case "member":
        return "Miembro";
      default:
        return role;
    }
  };

  if (loadingInvite || authLoading) {
    return (
      <div className="min-h-screen flex items-center justify-center bg-background">
        <Loader2 className="w-8 h-8 animate-spin text-primary" />
      </div>
    );
  }

  if (error) {
    return (
      <div className="min-h-screen flex items-center justify-center p-4 bg-background">
        <Card className="w-full max-w-md shadow-elevated">
          <CardHeader className="text-center">
            <div className="flex justify-center mb-4">
              <div className="w-16 h-16 rounded-2xl bg-destructive/10 flex items-center justify-center">
                <X className="w-8 h-8 text-destructive" />
              </div>
            </div>
            <CardTitle className="text-2xl">Invitación Inválida</CardTitle>
            <CardDescription>{error}</CardDescription>
          </CardHeader>
          <CardContent className="text-center">
            <Button onClick={() => navigate("/")} variant="outline">
              Ir al Inicio
            </Button>
          </CardContent>
        </Card>
      </div>
    );
  }

  if (!user) {
    return (
      <div className="min-h-screen flex items-center justify-center p-4 bg-background">
        <Card className="w-full max-w-md shadow-elevated">
          <CardHeader className="text-center">
            <div className="flex justify-center mb-4">
              <div className="w-16 h-16 rounded-2xl bg-primary flex items-center justify-center shadow-soft">
                <Building2 className="w-8 h-8 text-primary-foreground" />
              </div>
            </div>
            <CardTitle className="text-2xl">Invitación al Equipo</CardTitle>
            <CardDescription>
              Has sido invitado a unirte a <strong>{invite?.organization.name}</strong> como {getRoleLabel(invite?.role || "member")}
            </CardDescription>
          </CardHeader>
          <CardContent className="space-y-4 text-center">
            <p className="text-sm text-muted-foreground">
              Inicia sesión o crea una cuenta con el email <strong>{invite?.email}</strong> para aceptar la invitación.
            </p>
            <Button 
              onClick={() => navigate(`/auth?invite=${token}&email=${invite?.email}`)} 
              variant="hero"
              className="w-full"
            >
              <LogIn className="w-4 h-4" />
              Iniciar Sesión o Registrarse
            </Button>
          </CardContent>
        </Card>
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
          <CardTitle className="text-2xl">Unirse al Equipo</CardTitle>
          <CardDescription>
            Has sido invitado a unirte a <strong>{invite?.organization.name}</strong>
          </CardDescription>
        </CardHeader>
        <CardContent className="space-y-6">
          <div className="bg-muted/50 p-4 rounded-lg text-center">
            <p className="text-sm text-muted-foreground mb-1">Tu rol será</p>
            <p className="font-medium text-lg">{getRoleLabel(invite?.role || "member")}</p>
          </div>

          {user.email?.toLowerCase() !== invite?.email.toLowerCase() && (
            <div className="bg-destructive/10 p-4 rounded-lg text-center">
              <p className="text-sm text-destructive">
                Esta invitación es para <strong>{invite?.email}</strong>.
                Has iniciado sesión como <strong>{user.email}</strong>.
              </p>
            </div>
          )}

          <div className="flex gap-3">
            <Button 
              variant="outline" 
              className="flex-1"
              onClick={() => navigate("/")}
            >
              Cancelar
            </Button>
            <Button 
              variant="hero"
              className="flex-1"
              onClick={handleAccept}
              disabled={isAccepting || user.email?.toLowerCase() !== invite?.email.toLowerCase()}
            >
              {isAccepting ? (
                <>
                  <Loader2 className="w-4 h-4 animate-spin" />
                  Aceptando...
                </>
              ) : (
                <>
                  <Check className="w-4 h-4" />
                  Aceptar
                </>
              )}
            </Button>
          </div>
        </CardContent>
      </Card>
    </div>
  );
};

export default AcceptInvite;
