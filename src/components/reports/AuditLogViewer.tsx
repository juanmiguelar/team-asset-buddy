import { useState, useEffect, useMemo } from "react";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Badge } from "@/components/ui/badge";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { Skeleton } from "@/components/ui/skeleton";
import { Collapsible, CollapsibleContent, CollapsibleTrigger } from "@/components/ui/collapsible";
import { supabase } from "@/integrations/supabase/client";
import { useOrganization } from "@/contexts/OrganizationContext";
import { exportToCSV } from "@/lib/exportCsv";
import { Search, Download, ChevronDown, ChevronUp, FileText, Package, Key, User } from "lucide-react";
import { format, subDays } from "date-fns";
import { es } from "date-fns/locale";
import type { Database } from "@/integrations/supabase/types";

type AuditAction = Database["public"]["Enums"]["audit_action"];

interface AuditLog {
  id: string;
  action: AuditAction;
  resource_type: string;
  resource_id: string;
  by_user_id: string;
  to_user_id: string | null;
  metadata: Record<string, unknown> | null;
  timestamp: string;
  organization_id: string | null;
  by_user?: { name: string; email: string } | null;
  to_user?: { name: string; email: string } | null;
}

type DateFilter = "7" | "30" | "90" | "all";
type ActionFilter = "all" | AuditAction;
type ResourceFilter = "all" | "asset" | "license";

const ACTION_LABELS: Record<AuditAction, string> = {
  check_out: "Asignación",
  check_in: "Devolución",
  create: "Creación",
  edit: "Edición",
  retire: "Retiro",
  assign_override: "Reasignación",
};

const ACTION_COLORS: Record<AuditAction, string> = {
  check_out: "bg-blue-500/10 text-blue-700 dark:text-blue-400",
  check_in: "bg-green-500/10 text-green-700 dark:text-green-400",
  create: "bg-purple-500/10 text-purple-700 dark:text-purple-400",
  edit: "bg-yellow-500/10 text-yellow-700 dark:text-yellow-400",
  retire: "bg-red-500/10 text-red-700 dark:text-red-400",
  assign_override: "bg-orange-500/10 text-orange-700 dark:text-orange-400",
};

const ITEMS_PER_PAGE = 25;

