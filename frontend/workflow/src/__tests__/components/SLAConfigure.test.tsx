import React from 'react';
import { render, screen, fireEvent, waitFor } from '@testing-library/react';
import SLAConfigure from '../../components/SLAConfigure';

jest.mock('../../hooks/useWorkflows', () => ({
  useWorkflows: () => ({
    workflows: [{ workflowId: 'w1', workflowName: 'WF 1', description: '', stages: [], createdAt: '', updatedAt: '' }],
    loading: false,
    error: null,
    refetch: jest.fn(),
  }),
}));

jest.mock('../../services/slaService', () => ({
  slaService: {
    getByWorkflowId: jest.fn().mockResolvedValue({ workflowId: 'w1', priorityLevels: { High: { responseTime: 120 } } }),
    create: jest.fn().mockResolvedValue({}),
    update: jest.fn().mockResolvedValue({}),
  },
}));

jest.mock('react-toastify', () => ({
  toast: { success: jest.fn(), error: jest.fn(), warn: jest.fn(), info: jest.fn() },
}));

jest.mock('react-icons/fi', () => {
  const React = require('react');
  return new Proxy(
    {},
    {
      get: () => (props: any) => React.createElement('span', props),
    }
  );
});

describe('SLAConfigure', () => {
  it('loads existing config when workflow selected', async () => {
    const onSuccess = jest.fn();
    const onCancel = jest.fn();
    render(<SLAConfigure onSuccess={onSuccess} onCancel={onCancel} />);

    fireEvent.change(screen.getByRole('combobox'), { target: { value: 'w1' } });
    fireEvent.click(screen.getByRole('button', { name: 'Next' }));

    await waitFor(() => {
      expect(screen.getByText(/Configure Priorities/i)).toBeInTheDocument();
    });
  });
});

