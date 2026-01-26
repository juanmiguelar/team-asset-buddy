import { Badge } from "@/components/ui/badge";
import { Crown, Sparkles, Building2 } from "lucide-react";
import { type SubscriptionPlan } from "@/lib/plans";
import { cn } from "@/lib/utils";

interface PlanBadgeProps {
  plan: SubscriptionPlan;
  size?: "sm" | "default";
  className?: string;
}

const planConfig: Record<SubscriptionPlan, { 
  label: string; 
  icon: React.ElementType; 
  variant: "default" | "secondary" | "outline";
  className: string;
}> = {
  free: {
    label: "Free",
    icon: Sparkles,
    variant: "secondary",
    className: "bg-muted text-muted-foreground",
  },
  pro: {
    label: "Pro",
    icon: Crown,
    variant: "default",
    className: "bg-primary text-primary-foreground",
  },
  enterprise: {
    label: "Enterprise",
    icon: Building2,
    variant: "default",
    className: "bg-gradient-to-r from-primary to-purple-600 text-primary-foreground",
  },
};

export const PlanBadge = ({ plan, size = "default", className }: PlanBadgeProps) => {
  const config = planConfig[plan];
  const Icon = config.icon;

  return (
    <Badge 
      variant={config.variant}
      className={cn(
        config.className,
        size === "sm" ? "text-xs px-1.5 py-0" : "text-sm px-2 py-0.5",
        className
      )}
    >
      <Icon className={cn("mr-1", size === "sm" ? "w-3 h-3" : "w-3.5 h-3.5")} />
      {config.label}
    </Badge>
  );
};
