'use client';

import { useState } from 'react';
import { usePathname, useRouter } from 'next/navigation';
import './globals.css';
import { Sidebar } from '../components/layout/sidebar';
import { Header } from '../components/layout/header';
import { CommandPalette } from '../components/command-palette';
import { useAppState } from '../lib/client/use-app-state';
import { api } from '../lib/client/api';

export default function RootLayout({ children }: { children: React.ReactNode }) {
  const [isCommandOpen, setIsCommandOpen] = useState(false);
  const pathname = usePathname();
  const router = useRouter();
  // Public routes render without the admin shell (no sidebar/header): the talk page (so it
  // fits a 375px phone screen) and the login gate (which has its own full-screen layout).
  const isPublicRoute = !!pathname && (pathname.startsWith('/talk/') || pathname === '/login');

  // The shell polls the server snapshot slowly so kill-switch / queue changes made elsewhere
  // (another tab, n8n, the public talk page) show up without a reload.
  const { state, refresh } = useAppState({ pollMs: isPublicRoute ? 0 : 30_000 });
  const [toggling, setToggling] = useState(false);

  const handleSignOut = async () => {
    try {
      await api.post('/api/auth/logout');
    } finally {
      router.replace('/login');
      router.refresh();
    }
  };

  const handleToggleKillSwitch = async () => {
    setToggling(true);
    try {
      await api.post('/api/settings/kill-switch');
      await refresh();
    } finally {
      setToggling(false);
    }
  };

  if (isPublicRoute) {
    const isLogin = pathname === '/login';
    return (
      <html lang="en">
        <head>
          <title>{isLogin ? 'Sign in | ApexSDR' : 'Talk to our AI SDR | Apex Technologies'}</title>
          <meta
            name="description"
            content={isLogin ? 'Sign in to the ApexSDR console.' : 'Direct browser-based AI voice consultation with Apex SDR.'}
          />
          <meta name="viewport" content="width=device-width, initial-scale=1" />
        </head>
        <body className="min-h-screen bg-slate-950 text-slate-100 antialiased">{children}</body>
      </html>
    );
  }

  return (
    <html lang="en">
      <head>
        <title>ApexSDR - Enterprise AI SDR Platform (India B2B)</title>
        <meta name="description" content="Autonomous AI SDR Operating System for Indian B2B Organizations" />
        <meta name="viewport" content="width=device-width, initial-scale=1" />
      </head>
      <body className="flex h-screen overflow-hidden bg-slate-50 text-slate-900 antialiased">
        {/* Left Navigation Sidebar */}
        <Sidebar org={state?.org} stats={state?.stats} />

        {/* Main Content Area */}
        <div className="flex-1 flex flex-col min-w-0 h-screen overflow-hidden">
          {/* Top Header */}
          <Header
            onOpenCommandPalette={() => setIsCommandOpen(true)}
            killSwitchActive={!!state?.org.emergency_kill_switch_active}
            onToggleKillSwitch={handleToggleKillSwitch}
            toggling={toggling}
            integrations={state?.integrations}
            orgName={state?.org.name}
            user={state?.users.find((u) => u.role === 'SALES_MANAGER')}
            onSignOut={handleSignOut}
          />

          {/* Page Body */}
          <main className="flex-1 overflow-y-auto p-4 sm:p-6">{children}</main>
        </div>

        {/* Global Command Palette */}
        <CommandPalette
          isOpen={isCommandOpen}
          onOpen={() => setIsCommandOpen(true)}
          onClose={() => setIsCommandOpen(false)}
          leads={state?.leads || []}
          campaigns={state?.campaigns || []}
        />
      </body>
    </html>
  );
}
