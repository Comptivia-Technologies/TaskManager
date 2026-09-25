import api from './api';

export interface GmailMailbox {
  mailboxId: string;
  email: string;
  connectedAt: string;
}

export const gmailService = {
  authorizeUrl: async (email: string): Promise<string> => {
    const response = await api.get<{ url: string }>('/api/task-service/gmail/authorize', { params: { email } });
    return response.data.url;
  },

  list: async (): Promise<GmailMailbox[]> => {
    const response = await api.get<GmailMailbox[]>('/api/task-service/gmail/mailboxes');
    return Array.isArray(response.data) ? response.data : [];
  },

  connect: async (code: string): Promise<GmailMailbox> => {
    const response = await api.post<GmailMailbox>('/api/task-service/gmail/mailboxes', { code });
    return response.data;
  },

  disconnect: async (mailboxId: string): Promise<void> => {
    await api.delete(`/api/task-service/gmail/mailboxes/${mailboxId}`);
  },
};
