import { GOOGLE_OAUTH_SCOPES, type ApiSession } from "@superbhuman/shared";

interface ManifestOAuthConfig {
  client_id?: string;
  scopes?: string[];
}

interface ManifestWithOAuth {
  key?: string;
  oauth2?: ManifestOAuthConfig;
}

export function getRequiredGoogleScopes(manifest?: ManifestWithOAuth): string[] {
  return manifest?.oauth2?.scopes?.length ? [...manifest.oauth2.scopes] : [...GOOGLE_OAUTH_SCOPES];
}

export function getConfiguredGoogleClientId(manifest?: ManifestWithOAuth): string | undefined {
  return manifest?.oauth2?.client_id?.trim() || undefined;
}

export function hasConfiguredGoogleOAuth(manifest?: ManifestWithOAuth): boolean {
  return Boolean(getConfiguredGoogleClientId(manifest));
}

export function getMissingGoogleScopes(
  grantedScopes: string[] | undefined,
  requiredScopes: readonly string[] = GOOGLE_OAUTH_SCOPES
): string[] {
  if (!grantedScopes?.length) {
    return [...requiredScopes];
  }

  const granted = new Set(grantedScopes);
  return requiredScopes.filter((scope) => !granted.has(scope));
}

export function hasRequiredGoogleScopes(
  session: Pick<ApiSession, "grantedScopes"> | null | undefined,
  requiredScopes: readonly string[] = GOOGLE_OAUTH_SCOPES
): boolean {
  return getMissingGoogleScopes(session?.grantedScopes, requiredScopes).length === 0;
}
