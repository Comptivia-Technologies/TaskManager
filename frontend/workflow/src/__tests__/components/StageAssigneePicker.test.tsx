import React from 'react';
import { render, screen, waitFor } from '@testing-library/react';
import StageAssigneePicker, { AUTO_ASSIGN } from '../../components/StageAssigneePicker';

let mockMembers: any[] = [];
jest.mock('../../services/teamService', () => ({
  teamService: {
    getMembers: () => Promise.resolve(mockMembers),
  },
}));

const renderPicker = (props: Partial<React.ComponentProps<typeof StageAssigneePicker>> = {}) =>
  render(
    <StageAssigneePicker
      teamId="t1"
      teamName="Team Lead"
      stageName="Assign Team"
      value={AUTO_ASSIGN}
      onChange={jest.fn()}
      {...props}
    />
  );

describe('StageAssigneePicker', () => {
  beforeEach(() => {
    mockMembers = [
      { memberId: 'm1', firstName: 'Asha', lastName: 'Menon' },
      { memberId: 'm2', firstName: 'Ravi', lastName: 'Kumar' },
    ];
  });

  it('defaults to automatic assignment and lists the team', async () => {
    renderPicker();
    expect(await screen.findByRole('option', { name: /Auto/ })).toBeInTheDocument();
    expect(await screen.findByRole('option', { name: 'Asha Menon' })).toBeInTheDocument();
    expect(screen.getByRole('option', { name: 'Ravi Kumar' })).toBeInTheDocument();
  });

  // An empty team is what silently stranded enquiries before: the handover was
  // published, the reassignment threw, and the message was eventually dropped.
  it('blocks and names the team when it has no members', async () => {
    mockMembers = [];
    const onBlockedChange = jest.fn();
    renderPicker({ onBlockedChange });

    expect(await screen.findByText(/has no members/)).toBeInTheDocument();
    expect(screen.getByText('Team Lead')).toBeInTheDocument();
    expect(screen.queryByRole('combobox')).not.toBeInTheDocument();
    await waitFor(() => expect(onBlockedChange).toHaveBeenCalledWith(true));
  });

  it('reports not blocked when the team is staffed', async () => {
    const onBlockedChange = jest.fn();
    renderPicker({ onBlockedChange });
    await waitFor(() => expect(onBlockedChange).toHaveBeenCalledWith(false));
  });

  it('renders nothing without a team', () => {
    const { container } = renderPicker({ teamId: undefined });
    expect(container).toBeEmptyDOMElement();
  });
});
