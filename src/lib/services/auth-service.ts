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
}

export const authService = new AuthService();
