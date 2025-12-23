import axios from 'axios';

// Separate API instance for Task Manager API (runs on port 5004)
const taskManagerApi = axios.create({
  baseURL: 'http://localhost:5004/api',
  headers: {
    'Content-Type': 'application/json',
  },
});

export default taskManagerApi;


