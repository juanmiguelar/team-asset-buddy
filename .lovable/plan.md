

# Billing & Subscriptions with Buy Me a Coffee

## Overview
Implement a subscription system using Buy Me a Coffee (BMC) as the payment provider, with manual/semi-automatic activation. This approach works perfectly for Costa Rica and gives you full control over the payment flow.

## How Buy Me a Coffee Works for SaaS

Buy Me a Coffee offers **Memberships** which are recurring subscriptions. Here's how it works:

1. You create membership tiers on BMC (e.g., Pro $29/month, Enterprise $99/month)
2. Users click a link to your BMC membership page
3. They subscribe and pay through BMC
4. You receive a notification via email or webhook
5. You activate their subscription in your app

BMC also has a webhook API that can automatically notify your app when someone subscribes!

---

## Architecture

```text
+-------------------+     +------------------+     +------------------+
| Buy Me a Coffee   |     | Edge Function    |     | Database         |
| (Membership Page) |---->| Webhook Handler  |---->| organization_    |
|                   |     |                  |     | subscriptions    |
+-------------------+     +------------------+     +------------------+
        ^                                                   |
        |                                                   v
+-------------------+                        +---------------------------+
| User Clicks       |                        | SubscriptionContext       |
| "Upgrade" Button  |                        | - currentPlan             |
+-------------------+                        | - limits                  |
                                             | - canCreate()             |
                                             +---------------------------+
                                                        |
                               +----------+----------+----------+
                               |          |          |          |
                               v          v          v          v
                         CreateAsset  Dashboard  Members  CreateLicense
                         (enforces    (shows     (limit   (enforces
                          limits)      plan)     check)    limits)
```

---

## Database Schema

### New Table: `organization_subscriptions`

| Column | Type | Description |
|--------|------|-------------|
| id | UUID | Primary key |
| organization_id | UUID | FK to organizations (unique) |
| plan | subscription_plan (enum) | 'free', 'pro', 'enterprise' |
| status | subscription_status (enum) | 'active', 'canceled', 'past_due' |
| bmc_supporter_email | TEXT | Email used on BMC (for matching) |
| bmc_subscription_id | TEXT | BMC subscription identifier |
| activated_by | UUID | User who activated (for manual) |
| current_period_start | TIMESTAMPTZ | Billing period start |
| current_period_end | TIMESTAMPTZ | Billing period end |
| created_at | TIMESTAMPTZ | Creation timestamp |
| updated_at | TIMESTAMPTZ | Last update |

### New Enum: `subscription_plan`
- `free` - Default, limited features
- `pro` - Standard paid ($29/month)
- `enterprise` - Full features ($99/month)

### New Enum: `subscription_status`
- `active` - Currently subscribed
- `canceled` - Subscription ended
- `past_due` - Payment failed

---

## Plan Limits

Defined in code for easy adjustment:

| Feature | Free | Pro | Enterprise |
|---------|------|-----|------------|
| Max Assets | 10 | 100 | Unlimited |
| Max Licenses | 5 | 50 | Unlimited |
| Max Members | 3 | 15 | Unlimited |
| Bulk CSV Import | No | Yes | Yes |
| Audit Log Access | No | Yes | Yes |
| Priority Support | No | No | Yes |

---

## Implementation Steps

### Phase 1: Database & Context

1. Create migration for `organization_subscriptions` table
2. Auto-create `free` subscription for each organization
3. Create `SubscriptionContext.tsx` with:
   - Current plan detection
   - Limit checking functions (`canCreateAsset()`, `canInviteMember()`)
   - Feature gates (`hasFeature('bulkImport')`)
4. Create `src/lib/plans.ts` with plan definitions

### Phase 2: Usage Enforcement

Modify existing pages to check limits before actions:

1. **CreateAsset.tsx** - Block if at asset limit
2. **CreateLicense.tsx** - Block if at license limit
3. **InviteMemberDialog.tsx** - Block if at member limit
4. **BulkImportDialog.tsx** - Show upgrade prompt if on Free plan

### Phase 3: Billing UI

1. **Billing Page** (`src/pages/Billing.tsx`):
   - Current plan display with badge
   - Usage meters (assets, licenses, members)
   - Plan comparison table
   - Upgrade buttons linking to your BMC membership page
   - Payment instructions for manual activation

2. **Upgrade Prompt Component** (`src/components/UpgradePrompt.tsx`):
   - Shown when user hits a limit
   - Explains the limit and shows upgrade CTA

3. **Dashboard Updates**:
   - Plan badge next to organization name
   - Usage indicator in admin panel

### Phase 4: BMC Webhook (Optional but Recommended)

Create an edge function to receive BMC webhooks:
- Endpoint: `/functions/v1/bmc-webhook`
- Validates webhook signature
- Matches supporter email to organization
- Auto-activates subscription

### Phase 5: Manual Activation

For cases where webhook matching fails:
- Admin page to manually activate subscriptions
- Enter BMC supporter email + select plan
- Useful for bank transfers or custom arrangements

---

## Files to Create

| File | Description |
|------|-------------|
| `src/contexts/SubscriptionContext.tsx` | Subscription state management |
| `src/pages/Billing.tsx` | Billing dashboard with plans |
| `src/components/UpgradePrompt.tsx` | Limit reached modal |
| `src/components/UsageMeter.tsx` | Visual usage bar |
| `src/components/PlanBadge.tsx` | Small plan indicator |
| `src/lib/plans.ts` | Plan definitions and limits |
| `supabase/functions/bmc-webhook/index.ts` | BMC webhook handler |

