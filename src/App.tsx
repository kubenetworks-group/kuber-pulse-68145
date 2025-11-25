import { Toaster } from "@/components/ui/toaster";
import { Toaster as Sonner } from "@/components/ui/sonner";
import { TooltipProvider } from "@/components/ui/tooltip";
import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import { BrowserRouter, Routes, Route } from "react-router-dom";
import { AuthProvider } from "@/contexts/AuthContext";
import { ClusterProvider } from "@/contexts/ClusterContext";
import { ProtectedRoute } from "@/components/ProtectedRoute";
import Index from "./pages/Index";
import Auth from "./pages/Auth";
import Clusters from "./pages/Clusters";
import AIMonitor from "./pages/AIMonitor";
import Costs from "./pages/Costs";
import Storage from "./pages/Storage";
import Settings from "./pages/Settings";
import Agents from "./pages/Agents";
import NotFound from "./pages/NotFound";

const queryClient = new QueryClient();

const App = () => (
  <QueryClientProvider client={queryClient}>
    <TooltipProvider>
      <Toaster />
      <Sonner />
      <BrowserRouter>
        <AuthProvider>
          <ClusterProvider>
            <Routes>
              <Route path="/auth" element={<Auth />} />
              <Route
                path="/"
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
              <Route path="*" element={<NotFound />} />
            </Routes>
          </ClusterProvider>
        </AuthProvider>
      </BrowserRouter>
    </TooltipProvider>
  </QueryClientProvider>
);

export default App;
