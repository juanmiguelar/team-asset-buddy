import { useState, useRef } from "react";
import { useOrganization } from "@/contexts/OrganizationContext";
import { useSubscription } from "@/contexts/SubscriptionContext";
import { useAuth } from "@/contexts/AuthContext";
import { supabase } from "@/integrations/supabase/client";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogHeader,
  DialogTitle,
  DialogTrigger,
} from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { Textarea } from "@/components/ui/textarea";
import { Label } from "@/components/ui/label";
import { Badge } from "@/components/ui/badge";
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { Upload, FileText, AlertCircle, CheckCircle2, Loader2, Crown } from "lucide-react";
import { toast } from "sonner";
import { useUpgradePrompt } from "@/components/UpgradePrompt";

type ResourceType = "assets" | "licenses";

interface ParsedAsset {
  name: string;
  category: string;
  serial_number: string;
  location: string;
  notes: string;
  valid: boolean;
  error?: string;
}

interface ParsedLicense {
  product: string;
  seat_key_full: string;
  expires_at: string;
  notes: string;
  valid: boolean;
  error?: string;
}

const validAssetCategories = ["laptop", "monitor", "dock", "peripheral", "other"];
const validLicenseProducts = ["adobe_cc", "jetbrains", "office_365", "github", "other"];

function generateMaskedKey(fullKey: string): string {
  if (fullKey.length <= 4) return "****";
  const lastFour = fullKey.slice(-4);
  return `****-****-****-${lastFour}`;
}

function parseCSV(csvText: string): string[][] {
  const lines = csvText.trim().split("\n");
  return lines.map((line) => {
    const result: string[] = [];
    let current = "";
    let inQuotes = false;

    for (let i = 0; i < line.length; i++) {
      const char = line[i];
      if (char === '"') {
        inQuotes = !inQuotes;
      } else if (char === "," && !inQuotes) {
        result.push(current.trim());
        current = "";
      } else {
        current += char;
      }
    }
    result.push(current.trim());
    return result;
  });
}

function parseAssets(rows: string[][]): ParsedAsset[] {
  // Skip header row
  return rows.slice(1).map((row) => {
    const [name, category, serial_number, location, notes] = row;
    const errors: string[] = [];

    if (!name || name.length === 0) errors.push("Nombre requerido");
    if (name && name.length > 255) errors.push("Nombre muy largo");
    if (!validAssetCategories.includes(category?.toLowerCase())) {
      errors.push(`Categoría inválida: ${category}`);
    }

    return {
      name: name || "",
      category: category?.toLowerCase() || "",
      serial_number: serial_number || "",
      location: location || "",
      notes: notes || "",
      valid: errors.length === 0,
      error: errors.join(", "),
    };
  });
}

function parseLicenses(rows: string[][]): ParsedLicense[] {
  // Skip header row
  return rows.slice(1).map((row) => {
    const [product, seat_key_full, expires_at, notes] = row;
    const errors: string[] = [];

    if (!validLicenseProducts.includes(product?.toLowerCase())) {
      errors.push(`Producto inválido: ${product}`);
    }
    if (!seat_key_full || seat_key_full.length === 0) {
      errors.push("Clave de licencia requerida");
    }
    if (expires_at && !/^\d{4}-\d{2}-\d{2}$/.test(expires_at)) {
      errors.push("Formato de fecha inválido (usar YYYY-MM-DD)");
    }

    return {
      product: product?.toLowerCase() || "",
      seat_key_full: seat_key_full || "",
      expires_at: expires_at || "",
      notes: notes || "",
      valid: errors.length === 0,
      error: errors.join(", "),
    };
  });
}

interface BulkImportDialogProps {
  trigger: React.ReactNode;
  onImportComplete?: () => void;
}

