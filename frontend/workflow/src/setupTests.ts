import '@testing-library/jest-dom';

// Fail fast: no single test should run longer than 10s
jest.setTimeout(10000);

// Suppress known test-environment warnings (deprecations, third-party libs)
const originalError = console.error;
const originalWarn = console.warn;
console.error = (...args: unknown[]) => {
  const msg = typeof args[0] === 'string' ? args[0] : '';
  if (
    msg.includes('ReactDOMTestUtils.act') ||
    msg.includes('was not wrapped in act')
  ) {
    return;
  }
  originalError.apply(console, args);
};
console.warn = (...args: unknown[]) => {
  const msg = typeof args[0] === 'string' ? args[0] : '';
  if (
    msg.includes('React Router Future Flag') ||
    msg.includes('v7_startTransition') ||
    msg.includes('v7_relativeSplatPath') ||
    msg.includes('No routes matched') ||
    msg.includes('Invalid date:')
  ) {
    return;
  }
  originalWarn.apply(console, args);
};

if (!process.env.REACT_APP_API_URL) {
  process.env.REACT_APP_API_URL = 'http://test';
}

jest.mock('axios', () => ({
  __esModule: true,
  default: {
    create: jest.fn(() => ({
      get: jest.fn(),
      post: jest.fn(),
      put: jest.fn(),
      delete: jest.fn(),
      patch: jest.fn(),
      interceptors: { request: { use: jest.fn() }, response: { use: jest.fn() } },
    })),
  },
}));

jest.mock('firebase/auth', () => ({
  getAuth: jest.fn(() => ({ currentUser: null, tenantId: null })),
  signInWithEmailAndPassword: jest.fn(),
  signOut: jest.fn(),
  onAuthStateChanged: jest.fn(() => jest.fn()),
  setPersistence: jest.fn(),
  browserLocalPersistence: {},
  createUserWithEmailAndPassword: jest.fn(),
  sendPasswordResetEmail: jest.fn(),
}));

jest.mock('./firebase/config', () => ({
  auth: { currentUser: null, tenantId: null },
  default: {},
}));

// Mock window.location for react-router-dom
Object.defineProperty(window, 'location', {
  value: {
    href: 'http://localhost/',
    origin: 'http://localhost',
    pathname: '/',
    assign: jest.fn(),
    replace: jest.fn(),
  },
  writable: true,
});
