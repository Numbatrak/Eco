import "./index.css";
import "./styles/table-theme.css";
import "./styles/dialog-form.css";
import "./styles/alerts.css";
import "./styles/interactions.css";
import { renderApp } from "./bootstrap.tsx";

const rootEl = document.getElementById("root");

if (!rootEl) {
  throw new Error("Root element #root not found");
}

renderApp(rootEl);
