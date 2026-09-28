import { StrictMode } from "react";
import { createRoot } from "react-dom/client";
import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import { BrowserRouter } from "react-router-dom";
import { App } from "./app/App";
import { AccessProvider } from "./services/access/AccessContext";
import { AuthProvider } from "./services/auth/AuthProvider";
import { AuthGate } from "./components/auth/AuthGate";
import { OrganizationProvider } from "./services/organization/OrganizationProvider";
import "./styles.css";

const queryClient = new QueryClient();

createRoot(document.getElementById("root")!).render(
  <StrictMode>
    <QueryClientProvider client={queryClient}>
      <BrowserRouter>
        <AuthProvider>
          <AuthGate>
            <AccessProvider>
              <OrganizationProvider>
                <App />
              </OrganizationProvider>
            </AccessProvider>
          </AuthGate>
        </AuthProvider>
      </BrowserRouter>
    </QueryClientProvider>
  </StrictMode>
);
