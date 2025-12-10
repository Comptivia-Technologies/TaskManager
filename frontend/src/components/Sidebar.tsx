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
    <div className="fixed left-0 top-0 h-full w-64 bg-gray-800 text-white shadow-lg font-sans">
      <div className="p-6">
        <h1 className="text-2xl font-bold font-sans">Workflow Manager</h1>
      </div>
      <nav className="mt-8">
        {menuItems.map((item) => {
          const Icon = item.icon;
          return (
            <Link
              key={item.path}
              to={item.path}
              className={`flex items-center px-6 py-3 transition-colors font-sans ${
                isActive(item.path)
                  ? 'bg-gray-700 border-l-4 border-blue-500'
                  : 'hover:bg-gray-700'
              }`}
            >
              <Icon className="mr-3 text-xl" />
              <span className="font-sans">{item.label}</span>
            </Link>
          );
        })}
      </nav>
    </div>
  );
};

export default Sidebar;

