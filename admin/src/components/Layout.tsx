import React, { useState } from 'react';
import { Outlet, useLocation } from 'react-router-dom';
import { Bars3Icon, BellIcon } from '@heroicons/react/24/outline';
import Sidebar from './Sidebar';

const pageTitles: Record<string, string> = {
  '/': 'Dashboard',
  '/users': 'Users',
  '/parkings': 'Parkings',
  '/map': 'Parking Map',
  '/notifications': 'Notifications',
  '/revenue': 'Revenue',
  '/settings': 'App Settings',
  '/logs': 'Audit Logs',
};

export default function Layout() {
  const [sidebarOpen, setSidebarOpen] = useState(false);
  const location = useLocation();

  const title =
    Object.entries(pageTitles).find(([key]) => {
      if (key === '/') return location.pathname === '/';
      return location.pathname.startsWith(key);
    })?.[1] ?? 'ParkMark Admin';

  return (
    <div className="flex h-screen bg-bg-deep overflow-hidden">
      <Sidebar open={sidebarOpen} onClose={() => setSidebarOpen(false)} />

      <div className="flex-1 flex flex-col overflow-hidden">
        {/* Top header */}
        <header className="h-16 bg-bg-card border-b border-white/10 flex items-center px-4 lg:px-6 gap-4 flex-shrink-0">
          <button
            onClick={() => setSidebarOpen(true)}
            className="lg:hidden p-2 rounded-lg hover:bg-white/5 text-text-secondary hover:text-text-primary"
          >
            <Bars3Icon className="w-5 h-5" />
          </button>

          <h1 className="text-lg font-semibold text-text-primary flex-1">{title}</h1>

          <div className="flex items-center gap-3">
            <div className="flex items-center gap-2 px-3 py-1.5 rounded-lg bg-success/10 border border-success/20">
              <span className="w-2 h-2 rounded-full bg-success animate-pulse" />
              <span className="text-xs text-success font-medium">Live</span>
            </div>
            <button className="p-2 rounded-lg hover:bg-white/5 text-text-secondary hover:text-text-primary relative">
              <BellIcon className="w-5 h-5" />
            </button>
          </div>
        </header>

        {/* Page content */}
        <main className="flex-1 overflow-y-auto scrollbar-thin p-4 lg:p-6">
          <Outlet />
        </main>
      </div>
    </div>
  );
}
