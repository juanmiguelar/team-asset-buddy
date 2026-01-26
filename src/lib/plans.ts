export type SubscriptionPlan = 'free' | 'pro' | 'enterprise';
export type SubscriptionStatus = 'active' | 'canceled' | 'past_due';

export interface PlanFeatures {
  bulkImport: boolean;
  auditLog: boolean;
  prioritySupport: boolean;
}

export interface PlanLimits {
  maxAssets: number;
  maxLicenses: number;
  maxMembers: number;
  features: PlanFeatures;
}

export const PLAN_LIMITS: Record<SubscriptionPlan, PlanLimits> = {
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

export interface PlanInfo {
  name: string;
  price: number;
  priceLabel: string;
  description: string;
  highlighted?: boolean;
}

export const PLAN_INFO: Record<SubscriptionPlan, PlanInfo> = {
  free: {
    name: 'Free',
    price: 0,
    priceLabel: '$0/mes',
    description: 'Perfecto para empezar',
  },
  pro: {
    name: 'Pro',
    price: 29,
    priceLabel: '$29/mes',
    description: 'Para equipos en crecimiento',
    highlighted: true,
  },
  enterprise: {
    name: 'Enterprise',
    price: 99,
    priceLabel: '$99/mes',
    description: 'Para grandes organizaciones',
  }
};

// Your Buy Me a Coffee membership page URL
export const BMC_MEMBERSHIP_URL = 'https://buymeacoffee.com/yourusername/membership';

// Feature display names for UI
export const FEATURE_NAMES: Record<keyof PlanFeatures, string> = {
  bulkImport: 'Importación CSV masiva',
  auditLog: 'Registro de auditoría',
  prioritySupport: 'Soporte prioritario',
};
