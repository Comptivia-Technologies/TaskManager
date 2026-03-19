import React from 'react';
import { render, screen, waitFor, fireEvent } from '@testing-library/react';
import { AuthProvider, useAuth } from '../../contexts/AuthContext';

jest.mock('../../utils/tokenUtils', () => ({
  getOrganizationIdFromToken: () => 'org-1',
}));
const mockGetOrgCookie = jest.fn(() => null as string | null);
jest.mock('../../utils/cookieUtils', () => ({
  setOrganizationIdCookie: jest.fn(),
  getOrganizationIdFromCookie: () => mockGetOrgCookie(),
  clearOrganizationIdCookie: jest.fn(),
}));

jest.mock('../../services/tenantService', () => ({
  fetchTenantIdByEmail: jest.fn(),
}));

jest.mock('../../services/authService', () => ({
  authService: {
    onAuthStateChange: jest.fn((cb: (u: null) => void) => {
      setTimeout(() => cb(null), 0);
      return jest.fn();
    }),
    signIn: jest.fn(),
    signOut: jest.fn(),
    signUp: jest.fn(),
    resetPassword: jest.fn(),
    setTenant: jest.fn(),
    getAuthToken: jest.fn().mockResolvedValue(null),
    refreshAuthToken: jest.fn().mockResolvedValue(null),
  },
}));

jest.mock('../../firebase/config', () => ({
  auth: { tenantId: null as string | null },
}));

const Consumer = () => {
  const { loading, user } = useAuth();
  return (
    <div>
      <span data-testid="loading">{String(loading)}</span>
      <span data-testid="user">{user ? user.uid : 'null'}</span>
    </div>
  );
};

