import { useState } from "react";
import { Button } from "@/components/ui/button";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
  DialogTrigger,
} from "@/components/ui/dialog";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { supabase } from "@/integrations/supabase/client";
import { useOrganization } from "@/contexts/OrganizationContext";
import { useSubscription } from "@/contexts/SubscriptionContext";
import { useAuth } from "@/contexts/AuthContext";
import { toast } from "sonner";
import { Loader2, UserPlus } from "lucide-react";
import { useUpgradePrompt } from "@/components/UpgradePrompt";

interface InviteMemberDialogProps {
  onInviteSent?: () => void;
}

export function InviteMemberDialog({ onInviteSent }: InviteMemberDialogProps) {
  const { currentOrganization, isOrgOwner } = useOrganization();
  const { canInviteMember, refreshSubscription } = useSubscription();
  const { showUpgradePrompt, UpgradePromptDialog } = useUpgradePrompt();
  const { user } = useAuth();
  const [open, setOpen] = useState(false);
  const [email, setEmail] = useState("");
  const [role, setRole] = useState<"admin" | "member">("member");
  const [isSubmitting, setIsSubmitting] = useState(false);

  const handleOpenChange = (newOpen: boolean) => {
    if (newOpen && !canInviteMember()) {
      showUpgradePrompt('members');
      return;
    }
    setOpen(newOpen);
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();

    if (!email || !currentOrganization || !user) {
      toast.error("Por favor ingresa un email válido");
      return;
    }

    // Double check limit before creating
    if (!canInviteMember()) {
      showUpgradePrompt('members');
      return;
    }

    setIsSubmitting(true);

    const { error } = await supabase.from("organization_invites").insert({
      organization_id: currentOrganization.id,
      email: email.toLowerCase().trim(),
      role: role,
      invited_by: user.id,
    });

    setIsSubmitting(false);

    if (error) {
      if (error.code === "23505") {
        toast.error("Ya existe una invitación pendiente para este email");
      } else {
        console.error("Error sending invite:", error);
        toast.error("Error al enviar la invitación");
      }
      return;
    }

    toast.success(`Invitación enviada a ${email}`);
    setEmail("");
    setRole("member");
    setOpen(false);
    await refreshSubscription(); // Refresh usage counts
    onInviteSent?.();
  };

  return (
    <>
      <UpgradePromptDialog />
      <Dialog open={open} onOpenChange={handleOpenChange}>
        <DialogTrigger asChild>
          <Button variant="hero">
            <UserPlus className="w-4 h-4" />
            Invitar Miembro
          </Button>
        </DialogTrigger>
        <DialogContent className="sm:max-w-[425px]">
          <DialogHeader>
            <DialogTitle>Invitar nuevo miembro</DialogTitle>
            <DialogDescription>
              Envía una invitación por email para unirse a {currentOrganization?.name}
            </DialogDescription>
          </DialogHeader>
          <form onSubmit={handleSubmit}>
            <div className="grid gap-4 py-4">
              <div className="space-y-2">
                <Label htmlFor="email">Email</Label>
                <Input
                  id="email"
                  type="email"
                  placeholder="usuario@ejemplo.com"
                  value={email}
                  onChange={(e) => setEmail(e.target.value)}
                  disabled={isSubmitting}
                  required
                />
              </div>
              <div className="space-y-2">
                <Label htmlFor="role">Rol</Label>
                <Select
                  value={role}
                  onValueChange={(value: "admin" | "member") => setRole(value)}
                  disabled={isSubmitting}
                >
                  <SelectTrigger>
                    <SelectValue />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="member">Miembro</SelectItem>
                    {isOrgOwner && <SelectItem value="admin">Administrador</SelectItem>}
                  </SelectContent>
                </Select>
                <p className="text-xs text-muted-foreground">
                  {role === "admin" 
                    ? "Los administradores pueden gestionar activos, licencias y miembros"
                    : "Los miembros pueden ver y solicitar activos y licencias"
                  }
                </p>
              </div>
            </div>
            <DialogFooter>
              <Button type="button" variant="outline" onClick={() => setOpen(false)}>
                Cancelar
              </Button>
              <Button type="submit" disabled={isSubmitting}>
                {isSubmitting ? (
                  <>
                    <Loader2 className="w-4 h-4 animate-spin" />
                    Enviando...
                  </>
                ) : (
                  "Enviar Invitación"
                )}
              </Button>
            </DialogFooter>
          </form>
        </DialogContent>
      </Dialog>
    </>
  );
}
