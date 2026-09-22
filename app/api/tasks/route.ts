import { NextRequest } from 'next/server';
import { getDemoStore } from '@/lib/store/demo-store';
import { errorResponse, jsonError, jsonOk, readJson } from '@/lib/api/respond';
import type { Task } from '@/lib/types';

export const dynamic = 'force-dynamic';

const PRIORITIES: Task['priority'][] = ['LOW', 'MEDIUM', 'HIGH', 'URGENT'];

/** Creates a manual task (optionally linked to a lead and assigned to a user). */
export async function POST(req: NextRequest) {
  try {
    const store = getDemoStore();
    const body = await readJson<{ title?: string; description?: string; priority?: Task['priority']; lead_id?: string; due_date?: string; assigned_user_id?: string }>(req);
    const title = (body.title || '').trim();
    if (!title) return jsonError('title is required', 400);
    if (body.priority && !PRIORITIES.includes(body.priority)) return jsonError(`Invalid priority ${body.priority}`, 400);
    if (body.lead_id && !store.findLead(body.lead_id)) return jsonError('Lead not found', 404);
    if (body.due_date && Number.isNaN(Date.parse(body.due_date))) return jsonError('Invalid due_date', 400);

    const task = store.addTask({
      title,
      description: body.description?.trim() || undefined,
      priority: body.priority || 'MEDIUM',
      lead_id: body.lead_id,
      due_date: body.due_date ? new Date(body.due_date).toISOString() : new Date(Date.now() + 86400000).toISOString(),
      assigned_user_id: body.assigned_user_id,
      created_by_ai: false,
    });
    store.recordAuditLog('USER', 'TASK_CREATED', 'task', task.id, `Created task "${task.title}"${task.lead_name ? ` for ${task.lead_name}` : ''}`);
    store.persist();
    return jsonOk({ task });
  } catch (err) {
    return errorResponse(err);
  }
}
