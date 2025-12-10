import { useSortable } from '@dnd-kit/sortable';
import { CSS } from '@dnd-kit/utilities';
import { Task, TaskUpdate } from '../types';
import { useState } from 'react';
import { FiEdit2, FiX } from 'react-icons/fi';

interface TaskCardProps {
  task: Task;
  onUpdate: (updates: Partial<TaskUpdate>) => void;
}

const TaskCard = ({ task, onUpdate }: TaskCardProps) => {
  const { attributes, listeners, setNodeRef, transform, transition, isDragging } =
    useSortable({
      id: `task-${task.taskId}`,
    });

  const [isEditing, setIsEditing] = useState(false);
  const [editForm, setEditForm] = useState({
    status: task.status,
    priority: task.priority,
  });

  const style = {
    transform: CSS.Transform.toString(transform),
    transition,
    opacity: isDragging ? 0.5 : 1,
  };

  const handleSave = () => {
    onUpdate(editForm);
    setIsEditing(false);
  };

  const priorityColors = {
    High: 'bg-red-100 text-red-800',
    Medium: 'bg-yellow-100 text-yellow-800',
    Low: 'bg-green-100 text-green-800',
  };

  const statusColors = {
    Completed: 'bg-green-100 text-green-800',
    'In Progress': 'bg-blue-100 text-blue-800',
    Pending: 'bg-gray-100 text-gray-800',
  };

  return (
    <div
      ref={setNodeRef}
      style={style}
      {...attributes}
      {...listeners}
      className="bg-white p-4 rounded-lg shadow-md border-l-4 border-blue-500 hover:shadow-xl transition-all cursor-move hover:border-blue-600"
    >
      <div className="flex justify-between items-start mb-2">
        <h3 className="font-bold text-sm text-gray-900">{task.taskName}</h3>
        {isEditing ? (
          <button
            onClick={(e) => {
              e.stopPropagation();
              handleSave();
            }}
            className="text-green-600 hover:text-green-800 hover:bg-green-50 p-1 rounded transition-colors"
            title="Save changes"
          >
            <FiX />
          </button>
        ) : (
          <button
            onClick={(e) => {
              e.stopPropagation();
              setIsEditing(true);
            }}
            className="text-blue-600 hover:text-blue-800 hover:bg-blue-50 p-1 rounded transition-colors"
            title="Edit task"
          >
            <FiEdit2 />
          </button>
        )}
      </div>

      {task.description && (
        <p className="text-xs text-gray-600 mb-3 line-clamp-2">{task.description}</p>
      )}

      {isEditing ? (
        <div className="space-y-2">
          <select
            value={editForm.status}
            onChange={(e) =>
              setEditForm({ ...editForm, status: e.target.value })
            }
            onClick={(e) => e.stopPropagation()}
            className="w-full text-xs px-2 py-1 border border-gray-300 rounded"
          >
            <option value="Pending">Pending</option>
            <option value="In Progress">In Progress</option>
            <option value="Completed">Completed</option>
          </select>
          <select
            value={editForm.priority}
            onChange={(e) =>
              setEditForm({ ...editForm, priority: e.target.value })
            }
            onClick={(e) => e.stopPropagation()}
            className="w-full text-xs px-2 py-1 border border-gray-300 rounded"
          >
            <option value="Low">Low</option>
            <option value="Medium">Medium</option>
            <option value="High">High</option>
          </select>
        </div>
      ) : (
        <div className="flex flex-wrap gap-2 mt-2">
          <span
            className={`px-2 py-1 rounded text-xs ${
              priorityColors[editForm.priority as keyof typeof priorityColors] ||
              priorityColors.Medium
            }`}
          >
            {editForm.priority}
          </span>
          <span
            className={`px-2 py-1 rounded text-xs ${
              statusColors[editForm.status as keyof typeof statusColors] ||
              statusColors.Pending
            }`}
          >
            {editForm.status}
          </span>
        </div>
      )}

      <div className="mt-3 pt-3 border-t border-gray-100 space-y-1.5">
        {task.stageName && (
          <div className="flex items-center text-xs text-gray-600">
            <span className="font-medium mr-1">Stage:</span>
            <span className="text-blue-700 font-semibold">{task.stageName}</span>
          </div>
        )}
        
        {task.dueDate && (
          <div className="flex items-center text-xs text-gray-600">
            <span className="font-medium mr-1">Due:</span>
            <span className={new Date(task.dueDate) < new Date() ? 'text-red-600 font-semibold' : 'text-gray-900'}>
              {new Date(task.dueDate).toLocaleDateString()}
            </span>
          </div>
        )}

        {task.assignedToMemberName && (
          <div className="flex items-center text-xs text-gray-600">
            <span className="font-medium mr-1">Assigned:</span>
            <span className="text-indigo-700 font-semibold">{task.assignedToMemberName}</span>
          </div>
        )}
      </div>
    </div>
  );
};

export default TaskCard;

