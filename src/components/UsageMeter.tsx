import { Progress } from "@/components/ui/progress";
import { cn } from "@/lib/utils";

interface UsageMeterProps {
  label: string;
  current: number;
  max: number;
  className?: string;
}

export const UsageMeter = ({ label, current, max, className }: UsageMeterProps) => {
  const isUnlimited = max === Infinity;
  const percentage = isUnlimited ? 0 : Math.min(100, Math.round((current / max) * 100));
  const isNearLimit = percentage >= 80;
  const isAtLimit = percentage >= 100;

  return (
    <div className={cn("space-y-1.5", className)}>
      <div className="flex items-center justify-between text-sm">
        <span className="text-muted-foreground">{label}</span>
        <span className={cn(
          "font-medium",
          isAtLimit && "text-destructive",
          isNearLimit && !isAtLimit && "text-orange-500"
        )}>
          {current}/{isUnlimited ? "∞" : max}
        </span>
      </div>
      <Progress 
        value={isUnlimited ? 0 : percentage} 
        className={cn(
          "h-2",
          isAtLimit && "[&>div]:bg-destructive",
          isNearLimit && !isAtLimit && "[&>div]:bg-orange-500"
        )}
      />
    </div>
  );
};
