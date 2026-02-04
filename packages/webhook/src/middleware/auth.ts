import { auth, claimCheck, type JWTPayload } from "express-oauth2-jwt-bearer";
import { AUTH0_DOMAIN, AUTH0_AUDIENCE } from "../config.js";

const REQUIRED_PERMISSION = "admin:access";

export const jwtCheck = auth({
  audience: AUTH0_AUDIENCE,
  issuerBaseURL: `https://${AUTH0_DOMAIN}/`,
  tokenSigningAlg: "RS256",
});

// Check the 'permissions' claim (Auth0 RBAC), not 'scope' (OAuth scopes)
export const requireAdminPermission = claimCheck((payload: JWTPayload) => {
  const permissions = payload.permissions as string[] | undefined;
  return permissions?.includes(REQUIRED_PERMISSION) ?? false;
});
