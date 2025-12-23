import { useState } from "react";
import { useAuth } from "@/contexts/AuthContext";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Card } from "@/components/ui/card";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { Dialog, DialogContent, DialogDescription, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import kodoLogo from "@/assets/kodo-logo.png";
import { useNavigate } from "react-router-dom";
import { useEffect } from "react";
import { supabase } from "@/integrations/supabase/client";
import { useToast } from "@/hooks/use-toast";
import { z } from "zod";
import { Sparkles, Shield, Zap, Mail, User } from "lucide-react";
import { AnimatedParticles } from "@/components/AnimatedParticles";
import { Checkbox } from "@/components/ui/checkbox";
import { Link } from "react-router-dom";
import { PasswordInput } from "@/components/PasswordInput";
import { MFAVerification } from "@/components/MFAVerification";
import { BackupCodeVerification } from "@/components/BackupCodeVerification";

// Password validation schema
const passwordSchema = z.string()
  .min(8, 'Password must be at least 8 characters')
  .regex(/[A-Z]/, 'Password must contain at least one uppercase letter')
  .regex(/[a-z]/, 'Password must contain at least one lowercase letter')
  .regex(/[0-9]/, 'Password must contain at least one number');

const Auth = () => {
  const { signIn, signUp, signInWithGoogle, user } = useAuth();
  const navigate = useNavigate();
  const { toast } = useToast();
  const [loading, setLoading] = useState(false);
  const [resetDialogOpen, setResetDialogOpen] = useState(false);
  const [resetEmail, setResetEmail] = useState("");
  const [resetLoading, setResetLoading] = useState(false);
  const [showMFAVerification, setShowMFAVerification] = useState(false);
  const [showBackupCodeVerification, setShowBackupCodeVerification] = useState(false);
  const [googleLoading, setGoogleLoading] = useState(false);

  // Redirect if already logged in
  useEffect(() => {
    if (user) {
      navigate("/dashboard");
    }
  }, [user, navigate]);

  const [signInForm, setSignInForm] = useState({
    email: "",
    password: "",
  });

  const [signUpForm, setSignUpForm] = useState({
    fullName: "",
    email: "",
    password: "",
    confirmPassword: "",
    termsAccepted: false,
    privacyAccepted: false,
    marketingConsent: false,
  });

  const handleSignIn = async (e: React.FormEvent) => {
    e.preventDefault();
    setLoading(true);
    
    try {
      // First, try to sign in
      const { data, error } = await supabase.auth.signInWithPassword({
        email: signInForm.email,
        password: signInForm.password,
      });

      if (error) {
        toast({
          title: "Erro ao entrar",
          description: error.message,
          variant: "destructive",
        });
        setLoading(false);
        return;
      }

      // Check if MFA is required using getAuthenticatorAssuranceLevel
      // This is the recommended approach per Supabase docs - uses JWT/session info
      if (data.session) {
        const { data: aalData, error: aalError } = await supabase.auth.mfa.getAuthenticatorAssuranceLevel();
        
        if (!aalError && aalData) {
          // If currentLevel is aal1 but nextLevel is aal2, user has MFA enrolled but hasn't verified yet
          if (aalData.currentLevel === 'aal1' && aalData.nextLevel === 'aal2') {
            setShowMFAVerification(true);
            setLoading(false);
            return;
          }
        }
      }

      // No MFA required or already verified
      toast({
        title: "Login realizado!",
        description: "Bem-vindo de volta!",
      });
      navigate("/dashboard");
    } catch (err: any) {
      toast({
        title: "Erro",
        description: err.message,
        variant: "destructive",
      });
    } finally {
      setLoading(false);
    }
  };

  const handleMFAVerified = () => {
    setShowMFAVerification(false);
    setShowBackupCodeVerification(false);
    toast({
      title: "Login realizado!",
      description: "Verificação 2FA concluída com sucesso!",
    });
    navigate("/dashboard");
  };

  const handleMFACancel = async () => {
    await supabase.auth.signOut();
    setShowMFAVerification(false);
    setShowBackupCodeVerification(false);
  };

  const handleUseBackupCode = () => {
    setShowMFAVerification(false);
    setShowBackupCodeVerification(true);
  };

  const handleBackToMFA = () => {
    setShowBackupCodeVerification(false);
    setShowMFAVerification(true);
  };

  const handleBackupCodeVerified = () => {
    setShowBackupCodeVerification(false);
    toast({
      title: "Acesso recuperado!",
      description: "Seu 2FA foi desativado. Configure novamente nas configurações.",
    });
    navigate("/dashboard");
  };

  const handleSignUp = async (e: React.FormEvent) => {
    e.preventDefault();
    
    // Validate terms acceptance
    if (!signUpForm.termsAccepted || !signUpForm.privacyAccepted) {
      toast({
        title: "Aceite os termos",
        description: "Você precisa aceitar os Termos de Uso e a Política de Privacidade para continuar.",
        variant: "destructive",
      });
      return;
    }
    
    // Validate password strength
    const passwordValidation = passwordSchema.safeParse(signUpForm.password);
    if (!passwordValidation.success) {
      toast({
        title: "Password too weak",
        description: passwordValidation.error.errors[0].message,
        variant: "destructive",
      });
      return;
    }
    
    if (signUpForm.password !== signUpForm.confirmPassword) {
      toast({
        title: "Passwords don't match",
        description: "Please make sure your passwords match",
        variant: "destructive",
      });
      return;
    }

    setLoading(true);
    
    try {
      const { error } = await signUp(signUpForm.email, signUpForm.password, signUpForm.fullName);
      
      if (!error) {
        // Get user session to save consent
        const { data: { session } } = await supabase.auth.getSession();
        
        if (session?.user) {
          // Save user consent
          await supabase.from('user_consents').insert({
            user_id: session.user.id,
            terms_accepted: signUpForm.termsAccepted,
            privacy_policy_accepted: signUpForm.privacyAccepted,
            marketing_consent: signUpForm.marketingConsent,
            ip_address: null, // Could be captured if needed
            user_agent: navigator.userAgent,
          });
        }
      }
    } catch (error: any) {
      console.error('Error during signup:', error);
    } finally {
      setLoading(false);
    }
  };

  const handleResetPassword = async (e: React.FormEvent) => {
    e.preventDefault();
    setResetLoading(true);

    try {
      const { error } = await supabase.auth.resetPasswordForEmail(resetEmail, {
        redirectTo: `${window.location.origin}/auth?reset=true`,
      });

      if (error) throw error;

      toast({
        title: "Email enviado!",
        description: "Verifique sua caixa de entrada para redefinir sua senha.",
      });

      setResetDialogOpen(false);
      setResetEmail("");
    } catch (error: any) {
      toast({
        title: "Erro ao enviar email",
        description: error.message,
        variant: "destructive",
      });
    } finally {
      setResetLoading(false);
    }
  };

  // Show MFA verification screen if needed
  if (showMFAVerification) {
    return (
      <MFAVerification 
        onVerified={handleMFAVerified} 
        onCancel={handleMFACancel} 
        onUseBackupCode={handleUseBackupCode}
      />
    );
  }

  // Show backup code verification screen if needed
  if (showBackupCodeVerification) {
    return (
      <BackupCodeVerification 
        onVerified={handleBackupCodeVerified} 
        onCancel={handleMFACancel}
        onBackToMFA={handleBackToMFA}
      />
    );
  }

  return (
    <div className="min-h-screen relative bg-background flex items-center justify-center p-4 overflow-hidden">
      {/* Animated Background Grid */}
      <div className="absolute inset-0 bg-grid-pattern opacity-[0.03]" />
      <div className="absolute inset-0 bg-gradient-to-br from-primary/5 via-transparent to-accent/5" />
      
      {/* Animated Particles */}
      <AnimatedParticles />
      
      {/* Floating Orbs */}
      <div className="absolute top-1/4 left-1/4 w-72 h-72 bg-primary/20 rounded-full blur-3xl animate-pulse" style={{ animationDuration: '4s' }} />
      <div className="absolute bottom-1/4 right-1/4 w-96 h-96 bg-accent/20 rounded-full blur-3xl animate-pulse" style={{ animationDuration: '6s' }} />
      
      <div className="w-full max-w-md space-y-8 relative z-10 animate-in fade-in slide-in-from-bottom-4 duration-1000">
        {/* Header */}
        <div className="text-center space-y-6">
          <div className="inline-flex relative group">
            <div className="absolute inset-0 bg-gradient-primary rounded-full blur-2xl opacity-50 group-hover:opacity-75 transition-opacity" />
            <img 
              src={kodoLogo} 
              alt="Kodo Logo" 
              className="w-24 h-24 object-contain relative z-10 drop-shadow-2xl"
            />
          </div>
          
          <div className="space-y-3">
            <h1 className="text-4xl font-bold tracking-tight">
              <span className="bg-gradient-primary bg-clip-text text-transparent drop-shadow-sm">
                Kodo
              </span>
            </h1>
            <div className="flex items-center justify-center gap-2 text-muted-foreground">
              <Sparkles className="w-4 h-4" />
              <p className="text-sm font-medium">
                AI-Powered Multi-Cloud Infrastructure Management
              </p>
            </div>
            
            {/* Feature Pills */}
            <div className="flex flex-wrap gap-2 justify-center pt-2">
              <div className="flex items-center gap-1.5 px-3 py-1 rounded-full bg-primary/10 border border-primary/20">
                <Shield className="w-3 h-3 text-primary" />
                <span className="text-xs font-medium text-primary">Secure</span>
              </div>
              <div className="flex items-center gap-1.5 px-3 py-1 rounded-full bg-accent/10 border border-accent/20">
                <Zap className="w-3 h-3 text-accent" />
                <span className="text-xs font-medium text-accent">Fast</span>
              </div>
              <div className="flex items-center gap-1.5 px-3 py-1 rounded-full bg-primary/10 border border-primary/20">
                <Sparkles className="w-3 h-3 text-primary" />
                <span className="text-xs font-medium text-primary">Smart</span>
              </div>
            </div>
          </div>
        </div>

        {/* Auth Card */}
        <Card className="p-6 bg-card/50 backdrop-blur-2xl border-border/50 shadow-2xl hover:shadow-primary/10 transition-all duration-500">
          <Tabs defaultValue="signin" className="w-full">
            <TabsList className="grid w-full grid-cols-2">
              <TabsTrigger value="signin">Sign In</TabsTrigger>
              <TabsTrigger value="signup">Sign Up</TabsTrigger>
            </TabsList>

            <TabsContent value="signin">
              <form onSubmit={handleSignIn} className="space-y-5 pt-2">
                <div className="space-y-2">
                  <Label htmlFor="signin-email" className="text-foreground font-medium">Email</Label>
                  <div className="relative group">
                    <Mail className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-muted-foreground group-focus-within:text-primary transition-colors" />
                    <Input
                      id="signin-email"
                      type="email"
                      placeholder="your@email.com"
                      required
                      value={signInForm.email}
                      onChange={(e) =>
                        setSignInForm({ ...signInForm, email: e.target.value })
                      }
                      className="pl-10 bg-background/50 border-border/50 focus:border-primary/50 focus:bg-background transition-all"
                    />
                  </div>
                </div>
                <div className="space-y-2">
                  <Label htmlFor="signin-password" className="text-foreground font-medium">Password</Label>
                  <PasswordInput
                    id="signin-password"
                    value={signInForm.password}
                    onChange={(value) => setSignInForm({ ...signInForm, password: value })}
                    required
                  />
                </div>
                <Button 
                  type="submit" 
                  className="w-full bg-gradient-primary hover:opacity-90 transition-all shadow-lg hover:shadow-primary/50" 
                  disabled={loading}
                >
                  {loading ? (
                    <span className="flex items-center gap-2">
                      <span className="w-4 h-4 border-2 border-background/30 border-t-background rounded-full animate-spin" />
                      Signing in...
                    </span>
                  ) : (
                    "Sign In"
                  )}
                </Button>

                {/* Divider */}
                <div className="relative my-4">
                  <div className="absolute inset-0 flex items-center">
                    <span className="w-full border-t border-border/50" />
                  </div>
                  <div className="relative flex justify-center text-xs uppercase">
                    <span className="bg-card px-2 text-muted-foreground">ou continue com</span>
                  </div>
                </div>

                {/* Google Sign In Button */}
                <Button
                  type="button"
                  variant="outline"
                  className="w-full gap-2 bg-background/50 hover:bg-background border-border/50 hover:border-primary/30 transition-all"
                  onClick={async () => {
                    setGoogleLoading(true);
                    await signInWithGoogle();
                    setGoogleLoading(false);
                  }}
                  disabled={googleLoading}
                >
                  {googleLoading ? (
                    <span className="w-4 h-4 border-2 border-muted-foreground/30 border-t-muted-foreground rounded-full animate-spin" />
                  ) : (
                    <svg className="w-5 h-5" viewBox="0 0 24 24">
                      <path
                        fill="#4285F4"
                        d="M22.56 12.25c0-.78-.07-1.53-.2-2.25H12v4.26h5.92c-.26 1.37-1.04 2.53-2.21 3.31v2.77h3.57c2.08-1.92 3.28-4.74 3.28-8.09z"
                      />
                      <path
                        fill="#34A853"
                        d="M12 23c2.97 0 5.46-.98 7.28-2.66l-3.57-2.77c-.98.66-2.23 1.06-3.71 1.06-2.86 0-5.29-1.93-6.16-4.53H2.18v2.84C3.99 20.53 7.7 23 12 23z"
                      />
                      <path
                        fill="#FBBC05"
                        d="M5.84 14.09c-.22-.66-.35-1.36-.35-2.09s.13-1.43.35-2.09V7.07H2.18C1.43 8.55 1 10.22 1 12s.43 3.45 1.18 4.93l2.85-2.22.81-.62z"
                      />
                      <path
                        fill="#EA4335"
                        d="M12 5.38c1.62 0 3.06.56 4.21 1.64l3.15-3.15C17.45 2.09 14.97 1 12 1 7.7 1 3.99 3.47 2.18 7.07l3.66 2.84c.87-2.6 3.3-4.53 6.16-4.53z"
                      />
                    </svg>
                  )}
                  Continuar com Google
                </Button>

                <div className="text-center mt-2">
                  <button
                    type="button"
                    onClick={() => setResetDialogOpen(true)}
                    className="text-sm text-primary hover:text-primary/80 hover:underline transition-colors"
                  >
                    Esqueci minha senha
                  </button>
                </div>
              </form>
            </TabsContent>

            <TabsContent value="signup">
              <form onSubmit={handleSignUp} className="space-y-4 pt-2">
                <div className="space-y-2">
                  <Label htmlFor="signup-name" className="text-foreground font-medium">Full Name</Label>
                  <div className="relative group">
                    <User className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-muted-foreground group-focus-within:text-primary transition-colors" />
                    <Input
                      id="signup-name"
                      type="text"
                      placeholder="John Doe"
                      required
                      value={signUpForm.fullName}
                      onChange={(e) =>
                        setSignUpForm({ ...signUpForm, fullName: e.target.value })
                      }
                      className="pl-10 bg-background/50 border-border/50 focus:border-primary/50 focus:bg-background transition-all"
                    />
                  </div>
                </div>
                <div className="space-y-2">
                  <Label htmlFor="signup-email" className="text-foreground font-medium">Email</Label>
                  <div className="relative group">
                    <Mail className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-muted-foreground group-focus-within:text-primary transition-colors" />
                    <Input
                      id="signup-email"
                      type="email"
                      placeholder="your@email.com"
                      required
                      value={signUpForm.email}
                      onChange={(e) =>
                        setSignUpForm({ ...signUpForm, email: e.target.value })
                      }
                      className="pl-10 bg-background/50 border-border/50 focus:border-primary/50 focus:bg-background transition-all"
                    />
                  </div>
                </div>
                <div className="space-y-2">
                  <Label htmlFor="signup-password" className="text-foreground font-medium">Password</Label>
                  <PasswordInput
                    id="signup-password"
                    value={signUpForm.password}
                    onChange={(value) => setSignUpForm({ ...signUpForm, password: value })}
                    required
                    minLength={6}
                  />
                </div>
                <div className="space-y-2">
                  <Label htmlFor="signup-confirm" className="text-foreground font-medium">Confirm Password</Label>
                  <PasswordInput
                    id="signup-confirm"
                    value={signUpForm.confirmPassword}
                    onChange={(value) => setSignUpForm({ ...signUpForm, confirmPassword: value })}
                    required
                    minLength={6}
                  />
                </div>

                {/* LGPD Consents */}
                <div className="space-y-3 pt-2 border-t border-border/50">
                  <div className="flex items-start space-x-2">
                    <Checkbox
                      id="terms"
                      checked={signUpForm.termsAccepted}
                      onCheckedChange={(checked) =>
                        setSignUpForm({ ...signUpForm, termsAccepted: checked === true })
                      }
                      className="mt-1"
                    />
                    <label
                      htmlFor="terms"
                      className="text-sm text-foreground leading-relaxed cursor-pointer"
                    >
                      Eu li e aceito os{" "}
                      <Link
                        to="/terms"
                        target="_blank"
                        className="text-primary hover:text-primary/80 underline font-medium"
                      >
                        Termos de Uso
                      </Link>
                      {" "}*
                    </label>
                  </div>

                  <div className="flex items-start space-x-2">
                    <Checkbox
                      id="privacy"
                      checked={signUpForm.privacyAccepted}
                      onCheckedChange={(checked) =>
                        setSignUpForm({ ...signUpForm, privacyAccepted: checked === true })
                      }
                      className="mt-1"
                    />
                    <label
                      htmlFor="privacy"
                      className="text-sm text-foreground leading-relaxed cursor-pointer"
                    >
                      Eu li e aceito a{" "}
                      <Link
                        to="/privacy"
                        target="_blank"
                        className="text-primary hover:text-primary/80 underline font-medium"
                      >
                        Política de Privacidade
                      </Link>
                      {" "}*
                    </label>
                  </div>

                  <div className="flex items-start space-x-2">
                    <Checkbox
                      id="marketing"
                      checked={signUpForm.marketingConsent}
                      onCheckedChange={(checked) =>
                        setSignUpForm({ ...signUpForm, marketingConsent: checked === true })
                      }
                      className="mt-1"
                    />
                    <label
                      htmlFor="marketing"
                      className="text-sm text-muted-foreground leading-relaxed cursor-pointer"
                    >
                      Desejo receber novidades e atualizações por e-mail (opcional)
                    </label>
                  </div>

                  <p className="text-xs text-muted-foreground">
                    * Campos obrigatórios
                  </p>
                </div>

                <Button 
                  type="submit" 
                  className="w-full bg-gradient-primary hover:opacity-90 transition-all shadow-lg hover:shadow-primary/50" 
                  disabled={loading}
                >
                  {loading ? (
                    <span className="flex items-center gap-2">
                      <span className="w-4 h-4 border-2 border-background/30 border-t-background rounded-full animate-spin" />
                      Creating account...
                    </span>
                  ) : (
                    "Create Account"
                  )}
                </Button>

                {/* Divider */}
                <div className="relative my-4">
                  <div className="absolute inset-0 flex items-center">
                    <span className="w-full border-t border-border/50" />
                  </div>
                  <div className="relative flex justify-center text-xs uppercase">
                    <span className="bg-card px-2 text-muted-foreground">ou continue com</span>
                  </div>
                </div>

                {/* Google Sign Up Button */}
                <Button
                  type="button"
                  variant="outline"
                  className="w-full gap-2 bg-background/50 hover:bg-background border-border/50 hover:border-primary/30 transition-all"
                  onClick={async () => {
                    setGoogleLoading(true);
                    await signInWithGoogle();
                    setGoogleLoading(false);
                  }}
                  disabled={googleLoading}
                >
                  {googleLoading ? (
                    <span className="w-4 h-4 border-2 border-muted-foreground/30 border-t-muted-foreground rounded-full animate-spin" />
                  ) : (
                    <svg className="w-5 h-5" viewBox="0 0 24 24">
                      <path
                        fill="#4285F4"
                        d="M22.56 12.25c0-.78-.07-1.53-.2-2.25H12v4.26h5.92c-.26 1.37-1.04 2.53-2.21 3.31v2.77h3.57c2.08-1.92 3.28-4.74 3.28-8.09z"
                      />
                      <path
                        fill="#34A853"
                        d="M12 23c2.97 0 5.46-.98 7.28-2.66l-3.57-2.77c-.98.66-2.23 1.06-3.71 1.06-2.86 0-5.29-1.93-6.16-4.53H2.18v2.84C3.99 20.53 7.7 23 12 23z"
                      />
                      <path
                        fill="#FBBC05"
                        d="M5.84 14.09c-.22-.66-.35-1.36-.35-2.09s.13-1.43.35-2.09V7.07H2.18C1.43 8.55 1 10.22 1 12s.43 3.45 1.18 4.93l2.85-2.22.81-.62z"
                      />
                      <path
                        fill="#EA4335"
                        d="M12 5.38c1.62 0 3.06.56 4.21 1.64l3.15-3.15C17.45 2.09 14.97 1 12 1 7.7 1 3.99 3.47 2.18 7.07l3.66 2.84c.87-2.6 3.3-4.53 6.16-4.53z"
                      />
                    </svg>
                  )}
                  Cadastrar com Google
                </Button>
              </form>
            </TabsContent>
          </Tabs>
        </Card>

        <Dialog open={resetDialogOpen} onOpenChange={setResetDialogOpen}>
          <DialogContent>
            <DialogHeader>
              <DialogTitle>Recuperar senha</DialogTitle>
              <DialogDescription>
                Digite seu email para receber um link de recuperação de senha.
              </DialogDescription>
            </DialogHeader>
            <form onSubmit={handleResetPassword} className="space-y-4">
              <div className="space-y-2">
                <Label htmlFor="reset-email">Email</Label>
                <Input
                  id="reset-email"
                  type="email"
                  placeholder="your@email.com"
                  required
                  value={resetEmail}
                  onChange={(e) => setResetEmail(e.target.value)}
                />
              </div>
              <div className="flex gap-2">
                <Button
                  type="button"
                  variant="outline"
                  className="w-full"
                  onClick={() => setResetDialogOpen(false)}
                  disabled={resetLoading}
                >
                  Cancelar
                </Button>
                <Button type="submit" className="w-full" disabled={resetLoading}>
                  {resetLoading ? "Enviando..." : "Enviar link"}
                </Button>
              </div>
            </form>
          </DialogContent>
        </Dialog>
      </div>
    </div>
  );
};

export default Auth;
