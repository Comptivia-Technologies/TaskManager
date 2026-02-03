import axios from 'axios';

const slaApi = axios.create({
  baseURL: 'http://localhost:5004/api',
  headers: {
    'Content-Type': 'application/json',
  },
});

export default slaApi;

