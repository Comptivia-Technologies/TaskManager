import Button, { IconButton } from '../components/Button';
import PageHeader from '../components/PageHeader';
import Modal from '../components/Modal';
import Field from '../components/Field';
import ConfirmDialog from '../components/ConfirmDialog';
import DataTable from '../components/DataTable';
import EmptyState from '../components/EmptyState';
import SearchInput from '../components/SearchInput';
import Avatar from '../components/Avatar';
import Badge from '../components/Badge';
import SkillMeter from '../components/SkillMeter';
import { selectStyles, selectTheme } from '../utils/theme';
import { inputClass } from '../utils/formStyles';
import { useEffect, useState } from 'react';
import { useTeams } from '../hooks/useTeams';
import { useMembers } from '../hooks/useMembers';
import { useAuth } from '../contexts/AuthContext';
import { teamService } from '../services/teamService';
import { memberService } from '../services/memberService';
import { userService } from '../services/userService';
import { Team, TeamCreate, Member, MemberCreate, User, Workflow } from '../types';
import LoadingSpinner from '../components/LoadingSpinner';
import TeamMemberModal from '../components/TeamMemberModal';
import { FiEdit2, FiEye, FiGitMerge, FiPlus, FiTrash2, FiUsers } from 'react-icons/fi';
import { toast } from 'react-toastify';
import Select from 'react-select';
import { apiErrorMessage } from '../utils/apiError';

type TeamWithDetail = Team & { members?: Member[]; workflows?: Workflow[] };

/** Up to four faces, then a count — who is on a team at a glance. */
const AvatarStack = ({ people }: { people: Member[] }) => {
  if (people.length === 0) return <span className="text-meta text-ink-subtle">No members</span>;
  const shown = people.slice(0, 4);
  return (
    <span className="inline-flex items-center gap-2">
      <span className="flex -space-x-1.5">
        {shown.map((m) => (
          <Avatar key={m.memberId} name={`${m.firstName} ${m.lastName}`} size="sm" className="ring-2 ring-surface" />
        ))}
      </span>
      <span className="text-meta text-ink-muted tabular">{people.length}</span>
    </span>
  );
};

