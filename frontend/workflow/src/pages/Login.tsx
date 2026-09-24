import React, { useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { FiAlertCircle, FiArrowLeft, FiArrowRight, FiCheckCircle, FiChevronRight, FiLock, FiMail } from 'react-icons/fi';
import { useAuth } from '../contexts/AuthContext';
import { fetchTenantIdByEmail, TenantInfo } from '../services/tenantService';
import BrandMark from '../components/BrandMark';
import Button from '../components/Button';

const fieldWrap =
  'flex items-center gap-2.5 h-11 px-3 rounded-control border border-line-strong bg-surface ' +
  'focus-within:border-primary focus-within:shadow-focus hover:border-[#A9B0C4]';
const inputBase = 'flex-1 min-w-0 bg-transparent text-body text-ink placeholder:text-ink-subtle outline-none disabled:opacity-60';

/**
 * The swimlane motif from inside the product, drawn as the sign-in artwork: an
 * enquiry travelling between teams. Decorative only.
 */
const FlowArt = () => {
  const lanes = ['Administration', 'Engineering', 'Procurement', 'Management'];
  const colors = ['#2a78d6', '#eda100', '#e87ba4', '#008300'];
  const nodes = [
    { x: 40, lane: 0, label: 'Register' },
    { x: 150, lane: 1, label: 'Site visit' },
    { x: 260, lane: 1, label: 'Verify' },
    { x: 370, lane: 2, label: 'Prices' },
    { x: 480, lane: 1, label: 'BOQ' },
    { x: 590, lane: 3, label: 'Approve', current: true },
  ];
  const laneY = (i: number) => 40 + i * 66;
  const W = 98;
  const H = 36;
  return (
    <svg aria-hidden="true" viewBox="0 0 700 280" className="w-full max-w-[640px]" fill="none">
      {lanes.map((name, i) => (
        <g key={name}>
          <line x1="0" x2="700" y1={laneY(i)} y2={laneY(i)} stroke="rgba(255,255,255,0.06)" strokeWidth="46" />
          <text x="4" y={laneY(i) - 28} fill="rgba(255,255,255,0.4)" fontSize="11" fontFamily="IBM Plex Sans, sans-serif" letterSpacing="0.06em">
            {name.toUpperCase()}
          </text>
        </g>
      ))}
      {nodes.slice(1).map((n, i) => {
        const a = nodes[i];
        const x1 = a.x + W;
        const y1 = laneY(a.lane);
        const x2 = n.x;
        const y2 = laneY(n.lane);
        const mid = (x1 + x2) / 2;
        const d = y1 === y2 ? `M${x1} ${y1} H${x2 - 3}` : `M${x1} ${y1} H${mid - 6} Q${mid} ${y1} ${mid} ${y1 + (y2 > y1 ? 6 : -6)} V${y2 + (y2 > y1 ? -6 : 6)} Q${mid} ${y2} ${mid + 6} ${y2} H${x2 - 3}`;
        return <path key={i} d={d} stroke={i < 4 ? '#8FE3B8' : 'rgba(255,255,255,0.3)'} strokeOpacity={i < 4 ? 0.75 : 1} strokeWidth="1.5" strokeDasharray={i < 4 ? undefined : '4 4'} />;
      })}
      {nodes.map((n, i) => (
        <g key={n.label}>
          {n.current && <rect x={n.x - 5} y={laneY(n.lane) - H / 2 - 5} width={W + 10} height={H + 10} rx="11" fill="#8FE3B8" fillOpacity="0.14" />}
          <rect
            x={n.x}
            y={laneY(n.lane) - H / 2}
            width={W}
            height={H}
            rx="7"
            fill={n.current ? '#FFFFFF' : '#20253D'}
            stroke={n.current ? '#FFFFFF' : 'rgba(255,255,255,0.14)'}
          />
          <rect x={n.x} y={laneY(n.lane) - H / 2 + 7} width="3" height={H - 14} rx="1.5" fill={colors[n.lane]} />
          <text
            x={n.x + 12}
            y={laneY(n.lane) + 4.5}
            fontSize="12.5"
            fontWeight="500"
            fontFamily="IBM Plex Sans, sans-serif"
            fill={n.current ? '#161A2E' : 'rgba(255,255,255,0.85)'}
          >
            {String(i + 1).padStart(2, '0')}  {n.label}
          </text>
        </g>
      ))}
    </svg>
  );
};

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
        errorMessage = tenantId
          ? 'Invalid email, password, or tenant ID. Please verify your credentials.'
          : 'Invalid email or password.';
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

  const heading =
    step === 'email'
      ? isSignUp
        ? 'Create your account'
        : 'Sign in'
      : step === 'tenant-selection'
        ? 'Choose your organisation'
        : isSignUp
          ? 'Set a password'
          : 'Enter your password';

  const subheading =
    step === 'email'
      ? 'Use your work email — we’ll find your organisation.'
      : step === 'tenant-selection'
        ? 'Your email belongs to more than one organisation.'
        : undefined;

  const errorBox = error && (
    <div role="alert" className="flex items-start gap-2.5 px-3 py-2.5 rounded-control bg-danger-subtle border border-danger-border text-body text-danger">
      <FiAlertCircle aria-hidden="true" className="mt-0.5 shrink-0" />
      <span>{error}</span>
    </div>
  );

  const emailChip = (
    <div className="flex items-center justify-between gap-2 h-11 px-3 rounded-control bg-surface-muted border border-line">
      <span className="inline-flex items-center gap-2 text-body text-ink truncate">
        <FiMail aria-hidden="true" className="text-ink-subtle shrink-0" />
        <span className="truncate">{email}</span>
      </span>
      <button
        type="button"
        onClick={handleBackToEmail}
        className="inline-flex items-center gap-1 text-meta font-medium text-primary hover:underline underline-offset-2 shrink-0 cursor-pointer"
      >
        <FiArrowLeft aria-hidden="true" />
        Change
      </button>
    </div>
  );

  return (
    <div className="min-h-screen grid lg:grid-cols-[minmax(0,1.1fr)_minmax(0,1fr)] bg-surface">
      <aside className="hidden lg:flex flex-col justify-between bg-shell text-white px-12 py-10 relative overflow-hidden">
        <div className="flex items-center gap-3">
          <BrandMark size={34} />
          <div className="leading-tight">
            <p className="text-[16px] font-semibold tracking-tight">Workflow</p>
            <p className="text-meta text-shell-muted">Management</p>
          </div>
        </div>

        <div className="py-10">
          <FlowArt />
        </div>

        <div className="max-w-md">
          <p className="text-[26px] leading-[34px] font-semibold tracking-tight">
            Every enquiry, every stage, every hand-off.
          </p>
          <p className="mt-3 text-body text-shell-text">
            See where each quotation is, who has it, and what happens next — from the first call to the issued quote.
          </p>
        </div>
      </aside>

      <main className="flex flex-col justify-center px-6 sm:px-12 py-10">
        <div className="w-full max-w-[380px] mx-auto">
          <div className="lg:hidden flex items-center gap-3 mb-10">
            <BrandMark size={32} />
            <span className="text-title font-semibold text-ink">Workflow Management</span>
          </div>

          <h1 className="text-display font-semibold text-ink">{heading}</h1>
          {subheading && <p className="mt-1.5 text-body text-ink-muted">{subheading}</p>}

          <div className="mt-8">
            {step === 'email' ? (
              <form onSubmit={handleEmailSubmit} className="space-y-4">
                <div>
                  <label htmlFor="email" className="block text-body font-medium text-ink mb-1.5">
                    Work email
                  </label>
                  <div className={fieldWrap}>
                    <FiMail aria-hidden="true" className="text-ink-subtle shrink-0" />
                    <input
                      id="email"
                      type="email"
                      value={email}
                      onChange={(e) => setEmail(e.target.value)}
                      required
                      autoComplete="email"
                      placeholder="name@company.com"
                      autoFocus
                      disabled={fetchingTenant}
                      className={inputBase}
                    />
                  </div>
                </div>

                {errorBox}

                <Button type="submit" variant="primary" size="lg" className="w-full" loading={fetchingTenant} disabled={!email} trailingIcon={!fetchingTenant ? <FiArrowRight /> : undefined}>
                  {fetchingTenant ? 'Finding your organisation…' : 'Continue'}
                </Button>

                <p className="text-meta text-ink-subtle">User accounts are managed in Product Hub.</p>
              </form>
            ) : step === 'tenant-selection' ? (
              <div className="space-y-4">
                {emailChip}
                <ul className="space-y-2">
                  {availableTenants.map((tenant, index) => (
                    <li key={index}>
                      <button
                        type="button"
                        onClick={() => handleTenantSelect(tenant.tenantId)}
                        className="group flex items-center justify-between w-full px-4 py-3 rounded-card border border-line-strong text-left hover:border-primary hover:bg-primary-subtle cursor-pointer"
                      >
                        <div className="min-w-0">
                          <div className="font-semibold text-ink text-body">{tenant.displayName || 'Default Tenant'}</div>
                          {tenant.tenantId && <div className="text-ink-subtle text-[11px] font-mono mt-0.5 truncate">ID: {tenant.tenantId}</div>}
                        </div>
                        <FiChevronRight aria-hidden="true" className="text-ink-subtle group-hover:text-primary shrink-0" />
                      </button>
                    </li>
                  ))}
                </ul>
              </div>
            ) : (
              <form onSubmit={handlePasswordSubmit} className="space-y-4">
                {emailChip}

                {tenantAutoDetected && (
                  <p className="flex items-center gap-2 text-meta text-success">
                    <FiCheckCircle aria-hidden="true" />
                    Organisation found <span className="font-mono text-[11px] text-ink-subtle truncate">{tenantId}</span>
                  </p>
                )}

                {!tenantAutoDetected && (
                  <div>
                    <label htmlFor="tenantId" className="block text-body font-medium text-ink mb-1.5">
                      Tenant ID <span className="font-normal text-ink-subtle">{tenantId ? '' : '(if you belong to a tenant)'}</span>
                    </label>
                    <div className={fieldWrap}>
                      <input
                        id="tenantId"
                        type="text"
                        value={tenantId}
                        onChange={(e) => setTenantId(e.target.value)}
                        placeholder="Enter tenant ID"
                        className={`${inputBase} font-mono text-meta`}
                      />
                    </div>
                  </div>
                )}

                <div>
                  <label htmlFor="password" className="block text-body font-medium text-ink mb-1.5">
                    Password
                  </label>
                  <div className={fieldWrap}>
                    <FiLock aria-hidden="true" className="text-ink-subtle shrink-0" />
                    <input
                      id="password"
                      type="password"
                      value={password}
                      onChange={(e) => setPassword(e.target.value)}
                      required
                      autoComplete={isSignUp ? 'new-password' : 'current-password'}
                      placeholder="Your password"
                      minLength={6}
                      autoFocus
                      className={inputBase}
                    />
                  </div>
                </div>

                {errorBox}

                <Button type="submit" variant="primary" size="lg" className="w-full" loading={loading}>
                  {loading ? 'Signing in…' : isSignUp ? 'Sign up' : 'Sign in'}
                </Button>
              </form>
            )}
          </div>

          <p className="mt-8 text-body text-ink-muted">
            {isSignUp ? 'Already have an account?' : "Don't have an account?"}{' '}
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
              className="font-medium text-primary hover:underline underline-offset-2 cursor-pointer"
            >
              {isSignUp ? 'Sign in' : 'Sign up'}
            </button>
          </p>
        </div>
      </main>
    </div>
  );
};
