import { useTeams } from '../hooks/useTeams';
import { useMembers } from '../hooks/useMembers';
import { useWorkflows } from '../hooks/useWorkflows';
import LoadingSpinner from '../components/LoadingSpinner';
import { FiUsers, FiUser, FiLayers, FiArrowRight, FiTrendingUp, FiCalendar } from 'react-icons/fi';
import { useNavigate } from 'react-router-dom';

const Dashboard = () => {
  const { teams, loading: teamsLoading } = useTeams();
  const { members, loading: membersLoading } = useMembers();
  const { workflows, loading: workflowsLoading } = useWorkflows();
  const navigate = useNavigate();

  if (teamsLoading || membersLoading || workflowsLoading) {
    return <LoadingSpinner />;
  }

  // Calculate statistics
  const totalStages = workflows.reduce((sum, w) => sum + (w.stages?.length || 0), 0);
  const avgStagesPerWorkflow = workflows.length > 0 ? Math.round(totalStages / workflows.length) : 0;
  
  // Get recent workflows
  const recentWorkflows = [...workflows]
    .sort((a, b) => new Date(b.createdAt).getTime() - new Date(a.createdAt).getTime())
    .slice(0, 6);
  
  // Get workflows by team
  const workflowsByTeam = teams.map(team => ({
    teamName: team.teamName,
    count: workflows.filter(w => w.teamId === team.teamId).length
  })).sort((a, b) => b.count - a.count).slice(0, 3);

  const stats = [
    {
      label: 'Total Teams',
      value: teams.length,
      icon: FiUsers,
      description: 'Active teams',
    },
    {
      label: 'Team Members',
      value: members.length,
      icon: FiUser,
      description: 'Total members',
    },
    {
      label: 'Active Workflows',
      value: workflows.length,
      icon: FiLayers,
      description: 'In progress',
    },
    {
      label: 'Total Stages',
      value: totalStages,
      icon: FiTrendingUp,
      description: `${avgStagesPerWorkflow} avg per workflow`,
    },
  ];

  return (
    <div className="p-8 lg:p-10 bg-white min-h-screen font-sans">
      <div className="max-w-7xl mx-auto">
        {/* Header */}
        <div className="mb-8">
          <h1 className="text-4xl font-semibold text-black mb-2 font-sans tracking-tight">
            Dashboard
          </h1>
          <p className="text-black/70 text-base font-sans">Welcome back! Here's an overview of your workload management system.</p>
        </div>

        {/* Stats Grid */}
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-4 mb-8">
          {stats.map((stat, index) => {
            const Icon = stat.icon;
            return (
              <div
                key={stat.label}
                className="group relative bg-white rounded-azure-sm shadow-azure-sm hover:shadow-azure-md transition-all duration-200 overflow-hidden border border-[#434E78]/20"
              >
                <div className="p-6">
                  <div className="flex items-center justify-between mb-4">
                    <div className="bg-[#434E78]/10 p-3 rounded-azure-sm group-hover:bg-[#434E78]/20 transition-colors duration-200">
                      <Icon className="text-[#434E78] text-2xl" />
                    </div>
                    <div className="text-right">
                      <p className="text-black/60 text-xs font-medium uppercase tracking-wide font-sans">{stat.description}</p>
                    </div>
                  </div>
                  <div>
                    <p className="text-black/80 text-sm font-medium mb-1.5 tracking-wide font-sans">{stat.label}</p>
                    <p className="text-3xl font-semibold text-black font-sans">
                      {stat.value.toLocaleString()}
                    </p>
                  </div>
                </div>
                <div className="h-0.5 bg-[#434E78]/30 group-hover:bg-[#434E78]/50 transition-colors"></div>
              </div>
            );
          })}
        </div>

        <div className="grid grid-cols-1 lg:grid-cols-3 gap-4 mb-8">
          {/* Recent Workflows */}
          <div className="lg:col-span-2 bg-white rounded-azure-sm shadow-azure-md p-6 border border-[#434E78]/20">
            <div className="flex items-center justify-between mb-6 pb-4 border-b border-[#434E78]/20">
              <h2 className="text-xl font-semibold text-black font-sans">Recent Workflows</h2>
              <button
                onClick={() => navigate('/workflows')}
                className="text-[#434E78] hover:text-[#434E78]/80 font-semibold flex items-center gap-2 transition-all hover:gap-3 font-sans text-sm"
              >
                View All
                <FiArrowRight className="text-base" />
              </button>
            </div>
            {recentWorkflows.length === 0 ? (
              <div className="text-center py-12">
                <div className="bg-[#434E78]/10 rounded-full w-20 h-20 flex items-center justify-center mx-auto mb-4">
                  <FiLayers className="text-[#434E78] text-4xl" />
                </div>
                <p className="text-black/70 text-base font-sans">No workflows yet. Create your first workflow to get started.</p>
              </div>
            ) : (
              <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
                {recentWorkflows.map((workflow) => {
                  return (
                    <div
                      key={workflow.workflowId}
                      onClick={() => navigate(`/workflows/${workflow.workflowId}`)}
                      className="group p-4 border border-[#434E78]/20 rounded-azure-sm hover:border-[#434E78]/40 hover:shadow-azure-sm transition-all duration-200 cursor-pointer bg-white"
                    >
                      <div className="flex items-start justify-between mb-2">
                        <h3 className="font-semibold text-black group-hover:text-black/80 transition-colors text-base font-sans">
                          {workflow.workflowName}
                        </h3>
                        <FiArrowRight className="text-[#434E78]/50 group-hover:text-[#434E78] group-hover:translate-x-1 transition-all duration-200 text-base" />
                      </div>
                      <p className="text-sm text-black/70 mb-3 line-clamp-2 font-sans">
                        {workflow.description || 'No description provided'}
                      </p>
                      <div className="flex items-center gap-2">
                        <div className="bg-[#434E78]/10 text-black px-2.5 py-1 rounded-azure-sm text-xs font-medium font-sans">
                          {workflow.teamName || 'Unassigned'}
                        </div>
                        {workflow.stages && (
                          <div className="text-xs text-black/60 font-sans">
                            {workflow.stages.length} {workflow.stages.length === 1 ? 'stage' : 'stages'}
                          </div>
                        )}
                      </div>
                    </div>
                  );
                })}
              </div>
            )}
          </div>

          {/* Top Teams by Workflows */}
          <div className="bg-white rounded-azure-sm shadow-azure-md p-6 border border-[#434E78]/20">
            <div className="flex items-center justify-between mb-6 pb-4 border-b border-[#434E78]/20">
              <h2 className="text-xl font-semibold text-black font-sans">Top Teams</h2>
              <FiUsers className="text-[#434E78]/60 text-lg" />
            </div>
            {workflowsByTeam.length === 0 ? (
              <div className="text-center py-8">
                <p className="text-black/60 text-sm font-sans">No team data available</p>
              </div>
            ) : (
              <div className="space-y-3">
                {workflowsByTeam.map((team, index) => (
                  <div
                    key={team.teamName}
                    className="flex items-center justify-between p-3 bg-[#434E78]/5 rounded-azure-sm border border-[#434E78]/20 hover:border-[#434E78]/40 hover:shadow-azure-sm transition-all duration-200"
                  >
                    <div className="flex items-center gap-3">
                      <div className="w-8 h-8 rounded-azure-sm flex items-center justify-center font-semibold text-white bg-[#434E78] text-xs font-sans">
                        {index + 1}
                      </div>
                      <div>
                        <p className="font-semibold text-black text-sm font-sans">{team.teamName}</p>
                        <p className="text-xs text-black/70 font-sans">{team.count} {team.count === 1 ? 'workflow' : 'workflows'}</p>
                      </div>
                    </div>
                    <div className="w-16 bg-[#434E78]/20 rounded-full h-1.5">
                      <div
                        className="bg-[#434E78] h-1.5 rounded-full transition-all duration-300"
                        style={{ width: `${(team.count / Math.max(...workflowsByTeam.map(t => t.count), 1)) * 100}%` }}
                      ></div>
                    </div>
                  </div>
                ))}
              </div>
            )}
          </div>
        </div>

        {/* Quick Stats */}
        <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
          <div className="group relative bg-white rounded-azure-sm shadow-azure-md border border-[#434E78]/20 p-6 hover:shadow-azure-lg transition-all duration-200 overflow-hidden">
            <div className="flex items-center justify-between mb-4">
              <div className="bg-[#434E78]/10 p-2.5 rounded-azure-sm">
                <FiLayers className="text-[#434E78] text-2xl" />
              </div>
              <span className="text-4xl font-semibold text-black font-sans">{totalStages}</span>
            </div>
              <p className="text-black font-semibold text-base font-sans">Total Stages</p>
              <p className="text-black/60 text-xs mt-1 font-sans">{avgStagesPerWorkflow} average per workflow</p>
          </div>
          <div className="group relative bg-white rounded-azure-sm shadow-azure-md border border-[#434E78]/20 p-6 hover:shadow-azure-lg transition-all duration-200 overflow-hidden">
            <div className="flex items-center justify-between mb-4">
              <div className="bg-[#434E78]/10 p-2.5 rounded-azure-sm">
                <FiUsers className="text-[#434E78] text-2xl" />
              </div>
              <span className="text-4xl font-semibold text-black font-sans">{teams.length}</span>
            </div>
            <p className="text-black font-semibold text-base font-sans">Active Teams</p>
            <p className="text-black/60 text-xs mt-1 font-sans">{members.length} total members</p>
          </div>
          <div className="group relative bg-white rounded-azure-sm shadow-azure-md border border-[#434E78]/20 p-6 hover:shadow-azure-lg transition-all duration-200 overflow-hidden">
            <div className="flex items-center justify-between mb-4">
              <div className="bg-[#434E78]/10 p-2.5 rounded-azure-sm">
                <FiCalendar className="text-[#434E78] text-2xl" />
              </div>
              <span className="text-4xl font-semibold text-black font-sans">{workflows.length}</span>
            </div>
            <p className="text-black font-semibold text-base font-sans">Workflows</p>
            <p className="text-black/60 text-xs mt-1 font-sans">All active workflows</p>
          </div>
        </div>
      </div>
    </div>
  );
};

export default Dashboard;

