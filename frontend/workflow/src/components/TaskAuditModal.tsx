import { useEffect, useState } from 'react';
import { FiX, FiClock } from 'react-icons/fi';
import { taskService } from '../services/taskService';
import { TaskAuditEntry } from '../types';
import LoadingSpinner from './LoadingSpinner';
import { formatDateToIST } from '../utils/dateUtils';

interface TaskAuditModalProps {
  taskId: string;
  taskName: string;
  onClose: () => void;
}

const actionLabels: Record<string, string> = {
  Assigned: 'Assigned',
  Reassigned: 'Reassigned',
  StageCompleted: 'Stage completed',
  StageEscalated: 'Stage escalated',
  TaskCompleted: 'Task completed',
};

function describeEntry(entry: TaskAuditEntry): string {
  const action = actionLabels[entry.actionType] ?? entry.actionType;
  const member = entry.memberName ?? (entry.memberId ? 'Member' : 'System');
  const stage = entry.stageName ? ` — ${entry.stageName}` : '';
  const next = entry.nextStageName ? ` → ${entry.nextStageName}` : '';

  if (entry.actionType === 'Reassigned') {
    const from = entry.fromMemberName ?? 'Previous assignee';
    const to = entry.toMemberName ?? entry.memberName ?? 'New assignee';
    return `${action}: ${from} → ${to}${stage}`;
  }

  if (entry.actionType === 'Assigned') {
    if (entry.reason) {
      return `Assigned to ${member}${stage}. Reason: ${entry.reason}`;
    }
    return `Assigned to ${member}${stage}`;
  }

  if (entry.reason) {
    return `${action} by ${member}${stage}${next}. Reason: ${entry.reason}`;
  }

  return `${action} by ${member}${stage}${next}`;
}

const TaskAuditModal = ({ taskId, taskName, onClose }: TaskAuditModalProps) => {
  const [entries, setEntries] = useState<TaskAuditEntry[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    let cancelled = false;

    const load = async () => {
      try {
        setLoading(true);
        setError(null);
        const data = await taskService.getAudit(taskId);
        if (!cancelled) setEntries(data);
      } catch (err) {
        console.error('Failed to load task audit', err);
        if (!cancelled) setError('Failed to load task history. Please try again.');
      } finally {
        if (!cancelled) setLoading(false);
      }
    };

    load();
    return () => {
      cancelled = true;
    };
  }, [taskId]);

  return (
    <div
      className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center z-50 backdrop-blur-sm"
      onClick={onClose}
      role="presentation"
    >
      <div
        className="bg-white rounded-azure-sm shadow-azure-xl p-6 w-full max-w-lg max-h-[80vh] flex flex-col border border-[#434E78]/20"
        onClick={(e) => e.stopPropagation()}
        role="dialog"
        aria-labelledby="task-audit-title"
      >
        <div className="flex justify-between items-start mb-4 shrink-0">
          <div className="flex items-start gap-2 pr-4">
            <FiClock className="text-[#434E78] text-xl mt-0.5 shrink-0" />
            <div>
              <h2 id="task-audit-title" className="text-xl font-semibold text-black font-sans">
                Task history
              </h2>
              <p className="text-sm text-black/60 font-sans mt-1">{taskName}</p>
            </div>
          </div>
          <button
            type="button"
            onClick={onClose}
            className="text-black/70 hover:text-black hover:bg-[#434E78]/10 p-1 rounded-azure-sm transition-colors"
            aria-label="Close"
          >
            <FiX className="text-lg" />
          </button>
        </div>

        <div className="overflow-y-auto flex-1 min-h-0">
          {loading && (
            <div className="py-8 flex justify-center">
              <LoadingSpinner />
            </div>
          )}

          {!loading && error && (
            <p className="text-red-700 text-sm font-sans py-4">{error}</p>
          )}

          {!loading && !error && entries.length === 0 && (
            <p className="text-black/60 text-sm font-sans py-6 text-center">
              No history recorded for this task yet.
            </p>
          )}

          {!loading && !error && entries.length > 0 && (
            <ul className="space-y-3">
              {entries.map((entry) => (
                <li
                  key={entry.auditId}
                  className="border-l-2 border-[#434E78]/40 pl-4 py-1"
                >
                  <p className="text-sm text-black font-sans">{describeEntry(entry)}</p>
                  <p className="text-xs text-black/50 font-sans mt-1">
                    {formatDateToIST(entry.occurredAt)}
                  </p>
                </li>
              ))}
            </ul>
          )}
        </div>

        <div className="mt-6 flex justify-end shrink-0">
          <button
            type="button"
            onClick={onClose}
            className="px-4 py-2 bg-[#434E78] text-white rounded-azure-sm hover:bg-[#434E78]/90 font-medium text-sm shadow-azure-sm transition-colors font-sans"
          >
            Close
          </button>
        </div>
      </div>
    </div>
  );
};

export default TaskAuditModal;
