import React from 'react';
import { fireEvent, render, screen, waitFor } from '@testing-library/react';
import { MemoryRouter } from 'react-router-dom';
import Teams from '../../pages/Teams';

const mockTeam = {
  teamId: 't1',
  teamName: 'Administration',
  description: 'Enquiry recipient / administrator',
  createdAt: '',
  updatedAt: '',
};

jest.mock('../../hooks/useTeams', () => ({
  useTeams: () => ({ teams: [mockTeam], loading: false, error: null, refetch: jest.fn() }),
}));

const mockUnassignedMember = {
  memberId: 'm1',
  userId: 'u9',
  firstName: 'Asha',
  lastName: 'Menon',
  email: 'asha@example.com',
  teamId: undefined,
  teamName: '',
  role: 'Administrator',
  skillLevel: 3,
  createdAt: '',
  updatedAt: '',
};

jest.mock('../../hooks/useMembers', () => ({
  useMembers: () => ({ members: [mockUnassignedMember, mockTakenMember], loading: false, error: null, refetch: jest.fn() }),
}));

const mockTakenMember = {
  memberId: 'm2',
  userId: 'u8',
  firstName: 'Ravi',
  lastName: 'Kumar',
  email: 'ravi@example.com',
  teamId: 't-other',
  teamName: 'Procurement',
  role: 'Buyer',
  skillLevel: 3,
  createdAt: '',
  updatedAt: '',
};

const mockUpdateMember = jest.fn().mockResolvedValue({});
jest.mock('../../services/memberService', () => ({
  memberService: {
    update: (...args: unknown[]) => mockUpdateMember(...args),
    create: () => Promise.resolve({}),
    delete: () => Promise.resolve(),
  },
}));

jest.mock('../../contexts/AuthContext', () => ({
  useAuth: () => ({ organizationId: 'org-1' }),
}));

jest.mock('../../services/userService', () => ({
  userService: {
    getActiveOrganizationUsers: () =>
      Promise.resolve([
        { userId: 'u1', fullName: 'Asha Menon', email: 'asha@example.com', organisationId: 'org-1', role: 'Admin', status: 'Active', createdAt: '', updatedAt: '' },
      ]),
  },
}));

jest.mock('../../services/teamService', () => ({
  teamService: {
    getMembers: () => Promise.resolve([]),
    getWorkflows: () => Promise.resolve([]),
    create: () => Promise.resolve({}),
    update: () => Promise.resolve({}),
    delete: () => Promise.resolve(),
  },
}));

jest.mock('react-toastify', () => ({
  toast: { error: jest.fn(), success: jest.fn() },
}));

const renderTeams = () =>
  render(
    <MemoryRouter>
      <Teams />
    </MemoryRouter>
  );

describe('Teams', () => {
  it('renders without crashing', async () => {
    renderTeams();
    await waitFor(() => expect(screen.getByText('Teams')).toBeInTheDocument(), { timeout: 3000 });
  });

  // The Add Member modal used to live in the list-view branch while its only
  // triggers were in the detail-view branch, so the button silently did nothing.
  const openAddMemberModal = async () => {
    fireEvent.click(await screen.findByTitle('View Details'));
    await screen.findByText('Enquiry recipient / administrator');
    const trigger = (await screen.findAllByText(/add member/i))[0].closest('button');
    fireEvent.click(trigger!);
  };

  it('opens the Add Member modal from the team detail view', async () => {
    renderTeams();
    await openAddMemberModal();

    // Defaults to attaching someone who already exists.
    expect(await screen.findByLabelText(/^Member/)).toBeInTheDocument();
    expect(screen.getByRole('option', { name: /Asha Menon — no team/ })).toBeInTheDocument();
  });

  it('does not offer a member who already belongs to another team', async () => {
    renderTeams();
    await openAddMemberModal();

    await screen.findByRole('option', { name: /Asha Menon — no team/ });
    expect(screen.queryByRole('option', { name: /Ravi Kumar/ })).not.toBeInTheDocument();
  });

  it('moves an existing member onto the team', async () => {
    renderTeams();
    await openAddMemberModal();

    fireEvent.change(await screen.findByLabelText(/^Member/), { target: { value: 'm1' } });
    fireEvent.click(screen.getByRole('button', { name: /add to team/i }));

    await waitFor(() => expect(mockUpdateMember).toHaveBeenCalled());
    const [memberId, payload] = mockUpdateMember.mock.calls[0] as [string, any];
    expect(memberId).toBe('m1');
    expect(payload.teamId).toBe('t1');
    // The login link must survive the move or the member stops seeing their work.
    expect(payload.userId).toBe('u9');
  });

  it('requires a Product Hub login when creating a new member', async () => {
    renderTeams();
    await openAddMemberModal();

    fireEvent.click(await screen.findByRole('button', { name: /new member/i }));

    const loginSelect = await screen.findByLabelText(/Login/);
    expect(loginSelect).toBeRequired();
    expect(screen.getByLabelText(/First Name/)).toBeInTheDocument();
  });
});
