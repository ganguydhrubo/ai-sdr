'use client';

import Link from 'next/link';
import { usePathname } from 'next/navigation';
import {
  LayoutDashboard,
  Users,
  Building2,
  Send,
  MessageSquare,
  Calendar,
  CheckSquare,
  Kanban,
  Activity,
  Settings,
  ShieldCheck,
  Zap,
  Smartphone,
  PhoneCall,
} from 'lucide-react';
import { clsx } from 'clsx';

const NAV_ITEMS = [
  { label: 'Dashboard', href: '/', icon: LayoutDashboard },
  { label: 'Leads (B2B)', href: '/leads', icon: Users },
  { label: 'Pipeline CRM', href: '/pipeline', icon: Kanban },
  { label: 'Campaigns', href: '/campaigns', icon: Send },
  { label: 'Voice & AI Calls', href: '/voice', icon: PhoneCall, badge: 'WEBRTC' },
  { label: 'WhatsApp Hub (Baileys)', href: '/whatsapp', icon: Smartphone },
  { label: 'Conversations & Inbox', href: '/inbox', icon: MessageSquare },
  { label: 'Meetings & Briefs', href: '/meetings', icon: Calendar },
  { label: 'Sales Handoff Tasks', href: '/tasks', icon: CheckSquare },
  { label: 'AI Activity Center', href: '/activity', icon: Activity },
  { label: 'Admin & Guardrails', href: '/settings', icon: Settings },
];

export function Sidebar() {
  const pathname = usePathname();

  return (
    <aside className="w-64 bg-slate-900 text-slate-100 flex flex-col h-screen border-r border-slate-800 flex-shrink-0">
      {/* Brand Header */}
      <div className="p-4 border-b border-slate-800 flex items-center justify-between">
        <div className="flex items-center gap-2.5">
          <div className="w-9 h-9 rounded-lg bg-indigo-600 flex items-center justify-center text-white font-bold shadow-md shadow-indigo-500/20">
            <Zap className="w-5 h-5 text-amber-300" />
          </div>
          <div>
            <div className="font-semibold text-sm tracking-tight text-white flex items-center gap-1.5">
              ApexSDR
              <span className="text-[10px] uppercase font-bold bg-amber-500/20 text-amber-400 px-1.5 py-0.5 rounded border border-amber-500/30">
                India B2B
              </span>
            </div>
            <div className="text-[11px] text-slate-400">Autonomous Sales OS</div>
          </div>
        </div>
      </div>

      {/* Nav List */}
      <nav className="flex-1 p-3 space-y-1 overflow-y-auto">
        <div className="px-3 py-1.5 text-[10px] font-semibold uppercase tracking-wider text-slate-400">
          Core Workflows
        </div>
        {NAV_ITEMS.map((item) => {
          const Icon = item.icon;
          const isActive = pathname === item.href || (item.href !== '/' && pathname.startsWith(item.href));
          return (
            <Link
              key={item.href}
              href={item.href}
              className={clsx(
                'flex items-center justify-between px-3 py-2 rounded-md text-sm font-medium transition-colors',
                isActive
                  ? 'bg-indigo-600 text-white shadow-sm'
                  : 'text-slate-300 hover:bg-slate-800 hover:text-white'
              )}
            >
              <div className="flex items-center gap-3">
                <Icon className={clsx('w-4 h-4', isActive ? 'text-white' : 'text-slate-400')} />
                <span>{item.label}</span>
              </div>
              {item.badge && (
                <span className="text-[9px] uppercase font-bold px-1.5 py-0.5 rounded bg-violet-500/20 text-violet-300 border border-violet-500/30">
                  {item.badge}
                </span>
              )}
            </Link>
          );
        })}
      </nav>

      {/* Organization Status Footer */}
      <div className="p-3 border-t border-slate-800 bg-slate-950/40">
        <div className="bg-slate-800/60 rounded-lg p-2.5 border border-slate-700/50">
          <div className="flex items-center justify-between text-xs mb-1">
            <span className="text-slate-400">Monthly AI Budget</span>
            <span className="font-semibold text-slate-200">₹2,380 / ₹41,500</span>
          </div>
          <div className="w-full bg-slate-700 h-1.5 rounded-full overflow-hidden">
            <div className="bg-emerald-500 h-full w-[6%] rounded-full" />
          </div>
          <div className="mt-2 flex items-center justify-between text-[11px] text-slate-400">
            <span className="flex items-center gap-1">
              <ShieldCheck className="w-3 h-3 text-emerald-400" />
              Guardrails Active
            </span>
            <span className="text-emerald-400 font-medium">99.8% OK</span>
          </div>
        </div>
      </div>
    </aside>
  );
}
