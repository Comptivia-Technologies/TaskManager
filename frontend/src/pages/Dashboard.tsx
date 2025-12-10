import { useTeams } from '../hooks/useTeams';
import { useMembers } from '../hooks/useMembers';
import { useWorkflows } from '../hooks/useWorkflows';
import LoadingSpinner from '../components/LoadingSpinner';
import { FiUsers, FiUser, FiLayers, FiCheckCircle, FiClock, FiTrendingUp, FiActivity, FiArrowRight } from 'react-icons/fi';
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
  const totalTasks = workflows.reduce((sum, w) => sum + (w.tasks?.length || 0), 0);
  const totalStages = workflows.reduce((sum, w) => sum + (w.stages?.length || 0), 0);
  const completedTasks = workflows.reduce((sum, w) => sum + (w.tasks?.filter(t => t.status === 'Completed').length || 0), 0);
  const inProgressTasks = workflows.reduce((sum, w) => sum + (w.tasks?.filter(t => t.status === 'In Progress').length || 0), 0);
  const pendingTasks = workflows.reduce((sum, w) => sum + (w.tasks?.filter(t => t.status === 'Pending').length || 0), 0);
  const completionRate = totalTasks > 0 ? Math.round((completedTasks / totalTasks) * 100) : 0;

  // Get recent workflows
  const recentWorkflows = [...workflows]
    .sort((a, b) => new Date(b.createdAt).getTime() - new Date(a.createdAt).getTime())
    .slice(0, 5);

  // Get tasks by priority
  const highPriorityTasks = workflows.reduce((sum, w) => sum + (w.tasks?.filter(t => t.priority === 'High').length || 0), 0);
  const mediumPriorityTasks = workflows.reduce((sum, w) => sum + (w.tasks?.filter(t => t.priority === 'Medium').length || 0), 0);
  const lowPriorityTasks = workflows.reduce((sum, w) => sum + (w.tasks?.filter(t => t.priority === 'Low').length || 0), 0);

  const stats = [
    {
      label: 'Total Teams',
      value: teams.length,
      icon: FiUsers,
      gradient: 'from-blue-500 to-blue-600',
      bgColor: 'bg-blue-50',
      iconColor: 'text-blue-600',
      change: '+0',
    },
    {
      label: 'Team Members',
      value: members.length,
      icon: FiUser,
      gradient: 'from-green-500 to-green-600',
      bgColor: 'bg-green-50',
      iconColor: 'text-green-600',
      change: '+0',
    },
    {
      label: 'Active Workflows',
      value: workflows.length,
      icon: FiLayers,
      gradient: 'from-purple-500 to-purple-600',
      bgColor: 'bg-purple-50',
      iconColor: 'text-purple-600',
      change: '+0',
    },
    {
      label: 'Total Tasks',
      value: totalTasks,
      icon: FiActivity,
      gradient: 'from-orange-500 to-orange-600',
      bgColor: 'bg-orange-50',
      iconColor: 'text-orange-600',
      change: `${completionRate}% completed`,
    },
  ];

  return (
    <div className="p-8 bg-gradient-to-br from-gray-50 to-gray-100 min-h-screen">
      <div className="max-w-7xl mx-auto">
        {/* Header */}
        <div className="mb-8">
          <h1 className="text-4xl font-bold text-gray-900 mb-2">Dashboard</h1>
          <p className="text-gray-600">Welcome back! Here's what's happening with your workflows.</p>
        </div>

        {/* Stats Grid */}
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-6 mb-8">
          {stats.map((stat) => {
            const Icon = stat.icon;
            return (
              <div
                key={stat.label}
                className="bg-white rounded-xl shadow-lg hover:shadow-xl transition-all duration-300 overflow-hidden border border-gray-100"
              >
                <div className="p-6">
                  <div className="flex items-center justify-between mb-4">
                    <div className={`${stat.bgColor} p-3 rounded-lg`}>
                      <Icon className={`${stat.iconColor} text-2xl`} />
                    </div>
                    <div className={`bg-gradient-to-r ${stat.gradient} text-white text-xs font-semibold px-2 py-1 rounded-full`}>
                      {stat.change}
                    </div>
                  </div>
                  <div>
                    <p className="text-gray-500 text-sm font-medium mb-1">{stat.label}</p>
                    <p className="text-3xl font-bold text-gray-900">{stat.value.toLocaleString()}</p>
                  </div>
                </div>
                <div className={`h-1 bg-gradient-to-r ${stat.gradient}`}></div>
              </div>
            );
          })}
        </div>

        <div className="grid grid-cols-1 lg:grid-cols-3 gap-6 mb-8">
          {/* Task Status Overview */}
          <div className="lg:col-span-2 bg-white rounded-xl shadow-lg p-6 border border-gray-100">
            <div className="flex items-center justify-between mb-6">
              <h2 className="text-2xl font-bold text-gray-900">Task Status Overview</h2>
              <FiActivity className="text-gray-400 text-xl" />
            </div>
            <div className="space-y-4">
              <div>
                <div className="flex items-center justify-between mb-2">
                  <div className="flex items-center">
                    <FiCheckCircle className="text-green-500 mr-2" />
                    <span className="text-sm font-medium text-gray-700">Completed</span>
                  </div>
                  <span className="text-sm font-bold text-gray-900">{completedTasks}</span>
                </div>
                <div className="w-full bg-gray-200 rounded-full h-3">
                  <div
                    className="bg-gradient-to-r from-green-500 to-green-600 h-3 rounded-full transition-all duration-500"
                    style={{ width: `${totalTasks > 0 ? (completedTasks / totalTasks) * 100 : 0}%` }}
                  ></div>
                </div>
              </div>
              <div>
                <div className="flex items-center justify-between mb-2">
                  <div className="flex items-center">
                    <FiClock className="text-blue-500 mr-2" />
                    <span className="text-sm font-medium text-gray-700">In Progress</span>
                  </div>
                  <span className="text-sm font-bold text-gray-900">{inProgressTasks}</span>
                </div>
                <div className="w-full bg-gray-200 rounded-full h-3">
                  <div
                    className="bg-gradient-to-r from-blue-500 to-blue-600 h-3 rounded-full transition-all duration-500"
                    style={{ width: `${totalTasks > 0 ? (inProgressTasks / totalTasks) * 100 : 0}%` }}
                  ></div>
                </div>
              </div>
              <div>
                <div className="flex items-center justify-between mb-2">
                  <div className="flex items-center">
                    <FiClock className="text-gray-400 mr-2" />
                    <span className="text-sm font-medium text-gray-700">Pending</span>
                  </div>
                  <span className="text-sm font-bold text-gray-900">{pendingTasks}</span>
                </div>
                <div className="w-full bg-gray-200 rounded-full h-3">
                  <div
                    className="bg-gradient-to-r from-gray-400 to-gray-500 h-3 rounded-full transition-all duration-500"
                    style={{ width: `${totalTasks > 0 ? (pendingTasks / totalTasks) * 100 : 0}%` }}
                  ></div>
                </div>
              </div>
            </div>
            <div className="mt-6 pt-6 border-t border-gray-200">
              <div className="flex items-center justify-between">
                <span className="text-sm text-gray-600">Completion Rate</span>
                <span className="text-2xl font-bold text-gray-900">{completionRate}%</span>
              </div>
            </div>
          </div>

          {/* Task Priority Breakdown */}
          <div className="bg-white rounded-xl shadow-lg p-6 border border-gray-100">
            <h2 className="text-2xl font-bold text-gray-900 mb-6">Task Priority</h2>
            <div className="space-y-4">
              <div className="flex items-center justify-between p-4 bg-red-50 rounded-lg border-l-4 border-red-500">
                <div>
                  <p className="text-sm font-medium text-gray-700">High Priority</p>
                  <p className="text-2xl font-bold text-red-600">{highPriorityTasks}</p>
                </div>
                <div className="bg-red-100 rounded-full p-3">
                  <FiTrendingUp className="text-red-600 text-xl" />
                </div>
              </div>
              <div className="flex items-center justify-between p-4 bg-yellow-50 rounded-lg border-l-4 border-yellow-500">
                <div>
                  <p className="text-sm font-medium text-gray-700">Medium Priority</p>
                  <p className="text-2xl font-bold text-yellow-600">{mediumPriorityTasks}</p>
                </div>
                <div className="bg-yellow-100 rounded-full p-3">
                  <FiActivity className="text-yellow-600 text-xl" />
                </div>
              </div>
              <div className="flex items-center justify-between p-4 bg-green-50 rounded-lg border-l-4 border-green-500">
                <div>
                  <p className="text-sm font-medium text-gray-700">Low Priority</p>
                  <p className="text-2xl font-bold text-green-600">{lowPriorityTasks}</p>
                </div>
                <div className="bg-green-100 rounded-full p-3">
                  <FiCheckCircle className="text-green-600 text-xl" />
                </div>
              </div>
            </div>
          </div>
        </div>

        {/* Recent Workflows */}
        <div className="bg-white rounded-xl shadow-lg p-6 border border-gray-100">
          <div className="flex items-center justify-between mb-6">
            <h2 className="text-2xl font-bold text-gray-900">Recent Workflows</h2>
            <button
              onClick={() => navigate('/workflows')}
              className="text-blue-600 hover:text-blue-700 font-medium flex items-center"
            >
              View All
              <FiArrowRight className="ml-1" />
            </button>
          </div>
          {recentWorkflows.length === 0 ? (
            <div className="text-center py-12">
              <FiLayers className="text-gray-300 text-5xl mx-auto mb-4" />
              <p className="text-gray-500">No workflows yet. Create your first workflow to get started.</p>
            </div>
          ) : (
            <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
              {recentWorkflows.map((workflow) => (
                <div
                  key={workflow.workflowId}
                  onClick={() => navigate(`/workflows/${workflow.workflowId}`)}
                  className="p-4 border border-gray-200 rounded-lg hover:border-blue-300 hover:shadow-md transition-all cursor-pointer group"
                >
                  <div className="flex items-start justify-between mb-3">
                    <h3 className="font-bold text-gray-900 group-hover:text-blue-600 transition-colors">
                      {workflow.workflowName}
                    </h3>
                    <FiArrowRight className="text-gray-400 group-hover:text-blue-600 transition-colors" />
                  </div>
                  <p className="text-sm text-gray-600 mb-3 line-clamp-2">
                    {workflow.description || 'No description'}
                  </p>
                  <div className="flex items-center justify-between text-xs text-gray-500">
                    <span>{workflow.teamName}</span>
                    <span>{workflow.tasks?.length || 0} tasks</span>
                  </div>
                </div>
              ))}
            </div>
          )}
        </div>

        {/* Quick Stats */}
        <div className="grid grid-cols-1 md:grid-cols-3 gap-6 mt-8">
          <div className="bg-gradient-to-br from-blue-500 to-blue-600 rounded-xl shadow-lg p-6 text-white">
            <div className="flex items-center justify-between mb-4">
              <FiLayers className="text-3xl opacity-80" />
              <span className="text-4xl font-bold">{totalStages}</span>
            </div>
            <p className="text-blue-100 font-medium">Total Stages</p>
          </div>
          <div className="bg-gradient-to-br from-purple-500 to-purple-600 rounded-xl shadow-lg p-6 text-white">
            <div className="flex items-center justify-between mb-4">
              <FiUsers className="text-3xl opacity-80" />
              <span className="text-4xl font-bold">{teams.length}</span>
            </div>
            <p className="text-purple-100 font-medium">Active Teams</p>
          </div>
          <div className="bg-gradient-to-br from-green-500 to-green-600 rounded-xl shadow-lg p-6 text-white">
            <div className="flex items-center justify-between mb-4">
              <FiCheckCircle className="text-3xl opacity-80" />
              <span className="text-4xl font-bold">{completionRate}%</span>
            </div>
            <p className="text-green-100 font-medium">Completion Rate</p>
          </div>
        </div>
      </div>
    </div>
  );
};

export default Dashboard;

