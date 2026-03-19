import React from 'react';
import { render, screen, fireEvent } from '@testing-library/react';
import WorkflowWizard from '../../components/WorkflowWizard';

jest.mock('../../contexts/AuthContext', () => ({
  useAuth: () => ({ organizationId: 'org-1', currentTenantId: null }),
}));

jest.mock('../../hooks/useTeams', () => ({
  useTeams: () => ({ teams: [{ teamId: 't1', teamName: 'Team 1' }], loading: false, error: null, refetch: jest.fn() }),
}));

jest.mock('../../hooks/useMembers', () => ({
  useMembers: () => ({ members: [], loading: false, error: null, refetch: jest.fn() }),
}));

jest.mock('../../services/userService', () => ({
  userService: { getActiveOrganizationUsers: jest.fn().mockResolvedValue([]) },
}));
jest.mock('../../services/teamService', () => ({
  teamService: { create: jest.fn().mockResolvedValue({ teamId: 't1', teamName: 'Team 1' }) },
}));
jest.mock('../../services/memberService', () => ({
  memberService: { getAll: jest.fn().mockResolvedValue([]), update: jest.fn().mockResolvedValue({}) },
}));
jest.mock('../../services/workflowService', () => ({
  workflowService: { create: jest.fn().mockResolvedValue({ workflowId: 'w1' }), updateJson: jest.fn().mockResolvedValue(undefined) },
}));
jest.mock('../../services/stageService', () => ({
  stageService: { create: jest.fn().mockResolvedValue({}) },
}));
jest.mock('../../services/priorityRulesService', () => ({
  priorityRulesService: { create: jest.fn().mockResolvedValue({}) },
}));

jest.mock('../..//components/SLAConfigure', () => () => <div data-testid="sla-configure" />);
jest.mock('../..//components/ConditionBuilder', () => () => <div data-testid="condition-builder" />);

jest.mock('react-select', () => (props: any) => <select data-testid="react-select" {...props} />);

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

describe('WorkflowWizard', () => {
  it('renders and can navigate steps', () => {
    const onSuccess = jest.fn();
    const onCancel = jest.fn();
    render(<WorkflowWizard onSuccess={onSuccess} onCancel={onCancel} />);

    expect(screen.getByText(/Workflow Setup Wizard/i)).toBeInTheDocument();
    fireEvent.click(screen.getByText('Next'));
    expect(screen.getByRole('heading', { name: 'Add Members' })).toBeInTheDocument();
  });
});

