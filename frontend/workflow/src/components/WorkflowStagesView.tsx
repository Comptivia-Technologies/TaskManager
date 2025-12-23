import { useState, useEffect } from 'react';
import { Workflow, Stage } from '../types';
import { FiUsers, FiArrowRight, FiCheckCircle, FiClock } from 'react-icons/fi';

interface WorkflowStagesViewProps {
  workflow: Workflow;
}

const WorkflowStagesView = ({ workflow }: WorkflowStagesViewProps) => {
  const [visibleStages, setVisibleStages] = useState<number[]>([]);
  const sortedStages = [...(workflow.stages || [])].sort((a, b) => a.stageOrder - b.stageOrder);

  useEffect(() => {
    // Animate stages appearing one by one
    const timer = setTimeout(() => {
      sortedStages.forEach((_, index) => {
        setTimeout(() => {
          setVisibleStages((prev) => [...prev, index]);
        }, index * 150);
      });
    }, 100);
    return () => clearTimeout(timer);
  }, [workflow.workflowId]);

  return (
    <div className="space-y-4 font-sans">
      {/* Workflow Overview Card */}
      <div className="bg-gradient-to-r from-[#434E78]/10 via-[#434E78]/5 to-white rounded-azure-sm p-4 border border-[#434E78]/20 shadow-azure-sm animate-fade-in">
        <div className="flex items-center justify-between mb-2">
          <h2 className="text-lg font-semibold text-black font-sans">Workflow Overview</h2>
          <div className="flex items-center gap-3 text-xs">
            <div className="flex items-center gap-1.5">
              <FiClock className="text-[#434E78] text-sm" />
              <span className="text-black/70 font-sans">Created:</span>
              <span className="text-black font-semibold font-sans">
                {new Date(workflow.createdAt).toLocaleDateString()}
              </span>
            </div>
          </div>
        </div>
        <p className="text-black/80 text-sm leading-relaxed font-sans">
          {workflow.description || 'No description provided for this workflow.'}
        </p>
      </div>

      {/* Stages Timeline */}
      <div className="relative">
        {/* Connection Line */}
        <div className="absolute left-6 top-0 bottom-0 w-0.5 bg-gradient-to-b from-[#434E78]/30 via-[#434E78]/20 to-transparent hidden md:block"></div>

        <div className="space-y-3">
          {sortedStages.map((stage, index) => {
            const isVisible = visibleStages.includes(index);
            const isLast = index === sortedStages.length - 1;

            return (
              <div
                key={stage.stageId}
                className={`relative flex items-start gap-4 animate-slide-in ${
                  isVisible ? 'opacity-100 translate-x-0' : 'opacity-0 translate-x-[-20px]'
                } transition-all duration-500`}
                style={{ transitionDelay: `${index * 100}ms` }}
              >
                {/* Stage Number Circle */}
                <div className="relative z-10 flex-shrink-0">
                  <div
                    className={`w-10 h-10 rounded-full flex items-center justify-center border-2 transition-all duration-500 ${
                      isVisible
                        ? 'bg-[#434E78] border-white shadow-azure-md scale-100'
                        : 'bg-[#434E78]/30 border-[#434E78]/20 scale-90'
                    }`}
                  >
                    <span className="text-white text-sm font-bold font-sans">{stage.stageOrder}</span>
                  </div>
                  {!isLast && (
                    <div className="absolute top-10 left-1/2 transform -translate-x-1/2 w-0.5 h-3 bg-[#434E78]/20 hidden md:block"></div>
                  )}
                </div>

                {/* Stage Content Card */}
                <div
                  className={`flex-1 bg-white rounded-azure-sm border border-[#434E78]/20 shadow-azure-sm p-4 hover:shadow-azure-md transition-all duration-300 hover:border-[#434E78]/40 ${
                    isVisible ? 'translate-y-0' : 'translate-y-4'
                  }`}
                >
                  <div className="flex items-start justify-between mb-2">
                    <div className="flex-1">
                      <h3 className="text-lg font-semibold text-black mb-1.5 font-sans">
                        {stage.stageName}
                      </h3>
                      {stage.teamName && (
                        <div className="flex items-center gap-1.5 mt-2">
                          <FiUsers className="text-[#434E78] text-sm" />
                          <span className="text-xs text-black/70 font-sans">Team:</span>
                          <span className="px-2 py-1 bg-[#434E78]/10 text-[#434E78] rounded-azure-sm text-xs font-semibold font-sans border border-[#434E78]/20">
                            {stage.teamName}
                          </span>
                        </div>
                      )}
                    </div>
                    <div className="flex items-center gap-2">
                      <div className="px-2 py-1 bg-emerald-50 text-emerald-700 rounded-azure-sm text-xs font-semibold font-sans border border-emerald-200">
                        #{stage.stageOrder}
                      </div>
                    </div>
                  </div>

                  {/* Stage Details */}
                  <div className="grid grid-cols-2 gap-3 mt-3 pt-3 border-t border-[#434E78]/10">
                    <div className="flex items-center gap-2">
                      <div className="w-7 h-7 rounded-full bg-[#434E78]/10 flex items-center justify-center">
                        <FiCheckCircle className="text-[#434E78] text-sm" />
                      </div>
                      <div>
                        <p className="text-xs text-black/60 font-sans">ID</p>
                        <p className="text-xs font-semibold text-black font-sans">#{stage.stageId}</p>
                      </div>
                    </div>
                    <div className="flex items-center gap-2">
                      <div className="w-7 h-7 rounded-full bg-[#434E78]/10 flex items-center justify-center">
                        <FiArrowRight className="text-[#434E78] text-sm" />
                      </div>
                      <div>
                        <p className="text-xs text-black/60 font-sans">Order</p>
                        <p className="text-xs font-semibold text-black font-sans">Pos {stage.stageOrder}</p>
                      </div>
                    </div>
                  </div>
                </div>
              </div>
            );
          })}
        </div>
      </div>

      {/* Summary Card */}
      <div className="bg-gradient-to-r from-[#434E78]/5 to-white rounded-azure-sm p-4 border border-[#434E78]/20 shadow-azure-sm animate-fade-in">
        <div className="grid grid-cols-1 md:grid-cols-3 gap-3">
          <div className="text-center p-3 bg-white rounded-azure-sm border border-[#434E78]/10">
            <div className="text-2xl font-bold text-[#434E78] mb-1 font-sans">
              {sortedStages.length}
            </div>
            <div className="text-xs text-black/70 font-sans">Total Stages</div>
          </div>
          <div className="text-center p-3 bg-white rounded-azure-sm border border-[#434E78]/10">
            <div className="text-2xl font-bold text-[#434E78] mb-1 font-sans">
              {sortedStages.filter((s) => s.teamName).length}
            </div>
            <div className="text-xs text-black/70 font-sans">With Teams</div>
          </div>
          <div className="text-center p-3 bg-white rounded-azure-sm border border-[#434E78]/10">
            <div className="text-2xl font-bold text-[#434E78] mb-1 font-sans">
              {new Set(sortedStages.map((s) => s.teamName).filter(Boolean)).size}
            </div>
            <div className="text-xs text-black/70 font-sans">Unique Teams</div>
          </div>
        </div>
      </div>
    </div>
  );
};

export default WorkflowStagesView;

