import { NextRequest } from 'next/server';
import { getDemoStore } from '@/lib/store/demo-store';
import { errorResponse, jsonError, jsonOk, readJson } from '@/lib/api/respond';
import type { Task } from '@/lib/types';

export const dynamic = 'force-dynamic';

const STATUSES: Task['status'][] = ['PENDING', 'IN_PROGRESS', 'COMPLETED', 'CANCELLED'];
const PRIORITIES: Task['priority'][] = ['LOW', 'MEDIUM', 'HIGH', 'URGENT'];

export async function PATCH(req: NextRequest, { params }: { params: { id: string } }) {
  try {
    const store = getDemoStore();
    const task = store.tasks.find((t) => t.id === params.id);
    if (!task) return jsonError('Task not found', 404);
    const body = await readJson<Partial<Pick<Task, 'status' | 'priority' | 'title' | 'description' | 'assigned_user_id' | 'due_date'>>>(req);
    if (body.status && !STATUSES.includes(body.status)) return jsonError(`Invalid status ${body.status}`, 400);
    if (body.priority && !PRIORITIES.includes(body.priority)) return jsonError(`Invalid priority ${body.priority}`, 400);
    const patch: Partial<Task> = { ...body };
    if (body.assigned_user_id) {
      patch.assigned_user_name = store.users.find((u) => u.id === body.assigned_user_id)?.full_name;
    }
    store.updateTask(task.id, patch);
    store.recordAuditLog('USER', body.status === 'COMPLETED' ? 'TASK_COMPLETED' : 'TASK_UPDATED', 'task', task.id, `${task.title} → ${task.status}`);
    store.persist();
    return jsonOk({ task });
  } catch (err) {
    return errorResponse(err);
  }
}
