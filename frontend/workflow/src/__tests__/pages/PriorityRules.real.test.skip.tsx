import React from 'react';
import { render, screen, waitFor } from '@testing-library/react';
import PriorityRules from '../../pages/PriorityRules';

jest.mock('../../hooks/useWorkflows', () => ({
  useWorkflows: () => ({ workflows: [], loading: false, error: null, refetch: jest.fn() }),
}));

jest.mock('../../services/priorityRulesService', () => ({
  priorityRulesService: {
    getAll: jest.fn().mockResolvedValue([]),
    create: jest.fn(),
    update: jest.fn(),
    delete: jest.fn(),
  },
}));

jest.mock('../../components/ConditionBuilder', () => () => <div data-testid="condition-builder" />);

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

describe('PriorityRules (real)', () => {
  it('renders and loads rules', async () => {
    render(<PriorityRules />);
    expect(screen.getByText(/Priority Rules/i)).toBeInTheDocument();
    await waitFor(() => {
      expect(screen.getByTestId('condition-builder')).toBeInTheDocument();
    }, { timeout: 3000 });
  });
});

