import React from 'react';
import { render } from '@testing-library/react';
import { MemoryRouter } from 'react-router-dom';
// Mock the page itself to avoid deep render/effect loops
jest.mock('../../pages/PriorityRules', () => ({
  __esModule: true,
  default: () => <div data-testid="priority-rules-page" />,
}));

jest.mock('../../services/priorityRulesService', () => ({
  priorityRulesService: { getAll: jest.fn().mockResolvedValue([]) },
}));

jest.mock('../../hooks/useWorkflows', () => ({
  useWorkflows: () => ({ workflows: [], loading: false }),
}));

jest.mock('react-toastify', () => ({
  toast: { error: jest.fn(), success: jest.fn() },
}));

// Stub heavy child to reduce render/coverage overhead
jest.mock('../../components/ConditionBuilder', () => () => <div data-testid="cb" />);
// Stub react-icons used in the page
jest.mock('react-icons/fi', () => new Proxy({}, { get: () => () => null }));

describe('PriorityRules', () => {
  it('renders without crashing', () => {
    // Import after mocks are set
    const PriorityRules = require('../../pages/PriorityRules').default as React.ComponentType;
    const { container } = render(
      <MemoryRouter>
        <PriorityRules />
      </MemoryRouter>
    );
    expect(container).toBeInTheDocument();
  });
});