## Files to Modify

| File | Changes |
|------|---------|
| `src/App.tsx` | Add billing route, wrap with SubscriptionProvider |
| `src/contexts/OrganizationContext.tsx` | Fetch subscription with org |
| `src/pages/Dashboard.tsx` | Show plan badge, usage in admin panel |
| `src/pages/CreateAsset.tsx` | Add limit check |
| `src/pages/CreateLicense.tsx` | Add limit check |
| `src/components/InviteMemberDialog.tsx` | Add member limit check |
| `src/components/BulkImportDialog.tsx` | Add feature gate |
| `src/pages/OrganizationSettings.tsx` | Add billing link |

---

## UI Components

### Billing Page Layout

```text
+------------------------------------------+
|  [Crown] Plan Actual: FREE               |
|                                          |
|  Uso Actual:                             |
|  +---------------------------------+     |
|  | Activos    ████████░░  8/10    |     |
|  | Licencias  ██░░░░░░░░  2/5     |     |
|  | Miembros   ██████░░░░  2/3     |     |
|  +---------------------------------+     |
+------------------------------------------+

+------------+  +------------+  +------------+
|   FREE     |  |    PRO     |  | ENTERPRISE |
|   $0/mes   |  |  $29/mes   |  |  $99/mes   |
|            |  |            |  |            |
| 10 activos |  | 100 activos|  | Ilimitado  |
| 5 licencias|  | 50 licencia|  | Ilimitado  |
| 3 miembros |  | 15 miembros|  | Ilimitado  |
|            |  | + CSV      |  | + Todo Pro |
|            |  | + Auditoria|  | + Soporte  |
|            |  |            |  |            |
| [Actual]   |  | [Upgrade]  |  | [Contactar]|
+------------+  +------------+  +------------+

+------------------------------------------+
|  Como Actualizar:                        |
|  1. Haz clic en el plan deseado         |
|  2. Completa el pago en Buy Me a Coffee |
|  3. Tu plan se activa automaticamente   |
|     (o contactanos para activacion)     |
+------------------------------------------+
```

### Upgrade Prompt (shown when limit reached)

```text
+------------------------------------------+
|  [Crown Icon]                            |
|  Limite Alcanzado                        |
|                                          |
|  Has alcanzado el limite de 10 activos   |
|  en el plan Free.                        |
|                                          |
|  Actualiza a Pro para agregar hasta      |
|  100 activos y desbloquear mas.          |
|                                          |
|  [Ver Planes]        [Cerrar]            |
+------------------------------------------+
```

---

## Buy Me a Coffee Setup Instructions

After implementation, you'll need to:

1. **Create Membership Tiers on BMC**:
   - Pro Tier: $29/month
   - Enterprise Tier: $99/month

2. **Get Your BMC Webhook Secret**:
   - Go to BMC Dashboard > Settings > Webhooks
   - Add webhook URL: `https://hoaivkgkgomhfxtkbyad.supabase.co/functions/v1/bmc-webhook`
   - Copy the webhook secret

3. **Configure Secrets**:
   - Add `BMC_WEBHOOK_SECRET` to your edge function secrets

4. **Get Your Membership Page URL**:
   - e.g., `https://buymeacoffee.com/yourusername/membership`

---

## Technical Details

### SubscriptionContext Structure

```typescript
interface SubscriptionContextType {
  subscription: OrganizationSubscription | null;
  plan: 'free' | 'pro' | 'enterprise';
  limits: PlanLimits;
  usage: Usage;
  loading: boolean;
  
  // Limit checks
  canCreateAsset: () => boolean;
  canCreateLicense: () => boolean;
  canInviteMember: () => boolean;
  
  // Feature checks
  hasFeature: (feature: string) => boolean;
  
  // Refresh
  refreshSubscription: () => Promise<void>;
}
```

### Plan Limits Definition

```typescript
export const PLAN_LIMITS = {
  free: {
    maxAssets: 10,
    maxLicenses: 5,
    maxMembers: 3,
    features: {
      bulkImport: false,
      auditLog: false,
      prioritySupport: false,
    }
  },
  pro: {
    maxAssets: 100,
    maxLicenses: 50,
    maxMembers: 15,
    features: {
      bulkImport: true,
      auditLog: true,
      prioritySupport: false,
    }
  },
  enterprise: {
    maxAssets: Infinity,
    maxLicenses: Infinity,
    maxMembers: Infinity,
    features: {
      bulkImport: true,
      auditLog: true,
      prioritySupport: true,
    }
  }
};
```

### BMC Webhook Payload Example

```json
{
  "type": "membership.started",
  "data": {
    "supporter_email": "user@company.com",
    "membership_level_id": 12345,
    "is_active": true,
    "current_price": 29
  }
}
```

---

## Security Considerations

1. **Webhook Verification**: Validate BMC webhook signatures
2. **Server-side Enforcement**: Check limits before database inserts
3. **Grace Period**: 7-day grace for failed renewals
4. **RLS Policies**: Subscription data scoped to organization

---

## Migration Strategy

For existing organizations:
- All existing orgs get `free` plan by default
- If you have paying customers, manually activate their subscriptions
- No data loss or breaking changes

