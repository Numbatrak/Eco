import { createRoot } from "react-dom/client";
import { BrowserRouter } from "react-router-dom";
import { ThemeProvider } from "next-themes";
import { SpeedInsights } from "@vercel/speed-insights/react";
import App from "./App.tsx";
import { SupabaseAuthProvider } from "./auth/SupabaseAuthProvider.tsx";
import { OrganizationProvider } from "./contexts/OrganizationContext.tsx";
import { ConfirmProvider } from "./contexts/ConfirmContext.tsx";

export function renderApp(rootEl: HTMLElement) {
  createRoot(rootEl).render(
    <ThemeProvider
      attribute="class"
      defaultTheme="dark"
      enableSystem={false}
      disableTransitionOnChange={false}
      storageKey="numbatrak-theme"
    >
      <SupabaseAuthProvider
        children={
          <BrowserRouter>
            <OrganizationProvider>
              <ConfirmProvider>
                <App />
                <SpeedInsights />
              </ConfirmProvider>
            </OrganizationProvider>
          </BrowserRouter>
        }
      />
    </ThemeProvider>
  );
}
