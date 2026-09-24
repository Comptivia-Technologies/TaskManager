import { inputClass, readOnlyInputClass } from '../utils/formStyles';
import { useState } from 'react';
import { FiUserPlus } from 'react-icons/fi';
import Modal from './Modal';
import Field from './Field';
import Button from './Button';
import { SKILL_LABELS } from './SkillMeter';
import { Member, MemberCreate, Team, User } from '../types';

interface TeamMemberModalProps {
  isOpen: boolean;
  isEditMode: boolean;
  formData: MemberCreate;
  teams: Team[];
  productHubUsers: User[];
  linkedUserIds: string[];
  /** Members not already on this team, offered for reassignment. */
  availableMembers: Member[];
  onChange: (data: MemberCreate) => void;
  onSubmit: (e: React.FormEvent) => void;
  onAddExisting: (memberId: string) => void;
  onClose: () => void;
}

const splitFullName = (fullName: string) => {
  const parts = (fullName || '').trim().split(/\s+/).filter(Boolean);
  return { firstName: parts[0] ?? '', lastName: parts.slice(1).join(' ') };
};

const TeamMemberModal = ({
  isOpen,
  isEditMode,
  formData,
  teams,
  productHubUsers,
  linkedUserIds,
  availableMembers,
  onChange,
  onSubmit,
  onAddExisting,
  onClose,
}: TeamMemberModalProps) => {
  // Most of the time the person already exists and just needs moving onto this
  // team, so that is the default; creating a brand new member is the exception.
  const [mode, setMode] = useState<'existing' | 'new'>('existing');
  const [existingMemberId, setExistingMemberId] = useState('');

  if (!isOpen) return null;

  // Picking the login here is what lets the member see their own work later; a
  // member created without one cannot be resolved from a session.
  const selectProductHubUser = (email: string) => {
    const user = productHubUsers.find((u) => u.email === email);
    if (!user) {
      onChange({ ...formData, email: '', userId: undefined });
      return;
    }
    const { firstName, lastName } = splitFullName(user.fullName);
    onChange({
      ...formData,
      email: user.email,
      userId: user.userId,
      firstName: firstName || formData.firstName,
      lastName: lastName || formData.lastName,
      // The job title comes with the login; it is not a separate thing to maintain.
      role: user.role || '',
    });
  };

  const availableUsers = productHubUsers.filter(
    (u) => !linkedUserIds.includes(u.userId) || u.userId === formData.userId
  );

  const addingExisting = !isEditMode && mode === 'existing';

  return (
    <Modal
      isOpen={isOpen}
      title={isEditMode ? 'Edit Member' : 'Add Member'}
      icon={<FiUserPlus />}
      onClose={onClose}
      footer={
        <>
          <Button variant="secondary" onClick={onClose}>
            Cancel
          </Button>
          {addingExisting ? (
            <Button variant="primary" disabled={!existingMemberId} onClick={() => onAddExisting(existingMemberId)}>
              Add to team
            </Button>
          ) : (
            <Button variant="primary" type="submit" form="team-member-form">
              {isEditMode ? 'Update' : 'Add'}
            </Button>
          )}
        </>
      }
    >
      {!isEditMode && (
        <div role="group" aria-label="Who to add" className="grid grid-cols-2 p-0.5 mb-5 rounded-control bg-surface-sunken">
          {(['existing', 'new'] as const).map((m) => (
            <button
              key={m}
              type="button"
              aria-pressed={mode === m}
              onClick={() => setMode(m)}
              className={`h-8 rounded-[5px] text-meta font-medium cursor-pointer ${
                mode === m ? 'bg-surface text-ink shadow-azure-sm' : 'text-ink-subtle hover:text-ink'
              }`}
            >
              {m === 'existing' ? 'Existing member' : 'New member'}
            </button>
          ))}
        </div>
      )}

      {addingExisting ? (
        <Field
          htmlFor="tm-existing"
          label="Member"
          required
          help={
            availableMembers.length === 0
              ? 'Every member is already on this team. Use "New member" to add someone else.'
              : 'A member belongs to one team, so this moves them onto this team.'
          }
        >
          <select
            id="tm-existing"
            value={existingMemberId}
            onChange={(e) => setExistingMemberId(e.target.value)}
            className={inputClass}
          >
            <option value="">Select a member…</option>
            {availableMembers.map((m) => (
              <option key={m.memberId} value={m.memberId}>
                {m.firstName} {m.lastName}
                {m.teamName ? ` — currently ${m.teamName}` : ' — no team'}
              </option>
            ))}
          </select>
        </Field>
      ) : (
        <form id="team-member-form" onSubmit={onSubmit} className="space-y-4">
          {isEditMode ? (
            <Field htmlFor="tm-email" label="Email">
              <input id="tm-email" type="email" value={formData.email} readOnly className={readOnlyInputClass} />
            </Field>
          ) : (
            <Field htmlFor="tm-login" label="Login" hint="(from Product Hub)" required help="Required so this person can see the work assigned to them.">
              <select
                id="tm-login"
                value={formData.email}
                onChange={(e) => selectProductHubUser(e.target.value)}
                className={inputClass}
                required
              >
                <option value="">Select a user…</option>
                {availableUsers.map((u) => (
                  <option key={u.userId} value={u.email}>
                    {u.fullName} ({u.email})
                  </option>
                ))}
              </select>
            </Field>
          )}

          <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
            <Field htmlFor="tm-first-name" label="First Name" required>
              <input
                id="tm-first-name"
                type="text"
                value={formData.firstName}
                onChange={(e) => onChange({ ...formData, firstName: e.target.value })}
                className={inputClass}
                required
              />
            </Field>
            <Field htmlFor="tm-last-name" label="Last Name" required>
              <input
                id="tm-last-name"
                type="text"
                value={formData.lastName}
                onChange={(e) => onChange({ ...formData, lastName: e.target.value })}
                className={inputClass}
                required
              />
            </Field>
          </div>

          <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
            <Field htmlFor="tm-team" label="Team" required>
              <select
                id="tm-team"
                value={formData.teamId ?? ''}
                onChange={(e) => onChange({ ...formData, teamId: e.target.value || undefined })}
                className={inputClass}
                required
              >
                {teams.map((team) => (
                  <option key={team.teamId} value={team.teamId}>
                    {team.teamName}
                  </option>
                ))}
              </select>
            </Field>
            <Field htmlFor="tm-skill-level" label="Skill Level" required>
              <select
                id="tm-skill-level"
                value={formData.skillLevel}
                onChange={(e) => onChange({ ...formData, skillLevel: parseInt(e.target.value, 10) })}
                className={inputClass}
                required
              >
                {SKILL_LABELS.map((label, i) => (
                  <option key={label} value={i + 1}>
                    {i + 1} — {label}
                  </option>
                ))}
              </select>
            </Field>
          </div>

          <Field htmlFor="tm-role" label="Role" help="Taken from the user's role. Change it where roles are assigned, not here.">
            <input id="tm-role" type="text" value={formData.role || '—'} readOnly className={readOnlyInputClass} />
          </Field>
        </form>
      )}
    </Modal>
  );
};

export default TeamMemberModal;
