import {
  signInWithEmailAndPassword,
  signOut,
  onAuthStateChanged,
  setPersistence,
  browserLocalPersistence,
  createUserWithEmailAndPassword,
  sendPasswordResetEmail,
  User,
} from 'firebase/auth';
import { auth } from '../firebase/config';

class AuthServiceImpl {
  private currentTenantId: string | null = null;

  async setTenant(tenantId: string | null): Promise<void> {
    this.currentTenantId = tenantId;
    // Set tenant ID on the auth instance - this is required for tenant-aware authentication
    (auth as any).tenantId = tenantId;
    if (tenantId) {
      localStorage.setItem('currentTenantId', tenantId);
    } else {
      localStorage.removeItem('currentTenantId');
    }
  }

  getTenantId(): string | null {
    return this.currentTenantId || localStorage.getItem('currentTenantId');
  }

  async signIn(email: string, password: string, tenantId?: string | null): Promise<User> {
    // Set tenant ID BEFORE authentication if provided
    if (tenantId) {
      await this.setTenant(tenantId);
    } else {
      // Clear tenant ID if not provided (for non-tenant users)
      (auth as any).tenantId = null;
      this.currentTenantId = null;
      localStorage.removeItem('currentTenantId');
    }

    await setPersistence(auth, browserLocalPersistence);
    const userCredential = await signInWithEmailAndPassword(auth, email, password);

    // Store tenant info with user
    if (tenantId) {
      localStorage.setItem(`tenant_${userCredential.user.uid}`, tenantId);
    }

    // Get and store the ID token
    try {
      const idToken = await userCredential.user.getIdToken();
      localStorage.setItem('authToken', idToken);
      localStorage.setItem('authTokenExpiry', String(Date.now() + 3600000)); // 1 hour expiry
    } catch (error) {
      console.error('Error storing auth token:', error);
    }

    return userCredential.user;
  }

  async signUp(email: string, password: string, tenantId?: string | null): Promise<User> {
    // Set tenant ID BEFORE authentication if provided
    if (tenantId) {
      await this.setTenant(tenantId);
    } else {
      // Clear tenant ID if not provided (for non-tenant users)
      (auth as any).tenantId = null;
      this.currentTenantId = null;
      localStorage.removeItem('currentTenantId');
    }

    await setPersistence(auth, browserLocalPersistence);
    const userCredential = await createUserWithEmailAndPassword(auth, email, password);

    // Store tenant info with user
    if (tenantId) {
      localStorage.setItem(`tenant_${userCredential.user.uid}`, tenantId);
    }

    // Get and store the ID token
    try {
      const idToken = await userCredential.user.getIdToken();
      localStorage.setItem('authToken', idToken);
      localStorage.setItem('authTokenExpiry', String(Date.now() + 3600000)); // 1 hour expiry
    } catch (error) {
      console.error('Error storing auth token:', error);
    }

    return userCredential.user;
  }

  async signOut(): Promise<void> {
    await signOut(auth);
    this.currentTenantId = null;
    (auth as any).tenantId = null;
    localStorage.removeItem('currentTenantId');
    localStorage.removeItem('authToken');
    localStorage.removeItem('authTokenExpiry');
  }

  async resetPassword(email: string, tenantId?: string | null): Promise<void> {
    if (tenantId) {
      await this.setTenant(tenantId);
    } else {
      (auth as any).tenantId = null;
    }
    await sendPasswordResetEmail(auth, email);
  }

  onAuthStateChange(callback: (user: User | null) => void): () => void {
    return onAuthStateChanged(auth, callback);
  }

  getCurrentUser(): User | null {
    return auth.currentUser;
  }

  async getAuthToken(): Promise<string | null> {
    const user = auth.currentUser;
    if (!user) {
      localStorage.removeItem('authToken');
      localStorage.removeItem('authTokenExpiry');
      return null;
    }

    // Check if token exists and is not expired
    const storedToken = localStorage.getItem('authToken');
    const tokenExpiry = localStorage.getItem('authTokenExpiry');

    if (storedToken && tokenExpiry) {
      const expiryTime = parseInt(tokenExpiry, 10);
      // Refresh token if it expires in less than 5 minutes
      if (Date.now() < expiryTime - 300000) {
        return storedToken;
      }
    }

    // Token expired or doesn't exist, get a new one
    try {
      const idToken = await user.getIdToken();
      localStorage.setItem('authToken', idToken);
      localStorage.setItem('authTokenExpiry', String(Date.now() + 3600000)); // 1 hour expiry
      return idToken;
    } catch (error) {
      console.error('Error getting auth token:', error);
      return null;
    }
  }

  async refreshAuthToken(): Promise<string | null> {
    const user = auth.currentUser;
    if (!user) {
      return null;
    }

    try {
      const idToken = await user.getIdToken(true); // Force refresh
      localStorage.setItem('authToken', idToken);
      localStorage.setItem('authTokenExpiry', String(Date.now() + 3600000)); // 1 hour expiry
      return idToken;
    } catch (error) {
      console.error('Error refreshing auth token:', error);
      return null;
    }
  }
}

export const authService = new AuthServiceImpl();
