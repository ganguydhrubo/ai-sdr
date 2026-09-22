'use client';

import { useState } from 'react';
import Link from 'next/link';
import { CheckSquare, CheckCircle2, ArrowRight, Plus } from 'lucide-react';
import { clsx } from 'clsx';
import { useAppState } from '../../lib/client/use-app-state';
import { api } from '../../lib/client/api';
import { dueIn, timeAgo } from '../../lib/client/format';
import { PageLoading, PageError, Notice, useNotice, Modal, Field, inputCls, btn, Spinner } from '../../components/ui';
import type { Task } from '../../lib/types';

export default function TasksPage() {
  const { state, loading, error, refresh } = useAppState({ pollMs: 20_000 });
  const [filter, setFilter] = useState<'ALL' | 'PENDING' | 'COMPLETED'>('PENDING');
  const [busy, setBusy] = useState<string | null>(null);
  const [notice, setNotice] = useNotice();
  const [showCreate, setShowCreate] = useState(false);
  const [form, setForm] = useState({ title: '', description: '', priority: 'MEDIUM' as Task['priority'], lead_id: '', assigned_user_id: '', due_date: '' });

  if (error && !state) return <PageError message={error} />;
  if (loading || !state) return <PageLoading />;
  const tasks = state.tasks;

  const filteredTasks = tasks.filter((t) => {
    if (filter === 'ALL') return true;
    if (filter === 'COMPLETED') return t.status === 'COMPLETED';
    return t.status !== 'COMPLETED' && t.status !== 'CANCELLED';
  });

  const run = async (key: string, fn: () => Promise<void>) => {
    setBusy(key);
    try {
      await fn();
      await refresh();
    } catch (err) {
      setNotice({ kind: 'error', text: (err as Error).message });
    } finally {
      setBusy(null);
    }
  };

  const handleToggleTask = (task: Task) => run(task.id, async () => void (await api.patch(`/api/tasks/${task.id}`, { status: task.status === 'COMPLETED' ? 'PENDING' : 'COMPLETED' })));
  const handlePriority = (task: Task, priority: Task['priority']) => run(task.id, async () => void (await api.patch(`/api/tasks/${task.id}`, { priority })));
  const handleAssign = (task: Task, assigned_user_id: string) => run(task.id, async () => void (await api.patch(`/api/tasks/${task.id}`, { assigned_user_id })));

  const handleCreate = () =>
    run('create', async () => {
      await api.post('/api/tasks', { ...form, lead_id: form.lead_id || undefined, assigned_user_id: form.assigned_user_id || undefined, due_date: form.due_date || undefined });
      setShowCreate(false);
      setForm({ ...form, title: '', description: '' });
      setNotice({ kind: 'ok', text: 'Task created.' });
    });

  return (
    <div className="space-y-6 max-w-7xl mx-auto">
      {/* Header */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
        <div>
          <h1 className="text-2xl font-bold text-slate-900 tracking-tight flex items-center gap-2">
            <CheckSquare className="w-6 h-6 text-indigo-600" />
            Human Sales Handoff Tasks
          </h1>
          <p className="text-xs text-slate-500 mt-0.5">Action items triggered by the AI SDR whenever high buying intent, a voice handoff, or a complex objection needs a person.</p>
        </div>

        <div className="flex items-center gap-2 text-xs flex-wrap">
          {(
            [
              ['ALL', `All (${tasks.length})`],
              ['PENDING', `Pending (${tasks.filter((t) => t.status !== 'COMPLETED' && t.status !== 'CANCELLED').length})`],
              ['COMPLETED', `Completed (${tasks.filter((t) => t.status === 'COMPLETED').length})`],
            ] as const
          ).map(([key, label]) => (
            <button key={key} onClick={() => setFilter(key)} className={clsx('px-3 py-1.5 rounded-lg font-medium transition-colors', filter === key ? 'bg-indigo-600 text-white' : 'bg-slate-100 text-slate-700 hover:bg-slate-200')}>
              {label}
            </button>
          ))}
          <button onClick={() => setShowCreate(true)} className={btn.primary} data-testid="open-create-task">
            <Plus className="w-3.5 h-3.5" /> New task
          </button>
        </div>
      </div>

      <Notice notice={notice} onClose={() => setNotice(null)} />

      {/* Task List */}
      <div className="bg-white rounded-xl border border-slate-200 shadow-xs divide-y divide-slate-100 overflow-hidden">
        {filteredTasks.map((t) => {
          const isCompleted = t.status === 'COMPLETED';
          const isUrgent = t.priority === 'URGENT';

          return (
            <div key={t.id} className={clsx('p-4 flex items-start gap-4 hover:bg-slate-50/80 transition-colors', isCompleted && 'opacity-60 bg-slate-50/50')} data-testid={`task-${t.id}`}>
              <button onClick={() => handleToggleTask(t)} disabled={busy !== null} className="mt-0.5 text-slate-400 hover:text-indigo-600 transition-colors disabled:opacity-50" aria-label={isCompleted ? 'Reopen task' : 'Complete task'}>
                {busy === t.id ? <Spinner className="w-5 h-5" /> : isCompleted ? <CheckCircle2 className="w-5 h-5 text-emerald-600" /> : <div className="w-5 h-5 rounded-md border-2 border-slate-300 hover:border-indigo-600" />}
              </button>

              <div className="flex-1 space-y-1 min-w-0">
                <div className="flex items-center justify-between gap-2">
                  <span className={clsx('text-xs font-bold text-slate-900', isCompleted && 'line-through text-slate-500')}>{t.title}</span>
                  <select
                    value={t.priority}
                    onChange={(e) => handlePriority(t, e.target.value as Task['priority'])}
                    disabled={busy !== null}
                    className={clsx(
                      'text-[10px] font-bold px-2 py-0.5 rounded uppercase tracking-wider border-0',
                      isUrgent ? 'bg-rose-100 text-rose-800' : t.priority === 'HIGH' ? 'bg-amber-100 text-amber-800' : 'bg-slate-100 text-slate-700'
                    )}
                    aria-label="Priority"
                  >
                    {(['LOW', 'MEDIUM', 'HIGH', 'URGENT'] as const).map((p) => (
                      <option key={p} value={p}>
                        {p}
                      </option>
                    ))}
                  </select>
                </div>

                <p className="text-xs text-slate-600 leading-relaxed">{t.description}</p>

                <div className="flex items-center gap-3 text-[11px] text-slate-400 pt-1 flex-wrap">
                  <span className="flex items-center gap-1">
                    Assigned:
                    <select value={t.assigned_user_id || ''} onChange={(e) => handleAssign(t, e.target.value)} disabled={busy !== null} className="text-[11px] text-slate-600 bg-transparent border-0 underline decoration-dotted cursor-pointer" aria-label="Assign to">
                      <option value="">{t.assigned_user_name || 'Unassigned'}</option>
                      {state.users.map((u) => (
                        <option key={u.id} value={u.id}>
                          {u.full_name}
                        </option>
                      ))}
                    </select>
                  </span>
                  <span>·</span>
                  <span className={clsx(!isCompleted && t.due_date && new Date(t.due_date).getTime() < Date.now() && 'text-rose-600 font-semibold')}>{isCompleted ? `Completed ${timeAgo(t.completed_at)}` : dueIn(t.due_date)}</span>
                  <span>·</span>
                  <span>{t.created_by_ai ? 'Created by AI' : 'Manual'} {timeAgo(t.created_at)}</span>
                  {t.lead_id && (
                    <>
                      <span>·</span>
                      <Link href={`/leads/${t.lead_id}`} className="text-indigo-600 hover:underline font-medium inline-flex items-center gap-0.5">
                        View Prospect <ArrowRight className="w-3 h-3" />
                      </Link>
                    </>
                  )}
                </div>
              </div>
            </div>
          );
        })}

        {filteredTasks.length === 0 && <div className="p-8 text-center text-xs text-slate-400">No tasks found in this view.</div>}
      </div>

      <Modal open={showCreate} title="Create a task" onClose={() => setShowCreate(false)}>
        <div className="space-y-3">
          <Field label="Title *">
            <input value={form.title} onChange={(e) => setForm({ ...form, title: e.target.value })} className={inputCls} data-testid="task-title" />
          </Field>
          <Field label="Description">
            <textarea rows={3} value={form.description} onChange={(e) => setForm({ ...form, description: e.target.value })} className={inputCls} />
          </Field>
          <div className="grid grid-cols-2 gap-3">
            <Field label="Priority">
              <select value={form.priority} onChange={(e) => setForm({ ...form, priority: e.target.value as Task['priority'] })} className={inputCls}>
                {(['LOW', 'MEDIUM', 'HIGH', 'URGENT'] as const).map((p) => (
                  <option key={p} value={p}>
                    {p}
                  </option>
                ))}
              </select>
            </Field>
            <Field label="Due">
              <input type="datetime-local" value={form.due_date} onChange={(e) => setForm({ ...form, due_date: e.target.value })} className={inputCls} />
            </Field>
          </div>
          <div className="grid grid-cols-2 gap-3">
            <Field label="Lead">
              <select value={form.lead_id} onChange={(e) => setForm({ ...form, lead_id: e.target.value })} className={inputCls}>
                <option value="">None</option>
                {state.leads.map((l) => (
                  <option key={l.id} value={l.id}>
                    {l.full_name} — {l.company_name}
                  </option>
                ))}
              </select>
            </Field>
            <Field label="Assign to">
              <select value={form.assigned_user_id} onChange={(e) => setForm({ ...form, assigned_user_id: e.target.value })} className={inputCls}>
                <option value="">Unassigned</option>
                {state.users.map((u) => (
                  <option key={u.id} value={u.id}>
                    {u.full_name} ({u.role.replace('_', ' ')})
                  </option>
                ))}
              </select>
            </Field>
          </div>
          <div className="pt-3 border-t border-slate-200 flex justify-end gap-2">
            <button onClick={() => setShowCreate(false)} className={btn.ghost}>
              Cancel
            </button>
            <button onClick={handleCreate} disabled={busy !== null || !form.title.trim()} className={btn.primary} data-testid="submit-create-task">
              {busy === 'create' ? <Spinner /> : <Plus className="w-3.5 h-3.5" />} Create task
            </button>
          </div>
        </div>
      </Modal>
    </div>
  );
}
