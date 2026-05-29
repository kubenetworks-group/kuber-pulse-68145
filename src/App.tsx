import { Toaster } from "@/components/ui/toaster";
import { Toaster as Sonner } from "@/components/ui/sonner";
import { TooltipProvider } from "@/components/ui/tooltip";
import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import { BrowserRouter, Routes, Route } from "react-router-dom";
import { AuthProvider, useAuth } from "@/contexts/AuthContext";
import { ClusterProvider } from "@/contexts/ClusterContext";
import { SubscriptionProvider } from "@/contexts/SubscriptionContext";
import { ProtectedRoute } from "@/components/ProtectedRoute";
import { SessionExpiredDialog } from "@/components/SessionExpiredDialog";
import { AdminProtectedRoute } from "@/components/AdminProtectedRoute";
import Index from "./pages/Index";
import Auth from "./pages/Auth";
import LandingPage from "./pages/LandingPage";
import About from "./pages/About";
import Welcome from "./pages/Welcome";
import Clusters from "./pages/Clusters";
import AIMonitor from "./pages/AIMonitor";
import RiskPanel from "./pages/RiskPanel";
import RiskThreats from "./pages/risk/RiskThreats";
import RiskRisks from "./pages/risk/RiskRisks";
import RiskHealth from "./pages/risk/RiskHealth";
import RiskLoadBalancer from "./pages/risk/RiskLoadBalancer";
import RiskObservability from "./pages/risk/RiskObservability";
import RiskAudit from "./pages/risk/RiskAudit";
import Costs from "./pages/Costs";
import Storage from "./pages/Storage";
import Settings from "./pages/Settings";
import Agents from "./pages/Agents";
import AISavings from "./pages/AISavings";
import Observability from "./pages/Observability";
import KubernetesPods from "./pages/KubernetesPods";
import KubernetesServices from "./pages/KubernetesServices";
import KubernetesIngress from "./pages/KubernetesIngress";
import KubernetesDeployments from "./pages/KubernetesDeployments";
import KubernetesDaemonSets from "./pages/KubernetesDaemonSets";
import KubernetesStatefulSets from "./pages/KubernetesStatefulSets";
import KubernetesJobs from "./pages/KubernetesJobs";
import KubernetesCronJobs from "./pages/KubernetesCronJobs";
import KubernetesNetworkPolicies from "./pages/KubernetesNetworkPolicies";
import KubernetesPVCs from "./pages/KubernetesPVCs";
import KubernetesVolumes from "./pages/KubernetesVolumes";
import PlansComparison from "./pages/PlansComparison";
import Pricing from "./pages/Pricing";
import TermsOfService from "./pages/TermsOfService";
import PrivacyPolicy from "./pages/PrivacyPolicy";
import NotFound from "./pages/NotFound";
import AdminDashboard from "./pages/AdminDashboard";
import Migration from "./pages/Migration";
import Developer from "./pages/Developer";
import Diagnostico from "./pages/Diagnostico";
import BlogIndex from "./pages/blog/BlogIndex";
import KubernetesIA from "./pages/blog/KubernetesIA";
import AutoHealingKubernetes from "./pages/blog/AutoHealingKubernetes";
import FinOpsKubernetes from "./pages/blog/FinOpsKubernetes";
import KodoVsAlternatives from "./pages/blog/KodoVsAlternatives";
import { CookieBanner } from "@/components/CookieBanner";
import RegisterProfile from "./pages/RegisterProfile";

const queryClient = new QueryClient();

// Must be inside AuthProvider to access context
const SessionGuard = ({ children }: { children: React.ReactNode }) => {
  const { sessionExpired, onSessionRenewed, signOut } = useAuth();
  return (
    <>
      {children}
      <SessionExpiredDialog
        open={sessionExpired}
        onRenewed={onSessionRenewed}
        onSignOut={signOut}
      />
    </>
  );
};

