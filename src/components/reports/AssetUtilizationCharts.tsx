import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { ChartContainer, ChartTooltip, ChartTooltipContent, ChartLegend, ChartLegendContent } from "@/components/ui/chart";
import { PieChart, Pie, Cell, BarChart, Bar, XAxis, YAxis, ResponsiveContainer } from "recharts";
import { Skeleton } from "@/components/ui/skeleton";

interface StatusData {
  name: string;
  value: number;
  color: string;
}

interface CategoryData {
  category: string;
  count: number;
}

interface AssetUtilizationChartsProps {
  assetsByStatus: StatusData[];
  assetsByCategory: CategoryData[];
  licensesByStatus: StatusData[];
  licensesByProduct: { product: string; count: number }[];
  loading?: boolean;
}

const STATUS_COLORS: Record<string, string> = {
  available: "hsl(142, 76%, 36%)",
  assigned: "hsl(221, 83%, 53%)",
  maintenance: "hsl(45, 93%, 47%)",
  retired: "hsl(220, 9%, 46%)",
  expired: "hsl(0, 84%, 60%)",
};

const STATUS_LABELS: Record<string, string> = {
  available: "Disponible",
  assigned: "Asignado",
  maintenance: "Mantenimiento",
  retired: "Retirado",
  expired: "Expirado",
};

const CATEGORY_LABELS: Record<string, string> = {
  laptop: "Laptop",
  monitor: "Monitor",
  dock: "Dock",
  peripheral: "Periférico",
  other: "Otro",
};

const PRODUCT_LABELS: Record<string, string> = {
  adobe_cc: "Adobe CC",
  jetbrains: "JetBrains",
  office_365: "Office 365",
  github: "GitHub",
  other: "Otro",
};

const PRODUCT_COLORS = [
  "hsl(221, 83%, 53%)",
  "hsl(280, 70%, 50%)",
  "hsl(142, 76%, 36%)",
  "hsl(0, 0%, 20%)",
  "hsl(220, 9%, 46%)",
];

const CATEGORY_COLORS = [
  "hsl(221, 83%, 53%)",
  "hsl(280, 70%, 50%)",
  "hsl(45, 93%, 47%)",
  "hsl(142, 76%, 36%)",
  "hsl(220, 9%, 46%)",
];

const assetStatusConfig = {
  available: { label: "Disponible", color: STATUS_COLORS.available },
  assigned: { label: "Asignado", color: STATUS_COLORS.assigned },
  maintenance: { label: "Mantenimiento", color: STATUS_COLORS.maintenance },
  retired: { label: "Retirado", color: STATUS_COLORS.retired },
};

const licenseStatusConfig = {
  available: { label: "Disponible", color: STATUS_COLORS.available },
  assigned: { label: "Asignado", color: STATUS_COLORS.assigned },
  expired: { label: "Expirado", color: STATUS_COLORS.expired },
};

