export interface AccessAccount {
  id: string;
  name: string;
  email: string;
  role: 'admin' | 'member';
  passcode: string; // password or PIN
  createdAt: string;
}

export interface AuthSession {
  user: {
    id: string;
    name: string;
    email: string;
    role: 'admin' | 'member';
  };
  loginTime: string;
}

export interface SecurityConfig {
  isGateEnabled: boolean;
  masterPassword: string; // global fallback access code
  accounts: AccessAccount[];
}

export const AUTH_STORAGE_KEYS = {
  SECURITY_CONFIG: 'kanban_security_config_v2',
  CURRENT_SESSION: 'kanban_auth_session_v2',
};

export const INITIAL_SECURITY_CONFIG: SecurityConfig = {
  isGateEnabled: true,
  masterPassword: 'deli2025', // default master team code
  accounts: [
    {
      id: 'acc-admin',
      name: 'Administrator (Daro)',
      email: 'darecki.maj@gmail.com',
      role: 'admin',
      passcode: 'deli2025',
      createdAt: '2026-01-01T00:00:00.000Z',
    },
    {
      id: 'acc-janek',
      name: 'Janek',
      email: 'janek@deli.pl',
      role: 'member',
      passcode: 'Janek123',
      createdAt: '2026-01-01T00:00:00.000Z',
    },
    {
      id: 'acc-marek',
      name: 'Marek',
      email: 'marek@deli.pl',
      role: 'member',
      passcode: 'Marek123',
      createdAt: '2026-01-01T00:00:00.000Z',
    },
    {
      id: 'acc-darek',
      name: 'Darek',
      email: 'darek@deli.pl',
      role: 'member',
      passcode: 'Darek123',
      createdAt: '2026-01-01T00:00:00.000Z',
    },
  ],
};

export function loadSecurityConfig(): SecurityConfig {
  try {
    const raw = localStorage.getItem(AUTH_STORAGE_KEYS.SECURITY_CONFIG);
    if (!raw) {
      saveSecurityConfig(INITIAL_SECURITY_CONFIG);
      return INITIAL_SECURITY_CONFIG;
    }
    return JSON.parse(raw);
  } catch {
    return INITIAL_SECURITY_CONFIG;
  }
}

export function saveSecurityConfig(config: SecurityConfig): void {
  try {
    localStorage.setItem(AUTH_STORAGE_KEYS.SECURITY_CONFIG, JSON.stringify(config));
  } catch {
    //
  }
}

export function loadCurrentSession(): AuthSession | null {
  try {
    const raw = sessionStorage.getItem(AUTH_STORAGE_KEYS.CURRENT_SESSION) || localStorage.getItem(AUTH_STORAGE_KEYS.CURRENT_SESSION);
    if (!raw) return null;
    return JSON.parse(raw);
  } catch {
    return null;
  }
}

export function saveCurrentSession(session: AuthSession, rememberMe: boolean = true): void {
  try {
    const str = JSON.stringify(session);
    if (rememberMe) {
      localStorage.setItem(AUTH_STORAGE_KEYS.CURRENT_SESSION, str);
    } else {
      sessionStorage.setItem(AUTH_STORAGE_KEYS.CURRENT_SESSION, str);
    }
  } catch {
    //
  }
}

export function clearCurrentSession(): void {
  try {
    localStorage.removeItem(AUTH_STORAGE_KEYS.CURRENT_SESSION);
    sessionStorage.removeItem(AUTH_STORAGE_KEYS.CURRENT_SESSION);
  } catch {
    //
  }
}
