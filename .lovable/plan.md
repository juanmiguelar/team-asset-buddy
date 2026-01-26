
# Multi-Tenancy with Organizations Implementation Plan

## Overview
Transform the current single-tenant inventory management system into a multi-tenant SaaS platform where each company (organization) has completely isolated data, their own admin users, and organization-specific settings.

## Architecture

```text
                     +------------------+
                     |  Organizations   |
                     +------------------+
                             |
          +------------------+------------------+
          |                  |                  |
          v                  v                  v
   +------------+     +------------+     +------------+
   | Org A Data |     | Org B Data |     | Org C Data |
   +------------+     +------------+     +------------+
          |                  |                  |
   +------+------+    +------+------+    +------+------+
   |  Members    |    |  Members    |    |  Members    |
   | Assets      |    | Assets      |    | Assets      |
   | Licenses    |    | Licenses    |    | Licenses    |
   | Audit Logs  |    | Audit Logs  |    | Audit Logs  |
   +-------------+    +-------------+    +-------------+
```

## Database Schema Changes

### New Tables

**1. organizations**
| Column | Type | Description |
|--------|------|-------------|
| id | UUID | Primary key |
| name | TEXT | Organization display name |
| slug | TEXT | URL-friendly unique identifier |
| settings | JSONB | Organization-specific settings |
| created_at | TIMESTAMPTZ | Creation timestamp |
| updated_at | TIMESTAMPTZ | Last update timestamp |

**2. organization_members** (Replaces role on profiles)
| Column | Type | Description |
|--------|------|-------------|
| id | UUID | Primary key |
| organization_id | UUID | FK to organizations |
| user_id | UUID | FK to profiles |
| role | org_role (enum) | 'owner', 'admin', 'member' |
| created_at | TIMESTAMPTZ | When user joined |

**3. organization_invites**
| Column | Type | Description |
|--------|------|-------------|
| id | UUID | Primary key |
| organization_id | UUID | FK to organizations |
| email | TEXT | Invited email address |
| role | org_role | Role to assign on acceptance |
| invited_by | UUID | FK to profiles |
| token | TEXT | Unique invite token |
| expires_at | TIMESTAMPTZ | Invite expiration |
| accepted_at | TIMESTAMPTZ | When accepted (null if pending) |
| created_at | TIMESTAMPTZ | Creation timestamp |

### Existing Table Modifications

**Add organization_id to:**
- `assets` - Required, FK to organizations
- `licenses` - Required, FK to organizations  
- `audit_log` - Required, FK to organizations
- `requests` - Required, FK to organizations

### New Enum Type
```sql
CREATE TYPE org_role AS ENUM ('owner', 'admin', 'member');
```

### Security Functions

**New security definer functions:**
1. `get_user_org_id(user_id)` - Returns the organization ID for a user
2. `has_org_role(user_id, org_id, role)` - Checks if user has specific role in org
3. `is_org_admin(user_id, org_id)` - Checks if user is admin or owner in org

## RLS Policy Updates

All existing tables will be updated to scope data by organization:

**Pattern for all org-scoped tables:**
```sql
-- SELECT: Only see data from your organization
USING (
  organization_id = (
    SELECT organization_id FROM organization_members 
    WHERE user_id = auth.uid() LIMIT 1
  )
)

-- INSERT/UPDATE: Only modify data in your organization (admins only for create)
WITH CHECK (
  organization_id IN (
    SELECT organization_id FROM organization_members 
    WHERE user_id = auth.uid()
  )
  AND has_org_role(auth.uid(), organization_id, 'admin')
)
```

## Implementation Steps

### Phase 1: Database Schema Migration

1. Create new enum type `org_role`
2. Create `organizations` table with RLS
3. Create `organization_members` table with RLS
4. Create `organization_invites` table with RLS
5. Create security definer functions
6. Add `organization_id` column to existing tables (nullable initially for migration)
7. Update `handle_new_user` trigger to create a default organization for new signups

### Phase 2: Update Existing RLS Policies

1. Drop existing policies on assets, licenses, audit_log, requests
2. Create new organization-scoped policies for all tables
3. Update the `licenses_safe` view to include organization context
4. Update `is_admin` function to be organization-aware

