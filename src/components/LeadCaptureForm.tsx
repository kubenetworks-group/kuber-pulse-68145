import { useState } from 'react';
import { useForm } from 'react-hook-form';
import { zodResolver } from '@hookform/resolvers/zod';
import { z } from 'zod';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { supabase } from '@/integrations/supabase/client';
import { ArrowRight, CheckCircle2, Loader2, Check } from 'lucide-react';

const schema = z.object({
  email: z.string().email('Email inválido'),
  company: z.string().min(2, 'Informe o nome da empresa'),
  cluster_size: z.string().min(1, 'Selecione o tamanho aproximado'),
});

type FormData = z.infer<typeof schema>;

interface LeadCaptureFormProps {
  variant?: string;
}

export function LeadCaptureForm({ variant = 'a' }: LeadCaptureFormProps) {
  const [submitted, setSubmitted] = useState(false);
  const [serverError, setServerError] = useState<string | null>(null);

  const {
    register,
    handleSubmit,
    formState: { errors, isSubmitting },
  } = useForm<FormData>({ resolver: zodResolver(schema) });

  const onSubmit = async (data: FormData) => {
    setServerError(null);
    const params = new URLSearchParams(window.location.search);

    const { error } = await supabase.functions.invoke('capture-lead', {
      body: {
        ...data,
        ab_variant: variant,
        utm_source: params.get('utm_source'),
        utm_medium: params.get('utm_medium'),
        utm_campaign: params.get('utm_campaign'),
        utm_content: params.get('utm_content'),
      },
    });

    if (error) {
      setServerError('Erro ao enviar. Tente novamente ou escreva para suporte@kubenetworks.com.br');
      return;
    }

    window.gtag?.('event', 'lead_form_submit', {
      ab_variant: variant,
      cluster_size: data.cluster_size,
    });

    setSubmitted(true);
  };

  if (submitted) {
    return (
      <div className="text-center py-6 space-y-4">
        <div className="inline-flex items-center justify-center w-16 h-16 rounded-full bg-emerald-50 border border-emerald-200">
          <CheckCircle2 className="w-8 h-8 text-emerald-500" />
        </div>
        <div>
          <h3 className="klp-syne font-bold text-xl text-slate-900 mb-2">Pedido recebido!</h3>
          <p className="text-slate-500 text-sm leading-relaxed max-w-xs mx-auto">
            Verifique sua caixa de entrada. Nossa equipe entra em contato em até 24 horas úteis.
          </p>
        </div>
        <a href="/auth?tab=signup">
          <Button
            className="mt-2 text-white"
            style={{ background: 'linear-gradient(135deg, #0891b2, #4f46e5)' }}
          >
            Criar conta gratuita
            <ArrowRight className="w-4 h-4 ml-2" />
          </Button>
        </a>
      </div>
    );
  }

  return (
    <form onSubmit={handleSubmit(onSubmit)} className="space-y-4">
      <div>
        <Input
          type="email"
          placeholder="seu@email.com"
          autoComplete="email"
          {...register('email')}
          className="h-12 text-base border-slate-200 focus-visible:ring-cyan-400/30 focus-visible:border-cyan-400"
        />
        {errors.email && (
          <p className="text-xs text-red-500 mt-1">{errors.email.message}</p>
        )}
      </div>

      <div>
        <Input
          placeholder="Nome da empresa"
          autoComplete="organization"
          {...register('company')}
          className="h-12 text-base border-slate-200 focus-visible:ring-cyan-400/30 focus-visible:border-cyan-400"
        />
        {errors.company && (
          <p className="text-xs text-red-500 mt-1">{errors.company.message}</p>
        )}
      </div>

      <div>
        <select
          {...register('cluster_size')}
          className="w-full h-12 px-3 text-base border border-slate-200 rounded-md bg-white text-slate-700 focus:outline-none focus:border-cyan-400 focus:ring-2 focus:ring-cyan-400/20 transition-colors"
        >
          <option value="">Tamanho do cluster (nós)</option>
          <option value="1-5">1–5 nós</option>
          <option value="6-20">6–20 nós</option>
          <option value="21-100">21–100 nós</option>
          <option value="100+">100+ nós</option>
        </select>
        {errors.cluster_size && (
          <p className="text-xs text-red-500 mt-1">{errors.cluster_size.message}</p>
        )}
      </div>

      {serverError && (
        <p className="text-sm text-red-500">{serverError}</p>
      )}

      <Button
        type="submit"
        disabled={isSubmitting}
        size="lg"
        className="w-full text-base py-6 text-white font-medium rounded-xl transition-all hover:-translate-y-0.5"
        style={{
          background: 'linear-gradient(135deg, #0891b2 0%, #4f46e5 100%)',
          boxShadow: '0 8px 32px rgba(8,145,178,0.25)',
        }}
      >
        {isSubmitting ? (
          <>
            <Loader2 className="w-4 h-4 mr-2 animate-spin" />
            Enviando...
          </>
        ) : (
          <>
            Receber diagnóstico grátis
            <ArrowRight className="w-4 h-4 ml-2" />
          </>
        )}
      </Button>

      <div className="flex flex-wrap justify-center gap-x-4 gap-y-1 pt-1">
        {['Sem compromisso', 'Sem cartão de crédito', 'Resposta em 24h'].map((t) => (
          <span key={t} className="flex items-center gap-1 text-xs text-slate-400">
            <Check className="w-3 h-3 text-emerald-500" />
            {t}
          </span>
        ))}
      </div>
    </form>
  );
}
