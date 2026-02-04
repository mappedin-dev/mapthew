import { useEffect, useState, type ReactNode } from "react";
import { useAuth0 } from "@auth0/auth0-react";
import { jwtDecode } from "jwt-decode";
import { LoadingSpinner } from "./LoadingSpinner";
import { AccessDenied } from "./AccessDenied";
import { setTokenGetter } from "../api/client";
import Login from "../pages/Login";

const REQUIRED_PERMISSION = "admin:access";

interface TokenPayload {
  permissions?: string[];
}

interface AuthGuardProps {
  children: ReactNode;
}

export function AuthGuard({ children }: AuthGuardProps) {
  const { isAuthenticated, isLoading, getAccessTokenSilently, error } = useAuth0();
  const [hasPermission, setHasPermission] = useState<boolean | null>(null);

  // Clear error params from URL after failed login attempts
  useEffect(() => {
    if (error || window.location.search.includes("error=")) {
      window.history.replaceState({}, "", window.location.pathname + window.location.hash);
    }
  }, [error]);

  // Set up the API client's token getter
  useEffect(() => {
    if (isAuthenticated) {
      setTokenGetter(getAccessTokenSilently);
    }
  }, [isAuthenticated, getAccessTokenSilently]);

  useEffect(() => {
    if (isAuthenticated) {
      getAccessTokenSilently()
        .then((token) => {
          const decoded = jwtDecode<TokenPayload>(token);
          setHasPermission(decoded.permissions?.includes(REQUIRED_PERMISSION) ?? false);
        })
        .catch(() => {
          setHasPermission(false);
        });
    }
  }, [isAuthenticated, getAccessTokenSilently]);

  if (isLoading && !error) {
    return <LoadingSpinner className="min-h-screen" />;
  }

  if (!isAuthenticated || error) {
    return <Login />;
  }

  if (!hasPermission) {
    return <AccessDenied />;
  }

  return <>{children}</>;
}
