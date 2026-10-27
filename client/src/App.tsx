import { useEffect } from "react";
import { Switch, Route, useLocation } from "wouter";
import { queryClient } from "./lib/queryClient";
import { QueryClientProvider } from "@tanstack/react-query";
import { Toaster } from "@/components/ui/toaster";
import { TooltipProvider } from "@/components/ui/tooltip";
import NotFound from "@/pages/not-found";
import ScriptsPage from "@/pages/scripts-page";
import TeleprompterPage from "@/pages/teleprompter-page";
import LoginPage from "@/pages/login-page";
import { useAuth } from "@/hooks/use-auth";
import { Loader2 } from "lucide-react";

function SsoHandler() {
  const { sso } = useAuth();
  const [, setLocation] = useLocation();

  useEffect(() => {
    const params = new URLSearchParams(window.location.search);
    const ssoToken = params.get("sso_token");
    if (ssoToken) {
      sso.mutateAsync(ssoToken).then(() => {
        window.history.replaceState({}, "", "/");
        setLocation("/");
      }).catch(() => {
        window.history.replaceState({}, "", "/");
      });
    }
  }, []);

  return null;
}

function AuthenticatedRouter() {
  const { isAuthenticated, isLoading } = useAuth();

  if (isLoading) {
    return (
      <div className="min-h-screen bg-black flex items-center justify-center" data-testid="loading-auth">
        <Loader2 className="h-8 w-8 animate-spin text-blue-500" />
      </div>
    );
  }

  if (!isAuthenticated) {
    return <LoginPage />;
  }

  return (
    <Switch>
      <Route path="/" component={ScriptsPage} />
      <Route path="/teleprompter/:id" component={TeleprompterPage} />
      <Route component={NotFound} />
    </Switch>
  );
}

function App() {
  return (
    <QueryClientProvider client={queryClient}>
      <TooltipProvider>
        <Toaster />
        <SsoHandler />
        <AuthenticatedRouter />
      </TooltipProvider>
    </QueryClientProvider>
  );
}

export default App;
