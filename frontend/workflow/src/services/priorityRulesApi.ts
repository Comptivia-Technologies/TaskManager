import axios from 'axios';

const priorityRulesApi = axios.create({
  baseURL: process.env.REACT_APP_API_URL || 'http://localhost:5004/api',
  headers: {
    'Content-Type': 'application/json',
  },
});

export default priorityRulesApi;

