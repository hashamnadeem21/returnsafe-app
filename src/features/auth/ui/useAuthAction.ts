import { useCallback, useState } from 'react';

import { AuthError, CredentialInUseError } from '../authService';
import { mapAuthError, type FriendlyAuthError } from '../errors';

export type AuthActionState<K extends string> = {
  busy: K | null;
  error: FriendlyAuthError | null;
  /** Set when a guest tried to save with a login that already has an account. */
  credentialInUse: CredentialInUseError | null;
};

/**
 * Runs an auth call with a busy flag and friendly errors.
 * Cancelled native sheets return quietly (no error shown).
 */
export function useAuthAction<K extends string = string>() {
  const [state, setState] = useState<AuthActionState<K>>({
    busy: null,
    error: null,
    credentialInUse: null,
  });

  const run = useCallback(async (key: K, fn: () => Promise<void>): Promise<boolean> => {
    setState({ busy: key, error: null, credentialInUse: null });
    try {
      await fn();
      setState((s) => ({ ...s, busy: null }));
      return true;
    } catch (e) {
      if (e instanceof CredentialInUseError) {
        setState({ busy: null, error: null, credentialInUse: e });
        return false;
      }
      const friendly = e instanceof AuthError ? e.friendly : mapAuthError(e);
      setState({
        busy: null,
        error: friendly.kind === 'cancelled' ? null : friendly,
        credentialInUse: null,
      });
      return false;
    }
  }, []);

  const clearError = useCallback(() => setState((s) => ({ ...s, error: null })), []);
  const dismissCredentialInUse = useCallback(
    () => setState((s) => ({ ...s, credentialInUse: null })),
    [],
  );

  return { ...state, run, clearError, dismissCredentialInUse };
}
