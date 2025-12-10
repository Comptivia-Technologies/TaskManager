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
      iconBg: 'bg-blue-100',
      iconColor: 'text-blue-600',
      borderColor: 'bg-blue-500',
    },
    {
      label: 'Team Members',
      value: members.length,
      icon: FiUser,
      description: 'Total members',
      iconBg: 'bg-emerald-100',
      iconColor: 'text-emerald-600',
      borderColor: 'bg-emerald-500',
    },
    {
      label: 'Active Workflows',
      value: workflows.length,
      icon: FiLayers,
      description: 'In progress',
      iconBg: 'bg-purple-100',
      iconColor: 'text-purple-600',
      borderColor: 'bg-purple-500',
    },
    {
      label: 'Total Stages',
      value: totalStages,
      icon: FiTrendingUp,
      description: `${avgStagesPerWorkflow} avg per workflow`,
      iconBg: 'bg-amber-100',
      iconColor: 'text-amber-600',
      borderColor: 'bg-amber-500',
    },
  ];

  return (
    <div className="p-6 md:p-8 lg:p-10 bg-gradient-to-br from-gray-50 via-blue-50/30 to-indigo-50/30 min-h-screen font-sans">
      <div className="max-w-7xl mx-auto">
        {/* Header */}
        <div className="mb-10">
          <h1 className="text-5xl font-bold bg-gradient-to-r from-gray-900 via-blue-700 to-indigo-700 bg-clip-text text-transparent mb-3 font-sans">
            Dashboard
          </h1>
          <p className="text-gray-600 text-lg font-sans">Welcome back! Here's an overview of your workload management system.</p>
        </div>

        {/* Stats Grid */}
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-6 mb-10">
          {stats.map((stat, index) => {
            const Icon = stat.icon;
            return (
              <div
                key={stat.label}
                className="group relative bg-white rounded-xl shadow-sm hover:shadow-md transition-all duration-300 overflow-hidden border border-gray-200"
              >
                <div className="p-6">
                  <div className="flex items-center justify-between mb-5">
                    <div className={`${stat.iconBg} p-4 rounded-lg group-hover:scale-110 transition-transform duration-300`}>
                      <Icon className={`${stat.iconColor} text-3xl`} />
                    </div>
                    <div className="text-right">
                      <p className="text-gray-400 text-xs font-semibold uppercase tracking-wide font-sans">{stat.description}</p>
                    </div>
                  </div>
                  <div>
                    <p className="text-gray-500 text-sm font-semibold mb-2 tracking-wide font-sans">{stat.label}</p>
                    <p className="text-4xl font-bold text-gray-900 font-sans">
                      {stat.value.toLocaleString()}
                    </p>
                  </div>
                </div>
                <div className={`h-1.5 ${stat.borderColor}`}></div>
              </div>
            );
          })}
        </div>

        <div className="grid grid-cols-1 lg:grid-cols-3 gap-6 mb-10">
          {/* Recent Workflows */}
          <div className="lg:col-span-2 bg-white rounded-2xl shadow-lg p-6 md:p-8 border border-gray-100">
            <div className="flex items-center justify-between mb-6">
              <h2 className="text-2xl font-bold text-gray-900 font-sans">Recent Workflows</h2>
              <button
                onClick={() => navigate('/workflows')}
                className="text-blue-600 hover:text-blue-700 font-semibold flex items-center gap-2 transition-all hover:gap-3 font-sans"
              >
                View All
                <FiArrowRight className="text-lg" />
              </button>
            </div>
            {recentWorkflows.length === 0 ? (
              <div className="text-center py-16">
                <div className="bg-gradient-to-br from-purple-100 to-indigo-100 rounded-full w-24 h-24 flex items-center justify-center mx-auto mb-4">
                  <FiLayers className="text-purple-500 text-5xl" />
                </div>
                <p className="text-gray-500 text-lg font-sans">No workflows yet. Create your first workflow to get started.</p>
              </div>
            ) : (
              <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                {recentWorkflows.map((workflow, index) => {
                  const colors = [
                    { border: 'border-blue-200', hover: 'hover:border-blue-400', badge: 'bg-blue-100 text-blue-700' },
                    { border: 'border-emerald-200', hover: 'hover:border-emerald-400', badge: 'bg-emerald-100 text-emerald-700' },
                    { border: 'border-purple-200', hover: 'hover:border-purple-400', badge: 'bg-purple-100 text-purple-700' },
                    { border: 'border-amber-200', hover: 'hover:border-amber-400', badge: 'bg-amber-100 text-amber-700' },
                    { border: 'border-indigo-200', hover: 'hover:border-indigo-400', badge: 'bg-indigo-100 text-indigo-700' },
                    { border: 'border-pink-200', hover: 'hover:border-pink-400', badge: 'bg-pink-100 text-pink-700' },
                  ];
                  const colorScheme = colors[index % colors.length];
                  return (
                    <div
                      key={workflow.workflowId}
                      onClick={() => navigate(`/workflows/${workflow.workflowId}`)}
                      className={`group p-5 border-2 ${colorScheme.border} rounded-xl ${colorScheme.hover} hover:shadow-lg transition-all duration-300 cursor-pointer bg-white`}
                    >
                      <div className="flex items-start justify-between mb-3">
                        <h3 className="font-bold text-gray-900 group-hover:text-blue-600 transition-colors text-lg font-sans">
                          {workflow.workflowName}
                        </h3>
                        <FiArrowRight className="text-gray-400 group-hover:text-blue-600 group-hover:translate-x-1 transition-all duration-300 text-xl" />
                      </div>
                      <p className="text-sm text-gray-600 mb-4 line-clamp-2 font-sans">
                        {workflow.description || 'No description provided'}
                      </p>
                      <div className="flex items-center gap-2">
                        <div className={`${colorScheme.badge} px-3 py-1 rounded-full text-xs font-semibold font-sans`}>
                          {workflow.teamName || 'Unassigned'}
                        </div>
                        {workflow.stages && (
                          <div className="text-xs text-gray-500 font-sans">
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
          <div className="bg-white rounded-2xl shadow-lg p-6 md:p-8 border border-gray-100">
            <div className="flex items-center justify-between mb-6">
              <h2 className="text-2xl font-bold text-gray-900 font-sans">Top Teams</h2>
              <FiUsers className="text-gray-400 text-xl" />
            </div>
            {workflowsByTeam.length === 0 ? (
              <div className="text-center py-8">
                <p className="text-gray-500 text-sm font-sans">No team data available</p>
              </div>
            ) : (
              <div className="space-y-4">
                {workflowsByTeam.map((team, index) => (
                  <div
                    key={team.teamName}
                    className="flex items-center justify-between p-4 bg-white rounded-xl border border-gray-200 hover:border-gray-300 hover:shadow-sm transition-all duration-300"
                  >
                    <div className="flex items-center gap-3">
                      <div className={`w-10 h-10 rounded-full flex items-center justify-center font-bold text-white text-sm font-sans ${
                        index === 0 ? 'bg-gradient-to-br from-amber-400 to-amber-600' :
                        index === 1 ? 'bg-gradient-to-br from-gray-400 to-gray-600' :
                        'bg-gradient-to-br from-amber-600 to-amber-800'
                      }`}>
                        {index + 1}
                      </div>
                      <div>
                        <p className="font-semibold text-gray-900 font-sans">{team.teamName}</p>
                        <p className="text-xs text-gray-500 font-sans">{team.count} {team.count === 1 ? 'workflow' : 'workflows'}</p>
                      </div>
                    </div>
                    <div className="w-16 bg-gray-200 rounded-full h-2">
                      <div
                        className="bg-gradient-to-r from-blue-500 to-indigo-600 h-2 rounded-full transition-all duration-500"
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
        <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
          <div className="group relative bg-gradient-to-br from-blue-500 to-blue-600 rounded-xl shadow-lg border border-blue-400 p-6 md:p-8 hover:shadow-xl hover:scale-105 transition-all duration-300 text-white overflow-hidden">
            <div className="absolute top-0 right-0 w-32 h-32 bg-white opacity-10 rounded-full -mr-16 -mt-16"></div>
            <div className="relative z-10">
              <div className="flex items-center justify-between mb-4">
                <div className="bg-white bg-opacity-20 p-3 rounded-lg">
                  <FiLayers className="text-3xl" />
                </div>
                <span className="text-5xl font-bold font-sans">{totalStages}</span>
              </div>
              <p className="text-blue-100 font-semibold text-lg font-sans">Total Stages</p>
              <p className="text-blue-200 text-sm mt-1 font-sans">{avgStagesPerWorkflow} average per workflow</p>
            </div>
          </div>
          <div className="group relative bg-gradient-to-br from-purple-500 to-purple-600 rounded-xl shadow-lg border border-purple-400 p-6 md:p-8 hover:shadow-xl hover:scale-105 transition-all duration-300 text-white overflow-hidden">
            <div className="absolute top-0 right-0 w-32 h-32 bg-white opacity-10 rounded-full -mr-16 -mt-16"></div>
            <div className="relative z-10">
              <div className="flex items-center justify-between mb-4">
                <div className="bg-white bg-opacity-20 p-3 rounded-lg">
                  <FiUsers className="text-3xl" />
                </div>
                <span className="text-5xl font-bold font-sans">{teams.length}</span>
              </div>
              <p className="text-purple-100 font-semibold text-lg font-sans">Active Teams</p>
              <p className="text-purple-200 text-sm mt-1 font-sans">{members.length} total members</p>
            </div>
          </div>
          <div className="group relative bg-gradient-to-br from-indigo-500 to-indigo-600 rounded-xl shadow-lg border border-indigo-400 p-6 md:p-8 hover:shadow-xl hover:scale-105 transition-all duration-300 text-white overflow-hidden">
            <div className="absolute top-0 right-0 w-32 h-32 bg-white opacity-10 rounded-full -mr-16 -mt-16"></div>
            <div className="relative z-10">
              <div className="flex items-center justify-between mb-4">
                <div className="bg-white bg-opacity-20 p-3 rounded-lg">
                  <FiCalendar className="text-3xl" />
                </div>
                <span className="text-5xl font-bold font-sans">{workflows.length}</span>
              </div>
              <p className="text-indigo-100 font-semibold text-lg font-sans">Workflows</p>
              <p className="text-indigo-200 text-sm mt-1 font-sans">All active workflows</p>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
};

export default Dashboard;

