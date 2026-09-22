'use client';

import { useCallback, useEffect, useState, type ReactNode } from 'react';
import { CheckCircle2, AlertTriangle, Info, Loader2, X } from 'lucide-react';
import { clsx } from 'clsx';
import type { DeliveryReceipt, LeadStatus, MessageStatus } from '../lib/types';

export function PageLoading({ label = 'Loading from the server…' }: { label?: string }) {
  return (
    <div className="flex items-center gap-2 text-sm text-slate-500 p-8" data-testid="page-loading">
      <Loader2 className="w-4 h-4 animate-spin" /> {label}
    </div>
  );
}

export function PageError({ message }: { message: string }) {
  return (
    <div className="m-6 rounded-lg border border-rose-200 bg-rose-50 p-4 text-xs text-rose-800">
      <div className="font-bold mb-1">Could not load data from the server</div>
      <div>{message}</div>
      <div className="mt-2 text-rose-700">Is the dev server running? Reload the page once it is.</div>
    </div>
  );
}

export type NoticeKind = 'ok' | 'error' | 'info';
export interface NoticeState {
  kind: NoticeKind;
  text: string;
}

/** Small auto-clearing notice used by every page for action feedback. */
export function useNotice(timeoutMs = 6000): [NoticeState | null, (n: NoticeState | null) => void] {
  const [notice, setNoticeState] = useState<NoticeState | null>(null);
  useEffect(() => {
    if (!notice || notice.kind === 'error') return;
    const t = setTimeout(() => setNoticeState(null), timeoutMs);
    return () => clearTimeout(t);
  }, [notice, timeoutMs]);
  const setNotice = useCallback((n: NoticeState | null) => setNoticeState(n), []);
  return [notice, setNotice];
}

export function Notice({ notice, onClose }: { notice: NoticeState | null; onClose?: () => void }) {
  if (!notice) return null;
  const Icon = notice.kind === 'ok' ? CheckCircle2 : notice.kind === 'error' ? AlertTriangle : Info;
  return (
    <div
      role="status"
      data-testid={`notice-${notice.kind}`}
      className={clsx(
        'rounded-lg border px-4 py-3 text-xs font-medium flex items-start gap-2',
        notice.kind === 'ok' && 'bg-emerald-50 border-emerald-200 text-emerald-800',
        notice.kind === 'error' && 'bg-rose-50 border-rose-200 text-rose-800',
        notice.kind === 'info' && 'bg-indigo-50 border-indigo-200 text-indigo-800'
      )}
    >
      <Icon className="w-4 h-4 flex-shrink-0 mt-0.5" />
      <div className="flex-1 whitespace-pre-wrap break-words">{notice.text}</div>
      {onClose && (
        <button onClick={onClose} className="text-current opacity-60 hover:opacity-100" aria-label="Dismiss">
          <X className="w-3.5 h-3.5" />
        </button>
      )}
    </div>
  );
}

export function Modal({
  open,
  title,
  description,
  onClose,
  children,
  footer,
  wide,
}: {
  open: boolean;
  title: string;
  description?: string;
  onClose: () => void;
  children: ReactNode;
  footer?: ReactNode;
  wide?: boolean;
}) {
  useEffect(() => {
    if (!open) return;
    const onKey = (e: KeyboardEvent) => {
      if (e.key === 'Escape') onClose();
    };
    window.addEventListener('keydown', onKey);
    return () => window.removeEventListener('keydown', onKey);
  }, [open, onClose]);
  if (!open) return null;
  return (
    <div className="fixed inset-0 z-50 bg-slate-900/60 backdrop-blur-sm flex items-center justify-center p-4" onClick={onClose}>
      <div
        role="dialog"
        aria-modal="true"
        aria-label={title}
        onClick={(e) => e.stopPropagation()}
        className={clsx('w-full bg-white rounded-xl shadow-2xl border border-slate-200 overflow-hidden flex flex-col max-h-[90vh]', wide ? 'max-w-3xl' : 'max-w-lg')}
      >
        <div className="p-4 border-b border-slate-200 flex items-start justify-between gap-4">
          <div>
            <h2 className="text-sm font-bold text-slate-900">{title}</h2>
            {description && <p className="text-xs text-slate-500 mt-0.5">{description}</p>}
          </div>
          <button onClick={onClose} className="text-slate-400 hover:text-slate-600" aria-label="Close">
            <X className="w-4 h-4" />
          </button>
        </div>
        <div className="p-4 overflow-y-auto">{children}</div>
        {footer && <div className="p-4 border-t border-slate-200 bg-slate-50 flex justify-end gap-2">{footer}</div>}
      </div>
    </div>
  );
}

