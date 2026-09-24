import { useEffect, useMemo, useState } from 'react';
import { useNavigate, useParams } from 'react-router-dom';
import { toast } from 'react-toastify';
import { FiArrowRight, FiCode, FiCopy, FiEdit2, FiGitMerge, FiList, FiMap, FiRepeat, FiUserCheck, FiUsers } from 'react-icons/fi';
import { workflowService } from '../services/workflowService';
import { Stage, Workflow } from '../types';
import LoadingSpinner from '../components/LoadingSpinner';
import PageHeader from '../components/PageHeader';
import Button from '../components/Button';
import Tabs from '../components/Tabs';
import EmptyState from '../components/EmptyState';
import WorkflowStagesView from '../components/WorkflowStagesView';
import WorkflowMap from '../components/flow/WorkflowMap';
import { formatDateOnlyIST } from '../utils/dateUtils';
import { getStageForm, hasStageForm } from '../utils/stageFormRegistry';
import { autoRoutingReason } from '../utils/stageRouting';
import { TEAM_FALLBACK, teamColors } from '../utils/theme';
import { countHandoffs, countTeams } from '../utils/workflowStats';

type View = 'map' | 'stages' | 'json';

const policyText = (stage: Stage) => {
  switch (stage.transitionPolicy) {
    case 'OnTimeout':
      return `Moves on automatically after ${stage.timeoutMinutes ?? '?'} minutes`;
    case 'Manual':
      return 'Moved on manually';
    default:
      return 'Moves on when the assignee completes it';
  }
};

