import { Link, useLocation, useNavigate } from 'react-router-dom';
import { FiCommand, FiLogOut, FiSearch } from 'react-icons/fi';
import { useAuth } from '../contexts/AuthContext';
import { hasPermission } from '../utils/roleUtils';
import { NAV_GROUPS, visibleDestinations } from '../utils/navigation';
import BrandMark from './BrandMark';
import Avatar from './Avatar';

const isMac = typeof navigator !== 'undefined' && /Mac|iPhone|iPad/.test(navigator.platform);

interface SidebarProps {
  /** Opens the command palette. Omitted where there is no palette to open. */
  onSearch?: () => void;
}

/**
 * The navigation shell: product mark, search, the areas this role can reach —
 * grouped by what a person is doing there — and who is signed in.
 */
const Sidebar = ({ onSearch }: SidebarProps) => {
  const location = useLocation();
  const navigate = useNavigate();
  const { signOut, user, permissions, currentMember } = useAuth();

  const isActive = (path: string) => location.pathname === path || location.pathname.startsWith(`${path}/`);

  const handleSignOut = async () => {
    try {
      await signOut();
      navigate('/login');
    } catch (error) {
      console.error('Error signing out:', error);
    }
  };

  const destinations = visibleDestinations(permissions, hasPermission);
  const displayName = currentMember
    ? `${currentMember.firstName} ${currentMember.lastName}`.trim()
    : user?.email ?? '';
  // Without a linked member the email is already the name line, so nothing goes under it.
  const secondary = currentMember ? currentMember.teamName || currentMember.role : undefined;

  return (
    <div className="h-full w-64 bg-shell text-shell-text flex flex-col">
      <div className="h-16 px-5 flex items-center gap-3 shrink-0">
        <BrandMark size={30} />
        <div className="leading-tight min-w-0">
          <p className="text-[15px] font-semibold text-white tracking-tight">Workflow</p>
          <p className="text-meta text-shell-muted">Management</p>
        </div>
      </div>

      {onSearch && (
        <div className="px-3 pb-2">
          <button
            type="button"
            onClick={onSearch}
            className="w-full h-9 flex items-center gap-2.5 px-3 rounded-control bg-white/[0.06] ring-1 ring-inset ring-white/[0.08]
              text-shell-muted hover:text-white hover:bg-white/[0.09] cursor-pointer text-body"
          >
            <FiSearch aria-hidden="true" className="shrink-0" />
            <span className="flex-1 text-left">Search</span>
            <kbd className="font-mono text-[11px] text-shell-muted bg-white/[0.06] px-1.5 py-0.5 rounded inline-flex items-center gap-0.5">
              {isMac ? <FiCommand aria-hidden="true" /> : 'Ctrl'} K
            </kbd>
          </button>
        </div>
      )}

      <nav aria-label="Main" className="flex-1 overflow-y-auto scrollbar-none px-3 pb-4">
        {NAV_GROUPS.map((group) => {
          const items = destinations.filter((d) => d.group === group);
          if (items.length === 0) return null;
          return (
            <div key={group} className="mt-4 first:mt-2">
              {/* "Work" is the whole of it for most people, so it goes unlabelled. */}
              {group !== 'Work' && (
                <p className="px-3 mb-1 text-label font-semibold uppercase text-shell-muted/80">{group}</p>
              )}
              <ul className="space-y-0.5">
                {items.map((item) => {
                  const Icon = item.icon;
                  const active = isActive(item.path);
                  return (
                    <li key={item.path}>
                      <Link
                        to={item.path}
                        aria-current={active ? 'page' : undefined}
                        className={`relative flex items-center gap-3 h-9 px-3 rounded-control text-body font-medium ${
                          active
                            ? 'bg-white/[0.10] text-white'
                            : 'text-shell-text hover:bg-white/[0.05] hover:text-white'
                        }`}
                      >
                        {active && (
                          <span aria-hidden="true" className="absolute -left-3 top-1.5 bottom-1.5 w-[3px] rounded-r-full bg-[#8FE3B8]" />
                        )}
                        <Icon aria-hidden="true" className={`text-[17px] shrink-0 ${active ? 'text-white' : 'text-shell-muted'}`} />
                        <span className="truncate">{item.label}</span>
                      </Link>
                    </li>
                  );
                })}
              </ul>
            </div>
          );
        })}
      </nav>

      {user && (
        <div className="border-t border-shell-line p-3">
          <div className="flex items-center gap-3 px-2 py-1.5">
            <Avatar name={displayName} size="md" onDark />
            <div className="min-w-0 flex-1 leading-tight">
              <p className="text-body font-medium text-white truncate">{displayName}</p>
              {secondary && <p className="text-meta text-shell-muted truncate">{secondary}</p>}
            </div>
            <button
              type="button"
              onClick={handleSignOut}
              aria-label="Sign out"
              title="Sign out"
              className="h-8 w-8 shrink-0 inline-flex items-center justify-center rounded-control text-shell-muted
                hover:text-white hover:bg-white/[0.08] cursor-pointer"
            >
              <FiLogOut aria-hidden="true" />
            </button>
          </div>
        </div>
      )}
    </div>
  );
};

export default Sidebar;
