'use client';

import { useState } from 'react';
import './globals.css';
import { Sidebar } from '../components/layout/sidebar';
import { Header } from '../components/layout/header';
import { CommandPalette } from '../components/command-palette';
import { getDemoStore } from '../lib/store/demo-store';

export default function RootLayout({ children }: { children: React.ReactNode }) {
  const [isCommandOpen, setIsCommandOpen] = useState(false);
  const store = getDemoStore();
  const [killSwitchActive, setKillSwitchActive] = useState(store.org.emergency_kill_switch_active);

  const handleToggleKillSwitch = () => {
    const newState = store.toggleKillSwitch();
    setKillSwitchActive(newState);
  };

  return (
    <html lang="en">
      <head>
        <title>ApexSDR - Enterprise AI SDR Platform (India B2B)</title>
        <meta name="description" content="Autonomous AI SDR Operating System for Indian B2B Organizations" />
      </head>
      <body className="flex h-screen overflow-hidden bg-slate-50 text-slate-900 antialiased">
        {/* Left Navigation Sidebar */}
        <Sidebar />

        {/* Main Content Area */}
        <div className="flex-1 flex flex-col min-w-0 h-screen overflow-hidden">
          {/* Top Header */}
          <Header
            onOpenCommandPalette={() => setIsCommandOpen(true)}
            killSwitchActive={killSwitchActive}
            onToggleKillSwitch={handleToggleKillSwitch}
          />

          {/* Page Body */}
          <main className="flex-1 overflow-y-auto p-6">
            {children}
          </main>
        </div>

        {/* Global Command Palette */}
        <CommandPalette isOpen={isCommandOpen} onClose={() => setIsCommandOpen(false)} />
      </body>
    </html>
  );
}
