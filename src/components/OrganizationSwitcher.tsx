import { useEffect, useState } from "react";
import { Check, ChevronsUpDown, Building2, Plus, Settings } from "lucide-react";

import { Button } from "@/components/ui/button";
import {
  Command,
  CommandEmpty,
  CommandGroup,
  CommandItem,
  CommandList,
  CommandSeparator,
} from "@/components/ui/command";
import {
  Popover,
  PopoverContent,
  PopoverTrigger,
} from "@/components/ui/popover";
import { useOrganization } from "@/contexts/OrganizationContext";
import { supabase } from "@/integrations/supabase/client";
import { useNavigate } from "react-router-dom";

interface OrgWithRole {
  id: string;
  name: string;
  slug: string;
  role: string;
}

export function OrganizationSwitcher() {
  const { currentOrganization, allMemberships, switchOrganization, isOrgAdmin } = useOrganization();
  const [open, setOpen] = useState(false);
  const [orgs, setOrgs] = useState<OrgWithRole[]>([]);
  const navigate = useNavigate();

  useEffect(() => {
    const fetchOrgs = async () => {
      if (allMemberships.length === 0) return;

      const orgIds = allMemberships.map(m => m.organization_id);
      const { data } = await supabase
        .from("organizations")
        .select("id, name, slug")
        .in("id", orgIds);

      if (data) {
        const orgsWithRoles = data.map(org => {
          const membership = allMemberships.find(m => m.organization_id === org.id);
          return {
            ...org,
            role: membership?.role || "member",
          };
        });
        setOrgs(orgsWithRoles);
      }
    };

    fetchOrgs();
  }, [allMemberships]);

  const handleSelect = async (orgId: string) => {
    if (orgId === currentOrganization?.id) {
      setOpen(false);
      return;
    }
    await switchOrganization(orgId);
    setOpen(false);
  };

  const getRoleBadge = (role: string) => {
    switch (role) {
      case "owner":
        return <span className="text-xs bg-primary/10 text-primary px-2 py-0.5 rounded-full">Propietario</span>;
      case "admin":
        return <span className="text-xs bg-blue-500/10 text-blue-600 px-2 py-0.5 rounded-full">Admin</span>;
      default:
        return null;
    }
  };

  if (!currentOrganization) return null;

  return (
    <Popover open={open} onOpenChange={setOpen}>
      <PopoverTrigger asChild>
        <Button
          variant="outline"
          role="combobox"
          aria-expanded={open}
          className="w-full justify-between max-w-[250px]"
        >
          <div className="flex items-center gap-2 truncate">
            <Building2 className="h-4 w-4 shrink-0 text-muted-foreground" />
            <span className="truncate">{currentOrganization.name}</span>
          </div>
          <ChevronsUpDown className="ml-2 h-4 w-4 shrink-0 opacity-50" />
        </Button>
      </PopoverTrigger>
      <PopoverContent className="w-[250px] p-0" align="start">
        <Command>
          <CommandList>
            <CommandEmpty>No se encontraron organizaciones.</CommandEmpty>
            <CommandGroup heading="Organizaciones">
              {orgs.map((org) => (
                <CommandItem
                  key={org.id}
                  value={org.id}
                  onSelect={() => handleSelect(org.id)}
                  className="flex items-center justify-between"
                >
                  <div className="flex items-center gap-2 truncate">
                    <Building2 className="h-4 w-4 shrink-0" />
                    <span className="truncate">{org.name}</span>
                  </div>
                  <div className="flex items-center gap-2">
                    {getRoleBadge(org.role)}
                    {currentOrganization?.id === org.id && (
                      <Check className="h-4 w-4 text-primary" />
                    )}
                  </div>
                </CommandItem>
              ))}
            </CommandGroup>
            <CommandSeparator />
            <CommandGroup>
              {isOrgAdmin && (
                <CommandItem
                  onSelect={() => {
                    setOpen(false);
                    navigate("/organization/settings");
                  }}
                  className="cursor-pointer"
                >
                  <Settings className="mr-2 h-4 w-4" />
                  Configuración
                </CommandItem>
              )}
              <CommandItem
                onSelect={() => {
                  setOpen(false);
                  navigate("/organization/create");
                }}
                className="cursor-pointer"
              >
                <Plus className="mr-2 h-4 w-4" />
                Crear organización
              </CommandItem>
            </CommandGroup>
          </CommandList>
        </Command>
      </PopoverContent>
    </Popover>
  );
}
