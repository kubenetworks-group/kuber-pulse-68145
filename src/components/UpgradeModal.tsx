import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { useNavigate } from "react-router-dom";
import { Check } from "lucide-react";

interface UpgradeModalProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  currentPlan: string;
  reason?: string;
}

export const UpgradeModal = ({ open, onOpenChange, currentPlan, reason }: UpgradeModalProps) => {
  const navigate = useNavigate();

  const planFeatures = {
    trial: {
      name: "Trial",
      features: ["1 cluster", "Análises IA ilimitadas", "Auto-healing básico"],
    },
    starter: {
      name: "Starter",
      features: ["1 cluster", "Análises IA ilimitadas", "Auto-healing básico", "Relatórios semanais"],
    },
    growth: {
      name: "Growth",
      features: ["3 clusters", "Análises IA ilimitadas", "Auto-healing avançado", "Relatórios diários", "API access"],
    },
  };

  const nextPlan = currentPlan === 'trial' || currentPlan === 'starter' ? 'growth' : 'enterprise';
  const current = planFeatures[currentPlan as keyof typeof planFeatures] || planFeatures.trial;
  const next = planFeatures[nextPlan as keyof typeof planFeatures] || planFeatures.growth;

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="sm:max-w-[600px]">
        <DialogHeader>
          <DialogTitle>Limite do plano atingido</DialogTitle>
          <DialogDescription>
            {reason || `Você atingiu o limite do plano ${current.name}. Faça upgrade para continuar.`}
          </DialogDescription>
        </DialogHeader>

        <div className="grid grid-cols-2 gap-4 py-4">
          <div className="space-y-2">
            <h4 className="font-semibold">Plano Atual: {current.name}</h4>
            <ul className="space-y-1 text-sm text-muted-foreground">
              {current.features.map((feature, i) => (
                <li key={i} className="flex items-center gap-2">
                  <Check className="h-4 w-4 text-primary" />
                  {feature}
                </li>
              ))}
            </ul>
          </div>

          <div className="space-y-2 border-l pl-4">
            <h4 className="font-semibold">Upgrade para: {next.name}</h4>
            <ul className="space-y-1 text-sm">
              {next.features.map((feature, i) => (
                <li key={i} className="flex items-center gap-2">
                  <Check className="h-4 w-4 text-green-600" />
                  {feature}
                </li>
              ))}
            </ul>
          </div>
        </div>

        <DialogFooter>
          <Button variant="outline" onClick={() => onOpenChange(false)}>
            Cancelar
          </Button>
          <Button onClick={() => {
            onOpenChange(false);
            navigate('/pricing');
          }}>
            Fazer Upgrade
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
};
