import {
  DndContext,
  DragOverlay,
  closestCorners,
  KeyboardSensor,
  PointerSensor,
  useSensor,
  useSensors,
  DragEndEvent,
} from '@dnd-kit/core';
import {
  arrayMove,
  SortableContext,
  sortableKeyboardCoordinates,
  verticalListSortingStrategy,
} from '@dnd-kit/sortable';
import { useState } from 'react';
import { Workflow, Task, TaskUpdate } from '../types';
import KanbanColumn from './KanbanColumn';
import TaskCard from './TaskCard';

interface KanbanBoardProps {
  workflow: Workflow;
  onTaskMove: (taskId: number, newStageId: number | null) => void;
  onTaskUpdate: (taskId: number, updates: Partial<TaskUpdate>) => void;
}

const KanbanBoard = ({ workflow, onTaskMove, onTaskUpdate }: KanbanBoardProps) => {
  const [activeTask, setActiveTask] = useState<Task | null>(null);
  const sensors = useSensors(
    useSensor(PointerSensor),
    useSensor(KeyboardSensor, {
      coordinateGetter: sortableKeyboardCoordinates,
    })
  );

  const sortedStages = [...workflow.stages].sort((a, b) => a.stageOrder - b.stageOrder);

  const getTasksByStage = (stageId: number | null) => {
    if (stageId === null) {
      return workflow.tasks.filter((t) => !t.stageId);
    }
    return workflow.tasks.filter((t) => t.stageId === stageId);
  };

  const handleDragStart = (event: any) => {
    const { active } = event;
    const task = workflow.tasks.find((t) => t.taskId === Number(active.id));
    setActiveTask(task || null);
  };

  const handleDragEnd = (event: DragEndEvent) => {
    const { active, over } = event;
    setActiveTask(null);

    if (!over) return;

    const taskId = Number(active.id);
    const overId = over.id.toString();

    // Check if dropped on a stage column
    if (overId.startsWith('stage-')) {
      const stageId = parseInt(overId.replace('stage-', ''));
      onTaskMove(taskId, stageId);
      return;
    }

    // Check if dropped on another task
    const targetTask = workflow.tasks.find((t) => t.taskId === Number(overId));
    if (targetTask) {
      onTaskMove(taskId, targetTask.stageId || null);
      return;
    }

    // Check if dropped on "Unassigned" column
    if (overId === 'unassigned') {
      onTaskMove(taskId, null);
    }
  };

  return (
    <DndContext
      sensors={sensors}
      collisionDetection={closestCorners}
      onDragStart={handleDragStart}
      onDragEnd={handleDragEnd}
    >
      <div className="flex gap-4 overflow-x-auto pb-4 scrollbar-thin font-sans">
        {/* Unassigned Tasks Column */}
        <div className="flex-shrink-0 w-80">
          <div className="bg-[#434E78]/5 rounded-azure-sm p-5 min-h-[600px] border-2 border-dashed border-[#434E78]/30">
            <div className="flex items-center justify-between mb-4 pb-3 border-b border-[#434E78]/20">
              <h2 className="font-semibold text-base text-black font-sans">Unassigned</h2>
              <span className="bg-[#434E78]/20 text-black text-xs font-semibold px-2 py-1 rounded-azure-sm font-sans">
                {getTasksByStage(null).length}
              </span>
            </div>
            <SortableContext
              items={getTasksByStage(null).map((t) => `task-${t.taskId}`)}
              strategy={verticalListSortingStrategy}
            >
              <div className="space-y-3">
                {getTasksByStage(null).length === 0 ? (
                  <div className="text-center py-8 text-black/50 text-sm font-sans">
                    No unassigned tasks
                  </div>
                ) : (
                  getTasksByStage(null).map((task) => (
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

        {/* Stage Columns */}
        {sortedStages.map((stage) => {
          const stageTasks = getTasksByStage(stage.stageId);
          return (
            <KanbanColumn
              key={stage.stageId}
              stage={stage}
              tasks={stageTasks}
              onTaskUpdate={onTaskUpdate}
            />
          );
        })}
      </div>

      <DragOverlay>
        {activeTask ? (
          <div className="bg-white p-4 rounded-azure-sm shadow-azure-xl border-2 border-[#434E78] w-72">
            <h3 className="font-semibold mb-2 text-black font-sans">{activeTask.taskName}</h3>
            <p className="text-sm text-black/70 font-sans">{activeTask.description}</p>
            <div className="mt-2 flex items-center gap-2">
              <span className="px-2 py-1 rounded-azure-sm text-xs font-medium font-sans bg-[#434E78]/10 text-black">
                {activeTask.priority}
              </span>
              <span className="px-2 py-1 rounded-azure-sm text-xs font-medium font-sans bg-[#434E78]/10 text-black">
                {activeTask.status}
              </span>
            </div>
          </div>
        ) : null}
      </DragOverlay>
    </DndContext>
  );
};

export default KanbanBoard;

