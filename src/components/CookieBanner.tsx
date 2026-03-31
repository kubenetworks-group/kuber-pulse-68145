import { useState, useEffect } from "react";
import { Button } from "@/components/ui/button";
import { Link } from "react-router-dom";
import { Cookie, ChevronDown, ChevronUp, X } from "lucide-react";
import { Switch } from "@/components/ui/switch";
import { Label } from "@/components/ui/label";

const STORAGE_KEY = "kodo-cookie-consent";

interface CookiePreferences {
  essential: boolean;
  analytics: boolean;
  marketing: boolean;
  savedAt: string;
}

export function CookieBanner() {
  const [visible, setVisible] = useState(false);
  const [expanded, setExpanded] = useState(false);
  const [preferences, setPreferences] = useState({
    analytics: true,
    marketing: false,
  });

  useEffect(() => {
    const stored = localStorage.getItem(STORAGE_KEY);
    if (!stored) {
      setVisible(true);
    }
  }, []);

  const save = (analytics: boolean, marketing: boolean) => {
    const consent: CookiePreferences = {
      essential: true,
      analytics,
      marketing,
      savedAt: new Date().toISOString(),
    };
    localStorage.setItem(STORAGE_KEY, JSON.stringify(consent));
    setVisible(false);
  };

  const acceptAll = () => save(true, true);
  const acceptEssential = () => save(false, false);
  const saveCustom = () => save(preferences.analytics, preferences.marketing);

  if (!visible) return null;

  return (
    <div className="fixed bottom-0 left-0 right-0 z-50 p-4 sm:p-6">
      <div className="max-w-4xl mx-auto bg-card border border-border rounded-xl shadow-2xl">
        <div className="p-4 sm:p-6">
          <div className="flex items-start gap-3 mb-4">
            <div className="p-2 rounded-lg bg-primary/10 shrink-0">
              <Cookie className="w-5 h-5 text-primary" />
            </div>
            <div className="flex-1">
              <h3 className="font-semibold text-base mb-1">Utilizamos cookies</h3>
              <p className="text-sm text-muted-foreground">
                Usamos cookies e tecnologias similares para garantir o funcionamento da plataforma,
                analisar o uso e, com seu consentimento, personalizar conteúdo. Em conformidade com
                a{" "}
                <Link to="/privacy" className="text-primary underline underline-offset-2">
                  LGPD (Lei 13.709/2018)
                </Link>
                , você pode escolher quais categorias aceitar.
              </p>
            </div>
          </div>

          {expanded && (
            <div className="space-y-3 mb-4 p-4 bg-muted/30 rounded-lg border border-border/50">
              <div className="flex items-center justify-between">
                <div>
                  <Label className="font-medium">Cookies Essenciais</Label>
                  <p className="text-xs text-muted-foreground mt-0.5">
                    Necessários para o funcionamento da plataforma. Não podem ser desativados.
                  </p>
                </div>
                <Switch checked disabled />
              </div>

              <div className="flex items-center justify-between">
                <div>
                  <Label htmlFor="analytics-cookie" className="font-medium">Cookies de Análise</Label>
                  <p className="text-xs text-muted-foreground mt-0.5">
                    Nos ajudam a entender como você usa a plataforma para melhorá-la.
                  </p>
                </div>
                <Switch
                  id="analytics-cookie"
                  checked={preferences.analytics}
                  onCheckedChange={(v) => setPreferences({ ...preferences, analytics: v })}
                />
              </div>

              <div className="flex items-center justify-between">
                <div>
                  <Label htmlFor="marketing-cookie" className="font-medium">Cookies de Marketing</Label>
                  <p className="text-xs text-muted-foreground mt-0.5">
                    Permitem enviar comunicações e novidades personalizadas.
                  </p>
                </div>
                <Switch
                  id="marketing-cookie"
                  checked={preferences.marketing}
                  onCheckedChange={(v) => setPreferences({ ...preferences, marketing: v })}
                />
              </div>
            </div>
          )}

          <div className="flex flex-wrap items-center gap-2">
            <Button size="sm" onClick={acceptAll} className="bg-primary hover:bg-primary/90">
              Aceitar todos
            </Button>
            <Button size="sm" variant="outline" onClick={acceptEssential}>
              Apenas essenciais
            </Button>
            {expanded ? (
              <Button size="sm" variant="outline" onClick={saveCustom}>
                Salvar preferências
              </Button>
            ) : null}
            <Button
              size="sm"
              variant="ghost"
              className="gap-1 text-muted-foreground"
              onClick={() => setExpanded(!expanded)}
            >
              {expanded ? (
                <>
                  Ocultar <ChevronUp className="w-3 h-3" />
                </>
              ) : (
                <>
                  Personalizar <ChevronDown className="w-3 h-3" />
                </>
              )}
            </Button>
            <div className="ml-auto">
              <Link to="/privacy" className="text-xs text-muted-foreground hover:text-foreground underline underline-offset-2">
                Política de Privacidade
              </Link>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}
