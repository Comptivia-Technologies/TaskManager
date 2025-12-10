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
      <div className="flex gap-4 overflow-x-auto pb-4 scrollbar-thin scrollbar-thumb-gray-300 scrollbar-track-gray-100">
        {/* Unassigned Tasks Column */}
        <div className="flex-shrink-0 w-80">
          <div className="bg-gradient-to-b from-gray-50 to-gray-100 rounded-xl p-5 min-h-[600px] border-2 border-dashed border-gray-300">
            <div className="flex items-center justify-between mb-4">
              <h2 className="font-bold text-lg text-gray-700">Unassigned</h2>
              <span className="bg-gray-200 text-gray-700 text-xs font-semibold px-2 py-1 rounded-full">
                {getTasksByStage(null).length}
              </span>
            </div>
            <SortableContext
              items={getTasksByStage(null).map((t) => `task-${t.taskId}`)}
              strategy={verticalListSortingStrategy}
            >
              <div className="space-y-3">
                {getTasksByStage(null).length === 0 ? (
                  <div className="text-center py-8 text-gray-400 text-sm">
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
          <div className="bg-white p-4 rounded-lg shadow-lg border-2 border-blue-500 w-72">
            <h3 className="font-bold mb-2">{activeTask.taskName}</h3>
            <p className="text-sm text-gray-600">{activeTask.description}</p>
            <div className="mt-2 flex items-center gap-2">
              <span
                className={`px-2 py-1 rounded text-xs ${
                  activeTask.priority === 'High'
                    ? 'bg-red-100 text-red-800'
                    : activeTask.priority === 'Medium'
                    ? 'bg-yellow-100 text-yellow-800'
                    : 'bg-green-100 text-green-800'
                }`}
              >
                {activeTask.priority}
              </span>
              <span
                className={`px-2 py-1 rounded text-xs ${
                  activeTask.status === 'Completed'
                    ? 'bg-green-100 text-green-800'
                    : activeTask.status === 'In Progress'
                    ? 'bg-blue-100 text-blue-800'
                    : 'bg-gray-100 text-gray-800'
                }`}
              >
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

