/**
 * Minimal auth state helper.
 *
 * Integrate with your real auth provider by setting one of:
 * - window.__PINBRIDGE_USER__
 * - localStorage key: pinbridge_user
 * - cookie: pinbridge_session or pb_session
 */
export class AuthService {
  isLoggedIn(): boolean {
    if (typeof window === 'undefined') return false;

    const windowUser = (window as any).__PINBRIDGE_USER__;
    if (windowUser) return true;

    try {
      const storedUser = localStorage.getItem('pinbridge_user');
      if (storedUser) return true;
    } catch {
      // ignore
    }

    const cookie = document.cookie || '';
    return cookie.includes('pinbridge_session=') || cookie.includes('pb_session=');
  }

  isAdmin(): boolean {
    if (typeof window === 'undefined') return false;

    const windowUser = (window as any).__PINBRIDGE_USER__;
    if (windowUser?.role === 'admin') return true;

    try {
      const storedUser = localStorage.getItem('pinbridge_user');
      if (storedUser) {
        const parsed = JSON.parse(storedUser);
        return parsed?.role === 'admin';
      }
    } catch {
      // ignore
    }

    return false;
  }

  getUserId(): string | null {
    if (typeof window === 'undefined') return null;

    const windowUser = (window as any).__PINBRIDGE_USER__;
    if (windowUser?.id) return String(windowUser.id);
    if (windowUser?.userId) return String(windowUser.userId);

    try {
      const storedUser = localStorage.getItem('pinbridge_user');
      if (storedUser) {
        const parsed = JSON.parse(storedUser);
        if (parsed?.id) return String(parsed.id);
        if (parsed?.userId) return String(parsed.userId);
      }
    } catch {
      // ignore
    }

    return null;
  }
}

export const authService = new AuthService();