describe('AuthContext', () => {
  beforeEach(() => {
    jest.clearAllMocks();
    localStorage.clear();
    mockGetOrgCookie.mockReturnValue(null);
    const { authService } = require('../../services/authService');
    (authService.onAuthStateChange as jest.Mock).mockImplementation((cb: (u: null) => void) => {
      setTimeout(() => cb(null), 0);
      return jest.fn();
    });
    (authService.setTenant as jest.Mock).mockResolvedValue(undefined);
  });

  it('AuthProvider renders children and useAuth resolves', async () => {
    render(
      <AuthProvider>
        <Consumer />
      </AuthProvider>
    );
    await screen.findByTestId('loading');
    expect(screen.getByTestId('user')).toBeInTheDocument();
  });

  it('sets organizationId when user is present', async () => {
    const { authService } = require('../../services/authService');
    (authService.onAuthStateChange as jest.Mock).mockImplementationOnce((cb: any) => {
      setTimeout(() => cb({ uid: 'u1', getIdToken: () => Promise.resolve('tok') }), 0);
      return jest.fn();
    });

    const ConsumerOrg = () => {
      const { organizationId } = useAuth();
      return <div data-testid="org">{organizationId ?? 'null'}</div>;
    };

    render(
      <AuthProvider>
        <ConsumerOrg />
      </AuthProvider>
    );
    await waitFor(() => {
      expect(screen.getByTestId('org')).toHaveTextContent('org-1');
    }, { timeout: 3000 });
  });

  it('useAuth throws when used outside AuthProvider', () => {
    const ThrowAuth = () => {
      useAuth();
      return null;
    };
    const consoleSpy = jest.spyOn(console, 'error').mockImplementation(() => {});
    expect(() => render(<ThrowAuth />)).toThrow('useAuth must be used within an AuthProvider');
    consoleSpy.mockRestore();
  });

  it('applies saved currentTenantId to auth on mount when callback not fired yet', () => {
    const { authService } = require('../../services/authService');
    (authService.onAuthStateChange as jest.Mock).mockImplementation(() => jest.fn());
    localStorage.setItem('currentTenantId', 'saved-tenant');
    const { auth } = require('../../firebase/config');
    render(
      <AuthProvider>
        <span>x</span>
      </AuthProvider>
    );
    expect((auth as { tenantId: string | null }).tenantId).toBe('saved-tenant');
  });

  it('sets organizationId from cookie on mount', async () => {
    mockGetOrgCookie.mockReturnValue('cookie-org');
    const ConsumerOrg = () => {
      const { organizationId } = useAuth();
      return <div data-testid="org-c">{organizationId ?? 'null'}</div>;
    };
    render(
      <AuthProvider>
        <ConsumerOrg />
      </AuthProvider>
    );
    await waitFor(() => {
      expect(screen.getByTestId('org-c')).toHaveTextContent('cookie-org');
    });
  });

  it('applies per-user tenant from localStorage when user signs in', async () => {
    const { authService } = require('../../services/authService');
    (authService.onAuthStateChange as jest.Mock).mockImplementation((cb: any) => {
      setTimeout(() => cb({ uid: 'u9', getIdToken: () => Promise.resolve('tok') }), 0);
      return jest.fn();
    });
    localStorage.setItem('tenant_u9', 'per-user-tenant');
    const { auth } = require('../../firebase/config');
    const ConsumerT = () => {
      const { currentTenantId } = useAuth();
      return <div data-testid="ct">{currentTenantId ?? 'null'}</div>;
    };
    render(
      <AuthProvider>
        <ConsumerT />
      </AuthProvider>
    );
    await waitFor(() => {
      expect(screen.getByTestId('ct')).toHaveTextContent('per-user-tenant');
      expect((auth as { tenantId: string | null }).tenantId).toBe('per-user-tenant');
    });
  });

  it('logs when getIdToken fails on user', async () => {
    const { authService } = require('../../services/authService');
    (authService.onAuthStateChange as jest.Mock).mockImplementation((cb: any) => {
      setTimeout(() => cb({ uid: 'u8', getIdToken: () => Promise.reject(new Error('id-token')) }), 0);
      return jest.fn();
    });
    const spy = jest.spyOn(console, 'error').mockImplementation(() => {});
    render(
      <AuthProvider>
        <Consumer />
      </AuthProvider>
    );
    await waitFor(() => {
      expect(spy).toHaveBeenCalled();
    });
    spy.mockRestore();
  });

  it('clears tenant and tokens when user becomes null', async () => {
    const { authService } = require('../../services/authService');
    (authService.onAuthStateChange as jest.Mock).mockImplementation((cb: any) => {
      setTimeout(() => cb({ uid: 'u7', getIdToken: () => Promise.resolve('t') }), 0);
      setTimeout(() => cb(null), 20);
      return jest.fn();
    });
    const { clearOrganizationIdCookie } = require('../../utils/cookieUtils');
    const { auth } = require('../../firebase/config');
    render(
      <AuthProvider>
        <Consumer />
      </AuthProvider>
    );
    await waitFor(() => expect(screen.getByTestId('user')).toHaveTextContent('u7'));
    await waitFor(() => expect(screen.getByTestId('user')).toHaveTextContent('null'));
    expect(clearOrganizationIdCookie).toHaveBeenCalled();
    expect((auth as { tenantId: string | null }).tenantId).toBeNull();
    expect(localStorage.getItem('authToken')).toBeNull();
  });

  it('exposes signIn signUp signOut resetPassword setTenant fetchTenantId and token helpers', async () => {
    const { authService } = require('../../services/authService');
    (authService.onAuthStateChange as jest.Mock).mockImplementation(() => jest.fn());
    const { fetchTenantIdByEmail } = require('../../services/tenantService');
    (fetchTenantIdByEmail as jest.Mock).mockImplementation(() =>
      Promise.resolve({ tenantId: 'remote-t' })
    );
    (authService.getAuthToken as jest.Mock).mockResolvedValue('gt');
    (authService.refreshAuthToken as jest.Mock).mockResolvedValue('rt');

    const Panel = () => {
      const a = useAuth();
      return (
        <div>
          <button type="button" data-testid="si" onClick={() => a.signIn('a@b.com', 'p', 't1')}>
            si
          </button>
          <button type="button" data-testid="su" onClick={() => a.signUp('a@b.com', 'p', 't2')}>
            su
          </button>
          <button type="button" data-testid="so" onClick={() => a.signOut()}>
            so
          </button>
          <button type="button" data-testid="rp" onClick={() => a.resetPassword('a@b.com', 't3')}>
            rp
          </button>
          <button type="button" data-testid="st" onClick={() => a.setTenant('t4')}>
            st
          </button>
          <button type="button" data-testid="ft" onClick={() => void a.fetchTenantId('a@b.com')}>
            ft
          </button>
          <button type="button" data-testid="gat" onClick={() => void a.getAuthToken()}>
            gat
          </button>
          <button type="button" data-testid="rat" onClick={() => void a.refreshAuthToken()}>
            rat
          </button>
          <span data-testid="tid">{a.currentTenantId ?? 'null'}</span>
        </div>
      );
    };

    render(
      <AuthProvider>
        <Panel />
      </AuthProvider>
    );
    await screen.findByTestId('si');

    fireEvent.click(screen.getByTestId('si'));
    await waitFor(() => expect(authService.signIn).toHaveBeenCalledWith('a@b.com', 'p', 't1'));

    fireEvent.click(screen.getByTestId('su'));
    await waitFor(() => expect(authService.signUp).toHaveBeenCalledWith('a@b.com', 'p', 't2'));

    fireEvent.click(screen.getByTestId('so'));
    await waitFor(() => expect(authService.signOut).toHaveBeenCalled());

    fireEvent.click(screen.getByTestId('rp'));
    await waitFor(() => expect(authService.resetPassword).toHaveBeenCalledWith('a@b.com', 't3'));

    fireEvent.click(screen.getByTestId('st'));
    await waitFor(() => expect(authService.setTenant).toHaveBeenCalledWith('t4'));

    fireEvent.click(screen.getByTestId('ft'));
    await waitFor(() => expect(fetchTenantIdByEmail).toHaveBeenCalledWith('a@b.com'));
    await waitFor(() => expect(authService.setTenant).toHaveBeenCalledWith('remote-t'));
    await waitFor(() => expect(screen.getByTestId('tid')).toHaveTextContent('remote-t'));

    fireEvent.click(screen.getByTestId('gat'));
    await waitFor(() => expect(authService.getAuthToken).toHaveBeenCalled());

    fireEvent.click(screen.getByTestId('rat'));
    await waitFor(() => expect(authService.refreshAuthToken).toHaveBeenCalled());
  });

  it('getAuthToken and refreshAuthToken return service results', async () => {
    const { authService } = require('../../services/authService');
    (authService.onAuthStateChange as jest.Mock).mockImplementation(() => jest.fn());
    (authService.getAuthToken as jest.Mock).mockResolvedValue('tok-a');
    (authService.refreshAuthToken as jest.Mock).mockResolvedValue('tok-b');

    const Panel = () => {
      const a = useAuth();
      const [out, setOut] = React.useState('');
      return (
        <>
          <button
            type="button"
            data-testid="run"
            onClick={async () => {
              const x = await a.getAuthToken();
              const y = await a.refreshAuthToken();
              setOut(`${x}|${y}`);
            }}
          >
            run
          </button>
          <span data-testid="out">{out}</span>
        </>
      );
    };

    render(
      <AuthProvider>
        <Panel />
      </AuthProvider>
    );
    fireEvent.click(await screen.findByTestId('run'));
    await waitFor(() => expect(screen.getByTestId('out')).toHaveTextContent('tok-a|tok-b'));
  });

  it('fetchTenantId returns null when lookup has no tenantId', async () => {
    const { fetchTenantIdByEmail } = require('../../services/tenantService');
    (fetchTenantIdByEmail as jest.Mock).mockResolvedValue({ tenantId: null });

    const Panel = () => {
      const a = useAuth();
      return (
        <>
          <button type="button" data-testid="ft2" onClick={() => void a.fetchTenantId('x@b.com')}>
            ft
          </button>
          <span data-testid="tid2">{a.currentTenantId ?? 'null'}</span>
        </>
      );
    };

    render(
      <AuthProvider>
        <Panel />
      </AuthProvider>
    );
    fireEvent.click(await screen.findByTestId('ft2'));
    await waitFor(() => expect(fetchTenantIdByEmail).toHaveBeenCalled());
    await waitFor(() => expect(screen.getByTestId('tid2')).toHaveTextContent('null'));
  });

  it('signIn and signUp without tenantId do not set currentTenantId via branch', async () => {
    const { authService } = require('../../services/authService');
    const Panel = () => {
      const a = useAuth();
      return (
        <>
          <button type="button" data-testid="sint" onClick={() => a.signIn('a@b.com', 'p')}>
            x
          </button>
          <button type="button" data-testid="sunt" onClick={() => a.signUp('a@b.com', 'p')}>
            y
          </button>
        </>
      );
    };
    render(
      <AuthProvider>
        <Panel />
      </AuthProvider>
    );
    fireEvent.click(await screen.findByTestId('sint'));
    await waitFor(() => expect(authService.signIn).toHaveBeenCalledWith('a@b.com', 'p', undefined));
    fireEvent.click(screen.getByTestId('sunt'));
    await waitFor(() => expect(authService.signUp).toHaveBeenCalledWith('a@b.com', 'p', undefined));
  });
});
