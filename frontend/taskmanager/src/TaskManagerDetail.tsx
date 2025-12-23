import { useEffect, useState } from 'react';
import { useNavigate, useParams } from 'react-router-dom';
import { ManagedTask } from './types';
import { taskManagerService } from './services';

const TaskManagerDetail = () => {
  const { id } = useParams<{ id: string }>();
  const navigate = useNavigate();
  const [task, setTask] = useState<ManagedTask | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    const loadTask = async () => {
      if (!id) return;
      try {
        setLoading(true);
        setError(null);
        const data = await taskManagerService.getById(Number(id));
        setTask(data);
      } catch (err: any) {
        console.error('Failed to load managed task', err);
        setError(err?.response?.data?.error || 'Failed to load task');
      } finally {
        setLoading(false);
      }
    };

    loadTask();
  }, [id]);

  const isOverdue = (task: ManagedTask): boolean => {
    if (!task.slaResolutionTimeMinutes) return false;
    const created = new Date(task.createdAt).getTime();
    const deadline = created + task.slaResolutionTimeMinutes * 60 * 1000;
    return Date.now() > deadline && task.status.toLowerCase() !== 'completed';
  };

  const formatDateTime = (value: string) =>
    new Date(value).toLocaleString(undefined, {
      year: 'numeric',
      month: 'short',
      day: '2-digit',
      hour: '2-digit',
      minute: '2-digit',
    });

  const formatDuration = (minutes?: number) => {
    if (!minutes || minutes <= 0) return 'Not set';
    if (minutes < 60) return `${minutes}m`;
    const hours = Math.floor(minutes / 60);
    const mins = minutes % 60;
    if (hours >= 24) {
      const days = Math.floor(hours / 24);
      const remainingHours = hours % 24;
      if (remainingHours === 0) return `${days}d`;
      return `${days}d ${remainingHours}h`;
    }
    if (mins === 0) return `${hours}h`;
    return `${hours}h ${mins}m`;
  };

  const computeSlaDeadline = (task: ManagedTask): string | null => {
    if (!task.slaResolutionTimeMinutes) return null;
    const created = new Date(task.createdAt).getTime();
    const deadline = created + task.slaResolutionTimeMinutes * 60 * 1000;
    return new Date(deadline).toLocaleString();
  };

  const stringifyPayload = (payload: unknown) => {
    try {
      return JSON.stringify(payload, null, 2);
    } catch {
      return String(payload ?? '');
    }
  };

  if (loading) {
    return (
      <div style={{ padding: '2rem' }}>
        <p>Loading task...</p>
      </div>
    );
  }

  if (!task) {
    return (
      <div style={{ padding: '2rem' }}>
        <button
          onClick={() => navigate('/')}
          style={{
            marginBottom: '1rem',
            fontSize: '0.85rem',
            color: '#4b5563',
            background: 'none',
            border: 'none',
            padding: 0,
            cursor: 'pointer',
          }}
        >
          ← Back to Task Manager
        </button>
        <p style={{ color: '#b91c1c', fontSize: '0.9rem' }}>{error || 'Task not found'}</p>
      </div>
    );
  }

  const overdue = isOverdue(task);
  const slaDeadline = computeSlaDeadline(task);

  return (
    <div style={{ padding: '2rem' }}>
      <button
        onClick={() => navigate('/')}
        style={{
          marginBottom: '1rem',
          fontSize: '0.85rem',
          color: '#4b5563',
          background: 'none',
          border: 'none',
          padding: 0,
          cursor: 'pointer',
        }}
      >
        ← Back to Task Manager
      </button>

      <h1 style={{ fontSize: '1.5rem', marginBottom: '0.25rem' }}>Task #{task.taskId}</h1>
      <p style={{ marginBottom: '1rem', color: '#111827' }}>{task.title}</p>

      {overdue && (
        <p style={{ color: '#b91c1c', fontSize: '0.85rem', marginBottom: '1rem' }}>
          SLA is overdue.
        </p>
      )}

      <div
        style={{
          border: '1px solid #e5e7eb',
          borderRadius: '0.5rem',
          padding: '1rem',
          marginBottom: '1rem',
        }}
      >
        <h2 style={{ fontSize: '0.95rem', marginBottom: '0.75rem', color: '#374151' }}>
          Workflow & Status
        </h2>
        <div style={{ fontSize: '0.85rem', display: 'grid', rowGap: '0.4rem' }}>
          <div>
            <strong>Workflow: </strong>
            <span>{task.workflowName}</span>
          </div>
          <div>
            <strong>Status: </strong>
            <span>{overdue ? 'Overdue' : task.status}</span>
          </div>
          <div>
            <strong>Priority: </strong>
            <span>{task.priority}</span>
          </div>
          <div>
            <strong>External Task ID: </strong>
            <span style={{ fontFamily: 'monospace' }}>
              {task.externalTaskId || 'Not provided'}
            </span>
          </div>
          <div>
            <strong>Created At: </strong>
            <span>{formatDateTime(task.createdAt)}</span>
          </div>
          <div>
            <strong>Last Updated: </strong>
            <span>{formatDateTime(task.updatedAt)}</span>
          </div>
        </div>
      </div>

      <div
        style={{
          border: '1px solid #e5e7eb',
          borderRadius: '0.5rem',
          padding: '1rem',
          marginBottom: '1rem',
        }}
      >
        <h2 style={{ fontSize: '0.95rem', marginBottom: '0.75rem', color: '#374151' }}>
          SLA Details
        </h2>
        <div style={{ fontSize: '0.85rem', display: 'grid', rowGap: '0.4rem' }}>
          <div>
            <strong>Priority Level: </strong>
            <span>{task.slaPriority || 'Not configured'}</span>
          </div>
          <div>
            <strong>Response Time: </strong>
            <span>{formatDuration(task.slaResponseTimeMinutes)}</span>
          </div>
          <div>
            <strong>Resolution Time: </strong>
            <span>{formatDuration(task.slaResolutionTimeMinutes)}</span>
          </div>
          {slaDeadline && (
            <div>
              <strong>Resolution Deadline: </strong>
              <span>{slaDeadline}</span>
            </div>
          )}
        </div>
      </div>

      <div
        style={{
          border: '1px solid #e5e7eb',
          borderRadius: '0.5rem',
          padding: '1rem',
          marginBottom: '1rem',
        }}
      >
        <h2 style={{ fontSize: '0.95rem', marginBottom: '0.5rem', color: '#374151' }}>
          Description
        </h2>
        <p style={{ fontSize: '0.85rem', color: '#111827' }}>
          {task.description || 'No description provided.'}
        </p>
      </div>

      <div
        style={{
          border: '1px solid #e5e7eb',
          borderRadius: '0.5rem',
          padding: '1rem',
        }}
      >
        <h2 style={{ fontSize: '0.95rem', marginBottom: '0.5rem', color: '#374151' }}>
          Full Task Payload
        </h2>
        <pre
          style={{
            fontSize: '0.75rem',
            backgroundColor: '#f9fafb',
            border: '1px solid #e5e7eb',
            borderRadius: '0.4rem',
            padding: '0.75rem',
            overflowX: 'auto',
          }}
        >
          {stringifyPayload(task.payload)}
        </pre>
      </div>
    </div>
  );
};

export default TaskManagerDetail;


