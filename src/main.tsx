import { StrictMode } from "react";
import { createRoot } from "react-dom/client";
import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import { createBrowserRouter, RouterProvider } from "react-router-dom";
import { App } from "./app/App";
import { AccessProvider } from "./services/access/AccessContext";
import { AuthProvider } from "./services/auth/AuthProvider";
import { AuthGate } from "./components/auth/AuthGate";
import { OrganizationProvider } from "./services/organization/OrganizationProvider";
import "./styles.css";
import { UnsavedChangesProvider } from "./components/forms/UnsavedChangesProvider";

const queryClient = new QueryClient();
const router = createBrowserRouter([{ path: "*", element: (
  <AuthProvider><AuthGate><AccessProvider><OrganizationProvider>
    <UnsavedChangesProvider><App /></UnsavedChangesProvider>
  </OrganizationProvider></AccessProvider></AuthGate></AuthProvider>
) }]);

createRoot(document.getElementById("root")!).render(
  <StrictMode>
    <QueryClientProvider client={queryClient}>
      <RouterProvider router={router} />
    </QueryClientProvider>
  </StrictMode>
);
