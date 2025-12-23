import { useEffect, useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { ManagedTask } from './types';
import { taskManagerService } from './services';

const TaskManagerList = () => {
  const [tasks, setTasks] = useState<ManagedTask[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const navigate = useNavigate();

  useEffect(() => {
    const loadTasks = async () => {
      try {
        setLoading(true);
        setError(null);
        const data = await taskManagerService.getAll();
        setTasks(data);
      } catch (err: any) {
        console.error('Failed to load managed tasks', err);
        setError(err?.response?.data?.error || 'Failed to load tasks');
      } finally {
        setLoading(false);
      }
    };

    loadTasks();
  }, []);

  const isTaskOverdue = (task: ManagedTask): boolean => {
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

  return (
    <div style={{ padding: '2rem', backgroundColor: '#f3f4f6', minHeight: '100vh' }}>
      {/* Page header */}
      <div
        style={{
          marginBottom: '1.5rem',
          paddingBottom: '1rem',
          borderBottom: '1px solid rgba(67, 78, 120, 0.2)',
        }}
      >
        <h1 style={{ margin: 0, fontSize: '2rem', fontWeight: 600 }}>Task Manager</h1>
        <p style={{ margin: '0.25rem 0 0', fontSize: '0.9rem', color: '#4b5563' }}>
          Overview of tasks, workflows, and SLA status.
        </p>
      </div>

      {/* Summary cards row */}
      <div
        style={{
          display: 'grid',
          gridTemplateColumns: 'repeat(auto-fit, minmax(180px, 1fr))',
          gap: '1rem',
          marginBottom: '1.5rem',
        }}
      >
        <div
          style={{
            backgroundColor: '#ffffff',
            borderRadius: '10px',
            border: '1px solid rgba(67, 78, 120, 0.2)',
            padding: '1rem 1.25rem',
            boxShadow: '0 4px 10px rgba(15, 23, 42, 0.05)',
          }}
        >
          <p style={{ margin: 0, fontSize: '0.75rem', color: '#6b7280' }}>Total Tasks</p>
          <p style={{ margin: '0.25rem 0 0', fontSize: '1.5rem', fontWeight: 600 }}>
            {tasks.length}
          </p>
        </div>

        <div
          style={{
            backgroundColor: '#ffffff',
            borderRadius: '10px',
            border: '1px solid rgba(67, 78, 120, 0.2)',
            padding: '1rem 1.25rem',
            boxShadow: '0 4px 10px rgba(15, 23, 42, 0.05)',
          }}
        >
          <p style={{ margin: 0, fontSize: '0.75rem', color: '#6b7280' }}>Open / In Progress</p>
          <p style={{ margin: '0.25rem 0 0', fontSize: '1.5rem', fontWeight: 600 }}>
            {
              tasks.filter(
                (t) => t.status.toLowerCase() === 'open' || t.status.toLowerCase() === 'in progress'
              ).length
            }
          </p>
        </div>

        <div
          style={{
            backgroundColor: '#ffffff',
            borderRadius: '10px',
            border: '1px solid rgba(67, 78, 120, 0.2)',
            padding: '1rem 1.25rem',
            boxShadow: '0 4px 10px rgba(15, 23, 42, 0.05)',
          }}
        >
          <p style={{ margin: 0, fontSize: '0.75rem', color: '#6b7280' }}>Completed</p>
          <p style={{ margin: '0.25rem 0 0', fontSize: '1.5rem', fontWeight: 600 }}>
            {tasks.filter((t) => t.status.toLowerCase() === 'completed').length}
          </p>
        </div>

        <div
          style={{
            backgroundColor: '#ffffff',
            borderRadius: '10px',
            border: '1px solid rgba(67, 78, 120, 0.2)',
            padding: '1rem 1.25rem',
            boxShadow: '0 4px 10px rgba(15, 23, 42, 0.05)',
          }}
        >
          <p style={{ margin: 0, fontSize: '0.75rem', color: '#6b7280' }}>Overdue</p>
          <p style={{ margin: '0.25rem 0 0', fontSize: '1.5rem', fontWeight: 600, color: '#b91c1c' }}>
            {tasks.filter((t) => isTaskOverdue(t)).length}
          </p>
        </div>
      </div>

      {/* Error / loading */}
      {loading && <p>Loading tasks...</p>}
      {error && !loading && (
        <p style={{ color: '#b91c1c', marginBottom: '1rem', fontSize: '0.9rem' }}>{error}</p>
      )}

      {/* Table card */}
      <div
        style={{
          backgroundColor: '#ffffff',
          borderRadius: '10px',
          border: '1px solid rgba(67, 78, 120, 0.2)',
          padding: '1.25rem',
          boxShadow: '0 4px 10px rgba(15, 23, 42, 0.05)',
        }}
      >
        <div
          style={{
            display: 'flex',
            justifyContent: 'space-between',
            alignItems: 'center',
            marginBottom: '0.75rem',
          }}
        >
          <h2 style={{ margin: 0, fontSize: '1rem', fontWeight: 600 }}>Recent Tasks</h2>
        </div>

        {!loading && tasks.length === 0 && !error && (
          <p style={{ color: '#6b7280', fontSize: '0.9rem' }}>No managed tasks yet.</p>
        )}

        {!loading && tasks.length > 0 && (
          <div style={{ overflowX: 'auto' }}>
            <table style={{ minWidth: '100%', fontSize: '0.85rem' }}>
              <thead>
                <tr style={{ backgroundColor: '#f3f4f6' }}>
                  <th style={{ textAlign: 'left', padding: '0.5rem' }}>Task ID</th>
                  <th style={{ textAlign: 'left', padding: '0.5rem' }}>Title</th>
                  <th style={{ textAlign: 'left', padding: '0.5rem' }}>Workflow</th>
                  <th style={{ textAlign: 'left', padding: '0.5rem' }}>SLA</th>
                  <th style={{ textAlign: 'left', padding: '0.5rem' }}>Status</th>
                  <th style={{ textAlign: 'left', padding: '0.5rem' }}>Created</th>
                </tr>
              </thead>
              <tbody>
                {tasks.map((task) => {
                  const overdue = isTaskOverdue(task);
                  const slaText = task.slaResponseTimeMinutes
                    ? `${task.slaPriority ?? 'N/A'} • ${formatDuration(
                        task.slaResponseTimeMinutes
                      )}`
                    : 'Not configured';

                  return (
                    <tr
                      key={task.taskId}
                      style={{ cursor: 'pointer', borderTop: '1px solid #e5e7eb' }}
                      onClick={() => navigate(`/tasks/${task.taskId}`)}
                    >
                      <td style={{ padding: '0.5rem', fontFamily: 'monospace' }}>#{task.taskId}</td>
                      <td style={{ padding: '0.5rem' }}>
                        {task.title}{' '}
                        {overdue && (
                          <span
                            style={{
                              color: '#b91c1c',
                              fontSize: '0.75rem',
                              marginLeft: '0.25rem',
                            }}
                          >
                            (Overdue)
                          </span>
                        )}
                      </td>
                      <td style={{ padding: '0.5rem' }}>{task.workflowName}</td>
                      <td style={{ padding: '0.5rem' }}>{slaText}</td>
                      <td style={{ padding: '0.5rem' }}>{overdue ? 'Overdue' : task.status}</td>
                      <td style={{ padding: '0.5rem', color: '#6b7280' }}>
                        {formatDateTime(task.createdAt)}
                      </td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
          </div>
        )}
      </div>
    </div>
  );
};

export default TaskManagerList;


