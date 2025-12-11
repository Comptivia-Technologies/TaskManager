import axios from 'axios';

// Separate API instance for SLA Configuration API (runs on port 5002)
const slaApi = axios.create({
  baseURL: 'http://localhost:5002/api',
  headers: {
    'Content-Type': 'application/json',
  },
});

export default slaApi;