export const btn = {
  primary:
    'px-3.5 py-2 bg-indigo-600 hover:bg-indigo-700 text-white text-xs font-semibold rounded-lg shadow-sm transition-colors disabled:opacity-50 disabled:cursor-not-allowed inline-flex items-center gap-1.5',
  secondary:
    'px-3.5 py-2 bg-white hover:bg-slate-50 text-slate-700 border border-slate-200 text-xs font-medium rounded-lg transition-colors disabled:opacity-50 disabled:cursor-not-allowed inline-flex items-center gap-1.5',
  success:
    'px-3.5 py-2 bg-emerald-600 hover:bg-emerald-700 text-white text-xs font-semibold rounded-lg shadow-sm transition-colors disabled:opacity-50 disabled:cursor-not-allowed inline-flex items-center gap-1.5',
  danger:
    'px-3.5 py-2 bg-rose-600 hover:bg-rose-700 text-white text-xs font-semibold rounded-lg shadow-sm transition-colors disabled:opacity-50 disabled:cursor-not-allowed inline-flex items-center gap-1.5',
  ghost: 'px-2.5 py-1.5 text-xs font-medium text-slate-600 hover:bg-slate-100 rounded-lg transition-colors disabled:opacity-50 inline-flex items-center gap-1',
  small:
    'px-2.5 py-1 bg-white hover:bg-slate-50 text-slate-700 border border-slate-200 rounded text-xs font-medium inline-flex items-center gap-1 transition-colors disabled:opacity-50',
};

export const inputCls =
  'w-full text-xs border border-slate-200 rounded-lg px-2.5 py-2 text-slate-900 bg-white focus:outline-none focus:ring-2 focus:ring-indigo-500 disabled:bg-slate-50';

export function Field({ label, children, hint }: { label: string; children: ReactNode; hint?: string }) {
  return (
    <label className="block">
      <span className="text-[11px] font-semibold text-slate-600 block mb-1">{label}</span>
      {children}
      {hint && <span className="text-[10px] text-slate-400 block mt-1">{hint}</span>}
    </label>
  );
}

const LEAD_STATUS_CLASSES: Partial<Record<LeadStatus, string>> = {
  MEETING: 'bg-emerald-100 text-emerald-800',
  ENGAGED: 'bg-blue-100 text-blue-800',
  SALES_HANDOFF: 'bg-purple-100 text-purple-800',
  OUTREACH: 'bg-amber-100 text-amber-800',
  CONTACTED: 'bg-sky-100 text-sky-800',
  QUALIFIED: 'bg-indigo-100 text-indigo-800',
  QUALIFIED_OPPORTUNITY: 'bg-violet-100 text-violet-800',
  WON: 'bg-emerald-200 text-emerald-900',
  DISQUALIFIED: 'bg-rose-100 text-rose-800',
  LOST: 'bg-rose-100 text-rose-800',
  NURTURE: 'bg-slate-200 text-slate-700',
};

export function LeadStatusBadge({ status }: { status: LeadStatus }) {
  return (
    <span className={clsx('text-[10px] font-semibold px-2 py-0.5 rounded-md uppercase tracking-wider', LEAD_STATUS_CLASSES[status] || 'bg-slate-100 text-slate-700')}>
      {status.replace(/_/g, ' ')}
    </span>
  );
}

const MESSAGE_STATUS_CLASSES: Partial<Record<MessageStatus, string>> = {
  PENDING_APPROVAL: 'bg-amber-100 text-amber-800 border border-amber-300',
  QUEUED: 'bg-sky-100 text-sky-800 border border-sky-200',
  SENT: 'bg-emerald-100 text-emerald-800 border border-emerald-200',
  DELIVERED: 'bg-emerald-100 text-emerald-800 border border-emerald-200',
  REPLIED: 'bg-indigo-100 text-indigo-800 border border-indigo-200',
  FAILED: 'bg-rose-100 text-rose-800 border border-rose-200',
  SUPPRESSED: 'bg-rose-50 text-rose-700 border border-rose-200',
  CANCELLED: 'bg-slate-100 text-slate-600 border border-slate-200',
};

export function MessageStatusBadge({ status }: { status: MessageStatus }) {
  return (
    <span className={clsx('text-[10px] font-bold px-2 py-0.5 rounded-full', MESSAGE_STATUS_CLASSES[status] || 'bg-slate-100 text-slate-700')}>
      {status.replace(/_/g, ' ')}
    </span>
  );
}

export function DeliveryReceiptLine({ receipt }: { receipt?: DeliveryReceipt }) {
  if (!receipt) return null;
  if (receipt.error) {
    return (
      <div className="text-[11px] text-rose-700 bg-rose-50 border border-rose-200 rounded px-2 py-1 mt-1 break-words" data-testid="delivery-error">
        Delivery failed via {receipt.provider}: {receipt.error}
      </div>
    );
  }
  return (
    <div className="text-[11px] text-slate-500 mt-1" data-testid="delivery-ok">
      {receipt.simulated ? 'Simulated delivery' : 'Delivered'} via {receipt.provider}
      {receipt.redirected_to ? ` → redirected to ${receipt.redirected_to}` : ''}
      {receipt.provider_message_id ? ` · id ${receipt.provider_message_id}` : ''}
    </div>
  );
}

export function EmptyState({ children }: { children: ReactNode }) {
  return <div className="p-8 text-center text-xs text-slate-400">{children}</div>;
}

export function Spinner({ className }: { className?: string }) {
  return <Loader2 className={clsx('w-3.5 h-3.5 animate-spin', className)} />;
}
