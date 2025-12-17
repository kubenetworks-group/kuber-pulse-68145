import { createRoot } from "react-dom/client";
import { ThemeProvider } from "next-themes";
import { ThemeInitializer } from "./components/ThemeInitializer";
import App from "./App.tsx";
import "./index.css";
import "./i18n/config";

createRoot(document.getElementById("root")!).render(
  <ThemeProvider attribute="class" defaultTheme="system" enableSystem={false} storageKey="kodo-ui-theme">
    <ThemeInitializer>
      <App />
    </ThemeInitializer>
  </ThemeProvider>
);
