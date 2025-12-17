import { useEffect, useCallback } from "react";
import { useTheme } from "next-themes";

const THEME_PREFERENCE_KEY = "kodo-theme-preference";

type ThemePreference = "light" | "dark" | "auto";

/**
 * Retorna o horário atual em São Paulo (America/Sao_Paulo)
 */
function getSaoPauloHour(): number {
  const now = new Date();
  const saoPauloTime = new Intl.DateTimeFormat("en-US", {
    timeZone: "America/Sao_Paulo",
    hour: "numeric",
    hour12: false,
  }).format(now);
  return parseInt(saoPauloTime, 10);
}

/**
 * Determina o tema baseado no horário de São Paulo
 * - 6h até 17h59: light
 * - 18h até 5h59: dark
 */
function getThemeByTime(): "light" | "dark" {
  const hour = getSaoPauloHour();
  // Entre 6h (inclusive) e 18h (exclusive) = light
  // Caso contrário = dark
  return hour >= 6 && hour < 18 ? "light" : "dark";
}

/**
 * Calcula quantos milissegundos faltam para a próxima troca de tema (6h ou 18h)
 */
function getMillisecondsUntilNextSwitch(): number {
  const now = new Date();
  const saoPauloFormatter = new Intl.DateTimeFormat("en-US", {
    timeZone: "America/Sao_Paulo",
    year: "numeric",
    month: "2-digit",
    day: "2-digit",
    hour: "2-digit",
    minute: "2-digit",
    second: "2-digit",
    hour12: false,
  });

  const parts = saoPauloFormatter.formatToParts(now);
  const getPart = (type: string) => parts.find(p => p.type === type)?.value || "0";

  const hour = parseInt(getPart("hour"), 10);
  const minute = parseInt(getPart("minute"), 10);
  const second = parseInt(getPart("second"), 10);

  // Próxima troca é às 6h ou 18h
  let nextSwitchHour: number;
  if (hour < 6) {
    nextSwitchHour = 6;
  } else if (hour < 18) {
    nextSwitchHour = 18;
  } else {
    nextSwitchHour = 6 + 24; // 6h do dia seguinte
  }

  const hoursUntilSwitch = nextSwitchHour - hour;
  const minutesUntilSwitch = hoursUntilSwitch * 60 - minute;
  const secondsUntilSwitch = minutesUntilSwitch * 60 - second;

  return secondsUntilSwitch * 1000;
}

/**
 * Hook para gerenciar o tema com base no horário de São Paulo
 *
 * Comportamento:
 * - Se o usuário definiu uma preferência manual (light/dark), usa essa preferência
 * - Se a preferência é "auto" ou não existe, usa o tema baseado no horário de SP:
 *   - 6h-18h: light (claro)
 *   - 18h-6h: dark (escuro)
 * - Atualiza automaticamente quando passa das 6h ou 18h
 */
export function useThemeSchedule() {
  const { setTheme, theme } = useTheme();

  // Obtém a preferência do usuário
  const getUserPreference = useCallback((): ThemePreference => {
    if (typeof window === "undefined") return "auto";
    const stored = localStorage.getItem(THEME_PREFERENCE_KEY);
    if (stored === "light" || stored === "dark" || stored === "auto") {
      return stored;
    }
    return "auto";
  }, []);

  // Salva a preferência do usuário
  const setUserPreference = useCallback((preference: ThemePreference) => {
    if (typeof window === "undefined") return;
    localStorage.setItem(THEME_PREFERENCE_KEY, preference);

    if (preference === "auto") {
      setTheme(getThemeByTime());
    } else {
      setTheme(preference);
    }
  }, [setTheme]);

  // Aplica o tema correto baseado na preferência
  const applyTheme = useCallback(() => {
    const preference = getUserPreference();

    if (preference === "auto") {
      const themeByTime = getThemeByTime();
      setTheme(themeByTime);
    } else {
      setTheme(preference);
    }
  }, [getUserPreference, setTheme]);

  // Inicializa e configura o timer para troca automática
  useEffect(() => {
    // Aplica o tema inicial
    applyTheme();

    // Configura o timer para a próxima troca
    const setupNextSwitch = () => {
      const msUntilSwitch = getMillisecondsUntilNextSwitch();

      return setTimeout(() => {
        const preference = getUserPreference();
        if (preference === "auto") {
          setTheme(getThemeByTime());
        }
        // Reconfigura o timer para a próxima troca
        setupNextSwitch();
      }, msUntilSwitch);
    };

    const timerId = setupNextSwitch();

    return () => {
      clearTimeout(timerId);
    };
  }, [applyTheme, getUserPreference, setTheme]);

  // Retorna funções úteis para o componente ThemeToggle
  return {
    currentTheme: theme,
    userPreference: getUserPreference(),
    setUserPreference,
    isAutoMode: getUserPreference() === "auto",
  };
}
