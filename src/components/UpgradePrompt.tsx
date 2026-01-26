import { useState } from "react";
import { useNavigate } from "react-router-dom";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { Crown, Package, Key, Users } from "lucide-react";
import { useSubscription } from "@/contexts/SubscriptionContext";

type LimitType = 'assets' | 'licenses' | 'members' | 'feature';

interface UpgradePromptProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  limitType: LimitType;
  featureName?: string;
}

const limitConfig: Record<LimitType, { 
  icon: React.ElementType; 
  title: string; 
  getMessage: (limit: number, featureName?: string) => string;
}> = {
  assets: {
    icon: Package,
    title: "Límite de Activos Alcanzado",
    getMessage: (limit) => `Has alcanzado el límite de ${limit} activos en tu plan actual.`,
  },
  licenses: {
    icon: Key,
    title: "Límite de Licencias Alcanzado",
    getMessage: (limit) => `Has alcanzado el límite de ${limit} licencias en tu plan actual.`,
  },
  members: {
    icon: Users,
    title: "Límite de Miembros Alcanzado",
    getMessage: (limit) => `Has alcanzado el límite de ${limit} miembros en tu plan actual.`,
  },
  feature: {
    icon: Crown,
    title: "Función Premium",
    getMessage: (_, featureName) => `La función "${featureName}" no está disponible en tu plan actual.`,
  },
};

export const UpgradePrompt = ({ open, onOpenChange, limitType, featureName }: UpgradePromptProps) => {
  const navigate = useNavigate();
  const { limits, plan } = useSubscription();
  
  const config = limitConfig[limitType];
  const Icon = config.icon;
  
  const limit = limitType === 'assets' ? limits.maxAssets 
              : limitType === 'licenses' ? limits.maxLicenses 
              : limitType === 'members' ? limits.maxMembers 
              : 0;

  const handleViewPlans = () => {
    onOpenChange(false);
    navigate("/billing");
  };

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="sm:max-w-md">
        <DialogHeader className="text-center sm:text-center">
          <div className="mx-auto w-16 h-16 rounded-full bg-primary/10 flex items-center justify-center mb-4">
            <Icon className="w-8 h-8 text-primary" />
          </div>
          <DialogTitle className="text-xl">{config.title}</DialogTitle>
          <DialogDescription className="text-base">
            {config.getMessage(limit, featureName)}
          </DialogDescription>
        </DialogHeader>

        <div className="bg-muted/50 rounded-lg p-4 text-center">
          <p className="text-sm text-muted-foreground mb-2">
            Plan actual: <span className="font-medium text-foreground capitalize">{plan}</span>
          </p>
          <p className="text-sm">
            Actualiza a <span className="font-semibold text-primary">Pro</span> para obtener más capacidad y desbloquear funciones avanzadas.
          </p>
        </div>

        <DialogFooter className="flex-col sm:flex-row gap-2">
          <Button variant="outline" onClick={() => onOpenChange(false)} className="w-full sm:w-auto">
            Cerrar
          </Button>
          <Button onClick={handleViewPlans} className="w-full sm:w-auto">
            <Crown className="w-4 h-4 mr-2" />
            Ver Planes
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
};

// Standalone card version for inline display (not a dialog)
export const UpgradePromptCard = ({ limitType, featureName }: { limitType: LimitType; featureName?: string }) => {
  const navigate = useNavigate();
  const { limits, plan } = useSubscription();
  
  const config = limitConfig[limitType];
  const Icon = config.icon;
  
  const limit = limitType === 'assets' ? limits.maxAssets 
              : limitType === 'licenses' ? limits.maxLicenses 
              : limitType === 'members' ? limits.maxMembers 
              : 0;

  return (
    <div className="max-w-md mx-auto p-6 rounded-lg border bg-card shadow-soft text-center">
      <div className="mx-auto w-16 h-16 rounded-full bg-primary/10 flex items-center justify-center mb-4">
        <Icon className="w-8 h-8 text-primary" />
      </div>
      <h2 className="text-xl font-semibold mb-2">{config.title}</h2>
      <p className="text-muted-foreground mb-4">
        {config.getMessage(limit, featureName)}
      </p>

      <div className="bg-muted/50 rounded-lg p-4 mb-4">
        <p className="text-sm text-muted-foreground mb-2">
          Plan actual: <span className="font-medium text-foreground capitalize">{plan}</span>
        </p>
        <p className="text-sm">
          Actualiza a <span className="font-semibold text-primary">Pro</span> para obtener más capacidad y desbloquear funciones avanzadas.
        </p>
      </div>

      <Button onClick={() => navigate("/billing")} className="w-full">
        <Crown className="w-4 h-4 mr-2" />
        Ver Planes
      </Button>
    </div>
  );
};

// Hook for easy usage
export const useUpgradePrompt = () => {
  const [isOpen, setIsOpen] = useState(false);
  const [limitType, setLimitType] = useState<LimitType>('assets');
  const [featureName, setFeatureName] = useState<string>();

  const showUpgradePrompt = (type: LimitType, feature?: string) => {
    setLimitType(type);
    setFeatureName(feature);
    setIsOpen(true);
  };

  const UpgradePromptDialog = () => (
    <UpgradePrompt 
      open={isOpen} 
      onOpenChange={setIsOpen} 
      limitType={limitType}
      featureName={featureName}
    />
  );

  return { showUpgradePrompt, UpgradePromptDialog };
};
