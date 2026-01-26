import { useState, useMemo } from "react";
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from "@/components/ui/card";
import { Calendar } from "@/components/ui/calendar";
import { Badge } from "@/components/ui/badge";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Skeleton } from "@/components/ui/skeleton";
import { Key, AlertTriangle, Clock } from "lucide-react";
import { format, isSameDay, isAfter, isBefore, addDays, startOfDay } from "date-fns";
import { es } from "date-fns/locale";

interface License {
  id: string;
  product: string;
  expires_at: string;
  status: string;
}

interface LicenseExpirationCalendarProps {
  licenses: License[];
  loading?: boolean;
  onLicenseClick?: (id: string) => void;
}

const PRODUCT_LABELS: Record<string, string> = {
  adobe_cc: "Adobe CC",
  jetbrains: "JetBrains",
  office_365: "Office 365",
  github: "GitHub",
  other: "Otro",
};

type FilterPeriod = "30" | "60" | "90" | "all";

export function LicenseExpirationCalendar({
  licenses,
  loading,
  onLicenseClick,
}: LicenseExpirationCalendarProps) {
  const [selectedDate, setSelectedDate] = useState<Date | undefined>(undefined);
  const [filterPeriod, setFilterPeriod] = useState<FilterPeriod>("30");
  const today = startOfDay(new Date());

  // Group licenses by expiration date
  const licensesByDate = useMemo(() => {
    const map = new Map<string, License[]>();
    licenses.forEach((license) => {
      if (license.expires_at) {
        const dateKey = format(new Date(license.expires_at), "yyyy-MM-dd");
        const existing = map.get(dateKey) || [];
        map.set(dateKey, [...existing, license]);
      }
    });
    return map;
  }, [licenses]);

  // Filter licenses for list view
  const filteredLicenses = useMemo(() => {
    const periodDays = filterPeriod === "all" ? Infinity : parseInt(filterPeriod);
    const cutoffDate = periodDays === Infinity ? null : addDays(today, periodDays);
    
    return licenses
      .filter((l) => {
        if (!l.expires_at) return false;
        const expiryDate = new Date(l.expires_at);
        if (cutoffDate && isAfter(expiryDate, cutoffDate)) return false;
        return true;
      })
      .sort((a, b) => new Date(a.expires_at!).getTime() - new Date(b.expires_at!).getTime());
  }, [licenses, filterPeriod, today]);

  // Licenses for selected date
  const selectedDateLicenses = useMemo(() => {
    if (!selectedDate) return [];
    const dateKey = format(selectedDate, "yyyy-MM-dd");
    return licensesByDate.get(dateKey) || [];
  }, [selectedDate, licensesByDate]);

  // Get expiry status for a license
  const getExpiryStatus = (expiryDate: Date) => {
    if (isBefore(expiryDate, today)) {
      return { label: "Expirada", color: "bg-red-500/10 text-red-700 dark:text-red-400", icon: AlertTriangle };
    }
    if (isSameDay(expiryDate, today)) {
      return { label: "Expira hoy", color: "bg-red-500/10 text-red-700 dark:text-red-400", icon: AlertTriangle };
    }
    if (isBefore(expiryDate, addDays(today, 7))) {
      return { label: "Esta semana", color: "bg-orange-500/10 text-orange-700 dark:text-orange-400", icon: Clock };
    }
    if (isBefore(expiryDate, addDays(today, 30))) {
      return { label: "Este mes", color: "bg-yellow-500/10 text-yellow-700 dark:text-yellow-400", icon: Clock };
    }
    return { label: "Vigente", color: "bg-green-500/10 text-green-700 dark:text-green-400", icon: Key };
  };

  // Custom day renderer to show indicators
  const modifiers = useMemo(() => {
    const expired: Date[] = [];
    const expiringSoon: Date[] = [];
    const expiringThisMonth: Date[] = [];

    licenses.forEach((license) => {
      if (!license.expires_at) return;
      const expiryDate = startOfDay(new Date(license.expires_at));
      
      if (isBefore(expiryDate, today) || isSameDay(expiryDate, today)) {
        expired.push(expiryDate);
      } else if (isBefore(expiryDate, addDays(today, 7))) {
        expiringSoon.push(expiryDate);
      } else if (isBefore(expiryDate, addDays(today, 30))) {
        expiringThisMonth.push(expiryDate);
      }
    });

    return { expired, expiringSoon, expiringThisMonth };
  }, [licenses, today]);

  const modifiersStyles = {
    expired: {
      backgroundColor: "hsl(0, 84%, 60%, 0.2)",
      borderRadius: "50%",
    },
    expiringSoon: {
      backgroundColor: "hsl(25, 95%, 53%, 0.2)",
      borderRadius: "50%",
    },
    expiringThisMonth: {
      backgroundColor: "hsl(45, 93%, 47%, 0.2)",
      borderRadius: "50%",
    },
  };

  if (loading) {
    return (
      <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
        <Card className="shadow-soft">
          <CardHeader>
            <Skeleton className="h-6 w-48" />
          </CardHeader>
          <CardContent>
            <Skeleton className="h-[300px] w-full" />
          </CardContent>
        </Card>
        <Card className="shadow-soft">
          <CardHeader>
            <Skeleton className="h-6 w-48" />
          </CardHeader>
          <CardContent>
            <div className="space-y-3">
              {[1, 2, 3, 4].map((i) => (
                <Skeleton key={i} className="h-16 w-full" />
              ))}
            </div>
          </CardContent>
        </Card>
      </div>
    );
  }

  return (
    <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
      {/* Calendar */}
      <Card className="shadow-soft">
        <CardHeader>
          <CardTitle className="text-lg">Calendario de Vencimientos</CardTitle>
          <CardDescription>
            Haz clic en un día para ver las licencias que expiran
          </CardDescription>
        </CardHeader>
        <CardContent>
          <div className="flex justify-center">
            <Calendar
              mode="single"
              selected={selectedDate}
              onSelect={setSelectedDate}
              locale={es}
              modifiers={modifiers}
              modifiersStyles={modifiersStyles}
              className="rounded-md border"
            />
          </div>
          <div className="flex flex-wrap gap-4 mt-4 justify-center text-sm">
            <div className="flex items-center gap-2">
              <div className="w-3 h-3 rounded-full bg-red-500/40" />
              <span className="text-muted-foreground">Expirada/Hoy</span>
            </div>
            <div className="flex items-center gap-2">
              <div className="w-3 h-3 rounded-full bg-orange-500/40" />
              <span className="text-muted-foreground">Esta semana</span>
            </div>
            <div className="flex items-center gap-2">
              <div className="w-3 h-3 rounded-full bg-yellow-500/40" />
              <span className="text-muted-foreground">Este mes</span>
            </div>
          </div>

          {/* Selected date licenses */}
          {selectedDate && (
            <div className="mt-4 border-t pt-4">
              <h4 className="font-medium mb-2">
                {format(selectedDate, "d 'de' MMMM, yyyy", { locale: es })}
              </h4>
              {selectedDateLicenses.length === 0 ? (
                <p className="text-sm text-muted-foreground">No hay licencias que expiren este día</p>
              ) : (
                <div className="space-y-2">
                  {selectedDateLicenses.map((license) => (
                    <div
                      key={license.id}
                      className="flex items-center justify-between p-2 rounded-lg bg-muted/50 cursor-pointer hover:bg-muted transition-colors"
                      onClick={() => onLicenseClick?.(license.id)}
                    >
                      <div className="flex items-center gap-2">
                        <Key className="w-4 h-4 text-muted-foreground" />
                        <span className="text-sm font-medium">
                          {PRODUCT_LABELS[license.product] || license.product}
                        </span>
                      </div>
                      <Badge className={getExpiryStatus(new Date(license.expires_at)).color}>
                        {getExpiryStatus(new Date(license.expires_at)).label}
                      </Badge>
                    </div>
                  ))}
                </div>
              )}
            </div>
          )}
        </CardContent>
      </Card>

      {/* Upcoming Expirations List */}
      <Card className="shadow-soft">
        <CardHeader>
          <div className="flex items-center justify-between flex-wrap gap-2">
            <CardTitle className="text-lg">Próximos Vencimientos</CardTitle>
            <Select value={filterPeriod} onValueChange={(v) => setFilterPeriod(v as FilterPeriod)}>
              <SelectTrigger className="w-[140px]">
                <SelectValue />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="30">30 días</SelectItem>
                <SelectItem value="60">60 días</SelectItem>
                <SelectItem value="90">90 días</SelectItem>
                <SelectItem value="all">Todos</SelectItem>
              </SelectContent>
            </Select>
          </div>
        </CardHeader>
        <CardContent>
          {filteredLicenses.length === 0 ? (
            <div className="text-center py-8 text-muted-foreground">
              <Key className="w-12 h-12 mx-auto mb-2 opacity-50" />
              <p>No hay licencias próximas a vencer</p>
            </div>
          ) : (
            <div className="space-y-3 max-h-[400px] overflow-y-auto pr-2">
              {filteredLicenses.map((license) => {
                const expiryDate = new Date(license.expires_at!);
                const status = getExpiryStatus(expiryDate);
                const StatusIcon = status.icon;
                
                return (
                  <div
                    key={license.id}
                    className="flex items-center justify-between p-3 rounded-lg border hover:border-primary/50 transition-colors cursor-pointer"
                    onClick={() => onLicenseClick?.(license.id)}
                  >
                    <div className="flex items-center gap-3">
                      <div className={`p-2 rounded-lg ${status.color}`}>
                        <StatusIcon className="w-4 h-4" />
                      </div>
                      <div>
                        <p className="font-medium">
                          {PRODUCT_LABELS[license.product] || license.product}
                        </p>
                        <p className="text-sm text-muted-foreground">
                          {format(expiryDate, "d 'de' MMMM, yyyy", { locale: es })}
                        </p>
                      </div>
                    </div>
                    <Badge className={status.color}>{status.label}</Badge>
                  </div>
                );
              })}
            </div>
          )}
        </CardContent>
      </Card>
    </div>
  );
}
