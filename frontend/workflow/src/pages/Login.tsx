import React, { useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { FiMail, FiLock, FiChevronRight } from 'react-icons/fi';
import { useAuth } from '../contexts/AuthContext';
import { fetchTenantIdByEmail, TenantInfo } from '../services/tenantService';

const inputBase =
  'w-full bg-transparent py-3 text-gray-800 placeholder-gray-400 text-sm outline-none border-0 border-b-0 ring-0 focus:ring-0 focus:outline-none disabled:opacity-60';

export const Login: React.FC = () => {
  const [step, setStep] = useState<'email' | 'tenant-selection' | 'password'>('email');
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [tenantId, setTenantId] = useState('');
  const [isSignUp, setIsSignUp] = useState(false);
  const [error, setError] = useState('');
  const [loading, setLoading] = useState(false);
  const [fetchingTenant, setFetchingTenant] = useState(false);
  const [tenantAutoDetected, setTenantAutoDetected] = useState(false);
  const [availableTenants, setAvailableTenants] = useState<TenantInfo[]>([]);
  const { signIn, signUp, setTenant } = useAuth();
  const navigate = useNavigate();

  const handleEmailSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setError('');
    setFetchingTenant(true);

    try {
      const result = await fetchTenantIdByEmail(email);

      if (result.multipleTenants && result.tenants && result.tenants.length > 0) {
        setAvailableTenants(result.tenants);
        setTenantAutoDetected(false);
        setError('');
        setStep('tenant-selection');
        return;
      }

      if (result.tenantId) {
        setTenantId(result.tenantId);
        setTenantAutoDetected(true);
        await setTenant(result.tenantId);
        setError('');
        setStep('password');
        return;
      }

      setTenantAutoDetected(false);
      if (result.error) {
        setError(result.error);
      } else if (result.exists) {
        setError('Tenant ID not found for this email. Please enter it manually if your account belongs to a tenant.');
      } else {
        setError('User not found. Please check your email address.');
      }
      setStep('password');
    } catch (err: any) {
      setError(err.message || 'Failed to fetch tenant information. You can still proceed with manual tenant ID.');
      setStep('password');
    } finally {
      setFetchingTenant(false);
    }
  };

  const handlePasswordSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setError('');
    setLoading(true);

    try {
      if (isSignUp) {
        await signUp(email, password, tenantId || undefined);
      } else {
        if (!tenantId) {
          try {
            await signIn(email, password);
            navigate('/workflows');
            return;
          } catch (err: any) {
            if (err.code === 'auth/invalid-credential') {
              setError('Authentication failed. Your account might belong to a tenant. Please enter your Tenant ID above.');
              setLoading(false);
              return;
            }
            throw err;
          }
        } else {
          await signIn(email, password, tenantId);
        }
      }
      navigate('/workflows');
    } catch (err: any) {
      let errorMessage = err.message || 'Authentication failed. Please try again.';

      if (err.code === 'auth/invalid-credential') {
        if (tenantId) {
          errorMessage = 'Invalid email, password, or tenant ID. Please verify your credentials.';
        } else {
          errorMessage = 'Invalid email or password.';
        }
      } else if (err.code === 'auth/user-not-found') {
        errorMessage = 'No user found with this email address.';
      } else if (err.code === 'auth/wrong-password') {
        errorMessage = 'Incorrect password.';
      }

      setError(errorMessage);
    } finally {
      setLoading(false);
    }
  };

  const handleBackToEmail = () => {
    setStep('email');
    setPassword('');
    setError('');
    setTenantId('');
    setTenantAutoDetected(false);
    setAvailableTenants([]);
  };

  const handleTenantSelect = async (selectedTenantId: string) => {
    setTenantId(selectedTenantId || '');
    if (selectedTenantId) {
      setTenantAutoDetected(true);
      await setTenant(selectedTenantId);
    }
    setStep('password');
  };

  return (
    <div className="min-h-screen flex items-center justify-center bg-gray-100 p-4">
      <div className="w-full max-w-4xl flex flex-col md:flex-row bg-white rounded-none shadow-lg overflow-hidden">
        {/* Left: branding (inside card) */}
        <div className="hidden md:flex md:w-1/2 flex-col justify-between bg-gradient-to-br from-indigo-600 via-purple-600 to-slate-800 p-10 text-white">
          <div className="flex flex-col items-center text-center">
            <div className="w-20 h-20 rounded-none bg-white/20 flex items-center justify-center mb-6">
              <span className="text-3xl font-bold tracking-tight">W</span>
            </div>
            <h1 className="text-2xl font-bold tracking-tight">Workload Automation</h1>
            <p className="text-white/80 text-sm uppercase tracking-widest mt-3">Task & workflow management</p>
          </div>
          <div className="text-center">
            <p className="text-white/70 text-sm uppercase tracking-wider">Nice to see you again</p>
            <p className="text-xl font-semibold uppercase tracking-wide mt-1">Welcome back</p>
          </div>
        </div>

        {/* Right: form (inside card) */}
        <div className="md:w-1/2 flex flex-col justify-center p-8 sm:p-12 md:p-14">
          <div className="w-full max-w-md mx-auto">
            {/* Mobile branding */}
            <div className="md:hidden flex items-center gap-3 mb-6">
              <div className="w-10 h-10 rounded-none bg-gray-900 flex items-center justify-center">
                <span className="text-lg font-bold text-white">W</span>
              </div>
              <span className="text-lg font-semibold text-gray-900">Workload Automation</span>
            </div>

          <h2 className="text-xl font-bold text-gray-900 uppercase tracking-wide mb-8 text-center">
            {step === 'email' ? 'Login' : step === 'tenant-selection' ? 'Select tenant' : isSignUp ? 'Sign up' : 'Sign in'}
          </h2>

          {step === 'email' ? (
            <form onSubmit={handleEmailSubmit} className="space-y-6">
              <div>
                <div className="flex items-center gap-2 border-b-2 border-gray-200 focus-within:border-gray-800 transition-colors">
                  <FiMail className="text-gray-400 shrink-0" size={18} />
                  <input
                    id="email"
                    type="email"
                    value={email}
                    onChange={(e) => setEmail(e.target.value)}
                    required
                    placeholder="Enter your email"
                    autoFocus
                    disabled={fetchingTenant}
                    className={inputBase + ' pl-0'}
                  />
                </div>
              </div>

              {error && <p className="text-sm text-red-600">{error}</p>}

              <button
                type="submit"
                disabled={fetchingTenant || !email}
                className="w-full py-3.5 bg-gray-900 text-white font-semibold text-sm uppercase tracking-wider rounded-none hover:bg-gray-800 transition-colors disabled:opacity-50 disabled:cursor-not-allowed disabled:hover:bg-gray-900"
              >
                {fetchingTenant ? 'Looking up tenant...' : 'Continue'}
              </button>

              <p className="text-xs text-gray-500 text-center leading-relaxed">
                Enter your email to lookup your tenant. User management is handled by external system.
              </p>
            </form>
          ) : step === 'tenant-selection' ? (
            <div className="space-y-6">
              <div className="flex items-center justify-between gap-2 py-2">
                <span className="text-sm text-gray-600 truncate">{email}</span>
                <button
                  type="button"
                  onClick={handleBackToEmail}
                  className="text-sm text-gray-900 font-medium underline shrink-0 hover:no-underline"
                >
                  Change
                </button>
              </div>

              <p className="text-sm text-gray-600 leading-relaxed">
                Your email is associated with multiple tenants. Select which tenant you want to use:
              </p>

              <div className="flex flex-col gap-2">
                {availableTenants.map((tenant, index) => (
                  <button
                    key={index}
                    type="button"
                    onClick={() => handleTenantSelect(tenant.tenantId)}
                    className="flex items-center justify-between w-full p-4 rounded-none border-2 border-gray-200 text-left hover:border-gray-800 hover:bg-gray-50 transition-all group"
                  >
                    <div>
                      <div className="font-semibold text-gray-900 text-sm">{tenant.displayName || 'Default Tenant'}</div>
                      {tenant.tenantId && (
                        <div className="text-gray-500 text-xs font-mono mt-0.5">ID: {tenant.tenantId}</div>
                      )}
                    </div>
                    <FiChevronRight className="text-gray-400 group-hover:text-gray-800 shrink-0" size={18} />
                  </button>
                ))}
              </div>
            </div>
          ) : (
            <form onSubmit={handlePasswordSubmit} className="space-y-6">
              <div className="flex items-center justify-between gap-2 py-2">
                <span className="text-sm text-gray-600 truncate">{email}</span>
                <button
                  type="button"
                  onClick={handleBackToEmail}
                  className="text-sm text-gray-900 font-medium underline shrink-0 hover:no-underline"
                >
                  Change
                </button>
              </div>

              {tenantAutoDetected && (
                <p className="text-xs text-green-700 bg-green-50 py-2 px-3 rounded-none">Tenant: {tenantId}</p>
              )}

{!tenantAutoDetected && (
              <div className="mb-4">
                <label htmlFor="tenantId" className="block text-xs font-medium text-gray-500 mb-1">
                  Tenant ID {tenantId ? '' : '(required if you belong to a tenant)'}
                </label>
                <div className="border-b-2 border-gray-200 focus-within:border-gray-800 transition-colors">
                  <input
                    id="tenantId"
                    type="text"
                    value={tenantId}
                    onChange={(e) => setTenantId(e.target.value)}
                    placeholder="Enter tenant ID"
                    className={inputBase}
                  />
                </div>
              </div>
              )}

              <div>
                <div className="flex items-center gap-2 border-b-2 border-gray-200 focus-within:border-gray-800 transition-colors">
                  <FiLock className="text-gray-400 shrink-0" size={18} />
                  <input
                    id="password"
                    type="password"
                    value={password}
                    onChange={(e) => setPassword(e.target.value)}
                    required
                    placeholder="Enter your password"
                    minLength={6}
                    autoFocus
                    className={inputBase + ' pl-0'}
                  />
                </div>
              </div>

              {error && <p className="text-sm text-red-600">{error}</p>}

              <button
                type="submit"
                disabled={loading}
                className="w-full py-3.5 bg-gray-900 text-white font-semibold text-sm uppercase tracking-wider rounded-none hover:bg-gray-800 transition-colors disabled:opacity-50 disabled:cursor-not-allowed disabled:hover:bg-gray-900"
              >
                {loading ? 'Signing in...' : isSignUp ? 'Sign up' : 'Sign in'}
              </button>
            </form>
          )}

          <div className="mt-8 text-center">
            <button
              type="button"
              onClick={() => {
                setIsSignUp(!isSignUp);
                setError('');
                setStep('email');
                setEmail('');
                setPassword('');
                setTenantId('');
              }}
              className="text-sm text-gray-600 underline hover:text-gray-900"
            >
              {isSignUp ? 'Already have an account? Sign in' : "Don't have an account? Sign up"}
            </button>
          </div>
        </div>
        </div>
      </div>
    </div>
  );
};
