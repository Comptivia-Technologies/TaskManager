import { Link, useLocation } from 'react-router-dom';
import { FiHome, FiLayers, FiUsers, FiUser } from 'react-icons/fi';

const Sidebar = () => {
  const location = useLocation();

  const isActive = (path: string) => {
    return location.pathname === path;
  };

  const menuItems = [
    { path: '/', label: 'Dashboard', icon: FiHome },
    { path: '/workflows', label: 'Workflows', icon: FiLayers },
    { path: '/teams', label: 'Teams', icon: FiUsers },
    { path: '/members', label: 'Members', icon: FiUser },
  ];

  return (
    <div className="fixed left-0 top-0 h-full w-64 bg-[#434E78] text-white shadow-azure-lg z-40">
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
      <nav className="mt-2 px-2 py-4">
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
      <div className="absolute bottom-0 left-0 right-0 p-4 border-t border-white/20">
        <div className="text-xs text-white/60 text-center">
          <p className="font-medium">Workflow Manager</p>
          <p className="text-white/50 mt-1">v1.0.0</p>
        </div>
      </div>
    </div>
  );
};

export default Sidebar;

