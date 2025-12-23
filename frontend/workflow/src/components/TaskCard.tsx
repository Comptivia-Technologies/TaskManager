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

  return (
    <div
      ref={setNodeRef}
      style={style}
      {...attributes}
      {...listeners}
      className="bg-white p-4 rounded-azure-sm shadow-azure-sm border-l-4 border-[#434E78] hover:shadow-azure-md transition-all cursor-move hover:border-[#434E78]/80 font-sans"
    >
      <div className="flex justify-between items-start mb-2">
        <h3 className="font-semibold text-sm text-black font-sans">{task.taskName}</h3>
        {isEditing ? (
          <button
            onClick={(e) => {
              e.stopPropagation();
              handleSave();
            }}
            className="text-[#434E78] hover:text-[#434E78]/80 hover:bg-[#434E78]/10 p-1 rounded-azure-sm transition-colors"
            title="Save changes"
          >
            <FiX className="text-sm" />
          </button>
        ) : (
          <button
            onClick={(e) => {
              e.stopPropagation();
              setIsEditing(true);
            }}
            className="text-[#434E78] hover:text-[#434E78]/80 hover:bg-[#434E78]/10 p-1 rounded-azure-sm transition-colors"
            title="Edit task"
          >
            <FiEdit2 className="text-sm" />
          </button>
        )}
      </div>

      {task.description && (
        <p className="text-xs text-black/70 mb-3 line-clamp-2 font-sans">{task.description}</p>
      )}

      {isEditing ? (
        <div className="space-y-2">
          <select
            value={editForm.status}
            onChange={(e) =>
              setEditForm({ ...editForm, status: e.target.value })
            }
            onClick={(e) => e.stopPropagation()}
            className="w-full text-xs px-2 py-1 border border-[#434E78]/30 rounded-azure-sm bg-white font-sans"
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
            className="w-full text-xs px-2 py-1 border border-[#434E78]/30 rounded-azure-sm bg-white font-sans"
          >
            <option value="Low">Low</option>
            <option value="Medium">Medium</option>
            <option value="High">High</option>
          </select>
        </div>
      ) : (
        <div className="flex flex-wrap gap-2 mt-2">
          <span className="px-2 py-1 rounded-azure-sm text-xs font-medium font-sans bg-[#434E78]/10 text-black">
            {editForm.priority}
          </span>
          <span className="px-2 py-1 rounded-azure-sm text-xs font-medium font-sans bg-[#434E78]/10 text-black">
            {editForm.status}
          </span>
        </div>
      )}

      <div className="mt-3 pt-3 border-t border-[#434E78]/10 space-y-1.5">
        {task.stageName && (
          <div className="flex items-center text-xs text-black/70 font-sans">
            <span className="font-medium mr-1">Stage:</span>
            <span className="text-black font-semibold">{task.stageName}</span>
          </div>
        )}
        
        {task.dueDate && (
          <div className="flex items-center text-xs text-black/70 font-sans">
            <span className="font-medium mr-1">Due:</span>
            <span className={new Date(task.dueDate) < new Date() ? 'text-red-600 font-semibold' : 'text-black'}>
              {new Date(task.dueDate).toLocaleDateString()}
            </span>
          </div>
        )}

        {task.assignedToMemberName && (
          <div className="flex items-center text-xs text-black/70 font-sans">
            <span className="font-medium mr-1">Assigned:</span>
            <span className="text-black font-semibold">{task.assignedToMemberName}</span>
          </div>
        )}
      </div>
    </div>
  );
};

export default TaskCard;

