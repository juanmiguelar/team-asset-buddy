import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";
import { Button } from "@/components/ui/button";
import { MoreVertical, Edit, Archive, Wrench, Trash2, AlertTriangle } from "lucide-react";

interface AdminActionsMenuProps {
  onEdit?: () => void;
  onRetire?: () => void;
  onMaintenance?: () => void;
  onDelete?: () => void;
  onMarkExpired?: () => void;
  resourceType: "asset" | "license";
  status?: string;
}

export function AdminActionsMenu({
  onEdit,
  onRetire,
  onMaintenance,
  onDelete,
  onMarkExpired,
  resourceType,
  status,
}: AdminActionsMenuProps) {
  return (
    <DropdownMenu>
      <DropdownMenuTrigger asChild>
        <Button variant="outline" size="icon">
          <MoreVertical className="w-4 h-4" />
        </Button>
      </DropdownMenuTrigger>
      <DropdownMenuContent align="end">
        {onEdit && (
          <DropdownMenuItem onClick={onEdit}>
            <Edit className="w-4 h-4 mr-2" />
            Editar
          </DropdownMenuItem>
        )}
        
        {resourceType === "asset" && onMaintenance && status !== "maintenance" && (
          <DropdownMenuItem onClick={onMaintenance}>
            <Wrench className="w-4 h-4 mr-2" />
            Poner en Mantenimiento
          </DropdownMenuItem>
        )}
        
        {resourceType === "asset" && onRetire && status !== "retired" && (
          <>
            <DropdownMenuSeparator />
            <DropdownMenuItem onClick={onRetire} className="text-yellow-600">
              <Archive className="w-4 h-4 mr-2" />
              Retirar Activo
            </DropdownMenuItem>
          </>
        )}

        {resourceType === "license" && onMarkExpired && status !== "expired" && (
          <DropdownMenuItem onClick={onMarkExpired} className="text-yellow-600">
            <AlertTriangle className="w-4 h-4 mr-2" />
            Marcar como Expirada
          </DropdownMenuItem>
        )}

        {resourceType === "license" && onDelete && (
          <>
            <DropdownMenuSeparator />
            <DropdownMenuItem onClick={onDelete} className="text-red-600">
              <Trash2 className="w-4 h-4 mr-2" />
              Eliminar Licencia
            </DropdownMenuItem>
          </>
        )}
      </DropdownMenuContent>
    </DropdownMenu>
  );
}
