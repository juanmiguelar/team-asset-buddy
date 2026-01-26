
# License Detail Page Implementation Plan

## Overview
Create a new `LicenseDetail` page that mirrors the existing `AssetDetail` page pattern, with secure handling of license key visibility. Admins will be able to view full license keys using the secure `get_license_full_key` database function, while employees will only see masked keys.

## Architecture

```text
+------------------------+
|    LicenseDetail Page  |
+------------------------+
           |
           v
+------------------------+
|  Role Check (isAdmin)  |
+------------------------+
           |
     +-----+-----+
     |           |
     v           v
+--------+   +----------+
|Employee|   |  Admin   |
+--------+   +----------+
     |           |
     v           v
+--------+   +-------------+
|Masked  |   |"Reveal Key" |
|Key Only|   |   Button    |
+--------+   +-------------+
                   |
                   v
           +---------------+
           | Confirmation  |
           |    Dialog     |
           +---------------+
                   |
                   v
           +---------------+
           | supabase.rpc  |
           | get_license_  |
           | full_key()    |
           +---------------+
```

## Implementation Steps

### 1. Create LicenseDetail Page (`src/pages/LicenseDetail.tsx`)

**Features:**
- Display license information (product, status, expiration date, assignee, notes)
- Show masked key (`seat_key_masked`) by default for everyone
- Admin-only "Reveal Full Key" button with confirmation dialog
- Check-in/Check-out functionality (similar to AssetDetail)
- Audit log integration for all actions

**Key Components:**
- License info card with product icon, status badge, and details
- Masked key display with copy-to-clipboard functionality
- Admin section with reveal key button
- Confirmation dialog using AlertDialog component
- Action buttons for check-in/check-out

### 2. Update App Router (`src/App.tsx`)

Add the new route:
```typescript
<Route path="/license/:id" element={<LicenseDetail />} />
```

### 3. Security Implementation

**Admin Key Reveal Flow:**
1. Admin clicks "Reveal Full Key" button
2. Confirmation dialog appears warning about the sensitive nature
3. On confirmation, call `supabase.rpc('get_license_full_key', { _license_id: licenseId })`
4. Display the full key in a secure, copyable format
5. Key visibility times out after 30 seconds for extra security

**RPC Call Pattern:**
```typescript
const { data: fullKey, error } = await supabase
  .rpc('get_license_full_key', { _license_id: license.id });
```

## Technical Details

### License Interface
```typescript
interface License {
  id: string;
  product: string;
  status: string;
  seat_key_masked: string | null;
  assignee_user_id: string | null;
  expires_at: string | null;
  notes: string | null;
  qr_code: string;
  created_at: string;
  updated_at: string;
}
```

### Data Fetching Strategy
- **Employees**: Query from `licenses_safe` view (no full key exposed)
- **Admins**: Query from `licenses` table directly (still excluding `seat_key_full` in SELECT)
- **Full Key**: Only fetched on-demand via RPC when admin explicitly requests it

### UI Components Used
- `Card`, `CardHeader`, `CardContent` for layout
- `Badge` for status display
- `Button` for actions
- `AlertDialog` for confirmation before revealing key
- `toast` for success/error feedback
- `Key`, `Calendar`, `User` icons from lucide-react

### Check-In/Check-Out Logic
- Same pattern as AssetDetail
- Updates license status and assignee
- Creates audit_log entry with action details
- Validates expired licenses cannot be checked out

## Files to Create/Modify

| File | Action | Description |
|------|--------|-------------|
| `src/pages/LicenseDetail.tsx` | Create | New page component |
| `src/App.tsx` | Modify | Add `/license/:id` route |

## User Experience

1. **Employee View:**
   - See license product name, status, expiration
   - See masked key (e.g., `XXXX-XXXX-1234`)
   - Check-in button if assigned to them
   - Check-out button if license is available and not expired

2. **Admin View:**
   - All employee features plus:
   - "Reveal Full Key" button in a highlighted admin section
   - Confirmation dialog before revealing
   - Full key display with copy button
   - Auto-hide after 30 seconds

## Security Considerations

- Full key is never stored in frontend state longer than necessary
- Auto-clear after 30 seconds
- Confirmation required before reveal
- Server-side validation in `get_license_full_key` function
- Audit trail for key reveals (could be added as enhancement)
