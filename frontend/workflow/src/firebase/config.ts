import { initializeApp } from 'firebase/app';
import { getAuth } from 'firebase/auth';

const firebaseConfig = {
  apiKey: process.env.REACT_APP_FIREBASE_API_KEY,
  projectId: process.env.REACT_APP_FIREBASE_PROJECT_ID,
  authDomain: process.env.REACT_APP_FIREBASE_AUTH_DOMAIN,
};

// Initialize Firebase
const app = initializeApp(firebaseConfig);

// Initialize Auth (will be configured with tenant later)
export const auth = getAuth(app);

export default app;
