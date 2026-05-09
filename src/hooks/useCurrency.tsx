import { useTranslation } from 'react-i18next';

export type Currency = 'BRL' | 'USD' | 'EUR';

// Chave versionada para evitar herdar antigos defaults de localStorage
const CURRENCY_STORAGE_KEY = 'currency_v2';

interface CurrencyConfig {
  symbol: string;
  code: string;
  locale: string;
}

const CURRENCY_CONFIG: Record<Currency, CurrencyConfig> = {
  BRL: { symbol: 'R$', code: 'BRL', locale: 'pt-BR' },
  USD: { symbol: '$', code: 'USD', locale: 'en-US' },
  EUR: { symbol: '€', code: 'EUR', locale: 'de-DE' },
};

// Taxas de conversão aproximadas (em produção, use uma API de câmbio)
const EXCHANGE_RATES: Record<string, number> = {
  'USD_BRL': 5.20,
  'USD_EUR': 0.92,
  'BRL_USD': 0.19,
  'BRL_EUR': 0.18,
  'EUR_USD': 1.09,
  'EUR_BRL': 5.65,
};

export const useCurrency = () => {
  const { t } = useTranslation();

  const getDefaultCurrency = (): Currency => {
    const saved = localStorage.getItem(CURRENCY_STORAGE_KEY) as Currency | null;
    // Apenas respeita escolha explícita do usuário feita com a versão atual da chave
    if (saved && ['BRL', 'USD', 'EUR'].includes(saved)) return saved;
    // Padrão: BRL (produto focado no mercado brasileiro)
    return 'BRL';
  };

  const currency = getDefaultCurrency();
  const config = CURRENCY_CONFIG[currency];

  const convert = (amount: number, fromCurrency: Currency, toCurrency: Currency): number => {
    if (fromCurrency === toCurrency) return amount;
    
    const key = `${fromCurrency}_${toCurrency}`;
    const rate = EXCHANGE_RATES[key] || 1;
    return amount * rate;
  };

  const formatCurrency = (
    amount: number,
    options?: {
      sourceCurrency?: Currency;
      showConversion?: boolean;
    }
  ): { value: string; converted: boolean; note?: string } => {
    const sourceCurrency = options?.sourceCurrency || currency;
    const showConversion = options?.showConversion ?? true;
    
    let displayAmount = amount;
    let converted = false;
    let note: string | undefined;

    // Se a moeda de origem é diferente da moeda de exibição, converte
    if (sourceCurrency !== currency && showConversion) {
      displayAmount = convert(amount, sourceCurrency, currency);
      converted = true;
      note = t('common.convertedFrom', { currency: CURRENCY_CONFIG[sourceCurrency].code });
    }

    const formatted = new Intl.NumberFormat(config.locale, {
      style: 'currency',
      currency: config.code,
      minimumFractionDigits: 2,
      maximumFractionDigits: 2,
    }).format(displayAmount);

    return {
      value: formatted,
      converted,
      note,
    };
  };

  const setCurrency = (newCurrency: Currency) => {
    localStorage.setItem(CURRENCY_STORAGE_KEY, newCurrency);
    window.location.reload();
  };

  return {
    currency,
    config,
    formatCurrency,
    convert,
    setCurrency,
  };
};