export function BulkImportDialog({ trigger, onImportComplete }: BulkImportDialogProps) {
  const { currentOrganization } = useOrganization();
  const { hasFeature, refreshSubscription } = useSubscription();
  const { showUpgradePrompt, UpgradePromptDialog } = useUpgradePrompt();
  const { user } = useAuth();
  const [open, setOpen] = useState(false);
  const [resourceType, setResourceType] = useState<ResourceType>("assets");
  const [csvContent, setCsvContent] = useState("");
  const [parsedAssets, setParsedAssets] = useState<ParsedAsset[]>([]);
  const [parsedLicenses, setParsedLicenses] = useState<ParsedLicense[]>([]);
  const [importing, setImporting] = useState(false);
  const [step, setStep] = useState<"input" | "preview" | "result">("input");
  const [importResult, setImportResult] = useState({ success: 0, errors: 0 });
  const fileInputRef = useRef<HTMLInputElement>(null);

  const handleOpenChange = (newOpen: boolean) => {
    if (newOpen && !hasFeature('bulkImport')) {
      showUpgradePrompt('feature', 'Importación CSV masiva');
      return;
    }
    setOpen(newOpen);
    if (!newOpen) reset();
  };

  const reset = () => {
    setCsvContent("");
    setParsedAssets([]);
    setParsedLicenses([]);
    setStep("input");
    setImportResult({ success: 0, errors: 0 });
  };

  const handleFileUpload = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;

    const reader = new FileReader();
    reader.onload = (event) => {
      setCsvContent(event.target?.result as string);
    };
    reader.readAsText(file);
  };

  const handlePreview = () => {
    if (!csvContent.trim()) {
      toast.error("Ingresa contenido CSV");
      return;
    }

    const rows = parseCSV(csvContent);
    if (rows.length < 2) {
      toast.error("El CSV debe tener al menos una fila de encabezado y una de datos");
      return;
    }

    if (resourceType === "assets") {
      setParsedAssets(parseAssets(rows));
    } else {
      setParsedLicenses(parseLicenses(rows));
    }
    setStep("preview");
  };

  const handleImport = async () => {
    if (!currentOrganization || !user) return;

    setImporting(true);
    let successCount = 0;
    let errorCount = 0;

    if (resourceType === "assets") {
      const validAssets = parsedAssets.filter((a) => a.valid);
      for (const asset of validAssets) {
        const tempId = crypto.randomUUID();
        const { error } = await supabase.from("assets").insert({
          qr_code: `asset:${tempId}`,
          name: asset.name,
          category: asset.category as any,
          serial_number: asset.serial_number || null,
          location: asset.location || null,
          notes: asset.notes || null,
          organization_id: currentOrganization.id,
        });

        if (error) {
          errorCount++;
        } else {
          successCount++;
        }
      }
    } else {
      const validLicenses = parsedLicenses.filter((l) => l.valid);
      for (const license of validLicenses) {
        const tempId = crypto.randomUUID();
        const { error } = await supabase.from("licenses").insert({
          qr_code: `license:${tempId}`,
          product: license.product as any,
          seat_key_full: license.seat_key_full,
          seat_key_masked: generateMaskedKey(license.seat_key_full),
          expires_at: license.expires_at || null,
          notes: license.notes || null,
          organization_id: currentOrganization.id,
        });

        if (error) {
          errorCount++;
        } else {
          successCount++;
        }
      }
    }

    setImportResult({ success: successCount, errors: errorCount });
    setStep("result");
    setImporting(false);

    if (successCount > 0) {
      await refreshSubscription(); // Refresh usage counts
      onImportComplete?.();
    }
  };

  const previewData = resourceType === "assets" ? parsedAssets : parsedLicenses;
  const validCount = previewData.filter((d) => d.valid).length;
  const invalidCount = previewData.filter((d) => !d.valid).length;

  return (
    <>
      <UpgradePromptDialog />
      <Dialog open={open} onOpenChange={handleOpenChange}>
        <DialogTrigger asChild>{trigger}</DialogTrigger>
        <DialogContent className="max-w-4xl max-h-[90vh] overflow-y-auto">
          <DialogHeader>
            <DialogTitle className="flex items-center gap-2">
              Importación Masiva
              <Badge variant="secondary" className="text-xs">
                <Crown className="w-3 h-3 mr-1" />
                Pro
              </Badge>
            </DialogTitle>
            <DialogDescription>
              Importa múltiples {resourceType === "assets" ? "activos" : "licencias"} desde un archivo CSV
            </DialogDescription>
          </DialogHeader>

          {step === "input" && (
            <div className="space-y-6">
              <div className="space-y-2">
                <Label>Tipo de Recurso</Label>
                <Select
                  value={resourceType}
                  onValueChange={(v) => setResourceType(v as ResourceType)}
                >
                  <SelectTrigger>
                    <SelectValue />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="assets">Activos</SelectItem>
                    <SelectItem value="licenses">Licencias</SelectItem>
                  </SelectContent>
                </Select>
              </div>

              <div className="p-4 bg-muted/50 rounded-lg text-sm">
                <p className="font-medium mb-2">Formato CSV esperado:</p>
                {resourceType === "assets" ? (
                  <code className="text-xs block bg-background p-2 rounded">
                    name,category,serial_number,location,notes<br />
                    MacBook Pro 14,laptop,C02XK123,Oficina A,Nuevo<br />
                    Dell Monitor 27,monitor,DELL456,Oficina B,
                  </code>
                ) : (
                  <code className="text-xs block bg-background p-2 rounded">
                    product,seat_key_full,expires_at,notes<br />
                    adobe_cc,XXXX-YYYY-ZZZZ-1234,2025-12-31,Licencia team<br />
                    office_365,ABCD-EFGH-IJKL-5678,,Personal
                  </code>
                )}
              </div>

              <div className="space-y-2">
                <Label>Archivo CSV o contenido</Label>
                <div className="flex gap-2">
                  <input
                    type="file"
                    accept=".csv"
                    ref={fileInputRef}
                    onChange={handleFileUpload}
                    className="hidden"
                  />
                  <Button
                    variant="outline"
                    onClick={() => fileInputRef.current?.click()}
                  >
                    <Upload className="w-4 h-4 mr-2" />
                    Subir archivo
                  </Button>
                </div>
                <Textarea
                  placeholder="O pega el contenido CSV aquí..."
                  value={csvContent}
                  onChange={(e) => setCsvContent(e.target.value)}
                  rows={8}
                  className="font-mono text-sm"
                />
              </div>

              <div className="flex justify-end gap-2">
                <Button variant="outline" onClick={() => setOpen(false)}>
                  Cancelar
                </Button>
                <Button onClick={handlePreview}>
                  <FileText className="w-4 h-4 mr-2" />
                  Vista Previa
                </Button>
              </div>
            </div>
          )}

          {step === "preview" && (
            <div className="space-y-6">
              <div className="flex items-center gap-4">
                <Badge variant="outline" className="text-green-600">
                  <CheckCircle2 className="w-3 h-3 mr-1" />
                  {validCount} válidos
                </Badge>
                {invalidCount > 0 && (
                  <Badge variant="outline" className="text-red-600">
                    <AlertCircle className="w-3 h-3 mr-1" />
                    {invalidCount} con errores
                  </Badge>
                )}
              </div>

              <div className="max-h-80 overflow-auto border rounded-lg">
                <Table>
                  <TableHeader>
                    <TableRow>
                      <TableHead className="w-12">Estado</TableHead>
                      {resourceType === "assets" ? (
                        <>
                          <TableHead>Nombre</TableHead>
                          <TableHead>Categoría</TableHead>
                          <TableHead>Serie</TableHead>
                          <TableHead>Ubicación</TableHead>
                        </>
                      ) : (
                        <>
                          <TableHead>Producto</TableHead>
                          <TableHead>Clave</TableHead>
                          <TableHead>Expira</TableHead>
                        </>
                      )}
                      <TableHead>Error</TableHead>
                    </TableRow>
                  </TableHeader>
                  <TableBody>
                    {(resourceType === "assets" ? parsedAssets : parsedLicenses).map(
                      (item, idx) => (
                        <TableRow key={idx} className={!item.valid ? "bg-red-50 dark:bg-red-950/20" : ""}>
                          <TableCell>
                            {item.valid ? (
                              <CheckCircle2 className="w-4 h-4 text-green-600" />
                            ) : (
                              <AlertCircle className="w-4 h-4 text-red-600" />
                            )}
                          </TableCell>
                          {resourceType === "assets" ? (
                            <>
                              <TableCell>{(item as ParsedAsset).name}</TableCell>
                              <TableCell>{(item as ParsedAsset).category}</TableCell>
                              <TableCell>{(item as ParsedAsset).serial_number}</TableCell>
                              <TableCell>{(item as ParsedAsset).location}</TableCell>
                            </>
                          ) : (
                            <>
                              <TableCell>{(item as ParsedLicense).product}</TableCell>
                              <TableCell className="font-mono text-xs">
                                {generateMaskedKey((item as ParsedLicense).seat_key_full)}
                              </TableCell>
                              <TableCell>{(item as ParsedLicense).expires_at}</TableCell>
                            </>
                          )}
                          <TableCell className="text-xs text-red-600">{item.error}</TableCell>
                        </TableRow>
                      )
                    )}
                  </TableBody>
                </Table>
              </div>

              <div className="flex justify-between">
                <Button variant="outline" onClick={() => setStep("input")}>
                  Volver
                </Button>
                <Button onClick={handleImport} disabled={validCount === 0 || importing}>
                  {importing ? (
                    <>
                      <Loader2 className="w-4 h-4 animate-spin mr-2" />
                      Importando...
                    </>
                  ) : (
                    <>
                      <Upload className="w-4 h-4 mr-2" />
                      Importar {validCount} {resourceType === "assets" ? "activos" : "licencias"}
                    </>
                  )}
                </Button>
              </div>
            </div>
          )}

          {step === "result" && (
            <div className="space-y-6 text-center py-8">
              <div className="w-16 h-16 rounded-full bg-green-100 dark:bg-green-900/30 flex items-center justify-center mx-auto">
                <CheckCircle2 className="w-8 h-8 text-green-600" />
              </div>
              <div>
                <h3 className="text-xl font-semibold mb-2">Importación Completada</h3>
                <p className="text-muted-foreground">
                  Se importaron {importResult.success} {resourceType === "assets" ? "activos" : "licencias"} correctamente
                  {importResult.errors > 0 && ` (${importResult.errors} con errores)`}
                </p>
              </div>
              <Button onClick={() => setOpen(false)}>Cerrar</Button>
            </div>
          )}
        </DialogContent>
      </Dialog>
    </>
  );
}
