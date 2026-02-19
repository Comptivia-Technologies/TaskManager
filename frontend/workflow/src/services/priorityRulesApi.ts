import axios from 'axios';

if (!process.env.REACT_APP_API_URL) {
  throw new Error('REACT_APP_API_URL environment variable is required');
}

const priorityRulesApi = axios.create({
  baseURL: process.env.REACT_APP_API_URL,
  headers: {
    'Content-Type': 'application/json',
  },
});

// Add API key interceptor
priorityRulesApi.interceptors.request.use(
  (config) => {
    const apiKey = process.env.REACT_APP_API_KEY;
    if (apiKey) {
      config.headers['X-API-Key'] = apiKey;
    }
    return config;
  },
  (error) => {
    return Promise.reject(error);
  }
);

export default priorityRulesApi;

