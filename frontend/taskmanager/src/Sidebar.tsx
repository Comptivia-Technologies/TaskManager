import { useLocation, useNavigate } from 'react-router-dom';

const Sidebar = () => {
  const location = useLocation();
  const navigate = useNavigate();

  const isActive = (path: string) => location.pathname === path;

  const menuItems = [{ path: '/', label: 'Dashboard' }];

  return (
    <aside className="tm-sidebar">
      <div className="tm-sidebar-header">
        <div className="tm-sidebar-logo">
          <span className="tm-sidebar-logo-icon">TM</span>
        </div>
        <div>
          <h1 className="tm-sidebar-title">Task</h1>
          <p className="tm-sidebar-subtitle">Manager</p>
        </div>
      </div>

      <nav className="tm-sidebar-nav">
        {menuItems.map((item) => {
          const active = isActive(item.path);
          return (
            <button
              key={item.path}
              type="button"
              className={
                'tm-sidebar-link' + (active ? ' tm-sidebar-link-active' : '')
              }
              onClick={() => navigate(item.path)}
            >
              <span className="tm-sidebar-link-label">{item.label}</span>
              {active && <span className="tm-sidebar-link-indicator" />}
            </button>
          );
        })}
      </nav>

      <div className="tm-sidebar-footer">
        <p className="tm-sidebar-footer-title">Task Manager</p>
        <p className="tm-sidebar-footer-version">v1.0.0</p>
      </div>
    </aside>
  );
};

export default Sidebar;


