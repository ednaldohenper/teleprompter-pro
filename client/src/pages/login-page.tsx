import { useState } from "react";
import { useAuth } from "@/hooks/use-auth";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from "@/components/ui/card";
import { useToast } from "@/hooks/use-toast";
import { Loader2, Eye, EyeOff } from "lucide-react";
import { apiRequest } from "@/lib/queryClient";

export default function LoginPage() {
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [showPassword, setShowPassword] = useState(false);
  const [mode, setMode] = useState<"login" | "forgot" | "reset">("login");
  const [resetToken, setResetToken] = useState("");
  const [newPassword, setNewPassword] = useState("");
  const [forgotLoading, setForgotLoading] = useState(false);
  const [resetLoading, setResetLoading] = useState(false);
  const { login } = useAuth();
  const { toast } = useToast();

  const params = new URLSearchParams(window.location.search);
  const resetTokenFromUrl = params.get("token");
  if (resetTokenFromUrl && mode !== "reset") {
    setMode("reset");
    setResetToken(resetTokenFromUrl);
  }

  async function handleLogin(e: React.FormEvent) {
    e.preventDefault();
    try {
      await login.mutateAsync({ email, password });
    } catch (err: any) {
      let description = "Tente novamente";
      try {
        const raw = err.message || "";
        const jsonStart = raw.indexOf("{");
        if (jsonStart !== -1) {
          const parsed = JSON.parse(raw.slice(jsonStart));
          description = parsed.message || description;
        } else {
          description = raw || description;
        }
      } catch {
        description = err.message || description;
      }
      toast({
        title: "Erro ao entrar",
        description,
        variant: "destructive",
      });
    }
  }

  async function handleForgotPassword(e: React.FormEvent) {
    e.preventDefault();
    setForgotLoading(true);
    try {
      await apiRequest("POST", "/api/auth/forgot-password", { email });
      toast({
        title: "E-mail enviado",
        description: "Verifique sua caixa de entrada para redefinir sua senha.",
      });
      setMode("login");
    } catch (err: any) {
      toast({
        title: "Erro",
        description: err.message || "Não foi possível enviar o e-mail",
        variant: "destructive",
      });
    } finally {
      setForgotLoading(false);
    }
  }

  async function handleResetPassword(e: React.FormEvent) {
    e.preventDefault();
    setResetLoading(true);
    try {
      await apiRequest("POST", "/api/auth/reset-password", {
        token: resetToken || resetTokenFromUrl,
        newPassword,
      });
      toast({
        title: "Senha redefinida",
        description: "Agora você pode entrar com sua nova senha.",
      });
      setMode("login");
      window.history.replaceState({}, "", "/");
    } catch (err: any) {
      toast({
        title: "Erro",
        description: err.message || "Token inválido ou expirado",
        variant: "destructive",
      });
    } finally {
      setResetLoading(false);
    }
  }

  return (
    <div className="min-h-screen bg-gradient-to-br from-gray-900 via-black to-gray-900 flex items-center justify-center p-4" data-testid="login-page">
      <Card className="w-full max-w-md bg-gray-900 border-gray-800">
        <CardHeader className="text-center">
          <CardTitle className="text-2xl text-white" data-testid="text-login-title">
            TelePrompter Pro
          </CardTitle>
          <CardDescription className="text-gray-400">
            {mode === "login" && "Entre com suas credenciais do FOCO360"}
            {mode === "forgot" && "Informe seu e-mail para redefinir a senha"}
            {mode === "reset" && "Defina sua nova senha"}
          </CardDescription>
        </CardHeader>
        <CardContent>
          {mode === "login" && (
            <form onSubmit={handleLogin} className="space-y-4">
              <div>
                <Input
                  type="email"
                  placeholder="E-mail"
                  value={email}
                  onChange={(e) => setEmail(e.target.value)}
                  required
                  className="bg-gray-800 border-gray-700 text-white placeholder:text-gray-500"
                  data-testid="input-email"
                />
              </div>
              <div className="relative">
                <Input
                  type={showPassword ? "text" : "password"}
                  placeholder="Senha"
                  value={password}
                  onChange={(e) => setPassword(e.target.value)}
                  required
                  className="bg-gray-800 border-gray-700 text-white placeholder:text-gray-500 pr-10"
                  data-testid="input-password"
                />
                <button
                  type="button"
                  onClick={() => setShowPassword(!showPassword)}
                  className="absolute right-3 top-1/2 -translate-y-1/2 text-gray-400 hover:text-white"
                  data-testid="button-toggle-password"
                >
                  {showPassword ? <EyeOff className="h-4 w-4" /> : <Eye className="h-4 w-4" />}
                </button>
              </div>
              <Button
                type="submit"
                className="w-full bg-blue-600 hover:bg-blue-700"
                disabled={login.isPending}
                data-testid="button-login"
              >
                {login.isPending ? (
                  <><Loader2 className="mr-2 h-4 w-4 animate-spin" /> Entrando...</>
                ) : (
                  "Entrar"
                )}
              </Button>
              <button
                type="button"
                onClick={() => setMode("forgot")}
                className="w-full text-sm text-gray-400 hover:text-blue-400 transition-colors"
                data-testid="link-forgot-password"
              >
                Esqueceu sua senha?
              </button>
            </form>
          )}

          {mode === "forgot" && (
            <form onSubmit={handleForgotPassword} className="space-y-4">
              <div>
                <Input
                  type="email"
                  placeholder="E-mail"
                  value={email}
                  onChange={(e) => setEmail(e.target.value)}
                  required
                  className="bg-gray-800 border-gray-700 text-white placeholder:text-gray-500"
                  data-testid="input-forgot-email"
                />
              </div>
              <Button
                type="submit"
                className="w-full bg-blue-600 hover:bg-blue-700"
                disabled={forgotLoading}
                data-testid="button-send-reset"
              >
                {forgotLoading ? (
                  <><Loader2 className="mr-2 h-4 w-4 animate-spin" /> Enviando...</>
                ) : (
                  "Enviar e-mail de recuperação"
                )}
              </Button>
              <button
                type="button"
                onClick={() => setMode("login")}
                className="w-full text-sm text-gray-400 hover:text-blue-400 transition-colors"
                data-testid="link-back-to-login"
              >
                Voltar ao login
              </button>
            </form>
          )}

          {mode === "reset" && (
            <form onSubmit={handleResetPassword} className="space-y-4">
              <div>
                <Input
                  type="password"
                  placeholder="Nova senha"
                  value={newPassword}
                  onChange={(e) => setNewPassword(e.target.value)}
                  required
                  minLength={6}
                  className="bg-gray-800 border-gray-700 text-white placeholder:text-gray-500"
                  data-testid="input-new-password"
                />
              </div>
              <Button
                type="submit"
                className="w-full bg-blue-600 hover:bg-blue-700"
                disabled={resetLoading}
                data-testid="button-reset-password"
              >
                {resetLoading ? (
                  <><Loader2 className="mr-2 h-4 w-4 animate-spin" /> Redefinindo...</>
                ) : (
                  "Redefinir senha"
                )}
              </Button>
              <button
                type="button"
                onClick={() => { setMode("login"); window.history.replaceState({}, "", "/"); }}
                className="w-full text-sm text-gray-400 hover:text-blue-400 transition-colors"
                data-testid="link-back-to-login-from-reset"
              >
                Voltar ao login
              </button>
            </form>
          )}
        </CardContent>
      </Card>
    </div>
  );
}
