import Button from '../components/Button';
import Badge from '../components/Badge';
import PageHeader from '../components/PageHeader';
import EmptyState from '../components/EmptyState';
import { useState, useEffect, useCallback } from 'react';
import { useWorkflows } from '../hooks/useWorkflows';
import { slaService } from '../services/slaService';
import { SLAConfiguration } from '../types';
import LoadingSpinner from '../components/LoadingSpinner';
import { FiAlertTriangle, FiCheckCircle, FiClock, FiEdit2, FiGitMerge, FiSettings } from 'react-icons/fi';
import SLAConfigure, { formatTime } from '../components/SLAConfigure';
import { priorityRank, priorityTone } from '../utils/status';

const TONE_DOT: Record<string, string> = {
  danger: 'bg-danger',
  warning: 'bg-warning-strong',
  info: 'bg-info',
  neutral: 'bg-ink-subtle',
  primary: 'bg-primary',
  success: 'bg-success-strong',
};

const SLAConfigurationPage = () => {
  const { workflows, loading: workflowsLoading } = useWorkflows();
  const [slaConfigs, setSlaConfigs] = useState<Map<string, SLAConfiguration>>(new Map());
  const [loading, setLoading] = useState(true);
  const [isConfigureMode, setIsConfigureMode] = useState(false);
  const [selectedWorkflowId, setSelectedWorkflowId] = useState<string | undefined>(undefined);

  const fetchSLAConfigs = useCallback(async () => {
    try {
      const configs = await slaService.getAll();
      const configsMap = new Map<string, SLAConfiguration>();
      configs.forEach((config) => configsMap.set(config.workflowId, config));
      setSlaConfigs(configsMap);
    } catch (error: any) {
      // If the API is not there yet, carry on with no configurations.
      console.warn('Failed to fetch SLA configurations:', error);
    }
  }, []);

  useEffect(() => {
    if (workflowsLoading) return;
    if (workflows.length === 0) {
      setLoading(false);
      return;
    }
    setLoading(true);
    fetchSLAConfigs().finally(() => setLoading(false));
  }, [workflows, workflowsLoading, fetchSLAConfigs]);

  const handleConfigureSuccess = () => {
    setIsConfigureMode(false);
    fetchSLAConfigs();
  };

  if (workflowsLoading || loading) {
    return <LoadingSpinner label="Loading SLA targets" />;
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

  const configure = (workflowId?: string) => {
    setSelectedWorkflowId(workflowId);
    setIsConfigureMode(true);
  };

  return (
    <div>
      <PageHeader
        title="SLA Targets"
        subtitle="How quickly each priority must be picked up. A workflow with no targets never assigns its enquiries."
        actions={
          workflows.length > 0 ? (
            <Button variant="primary" icon={<FiSettings />} onClick={() => configure(undefined)}>
              Configure SLA
            </Button>
          ) : null
        }
      />

      {workflows.length === 0 ? (
        <div className="card">
          <EmptyState
            icon={<FiClock />}
            title="No workflows yet"
            body="Response times are set per workflow. Create a workflow first, then come back to set its targets."
          />
        </div>
      ) : (
        <ul className="space-y-4">
          {workflows.map((workflow) => {
            const config = slaConfigs.get(workflow.workflowId);
            const levels = Object.entries(config?.priorityLevels ?? {}).sort(
              ([a], [b]) => priorityRank(a) - priorityRank(b)
            );
            const set = levels.filter(([, v]) => v.responseTime > 0);
            const unset = levels.filter(([, v]) => !(v.responseTime > 0));
            const configured = set.length > 0;

            return (
              <li key={workflow.workflowId} className="card overflow-hidden">
                <header className="flex flex-wrap items-center justify-between gap-3 px-5 py-4 border-b border-line-subtle">
                  <div className="flex items-center gap-3 min-w-0">
                    <span aria-hidden="true" className="h-9 w-9 shrink-0 rounded-control bg-primary-subtle text-primary ring-1 ring-inset ring-primary-border flex items-center justify-center">
                      <FiGitMerge />
                    </span>
                    <div className="min-w-0">
                      <h2 className="text-title font-semibold text-ink truncate">{workflow.workflowName}</h2>
                      <p className="text-meta text-ink-subtle truncate">{workflow.description || `${workflow.stages?.length ?? 0} stages`}</p>
                    </div>
                  </div>
                  <div className="flex items-center gap-3">
                    {configured ? (
                      <Badge tone="success" icon={<FiCheckCircle />}>
                        {set.length} of {levels.length} set
                      </Badge>
                    ) : (
                      <Badge tone="warning" icon={<FiAlertTriangle />}>
                        Not configured
                      </Badge>
                    )}
                    <Button size="sm" icon={<FiEdit2 />} onClick={() => configure(workflow.workflowId)}>
                      {configured ? 'Edit targets' : 'Set targets'}
                    </Button>
                  </div>
                </header>

                {levels.length > 0 ? (
                  <div className="grid grid-cols-2 md:grid-cols-4 xl:grid-cols-6 divide-x divide-y md:divide-y-0 divide-line-subtle">
                    {levels.map(([name, value]) => (
                      <div key={name} className="px-5 py-4">
                        <p className="flex items-center gap-2 text-meta font-medium text-ink-muted">
                          <span aria-hidden="true" className={`h-2 w-2 rounded-full ${TONE_DOT[priorityTone(name)]}`} />
                          {name}
                        </p>
                        {value.responseTime > 0 ? (
                          <p className="mt-1 text-title font-semibold text-ink">{formatTime(value.responseTime)}</p>
                        ) : (
                          <p className="mt-1 text-body text-warning font-medium">No target</p>
                        )}
                      </div>
                    ))}
                  </div>
                ) : (
                  <p className="px-5 py-5 text-body text-ink-muted">
                    No response times yet, so enquiries on this workflow are never assigned.
                  </p>
                )}

                {configured && unset.length > 0 && (
                  <p className="flex items-start gap-2 px-5 py-2.5 border-t border-line-subtle bg-warning-subtle/60 text-meta text-warning">
                    <FiAlertTriangle aria-hidden="true" className="mt-0.5 shrink-0" />
                    {unset.map(([n]) => n).join(', ')} {unset.length === 1 ? 'has' : 'have'} no target, so enquiries at that priority are due the moment they are assigned.
                  </p>
                )}
              </li>
            );
          })}
        </ul>
      )}
    </div>
  );
};

export default SLAConfigurationPage;
