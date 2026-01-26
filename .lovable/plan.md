
# Reports Dashboard with Analytics, Calendar & Audit Logs

## Overview
Create a comprehensive reports dashboard for organization admins that provides visual insights into asset utilization, a calendar view of license expirations, and a searchable/exportable audit log. This feature will be gated behind the `auditLog` feature flag (available on Pro and Enterprise plans).

## Current State Analysis
- Dashboard shows basic KPI cards (total assets, assigned, available, licenses)
- No visualization charts for asset utilization trends
- No calendar view for license expirations
- Audit log exists in database but no UI to view it
- `hasFeature('auditLog')` check already exists in SubscriptionContext
- Recharts library is already installed and chart components exist
- Calendar component (react-day-picker) is already available

## Architecture

```text
Reports Page (/reports)
+-------------------------------------------------------------+
|  [Header with navigation]                                   |
+-------------------------------------------------------------+
|                                                             |
|  +------------------------+  +----------------------------+ |
|  | Asset Utilization      |  | Asset Distribution         | |
|  | [Pie Chart]            |  | [Bar Chart by Category]    | |
|  | - Available: X         |  |                            | |
|  | - Assigned: X          |  |                            | |
|  | - Maintenance: X       |  |                            | |
|  | - Retired: X           |  |                            | |
|  +------------------------+  +----------------------------+ |
|                                                             |
|  +--------------------------------------------------------+ |
|  | License Expiration Calendar                             | |
|  | [Calendar with colored indicators for expiring licenses]| |
|  | [List of licenses expiring in selected period]         | |
|  +--------------------------------------------------------+ |
|                                                             |
|  +--------------------------------------------------------+ |
|  | Audit Log                                               | |
|  | [Filters: Date Range, Action Type, Resource Type]       | |
|  | [Search bar]                                            | |
|  | [Table with logs]                                       | |
|  | [Export CSV button]                                     | |
|  +--------------------------------------------------------+ |
|                                                             |
+-------------------------------------------------------------+
```

## Implementation Plan

### Phase 1: Reports Page Structure

Create `src/pages/Reports.tsx` as the main container:
- Route: `/reports`
- Admin-only access (redirect non-admins)
- Feature-gated: Show upgrade prompt if `!hasFeature('auditLog')`
- Tabbed interface with three sections:
  1. Overview (charts)
  2. License Calendar
  3. Audit Log

### Phase 2: Asset Utilization Charts

**Data queries:**
- Count assets by status (available, assigned, maintenance, retired)
- Count assets by category (laptop, monitor, dock, peripheral, other)
- Count licenses by status and product type

**Chart Components:**

| Chart | Type | Data |
|-------|------|------|
| Asset Status | Pie/Donut | Breakdown by status |
| Asset Categories | Bar | Count per category |
| License Products | Pie | Distribution by product |
| License Status | Donut | Available/Assigned/Expired |

Using existing Recharts components:
- `PieChart` with `ChartContainer` and `ChartTooltip`
- `BarChart` for category distribution
- Custom colors matching the app theme

### Phase 3: License Expiration Calendar

**Features:**
- Calendar view using react-day-picker (already installed)
- Visual indicators for days with expiring licenses:
  - Red dot: Expired or expiring today
  - Orange dot: Expiring within 7 days
  - Yellow dot: Expiring within 30 days
- Click on a day to see licenses expiring on that date
- List view of upcoming expirations (next 30/60/90 days)

**Data query:**
- Fetch all licenses with `expires_at` not null
- Group by expiration date for calendar display
- Sort by expiration date for list view

### Phase 4: Audit Log Viewer

**Table columns:**
| Column | Source |
|--------|--------|
| Fecha | timestamp |
| Accion | action (translated) |
| Recurso | resource_type + name from join |
| Usuario | by_user_id (join to profiles) |
| Detalles | metadata (formatted) |

**Filters:**
- Date range picker (last 7 days, 30 days, 90 days, custom)
- Action type dropdown (check_out, check_in, create, edit, retire, assign_override)
- Resource type (asset, license)
- Search by user name or resource name

