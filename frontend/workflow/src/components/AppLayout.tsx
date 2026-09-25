import { ReactNode, useEffect, useMemo, useState } from 'react';
import { useLocation, useNavigate } from 'react-router-dom';
import { AnimatePresence, m, useReducedMotion } from 'framer-motion';
import { FiMenu, FiSearch, FiX } from 'react-icons/fi';
import Sidebar from './Sidebar';
import CommandPalette, { CommandItem } from './CommandPalette';
import BrandMark from './BrandMark';
import { useAuth } from '../contexts/AuthContext';
import { hasPermission } from '../utils/roleUtils';
import { visibleDestinations } from '../utils/navigation';
import {
  backdropVariants,
  drawerVariants,
  instant,
  pageVariants,
  panelTransition,
} from '../utils/motion';

/**
 * The application shell: the navigation, the landmarks, the responsive behaviour,
 * the page container and the page transition all live here.
 *
 * Below `lg` the sidebar becomes an off-canvas drawer; from `lg` up it is permanent.
 * Search lives inside the sidebar rather than floating over the page, where it
 * used to sit on top of each screen's primary action.
 */
const AppLayout = ({ children }: { children: ReactNode }) => {
  const [navOpen, setNavOpen] = useState(false);
  const [paletteOpen, setPaletteOpen] = useState(false);
  const location = useLocation();
  const navigate = useNavigate();
  const { permissions } = useAuth();
  const reduceMotion = useReducedMotion();
  const transition = reduceMotion ? instant : panelTransition;

  // Only what this session can actually reach — the palette must not advertise a
  // screen that would then refuse to load.
  const commands = useMemo<CommandItem[]>(
    () =>
      visibleDestinations(permissions, hasPermission).map((d) => ({
        id: d.path,
        label: d.label,
        hint: d.group,
        keywords: d.keywords,
        icon: d.icon,
      })),
    [permissions]
  );

  useEffect(() => {
    const onKey = (event: KeyboardEvent) => {
      if (event.key?.toLowerCase() !== 'k' || !(event.metaKey || event.ctrlKey)) return;
      event.preventDefault();
      setPaletteOpen((wasOpen) => !wasOpen);
    };
    document.addEventListener('keydown', onKey);
    return () => document.removeEventListener('keydown', onKey);
  }, []);

  // A drawer that survives navigation would cover the page you just asked for.
  useEffect(() => {
    setNavOpen(false);
    setPaletteOpen(false);
  }, [location.pathname]);

  useEffect(() => {
    if (!navOpen) return undefined;
    const onKey = (e: KeyboardEvent) => e.key === 'Escape' && setNavOpen(false);
    document.addEventListener('keydown', onKey);
    return () => document.removeEventListener('keydown', onKey);
  }, [navOpen]);

  const openSearch = () => setPaletteOpen(true);

  return (
    <div className="min-h-screen bg-canvas font-sans">
      <a href="#main-content" className="skip-link">
        Skip to content
      </a>

      {/* Mobile bar. Hidden once the sidebar is permanent. */}
      <div className="lg:hidden sticky top-0 z-30 flex items-center gap-2 h-14 px-3 bg-shell text-white">
        <button
          type="button"
          onClick={() => setNavOpen(true)}
          aria-label="Open navigation"
          aria-expanded={navOpen}
          className="h-10 w-10 inline-flex items-center justify-center rounded-control hover:bg-white/10 cursor-pointer"
        >
          <FiMenu className="text-xl" aria-hidden="true" />
        </button>
        <BrandMark size={26} />
        <span className="font-semibold tracking-tight">Workflow</span>
        <button
          type="button"
          onClick={openSearch}
          aria-label="Search screens and actions"
          className="ml-auto h-10 w-10 inline-flex items-center justify-center rounded-control hover:bg-white/10 cursor-pointer"
        >
          <FiSearch className="text-lg" aria-hidden="true" />
        </button>
      </div>

      <AnimatePresence>
        {navOpen && (
          <m.button
            key="nav-backdrop"
            type="button"
            aria-label="Close navigation"
            onClick={() => setNavOpen(false)}
            variants={backdropVariants}
            initial="initial"
            animate="animate"
            exit="exit"
            transition={transition}
            className="lg:hidden fixed inset-0 z-40 bg-[#0B0E1C]/50 cursor-default"
          />
        )}
      </AnimatePresence>

      {/* Permanent from lg up, so it is never animated there. */}
      <div className="hidden lg:block fixed inset-y-0 left-0 z-40 w-64">
        <Sidebar onSearch={openSearch} />
      </div>

      <AnimatePresence>
        {navOpen && (
          <m.div
            key="nav-drawer"
            variants={drawerVariants}
            initial="initial"
            animate="animate"
            exit="exit"
            transition={transition}
            className="lg:hidden fixed inset-y-0 left-0 z-50 w-64 shadow-azure-xl"
          >
            <button
              type="button"
              onClick={() => setNavOpen(false)}
              aria-label="Close navigation"
              className="absolute top-4 right-3 z-10 h-8 w-8 inline-flex items-center justify-center
                text-white/70 hover:text-white hover:bg-white/10 rounded-control cursor-pointer"
            >
              <FiX className="text-lg" aria-hidden="true" />
            </button>
            <Sidebar onSearch={openSearch} />
          </m.div>
        )}
      </AnimatePresence>

      <main id="main-content" tabIndex={-1} className="lg:ml-64 outline-none">
        {/* Keyed on the path so each screen fades through rather than snapping. */}
        <AnimatePresence mode="wait" initial={false}>
          <m.div
            key={location.pathname}
            variants={pageVariants}
            initial="initial"
            animate="animate"
            exit="exit"
            transition={reduceMotion ? instant : { duration: 0.18, ease: [0.4, 0, 0.2, 1] }}
            className="mx-auto w-full max-w-page px-4 sm:px-6 lg:px-10 py-6 lg:py-8"
          >
            {children}
          </m.div>
        </AnimatePresence>
      </main>

      <CommandPalette
        open={paletteOpen}
        items={commands}
        onSelect={(item) => {
          setPaletteOpen(false);
          navigate(item.id);
        }}
        onDismiss={() => setPaletteOpen(false)}
      />
    </div>
  );
};

export default AppLayout;
