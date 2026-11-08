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
    <BrowserRouter>
      <TenantProvider>
        <App />
      </TenantProvider>
    </BrowserRouter>
  </StrictMode>,
);