**Export:**
- CSV export button
- Includes all filtered results
- Format: Date, Action, Resource Type, Resource Name, User, Details

### Phase 5: Export Functionality

Create `src/lib/exportCsv.ts`:
- Function to convert array of objects to CSV string
- Handle special characters and commas in fields
- Trigger browser download with timestamp in filename

**Audit Log CSV columns:**
```csv
Fecha,Hora,Accion,Tipo Recurso,ID Recurso,Usuario,Detalles
2025-10-01,04:35:48,check_out,asset,abb572e9...,John Doe,"{old_status: available}"
```

## Files to Create

| File | Description |
|------|-------------|
| `src/pages/Reports.tsx` | Main reports page with tabs |
| `src/components/reports/AssetUtilizationCharts.tsx` | Pie and bar charts for assets |
| `src/components/reports/LicenseExpirationCalendar.tsx` | Calendar with expiration markers |
| `src/components/reports/AuditLogViewer.tsx` | Filterable table with export |
| `src/lib/exportCsv.ts` | CSV export utility function |

## Files to Modify

| File | Changes |
|------|---------|
| `src/App.tsx` | Add `/reports` route |
| `src/pages/Dashboard.tsx` | Add "Reports" button for admins |

## Route Configuration

| Route | Component | Access |
|-------|-----------|--------|
| `/reports` | Reports | Admin only, Feature-gated |

## Feature Gating Logic

```typescript
// In Reports.tsx
const { hasFeature } = useSubscription();

if (!hasFeature('auditLog')) {
  return <UpgradePrompt limitType="feature" featureName="Reportes y Auditoria" />;
}
```

## Data Queries

### Asset Utilization
```typescript
// Count by status
const { data: statusCounts } = await supabase
  .from("assets")
  .select("status")
  .eq("organization_id", orgId);

// Group and count in JS
const statusData = Object.entries(
  statusCounts.reduce((acc, a) => {
    acc[a.status] = (acc[a.status] || 0) + 1;
    return acc;
  }, {})
);
```

### License Expirations
```typescript
const { data: licenses } = await supabase
  .from("licenses")
  .select("id, product, expires_at, status")
  .eq("organization_id", orgId)
  .not("expires_at", "is", null)
  .order("expires_at", { ascending: true });
```

### Audit Log with Joins
```typescript
const { data: logs } = await supabase
  .from("audit_log")
  .select(`
    *,
    by_user:profiles!audit_log_by_user_id_fkey(name, email),
    to_user:profiles!audit_log_to_user_id_fkey(name, email)
  `)
  .eq("organization_id", orgId)
  .gte("timestamp", dateFrom)
  .lte("timestamp", dateTo)
  .order("timestamp", { ascending: false })
  .limit(100);
```

## UI/UX Details

### Chart Colors (matching app theme)
- Available: `hsl(142, 76%, 36%)` (green)
- Assigned: `hsl(221, 83%, 53%)` (blue)
- Maintenance: `hsl(45, 93%, 47%)` (yellow)
- Retired: `hsl(220, 9%, 46%)` (gray)
- Expired: `hsl(0, 84%, 60%)` (red)

### Calendar Styling
- Dot indicators below date numbers
- Tooltip on hover showing count of expiring licenses
- Click to expand list of licenses for that date

### Audit Log Table
- Striped rows for readability
- Collapsible metadata details
- Pagination (25 per page)
- Loading skeleton while fetching

### Mobile Responsiveness
- Charts stack vertically on mobile
- Calendar uses compact view
- Audit log becomes card-based on small screens

## Action Translation Map

```typescript
const ACTION_LABELS: Record<string, string> = {
  check_out: "Asignacion",
  check_in: "Devolucion",
  create: "Creacion",
  edit: "Edicion",
  retire: "Retiro",
  assign_override: "Reasignacion",
};
```

## Summary

This implementation adds a comprehensive Reports dashboard that:
1. Visualizes asset and license utilization with interactive charts
2. Provides a calendar view to track license expirations proactively
3. Enables admins to view, filter, and export the complete audit trail
4. Is properly gated behind the Pro/Enterprise subscription tier
5. Follows existing UI patterns and uses already-installed dependencies
