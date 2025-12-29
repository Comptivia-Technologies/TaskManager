import { useState } from 'react';
import { useTeams } from '../hooks/useTeams';
import { teamService } from '../services/teamService';
import { Team, TeamCreate } from '../types';
import LoadingSpinner from '../components/LoadingSpinner';
import { FiPlus, FiEdit, FiTrash2, FiEye } from 'react-icons/fi';
import { toast } from 'react-toastify';

const Teams = () => {
  const { teams, loading, refetch } = useTeams();
  const [isModalOpen, setIsModalOpen] = useState(false);
  const [isEditMode, setIsEditMode] = useState(false);
  const [selectedTeam, setSelectedTeam] = useState<Team | null>(null);
  const [isDetailView, setIsDetailView] = useState(false);
  const [formData, setFormData] = useState<TeamCreate>({
    teamName: '',
    description: '',
  });
  const [searchTerm, setSearchTerm] = useState('');

  const handleOpenModal = (team?: Team) => {
    if (team) {
      setSelectedTeam(team);
      setIsEditMode(true);
      setFormData({
        teamName: team.teamName,
        description: team.description || '',
      });
    } else {
      setIsEditMode(false);
      setFormData({ teamName: '', description: '' });
      setSelectedTeam(null);
    }
    setIsModalOpen(true);
  };

  const handleCloseModal = () => {
    setIsModalOpen(false);
    setIsEditMode(false);
    setSelectedTeam(null);
    setFormData({ teamName: '', description: '' });
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    try {
      if (isEditMode && selectedTeam) {
        await teamService.update(selectedTeam.teamId, formData);
        toast.success('Team updated successfully');
      } else {
        await teamService.create(formData);
        toast.success('Team created successfully');
      }
      handleCloseModal();
      refetch();
    } catch (error: any) {
      toast.error(error.response?.data?.error || 'Failed to save team');
    }
  };

  const handleDelete = async (id: number) => {
    const team = teams.find(t => t.teamId === id);
    const teamName = team?.teamName || 'this team';
    
    if (window.confirm(`Are you sure you want to delete "${teamName}"?\n\nNote: You cannot delete a team that has members, workflows, or stages assigned to it.`)) {
      try {
        await teamService.delete(id);
        toast.success('Team deleted successfully');
        refetch();
      } catch (error: any) {
        const errorMessage = error.response?.data?.error || error.message || 'Failed to delete team';
        toast.error(errorMessage, {
          autoClose: 5000, // Show for 5 seconds for longer error messages
        });
      }
    }
  };

  const handleViewDetails = async (team: Team) => {
    try {
      const [members, workflows] = await Promise.all([
        teamService.getMembers(team.teamId),
        teamService.getWorkflows(team.teamId),
      ]);
      setSelectedTeam({ ...team, members, workflows } as any);
      setIsDetailView(true);
    } catch (error: any) {
      toast.error('Failed to load team details');
    }
  };

  const filteredTeams = teams.filter(
    (team) =>
      team.teamName.toLowerCase().includes(searchTerm.toLowerCase()) ||
      team.description?.toLowerCase().includes(searchTerm.toLowerCase())
  );

  if (loading) {
    return <LoadingSpinner />;
  }

  if (isDetailView && selectedTeam) {
    return (
      <div className="p-8 bg-white">
        <button
          onClick={() => {
            setIsDetailView(false);
            setSelectedTeam(null);
          }}
          className="mb-4 text-[#434E78] hover:text-[#434E78]/80 font-medium text-sm font-sans flex items-center"
        >
          ← Back to Teams
        </button>
        <h1 className="text-3xl font-semibold mb-2 text-black font-sans tracking-tight">{selectedTeam.teamName}</h1>
        <p className="text-black/70 mb-6 font-sans">{selectedTeam.description}</p>
        <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
          <div className="bg-white rounded-azure-sm shadow-azure-md p-6 border border-[#434E78]/20">
            <h2 className="text-lg font-semibold mb-4 text-black font-sans">Members</h2>
            {(selectedTeam as any).members?.length > 0 ? (
              <ul className="space-y-2">
                {(selectedTeam as any).members.map((member: any) => (
                  <li key={member.memberId} className="border-b border-[#434E78]/20 pb-2 text-black/80 font-sans">
                    {member.firstName} {member.lastName} - <span className="text-black/60">{member.role}</span>
                  </li>
                ))}
              </ul>
            ) : (
              <p className="text-black/60 font-sans">No members assigned</p>
            )}
          </div>
          <div className="bg-white rounded-azure-sm shadow-azure-md p-6 border border-[#434E78]/20">
            <h2 className="text-lg font-semibold mb-4 text-black font-sans">Workflows</h2>
            {(selectedTeam as any).workflows?.length > 0 ? (
              <ul className="space-y-2">
                {(selectedTeam as any).workflows.map((workflow: any) => (
                  <li key={workflow.workflowId} className="border-b border-[#434E78]/20 pb-2 text-black/80 font-sans">
                    {workflow.workflowName}
                  </li>
                ))}
              </ul>
            ) : (
              <p className="text-black/60 font-sans">No workflows assigned</p>
            )}
          </div>
        </div>
      </div>
    );
  }

  return (
    <div className="p-8 bg-white font-sans">
      <div className="flex justify-between items-center mb-6 pb-4 border-b border-[#434E78]/20">
        <h1 className="text-3xl font-semibold text-black font-sans tracking-tight">Teams</h1>
        <button
          onClick={() => handleOpenModal()}
          className="bg-[#434E78] text-white px-5 py-2.5 rounded-azure-sm hover:bg-[#434E78]/90 flex items-center shadow-azure-sm hover:shadow-azure-md transition-all font-medium text-sm"
        >
          <FiPlus className="mr-2 text-base" />
          Create Team
        </button>
      </div>

      <div className="mb-6">
        <input
          type="text"
          placeholder="Search teams..."
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
                Description
              </th>
              <th className="px-6 py-3 text-left text-xs font-semibold text-black uppercase tracking-wider font-sans">
                Workflow
              </th>
              <th className="px-6 py-3 text-right text-xs font-semibold text-black uppercase tracking-wider font-sans">
                Actions
              </th>
            </tr>
          </thead>
          <tbody className="bg-white divide-y divide-[#434E78]/20">
            {filteredTeams.length === 0 ? (
              <tr>
                <td colSpan={4} className="px-6 py-8 text-center text-black/60 font-sans">
                  No teams found
                </td>
              </tr>
            ) : (
              filteredTeams.map((team) => (
                <tr key={team.teamId} className="hover:bg-[#434E78]/5 transition-colors">
                  <td className="px-6 py-4 whitespace-nowrap font-semibold text-black font-sans">
                    {team.teamName}
                  </td>
                  <td className="px-6 py-4 text-black/70 font-sans">
                    {team.description || 'No description'}
                  </td>
                  <td className="px-6 py-4 text-black/70 font-sans">
                    {team.workflowNames && team.workflowNames.length > 0 ? (
                      <div className="flex flex-wrap gap-1">
                        {team.workflowNames.map((workflowName, index) => (
                          <span
                            key={index}
                            className="inline-block px-2 py-1 text-xs bg-[#434E78]/10 text-[#434E78] rounded-azure-sm font-medium"
                          >
                            {workflowName}
                          </span>
                        ))}
                      </div>
                    ) : (
                      <span className="text-black/40 italic">No workflows</span>
                    )}
                  </td>
                  <td className="px-6 py-4 whitespace-nowrap text-right text-sm font-medium">
                    <button
                      onClick={() => handleViewDetails(team)}
                      className="text-[#434E78] hover:text-[#434E78]/80 hover:bg-[#434E78]/10 p-2 rounded-azure-sm mr-2 transition-colors"
                      title="View Details"
                    >
                      <FiEye className="text-base" />
                    </button>
                    <button
                      onClick={() => handleOpenModal(team)}
                      className="text-[#434E78] hover:text-[#434E78]/80 hover:bg-[#434E78]/10 p-2 rounded-azure-sm mr-2 transition-colors"
                      title="Edit"
                    >
                      <FiEdit className="text-base" />
                    </button>
                    <button
                      onClick={() => handleDelete(team.teamId)}
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
              {isEditMode ? 'Edit Team' : 'Create Team'}
            </h2>
            <form onSubmit={handleSubmit}>
              <div className="mb-4">
                <label className="block text-black text-sm font-semibold mb-2 font-sans">
                  Team Name
                </label>
                <input
                  type="text"
                  value={formData.teamName}
                  onChange={(e) =>
                    setFormData({ ...formData, teamName: e.target.value })
                  }
                  className="w-full px-3 py-2 border border-[#434E78]/30 rounded-azure-sm focus:outline-none focus:ring-2 focus:ring-[#434E78] focus:border-[#434E78] bg-white text-sm font-sans"
                  required
                />
              </div>
              <div className="mb-4">
                <label className="block text-black text-sm font-semibold mb-2 font-sans">
                  Description
                </label>
                <textarea
                  value={formData.description}
                  onChange={(e) =>
                    setFormData({ ...formData, description: e.target.value })
                  }
                  className="w-full px-3 py-2 border border-[#434E78]/30 rounded-azure-sm focus:outline-none focus:ring-2 focus:ring-[#434E78] focus:border-[#434E78] bg-white text-sm font-sans"
                  rows={4}
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

export default Teams;