export function AssetUtilizationCharts({
  assetsByStatus,
  assetsByCategory,
  licensesByStatus,
  licensesByProduct,
  loading,
}: AssetUtilizationChartsProps) {
  if (loading) {
    return (
      <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
        {[1, 2, 3, 4].map((i) => (
          <Card key={i} className="shadow-soft">
            <CardHeader>
              <Skeleton className="h-6 w-40" />
            </CardHeader>
            <CardContent>
              <Skeleton className="h-[250px] w-full" />
            </CardContent>
          </Card>
        ))}
      </div>
    );
  }

  const categoryData = assetsByCategory.map((item, index) => ({
    ...item,
    label: CATEGORY_LABELS[item.category] || item.category,
    fill: CATEGORY_COLORS[index % CATEGORY_COLORS.length],
  }));

  const productData = licensesByProduct.map((item, index) => ({
    ...item,
    label: PRODUCT_LABELS[item.product] || item.product,
    fill: PRODUCT_COLORS[index % PRODUCT_COLORS.length],
  }));

  return (
    <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
      {/* Asset Status Pie Chart */}
      <Card className="shadow-soft">
        <CardHeader>
          <CardTitle className="text-lg">Estado de Activos</CardTitle>
        </CardHeader>
        <CardContent>
          {assetsByStatus.length === 0 ? (
            <div className="h-[250px] flex items-center justify-center text-muted-foreground">
              No hay datos de activos
            </div>
          ) : (
            <ChartContainer config={assetStatusConfig} className="h-[250px]">
              <PieChart>
                <ChartTooltip content={<ChartTooltipContent />} />
                <Pie
                  data={assetsByStatus.map(s => ({ ...s, label: STATUS_LABELS[s.name] || s.name }))}
                  dataKey="value"
                  nameKey="label"
                  cx="50%"
                  cy="50%"
                  innerRadius={50}
                  outerRadius={80}
                  paddingAngle={2}
                >
                  {assetsByStatus.map((entry, index) => (
                    <Cell key={`cell-${index}`} fill={entry.color} />
                  ))}
                </Pie>
                <ChartLegend content={<ChartLegendContent nameKey="label" />} />
              </PieChart>
            </ChartContainer>
          )}
        </CardContent>
      </Card>

      {/* Asset Categories Bar Chart */}
      <Card className="shadow-soft">
        <CardHeader>
          <CardTitle className="text-lg">Activos por Categoría</CardTitle>
        </CardHeader>
        <CardContent>
          {categoryData.length === 0 ? (
            <div className="h-[250px] flex items-center justify-center text-muted-foreground">
              No hay datos de categorías
            </div>
          ) : (
            <div className="h-[250px]">
              <ResponsiveContainer width="100%" height="100%">
                <BarChart data={categoryData} layout="vertical" margin={{ left: 20, right: 20 }}>
                  <XAxis type="number" hide />
                  <YAxis type="category" dataKey="label" width={100} tick={{ fontSize: 12 }} />
                  <ChartTooltip 
                    content={({ active, payload }) => {
                      if (!active || !payload?.length) return null;
                      return (
                        <div className="rounded-lg border bg-background px-3 py-2 shadow-sm">
                          <p className="font-medium">{payload[0].payload.label}</p>
                          <p className="text-sm text-muted-foreground">{payload[0].value} activos</p>
                        </div>
                      );
                    }}
                  />
                  <Bar dataKey="count" radius={[0, 4, 4, 0]}>
                    {categoryData.map((entry, index) => (
                      <Cell key={`cell-${index}`} fill={entry.fill} />
                    ))}
                  </Bar>
                </BarChart>
              </ResponsiveContainer>
            </div>
          )}
        </CardContent>
      </Card>

      {/* License Status Pie Chart */}
      <Card className="shadow-soft">
        <CardHeader>
          <CardTitle className="text-lg">Estado de Licencias</CardTitle>
        </CardHeader>
        <CardContent>
          {licensesByStatus.length === 0 ? (
            <div className="h-[250px] flex items-center justify-center text-muted-foreground">
              No hay datos de licencias
            </div>
          ) : (
            <ChartContainer config={licenseStatusConfig} className="h-[250px]">
              <PieChart>
                <ChartTooltip content={<ChartTooltipContent />} />
                <Pie
                  data={licensesByStatus.map(s => ({ ...s, label: STATUS_LABELS[s.name] || s.name }))}
                  dataKey="value"
                  nameKey="label"
                  cx="50%"
                  cy="50%"
                  innerRadius={50}
                  outerRadius={80}
                  paddingAngle={2}
                >
                  {licensesByStatus.map((entry, index) => (
                    <Cell key={`cell-${index}`} fill={entry.color} />
                  ))}
                </Pie>
                <ChartLegend content={<ChartLegendContent nameKey="label" />} />
              </PieChart>
            </ChartContainer>
          )}
        </CardContent>
      </Card>

      {/* License Products Bar Chart */}
      <Card className="shadow-soft">
        <CardHeader>
          <CardTitle className="text-lg">Licencias por Producto</CardTitle>
        </CardHeader>
        <CardContent>
          {productData.length === 0 ? (
            <div className="h-[250px] flex items-center justify-center text-muted-foreground">
              No hay datos de productos
            </div>
          ) : (
            <div className="h-[250px]">
              <ResponsiveContainer width="100%" height="100%">
                <BarChart data={productData} layout="vertical" margin={{ left: 20, right: 20 }}>
                  <XAxis type="number" hide />
                  <YAxis type="category" dataKey="label" width={100} tick={{ fontSize: 12 }} />
                  <ChartTooltip 
                    content={({ active, payload }) => {
                      if (!active || !payload?.length) return null;
                      return (
                        <div className="rounded-lg border bg-background px-3 py-2 shadow-sm">
                          <p className="font-medium">{payload[0].payload.label}</p>
                          <p className="text-sm text-muted-foreground">{payload[0].value} licencias</p>
                        </div>
                      );
                    }}
                  />
                  <Bar dataKey="count" radius={[0, 4, 4, 0]}>
                    {productData.map((entry, index) => (
                      <Cell key={`cell-${index}`} fill={entry.fill} />
                    ))}
                  </Bar>
                </BarChart>
              </ResponsiveContainer>
            </div>
          )}
        </CardContent>
      </Card>
    </div>
  );
}