### Phase 3: AuthContext Updates

Update `src/contexts/AuthContext.tsx` to:
- Fetch current organization membership
- Expose `currentOrganization` and `orgRole` 
- Add organization switching capability (for users in multiple orgs)
- Replace global `isAdmin` with organization-scoped `isOrgAdmin`

### Phase 4: New Pages & Components

**New Pages:**
| File | Purpose |
|------|---------|
| `src/pages/OrganizationSettings.tsx` | Org name, settings, danger zone |
| `src/pages/OrganizationMembers.tsx` | Member list, invite, role management |
| `src/pages/AcceptInvite.tsx` | Accept organization invitation |
| `src/pages/CreateOrganization.tsx` | Create new organization (for existing users) |

**New Components:**
| File | Purpose |
|------|---------|
| `src/components/OrganizationSwitcher.tsx` | Dropdown to switch between orgs |
| `src/components/InviteMemberDialog.tsx` | Modal to invite new members |
| `src/components/MemberRoleSelect.tsx` | Change member role dropdown |

### Phase 5: Update Existing Pages

**Dashboard.tsx:**
- Show organization name in header
- Add organization switcher
- Filter data by current organization (automatic via RLS)
- Add "Settings" navigation for org admins

**CreateAsset.tsx:**
- Automatically associate new assets with current organization
- (No visible changes needed - organization_id added server-side)

**Auth.tsx:**
- After signup, redirect to organization creation flow
- Handle invite token in URL for invited users

## New User Flow

```text
User Signs Up
     |
     v
+--------------------+
| Create Organization|  <-- First-time user creates their org
+--------------------+
     |
     v
+--------------------+
| Dashboard          |  <-- User is owner of their org
+--------------------+
```

## Invited User Flow

```text
Admin Sends Invite
     |
     v
Email with Link: /invite/accept?token=xxx
     |
     v
+--------------------+
| Accept Invite Page |  <-- User signs up or logs in
+--------------------+
     |
     v
+--------------------+
| Dashboard          |  <-- User is member of org
+--------------------+
```

## Files to Create

| File | Description |
|------|-------------|
| `supabase/migrations/xxxxx_multi_tenancy.sql` | Database schema changes |
| `src/contexts/OrganizationContext.tsx` | Organization state management |
| `src/pages/OrganizationSettings.tsx` | Settings page |
| `src/pages/OrganizationMembers.tsx` | Member management page |
| `src/pages/AcceptInvite.tsx` | Invite acceptance flow |
| `src/components/OrganizationSwitcher.tsx` | Org switcher component |
| `src/components/InviteMemberDialog.tsx` | Invite modal |

## Files to Modify

| File | Changes |
|------|---------|
| `src/contexts/AuthContext.tsx` | Add organization context integration |
| `src/App.tsx` | Add new routes, wrap with OrganizationProvider |
| `src/pages/Dashboard.tsx` | Add org name, switcher, settings link |
| `src/pages/CreateAsset.tsx` | Pass organization_id on create |
| `src/pages/Auth.tsx` | Handle invite tokens, post-signup org flow |

## Security Considerations

1. **Data Isolation**: All queries automatically scoped by organization via RLS
2. **Role Hierarchy**: owner > admin > member with appropriate permissions
3. **Invite Security**: Token-based invites with expiration (7 days default)
4. **Privilege Escalation Prevention**: Roles stored in separate `organization_members` table (not in profiles)
5. **Cross-Org Protection**: Users cannot access resources from organizations they don't belong to

## Organization Settings (JSONB structure)

```json
{
  "allowSelfAssignment": true,
  "requireApprovalForCheckout": false,
  "defaultAssetLocation": "Main Office",
  "notificationEmail": "admin@company.com",
  "timezone": "America/Costa_Rica"
}
```

## Technical Notes

- The `profiles` table `role` column will be deprecated but kept for backward compatibility during migration
- New users without an invite will be prompted to create an organization
- Users can belong to multiple organizations but work in one at a time
- The current organization is stored in React context (not localStorage for security)
- All existing RLS policies will be replaced with organization-scoped versions
