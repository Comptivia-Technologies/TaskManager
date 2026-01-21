import axios from 'axios';

const priorityRulesApi = axios.create({
  baseURL: 'http://localhost:5010/api',
  headers: {
    'Content-Type': 'application/json',
  },
});

export default priorityRulesApi;

