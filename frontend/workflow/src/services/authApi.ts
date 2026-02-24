import axios from 'axios';

const baseURL = process.env.REACT_APP_AUTH_API_URL || '';

const authApi = axios.create({
  baseURL,
  headers: {
    'Content-Type': 'application/json',
  },
});

authApi.interceptors.request.use(
  async (config) => {
    const token = localStorage.getItem('authToken');
    if (token) {
      config.headers.Authorization = `Bearer ${token}`;
    }
    return config;
  },
  (error) => Promise.reject(error)
);

authApi.interceptors.response.use(
  (response) => response,
  async (error) => {
    const originalRequest = error.config;
    if (error.response?.status === 401 && !originalRequest._retry) {
      originalRequest._retry = true;
      try {
        const { authService } = await import('./authService');
        const newToken = await authService.refreshAuthToken();
        if (newToken) {
          originalRequest.headers.Authorization = `Bearer ${newToken}`;
          return authApi(originalRequest);
        }
      } catch {
        localStorage.removeItem('authToken');
        localStorage.removeItem('authTokenExpiry');
        window.location.href = '/login';
      }
    }
    return Promise.reject(error);
  }
);

export default authApi;
