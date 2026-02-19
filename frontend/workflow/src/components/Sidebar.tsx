import { Link, useLocation, useNavigate } from 'react-router-dom';
import { FiLayers, FiUsers, FiUser, FiClock, FiActivity, FiCheckSquare, FiSettings, FiLogOut } from 'react-icons/fi';
import { useAuth } from '../contexts/AuthContext';

const Sidebar = () => {
  const location = useLocation();
  const navigate = useNavigate();
  const { signOut, user } = useAuth();

  const isActive = (path: string) => {
    return location.pathname === path;
  };

  const handleSignOut = async () => {
    try {
      await signOut();
      navigate('/login');
    } catch (error) {
      console.error('Error signing out:', error);
    }
  };

  const menuItems = [
    { path: '/workflows', label: 'Workflows', icon: FiLayers },
    { path: '/tasks', label: 'Tasks', icon: FiCheckSquare },
    { path: '/teams', label: 'Teams', icon: FiUsers },
    { path: '/members', label: 'Members', icon: FiUser },
    { path: '/sla-configuration', label: 'SLA Configuration', icon: FiClock },
    { path: '/workload-configuration', label: 'Workload Configuration', icon: FiActivity },
    { path: '/priority-rules', label: 'Priority Rules', icon: FiSettings },
  ];

  return (
    <div className="fixed left-0 top-0 h-full w-64 bg-[#434E78] text-white shadow-azure-lg z-40 flex flex-col">
      <div className="p-6 border-b border-white/20">
        <div className="flex items-center gap-3">
          <div className="w-10 h-10 bg-white/20 rounded-azure-sm flex items-center justify-center">
            <FiLayers className="text-xl text-white" />
          </div>
          <div>
            <h1 className="text-lg font-semibold text-white leading-tight">Workflow</h1>
            <p className="text-xs text-white/80 leading-tight">Management</p>
          </div>
        </div>
      </div>
      <nav className="mt-2 px-2 py-4 flex-1">
        {menuItems.map((item) => {
          const Icon = item.icon;
          const active = isActive(item.path);
          return (
            <Link
              key={item.path}
              to={item.path}
              className={`flex items-center px-4 py-3 mb-1 rounded-azure-sm transition-all duration-150 ${
                active
                  ? 'bg-white/20 text-white shadow-azure-sm'
                  : 'text-white/80 hover:bg-white/10 hover:text-white'
              }`}
            >
              <Icon className={`mr-3 text-lg ${active ? 'text-white' : 'text-white/70'}`} />
              <span className="font-medium text-sm">{item.label}</span>
              {active && (
                <div className="ml-auto w-1 h-6 bg-white rounded-full"></div>
              )}
            </Link>
          );
        })}
      </nav>
      <div className="border-t border-white/20 p-4">
        {user && (
          <button
            onClick={handleSignOut}
            className="w-full flex items-center px-4 py-3 rounded-azure-sm transition-all duration-150 text-white/80 hover:bg-white/10 hover:text-white"
          >
            <FiLogOut className="mr-3 text-lg text-white/70" />
            <span className="font-medium text-sm">Sign Out</span>
          </button>
        )}
      </div>
    </div>
  );
};

export default Sidebar;