const Teams = () => {
  const { teams, loading, refetch } = useTeams();
  const { members: allMembers, refetch: refetchMembers } = useMembers();
  const { organizationId } = useAuth();
  const [productHubUsers, setProductHubUsers] = useState<User[]>([]);

  useEffect(() => {
    if (!organizationId) return;
    userService
      .getActiveOrganizationUsers(organizationId)
      .then(setProductHubUsers)
      .catch(() => setProductHubUsers([]));
  }, [organizationId]);
  const [isModalOpen, setIsModalOpen] = useState(false);
  const [isEditMode, setIsEditMode] = useState(false);
  const [selectedTeam, setSelectedTeam] = useState<TeamWithDetail | null>(null);
  const [isDetailView, setIsDetailView] = useState(false);
  const [formData, setFormData] = useState<TeamCreate>({
    teamName: '',
    description: '',
  });
  const [searchTerm, setSearchTerm] = useState('');
  const [selectedMemberIds, setSelectedMemberIds] = useState<string[]>([]);
  const [previousTeamMemberIds, setPreviousTeamMemberIds] = useState<string[]>([]);
  const [saving, setSaving] = useState(false);

  const [teamToDelete, setTeamToDelete] = useState<Team | null>(null);
  const [deletingTeam, setDeletingTeam] = useState(false);
  const [memberToDeleteFromTeam, setMemberToDeleteFromTeam] = useState<{ memberId: string; firstName: string; lastName: string } | null>(null);
  const [deletingMember, setDeletingMember] = useState(false);

  // Member management state
  const [isMemberModalOpen, setIsMemberModalOpen] = useState(false);
  const [isMemberEditMode, setIsMemberEditMode] = useState(false);
  const [selectedMember, setSelectedMember] = useState<Member | null>(null);
  const [memberFormData, setMemberFormData] = useState<MemberCreate>({
    firstName: '',
    lastName: '',
    email: '',
    teamId: undefined,
    role: '',
    skillLevel: 1,
  });

  const handleOpenModal = async (team?: Team) => {
    if (team) {
      setSelectedTeam(team);
      setIsEditMode(true);
      setFormData({
        teamName: team.teamName,
        description: team.description || '',
      });
      // Load current team members
      try {
        const teamMembers = await teamService.getMembers(team.teamId);
        const ids = teamMembers.map((m: Member) => m.memberId);
        setSelectedMemberIds(ids);
        setPreviousTeamMemberIds(ids);
      } catch (error) {
        console.error('Error loading team members:', error);
        setSelectedMemberIds([]);
        setPreviousTeamMemberIds([]);
      }
    } else {
      setIsEditMode(false);
      setFormData({ teamName: '', description: '' });
      setSelectedTeam(null);
      setSelectedMemberIds([]);
      setPreviousTeamMemberIds([]);
    }
    setIsModalOpen(true);
  };

  const handleCloseModal = () => {
    setIsModalOpen(false);
    setIsEditMode(false);
    if (!isDetailView) setSelectedTeam(null);
    setFormData({ teamName: '', description: '' });
    setSelectedMemberIds([]);
    setPreviousTeamMemberIds([]);
  };

  const refreshDetail = async (team: TeamWithDetail) => {
    const [members, workflows] = await Promise.all([
      teamService.getMembers(team.teamId),
      teamService.getWorkflows(team.teamId),
    ]);
    setSelectedTeam({ ...team, members, workflows });
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setSaving(true);
    try {
      let createdTeamId: string;

      if (isEditMode && selectedTeam) {
        await teamService.update(selectedTeam.teamId, formData);
        createdTeamId = selectedTeam.teamId;
      } else {
        const newTeam = await teamService.create(formData);
        createdTeamId = newTeam.teamId;
      }

      const freshMembers = await memberService.getAll();
      const selectedSet = new Set(selectedMemberIds);

      // In edit mode: unassign members who were on the team but are no longer selected
      if (isEditMode && previousTeamMemberIds.length > 0) {
        try {
          for (const memberId of previousTeamMemberIds) {
            if (selectedSet.has(memberId)) continue;
            const member = freshMembers.find(m => m.memberId === memberId);
            if (member) {
              await memberService.update(memberId, {
                firstName: member.firstName,
                lastName: member.lastName,
                email: member.email,
                role: member.role,
                skillLevel: member.skillLevel,
                teamId: undefined,
              });
            }
          }
        } catch (unassignError: any) {
          console.error('Error unassigning members:', unassignError);
          toast.warning('Team updated but failed to remove some members from the team');
        }
      }

      // Assign selected existing members to the team
      if (selectedMemberIds.length > 0) {
        try {
          for (const memberId of selectedMemberIds) {
            const member = freshMembers.find(m => m.memberId === memberId);
            if (member) {
              await memberService.update(memberId, {
                firstName: member.firstName,
                lastName: member.lastName,
                email: member.email,
                role: member.role,
                skillLevel: member.skillLevel,
                teamId: createdTeamId,
              });
            }
          }
          await refetchMembers();
          const action = isEditMode ? 'updated' : 'created';
          toast.success(`Team ${action} and ${selectedMemberIds.length} member(s) assigned successfully!`);
        } catch (assignError: any) {
          console.error('Error assigning members:', assignError);
          const action = isEditMode ? 'updated' : 'created';
          toast.warning(`Team ${action} but failed to assign some members`);
        }
      } else {
        const action = isEditMode ? 'updated' : 'created';
        toast.success(`Team ${action} successfully!`);
      }

      if (isDetailView && selectedTeam) {
        await refreshDetail({ ...selectedTeam, teamName: formData.teamName, description: formData.description });
      }
      handleCloseModal();
      refetch();
    } catch (error: any) {
      toast.error(apiErrorMessage(error, 'Failed to save team'));
    } finally {
      setSaving(false);
    }
  };

  const handleDeleteTeam = async (team: Team) => {
    setDeletingTeam(true);
    try {
      await teamService.delete(team.teamId);
      toast.success('Team deleted successfully');
      setTeamToDelete(null);
      refetch();
    } catch (error: any) {
      const errorMessage = apiErrorMessage(error, 'Failed to delete team');
      toast.error(errorMessage, { autoClose: 5000 });
    } finally {
      setDeletingTeam(false);
    }
  };

  const handleViewDetails = async (team: Team) => {
    try {
      await refreshDetail(team);
      setIsDetailView(true);
    } catch (error: any) {
      toast.error('Failed to load team details');
    }
  };

  const handleOpenMemberModal = (member?: Member) => {
    if (member && selectedTeam) {
      setSelectedMember(member);
      setIsMemberEditMode(true);
      setMemberFormData({
        firstName: member.firstName,
        lastName: member.lastName,
        email: member.email,
        userId: member.userId,
        teamId: member.teamId,
        role: member.role,
        skillLevel: member.skillLevel,
      });
    } else if (selectedTeam) {
      setIsMemberEditMode(false);
      setMemberFormData({
        firstName: '',
        lastName: '',
        email: '',
        userId: undefined,
        teamId: selectedTeam.teamId,
        role: '',
        skillLevel: 1,
      });
      setSelectedMember(null);
    }
    setIsMemberModalOpen(true);
  };

  const handleCloseMemberModal = () => {
    setIsMemberModalOpen(false);
    setIsMemberEditMode(false);
    setSelectedMember(null);
    setMemberFormData({
      firstName: '',
      lastName: '',
      email: '',
      userId: undefined,
      teamId: undefined,
      role: '',
      skillLevel: 1,
    });
  };

  // A member belongs to exactly one team, so only people who are free — plus
  // whoever is already on this team, so they can still be removed — are offered.
  const assignableMembers = allMembers.filter(
    (m) => !m.teamId || (selectedTeam && m.teamId === selectedTeam.teamId)
  );

  // Team membership is a field on the member, so adding an existing person to a
  // team is an update rather than a new record. userId is passed through so the
  // login link survives the move.
  const handleAddExistingMember = async (memberId: string) => {
    if (!selectedTeam) return;
    const member = allMembers.find((m) => m.memberId === memberId);
    if (!member) return;

    try {
      await memberService.update(memberId, {
        firstName: member.firstName,
        lastName: member.lastName,
        email: member.email,
        userId: member.userId,
        teamId: selectedTeam.teamId,
        role: member.role,
        skillLevel: member.skillLevel,
      });
      toast.success(`${member.firstName} added to ${selectedTeam.teamName}`);
      handleCloseMemberModal();
      await refreshDetail(selectedTeam);
      await refetchMembers();
    } catch (error: any) {
      toast.error(apiErrorMessage(error, 'Failed to add member to team'));
    }
  };

  const handleMemberSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!selectedTeam) return;

    try {
      if (isMemberEditMode && selectedMember) {
        await memberService.update(selectedMember.memberId, memberFormData);
        toast.success('Member updated successfully');
      } else {
        await memberService.create(memberFormData);
        toast.success('Member added successfully');
      }
      handleCloseMemberModal();
      await refreshDetail(selectedTeam);
    } catch (error: any) {
      toast.error(apiErrorMessage(error, 'Failed to save member'));
    }
  };

  const handleDeleteMemberFromTeam = async (memberId: string) => {
    if (!selectedTeam) return;
    setDeletingMember(true);
    try {
      await memberService.delete(memberId);
      toast.success('Member deleted successfully');
      setMemberToDeleteFromTeam(null);
      await refreshDetail(selectedTeam);
    } catch (error: any) {
      toast.error(apiErrorMessage(error, 'Failed to delete member'));
    } finally {
      setDeletingMember(false);
    }
  };

  const filteredTeams = teams.filter(
    (team) =>
      team.teamName.toLowerCase().includes(searchTerm.toLowerCase()) ||
      team.description?.toLowerCase().includes(searchTerm.toLowerCase())
  );

  const membersOf = (teamId: string) => allMembers.filter((m) => m.teamId === teamId);

  const memberOption = (member: Member) => ({
    value: member.memberId,
    label: `${member.firstName} ${member.lastName}${member.teamName ? ` - Current Team: ${member.teamName}` : ''}`,
  });

  const teamModal = (
    <Modal
      isOpen={isModalOpen}
      title={isEditMode ? 'Edit Team' : 'Create Team'}
      icon={<FiUsers />}
      onClose={handleCloseModal}
      footer={
        <>
          <Button variant="secondary" onClick={handleCloseModal} disabled={saving}>
            Cancel
          </Button>
          <Button variant="primary" type="submit" form="team-form" loading={saving}>
            {isEditMode ? 'Update' : 'Create'}
          </Button>
        </>
      }
    >
      <form id="team-form" onSubmit={handleSubmit} className="space-y-4">
        <Field htmlFor="team-name" label="Team name" required>
          <input
            id="team-name"
            type="text"
            value={formData.teamName}
            onChange={(e) => setFormData({ ...formData, teamName: e.target.value })}
            className={inputClass}
            required
          />
        </Field>
        <Field htmlFor="team-description" label="Description" hint="Optional">
          <textarea
            id="team-description"
            value={formData.description}
            onChange={(e) => setFormData({ ...formData, description: e.target.value })}
            className={inputClass}
            rows={3}
          />
        </Field>
        {assignableMembers.length > 0 && (
          <Field label="Members" hint="Optional" help="Only people without a team, or already on this one, can be chosen.">
            <Select
              isMulti
              options={assignableMembers.map(memberOption)}
              value={assignableMembers.filter((member) => selectedMemberIds.includes(member.memberId)).map(memberOption)}
              onChange={(selectedOptions: any) => {
                const ids = selectedOptions ? selectedOptions.map((option: any) => option.value) : [];
                setSelectedMemberIds(ids);
              }}
              className="text-body"
              placeholder="Select members to add to this team…"
              styles={selectStyles}
              theme={selectTheme}
            />
          </Field>
        )}
      </form>
    </Modal>
  );

  if (loading) {
    return <LoadingSpinner label="Loading teams" />;
  }

  if (isDetailView && selectedTeam) {
    const members = selectedTeam.members ?? [];
    const workflows = selectedTeam.workflows ?? [];
    const back = () => {
      setIsDetailView(false);
      setSelectedTeam(null);
    };
    return (
      <div>
        <PageHeader
          breadcrumbs={[{ label: 'Teams', onClick: back }]}
          title={selectedTeam.teamName}
          subtitle={selectedTeam.description}
          meta={
            <>
              <span className="inline-flex items-center gap-1.5"><FiUsers aria-hidden="true" />{members.length} member{members.length === 1 ? '' : 's'}</span>
              <span className="inline-flex items-center gap-1.5"><FiGitMerge aria-hidden="true" />{workflows.length} workflow{workflows.length === 1 ? '' : 's'}</span>
            </>
          }
          actions={
            <>
              <Button icon={<FiEdit2 />} onClick={() => handleOpenModal(selectedTeam)}>
                Edit team
              </Button>
              <Button variant="primary" icon={<FiPlus />} onClick={() => handleOpenMemberModal()}>
                Add Member
              </Button>
            </>
          }
        />

        <div className="grid grid-cols-1 xl:grid-cols-[minmax(0,2fr)_minmax(0,1fr)] gap-6 items-start">
          <section className="card overflow-hidden">
            <header className="flex flex-wrap items-center justify-between gap-2 px-5 py-3.5 border-b border-line-subtle">
              <h2 className="text-title font-semibold text-ink">Members</h2>
              <span className="text-meta text-ink-subtle">Work at this team's stages is assigned among these people.</span>
            </header>
            {members.length > 0 ? (
              <ul className="divide-y divide-line-subtle">
                {members.map((member) => (
                  <li key={member.memberId} className="flex items-center gap-3 px-5 py-3">
                    <Avatar name={`${member.firstName} ${member.lastName}`} size="md" />
                    <div className="min-w-0 flex-1">
                      <p className="text-body font-medium text-ink truncate">
                        {member.firstName} {member.lastName}
                      </p>
                      <p className="text-meta text-ink-subtle truncate">
                        {member.role} · {member.email}
                      </p>
                    </div>
                    <div className="hidden md:block">
                      <SkillMeter level={member.skillLevel} />
                    </div>
                    {!member.userId && <Badge tone="warning">No login</Badge>}
                    <div className="flex items-center gap-1">
                      <IconButton size="sm" label={`Edit ${member.firstName}`} icon={<FiEdit2 />} onClick={() => handleOpenMemberModal(member)} />
                      <IconButton
                        size="sm"
                        tone="danger"
                        label={`Delete ${member.firstName}`}
                        icon={<FiTrash2 />}
                        onClick={() => setMemberToDeleteFromTeam({ memberId: member.memberId, firstName: member.firstName, lastName: member.lastName })}
                      />
                    </div>
                  </li>
                ))}
              </ul>
            ) : (
              <EmptyState
                compact
                icon={<FiUsers />}
                title="No members assigned"
                body="Stages owned by this team have nobody to receive work until someone is added."
                action={<Button size="sm" variant="primary" icon={<FiPlus />} onClick={() => handleOpenMemberModal()}>Add Member</Button>}
              />
            )}
          </section>

          <section className="card overflow-hidden">
            <header className="px-5 py-3.5 border-b border-line-subtle">
              <h2 className="text-title font-semibold text-ink">Workflows</h2>
            </header>
            {workflows.length > 0 ? (
              <ul className="divide-y divide-line-subtle">
                {workflows.map((workflow) => (
                  <li key={workflow.workflowId} className="flex items-center gap-3 px-5 py-3">
                    <span aria-hidden="true" className="h-8 w-8 rounded-control bg-primary-subtle text-primary flex items-center justify-center shrink-0">
                      <FiGitMerge />
                    </span>
                    <span className="text-body font-medium text-ink">{workflow.workflowName}</span>
                  </li>
                ))}
              </ul>
            ) : (
              <p className="px-5 py-4 text-body text-ink-subtle">No workflows assigned</p>
            )}
          </section>
        </div>

        {teamModal}

        <ConfirmDialog
          isOpen={Boolean(memberToDeleteFromTeam)}
          title="Delete member"
          body={
            <>
              Delete <span className="font-medium text-ink">{memberToDeleteFromTeam?.firstName} {memberToDeleteFromTeam?.lastName}</span>?
              This removes the member record, not just their place on the team.
            </>
          }
          confirmLabel="Delete member"
          busy={deletingMember}
          onCancel={() => setMemberToDeleteFromTeam(null)}
          onConfirm={() => memberToDeleteFromTeam && handleDeleteMemberFromTeam(memberToDeleteFromTeam.memberId)}
        />

        <TeamMemberModal
          isOpen={isMemberModalOpen}
          isEditMode={isMemberEditMode}
          formData={memberFormData}
          teams={teams}
          productHubUsers={productHubUsers}
          linkedUserIds={allMembers.map((m) => m.userId).filter((id): id is string => Boolean(id))}
          availableMembers={allMembers.filter((m) => !m.teamId)}
          onChange={setMemberFormData}
          onSubmit={handleMemberSubmit}
          onAddExisting={handleAddExistingMember}
          onClose={handleCloseMemberModal}
        />
      </div>
    );
  }

  return (
    <div>
      <PageHeader
        title="Teams"
        subtitle="Each workflow stage is owned by a team. Work reaches people through them."
        actions={
          <Button variant="primary" icon={<FiPlus />} onClick={() => handleOpenModal()}>
            Create Team
          </Button>
        }
      />

      <DataTable<Team>
        caption="All teams, with their members and workflows"
        rows={filteredTeams}
        rowKey={(t) => t.teamId}
        onRowClick={handleViewDetails}
        toolbar={
          <>
            <SearchInput label="Search teams" placeholder="Search teams…" value={searchTerm} onChange={setSearchTerm} className="w-full sm:w-72" />
            <span className="sm:ml-auto text-meta text-ink-subtle tabular">
              {filteredTeams.length} of {teams.length} teams
            </span>
          </>
        }
        empty={
          <EmptyState
            icon={<FiUsers />}
            title={teams.length === 0 ? 'No teams yet' : 'No teams found'}
            body={teams.length === 0 ? 'Create a team, then give it stages to own and people to do the work.' : 'No team matches that search.'}
            action={
              teams.length === 0 ? (
                <Button variant="primary" icon={<FiPlus />} onClick={() => handleOpenModal()}>
                  Create Team
                </Button>
              ) : undefined
            }
          />
        }
        columns={[
          {
            key: 'name',
            header: 'Team',
            sortValue: (t) => t.teamName.toLowerCase(),
            render: (t) => (
              <div className="min-w-0 max-w-md">
                <p className="font-semibold text-ink truncate">{t.teamName}</p>
                <p className="text-meta text-ink-subtle truncate">{t.description || 'No description'}</p>
              </div>
            ),
          },
          {
            key: 'members',
            header: 'Members',
            sortValue: (t) => membersOf(t.teamId).length,
            render: (t) => <AvatarStack people={membersOf(t.teamId)} />,
          },
          {
            key: 'workflows',
            header: 'Workflows',
            hideOnMobile: true,
            render: (t) =>
              t.workflowNames && t.workflowNames.length > 0 ? (
                <div className="flex flex-wrap gap-1">
                  {t.workflowNames.map((workflowName, index) => (
                    <Badge key={index} tone="primary">{workflowName}</Badge>
                  ))}
                </div>
              ) : (
                <span className="text-meta text-ink-subtle">No workflows</span>
              ),
          },
          {
            key: 'actions',
            header: 'Actions',
            align: 'right',
            width: '132px',
            render: (t) => (
              <div className="flex justify-end gap-1" onClick={(e) => e.stopPropagation()}>
                <IconButton size="sm" label="View Details" icon={<FiEye />} onClick={() => handleViewDetails(t)} />
                <IconButton size="sm" label={`Edit ${t.teamName}`} icon={<FiEdit2 />} onClick={() => handleOpenModal(t)} />
                <IconButton size="sm" tone="danger" label={`Delete ${t.teamName}`} icon={<FiTrash2 />} onClick={() => setTeamToDelete(t)} />
              </div>
            ),
          },
        ]}
      />

      {teamModal}

      <ConfirmDialog
        isOpen={Boolean(teamToDelete)}
        title="Delete team"
        body={
          <>
            Delete <span className="font-medium text-ink">“{teamToDelete?.teamName}”</span>? You cannot delete a team that has
            members, workflows, or stages assigned to it.
          </>
        }
        confirmLabel="Delete team"
        busy={deletingTeam}
        onCancel={() => setTeamToDelete(null)}
        onConfirm={() => teamToDelete && handleDeleteTeam(teamToDelete)}
      />
    </div>
  );
};

export default Teams;
