import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { supabase } from "@/integrations/supabase/client";
import { useOrganization } from "@/contexts/OrganizationContext";
import { toast } from "sonner";
import { useState } from "react";

type OrgRole = "owner" | "admin" | "member";

interface MemberRoleSelectProps {
  memberId: string;
  currentRole: OrgRole;
  isCurrentUser: boolean;
  onRoleChanged?: () => void;
}

export function MemberRoleSelect({ 
  memberId, 
  currentRole, 
  isCurrentUser,
  onRoleChanged 
}: MemberRoleSelectProps) {
  const { isOrgOwner } = useOrganization();
  const [isUpdating, setIsUpdating] = useState(false);

  // Owner role cannot be changed via this dropdown
  // And only owners can change roles
  const isDisabled = !isOrgOwner || currentRole === "owner" || isCurrentUser || isUpdating;

  const handleRoleChange = async (newRole: string) => {
    if (newRole === currentRole || isDisabled) return;

    setIsUpdating(true);

    const { error } = await supabase
      .from("organization_members")
      .update({ role: newRole as OrgRole })
      .eq("id", memberId);

    setIsUpdating(false);

    if (error) {
      console.error("Error updating role:", error);
      toast.error("Error al actualizar el rol");
      return;
    }

    toast.success("Rol actualizado correctamente");
    onRoleChanged?.();
  };

  const getRoleLabel = (role: OrgRole) => {
    switch (role) {
      case "owner":
        return "Propietario";
      case "admin":
        return "Administrador";
      case "member":
        return "Miembro";
    }
  };

  if (currentRole === "owner") {
    return (
      <span className="text-sm font-medium text-primary px-3 py-1 bg-primary/10 rounded-full">
        Propietario
      </span>
    );
  }

  return (
    <Select
      value={currentRole}
      onValueChange={handleRoleChange}
      disabled={isDisabled}
    >
      <SelectTrigger className="w-[140px]">
        <SelectValue>{getRoleLabel(currentRole)}</SelectValue>
      </SelectTrigger>
      <SelectContent>
        <SelectItem value="admin">Administrador</SelectItem>
        <SelectItem value="member">Miembro</SelectItem>
      </SelectContent>
    </Select>
  );
}
