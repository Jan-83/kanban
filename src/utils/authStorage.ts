// Never migrate client-supplied passwords, roles or sessions. Legacy task data is
// retained for an explicit import after authentication and server authorization.
// Static GitHub Pages callbacks arrive in a new tab. Dashboard invites use
// implicit fragments; a PKCE verifier stored in the original tab is unavailable.
export const AUTH_OPTIONS = { persistSession: true, autoRefreshToken: true, detectSessionInUrl: true, flowType: 'implicit' as const };
export function clearLegacyAuthentication(): void {
  for (const name of ['localStorage', 'sessionStorage'] as const) {
    try {
      const storage = window[name];
      for (const key of ['kanban_security_config_v2', 'kanban_auth_session_v2']) storage.removeItem(key);
    } catch { /* Browser storage can be disabled. */ }
  }
}
