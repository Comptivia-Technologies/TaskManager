import { useState, useEffect } from 'react';
import { useMembers } from '../hooks/useMembers';
import { useTeams } from '../hooks/useTeams';
import { memberService } from '../services/memberService';
import { Member, MemberCreate } from '../types';
import LoadingSpinner from '../components/LoadingSpinner';
import { FiPlus, FiEdit, FiTrash2 } from 'react-icons/fi';
import { toast } from 'react-toastify';

const Members = () => {
  const { members, loading, refetch } = useMembers();
  const { teams } = useTeams();
  const [isModalOpen, setIsModalOpen] = useState(false);
  const [isEditMode, setIsEditMode] = useState(false);
  const [selectedMember, setSelectedMember] = useState<Member | null>(null);
  const [formData, setFormData] = useState<MemberCreate>({
    firstName: '',
    lastName: '',
    email: '',
    teamId: 0,
    role: '',
  });
  const [searchTerm, setSearchTerm] = useState('');

  useEffect(() => {
    if (teams.length > 0 && formData.teamId === 0) {
      setFormData({ ...formData, teamId: teams[0].teamId });
    }
  }, [teams]);

  const handleOpenModal = (member?: Member) => {
    if (member) {
      setSelectedMember(member);
      setIsEditMode(true);
      setFormData({
        firstName: member.firstName,
        lastName: member.lastName,
        email: member.email,
        teamId: member.teamId,
        role: member.role,
      });
    } else {
      setIsEditMode(false);
      setFormData({
        firstName: '',
        lastName: '',
        email: '',
        teamId: teams.length > 0 ? teams[0].teamId : 0,
        role: '',
      });
      setSelectedMember(null);
    }
    setIsModalOpen(true);
  };

  const handleCloseModal = () => {
    setIsModalOpen(false);
    setIsEditMode(false);
    setSelectedMember(null);
    setFormData({
      firstName: '',
      lastName: '',
      email: '',
      teamId: teams.length > 0 ? teams[0].teamId : 0,
      role: '',
    });
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    try {
      if (isEditMode && selectedMember) {
        await memberService.update(selectedMember.memberId, formData);
        toast.success('Member updated successfully');
      } else {
        await memberService.create(formData);
        toast.success('Member created successfully');
      }
      handleCloseModal();
      refetch();
    } catch (error: any) {
      toast.error(error.response?.data?.error || 'Failed to save member');
    }
  };

  const handleDelete = async (id: number) => {
    if (window.confirm('Are you sure you want to delete this member?')) {
      try {
        await memberService.delete(id);
        toast.success('Member deleted successfully');
        refetch();
      } catch (error: any) {
        toast.error(error.response?.data?.error || 'Failed to delete member');
      }
    }
  };

  const filteredMembers = members.filter(
    (member) =>
      member.firstName.toLowerCase().includes(searchTerm.toLowerCase()) ||
      member.lastName.toLowerCase().includes(searchTerm.toLowerCase()) ||
      member.email.toLowerCase().includes(searchTerm.toLowerCase()) ||
      member.teamName.toLowerCase().includes(searchTerm.toLowerCase())
  );

  if (loading) {
    return <LoadingSpinner />;
  }

  return (
    <div className="p-8 bg-white font-sans">
      <div className="flex justify-between items-center mb-6 pb-4 border-b border-[#434E78]/20">
        <h1 className="text-3xl font-semibold text-black font-sans tracking-tight">Members</h1>
        <button
          onClick={() => handleOpenModal()}
          className="bg-[#434E78] text-white px-5 py-2.5 rounded-azure-sm hover:bg-[#434E78]/90 flex items-center shadow-azure-sm hover:shadow-azure-md transition-all font-medium text-sm"
        >
          <FiPlus className="mr-2 text-base" />
          Create Member
        </button>
      </div>

      <div className="mb-6">
        <input
          type="text"
          placeholder="Search members..."
          value={searchTerm}
          onChange={(e) => setSearchTerm(e.target.value)}
          className="w-full md:w-1/3 px-4 py-2 border border-[#434E78]/30 rounded-azure-sm focus:outline-none focus:ring-2 focus:ring-[#434E78] focus:border-[#434E78] bg-white text-sm font-sans"
        />
      </div>

      <div className="bg-white rounded-azure-sm shadow-azure-sm overflow-hidden border border-[#434E78]/20">
        <table className="min-w-full divide-y divide-[#434E78]/20">
          <thead className="bg-[#434E78]/5">
            <tr>
              <th className="px-6 py-3 text-left text-xs font-semibold text-black uppercase tracking-wider font-sans">
                Name
              </th>
              <th className="px-6 py-3 text-left text-xs font-semibold text-black uppercase tracking-wider font-sans">
                Email
              </th>
              <th className="px-6 py-3 text-left text-xs font-semibold text-black uppercase tracking-wider font-sans">
                Team
              </th>
              <th className="px-6 py-3 text-left text-xs font-semibold text-black uppercase tracking-wider font-sans">
                Role
              </th>
              <th className="px-6 py-3 text-right text-xs font-semibold text-black uppercase tracking-wider font-sans">
                Actions
              </th>
            </tr>
          </thead>
          <tbody className="bg-white divide-y divide-[#434E78]/20">
            {filteredMembers.length === 0 ? (
              <tr>
                <td colSpan={5} className="px-6 py-8 text-center text-black/60 font-sans">
                  No members found
                </td>
              </tr>
            ) : (
              filteredMembers.map((member) => (
                <tr key={member.memberId} className="hover:bg-[#434E78]/5 transition-colors">
                  <td className="px-6 py-4 whitespace-nowrap font-semibold text-black font-sans">
                    {member.firstName} {member.lastName}
                  </td>
                  <td className="px-6 py-4 whitespace-nowrap text-black/70 font-sans">
                    {member.email}
                  </td>
                  <td className="px-6 py-4 whitespace-nowrap text-black/70 font-sans">
                    {member.teamName}
                  </td>
                  <td className="px-6 py-4 whitespace-nowrap text-black/70 font-sans">
                    {member.role}
                  </td>
                  <td className="px-6 py-4 whitespace-nowrap text-right text-sm font-medium">
                    <button
                      onClick={() => handleOpenModal(member)}
                      className="text-[#434E78] hover:text-[#434E78]/80 hover:bg-[#434E78]/10 p-2 rounded-azure-sm mr-2 transition-colors"
                      title="Edit"
                    >
                      <FiEdit className="text-base" />
                    </button>
                    <button
                      onClick={() => handleDelete(member.memberId)}
                      className="text-red-600 hover:text-red-700 hover:bg-red-50 p-2 rounded-azure-sm transition-colors"
                      title="Delete"
                    >
                      <FiTrash2 className="text-base" />
                    </button>
                  </td>
                </tr>
              ))
            )}
          </tbody>
        </table>
      </div>

      {isModalOpen && (
        <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center z-50 backdrop-blur-sm">
          <div className="bg-white rounded-azure-sm shadow-azure-xl p-6 w-full max-w-md border border-[#434E78]/20">
            <h2 className="text-xl font-semibold mb-4 text-black font-sans">
              {isEditMode ? 'Edit Member' : 'Create Member'}
            </h2>
            <form onSubmit={handleSubmit}>
              <div className="mb-4">
                <label className="block text-black text-sm font-semibold mb-2 font-sans">
                  First Name
                </label>
                <input
                  type="text"
                  value={formData.firstName}
                  onChange={(e) =>
                    setFormData({ ...formData, firstName: e.target.value })
                  }
                  className="w-full px-3 py-2 border border-[#434E78]/30 rounded-azure-sm focus:outline-none focus:ring-2 focus:ring-[#434E78] focus:border-[#434E78] bg-white text-sm font-sans"
                  required
                />
              </div>
              <div className="mb-4">
                <label className="block text-black text-sm font-semibold mb-2 font-sans">
                  Last Name
                </label>
                <input
                  type="text"
                  value={formData.lastName}
                  onChange={(e) =>
                    setFormData({ ...formData, lastName: e.target.value })
                  }
                  className="w-full px-3 py-2 border border-[#434E78]/30 rounded-azure-sm focus:outline-none focus:ring-2 focus:ring-[#434E78] focus:border-[#434E78] bg-white text-sm font-sans"
                  required
                />
              </div>
              <div className="mb-4">
                <label className="block text-black text-sm font-semibold mb-2 font-sans">
                  Email
                </label>
                <input
                  type="email"
                  value={formData.email}
                  onChange={(e) =>
                    setFormData({ ...formData, email: e.target.value })
                  }
                  className="w-full px-3 py-2 border border-[#434E78]/30 rounded-azure-sm focus:outline-none focus:ring-2 focus:ring-[#434E78] focus:border-[#434E78] bg-white text-sm font-sans"
                  required
                />
              </div>
              <div className="mb-4">
                <label className="block text-black text-sm font-semibold mb-2 font-sans">
                  Team
                </label>
                <select
                  value={formData.teamId}
                  onChange={(e) =>
                    setFormData({ ...formData, teamId: parseInt(e.target.value) })
                  }
                  className="w-full px-3 py-2 border border-[#434E78]/30 rounded-azure-sm focus:outline-none focus:ring-2 focus:ring-[#434E78] focus:border-[#434E78] bg-white text-sm font-sans"
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
                <label className="block text-black text-sm font-semibold mb-2 font-sans">
                  Role
                </label>
                <input
                  type="text"
                  value={formData.role}
                  onChange={(e) =>
                    setFormData({ ...formData, role: e.target.value })
                  }
                  className="w-full px-3 py-2 border border-[#434E78]/30 rounded-azure-sm focus:outline-none focus:ring-2 focus:ring-[#434E78] focus:border-[#434E78] bg-white text-sm font-sans"
                  required
                />
              </div>
              <div className="flex justify-end space-x-3">
                <button
                  type="button"
                  onClick={handleCloseModal}
                  className="px-4 py-2 border border-[#434E78]/30 rounded-azure-sm hover:bg-[#434E78]/5 text-black font-medium text-sm transition-colors font-sans"
                >
                  Cancel
                </button>
                <button
                  type="submit"
                  className="px-4 py-2 bg-[#434E78] text-white rounded-azure-sm hover:bg-[#434E78]/90 font-medium text-sm shadow-azure-sm transition-colors font-sans"
                >
                  {isEditMode ? 'Update' : 'Create'}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}
    </div>
  );
};

export default Members;