const App = () => (
  <QueryClientProvider client={queryClient}>
    <TooltipProvider>
      <Toaster />
      <Sonner />
      <BrowserRouter>
        <CookieBanner />
        <AuthProvider>
          <SessionGuard>
          <SubscriptionProvider>
            <ClusterProvider>
              <Routes>
                <Route path="/" element={<LandingPage />} />
                <Route path="/sobre" element={<About />} />
                <Route path="/auth" element={<Auth />} />
                <Route
                  path="/register"
                  element={
                    <ProtectedRoute>
                      <RegisterProfile />
                    </ProtectedRoute>
                  }
                />
                <Route
                  path="/welcome"
                  element={
                    <ProtectedRoute>
                      <Welcome />
                    </ProtectedRoute>
                  }
                />
                <Route
                  path="/dashboard"
                  element={
                    <ProtectedRoute>
                      <Index />
                    </ProtectedRoute>
                  }
                />
                <Route
                  path="/clusters"
                  element={
                    <ProtectedRoute>
                      <Clusters />
                    </ProtectedRoute>
                  }
                />
                <Route
                  path="/ai-monitor"
                  element={
                    <ProtectedRoute>
                      <AIMonitor />
                    </ProtectedRoute>
                  }
                />
                <Route path="/risk" element={<ProtectedRoute><RiskPanel /></ProtectedRoute>} />
                <Route path="/risk/threats" element={<ProtectedRoute><RiskThreats /></ProtectedRoute>} />
                <Route path="/risk/risks" element={<ProtectedRoute><RiskRisks /></ProtectedRoute>} />
                <Route path="/risk/health" element={<ProtectedRoute><RiskHealth /></ProtectedRoute>} />
                <Route path="/risk/loadbalancer" element={<ProtectedRoute><RiskLoadBalancer /></ProtectedRoute>} />
                <Route path="/risk/observability" element={<ProtectedRoute><RiskObservability /></ProtectedRoute>} />
                <Route path="/risk/audit" element={<ProtectedRoute><RiskAudit /></ProtectedRoute>} />
                <Route
                  path="/costs"
                  element={
                    <ProtectedRoute>
                      <Costs />
                    </ProtectedRoute>
                  }
                />
                <Route
                  path="/storage"
                  element={
                    <ProtectedRoute>
                      <Storage />
                    </ProtectedRoute>
                  }
                />
                <Route
                  path="/settings"
                  element={
                    <ProtectedRoute>
                      <Settings />
                    </ProtectedRoute>
                  }
                />
                <Route
                  path="/agents"
                  element={
                    <ProtectedRoute>
                      <Agents />
                    </ProtectedRoute>
                  }
                />
                <Route
                  path="/migration"
                  element={
                    <ProtectedRoute>
                      <Migration />
                    </ProtectedRoute>
                  }
                />
                <Route
                  path="/developer"
                  element={
                    <ProtectedRoute>
                      <Developer />
                    </ProtectedRoute>
                  }
                />
                <Route
                  path="/pricing"
                  element={
                    <ProtectedRoute>
                      <Pricing />
                    </ProtectedRoute>
                  }
                />
                <Route
                  path="/ai-savings"
                  element={
                    <ProtectedRoute>
                      <AISavings />
                    </ProtectedRoute>
                  }
                />
                <Route
                  path="/observability"
                  element={
                    <ProtectedRoute>
                      <Observability />
                    </ProtectedRoute>
                  }
                />
                <Route
                  path="/kubernetes/pods"
                  element={
                    <ProtectedRoute>
                      <KubernetesPods />
                    </ProtectedRoute>
                  }
                />
                <Route
                  path="/kubernetes/services"
                  element={
                    <ProtectedRoute>
                      <KubernetesServices />
                    </ProtectedRoute>
                  }
                />
                <Route
                  path="/kubernetes/ingress"
                  element={
                    <ProtectedRoute>
                      <KubernetesIngress />
                    </ProtectedRoute>
                  }
                />
                <Route
                  path="/kubernetes/deployments"
                  element={
                    <ProtectedRoute>
                      <KubernetesDeployments />
                    </ProtectedRoute>
                  }
                />
                <Route
                  path="/kubernetes/daemonsets"
                  element={
                    <ProtectedRoute>
                      <KubernetesDaemonSets />
                    </ProtectedRoute>
                  }
                />
                <Route
                  path="/kubernetes/statefulsets"
                  element={
                    <ProtectedRoute>
                      <KubernetesStatefulSets />
                    </ProtectedRoute>
                  }
                />
                <Route
                  path="/kubernetes/jobs"
                  element={
                    <ProtectedRoute>
                      <KubernetesJobs />
                    </ProtectedRoute>
                  }
                />
                <Route
                  path="/kubernetes/cronjobs"
                  element={
                    <ProtectedRoute>
                      <KubernetesCronJobs />
                    </ProtectedRoute>
                  }
                />
                <Route
                  path="/kubernetes/networkpolicies"
                  element={
                    <ProtectedRoute>
                      <KubernetesNetworkPolicies />
                    </ProtectedRoute>
                  }
                />
                <Route
                  path="/kubernetes/pvcs"
                  element={
                    <ProtectedRoute>
                      <KubernetesPVCs />
                    </ProtectedRoute>
                  }
                />
                <Route
                  path="/kubernetes/volumes"
                  element={
                    <ProtectedRoute>
                      <KubernetesVolumes />
                    </ProtectedRoute>
                  }
                />
                <Route
                  path="/admin"
                  element={
                    <AdminProtectedRoute>
                      <AdminDashboard />
                    </AdminProtectedRoute>
                  }
                />
                <Route path="/diagnostico" element={<Diagnostico />} />
                <Route path="/blog" element={<BlogIndex />} />
                <Route path="/blog/kubernetes-ia" element={<KubernetesIA />} />
                <Route path="/blog/auto-healing-kubernetes" element={<AutoHealingKubernetes />} />
                <Route path="/blog/finops-kubernetes" element={<FinOpsKubernetes />} />
                <Route path="/blog/kodo-vs-k8sgpt-kubectl-ai" element={<KodoVsAlternatives />} />
                <Route path="/plans" element={<PlansComparison />} />
                <Route path="/terms" element={<TermsOfService />} />
                <Route path="/privacy" element={<PrivacyPolicy />} />
                <Route path="*" element={<NotFound />} />
              </Routes>
            </ClusterProvider>
          </SubscriptionProvider>
          </SessionGuard>
        </AuthProvider>
      </BrowserRouter>
    </TooltipProvider>
  </QueryClientProvider>
);

export default App;
