import { ReactNode } from 'react';
import Sidebar from './Sidebar';

interface AppShellProps {
  children: ReactNode;
}

/**
 * Layout for authenticated pages: fixed sidebar + scrollable main (viewport width minus sidebar).
 */
const AppShell = ({ children }: AppShellProps) => (
  <div className="min-h-screen bg-white font-sans overflow-x-hidden">
    <Sidebar />
    <main className="ml-64 min-w-0 w-[calc(100vw-16rem)] max-w-[calc(100vw-16rem)] h-screen overflow-y-auto overflow-x-hidden bg-white font-sans">
      {children}
    </main>
  </div>
);

export default AppShell;
