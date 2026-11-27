import { StrictMode } from "react";
import { createRoot } from "react-dom/client";
import { BrowserRouter } from "react-router-dom";
import { App } from "./App";
import { TenantProvider } from "./tenant";
import "./design/tokens.css";
import "./design/base.css";
import "./ui/ui.css";
import "./app.css";

createRoot(document.getElementById("root")!).render(
  <StrictMode>
    {/* basename lets the same build run under a sub-path, e.g. the docs site's /app/ */}
    <BrowserRouter basename={import.meta.env.BASE_URL.replace(/\/$/, "")}>
      <TenantProvider>
        <App />
      </TenantProvider>
    </BrowserRouter>
  </StrictMode>,
);
