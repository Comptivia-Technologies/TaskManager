import axios from 'axios';

const slaApi = axios.create({
  baseURL: process.env.REACT_APP_API_URL || 'http://localhost:5004/api',
  headers: {
    'Content-Type': 'application/json',
  },
});

export default slaApi;

