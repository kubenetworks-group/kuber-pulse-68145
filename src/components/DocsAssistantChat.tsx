import { useState, useRef, useEffect } from "react";
import { Card } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { ScrollArea } from "@/components/ui/scroll-area";
import { Bot, Send, X, MessageCircle, Loader2 } from "lucide-react";
import { toast } from "sonner";
import { supabase } from "@/integrations/supabase/client";
import { useSubscription } from "@/contexts/SubscriptionContext";

type Message = {
  role: "user" | "assistant";
  content: string;
};

export const DocsAssistantChat = () => {
  const [isOpen, setIsOpen] = useState(false);
  const [messages, setMessages] = useState<Message[]>([
    {
      role: "assistant",
      content: "Olá! 👋 Sou o assistente do Kodo. Posso ajudá-lo com:\n\n- Sistema Kodo e funcionalidades\n- Kubernetes e configuração de clusters\n- Kodo Agent e métricas\n- AI Monitor e Auto-healing\n\nComo posso ajudar?"
    }
  ]);
  const [input, setInput] = useState("");
  const [isLoading, setIsLoading] = useState(false);
  const [usageInfo, setUsageInfo] = useState<{ used: number; limit: number } | null>(null);
  const scrollRef = useRef<HTMLDivElement>(null);
  const { subscription } = useSubscription();
  const CHAT_URL = `${import.meta.env.VITE_SUPABASE_URL}/functions/v1/docs-assistant`;

  useEffect(() => {
    if (scrollRef.current) {
      scrollRef.current.scrollTop = scrollRef.current.scrollHeight;
    }
  }, [messages]);

  useEffect(() => {
    // Calculate usage based on subscription
    if (subscription) {
      let limit = 50; // free
      if (subscription.plan === "pro") limit = Infinity;
      
      setUsageInfo({
        used: subscription.ai_analyses_used || 0,
        limit
      });
    }
  }, [subscription]);

  const streamChat = async (userMessage: string) => {
    const newMessages = [...messages, { role: "user" as const, content: userMessage }];
    setMessages(newMessages);
    setInput("");
    setIsLoading(true);

    try {
      const { data: { session } } = await supabase.auth.getSession();
      
      const resp = await fetch(CHAT_URL, {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
          Authorization: `Bearer ${session?.access_token || import.meta.env.VITE_SUPABASE_PUBLISHABLE_KEY}`,
        },
        body: JSON.stringify({ messages: newMessages }),
      });

      if (!resp.ok) {
        const errorData = await resp.json().catch(() => null);
        
        if (resp.status === 429) {
          if (errorData?.limit) {
            toast.error(`Limite mensal atingido (${errorData.usage}/${errorData.limit} mensagens)`);
            setUsageInfo({ used: errorData.usage, limit: errorData.limit });
          } else {
            toast.error("Rate limit excedido. Aguarde um momento.");
          }
        } else if (resp.status === 402) {
          toast.error("Créditos insuficientes.");
        } else if (resp.status === 401) {
          toast.error("Sessão expirada. Faça login novamente.");
        } else {
          toast.error(errorData?.error || "Erro ao comunicar com o assistente.");
        }
        setIsLoading(false);
        return;
      }

      if (!resp.body) {
        throw new Error("No response body");
      }

      const reader = resp.body.getReader();
      const decoder = new TextDecoder();
      let textBuffer = "";
      let streamDone = false;
      let assistantContent = "";

      setMessages(prev => [...prev, { role: "assistant", content: "" }]);

      // Update usage after successful request
      if (usageInfo) {
        setUsageInfo(prev => prev ? { ...prev, used: prev.used + 1 } : null);
      }

      while (!streamDone) {
        const { done, value } = await reader.read();
        if (done) break;
        textBuffer += decoder.decode(value, { stream: true });

        let newlineIndex: number;
        while ((newlineIndex = textBuffer.indexOf("\n")) !== -1) {
          let line = textBuffer.slice(0, newlineIndex);
          textBuffer = textBuffer.slice(newlineIndex + 1);

          if (line.endsWith("\r")) line = line.slice(0, -1);
          if (line.startsWith(":") || line.trim() === "") continue;
          if (!line.startsWith("data: ")) continue;

          const jsonStr = line.slice(6).trim();
          if (jsonStr === "[DONE]") {
            streamDone = true;
            break;
          }

          try {
            const parsed = JSON.parse(jsonStr);
            const content = parsed.choices?.[0]?.delta?.content as string | undefined;
            if (content) {
              assistantContent += content;
              setMessages(prev => {
                const newMessages = [...prev];
                newMessages[newMessages.length - 1] = {
                  role: "assistant",
                  content: assistantContent
                };
                return newMessages;
              });
            }
          } catch {
            textBuffer = line + "\n" + textBuffer;
            break;
          }
        }
      }

      setIsLoading(false);
    } catch (error) {
      console.error("Error streaming chat:", error);
      toast.error("Erro ao processar resposta");
      setIsLoading(false);
    }
  };

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    if (!input.trim() || isLoading) return;
    
    if (usageInfo && usageInfo.used >= usageInfo.limit) {
      toast.error("Limite mensal de mensagens atingido. Faça upgrade para continuar.");
      return;
    }
    
    streamChat(input);
  };

  const usagePercentage = usageInfo ? (usageInfo.used / usageInfo.limit) * 100 : 0;

  return (
    <>
      {!isOpen && (
        <div className="fixed bottom-6 right-6 z-50 flex items-center gap-3 animate-in fade-in zoom-in duration-300">
          <div className="bg-card/95 backdrop-blur-sm border border-border/50 rounded-lg px-3 py-2 shadow-lg max-w-[200px]">
            <p className="text-xs text-muted-foreground leading-relaxed">
              Dúvidas sobre como usar alguma ferramenta? <span className="text-primary font-medium">Converse comigo!</span>
            </p>
          </div>
          <Button
            onClick={() => setIsOpen(true)}
            className="h-14 w-14 rounded-full shadow-2xl bg-gradient-primary hover:opacity-90"
            size="icon"
          >
            <MessageCircle className="h-6 w-6" />
          </Button>
        </div>
      )}

      {isOpen && (
        <Card className="fixed bottom-6 right-6 w-96 h-[600px] shadow-2xl border-border/50 bg-card/95 backdrop-blur-xl z-50 flex flex-col animate-in fade-in slide-in-from-bottom-4 duration-300">
          <div className="flex items-center justify-between p-4 border-b border-border/50 bg-gradient-to-r from-primary/10 to-accent/10">
            <div className="flex items-center gap-3">
              <div className="p-2 rounded-lg bg-primary/20">
                <Bot className="w-5 h-5 text-primary" />
              </div>
              <div>
                <h3 className="font-semibold text-sm">Assistente Kodo</h3>
                <p className="text-xs text-muted-foreground">Suporte Kubernetes</p>
              </div>
            </div>
            <Button
              variant="ghost"
              size="icon"
              onClick={() => setIsOpen(false)}
              className="h-8 w-8"
            >
              <X className="h-4 w-4" />
            </Button>
          </div>

          {/* Usage indicator */}
          {usageInfo && (
            <div className="px-4 pt-2">
              <div className="flex justify-between text-xs text-muted-foreground mb-1">
                <span>Uso mensal</span>
                <span>{usageInfo.used}/{usageInfo.limit} mensagens</span>
              </div>
              <div className="h-1.5 bg-muted rounded-full overflow-hidden">
                <div 
                  className={`h-full transition-all ${
                    usagePercentage >= 90 ? 'bg-destructive' : 
                    usagePercentage >= 70 ? 'bg-yellow-500' : 
                    'bg-primary'
                  }`}
                  style={{ width: `${Math.min(usagePercentage, 100)}%` }}
                />
              </div>
            </div>
          )}

          <ScrollArea className="flex-1 p-4" ref={scrollRef}>
            <div className="space-y-4">
              {messages.map((message, index) => (
                <div
                  key={index}
                  className={`flex gap-3 animate-in fade-in slide-in-from-bottom-2 duration-300 ${
                    message.role === "assistant" ? "justify-start" : "justify-end"
                  }`}
                >
                  {message.role === "assistant" && (
                    <div className="flex-shrink-0 w-8 h-8 rounded-full bg-primary/20 flex items-center justify-center">
                      <Bot className="w-4 h-4 text-primary" />
                    </div>
                  )}
                  <div
                    className={`max-w-[80%] rounded-lg px-4 py-2 ${
                      message.role === "assistant"
                        ? "bg-muted/50 text-foreground"
                        : "bg-gradient-primary text-primary-foreground"
                    }`}
                  >
                    <p className="text-sm whitespace-pre-wrap">{message.content}</p>
                  </div>
                </div>
              ))}
              {isLoading && (
                <div className="flex gap-3 justify-start animate-in fade-in duration-300">
                  <div className="flex-shrink-0 w-8 h-8 rounded-full bg-primary/20 flex items-center justify-center">
                    <Bot className="w-4 h-4 text-primary" />
                  </div>
                  <div className="bg-muted/50 rounded-lg px-4 py-2">
                    <Loader2 className="w-4 h-4 animate-spin text-muted-foreground" />
                  </div>
                </div>
              )}
            </div>
          </ScrollArea>

          <form onSubmit={handleSubmit} className="p-4 border-t border-border/50">
            <div className="flex gap-2">
              <Input
                value={input}
                onChange={(e) => setInput(e.target.value)}
                placeholder="Pergunte sobre Kodo ou K8s..."
                disabled={isLoading || (usageInfo && usageInfo.used >= usageInfo.limit)}
                className="flex-1 bg-background/50"
              />
              <Button
                type="submit"
                size="icon"
                disabled={!input.trim() || isLoading || (usageInfo && usageInfo.used >= usageInfo.limit)}
                className="bg-gradient-primary hover:opacity-90"
              >
                <Send className="w-4 h-4" />
              </Button>
            </div>
            {usageInfo && usageInfo.used >= usageInfo.limit && (
              <p className="text-xs text-destructive mt-2 text-center">
                Limite atingido. Faça upgrade para mais mensagens.
              </p>
            )}
          </form>
        </Card>
      )}
    </>
  );
};
