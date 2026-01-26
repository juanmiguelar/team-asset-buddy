import { useState, useEffect, useCallback } from "react";
import { useNavigate } from "react-router-dom";
import { useAuth } from "@/contexts/AuthContext";
import { useOrganization } from "@/contexts/OrganizationContext";
import { supabase } from "@/integrations/supabase/client";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Avatar, AvatarFallback } from "@/components/ui/avatar";
import { Badge } from "@/components/ui/badge";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
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
import { InviteMemberDialog } from "@/components/InviteMemberDialog";
import { MemberRoleSelect } from "@/components/MemberRoleSelect";
import { ArrowLeft, Users, Loader2, Mail, Clock, UserMinus, X } from "lucide-react";
import { toast } from "sonner";
import { format } from "date-fns";
import { es } from "date-fns/locale";

interface Member {
  id: string;
  user_id: string;
  role: "owner" | "admin" | "member";
  created_at: string;
  profile: {
    name: string;
    email: string;
  };
}

interface Invite {
  id: string;
  email: string;
  role: "owner" | "admin" | "member";
  expires_at: string;
  created_at: string;
}

const OrganizationMembers = () => {
  const navigate = useNavigate();
  const { user, loading: authLoading } = useAuth();
  const { currentOrganization, isOrgAdmin, loading: orgLoading } = useOrganization();
  
  const [members, setMembers] = useState<Member[]>([]);
  const [invites, setInvites] = useState<Invite[]>([]);
  const [loadingData, setLoadingData] = useState(true);

  const fetchData = useCallback(async () => {
    if (!currentOrganization) return;

    setLoadingData(true);

    // Fetch members with profile info
    const { data: membersData, error: membersError } = await supabase
      .from("organization_members")
      .select(`
        id,
        user_id,
        role,
        created_at,
        profiles:user_id (
          name,
          email
        )
      `)
      .eq("organization_id", currentOrganization.id)
      .order("created_at", { ascending: true });

    if (membersError) {
      console.error("Error fetching members:", membersError);
    } else {
      const formattedMembers = membersData?.map(m => ({
        id: m.id,
        user_id: m.user_id,
        role: m.role as "owner" | "admin" | "member",
        created_at: m.created_at,
        profile: m.profiles as unknown as { name: string; email: string },
      })) || [];
      setMembers(formattedMembers);
    }

    // Fetch pending invites
    if (isOrgAdmin) {
      const { data: invitesData, error: invitesError } = await supabase
        .from("organization_invites")
        .select("id, email, role, expires_at, created_at")
        .eq("organization_id", currentOrganization.id)
        .is("accepted_at", null)
        .gt("expires_at", new Date().toISOString())
        .order("created_at", { ascending: false });

      if (invitesError) {
        console.error("Error fetching invites:", invitesError);
      } else {
        setInvites(invitesData || []);
      }
    }

    setLoadingData(false);
  }, [currentOrganization, isOrgAdmin]);

  useEffect(() => {
    if (!authLoading && !user) {
      navigate("/auth");
      return;
    }
    
    if (!orgLoading && !currentOrganization) {
      navigate("/");
    }
  }, [user, authLoading, currentOrganization, orgLoading, navigate]);

  useEffect(() => {
    if (currentOrganization && !orgLoading) {
      fetchData();
    }
  }, [currentOrganization, orgLoading, fetchData]);

  const handleRemoveMember = async (memberId: string, memberName: string) => {
    const { error } = await supabase
      .from("organization_members")
      .delete()
      .eq("id", memberId);

    if (error) {
      console.error("Error removing member:", error);
      toast.error("Error al eliminar el miembro");
      return;
    }

    toast.success(`${memberName} ha sido removido de la organización`);
    fetchData();
  };

  const handleCancelInvite = async (inviteId: string) => {
    const { error } = await supabase
      .from("organization_invites")
      .delete()
      .eq("id", inviteId);

    if (error) {
      console.error("Error canceling invite:", error);
      toast.error("Error al cancelar la invitación");
      return;
    }

    toast.success("Invitación cancelada");
    fetchData();
  };

  const getInitials = (name: string) => {
    return name
      .split(" ")
      .map(n => n[0])
      .join("")
      .toUpperCase()
      .slice(0, 2);
  };

  const getRoleBadge = (role: string) => {
    switch (role) {
      case "owner":
        return <Badge className="bg-primary/10 text-primary">Propietario</Badge>;
      case "admin":
        return <Badge className="bg-blue-500/10 text-blue-600">Admin</Badge>;
      default:
        return <Badge variant="secondary">Miembro</Badge>;
    }
  };

  if (authLoading || orgLoading || loadingData) {
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

      <main className="container mx-auto px-4 py-6 pb-24 max-w-3xl">
        <div className="flex items-center justify-between mb-6">
          <div>
            <h1 className="text-2xl font-bold">Miembros del Equipo</h1>
            <p className="text-muted-foreground">
              {members.length} {members.length === 1 ? "miembro" : "miembros"} en {currentOrganization?.name}
            </p>
          </div>
          {isOrgAdmin && <InviteMemberDialog onInviteSent={fetchData} />}
        </div>

        <Tabs defaultValue="members" className="space-y-4">
          <TabsList>
            <TabsTrigger value="members" className="flex items-center gap-2">
              <Users className="w-4 h-4" />
              Miembros ({members.length})
            </TabsTrigger>
            {isOrgAdmin && (
              <TabsTrigger value="invites" className="flex items-center gap-2">
                <Mail className="w-4 h-4" />
                Invitaciones ({invites.length})
              </TabsTrigger>
            )}
          </TabsList>

          <TabsContent value="members">
            <Card className="shadow-soft">
              <CardContent className="pt-6">
                <div className="space-y-4">
                  {members.map((member) => (
                    <div
                      key={member.id}
                      className="flex items-center justify-between p-4 rounded-lg border"
                    >
                      <div className="flex items-center gap-4">
                        <Avatar>
                          <AvatarFallback>
                            {getInitials(member.profile.name)}
                          </AvatarFallback>
                        </Avatar>
                        <div>
                          <p className="font-medium">
                            {member.profile.name}
                            {member.user_id === user?.id && (
                              <span className="text-muted-foreground ml-2">(Tú)</span>
                            )}
                          </p>
                          <p className="text-sm text-muted-foreground">{member.profile.email}</p>
                        </div>
                      </div>
                      <div className="flex items-center gap-3">
                        <MemberRoleSelect
                          memberId={member.id}
                          currentRole={member.role}
                          isCurrentUser={member.user_id === user?.id}
                          onRoleChanged={fetchData}
                        />
                        {isOrgAdmin && member.role !== "owner" && member.user_id !== user?.id && (
                          <AlertDialog>
                            <AlertDialogTrigger asChild>
                              <Button variant="ghost" size="icon" className="text-destructive">
                                <UserMinus className="w-4 h-4" />
                              </Button>
                            </AlertDialogTrigger>
                            <AlertDialogContent>
                              <AlertDialogHeader>
                                <AlertDialogTitle>Remover miembro</AlertDialogTitle>
                                <AlertDialogDescription>
                                  ¿Estás seguro de que deseas remover a {member.profile.name} de la organización?
                                  Ya no tendrá acceso a los recursos del equipo.
                                </AlertDialogDescription>
                              </AlertDialogHeader>
                              <AlertDialogFooter>
                                <AlertDialogCancel>Cancelar</AlertDialogCancel>
                                <AlertDialogAction
                                  onClick={() => handleRemoveMember(member.id, member.profile.name)}
                                  className="bg-destructive text-destructive-foreground hover:bg-destructive/90"
                                >
                                  Remover
                                </AlertDialogAction>
                              </AlertDialogFooter>
                            </AlertDialogContent>
                          </AlertDialog>
                        )}
                      </div>
                    </div>
                  ))}
                </div>
              </CardContent>
            </Card>
          </TabsContent>

          {isOrgAdmin && (
            <TabsContent value="invites">
              <Card className="shadow-soft">
                <CardHeader>
                  <CardTitle className="flex items-center gap-2">
                    <Mail className="w-5 h-5" />
                    Invitaciones Pendientes
                  </CardTitle>
                  <CardDescription>
                    Las invitaciones expiran después de 7 días
                  </CardDescription>
                </CardHeader>
                <CardContent>
                  {invites.length === 0 ? (
                    <p className="text-center text-muted-foreground py-8">
                      No hay invitaciones pendientes
                    </p>
                  ) : (
                    <div className="space-y-4">
                      {invites.map((invite) => (
                        <div
                          key={invite.id}
                          className="flex items-center justify-between p-4 rounded-lg border"
                        >
                          <div className="flex items-center gap-4">
                            <Avatar>
                              <AvatarFallback>
                                <Mail className="w-4 h-4" />
                              </AvatarFallback>
                            </Avatar>
                            <div>
                              <p className="font-medium">{invite.email}</p>
                              <div className="flex items-center gap-2 text-sm text-muted-foreground">
                                <Clock className="w-3 h-3" />
                                Expira: {format(new Date(invite.expires_at), "d MMM yyyy", { locale: es })}
                              </div>
                            </div>
                          </div>
                          <div className="flex items-center gap-3">
                            {getRoleBadge(invite.role)}
                            <Button 
                              variant="ghost" 
                              size="icon" 
                              className="text-destructive"
                              onClick={() => handleCancelInvite(invite.id)}
                            >
                              <X className="w-4 h-4" />
                            </Button>
                          </div>
                        </div>
                      ))}
                    </div>
                  )}
                </CardContent>
              </Card>
            </TabsContent>
          )}
        </Tabs>
      </main>
    </div>
  );
};

export default OrganizationMembers;
