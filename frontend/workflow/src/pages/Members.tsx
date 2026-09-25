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
import SkillMeter, { SKILL_LABELS } from '../components/SkillMeter';
import { inputClass, readOnlyInputClass } from '../utils/formStyles';
import { useState, useEffect, useCallback } from 'react';
import { useNavigate } from 'react-router-dom';
import { useAuth } from '../contexts/AuthContext';
import { useMembers } from '../hooks/useMembers';
import { useTeams } from '../hooks/useTeams';
import { memberService } from '../services/memberService';
import { userService } from '../services/userService';
import { Member, User } from '../types';
import LoadingSpinner from '../components/LoadingSpinner';
import { FiAlertTriangle, FiCheckCircle, FiEdit2, FiEye, FiPlus, FiTrash2, FiUser } from 'react-icons/fi';
import { toast } from 'react-toastify';
import { apiErrorMessage } from '../utils/apiError';

function splitFullName(fullName: string): { firstName: string; lastName: string } {
  const parts = fullName.trim().split(/\s+/);
  return {
    firstName: parts[0] ?? '',
    lastName: parts.slice(1).join(' ') ?? '',
  };
}

const Members = () => {
  const { organizationId } = useAuth();
  const { members, loading, refetch } = useMembers();
  const { teams } = useTeams();
  const navigate = useNavigate();
  const [productHubUsers, setProductHubUsers] = useState<User[]>([]);
  const [selectedProductHubUser, setSelectedProductHubUser] = useState<User | null>(null);
  const [isModalOpen, setIsModalOpen] = useState(false);
  const [isEditMode, setIsEditMode] = useState(false);
  const [selectedMember, setSelectedMember] = useState<Member | null>(null);
  const [formData, setFormData] = useState({
    firstName: '',
    lastName: '',
    email: '',
    role: '',
    skillLevel: 1,
  });
  const [searchTerm, setSearchTerm] = useState('');
  const [selectedTeamFilter, setSelectedTeamFilter] = useState<string | 'all'>('all');
  const [memberToDelete, setMemberToDelete] = useState<Member | null>(null);
  const [deleting, setDeleting] = useState(false);
  const [saving, setSaving] = useState(false);

  const loadProductHubUsers = useCallback(async () => {
    if (!organizationId) return;
    try {
      const users = await userService.getActiveOrganizationUsers(organizationId);
      setProductHubUsers(users.filter((u) => u.status === 'Active'));
    } catch {
      setProductHubUsers([]);
    }
  }, [organizationId]);

  useEffect(() => {
    loadProductHubUsers();
  }, [loadProductHubUsers]);

  const handleOpenModal = (member?: Member) => {
    if (member) {
      setSelectedMember(member);
      setIsEditMode(true);
      setFormData({
        firstName: member.firstName,
        lastName: member.lastName,
        email: member.email,
        role: member.role,
        skillLevel: member.skillLevel,
      });
      setSelectedProductHubUser(null);
    } else {
      setIsEditMode(false);
      setFormData({ firstName: '', lastName: '', email: '', role: '', skillLevel: 1 });
      setSelectedMember(null);
      setSelectedProductHubUser(null);
    }
    setIsModalOpen(true);
  };

  const handleCloseModal = () => {
    setIsModalOpen(false);
    setIsEditMode(false);
    setSelectedMember(null);
    setSelectedProductHubUser(null);
    setFormData({ firstName: '', lastName: '', email: '', role: '', skillLevel: 1 });
  };

  const handleProductHubUserSelect = (email: string) => {
    const user = productHubUsers.find((u) => u.email === email);
    if (!user) return;
    setSelectedProductHubUser(user);
    const { firstName, lastName } = splitFullName(user.fullName);
    setFormData((prev) => ({
      ...prev,
      email: user.email,
      firstName: firstName || prev.firstName,
      lastName: lastName || prev.lastName,
      role: user.role || prev.role,
    }));
  };

  // Linking an existing member leaves their stored name and email alone; only
  // the login association changes.
  const handleLinkLogin = (email: string) => {
    const user = productHubUsers.find((u) => u.email === email) ?? null;
    setSelectedProductHubUser(user);
    // The role follows the login, so linking one refreshes a stale job title.
    if (user?.role) setFormData((prev) => ({ ...prev, role: user.role }));
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setSaving(true);
    try {
      if (isEditMode && selectedMember) {
        await memberService.update(selectedMember.memberId, {
          ...formData,
          teamId: selectedMember.teamId, // Team changes happen on the Teams page
          userId: selectedProductHubUser?.userId,
        });
        toast.success('Member updated successfully');
      } else {
        await memberService.create({
          firstName: formData.firstName,
          lastName: formData.lastName,
          email: formData.email,
          role: formData.role,
          skillLevel: formData.skillLevel,
          userId: selectedProductHubUser?.userId,
        });
        toast.success('Member created successfully');
      }
      handleCloseModal();
      refetch();
    } catch (error: any) {
      const errorMessage = apiErrorMessage(error, `Failed to ${isEditMode ? 'update' : 'create'} member`);
      toast.error(errorMessage);
      console.error('Member creation error:', error);
    } finally {
      setSaving(false);
    }
  };

  const handleDeleteMember = async (member: Member) => {
    setDeleting(true);
    try {
      await memberService.delete(member.memberId);
      toast.success('Member deleted successfully');
      setMemberToDelete(null);
      refetch();
    } catch (error: any) {
      toast.error(apiErrorMessage(error, 'Failed to delete member'));
    } finally {
      setDeleting(false);
    }
  };

  const term = searchTerm.toLowerCase();
  const filteredMembers = members.filter((member) => {
    const matchesSearch =
      member.firstName.toLowerCase().includes(term) ||
      member.lastName.toLowerCase().includes(term) ||
      member.email.toLowerCase().includes(term) ||
      (member.teamName && member.teamName.toLowerCase().includes(term));
    const matchesTeam = selectedTeamFilter === 'all' || (member.teamId && member.teamId === selectedTeamFilter);
    return matchesSearch && matchesTeam;
  });

  const unlinked = members.filter((m) => !m.userId).length;

  if (loading) {
    return <LoadingSpinner label="Loading members" />;
  }

  return (
    <div>
      <PageHeader
        title="Members"
        subtitle="People who can be assigned stage work. Each belongs to exactly one team."
        meta={
          <>
            <span>{members.length} members</span>
            {unlinked > 0 && (
              <span className="inline-flex items-center gap-1.5 text-warning font-medium">
                <FiAlertTriangle aria-hidden="true" />
                {unlinked} without a login — they cannot see their work
              </span>
            )}
          </>
        }
        actions={
          <Button variant="primary" icon={<FiPlus />} onClick={() => handleOpenModal()}>
            Create Member
          </Button>
        }
      />

      <DataTable<Member>
        caption="Members"
        rows={filteredMembers}
        rowKey={(m) => m.memberId}
        onRowClick={(m) => navigate(`/members/${m.memberId}`)}
        toolbar={
          <>
            <SearchInput label="Search members" placeholder="Search by name, email or team" value={searchTerm} onChange={setSearchTerm} className="w-full sm:w-72" />
            <label htmlFor="member-team-filter" className="sr-only">Filter by team</label>
            <select
              id="member-team-filter"
              value={selectedTeamFilter}
              onChange={(e) => setSelectedTeamFilter(e.target.value === 'all' ? 'all' : e.target.value)}
              className={`${inputClass} !min-h-[36px] h-9 !py-1 w-full sm:w-52`}
            >
              <option value="all">All teams</option>
              {teams.map((team) => (
                <option key={team.teamId} value={team.teamId}>
                  {team.teamName}
                </option>
              ))}
            </select>
            <span className="sm:ml-auto text-meta text-ink-subtle tabular">
              {filteredMembers.length} of {members.length}
            </span>
          </>
        }
        empty={
          <EmptyState
            icon={<FiUser />}
            title={members.length === 0 ? 'No members yet' : 'No members found'}
            body={members.length === 0 ? 'Create a member for each person who will work on stages.' : 'Nobody matches that search or team.'}
          />
        }
        mobileCard={(m) => (
          <div className="flex items-center gap-3">
            <Avatar name={`${m.firstName} ${m.lastName}`} size="md" />
            <div className="min-w-0">
              <p className="font-semibold text-ink truncate">{m.firstName} {m.lastName}</p>
              <p className="text-meta text-ink-subtle truncate">{m.teamName || 'Unassigned'} · {m.role}</p>
            </div>
          </div>
        )}
        columns={[
          {
            key: 'name',
            header: 'Member',
            sortValue: (m) => `${m.firstName} ${m.lastName}`.toLowerCase(),
            render: (m) => (
              <div className="flex items-center gap-3 min-w-0">
                <Avatar name={`${m.firstName} ${m.lastName}`} size="md" />
                <div className="min-w-0">
                  <p className="font-semibold text-ink truncate">{m.firstName} {m.lastName}</p>
                  <p className="text-meta text-ink-subtle truncate">{m.email}</p>
                </div>
              </div>
            ),
          },
          {
            key: 'team',
            header: 'Team',
            sortValue: (m) => m.teamName ?? '',
            render: (m) => (m.teamName ? <span className="text-ink">{m.teamName}</span> : <span className="text-ink-subtle">Unassigned</span>),
          },
          {
            key: 'role',
            header: 'Role',
            hideOnMobile: true,
            sortValue: (m) => m.role ?? '',
            render: (m) => <span className="text-ink-muted">{m.role || '—'}</span>,
          },
          {
            key: 'skill',
            header: 'Skill',
            hideOnMobile: true,
            sortValue: (m) => m.skillLevel,
            render: (m) => <SkillMeter level={m.skillLevel} showLabel={false} />,
          },
          {
            key: 'login',
            header: 'Login',
            hideOnMobile: true,
            sortValue: (m) => (m.userId ? 1 : 0),
            render: (m) =>
              m.userId ? (
                <Badge tone="success" icon={<FiCheckCircle />}>Linked</Badge>
              ) : (
                <Badge tone="warning" icon={<FiAlertTriangle />}>Not linked</Badge>
              ),
          },
          {
            key: 'actions',
            header: 'Actions',
            align: 'right',
            width: '132px',
            render: (m) => (
              <div className="flex justify-end gap-1" onClick={(e) => e.stopPropagation()}>
                <IconButton size="sm" label="View Details" icon={<FiEye />} onClick={() => navigate(`/members/${m.memberId}`)} />
                <IconButton size="sm" label={`Edit ${m.firstName}`} icon={<FiEdit2 />} onClick={() => handleOpenModal(m)} />
                <IconButton size="sm" tone="danger" label={`Delete ${m.firstName}`} icon={<FiTrash2 />} onClick={() => setMemberToDelete(m)} />
              </div>
            ),
          },
        ]}
      />

      <Modal
        isOpen={isModalOpen}
        title={isEditMode ? 'Edit Member' : 'Create Member'}
        icon={<FiUser />}
        onClose={handleCloseModal}
        footer={
          <>
            <Button variant="secondary" onClick={handleCloseModal} disabled={saving}>
              Cancel
            </Button>
            <Button variant="primary" type="submit" form="member-form" loading={saving}>
              {isEditMode ? 'Update' : 'Create'}
            </Button>
          </>
        }
      >
        <form id="member-form" onSubmit={handleSubmit} className="space-y-4">
          {isEditMode ? (
            <>
              <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                <Field htmlFor="member-first" label="First Name" required>
                  <input id="member-first" type="text" value={formData.firstName} onChange={(e) => setFormData({ ...formData, firstName: e.target.value })} className={inputClass} required />
                </Field>
                <Field htmlFor="member-last" label="Last Name" required>
                  <input id="member-last" type="text" value={formData.lastName} onChange={(e) => setFormData({ ...formData, lastName: e.target.value })} className={inputClass} required />
                </Field>
              </div>
              <Field htmlFor="member-email" label="Email">
                <input id="member-email" type="email" value={formData.email} readOnly className={readOnlyInputClass} />
              </Field>
              <Field htmlFor="member-login" label="Linked Login" hint="(required to see assigned work)">
                {selectedMember?.userId ? (
                  <input id="member-login" type="text" value={selectedMember.userId} readOnly className={`${readOnlyInputClass} font-mono text-meta`} />
                ) : (
                  <select id="member-login" value={selectedProductHubUser?.email ?? ''} onChange={(e) => handleLinkLogin(e.target.value)} className={inputClass}>
                    <option value="">Not linked — select a user to link…</option>
                    {productHubUsers
                      .filter((u) => !members.some((m) => m.userId && m.userId === u.userId))
                      .map((u) => (
                        <option key={u.userId} value={u.email}>
                          {u.fullName} ({u.email})
                        </option>
                      ))}
                  </select>
                )}
              </Field>
              {selectedMember && (
                <Field htmlFor="member-team" label="Team" hint="(change it from the Teams page)">
                  <input id="member-team" type="text" value={selectedMember.teamName || 'Unassigned'} disabled className={readOnlyInputClass} />
                </Field>
              )}
            </>
          ) : (
            <>
              <Field htmlFor="member-new-login" label="Email" hint="(from Product Hub)" required>
                <select id="member-new-login" value={formData.email} onChange={(e) => handleProductHubUserSelect(e.target.value)} className={inputClass} required>
                  <option value="">Select a user…</option>
                  {productHubUsers
                    .filter((u) => !members.some((m) => m.email === u.email || (m.userId && m.userId === u.userId)))
                    .map((u) => (
                      <option key={u.userId} value={u.email}>
                        {u.fullName} ({u.email})
                      </option>
                    ))}
                </select>
              </Field>
              <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                <Field htmlFor="member-new-first" label="First Name" required>
                  <input id="member-new-first" type="text" value={formData.firstName} onChange={(e) => setFormData({ ...formData, firstName: e.target.value })} className={inputClass} required />
                </Field>
                <Field htmlFor="member-new-last" label="Last Name" required>
                  <input id="member-new-last" type="text" value={formData.lastName} onChange={(e) => setFormData({ ...formData, lastName: e.target.value })} className={inputClass} required />
                </Field>
              </div>
            </>
          )}
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
            <Field htmlFor="member-role" label="Role" help="Taken from the user's role. Change it where roles are assigned, not here.">
              <input id="member-role" type="text" value={formData.role || '—'} readOnly className={readOnlyInputClass} />
            </Field>
            <Field htmlFor="member-skill" label="Skill Level" required help="Used in workload calculations.">
              <select id="member-skill" value={formData.skillLevel} onChange={(e) => setFormData({ ...formData, skillLevel: parseInt(e.target.value) })} className={inputClass} required>
                {SKILL_LABELS.map((label, i) => (
                  <option key={label} value={i + 1}>
                    {i + 1} — {label}
                  </option>
                ))}
              </select>
            </Field>
          </div>
        </form>
      </Modal>

      <ConfirmDialog
        isOpen={Boolean(memberToDelete)}
        title="Delete member"
        body={
          <>
            Delete <span className="font-medium text-ink">{memberToDelete?.firstName} {memberToDelete?.lastName}</span>? Work can no
            longer be assigned to them.
          </>
        }
        confirmLabel="Delete member"
        busy={deleting}
        onCancel={() => setMemberToDelete(null)}
        onConfirm={() => memberToDelete && handleDeleteMember(memberToDelete)}
      />
    </div>
  );
};

export default Members;
