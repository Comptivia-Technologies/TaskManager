import { useState } from 'react';
import { FiX } from 'react-icons/fi';
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

const inputClass =
  'w-full px-3 py-2 border border-[#434E78]/30 rounded-azure-sm focus:outline-none focus:ring-2 focus:ring-[#434E78] focus:border-[#434E78] bg-white text-sm font-sans';

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
    });
  };

  const availableUsers = productHubUsers.filter(
    (u) => !linkedUserIds.includes(u.userId) || u.userId === formData.userId
  );

  return (
    <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center z-50 backdrop-blur-sm">
      <div className="bg-white rounded-azure-sm shadow-azure-xl p-6 w-full max-w-md border border-[#434E78]/20">
        <div className="flex justify-between items-center mb-4">
          <h2 className="text-xl font-semibold text-black font-sans">
            {isEditMode ? 'Edit Member' : 'Add Member'}
          </h2>
          <button
            onClick={onClose}
            className="text-black/70 hover:text-black hover:bg-[#434E78]/10 p-1 rounded-azure-sm transition-colors"
          >
            <FiX className="text-lg" />
          </button>
        </div>

        {!isEditMode && (
          <div className="flex gap-2 mb-5">
            <button
              type="button"
              onClick={() => setMode('existing')}
              className={`flex-1 px-3 py-2 rounded-azure-sm text-sm font-medium border transition-colors font-sans ${
                mode === 'existing'
                  ? 'bg-[#434E78] text-white border-[#434E78]'
                  : 'bg-white text-[#434E78] border-[#434E78]/30 hover:bg-[#434E78]/5'
              }`}
            >
              Existing member
            </button>
            <button
              type="button"
              onClick={() => setMode('new')}
              className={`flex-1 px-3 py-2 rounded-azure-sm text-sm font-medium border transition-colors font-sans ${
                mode === 'new'
                  ? 'bg-[#434E78] text-white border-[#434E78]'
                  : 'bg-white text-[#434E78] border-[#434E78]/30 hover:bg-[#434E78]/5'
              }`}
            >
              New member
            </button>
          </div>
        )}

        {!isEditMode && mode === 'existing' ? (
          <div>
            <div className="mb-4">
              <label htmlFor="tm-existing" className="block text-black text-sm font-semibold mb-2 font-sans">
                Member *
              </label>
              <select
                id="tm-existing"
                value={existingMemberId}
                onChange={(e) => setExistingMemberId(e.target.value)}
                className={inputClass}
              >
                <option value="">Select a member...</option>
                {availableMembers.map((m) => (
                  <option key={m.memberId} value={m.memberId}>
                    {m.firstName} {m.lastName}
                    {m.teamName ? ` — currently ${m.teamName}` : ' — no team'}
                  </option>
                ))}
              </select>
              <p className="text-xs text-black/60 mt-1 font-sans">
                {availableMembers.length === 0
                  ? 'Every member is already on this team. Use "New member" to add someone else.'
                  : 'A member belongs to one team, so this moves them onto this team.'}
              </p>
            </div>

            <div className="flex justify-end space-x-3">
              <button
                type="button"
                onClick={onClose}
                className="px-4 py-2 border border-[#434E78]/30 rounded-azure-sm hover:bg-[#434E78]/5 text-black font-medium text-sm transition-colors font-sans"
              >
                Cancel
              </button>
              <button
                type="button"
                disabled={!existingMemberId}
                onClick={() => onAddExisting(existingMemberId)}
                className="px-4 py-2 bg-[#434E78] text-white rounded-azure-sm hover:bg-[#434E78]/90 font-medium text-sm shadow-azure-sm transition-colors font-sans disabled:opacity-50 disabled:cursor-not-allowed"
              >
                Add to team
              </button>
            </div>
          </div>
        ) : (
        <form onSubmit={onSubmit}>
          {isEditMode ? (
            <div className="mb-4">
              <label htmlFor="tm-email" className="block text-black text-sm font-semibold mb-2 font-sans">Email</label>
              <input id="tm-email" type="email" value={formData.email} readOnly className={`${inputClass} bg-gray-50 cursor-not-allowed`} />
            </div>
          ) : (
            <div className="mb-4">
              <label htmlFor="tm-login" className="block text-black text-sm font-semibold mb-2 font-sans">
                Login <span className="text-xs text-black/60 font-normal">(from Product Hub)</span> *
              </label>
              <select
                id="tm-login"
                value={formData.email}
                onChange={(e) => selectProductHubUser(e.target.value)}
                className={inputClass}
                required
              >
                <option value="">Select a user...</option>
                {availableUsers.map((u) => (
                  <option key={u.userId} value={u.email}>
                    {u.fullName} ({u.email})
                  </option>
                ))}
              </select>
              <p className="text-xs text-black/60 mt-1 font-sans">
                Required so this person can see the work assigned to them.
              </p>
            </div>
          )}

          <div className="mb-4">
            <label htmlFor="tm-first-name" className="block text-black text-sm font-semibold mb-2 font-sans">First Name *</label>
            <input
              id="tm-first-name"
              type="text"
              value={formData.firstName}
              onChange={(e) => onChange({ ...formData, firstName: e.target.value })}
              className={inputClass}
              required
            />
          </div>

          <div className="mb-4">
            <label htmlFor="tm-last-name" className="block text-black text-sm font-semibold mb-2 font-sans">Last Name *</label>
            <input
              id="tm-last-name"
              type="text"
              value={formData.lastName}
              onChange={(e) => onChange({ ...formData, lastName: e.target.value })}
              className={inputClass}
              required
            />
          </div>

          <div className="mb-4">
            <label htmlFor="tm-team" className="block text-black text-sm font-semibold mb-2 font-sans">Team *</label>
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
          </div>

          <div className="mb-4">
            <label htmlFor="tm-role" className="block text-black text-sm font-semibold mb-2 font-sans">Role *</label>
            <input
              id="tm-role"
              type="text"
              value={formData.role}
              onChange={(e) => onChange({ ...formData, role: e.target.value })}
              className={inputClass}
              placeholder="e.g., Engineer, Procurement, Manager"
              required
            />
            <p className="text-xs text-black/60 mt-1 font-sans">
              A descriptive job title. It does not grant any permissions.
            </p>
          </div>

          <div className="mb-4">
            <label htmlFor="tm-skill-level" className="block text-black text-sm font-semibold mb-2 font-sans">Skill Level *</label>
            <select
              id="tm-skill-level"
              value={formData.skillLevel}
              onChange={(e) => onChange({ ...formData, skillLevel: parseInt(e.target.value, 10) })}
              className={inputClass}
              required
            >
              <option value={1}>1 - Beginner</option>
              <option value={2}>2 - Junior</option>
              <option value={3}>3 - Intermediate</option>
              <option value={4}>4 - Advanced</option>
              <option value={5}>5 - Expert</option>
            </select>
            <p className="text-xs text-black/60 mt-1 font-sans">
              Skill level (1-5) used for workload calculations
            </p>
          </div>

          <div className="flex justify-end space-x-3">
            <button
              type="button"
              onClick={onClose}
              className="px-4 py-2 border border-[#434E78]/30 rounded-azure-sm hover:bg-[#434E78]/5 text-black font-medium text-sm transition-colors font-sans"
            >
              Cancel
            </button>
            <button
              type="submit"
              className="px-4 py-2 bg-[#434E78] text-white rounded-azure-sm hover:bg-[#434E78]/90 font-medium text-sm shadow-azure-sm transition-colors font-sans"
            >
              {isEditMode ? 'Update' : 'Add'}
            </button>
          </div>
        </form>
        )}
      </div>
    </div>
  );
};

export default TeamMemberModal;
