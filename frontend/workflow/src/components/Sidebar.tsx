import { useState } from 'react';
import { Link, useLocation, useNavigate } from 'react-router-dom';
import { FiLayers, FiUsers, FiUser, FiUserCheck, FiClock, FiActivity, FiCheckSquare, FiSettings, FiLogOut, FiChevronDown, FiChevronRight } from 'react-icons/fi';
import { useAuth } from '../contexts/AuthContext';

type MenuLink = { path: string; label: string; icon: React.ComponentType<{ className?: string }> };
type MenuGroup = {
  label: string;
  icon: React.ComponentType<{ className?: string }>;
  children: { path: string; label: string }[];
};
type MenuItem = MenuLink | MenuGroup;

const isGroup = (item: MenuItem): item is MenuGroup => 'children' in item;

const Sidebar = () => {
  const location = useLocation();
  const navigate = useNavigate();
  const { signOut, user } = useAuth();
  const [expandedGroup, setExpandedGroup] = useState<string | null>(null);

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

  const menuItems: MenuItem[] = [
    { path: '/workflows', label: 'Workflows', icon: FiLayers },
    { path: '/tasks', label: 'Tasks', icon: FiCheckSquare },
    { path: '/teams', label: 'Teams', icon: FiUsers },
    { path: '/members', label: 'Members', icon: FiUser },
    { path: '/sla-configuration', label: 'SLA Configuration', icon: FiClock },
    { path: '/workload-configuration', label: 'Workload Configuration', icon: FiActivity },
    { path: '/priority-rules', label: 'Priority Rules', icon: FiSettings },
    {
      label: 'User Management',
      icon: FiUserCheck,
      children: [
        { path: '/users', label: 'Users' },
        { path: '/roles-permissions', label: 'Roles & Permissions' },
      ],
    },
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
          if (isGroup(item)) {
            const Icon = item.icon;
            const isExpanded = expandedGroup === item.label;
            const hasActiveChild = item.children.some((c) => isActive(c.path));
            return (
              <div key={item.label} className="mb-1">
                <button
                  type="button"
                  onClick={() =>
                    setExpandedGroup(isExpanded ? null : item.label)
                  }
                  className={`w-full flex items-center px-4 py-3 rounded-azure-sm transition-all duration-150 text-left ${
                    hasActiveChild
                      ? 'bg-white/20 text-white shadow-azure-sm'
                      : 'text-white/80 hover:bg-white/10 hover:text-white'
                  }`}
                >
                  <Icon className={`mr-3 text-lg ${hasActiveChild ? 'text-white' : 'text-white/70'}`} />
                  <span className="font-medium text-sm flex-1">{item.label}</span>
                  {isExpanded ? (
                    <FiChevronDown className="text-lg text-white/70" />
                  ) : (
                    <FiChevronRight className="text-lg text-white/70" />
                  )}
                </button>
                {isExpanded && (
                  <div className="ml-4 mt-1 pl-4 border-l border-white/20 space-y-0.5">
                    {item.children.map((child) => {
                      const active = isActive(child.path);
                      return (
                        <Link
                          key={child.path}
                          to={child.path}
                          className={`flex items-center px-3 py-2 rounded-azure-sm transition-all duration-150 text-sm ${
                            active
                              ? 'bg-white/20 text-white'
                              : 'text-white/80 hover:bg-white/10 hover:text-white'
                          }`}
                        >
                          <span className="font-medium">{child.label}</span>
                          {active && (
                            <div className="ml-auto w-1 h-4 bg-white rounded-full" />
                          )}
                        </Link>
                      );
                    })}
                  </div>
                )}
              </div>
            );
          }
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

