import { useState, useEffect } from 'react';
import { useWorkflows } from '../hooks/useWorkflows';
import { slaService } from '../services/slaService';
import { SLAConfiguration } from '../types';
import LoadingSpinner from '../components/LoadingSpinner';
import { FiClock, FiSettings, FiAlertCircle } from 'react-icons/fi';
import SLAConfigure from '../components/SLAConfigure';

const SLAConfigurationPage = () => {
  const { workflows, loading: workflowsLoading, refetch: refetchWorkflows } = useWorkflows();
  const [slaConfigs, setSlaConfigs] = useState<Map<number, SLAConfiguration>>(new Map());
  const [loading, setLoading] = useState(true);
  const [isConfigureMode, setIsConfigureMode] = useState(false);
  const [selectedWorkflowId, setSelectedWorkflowId] = useState<number | undefined>(undefined);

  const priorityColorClasses = [
    'bg-red-100 text-red-800 border-red-300',
    'bg-orange-100 text-orange-800 border-orange-300',
    'bg-yellow-100 text-yellow-800 border-yellow-300',
    'bg-blue-100 text-blue-800 border-blue-300',
    'bg-purple-100 text-purple-800 border-purple-300',
    'bg-emerald-100 text-emerald-800 border-emerald-300',
  ];

  useEffect(() => {
    const fetchSLAConfigs = async () => {
      try {
        setLoading(true);
        const configs = await slaService.getAll();
        const configsMap = new Map<number, SLAConfiguration>();
        configs.forEach((config) => {
          configsMap.set(config.workflowId, config);
        });
        setSlaConfigs(configsMap);
      } catch (error: any) {
        // If API doesn't exist yet, just continue with empty configs
        console.warn('Failed to fetch SLA configurations:', error);
      } finally {
        setLoading(false);
      }
    };

    if (!workflowsLoading && workflows.length > 0) {
      fetchSLAConfigs();
    } else if (!workflowsLoading) {
      setLoading(false);
    }
  }, [workflows, workflowsLoading]);

  const handleConfigureSuccess = () => {
    setIsConfigureMode(false);
    // Refetch SLA configs
    const fetchSLAConfigs = async () => {
      try {
        const configs = await slaService.getAll();
        const configsMap = new Map<number, SLAConfiguration>();
        configs.forEach((config) => {
          configsMap.set(config.workflowId, config);
        });
        setSlaConfigs(configsMap);
      } catch (error) {
        console.warn('Failed to fetch SLA configurations:', error);
      }
    };
    fetchSLAConfigs();
  };

  const formatTime = (minutes: number): string => {
    if (minutes === 0) return 'Not set';
    if (minutes < 60) return `${minutes}m`;
    const hours = Math.floor(minutes / 60);
    const mins = minutes % 60;
    if (mins === 0) return `${hours}h`;
    if (hours >= 24) {
      const days = Math.floor(hours / 24);
      const remainingHours = hours % 24;
      if (remainingHours === 0) return `${days}d`;
      return `${days}d ${remainingHours}h`;
    }
    return `${hours}h ${mins}m`;
  };

  const getSLAStatus = (workflowId: number): { configured: boolean; count: number } => {
    const config = slaConfigs.get(workflowId);
    if (!config) return { configured: false, count: 0 };
    
    const count = Object.values(config.priorityLevels || {}).filter(
      (priority) => priority.responseTime > 0
    ).length;
    
    return { configured: count > 0, count };
  };

  if (workflowsLoading || loading) {
    return <LoadingSpinner />;
  }

  if (isConfigureMode) {
    return (
      <SLAConfigure
        onSuccess={handleConfigureSuccess}
        onCancel={() => {
          setIsConfigureMode(false);
          setSelectedWorkflowId(undefined);
        }}
        initialWorkflowId={selectedWorkflowId}
      />
    );
  }

  return (
    <div className="p-8 bg-white min-h-screen font-sans">
      <div className="max-w-7xl mx-auto">
        <div className="flex justify-between items-center mb-6 pb-4 border-b border-[#434E78]/20">
          <div>
            <h1 className="text-3xl font-semibold text-black mb-1 font-sans tracking-tight">
              SLA Configuration - Priorities
            </h1>
            <p className="text-black/70 text-sm font-sans">
              Configure priority-based response times across workflows
            </p>
          </div>
          <button
            onClick={() => {
              setSelectedWorkflowId(undefined);
              setIsConfigureMode(true);
            }}
            className="bg-[#434E78] text-white px-5 py-2.5 rounded-azure-sm hover:bg-[#434E78]/90 flex items-center shadow-azure-sm hover:shadow-azure-md transition-all font-medium text-sm"
          >
            <FiSettings className="mr-2 text-base" />
            Configure SLA
          </button>
        </div>

        {workflows.length === 0 ? (
          <div className="bg-white rounded-azure-sm shadow-azure-sm p-12 text-center border border-[#434E78]/20">
            <div className="max-w-md mx-auto">
              <div className="bg-[#434E78]/10 rounded-full w-16 h-16 flex items-center justify-center mx-auto mb-4">
                <FiAlertCircle className="text-3xl text-[#434E78]" />
              </div>
              <h3 className="text-lg font-semibold text-black mb-2 font-sans">No workflows found</h3>
              <p className="text-black/70 text-sm font-sans">
                Create workflows first to configure SLA settings.
              </p>
            </div>
          </div>
        ) : (
          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
            {workflows.map((workflow) => {
              const slaStatus = getSLAStatus(workflow.workflowId);
              const config = slaConfigs.get(workflow.workflowId);

              return (
                <div
                  key={workflow.workflowId}
                  className="bg-white rounded-azure-sm shadow-azure-sm hover:shadow-azure-md transition-all duration-200 border border-[#434E78]/20 overflow-hidden group"
                >
                  <div className="p-5">
                    <div className="flex justify-between items-start mb-3">
                      <h2 className="text-lg font-semibold text-black group-hover:text-black/80 transition-colors font-sans">
                        {workflow.workflowName}
                      </h2>
                      <div className="flex items-center gap-1">
                        {slaStatus.configured && (
                          <div className="w-2 h-2 bg-emerald-500 rounded-full" title="SLA Configured"></div>
                        )}
                      </div>
                    </div>

                    <p className="text-black/70 mb-4 text-sm line-clamp-2 font-sans">
                      {workflow.description || 'No description provided'}
                    </p>

                    <div className="space-y-2.5 pt-4 border-t border-[#434E78]/10">
                      {workflow.teamName && (
                        <div className="flex items-center justify-between text-sm">
                          <span className="text-black/60 font-sans">Team</span>
                          <span className="font-medium text-black font-sans">{workflow.teamName}</span>
                        </div>
                      )}
                      
                      <div className="flex items-center justify-between text-sm">
                        <span className="text-black/60 font-sans">SLA Status</span>
                        <span
                          className={`font-medium text-sm font-sans ${
                            slaStatus.configured ? 'text-emerald-600' : 'text-gray-500'
                          }`}
                        >
                          {slaStatus.configured
                            ? `${slaStatus.count} priorit${slaStatus.count === 1 ? 'y' : 'ies'} configured`
                            : 'Not configured'}
                        </span>
                      </div>

                      {config && slaStatus.configured && (
                        <div className="mt-3 pt-3 border-t border-[#434E78]/10">
                          <p className="text-xs text-black/60 mb-2 font-sans font-semibold">Priorities:</p>
                          <div className="grid grid-cols-2 gap-2">
                            {Object.entries(config.priorityLevels)
                              .filter(([, value]) => value.responseTime > 0)
                              .map(([name, value], index) => (
                                <div
                                  key={name}
                                  className={`text-xs px-2 py-1 rounded-azure-sm border ${
                                    priorityColorClasses[index % priorityColorClasses.length]
                                  } font-sans`}
                                >
                                  <div className="font-semibold">{name}</div>
                                  <div className="text-xs opacity-75">
                                    {formatTime(value.responseTime)}
                                  </div>
                                </div>
                              ))}
                          </div>
                        </div>
                      )}
                    </div>
                  </div>

                  <div className="bg-[#434E78]/5 px-5 py-2.5 border-t border-[#434E78]/10">
                    <button
                      onClick={(e) => {
                        e.stopPropagation();
                        setSelectedWorkflowId(workflow.workflowId);
                        setIsConfigureMode(true);
                      }}
                      className="text-sm text-[#434E78] font-medium group-hover:text-[#434E78]/80 font-sans flex items-center gap-1"
                    >
                      <FiClock className="text-base" />
                      {slaStatus.configured ? 'Update SLA' : 'Configure SLA'} →
                    </button>
                  </div>
                </div>
              );
            })}
          </div>
        )}
      </div>
    </div>
  );
};

export default SLAConfigurationPage;