const WorkflowDetail = () => {
  const { id } = useParams<{ id: string }>();
  const navigate = useNavigate();
  const [workflow, setWorkflow] = useState<Workflow | null>(null);
  const [loading, setLoading] = useState(true);
  const [view, setView] = useState<View>('map');
  const [selectedId, setSelectedId] = useState<string | null>(null);

  useEffect(() => {
    const fetchWorkflow = async () => {
      if (!id) return;
      try {
        const data = await workflowService.getById(id);
        setWorkflow(data);
      } catch (error: any) {
        toast.error('Failed to load workflow');
        navigate('/workflows');
      } finally {
        setLoading(false);
      }
    };

    fetchWorkflow();
  }, [id, navigate]);

  const stages = useMemo(
    () => [...(workflow?.stages ?? [])].sort((a, b) => a.stageOrder - b.stageOrder),
    [workflow]
  );
  const colors = useMemo(() => teamColors(stages), [stages]);

  useEffect(() => {
    if (!selectedId && stages[0]) setSelectedId(stages[0].stageId);
  }, [stages, selectedId]);

  if (loading) {
    return <LoadingSpinner label="Loading workflow" />;
  }

  if (!workflow) {
    return (
      <div className="card">
        <EmptyState icon={<FiGitMerge />} title="Workflow not found" action={<Button onClick={() => navigate('/workflows')}>Back to workflows</Button>} />
      </div>
    );
  }

  const exportJson = JSON.stringify(
    {
      ...workflow,
      stages: workflow.stages?.map((stage) => ({ ...stage, teamName: stage.teamName || 'No Team Assigned' })) || [],
    },
    null,
    2
  );

  const selected = stages.find((s) => s.stageId === selectedId) ?? stages[0];
  const selectedIndex = selected ? stages.indexOf(selected) : -1;
  const previous = selectedIndex > 0 ? stages[selectedIndex - 1] : undefined;
  const next = selectedIndex >= 0 ? stages[selectedIndex + 1] : undefined;
  const schema = getStageForm(selected?.stageName);
  const routing = autoRoutingReason(next, stages);

  return (
    <div>
      <PageHeader
        breadcrumbs={[{ label: 'Workflows', to: '/workflows' }]}
        title={workflow.workflowName}
        subtitle={workflow.description || 'No description provided'}
        meta={
          <>
            <span className="inline-flex items-center gap-1.5"><FiGitMerge aria-hidden="true" />{stages.length} stages</span>
            <span className="inline-flex items-center gap-1.5"><FiUsers aria-hidden="true" />{countTeams(workflow)} teams</span>
            <span className="inline-flex items-center gap-1.5"><FiRepeat aria-hidden="true" />{countHandoffs(workflow)} hand-offs</span>
            <span>Created {formatDateOnlyIST(workflow.createdAt)}</span>
          </>
        }
        actions={
          <Button
            variant="secondary"
            icon={<FiEdit2 />}
            onClick={() => navigate('/workflows', { state: { edit: workflow.workflowId } })}
          >
            Edit workflow
          </Button>
        }
      />

      <div className="mb-5">
        <Tabs
          label="Workflow views"
          activeId={view}
          onChange={(v) => setView(v as View)}
          tabs={[
            { id: 'map', label: 'Map', icon: <FiMap /> },
            { id: 'stages', label: 'Stages', icon: <FiList />, count: stages.length },
            { id: 'json', label: 'JSON', icon: <FiCode /> },
          ]}
        />
      </div>

      {stages.length === 0 && view !== 'json' ? (
        <div className="card">
          <EmptyState icon={<FiGitMerge />} title="This workflow has no stages" body="Edit the workflow to add the stages an enquiry moves through." />
        </div>
      ) : view === 'map' ? (
        <div className="space-y-5">
          <div>
            <p className="text-meta text-ink-subtle mb-2">
              One lane per team. Each connector is a hand-over; select a stage to see what it records and where it goes next.
            </p>
            <WorkflowMap
              stages={stages.map((s) => ({ id: s.stageId, order: s.stageOrder, name: s.stageName, teamId: s.teamId, teamName: s.teamName }))}
              selectedId={selected?.stageId}
              onSelect={setSelectedId}
              label={`${workflow.workflowName} map`}
            />
          </div>

          {selected && (
            <section aria-live="polite" className="card overflow-hidden">
              <header className="flex flex-wrap items-center justify-between gap-3 px-5 py-4 border-b border-line-subtle">
                <div className="flex items-center gap-3 min-w-0">
                  <span className="font-mono text-meta font-semibold text-primary bg-primary-subtle ring-1 ring-inset ring-primary-border rounded-control h-8 w-10 flex items-center justify-center shrink-0">
                    {String(selected.stageOrder).padStart(2, '0')}
                  </span>
                  <div className="min-w-0">
                    <h2 className="text-title font-semibold text-ink">{selected.stageName}</h2>
                    <p className="text-meta text-ink-subtle inline-flex items-center gap-1.5">
                      <span aria-hidden="true" className="h-2 w-2 rounded-full" style={{ backgroundColor: colors.get(selected.teamId) ?? TEAM_FALLBACK }} />
                      Owned by {selected.teamName || 'no team'} · {policyText(selected)}
                    </p>
                  </div>
                </div>
                <div className="flex items-center gap-1">
                  <Button size="sm" variant="ghost" disabled={!previous} onClick={() => previous && setSelectedId(previous.stageId)}>
                    Previous
                  </Button>
                  <Button size="sm" variant="ghost" disabled={!next} onClick={() => next && setSelectedId(next.stageId)} trailingIcon={<FiArrowRight />}>
                    Next stage
                  </Button>
                </div>
              </header>

              <div className="grid grid-cols-1 lg:grid-cols-[minmax(0,3fr)_minmax(0,2fr)] divide-y lg:divide-y-0 lg:divide-x divide-line-subtle">
                <div className="px-5 py-4">
                  <p className="eyebrow mb-3">What this stage records</p>
                  {hasStageForm(selected.stageName) ? (
                    <>
                      {schema.description && <p className="text-body text-ink-muted mb-3">{schema.description}</p>}
                      <ul className="grid grid-cols-1 sm:grid-cols-2 gap-x-5 gap-y-2">
                        {schema.fields.map((field) => (
                          <li key={field.name} className="flex items-start gap-2 text-body text-ink">
                            <span aria-hidden="true" className={`mt-[7px] h-1.5 w-1.5 rounded-full shrink-0 ${field.required ? 'bg-primary' : 'bg-line-strong'}`} />
                            <span className="min-w-0">
                              {field.label}
                              {field.type === 'table' && <span className="text-ink-subtle"> · table</span>}
                              {field.type === 'assignee' && <span className="text-ink-subtle"> · appoints {field.targetStage}</span>}
                              {field.required && <span className="sr-only"> (required)</span>}
                            </span>
                          </li>
                        ))}
                      </ul>
                      <p className="mt-3 text-meta text-ink-subtle inline-flex items-center gap-1.5">
                        <span aria-hidden="true" className="h-1.5 w-1.5 rounded-full bg-primary" /> Required
                        <span aria-hidden="true" className="ml-3 h-1.5 w-1.5 rounded-full bg-line-strong" /> Optional
                      </p>
                    </>
                  ) : (
                    <p className="text-body text-ink-muted">Free-text notes on what was done at this stage.</p>
                  )}
                </div>
                <div className="px-5 py-4 space-y-4">
                  <div>
                    <p className="eyebrow mb-2">Comes from</p>
                    <p className="text-body text-ink">{previous ? previous.stageName : 'Registration — this is where every enquiry starts'}</p>
                    {previous?.teamName && <p className="text-meta text-ink-subtle">{previous.teamName}</p>}
                  </div>
                  <div>
                    <p className="eyebrow mb-2">Hands over to</p>
                    {next ? (
                      <>
                        <p className="text-body text-ink">{next.stageName}</p>
                        <p className="text-meta text-ink-subtle">{next.teamName}</p>
                        <p className="mt-2 text-meta text-ink-muted inline-flex items-start gap-1.5">
                          <FiUserCheck aria-hidden="true" className="mt-0.5 shrink-0" />
                          {routing ? `Routes itself: ${routing}.` : 'Whoever completes this stage picks the next assignee, or leaves it to the least-loaded member.'}
                        </p>
                      </>
                    ) : (
                      <p className="text-body text-ink">Nothing — completing it closes the enquiry.</p>
                    )}
                  </div>
                </div>
              </div>
            </section>
          )}
        </div>
      ) : view === 'stages' ? (
        <div className="card overflow-hidden">
          <WorkflowStagesView
            workflow={workflow}
            selectedId={selected?.stageId}
            onSelect={(stageId) => {
              setSelectedId(stageId);
              setView('map');
            }}
          />
        </div>
      ) : (
        <div className="card overflow-hidden">
          <div className="flex flex-wrap items-center justify-between gap-3 px-5 py-3 border-b border-line-subtle">
            <div>
              <h2 className="text-title font-semibold text-ink">JSON</h2>
              <p className="text-meta text-ink-subtle">Complete workflow structure with all relationships.</p>
            </div>
            <Button
              size="sm"
              icon={<FiCopy />}
              onClick={() => {
                navigator.clipboard.writeText(exportJson);
                toast.success('JSON copied to clipboard');
              }}
            >
              Copy JSON
            </Button>
          </div>
          <pre className="text-meta leading-5 text-[#D6DBEE] bg-shell font-mono p-5 overflow-auto max-h-[640px] scrollbar-thin">
            {exportJson}
          </pre>
        </div>
      )}
    </div>
  );
};

export default WorkflowDetail;
