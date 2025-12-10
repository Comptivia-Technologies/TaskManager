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
      <div className="p-8">
        <button
          onClick={() => {
            setIsDetailView(false);
            setSelectedTeam(null);
          }}
          className="mb-4 text-blue-500 hover:text-blue-700"
        >
          ← Back to Teams
        </button>
        <h1 className="text-3xl font-bold mb-4">{selectedTeam.teamName}</h1>
        <p className="text-gray-600 mb-6">{selectedTeam.description}</p>
        <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
          <div className="bg-white rounded-lg shadow-md p-6">
            <h2 className="text-xl font-bold mb-4">Members</h2>
            {(selectedTeam as any).members?.length > 0 ? (
              <ul className="space-y-2">
                {(selectedTeam as any).members.map((member: any) => (
                  <li key={member.memberId} className="border-b pb-2">
                    {member.firstName} {member.lastName} - {member.role}
                  </li>
                ))}
              </ul>
            ) : (
              <p className="text-gray-500">No members assigned</p>
            )}
          </div>
          <div className="bg-white rounded-lg shadow-md p-6">
            <h2 className="text-xl font-bold mb-4">Workflows</h2>
            {(selectedTeam as any).workflows?.length > 0 ? (
              <ul className="space-y-2">
                {(selectedTeam as any).workflows.map((workflow: any) => (
                  <li key={workflow.workflowId} className="border-b pb-2">
                    {workflow.workflowName}
                  </li>
                ))}
              </ul>
            ) : (
              <p className="text-gray-500">No workflows assigned</p>
            )}
          </div>
        </div>
      </div>
    );
  }

  return (
    <div className="p-8">
      <div className="flex justify-between items-center mb-6">
        <h1 className="text-3xl font-bold">Teams</h1>
        <button
          onClick={() => handleOpenModal()}
          className="bg-blue-500 text-white px-4 py-2 rounded-lg hover:bg-blue-600 flex items-center"
        >
          <FiPlus className="mr-2" />
          Create Team
        </button>
      </div>

      <div className="mb-6">
        <input
          type="text"
          placeholder="Search teams..."
          value={searchTerm}
          onChange={(e) => setSearchTerm(e.target.value)}
          className="w-full md:w-1/3 px-4 py-2 border border-gray-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-500"
        />
      </div>

      <div className="bg-white rounded-lg shadow-md overflow-hidden">
        <table className="min-w-full divide-y divide-gray-200">
          <thead className="bg-gray-50">
            <tr>
              <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                Name
              </th>
              <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                Description
              </th>
              <th className="px-6 py-3 text-right text-xs font-medium text-gray-500 uppercase tracking-wider">
                Actions
              </th>
            </tr>
          </thead>
          <tbody className="bg-white divide-y divide-gray-200">
            {filteredTeams.length === 0 ? (
              <tr>
                <td colSpan={3} className="px-6 py-4 text-center text-gray-500">
                  No teams found
                </td>
              </tr>
            ) : (
              filteredTeams.map((team) => (
                <tr key={team.teamId} className="hover:bg-gray-50">
                  <td className="px-6 py-4 whitespace-nowrap font-medium">
                    {team.teamName}
                  </td>
                  <td className="px-6 py-4 text-gray-600">
                    {team.description || 'No description'}
                  </td>
                  <td className="px-6 py-4 whitespace-nowrap text-right text-sm font-medium">
                    <button
                      onClick={() => handleViewDetails(team)}
                      className="text-blue-600 hover:text-blue-900 mr-3"
                      title="View Details"
                    >
                      <FiEye />
                    </button>
                    <button
                      onClick={() => handleOpenModal(team)}
                      className="text-indigo-600 hover:text-indigo-900 mr-3"
                      title="Edit"
                    >
                      <FiEdit />
                    </button>
                    <button
                      onClick={() => handleDelete(team.teamId)}
                      className="text-red-600 hover:text-red-900"
                      title="Delete"
                    >
                      <FiTrash2 />
                    </button>
                  </td>
                </tr>
              ))
            )}
          </tbody>
        </table>
      </div>

      {isModalOpen && (
        <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center z-50">
          <div className="bg-white rounded-lg p-6 w-full max-w-md">
            <h2 className="text-2xl font-bold mb-4">
              {isEditMode ? 'Edit Team' : 'Create Team'}
            </h2>
            <form onSubmit={handleSubmit}>
              <div className="mb-4">
                <label className="block text-gray-700 text-sm font-bold mb-2">
                  Team Name
                </label>
                <input
                  type="text"
                  value={formData.teamName}
                  onChange={(e) =>
                    setFormData({ ...formData, teamName: e.target.value })
                  }
                  className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-500"
                  required
                />
              </div>
              <div className="mb-4">
                <label className="block text-gray-700 text-sm font-bold mb-2">
                  Description
                </label>
                <textarea
                  value={formData.description}
                  onChange={(e) =>
                    setFormData({ ...formData, description: e.target.value })
                  }
                  className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-500"
                  rows={4}
                />
              </div>
              <div className="flex justify-end space-x-4">
                <button
                  type="button"
                  onClick={handleCloseModal}
                  className="px-4 py-2 border border-gray-300 rounded-lg hover:bg-gray-50"
                >
                  Cancel
                </button>
                <button
                  type="submit"
                  className="px-4 py-2 bg-blue-500 text-white rounded-lg hover:bg-blue-600"
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



