const SCOPE_KEY = 'ui_prefs_scope';
const PREFIX = 'ui_pref';

type MaybeString = string | null | undefined;

const safeGet = (key: string): string | null => {
  try {
    return localStorage.getItem(key);
  } catch {
    return null;
  }
};

const safeSet = (key: string, value: string): void => {
  try {
    localStorage.setItem(key, value);
  } catch {
    // ignore storage errors
  }
};

const safeRemove = (key: string): void => {
  try {
    localStorage.removeItem(key);
  } catch {
    // ignore storage errors
  }
};

const getScope = (): string | null => safeGet(SCOPE_KEY);

const setScope = (scope: MaybeString): void => {
  if (!scope) {
    safeRemove(SCOPE_KEY);
    return;
  }
  safeSet(SCOPE_KEY, scope);
};

const makeKey = (key: string): string => {
  const scope = getScope();
  return scope ? `${PREFIX}:${scope}:${key}` : `${PREFIX}:anon:${key}`;
};

const getString = (key: string, fallback?: string): string | null => {
  const value = safeGet(makeKey(key));
  if (value === null || value === undefined || value === '') {
    return fallback ?? null;
  }
  return value;
};

const setString = (key: string, value: string): void => {
  safeSet(makeKey(key), value);
};

const clearScope = (scope: string): void => {
  const prefix = `${PREFIX}:${scope}:`;
  const keysToRemove: string[] = [];
  try {
    for (let i = 0; i < localStorage.length; i += 1) {
      const key = localStorage.key(i);
      if (key && key.startsWith(prefix)) {
        keysToRemove.push(key);
      }
    }
  } catch {
    return;
  }

  keysToRemove.forEach(safeRemove);
};

export const uiPreferences = {
  getScope,
  setScope,
  clearScope,
  getString,
  setString,
};
