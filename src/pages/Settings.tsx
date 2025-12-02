import { useState, useEffect } from "react";
import { DashboardLayout } from "@/components/DashboardLayout";
import { Card } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Progress } from "@/components/ui/progress";
import { useAuth } from "@/contexts/AuthContext";
import { useSubscription } from "@/contexts/SubscriptionContext";
import { supabase } from "@/integrations/supabase/client";
import { toast } from "sonner";
import { Database, Loader2, Sparkles, GraduationCap, Crown, Clock, Brain, Server } from "lucide-react";
import { useNavigate, Link } from "react-router-dom";

const Settings = () => {
  const { user } = useAuth();
  const { subscription, currentPlan, isTrialActive, daysLeftInTrial, planLimits, isReadOnly } = useSubscription();
  const navigate = useNavigate();
  const [loading, setLoading] = useState(false);
  const [demoLoading, setDemoLoading] = useState(false);
  const [savingsLoading, setSavingsLoading] = useState(false);
  const [profile, setProfile] = useState({
    full_name: "",
    company: "",
  });

  const aiUsagePercent = planLimits.aiAnalysesPerMonth === Infinity 
    ? 0 
    : ((subscription?.ai_analyses_used || 0) / planLimits.aiAnalysesPerMonth) * 100;

  useEffect(() => {
    fetchProfile();
  }, [user]);

  const fetchProfile = async () => {
    if (!user) return;

    const { data, error } = await supabase
      .from("profiles")
      .select("*")
      .eq("id", user.id)
      .single();

    if (error) {
      console.error(error);
    } else if (data) {
      setProfile({
        full_name: data.full_name || "",
        company: data.company || "",
      });
    }
  };

  const handleGenerateDemoData = async () => {
    setDemoLoading(true);
    try {
      const { data, error } = await supabase.functions.invoke('seed-demo-data');

      if (error) throw error;

      toast.success(`Generated ${data.clusters} clusters and ${data.incidents} AI incidents!`);
      
      setTimeout(() => window.location.href = '/', 2000);
    } catch (error: any) {
      toast.error(error.message || "Failed to generate demo data");
    } finally {
      setDemoLoading(false);
    }
  };

  const handleGenerateAISavings = async () => {
    setSavingsLoading(true);
    try {
      const { data, error } = await supabase.functions.invoke('seed-ai-savings');

      if (error) throw error;

      toast.success(`Generated ${data.savings_created} AI savings records!`);
      
      setTimeout(() => window.location.href = '/costs', 2000);
    } catch (error: any) {
      toast.error(error.message || "Failed to generate AI savings data");
    } finally {
      setSavingsLoading(false);
    }
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setLoading(true);

    const { error } = await supabase
      .from("profiles")
      .update(profile)
      .eq("id", user?.id);

    if (error) {
      toast.error("Failed to update profile");
      console.error(error);
    } else {
      toast.success("Profile updated successfully!");
    }
    setLoading(false);
  };

  return (
    <DashboardLayout>
      <div className="p-4 sm:p-6 lg:p-8">
        <div className="mb-6 sm:mb-8">
          <h1 className="text-2xl sm:text-3xl font-bold text-foreground">Settings</h1>
          <p className="text-muted-foreground mt-1 text-sm sm:text-base">Manage your account and preferences</p>
        </div>

        <div className="max-w-2xl space-y-6">
          {/* Subscription Status Card */}
          <Card className="p-6 bg-gradient-to-br from-amber-500/5 to-amber-500/10 border-amber-500/20">
            <div className="flex items-start gap-4">
              <div className="p-3 rounded-lg bg-amber-500/20">
                <Crown className="h-6 w-6 text-amber-500" />
              </div>
              <div className="flex-1">
                <div className="flex items-center gap-2 mb-2">
                  <h3 className="text-lg font-semibold">Plano & Assinatura</h3>
                  <Badge variant="secondary" className="capitalize">
                    {currentPlan}
                  </Badge>
                  {isTrialActive && (
                    <Badge className="bg-amber-500/20 text-amber-600 border-amber-500/30">
                      Trial
                    </Badge>
                  )}
                  {isReadOnly && (
                    <Badge variant="destructive">
                      Somente leitura
                    </Badge>
                  )}
                </div>
                
                <div className="grid gap-4 sm:grid-cols-2 mt-4">
                  {isTrialActive && (
                    <div className="flex items-center gap-3 p-3 rounded-lg bg-background/50">
                      <Clock className="w-4 h-4 text-amber-500" />
                      <div>
                        <p className="text-xs text-muted-foreground">Trial restante</p>
                        <p className="font-medium">{daysLeftInTrial} dias</p>
                      </div>
                    </div>
                  )}
                  
                  <div className="flex items-center gap-3 p-3 rounded-lg bg-background/50">
                    <Brain className="w-4 h-4 text-blue-500" />
                    <div className="flex-1">
                      <p className="text-xs text-muted-foreground">Análises de IA</p>
                      <p className="font-medium text-sm">
                        {subscription?.ai_analyses_used || 0} / {planLimits.aiAnalysesPerMonth === Infinity ? '∞' : planLimits.aiAnalysesPerMonth}
                      </p>
                      {planLimits.aiAnalysesPerMonth !== Infinity && (
                        <Progress value={aiUsagePercent} className="h-1 mt-1" />
                      )}
                    </div>
                  </div>
                  
                  <div className="flex items-center gap-3 p-3 rounded-lg bg-background/50">
                    <Server className="w-4 h-4 text-green-500" />
                    <div>
                      <p className="text-xs text-muted-foreground">Limite de clusters</p>
                      <p className="font-medium">
                        {planLimits.clusters === Infinity ? 'Ilimitado' : `Até ${planLimits.clusters}`}
                      </p>
                    </div>
                  </div>
                </div>

                <div className="mt-4">
                  <Link to="/pricing">
                    <Button variant="outline" className="gap-2">
                      <Crown className="w-4 h-4" />
                      {isTrialActive || currentPlan === 'free' ? 'Ver planos' : 'Gerenciar plano'}
                    </Button>
                  </Link>
                </div>
              </div>
            </div>
          </Card>

          {/* Demo Data Card */}
          <Card className="p-6 bg-gradient-to-br from-primary/5 to-primary/10 border-primary/20">
            <div className="flex items-start gap-4">
              <div className="p-3 rounded-lg bg-primary/20">
                <Database className="h-6 w-6 text-primary" />
              </div>
              <div className="flex-1">
                <h3 className="text-lg font-semibold mb-2">Generate Demo Data</h3>
                <p className="text-muted-foreground mb-4">
                  Populate your CloudOps platform with realistic demo data including 8 clusters across multiple providers,
                  AI-detected incidents with auto-healing actions, and detailed events to see how it works in production.
                </p>
                <div className="bg-background/50 rounded-lg p-3 mb-4 text-sm">
                  <p className="font-medium mb-1">Demo data includes:</p>
                  <ul className="list-disc list-inside text-muted-foreground space-y-1">
                    <li>8 clusters (AWS, GCP, Azure, DigitalOcean, Magalu)</li>
                    <li>15 AI incidents (critical, high, medium, low severity)</li>
                    <li>Auto-healing actions with detailed results</li>
                    <li>Realistic metrics and resource usage</li>
                  </ul>
                </div>
                <Button 
                  onClick={handleGenerateDemoData} 
                  disabled={demoLoading}
                  className="gap-2"
                  size="lg"
                >
                  {demoLoading && <Loader2 className="h-4 w-4 animate-spin" />}
                  {demoLoading ? 'Generating Demo Data...' : 'Generate Demo Data'}
                </Button>
              </div>
            </div>
          </Card>

          {/* AI Savings Data Generator */}
          <Card className="p-6 bg-gradient-to-br from-success/5 to-success/10 border-success/20">
            <div className="flex items-start gap-4">
              <div className="p-3 rounded-lg bg-success/20">
                <Sparkles className="h-6 w-6 text-success" />
              </div>
              <div className="flex-1">
                <h3 className="text-lg font-semibold mb-2">Generate AI Savings Data</h3>
                <p className="text-muted-foreground mb-4">
                  Populate the database with realistic AI cost savings data based on your existing clusters.
                  Creates incidents and corresponding savings records.
                </p>
                <div className="bg-background/50 rounded-lg p-3 mb-4 text-sm">
                  <p className="font-medium mb-1">Generates:</p>
                  <ul className="list-disc list-inside text-muted-foreground space-y-1">
                    <li>AI incidents (pod crashes, resource exhaustion, memory leaks)</li>
                    <li>Cost savings calculations (downtime prevention, optimization)</li>
                    <li>Realistic monetary values and metrics</li>
                    <li>Historical data spread over the last 30 days</li>
                  </ul>
                </div>
                <Button 
                  onClick={handleGenerateAISavings} 
                  disabled={savingsLoading}
                  className="gap-2 bg-success hover:bg-success/90"
                  size="lg"
                >
                  {savingsLoading && <Loader2 className="h-4 w-4 animate-spin" />}
                  {savingsLoading ? 'Generating AI Savings...' : 'Generate AI Savings Data'}
                </Button>
              </div>
            </div>
          </Card>

          {/* Welcome Tutorial Card */}
          <Card className="p-6 bg-gradient-to-br from-accent/5 to-accent/10 border-accent/20">
            <div className="flex items-start gap-4">
              <div className="p-3 rounded-lg bg-accent/20">
                <GraduationCap className="h-6 w-6 text-accent" />
              </div>
              <div className="flex-1">
                <h3 className="text-lg font-semibold mb-2">Tutorial de Boas-Vindas</h3>
                <p className="text-muted-foreground mb-4">
                  Reveja o tutorial interativo que mostra todas as funcionalidades do Kodo e aprenda
                  como aproveitar ao máximo a plataforma.
                </p>
                <Button 
                  onClick={() => navigate('/welcome')} 
                  variant="outline"
                  className="gap-2 border-accent/50 hover:bg-accent/10"
                  size="lg"
                >
                  <GraduationCap className="h-4 w-4" />
                  Ver Tutorial Novamente
                </Button>
              </div>
            </div>
          </Card>

          <Card className="p-6 bg-card border-border">
            <h3 className="text-lg font-semibold text-card-foreground mb-4">Profile Information</h3>
            <form onSubmit={handleSubmit} className="space-y-4">
              <div className="space-y-2">
                <Label htmlFor="email">Email</Label>
                <Input
                  id="email"
                  type="email"
                  value={user?.email || ""}
                  disabled
                  className="bg-muted"
                />
              </div>
              <div className="space-y-2">
                <Label htmlFor="full_name">Full Name</Label>
                <Input
                  id="full_name"
                  value={profile.full_name}
                  onChange={(e) => setProfile({ ...profile, full_name: e.target.value })}
                  placeholder="John Doe"
                />
              </div>
              <div className="space-y-2">
                <Label htmlFor="company">Company</Label>
                <Input
                  id="company"
                  value={profile.company}
                  onChange={(e) => setProfile({ ...profile, company: e.target.value })}
                  placeholder="Acme Inc."
                />
              </div>
              <Button type="submit" disabled={loading}>
                {loading ? "Saving..." : "Save Changes"}
              </Button>
            </form>
          </Card>

          <Card className="p-6 bg-card border-border">
            <h3 className="text-lg font-semibold text-card-foreground mb-4">Account Information</h3>
            <div className="space-y-4 text-sm">
              <div className="flex justify-between py-2 border-b border-border">
                <span className="text-muted-foreground">User ID</span>
                <span className="text-card-foreground font-mono">{user?.id}</span>
              </div>
              <div className="flex justify-between py-2 border-b border-border">
                <span className="text-muted-foreground">Account Created</span>
                <span className="text-card-foreground">
                  {user?.created_at ? new Date(user.created_at).toLocaleDateString() : "N/A"}
                </span>
              </div>
            </div>
          </Card>
        </div>
      </div>
    </DashboardLayout>
  );
};

export default Settings;
