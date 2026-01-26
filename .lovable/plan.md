

# Admin Panel for License/Asset Management

## Overview
Implement a complete admin management panel that enables organization admins to create, edit, and manage licenses and assets. This includes individual creation forms, edit capabilities, bulk CSV import, and archive/retire functionality.

## Current State Analysis
- Asset creation exists (`CreateAsset.tsx`) with basic form
- No license creation capability
- No edit functionality for assets or licenses
- Detail pages exist but are read-only
- Status management is limited to check-in/check-out

## Architecture

```text
Admin Dashboard
      |
      +-- Create Asset (exists)
      +-- Create License (NEW)
      +-- Bulk Import (NEW)
      |
Asset/License Detail Pages
      |
      +-- Edit Mode (NEW)
      +-- Status Management (NEW)
          +-- Archive/Retire
          +-- Set Maintenance
```

## Implementation Plan

### 1. Create License Page (`src/pages/CreateLicense.tsx`)

New page following the CreateAsset pattern with:

| Field | Type | Required | Notes |
|-------|------|----------|-------|
| Product | Select | Yes | adobe_cc, jetbrains, office_365, github, other |
| Full License Key | Password Input | Yes | Sensitive - shows masked after save |
| Expiration Date | Date Picker | No | Optional expiry |
| Notes | Textarea | No | Additional info |

**Key Logic:**
- Auto-generate `seat_key_masked` from full key (show last 4 characters)
- Generate QR code pattern: `license:{uuid}`
- Associate with current organization
- Create audit log entry on creation
- Admin-only access (redirect if not `isOrgAdmin`)

### 2. Edit Asset Page (`src/pages/EditAsset.tsx`)

Edit form that loads existing asset data:

| Field | Editable | Notes |
|-------|----------|-------|
| Name | Yes | Required |
| Category | Yes | Select from enum |
| Serial Number | Yes | Optional |
| Location | Yes | Optional |
| Notes | Yes | Optional |
| Status | Yes | Admin can change status |

**Status Options for Admin:**
- Available
- Assigned (only if has assignee)
- Maintenance
- Retired

### 3. Edit License Page (`src/pages/EditLicense.tsx`)

Edit form for licenses:

| Field | Editable | Notes |
|-------|----------|-------|
| Product | Yes | Select from enum |
| Full License Key | Yes | Shows current masked, can update |
| Expiration Date | Yes | Date picker |
| Notes | Yes | Optional |
| Status | Yes | Admin control |

**Status Options for Admin:**
- Available
- Assigned (only if has assignee)
- Expired

### 4. Add Admin Actions to Detail Pages

**AssetDetail.tsx Modifications:**
- Add "Edit" button (admin only) that navigates to edit page
- Add "Archive/Retire" button with confirmation dialog
- Add "Set Maintenance" quick action

**LicenseDetail.tsx Modifications:**
- Add "Edit" button (admin only)
- Add "Mark Expired" action
- Add delete capability with confirmation

### 5. Bulk Import Component (`src/components/BulkImportDialog.tsx`)

Modal dialog for CSV import:

**CSV Format for Assets:**
```csv
name,category,serial_number,location,notes
MacBook Pro 14,laptop,C02XK123,Office A,New laptop
Dell Monitor 27,monitor,DELL456,Office B,
```

**CSV Format for Licenses:**
```csv
product,seat_key_full,expires_at,notes
adobe_cc,XXXX-YYYY-ZZZZ-1234,2025-12-31,Team license
office_365,ABCD-EFGH-IJKL-5678,,Personal
```

**Import Flow:**
1. Admin selects resource type (Assets or Licenses)
2. Upload CSV file or paste content
3. Preview parsed data in table
4. Validate entries (highlight errors)
5. Confirm import
6. Show results (success/error count)

### 6. Dashboard Integration

Add new admin section to Dashboard:
- Quick action button for "Import CSV"
- Show recent licenses in admin panel (currently only shows assets)
- Add "Create License" button alongside "Create Asset"

## Files to Create

| File | Description |
|------|-------------|
| `src/pages/CreateLicense.tsx` | License creation form |
| `src/pages/EditAsset.tsx` | Asset editing form |
| `src/pages/EditLicense.tsx` | License editing form |
| `src/components/BulkImportDialog.tsx` | CSV import modal |
| `src/components/AdminActionsMenu.tsx` | Dropdown menu for admin actions |

## Files to Modify

| File | Changes |
|------|---------|
| `src/App.tsx` | Add routes for new pages |
| `src/pages/Dashboard.tsx` | Add license creation button, import button |
| `src/pages/AssetDetail.tsx` | Add edit/archive buttons for admins |
| `src/pages/LicenseDetail.tsx` | Add edit/delete buttons for admins |

## Route Structure

| Route | Component | Access |
|-------|-----------|--------|
| `/admin/create-asset` | CreateAsset | Admin |
| `/admin/create-license` | CreateLicense | Admin |
| `/admin/edit-asset/:id` | EditAsset | Admin |
| `/admin/edit-license/:id` | EditLicense | Admin |

## Database Considerations

No schema changes required - all necessary columns and enums already exist:
- `asset_status`: available, assigned, maintenance, retired
- `license_status`: available, assigned, expired
- `audit_action`: includes 'edit', 'create', 'retire'

## Security Implementation

All admin pages will:
1. Check `isOrgAdmin` from OrganizationContext
2. Redirect to dashboard if not admin
3. Scope all operations to current organization
4. Create audit log entries for all changes

## Masked Key Generation Logic

```typescript
function generateMaskedKey(fullKey: string): string {
  if (fullKey.length <= 4) return '****';
  const lastFour = fullKey.slice(-4);
  return `****-****-****-${lastFour}`;
}
```

## CSV Parsing Approach

Use browser FileReader API to parse CSV:
- Split by newlines, then by commas
- Handle quoted fields with commas
- Validate against required fields
- Type-check enum values
- Return array of validated objects

## UI/UX Patterns

Following existing patterns:
- Cards with shadow-elevated class
- Form fields with Label + Input pattern
- Select components for enums
- Toast notifications for success/error
- Loading spinners during async operations
- Confirmation dialogs for destructive actions

## Audit Trail

All operations will log to audit_log:

| Action | Resource Type | Metadata |
|--------|--------------|----------|
| create | asset/license | Initial values |
| edit | asset/license | Changed fields |
| retire | asset | Previous status |
| delete | license | Product name |

---

## Technical Implementation Details

### CreateLicense Component Structure

```typescript
interface LicenseFormData {
  product: "adobe_cc" | "jetbrains" | "office_365" | "github" | "other";
  seat_key_full: string;
  expires_at: string | null;
  notes: string;
}
```

### Edit Form Pattern

Both edit forms will:
1. Fetch existing data on mount using resource ID from URL params
2. Populate form with current values
3. Track changed fields for audit log
4. Submit updates with optimistic UI
5. Navigate back to detail page on success

### Bulk Import Validation Rules

**Assets:**
- name: required, max 255 chars
- category: must match enum values
- serial_number: optional, max 100 chars
- location: optional, max 255 chars

**Licenses:**
- product: must match enum values
- seat_key_full: required, max 500 chars
- expires_at: optional, valid date format (YYYY-MM-DD)

### Error Handling

- Form validation errors shown inline
- API errors shown via toast
- CSV parse errors shown in preview table
- Network errors with retry option

