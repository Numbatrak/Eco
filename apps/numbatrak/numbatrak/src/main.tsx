import { createRoot } from "react-dom/client";
import "./index.css";
import "./styles/table-theme.css";
import "./styles/dialog-form.css";
import "./styles/alerts.css";
import "./styles/interactions.css";

const rootEl = document.getElementById("root");

if (!rootEl) {
  throw new Error("Root element #root not found");
}

const hasSupabaseEnv =
  Boolean(import.meta.env.VITE_SUPABASE_URL) &&
  Boolean(import.meta.env.VITE_SUPABASE_ANON_KEY);

async function start() {
  if (!hasSupabaseEnv) {
    const { MissingEnvPage } = await import("./components/MissingEnvPage.tsx");
    createRoot(rootEl).render(<MissingEnvPage />);
    return;
  }

  const { renderApp } = await import("./bootstrap.tsx");
  renderApp(rootEl);
}

void start();