export function AuditLogViewer() {
  const { currentOrganization } = useOrganization();
  const [logs, setLogs] = useState<AuditLog[]>([]);
  const [loading, setLoading] = useState(true);
  const [dateFilter, setDateFilter] = useState<DateFilter>("30");
  const [actionFilter, setActionFilter] = useState<ActionFilter>("all");
  const [resourceFilter, setResourceFilter] = useState<ResourceFilter>("all");
  const [searchQuery, setSearchQuery] = useState("");
  const [expandedRows, setExpandedRows] = useState<Set<string>>(new Set());
  const [currentPage, setCurrentPage] = useState(1);

  useEffect(() => {
    if (currentOrganization) {
      fetchLogs();
    }
  }, [currentOrganization, dateFilter]);

  const fetchLogs = async () => {
    if (!currentOrganization) return;
    
    setLoading(true);
    
    let query = supabase
      .from("audit_log")
      .select(`
        *,
        by_user:profiles!audit_log_by_user_id_fkey(name, email),
        to_user:profiles!audit_log_to_user_id_fkey(name, email)
      `)
      .eq("organization_id", currentOrganization.id)
      .order("timestamp", { ascending: false });

    if (dateFilter !== "all") {
      const daysAgo = parseInt(dateFilter);
      const fromDate = subDays(new Date(), daysAgo).toISOString();
      query = query.gte("timestamp", fromDate);
    }

    const { data, error } = await query.limit(500);
    
    if (error) {
      console.error("Error fetching audit logs:", error);
    } else {
      setLogs((data as AuditLog[]) || []);
    }
    
    setLoading(false);
  };

  // Apply filters
  const filteredLogs = useMemo(() => {
    return logs.filter((log) => {
      // Action filter
      if (actionFilter !== "all" && log.action !== actionFilter) return false;
      
      // Resource filter
      if (resourceFilter !== "all" && log.resource_type !== resourceFilter) return false;
      
      // Search filter
      if (searchQuery) {
        const query = searchQuery.toLowerCase();
        const userName = log.by_user?.name?.toLowerCase() || "";
        const userEmail = log.by_user?.email?.toLowerCase() || "";
        const resourceId = log.resource_id.toLowerCase();
        
        if (!userName.includes(query) && !userEmail.includes(query) && !resourceId.includes(query)) {
          return false;
        }
      }
      
      return true;
    });
  }, [logs, actionFilter, resourceFilter, searchQuery]);

  // Paginate
  const paginatedLogs = useMemo(() => {
    const start = (currentPage - 1) * ITEMS_PER_PAGE;
    return filteredLogs.slice(start, start + ITEMS_PER_PAGE);
  }, [filteredLogs, currentPage]);

  const totalPages = Math.ceil(filteredLogs.length / ITEMS_PER_PAGE);

  const toggleRow = (id: string) => {
    setExpandedRows((prev) => {
      const next = new Set(prev);
      if (next.has(id)) {
        next.delete(id);
      } else {
        next.add(id);
      }
      return next;
    });
  };

  const handleExport = () => {
    const exportData = filteredLogs.map((log) => ({
      fecha: format(new Date(log.timestamp), "yyyy-MM-dd"),
      hora: format(new Date(log.timestamp), "HH:mm:ss"),
      accion: ACTION_LABELS[log.action],
      tipo_recurso: log.resource_type === "asset" ? "Activo" : "Licencia",
      id_recurso: log.resource_id,
      usuario: log.by_user?.name || log.by_user_id,
      detalles: log.metadata ? JSON.stringify(log.metadata) : "",
    }));

    exportToCSV(
      exportData,
      [
        { key: "fecha", label: "Fecha" },
        { key: "hora", label: "Hora" },
        { key: "accion", label: "Acción" },
        { key: "tipo_recurso", label: "Tipo Recurso" },
        { key: "id_recurso", label: "ID Recurso" },
        { key: "usuario", label: "Usuario" },
        { key: "detalles", label: "Detalles" },
      ],
      "audit_log"
    );
  };

  const getResourceIcon = (type: string) => {
    return type === "asset" ? <Package className="w-4 h-4" /> : <Key className="w-4 h-4" />;
  };

  if (loading) {
    return (
      <Card className="shadow-soft">
        <CardHeader>
          <Skeleton className="h-6 w-48" />
        </CardHeader>
        <CardContent>
          <div className="space-y-4">
            <div className="flex gap-2">
              <Skeleton className="h-10 w-[200px]" />
              <Skeleton className="h-10 w-[150px]" />
              <Skeleton className="h-10 w-[150px]" />
            </div>
            {[1, 2, 3, 4, 5].map((i) => (
              <Skeleton key={i} className="h-12 w-full" />
            ))}
          </div>
        </CardContent>
      </Card>
    );
  }

  return (
    <Card className="shadow-soft">
      <CardHeader>
        <div className="flex items-center justify-between flex-wrap gap-4">
          <CardTitle className="text-lg flex items-center gap-2">
            <FileText className="w-5 h-5" />
            Registro de Auditoría
          </CardTitle>
          <Button variant="outline" onClick={handleExport} disabled={filteredLogs.length === 0}>
            <Download className="w-4 h-4 mr-2" />
            Exportar CSV
          </Button>
        </div>
      </CardHeader>
      <CardContent>
        {/* Filters */}
        <div className="flex flex-wrap gap-3 mb-6">
          <div className="relative flex-1 min-w-[200px]">
            <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-muted-foreground" />
            <Input
              placeholder="Buscar por usuario o ID..."
              value={searchQuery}
              onChange={(e) => {
                setSearchQuery(e.target.value);
                setCurrentPage(1);
              }}
              className="pl-9"
            />
          </div>
          <Select value={dateFilter} onValueChange={(v) => { setDateFilter(v as DateFilter); setCurrentPage(1); }}>
            <SelectTrigger className="w-[140px]">
              <SelectValue placeholder="Periodo" />
            </SelectTrigger>
            <SelectContent>
              <SelectItem value="7">Últimos 7 días</SelectItem>
              <SelectItem value="30">Últimos 30 días</SelectItem>
              <SelectItem value="90">Últimos 90 días</SelectItem>
              <SelectItem value="all">Todo</SelectItem>
            </SelectContent>
          </Select>
          <Select value={actionFilter} onValueChange={(v) => { setActionFilter(v as ActionFilter); setCurrentPage(1); }}>
            <SelectTrigger className="w-[150px]">
              <SelectValue placeholder="Acción" />
            </SelectTrigger>
            <SelectContent>
              <SelectItem value="all">Todas las acciones</SelectItem>
              <SelectItem value="check_out">Asignación</SelectItem>
              <SelectItem value="check_in">Devolución</SelectItem>
              <SelectItem value="create">Creación</SelectItem>
              <SelectItem value="edit">Edición</SelectItem>
              <SelectItem value="retire">Retiro</SelectItem>
              <SelectItem value="assign_override">Reasignación</SelectItem>
            </SelectContent>
          </Select>
          <Select value={resourceFilter} onValueChange={(v) => { setResourceFilter(v as ResourceFilter); setCurrentPage(1); }}>
            <SelectTrigger className="w-[150px]">
              <SelectValue placeholder="Recurso" />
            </SelectTrigger>
            <SelectContent>
              <SelectItem value="all">Todos</SelectItem>
              <SelectItem value="asset">Activos</SelectItem>
              <SelectItem value="license">Licencias</SelectItem>
            </SelectContent>
          </Select>
        </div>

        {/* Results count */}
        <p className="text-sm text-muted-foreground mb-4">
          {filteredLogs.length} {filteredLogs.length === 1 ? "registro" : "registros"} encontrados
        </p>

        {/* Table */}
        {filteredLogs.length === 0 ? (
          <div className="text-center py-12 text-muted-foreground">
            <FileText className="w-12 h-12 mx-auto mb-2 opacity-50" />
            <p>No hay registros de auditoría</p>
          </div>
        ) : (
          <>
            <div className="rounded-md border overflow-hidden">
              <Table>
                <TableHeader>
                  <TableRow>
                    <TableHead className="w-[40px]"></TableHead>
                    <TableHead>Fecha</TableHead>
                    <TableHead>Acción</TableHead>
                    <TableHead>Recurso</TableHead>
                    <TableHead>Usuario</TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {paginatedLogs.map((log) => (
                    <Collapsible key={log.id} asChild>
                      <>
                        <TableRow className="cursor-pointer hover:bg-muted/50" onClick={() => toggleRow(log.id)}>
                          <TableCell>
                            <CollapsibleTrigger asChild>
                              <Button variant="ghost" size="icon" className="h-6 w-6">
                                {expandedRows.has(log.id) ? (
                                  <ChevronUp className="w-4 h-4" />
                                ) : (
                                  <ChevronDown className="w-4 h-4" />
                                )}
                              </Button>
                            </CollapsibleTrigger>
                          </TableCell>
                          <TableCell>
                            <div>
                              <p className="font-medium">
                                {format(new Date(log.timestamp), "d MMM yyyy", { locale: es })}
                              </p>
                              <p className="text-xs text-muted-foreground">
                                {format(new Date(log.timestamp), "HH:mm:ss")}
                              </p>
                            </div>
                          </TableCell>
                          <TableCell>
                            <Badge className={ACTION_COLORS[log.action]}>
                              {ACTION_LABELS[log.action]}
                            </Badge>
                          </TableCell>
                          <TableCell>
                            <div className="flex items-center gap-2">
                              {getResourceIcon(log.resource_type)}
                              <span className="capitalize">{log.resource_type === "asset" ? "Activo" : "Licencia"}</span>
                            </div>
                          </TableCell>
                          <TableCell>
                            <div className="flex items-center gap-2">
                              <User className="w-4 h-4 text-muted-foreground" />
                              <span>{log.by_user?.name || "Usuario desconocido"}</span>
                            </div>
                          </TableCell>
                        </TableRow>
                        <CollapsibleContent asChild>
                          <TableRow className="bg-muted/30">
                            <TableCell colSpan={5} className="p-4">
                              <div className="grid grid-cols-1 md:grid-cols-2 gap-4 text-sm">
                                <div>
                                  <p className="text-muted-foreground mb-1">ID del Recurso</p>
                                  <code className="text-xs bg-muted px-2 py-1 rounded">
                                    {log.resource_id}
                                  </code>
                                </div>
                                {log.to_user && (
                                  <div>
                                    <p className="text-muted-foreground mb-1">Asignado a</p>
                                    <p>{log.to_user.name} ({log.to_user.email})</p>
                                  </div>
                                )}
                                {log.metadata && Object.keys(log.metadata).length > 0 && (
                                  <div className="md:col-span-2">
                                    <p className="text-muted-foreground mb-1">Detalles</p>
                                    <pre className="text-xs bg-muted p-2 rounded overflow-x-auto">
                                      {JSON.stringify(log.metadata, null, 2)}
                                    </pre>
                                  </div>
                                )}
                              </div>
                            </TableCell>
                          </TableRow>
                        </CollapsibleContent>
                      </>
                    </Collapsible>
                  ))}
                </TableBody>
              </Table>
            </div>

            {/* Pagination */}
            {totalPages > 1 && (
              <div className="flex items-center justify-between mt-4">
                <p className="text-sm text-muted-foreground">
                  Página {currentPage} de {totalPages}
                </p>
                <div className="flex gap-2">
                  <Button
                    variant="outline"
                    size="sm"
                    onClick={() => setCurrentPage((p) => Math.max(1, p - 1))}
                    disabled={currentPage === 1}
                  >
                    Anterior
                  </Button>
                  <Button
                    variant="outline"
                    size="sm"
                    onClick={() => setCurrentPage((p) => Math.min(totalPages, p + 1))}
                    disabled={currentPage === totalPages}
                  >
                    Siguiente
                  </Button>
                </div>
              </div>
            )}
          </>
        )}
      </CardContent>
    </Card>
  );
}
