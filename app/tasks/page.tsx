'use client';

import { useState } from 'react';
import Link from 'next/link';
import {
  CheckSquare,
  Clock,
  User,
  AlertCircle,
  CheckCircle2,
  Building,
  ArrowRight,
  Filter,
} from 'lucide-react';
import { getDemoStore } from '../../lib/store/demo-store';
import { Task } from '../../lib/types';
import { clsx } from 'clsx';

export default function TasksPage() {
  const store = getDemoStore();
  const [tasks, setTasks] = useState<Task[]>([...store.tasks]);
  const [filter, setFilter] = useState<'ALL' | 'PENDING' | 'COMPLETED'>('ALL');

  const handleToggleTask = (taskId: string) => {
    const task = store.tasks.find((t) => t.id === taskId);
    if (task) {
      task.status = task.status === 'COMPLETED' ? 'PENDING' : 'COMPLETED';
      setTasks([...store.tasks]);
    }
  };

  const filteredTasks = tasks.filter((t) => {
    if (filter === 'ALL') return true;
    return t.status === filter;
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
          <p className="text-xs text-slate-500 mt-0.5">
            Action items triggered by the AI SDR whenever high buying intent or complex objections require sales rep intervention.
          </p>
        </div>

        <div className="flex items-center gap-2 text-xs">
          <button
            onClick={() => setFilter('ALL')}
            className={clsx('px-3 py-1.5 rounded-lg font-medium transition-colors', filter === 'ALL' ? 'bg-indigo-600 text-white' : 'bg-slate-100 text-slate-700 hover:bg-slate-200')}
          >
            All ({tasks.length})
          </button>
          <button
            onClick={() => setFilter('PENDING')}
            className={clsx('px-3 py-1.5 rounded-lg font-medium transition-colors', filter === 'PENDING' ? 'bg-indigo-600 text-white' : 'bg-slate-100 text-slate-700 hover:bg-slate-200')}
          >
            Pending ({tasks.filter((t) => t.status !== 'COMPLETED').length})
          </button>
          <button
            onClick={() => setFilter('COMPLETED')}
            className={clsx('px-3 py-1.5 rounded-lg font-medium transition-colors', filter === 'COMPLETED' ? 'bg-indigo-600 text-white' : 'bg-slate-100 text-slate-700 hover:bg-slate-200')}
          >
            Completed ({tasks.filter((t) => t.status === 'COMPLETED').length})
          </button>
        </div>
      </div>

      {/* Task List */}
      <div className="bg-white rounded-xl border border-slate-200 shadow-xs divide-y divide-slate-100 overflow-hidden">
        {filteredTasks.map((t) => {
          const isCompleted = t.status === 'COMPLETED';
          const isUrgent = t.priority === 'URGENT';

          return (
            <div
              key={t.id}
              className={clsx(
                'p-4 flex items-start gap-4 hover:bg-slate-50/80 transition-colors',
                isCompleted && 'opacity-60 bg-slate-50/50'
              )}
            >
              <button
                onClick={() => handleToggleTask(t.id)}
                className="mt-0.5 text-slate-400 hover:text-indigo-600 transition-colors"
              >
                {isCompleted ? (
                  <CheckCircle2 className="w-5 h-5 text-emerald-600" />
                ) : (
                  <div className="w-5 h-5 rounded-md border-2 border-slate-300 hover:border-indigo-600" />
                )}
              </button>

              <div className="flex-1 space-y-1">
                <div className="flex items-center justify-between">
                  <span
                    className={clsx(
                      'text-xs font-bold text-slate-900',
                      isCompleted && 'line-through text-slate-500'
                    )}
                  >
                    {t.title}
                  </span>
                  <span
                    className={clsx(
                      'text-[10px] font-bold px-2 py-0.5 rounded uppercase tracking-wider',
                      isUrgent
                        ? 'bg-rose-100 text-rose-800'
                        : t.priority === 'HIGH'
                        ? 'bg-amber-100 text-amber-800'
                        : 'bg-slate-100 text-slate-700'
                    )}
                  >
                    {t.priority}
                  </span>
                </div>

                <p className="text-xs text-slate-600 leading-relaxed">{t.description}</p>

                <div className="flex items-center gap-4 text-[11px] text-slate-400 pt-1">
                  <span>Assigned: {t.assigned_user_name || 'Account Executive'}</span>
                  <span>·</span>
                  <span>Due: In 24 Hours</span>
                  {t.lead_id && (
                    <>
                      <span>·</span>
                      <Link
                        href={`/leads/${t.lead_id}`}
                        className="text-indigo-600 hover:underline font-medium inline-flex items-center gap-0.5"
                      >
                        View Prospect <ArrowRight className="w-3 h-3" />
                      </Link>
                    </>
                  )}
                </div>
              </div>
            </div>
          );
        })}

        {filteredTasks.length === 0 && (
          <div className="p-8 text-center text-xs text-slate-400">
            No tasks found in this view.
          </div>
        )}
      </div>
    </div>
  );
}
