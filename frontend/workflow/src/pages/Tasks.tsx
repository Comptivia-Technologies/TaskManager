import { useEffect, useState, useCallback } from 'react';
import { taskService } from '../services/taskService';
import { workflowService } from '../services/workflowService';
import { Task, TaskStageHistory, Workflow } from '../types';
import LoadingSpinner from '../components/LoadingSpinner';
import TaskHistoryGraph from '../components/TaskHistoryGraph';
import { FiCheckCircle, FiClock, FiUser, FiLayers, FiCalendar, FiAlertCircle, FiX } from 'react-icons/fi';
import { useNavigate } from 'react-router-dom';
import { formatDateToIST } from '../utils/dateUtils';

const PAGE_SIZE = 10;
const PRIORITY_OPTIONS = ['All', 'Critical', 'High', 'Medium', 'Low'];

const Tasks = () => {
  const [tasks, setTasks] = useState<Task[]>([]);
  const [workflows, setWorkflows] = useState<Workflow[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [priorityFilter, setPriorityFilter] = useState<string>('All');
  const [page, setPage] = useState(1);
  const [totalCount, setTotalCount] = useState(0);
  const [totalPages, setTotalPages] = useState(0);
  const [historyTask, setHistoryTask] = useState<Task | null>(null);
  const [history, setHistory] = useState<TaskStageHistory[]>([]);
  const [historyLoading, setHistoryLoading] = useState(false);
  const [historyError, setHistoryError] = useState<string | null>(null);
  const navigate = useNavigate();

  const loadData = useCallback(async () => {
    try {
      setLoading(true);
      setError(null);
      const priority = priorityFilter === 'All' ? undefined : priorityFilter;
      const [paginated, workflowsData] = await Promise.all([
        taskService.getAllPaginated(priority, page, PAGE_SIZE),
        workflowService.getAll()
      ]);
      setTasks(paginated.data ?? []);
      setWorkflows(workflowsData ?? []);
      setTotalCount(paginated.totalCount);
      setTotalPages(paginated.totalPages);
    } catch (err) {
      setError('Failed to load tasks. Please try again.');
      console.error('Error loading data:', err);
    } finally {
      setLoading(false);
    }
  }, [priorityFilter, page]);

  useEffect(() => {
    loadData();
  }, [loadData]);

  const goToPage = (p: number) => {
    if (p >= 1 && p <= totalPages) setPage(p);
  };

  const pageNumbers = (() => {
    const maxVisible = 5;
    let start = Math.max(1, page - Math.floor(maxVisible / 2));
    let end = Math.min(totalPages, start + maxVisible - 1);
    if (end - start + 1 < maxVisible) start = Math.max(1, end - maxVisible + 1);
    return Array.from({ length: end - start + 1 }, (_, i) => start + i);
  })();

  // Refresh when window gains focus (user returns to tab)
  useEffect(() => {
    const handleFocus = () => {
      loadData();
    };
    
    window.addEventListener('focus', handleFocus);
    return () => window.removeEventListener('focus', handleFocus);
  }, [loadData]);

  // Refresh when page becomes visible (user switches back to tab)
  useEffect(() => {
    const handleVisibilityChange = () => {
      if (!document.hidden) {
        loadData();
      }
    };
    
    document.addEventListener('visibilitychange', handleVisibilityChange);
    return () => document.removeEventListener('visibilitychange', handleVisibilityChange);
  }, [loadData]);

  // Refresh on network reconnect
  useEffect(() => {
    const handleOnline = () => {
      loadData();
    };
    
    window.addEventListener('online', handleOnline);
    return () => window.removeEventListener('online', handleOnline);
  }, [loadData]);

  const getWorkflowName = (workflowId: string): string => {
    const workflow = workflows.find(w => w.workflowId === workflowId);
    return workflow?.workflowName || `Workflow #${workflowId}`;
  };

  const getStatusColor = (status: string, isOverdue?: boolean) => {
    if (isOverdue) {
      return 'bg-red-100 text-red-800 border-red-200';
    }
    const statusLower = status.toLowerCase();
    if (statusLower.includes('completed') || statusLower.includes('done')) {
      return 'bg-green-100 text-green-800 border-green-200';
    }
    if (statusLower.includes('progress') || statusLower.includes('active')) {
      return 'bg-blue-100 text-blue-800 border-blue-200';
    }
    if (statusLower.includes('assigned') || statusLower.includes('pending')) {
      return 'bg-yellow-100 text-yellow-800 border-yellow-200';
    }
    if (statusLower.includes('overdue')) {
      return 'bg-red-100 text-red-800 border-red-200';
    }
    return 'bg-gray-100 text-gray-800 border-gray-200';
  };

  const getPriorityColor = (priority: string) => {
    const priorityLower = priority.toLowerCase();
    if (priorityLower.includes('critical') || priorityLower.includes('very critical')) {
      return 'bg-red-100 text-red-800 border-red-200';
    }
    if (priorityLower.includes('high')) {
      return 'bg-orange-100 text-orange-800 border-orange-200';
    }
    if (priorityLower.includes('medium')) {
      return 'bg-yellow-100 text-yellow-800 border-yellow-200';
    }
    if (priorityLower.includes('low')) {
      return 'bg-green-100 text-green-800 border-green-200';
    }
    return 'bg-gray-100 text-gray-800 border-gray-200';
  };

  const formatDate = formatDateToIST;

  const openHistory = async (task: Task, event: React.MouseEvent) => {
    event.stopPropagation();
    setHistoryTask(task);
    setHistory([]);
    setHistoryError(null);
    setHistoryLoading(true);
    try {
      const rows = await taskService.getHistory(task.taskId);
      setHistory(rows);
    } catch (err) {
      setHistoryError('Failed to load history.');
      console.error('Error loading task history:', err);
    } finally {
      setHistoryLoading(false);
    }
  };

  const closeHistory = () => {
    setHistoryTask(null);
    setHistory([]);
    setHistoryError(null);
  };

  const actionColor = (action: string) => {
    if (action === 'Completed') return 'bg-green-100 text-green-800 border-green-200';
    if (action === 'Returned') return 'bg-orange-100 text-orange-800 border-orange-200';
    return 'bg-blue-100 text-blue-800 border-blue-200';
  };

  if (loading) {
    return <LoadingSpinner />;
  }

  return (
    <div className="p-8 lg:p-10 bg-white min-h-screen font-sans">
      <div className="max-w-7xl mx-auto">
        {/* Header */}
        <div className="mb-8">
          <h1 className="text-4xl font-semibold text-black mb-2 font-sans tracking-tight">
            Tasks
          </h1>
          <p className="text-black/70 text-base font-sans">
            View and manage all tasks across workflows
          </p>
        </div>

        {error && (
          <div className="mb-6 p-4 bg-red-50 border border-red-200 rounded-azure-sm text-red-800">
            {error}
          </div>
        )}

        {/* Summary Stats */}
        <div className="mb-6 grid grid-cols-1 md:grid-cols-4 gap-4">
            <div className="bg-white rounded-azure-sm shadow-azure-sm p-4 border border-[#434E78]/20">
              <div className="flex items-center justify-between">
                <div>
                  <p className="text-xs text-black/60 font-sans uppercase tracking-wide">Total Tasks</p>
                  <p className="text-2xl font-semibold text-black font-sans mt-1">{totalCount}</p>
                </div>
                <FiCheckCircle className="text-[#434E78] text-2xl" />
              </div>
            </div>
            <div className="bg-white rounded-azure-sm shadow-azure-sm p-4 border border-[#434E78]/20">
              <div className="flex items-center justify-between">
                <div>
                  <p className="text-xs text-black/60 font-sans uppercase tracking-wide">Completed</p>
                  <p className="text-2xl font-semibold text-black font-sans mt-1">
                    {tasks.filter(t => t.status.toLowerCase().includes('completed') || t.status.toLowerCase().includes('done')).length}
                  </p>
                </div>
                <FiCheckCircle className="text-[#434E78] text-2xl" />
              </div>
            </div>
            <div className="bg-white rounded-azure-sm shadow-azure-sm p-4 border border-[#434E78]/20">
              <div className="flex items-center justify-between">
                <div>
                  <p className="text-xs text-black/60 font-sans uppercase tracking-wide">In Progress</p>
                  <p className="text-2xl font-semibold text-black font-sans mt-1">
                    {tasks.filter(t => t.status.toLowerCase().includes('progress') || t.status.toLowerCase().includes('active')).length}
                  </p>
                </div>
                <FiClock className="text-[#434E78] text-2xl" />
              </div>
            </div>
            <div className="bg-white rounded-azure-sm shadow-azure-sm p-4 border border-[#434E78]/20">
              <div className="flex items-center justify-between">
                <div>
                  <p className="text-xs text-black/60 font-sans uppercase tracking-wide">Overdue</p>
                  <p className="text-2xl font-semibold text-black font-sans mt-1">
                    {tasks.filter(t => t.isOverdue || t.status.toLowerCase().includes('overdue')).length}
                  </p>
                </div>
                <FiAlertCircle className="text-red-500 text-2xl" />
              </div>
            </div>
          </div>

        {/* Priority filter & pagination info */}
        <div className="mb-4 flex flex-wrap items-center justify-end gap-4">
          <div className="flex items-center gap-2">
            <label htmlFor="priority-filter" className="text-sm font-medium text-black/70 font-sans">
              Priority
            </label>
            <select
              id="priority-filter"
              value={priorityFilter}
              onChange={(e) => {
                setPriorityFilter(e.target.value);
                setPage(1);
              }}
              className="rounded-azure-sm border border-[#434E78]/30 px-3 py-2 text-sm font-sans focus:outline-none focus:ring-2 focus:ring-[#434E78]/50"
            >
              {PRIORITY_OPTIONS.map((opt) => (
                <option key={opt} value={opt}>
                  {opt}
                </option>
              ))}
            </select>
          </div>
          {totalPages > 0 && (
            <span className="text-sm text-black/60 font-sans">
              Page {page} of {totalPages} ({totalCount} tasks)
            </span>
          )}
        </div>

        {/* Tasks Table */}
        <div className="bg-white rounded-azure-sm shadow-azure-md border border-[#434E78]/20 overflow-hidden">
          {tasks.length === 0 ? (
            <div className="text-center py-12">
              <div className="bg-[#434E78]/10 rounded-full w-20 h-20 flex items-center justify-center mx-auto mb-4">
                <FiCheckCircle className="text-[#434E78] text-4xl" />
              </div>
              <p className="text-black/70 text-base font-sans">No tasks found. Create your first task to get started.</p>
            </div>
          ) : (
            <div className="overflow-x-auto">
              <table className="w-full">
                <thead className="bg-[#434E78]/5 border-b border-[#434E78]/20">
                  <tr>
                    <th className="px-6 py-4 text-left text-xs font-semibold text-black uppercase tracking-wider font-sans">
                      Task Name
                    </th>
                    <th className="px-6 py-4 text-left text-xs font-semibold text-black uppercase tracking-wider font-sans">
                      Status
                    </th>
                    <th className="px-6 py-4 text-left text-xs font-semibold text-black uppercase tracking-wider font-sans">
                      Priority
                    </th>
                    <th className="px-6 py-4 text-left text-xs font-semibold text-black uppercase tracking-wider font-sans">
                      Assigned To
                    </th>
                    <th className="px-6 py-4 text-left text-xs font-semibold text-black uppercase tracking-wider font-sans">
                      Workflow
                    </th>
                    <th className="px-6 py-4 text-left text-xs font-semibold text-black uppercase tracking-wider font-sans">
                      Stage
                    </th>
                    <th className="px-6 py-4 text-left text-xs font-semibold text-black uppercase tracking-wider font-sans">
                      Due Date
                    </th>
                    <th className="px-6 py-4 text-left text-xs font-semibold text-black uppercase tracking-wider font-sans">
                      Created
                    </th>
                    <th className="px-6 py-4 text-left text-xs font-semibold text-black uppercase tracking-wider font-sans">
                      History
                    </th>
                  </tr>
                </thead>
                <tbody className="bg-white divide-y divide-[#434E78]/10">
                  {tasks.map((task) => (
                    <tr
                      key={task.taskId}
                      className="hover:bg-[#434E78]/5 transition-colors duration-150 cursor-pointer"
                      onClick={() => navigate(`/tasks/${task.taskId}`)}
                    >
                      <td className="px-6 py-4 whitespace-nowrap">
                        <div className="flex items-center">
                          <div>
                            <div className="text-sm font-semibold text-black font-sans">
                              {task.taskName}
                            </div>
                            {task.description && (
                              <div className="text-xs text-black/60 font-sans mt-1 line-clamp-1">
                                {task.description}
                              </div>
                            )}
                          </div>
                        </div>
                      </td>
                      <td className="px-6 py-4 whitespace-nowrap">
                        <span
                          className={`inline-flex items-center px-2.5 py-1 rounded-azure-sm text-xs font-medium border ${getStatusColor(
                            task.status,
                            task.isOverdue
                          )} font-sans`}
                        >
                          {task.isOverdue ? 'Overdue' : task.status}
                        </span>
                      </td>
                      <td className="px-6 py-4 whitespace-nowrap">
                        <span
                          className={`inline-flex items-center px-2.5 py-1 rounded-azure-sm text-xs font-medium border ${getPriorityColor(
                            task.priority
                          )} font-sans`}
                        >
                          {task.priority}
                        </span>
                      </td>
                      <td className="px-6 py-4 whitespace-nowrap">
                        {task.assignedToMemberName ? (
                          <div className="flex items-center text-sm text-black font-sans">
                            <FiUser className="mr-2 text-[#434E78]/60" />
                            {task.assignedToMemberName}
                          </div>
                        ) : (
                          <span className="text-sm text-black/40 font-sans italic">Unassigned</span>
                        )}
                      </td>
                      <td className="px-6 py-4 whitespace-nowrap">
                        <div className="flex items-center text-sm text-black font-sans">
                          <FiLayers className="mr-2 text-[#434E78]/60" />
                          <span
                            className="hover:text-[#434E78] cursor-pointer"
                            onClick={(e) => {
                              e.stopPropagation();
                              navigate(`/workflows/${task.workflowId}`);
                            }}
                          >
                            {getWorkflowName(task.workflowId)}
                          </span>
                        </div>
                      </td>
                      <td className="px-6 py-4 whitespace-nowrap">
                        {task.stageName ? (
                          <span className="inline-flex items-center px-2.5 py-1 rounded-azure-sm text-xs font-medium bg-purple-100 text-purple-800 border border-purple-200 font-sans">
                            {task.stageName}
                          </span>
                        ) : (
                          <span className="text-sm text-black/40 font-sans italic">No stage</span>
                        )}
                      </td>
                      <td className="px-6 py-4 whitespace-nowrap">
                        {task.dueDate ? (
                          <div className="flex items-center text-sm text-black font-sans">
                            <FiCalendar className="mr-2 text-[#434E78]/60" />
                            {formatDate(task.dueDate)}
                          </div>
                        ) : (
                          <span className="text-sm text-black/40 font-sans">No due date</span>
                        )}
                      </td>
                      <td className="px-6 py-4 whitespace-nowrap text-sm text-black/60 font-sans">
                        {formatDate(task.createdAt)}
                      </td>
                      <td className="px-6 py-4 whitespace-nowrap">
                        <button
                          type="button"
                          title="View history"
                          aria-label={`View history for ${task.taskName}`}
                          onClick={(event) => openHistory(task, event)}
                          className="inline-flex items-center justify-center w-8 h-8 rounded-azure-sm text-[#434E78] hover:bg-[#434E78]/10"
                        >
                          <FiClock className="text-lg" />
                        </button>
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          )}
        </div>

        {/* Pagination */}
        <div className="mt-4 flex flex-wrap items-center justify-end gap-2">
          <button
            type="button"
            onClick={() => goToPage(page - 1)}
            disabled={page <= 1}
            className="px-3 py-1.5 rounded-azure-sm border border-[#434E78]/30 text-sm font-sans disabled:opacity-50 disabled:cursor-not-allowed hover:bg-[#434E78]/5"
          >
            Prev
          </button>
          {pageNumbers.map((p) => (
            <button
              key={p}
              type="button"
              onClick={() => goToPage(p)}
              className={`min-w-[2rem] px-3 py-1.5 rounded-azure-sm border text-sm font-sans ${
                p === page
                  ? 'bg-[#434E78] text-white border-[#434E78]'
                  : 'border-[#434E78]/30 hover:bg-[#434E78]/5'
              }`}
            >
              {p}
            </button>
          ))}
          <button
            type="button"
            onClick={() => goToPage(page + 1)}
            disabled={page >= totalPages}
            className="px-3 py-1.5 rounded-azure-sm border border-[#434E78]/30 text-sm font-sans disabled:opacity-50 disabled:cursor-not-allowed hover:bg-[#434E78]/5"
          >
            Next
          </button>
        </div>
      </div>

      {historyTask && (
        <div className="fixed inset-0 bg-black/50 flex items-center justify-center z-50 backdrop-blur-sm p-4">
          <div className="bg-white rounded-azure-sm shadow-azure-xl w-full max-w-4xl border border-[#434E78]/20 max-h-[80vh] flex flex-col">
            <div className="flex justify-between items-center px-6 py-4 border-b border-[#434E78]/10">
              <div>
                <h2 className="text-xl font-semibold text-black font-sans">History</h2>
                <p className="text-sm text-black/60 font-sans">{historyTask.taskName}</p>
              </div>
              <button
                type="button"
                onClick={closeHistory}
                aria-label="Close history"
                className="text-black/70 hover:text-black hover:bg-[#434E78]/10 p-1 rounded-azure-sm"
              >
                <FiX className="text-lg" />
              </button>
            </div>
            <div className="overflow-y-auto px-6 py-4">
              {historyLoading && (
                <p className="text-sm text-black/60 font-sans py-6 text-center">Loading history...</p>
              )}
              {historyError && (
                <p className="text-sm text-red-600 font-sans py-6 text-center">{historyError}</p>
              )}
              {!historyLoading && !historyError && history.length === 0 && (
                <p className="text-sm text-black/60 font-sans py-6 text-center">No history yet.</p>
              )}
              {!historyLoading && !historyError && history.length > 0 && (
                <>
                  <TaskHistoryGraph history={history} currentStageId={historyTask.stageId} />
                  <ol className="space-y-3">
                  {history.map((entry) => (
                    <li key={entry.historyId} className="border border-[#434E78]/15 rounded-azure-sm px-4 py-3">
                      <div className="flex items-center justify-between gap-3">
                        <span className={`inline-flex items-center px-2.5 py-1 rounded-azure-sm text-xs font-medium border font-sans ${actionColor(entry.action)}`}>
                          {entry.action}
                        </span>
                        <span className="text-xs text-black/60 font-sans">{formatDate(entry.occurredAt)}</span>
                      </div>
                      <p className="mt-2 text-sm text-black font-sans">
                        {entry.memberName} · {entry.stageName}
                      </p>
                      {(entry.fromStageName || entry.toStageName) && (
                        <p className="mt-1 text-xs text-black/70 font-sans">
                          {entry.fromStageName || '—'} → {entry.toStageName || '—'}
                        </p>
                      )}
                      {entry.reason && (
                        <p className="mt-1 text-xs text-black/70 font-sans">{entry.reason}</p>
                      )}
                    </li>
                  ))}
                </ol>
                </>
              )}
            </div>
          </div>
        </div>
      )}
    </div>
  );
};

export default Tasks;

