import React, { useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { useAuth } from '../contexts/AuthContext';
import { fetchTenantIdByEmail, TenantInfo } from '../services/tenantService';

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

      // Handle multiple tenants case
      if (result.multipleTenants && result.tenants && result.tenants.length > 0) {
        setAvailableTenants(result.tenants);
        setTenantAutoDetected(false);
        setError('');
        setStep('tenant-selection');
        return;
      }

      // Handle single tenant found
      if (result.tenantId) {
        setTenantId(result.tenantId);
        setTenantAutoDetected(true);
        await setTenant(result.tenantId);
        setError('');
        setStep('password');
        return;
      }

      // No tenant found or error
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
    <div className="flex justify-center items-center min-h-screen bg-gradient-to-br from-[#667eea] to-[#764ba2] p-5">
      <div className="bg-white rounded-xl p-10 shadow-2xl w-full max-w-md">
        <h1 className="text-3xl font-semibold text-center text-gray-800 mb-2">Workload Automation</h1>
        <h2 className="text-xl text-center text-gray-600 mb-8 font-normal">
          {isSignUp ? 'Sign Up' : 'Sign In'}
        </h2>

        {step === 'email' ? (
          <form onSubmit={handleEmailSubmit}>
            <div className="mb-5">
              <label htmlFor="email" className="block mb-2 text-sm font-medium text-gray-700">
                Email
              </label>
              <input
                id="email"
                type="email"
                value={email}
                onChange={(e) => setEmail(e.target.value)}
                required
                placeholder="Enter your email"
                autoFocus
                disabled={fetchingTenant}
                className="w-full px-3 py-3 border border-gray-300 rounded-md text-sm focus:outline-none focus:ring-2 focus:ring-[#667eea] focus:border-transparent disabled:bg-gray-100"
              />
              <small className="block mt-1.5 text-xs text-gray-500 italic">
                We'll automatically detect your tenant if available
              </small>
            </div>

            {error && (
              <div className="mb-5 p-3 bg-red-50 text-red-700 rounded-md text-sm">{error}</div>
            )}

            <button
              type="submit"
              disabled={fetchingTenant || !email}
              className="w-full py-3 bg-gradient-to-r from-[#667eea] to-[#764ba2] text-white rounded-md font-semibold text-base transition-opacity hover:opacity-90 disabled:opacity-60 disabled:cursor-not-allowed"
            >
              {fetchingTenant ? 'Looking up tenant...' : 'Continue'}
            </button>
          </form>
        ) : step === 'tenant-selection' ? (
          <div>
            <div className="flex items-center gap-2.5 p-3 bg-gray-50 rounded-md mb-5">
              <span className="font-medium text-sm text-gray-600">Email:</span>
              <span className="flex-1 text-sm text-gray-800">{email}</span>
              <button
                type="button"
                onClick={handleBackToEmail}
                className="text-sm text-[#667eea] underline bg-transparent border-none cursor-pointer p-0"
              >
                Change
              </button>
            </div>

            <div className="mb-6">
              <h3 className="text-xl font-semibold text-gray-800 mb-2">Select Tenant</h3>
              <p className="text-sm text-gray-600 leading-relaxed">
                Your email is associated with multiple tenants. Please select which tenant you want to use:
              </p>
            </div>

            <div className="flex flex-col gap-3">
              {availableTenants.map((tenant, index) => (
                <button
                  key={index}
                  type="button"
                  onClick={() => handleTenantSelect(tenant.tenantId)}
                  className="flex items-center justify-between w-full p-4 bg-white border-2 border-gray-200 rounded-lg cursor-pointer transition-all text-left hover:border-[#667eea] hover:bg-[#f8f9ff] hover:translate-x-1"
                >
                  <div className="flex-1">
                    <div className="font-semibold text-gray-800 text-base mb-1">
                      {tenant.displayName || 'Default Tenant'}
                    </div>
                    {tenant.tenantId && (
                      <div className="text-gray-600 text-xs font-mono">ID: {tenant.tenantId}</div>
                    )}
                  </div>
                  <span className="text-[#667eea] text-xl font-bold ml-3">→</span>
                </button>
              ))}
            </div>
          </div>
        ) : (
          <form onSubmit={handlePasswordSubmit}>
            <div className="flex items-center gap-2.5 p-3 bg-gray-50 rounded-md mb-5">
              <span className="font-medium text-sm text-gray-600">Email:</span>
              <span className="flex-1 text-sm text-gray-800">{email}</span>
              <button
                type="button"
                onClick={handleBackToEmail}
                className="text-sm text-[#667eea] underline bg-transparent border-none cursor-pointer p-0"
              >
                Change
              </button>
            </div>

            {tenantAutoDetected && (
              <div className="mb-5 p-3 bg-green-50 border border-green-200 rounded-md text-green-800 text-sm leading-relaxed">
                ✓ Tenant ID automatically detected: <strong>{tenantId}</strong>
              </div>
            )}

            {!tenantAutoDetected && (
              <div className="mb-5">
                <label htmlFor="tenantId" className="block mb-2 text-sm font-medium text-gray-700">
                  Tenant ID {tenantId ? '' : '(Required if user belongs to a tenant)'}
                </label>
                <input
                  id="tenantId"
                  type="text"
                  value={tenantId}
                  onChange={(e) => setTenantId(e.target.value)}
                  placeholder="Enter tenant ID if your account belongs to a tenant"
                  className="w-full px-3 py-3 border border-gray-300 rounded-md text-sm focus:outline-none focus:ring-2 focus:ring-[#667eea] focus:border-transparent"
                />
                <small className="block mt-1.5 text-xs text-gray-500 italic">
                  Tenant lookup failed or tenant not found. Please enter tenant ID manually.
                </small>
              </div>
            )}

            <div className="mb-5">
              <label htmlFor="password" className="block mb-2 text-sm font-medium text-gray-700">
                Password
              </label>
              <input
                id="password"
                type="password"
                value={password}
                onChange={(e) => setPassword(e.target.value)}
                required
                placeholder="Enter your password"
                minLength={6}
                autoFocus
                className="w-full px-3 py-3 border border-gray-300 rounded-md text-sm focus:outline-none focus:ring-2 focus:ring-[#667eea] focus:border-transparent"
              />
            </div>

            {error && (
              <div className="mb-5 p-3 bg-red-50 text-red-700 rounded-md text-sm">{error}</div>
            )}

            <button
              type="submit"
              disabled={loading}
              className="w-full py-3 bg-gradient-to-r from-[#667eea] to-[#764ba2] text-white rounded-md font-semibold text-base transition-opacity hover:opacity-90 disabled:opacity-60 disabled:cursor-not-allowed"
            >
              {loading ? 'Signing in...' : isSignUp ? 'Sign Up' : 'Sign In'}
            </button>
          </form>
        )}

        <div className="mt-5 text-center">
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
            className="text-sm text-[#667eea] underline bg-transparent border-none cursor-pointer p-0 hover:text-[#764ba2]"
          >
            {isSignUp
              ? 'Already have an account? Sign In'
              : "Don't have an account? Sign Up"}
          </button>
        </div>
      </div>
    </div>
  );
};
