import { StrictMode } from "react";
import { createRoot } from "react-dom/client";
import { HashRouter } from "react-router-dom";
import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import { Auth0Provider } from "@auth0/auth0-react";
import { AuthGuard } from "./components/AuthGuard";
import { ConfigProvider } from "./context/ConfigContext";
import App from "./App";
import "./i18n";
import "./index.css";

const queryClient = new QueryClient({
  defaultOptions: {
    queries: {
      staleTime: 5000,
      refetchInterval: 10000,
    },
  },
});

createRoot(document.getElementById("root")!).render(
  <StrictMode>
    <Auth0Provider
      domain={__AUTH0_DOMAIN__}
      clientId={__AUTH0_CLIENT_ID__}
      authorizationParams={{
        redirect_uri: window.location.origin + "/admin",
        audience: __AUTH0_AUDIENCE__,
      }}
    >
      <QueryClientProvider client={queryClient}>
        <HashRouter>
          <AuthGuard>
            <ConfigProvider>
              <App />
            </ConfigProvider>
          </AuthGuard>
        </HashRouter>
      </QueryClientProvider>
    </Auth0Provider>
  </StrictMode>
);
