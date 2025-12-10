import { useDroppable } from '@dnd-kit/core';
import { SortableContext, verticalListSortingStrategy } from '@dnd-kit/sortable';
import { Stage, Task, TaskUpdate } from '../types';
import TaskCard from './TaskCard';

interface KanbanColumnProps {
  stage: Stage;
  tasks: Task[];
  onTaskUpdate: (taskId: number, updates: Partial<TaskUpdate>) => void;
}

const KanbanColumn = ({ stage, tasks, onTaskUpdate }: KanbanColumnProps) => {
  const { setNodeRef } = useDroppable({
    id: `stage-${stage.stageId}`,
  });

  return (
    <div className="flex-shrink-0 w-80 font-sans">
      <div
        ref={setNodeRef}
        className="bg-gradient-to-b from-blue-50 to-blue-100 rounded-xl p-5 min-h-[600px] border-2 border-blue-200 shadow-sm"
      >
        <div className="mb-4 pb-3 border-b border-blue-200">
          <div className="flex items-center justify-between mb-2">
            <div className="flex items-center gap-2">
              <span className="bg-blue-500 text-white text-xs font-bold px-2 py-1 rounded font-sans">
                #{stage.stageOrder}
              </span>
              <h2 className="font-bold text-lg text-gray-800 font-sans">
                {stage.stageName}
              </h2>
            </div>
            <span className="bg-blue-200 text-blue-800 text-xs font-semibold px-2 py-1 rounded-full font-sans">
              {tasks.length}
            </span>
          </div>
          {stage.teamName && (
            <div className="flex items-center gap-2 mt-2">
              <span className="text-xs text-gray-500 font-medium font-sans">Team:</span>
              <span className="bg-indigo-100 text-indigo-700 text-xs font-semibold px-2 py-1 rounded-md font-sans">
                {stage.teamName}
              </span>
            </div>
          )}
        </div>
        <SortableContext
          items={tasks.map((t) => `task-${t.taskId}`)}
          strategy={verticalListSortingStrategy}
        >
          <div className="space-y-3">
            {tasks.length === 0 ? (
              <div className="text-center py-8 text-gray-400 text-sm font-sans">
                No tasks in this stage
              </div>
            ) : (
              tasks.map((task) => (
                <TaskCard
                  key={task.taskId}
                  task={task}
                  onUpdate={(updates) => onTaskUpdate(task.taskId, updates)}
                />
              ))
            )}
          </div>
        </SortableContext>
      </div>
    </div>
  );
};

export default KanbanColumn;

