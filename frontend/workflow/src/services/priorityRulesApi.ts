import axios from 'axios';

const priorityRulesApi = axios.create({
  baseURL: 'http://localhost:5004/api',
  headers: {
    'Content-Type': 'application/json',
  },
});

export default priorityRulesApi;

