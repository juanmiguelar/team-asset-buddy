import { useNavigate } from "react-router-dom";
import { useAuth } from "@/contexts/AuthContext";
import { useOrganization } from "@/contexts/OrganizationContext";
import { useSubscription } from "@/contexts/SubscriptionContext";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Separator } from "@/components/ui/separator";
import { PlanBadge } from "@/components/PlanBadge";
import { UsageMeter } from "@/components/UsageMeter";
import { ArrowLeft, Crown, Check, ExternalLink, Loader2, Mail } from "lucide-react";
import { PLAN_INFO, PLAN_LIMITS, BMC_MEMBERSHIP_URL, FEATURE_NAMES, type SubscriptionPlan } from "@/lib/plans";
import { cn } from "@/lib/utils";

const Billing = () => {
  const navigate = useNavigate();
  const { user, loading: authLoading } = useAuth();
  const { currentOrganization, isOrgOwner, loading: orgLoading } = useOrganization();
  const { plan, limits, usage, loading: subLoading } = useSubscription();

  const isLoading = authLoading || orgLoading || subLoading;

  if (isLoading) {
    return (
      <div className="min-h-screen flex items-center justify-center bg-background">
        <Loader2 className="w-8 h-8 animate-spin text-primary" />
      </div>
    );
  }

  if (!user) {
    navigate("/auth");
    return null;
  }

  const plans: SubscriptionPlan[] = ['free', 'pro', 'enterprise'];

  const handleUpgrade = (targetPlan: SubscriptionPlan) => {
    if (targetPlan === 'enterprise') {
      // For enterprise, open email
      window.location.href = 'mailto:soporte@tuempresa.com?subject=Consulta%20Plan%20Enterprise';
    } else {
      // Open BMC membership page
      window.open(BMC_MEMBERSHIP_URL, '_blank');
    }
  };

  return (
    <div className="min-h-screen bg-background">
      <header className="border-b bg-card/50 backdrop-blur-sm sticky top-0 z-50">
        <div className="container mx-auto px-4 py-4">
          <Button variant="ghost" size="sm" onClick={() => navigate("/")}>
            <ArrowLeft className="w-4 h-4 mr-2" />
            Volver
          </Button>
        </div>
      </header>

      <main className="container mx-auto px-4 py-6 pb-24 max-w-5xl">
        {/* Current Plan & Usage */}
        <Card className="shadow-elevated mb-8">
          <CardHeader>
            <div className="flex items-center justify-between">
              <div>
                <CardTitle className="text-2xl flex items-center gap-3">
                  <Crown className="w-6 h-6 text-primary" />
                  Tu Plan Actual
                </CardTitle>
                <CardDescription className="mt-1">
                  {currentOrganization?.name}
                </CardDescription>
              </div>
              <PlanBadge plan={plan} />
            </div>
          </CardHeader>
          <CardContent className="space-y-6">
            <div>
              <h3 className="font-medium mb-4">Uso Actual</h3>
              <div className="grid gap-4 sm:grid-cols-3">
                <UsageMeter 
                  label="Activos" 
                  current={usage.assets} 
                  max={limits.maxAssets} 
                />
                <UsageMeter 
                  label="Licencias" 
                  current={usage.licenses} 
                  max={limits.maxLicenses} 
                />
                <UsageMeter 
                  label="Miembros" 
                  current={usage.members} 
                  max={limits.maxMembers} 
                />
              </div>
            </div>
          </CardContent>
        </Card>

        {/* Plan Comparison */}
        <h2 className="text-xl font-semibold mb-4">Comparar Planes</h2>
        <div className="grid gap-4 md:grid-cols-3 mb-8">
          {plans.map((planKey) => {
            const info = PLAN_INFO[planKey];
            const planLimits = PLAN_LIMITS[planKey];
            const isCurrent = plan === planKey;
            const isUpgrade = plans.indexOf(planKey) > plans.indexOf(plan);

            return (
              <Card 
                key={planKey}
                className={cn(
                  "relative shadow-elevated transition-all",
                  info.highlighted && "border-primary ring-2 ring-primary/20",
                  isCurrent && "bg-primary/5"
                )}
              >
                {info.highlighted && (
                  <div className="absolute -top-3 left-1/2 -translate-x-1/2">
                    <span className="bg-primary text-primary-foreground text-xs font-medium px-3 py-1 rounded-full">
                      Popular
                    </span>
                  </div>
                )}
                <CardHeader className="text-center pb-2">
                  <CardTitle className="text-xl">{info.name}</CardTitle>
                  <div className="text-3xl font-bold">{info.priceLabel}</div>
                  <CardDescription>{info.description}</CardDescription>
                </CardHeader>
                <CardContent className="space-y-4">
                  <Separator />
                  
                  {/* Limits */}
                  <ul className="space-y-2 text-sm">
                    <li className="flex items-center gap-2">
                      <Check className="w-4 h-4 text-primary" />
                      <span>
                        {planLimits.maxAssets === Infinity ? 'Activos ilimitados' : `${planLimits.maxAssets} activos`}
                      </span>
                    </li>
                    <li className="flex items-center gap-2">
                      <Check className="w-4 h-4 text-primary" />
                      <span>
                        {planLimits.maxLicenses === Infinity ? 'Licencias ilimitadas' : `${planLimits.maxLicenses} licencias`}
                      </span>
                    </li>
                    <li className="flex items-center gap-2">
                      <Check className="w-4 h-4 text-primary" />
                      <span>
                        {planLimits.maxMembers === Infinity ? 'Miembros ilimitados' : `${planLimits.maxMembers} miembros`}
                      </span>
                    </li>
                  </ul>

                  {/* Features */}
                  <ul className="space-y-2 text-sm">
                    {Object.entries(planLimits.features).map(([feature, enabled]) => (
                      <li 
                        key={feature}
                        className={cn(
                          "flex items-center gap-2",
                          !enabled && "text-muted-foreground"
                        )}
                      >
                        <Check className={cn(
                          "w-4 h-4",
                          enabled ? "text-primary" : "text-muted-foreground/50"
                        )} />
                        <span className={!enabled ? "line-through" : ""}>
                          {FEATURE_NAMES[feature as keyof typeof FEATURE_NAMES]}
                        </span>
                      </li>
                    ))}
                  </ul>

                  <Separator />

                  {/* Action Button */}
                  {isCurrent ? (
                    <Button variant="outline" className="w-full" disabled>
                      Plan Actual
                    </Button>
                  ) : isUpgrade ? (
                    <Button 
                      variant={info.highlighted ? "default" : "outline"}
                      className="w-full"
                      onClick={() => handleUpgrade(planKey)}
                      disabled={!isOrgOwner}
                    >
                      {planKey === 'enterprise' ? (
                        <>
                          <Mail className="w-4 h-4 mr-2" />
                          Contactar
                        </>
                      ) : (
                        <>
                          <ExternalLink className="w-4 h-4 mr-2" />
                          Actualizar
                        </>
                      )}
                    </Button>
                  ) : (
                    <Button variant="outline" className="w-full" disabled>
                      -
                    </Button>
                  )}
                </CardContent>
              </Card>
            );
          })}
        </div>

        {/* How to Upgrade */}
        <Card className="shadow-elevated">
          <CardHeader>
            <CardTitle className="text-lg">¿Cómo actualizar tu plan?</CardTitle>
          </CardHeader>
          <CardContent className="space-y-4">
            <ol className="list-decimal list-inside space-y-2 text-sm text-muted-foreground">
              <li>Haz clic en el botón "Actualizar" del plan que deseas</li>
              <li>Completa el pago en Buy Me a Coffee con el email de tu organización</li>
              <li>Tu plan se activará automáticamente en minutos</li>
              <li>Si no se activa, contáctanos con tu comprobante de pago</li>
            </ol>

            <Separator />

            <div className="flex items-center justify-between text-sm">
              <span className="text-muted-foreground">¿Necesitas ayuda?</span>
              <Button variant="link" size="sm" asChild>
                <a href="mailto:soporte@tuempresa.com">
                  <Mail className="w-4 h-4 mr-2" />
                  Contactar Soporte
                </a>
              </Button>
            </div>
          </CardContent>
        </Card>

        {!isOrgOwner && (
          <p className="text-sm text-muted-foreground text-center mt-4">
            Solo el propietario de la organización puede cambiar el plan.
          </p>
        )}
      </main>
    </div>
  );
};

export default Billing;
