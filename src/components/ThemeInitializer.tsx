import { useEffect } from "react";
import { useThemeSchedule } from "@/hooks/useThemeSchedule";

/**
 * Componente que inicializa o tema baseado no horário de São Paulo
 * Deve ser renderizado dentro do ThemeProvider
 */
export function ThemeInitializer({ children }: { children: React.ReactNode }) {
  // O hook já cuida de tudo: inicialização e atualização automática
  useThemeSchedule();

  return <>{children}</>;
}
