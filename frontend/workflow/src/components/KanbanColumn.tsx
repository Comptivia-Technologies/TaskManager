import { useDroppable } from '@dnd-kit/core';
import { SortableContext, verticalListSortingStrategy } from '@dnd-kit/sortable';
import { Stage, Task, TaskUpdate } from '../types';
import TaskCard from './TaskCard';

interface KanbanColumnProps {
  stage: Stage;
  tasks: Task[];
  onTaskUpdate: (taskId: string, updates: Partial<TaskUpdate>) => void;
}

const KanbanColumn = ({ stage, tasks, onTaskUpdate }: KanbanColumnProps) => {
  const { setNodeRef } = useDroppable({
    id: `stage-${stage.stageId}`,
  });

  return (
    <div className="flex-shrink-0 w-80 font-sans">
      <div
        ref={setNodeRef}
        className="bg-[#434E78]/10 rounded-azure-sm p-5 min-h-[600px] border border-[#434E78]/30 shadow-azure-sm"
      >
        <div className="mb-4 pb-3 border-b border-[#434E78]/20">
          <div className="flex items-center justify-between mb-2">
            <div className="flex items-center gap-2">
              <span className="bg-[#434E78] text-white text-xs font-semibold px-2 py-1 rounded-azure-sm font-sans">
                #{stage.stageOrder}
              </span>
              <h2 className="font-semibold text-base text-black font-sans">
                {stage.stageName}
              </h2>
            </div>
            <span className="bg-[#434E78]/20 text-black text-xs font-semibold px-2 py-1 rounded-azure-sm font-sans">
              {tasks.length}
            </span>
          </div>
          {stage.teamName && (
            <div className="flex items-center gap-2 mt-2">
              <span className="text-xs text-black/60 font-medium font-sans">Team:</span>
              <span className="bg-[#434E78]/20 text-black text-xs font-semibold px-2 py-1 rounded-azure-sm font-sans">
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
              <div className="text-center py-8 text-black/50 text-sm font-sans">
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

