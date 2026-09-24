import { selectStyles, selectTheme } from '../utils/theme';
import WorkflowStagesStep from './workflowWizard/WorkflowStagesStep';
import { createStages } from '../utils/stageSync';
import { inputClass } from '../utils/formStyles';
import Button, { IconButton } from './Button';
import Badge from './Badge';
import Field from './Field';
import Avatar from './Avatar';
import PageHeader from './PageHeader';
import WizardStepper from './WizardStepper';
import { useState, useEffect, useCallback } from 'react';
import { useAuth } from '../contexts/AuthContext';
import { useTeams } from '../hooks/useTeams';
import { useMembers } from '../hooks/useMembers';
import { teamService } from '../services/teamService';
import { memberService } from '../services/memberService';
import { userService } from '../services/userService';
import { workflowService } from '../services/workflowService';
import { toast } from 'react-toastify';
import { FiAlertTriangle, FiCheckCircle, FiChevronLeft, FiChevronRight, FiClock, FiEdit2, FiGitMerge, FiPlus, FiSliders, FiUserPlus, FiUsers, FiX } from 'react-icons/fi';
import Select from 'react-select';
import SLAConfigure from './SLAConfigure';
import ConditionBuilder from './ConditionBuilder';
import { PriorityRuleCreate, User } from '../types';
import { priorityRulesService } from '../services/priorityRulesService';
import { apiErrorMessage } from '../utils/apiError';

function splitFullName(fullName: string): { firstName: string; lastName: string } {
  const parts = fullName.trim().split(/\s+/);
  return { firstName: parts[0] ?? '', lastName: parts.slice(1).join(' ') ?? '' };
}

interface WorkflowWizardProps {
  onSuccess: (workflowId: string) => void;
  onCancel: () => void;
}

interface TeamForm {
  teamName: string;
  description: string;
}

interface MemberForm {
  firstName: string;
  lastName: string;
  email: string;
  role: string;
  skillLevel: number;
  userId?: string;
}

interface StageForm {
  stageName: string;
  stageOrder: number;
  teamId: string;
  tempId: number;
  stageType?: 'Process' | 'Escalation';
  transitionPolicy?: 'OnComplete' | 'OnTimeout' | 'Manual';
  timeoutMinutes?: number;
}

const WorkflowWizard = ({ onSuccess, onCancel }: WorkflowWizardProps) => {
  const { organizationId } = useAuth();
  const { teams, refetch: refetchTeams } = useTeams();
  const { members: existingMembers, refetch: refetchMembers } = useMembers();
  const [currentStep, setCurrentStep] = useState(1);
  const [completedSteps, setCompletedSteps] = useState<number[]>([]);
  const totalSteps = 6;

  const steps = [
    { label: 'Get started' },
    { label: 'Members', hint: 'Optional' },
    { label: 'Team', hint: 'Optional' },
    { label: 'Stages' },
    { label: 'SLA' },
    { label: 'Priority rules', hint: 'Optional' },
  ];

  // Step 1: Get Started (intro)
  // Step 2: Add Members (new members to be created)
  const [productHubUsers, setProductHubUsers] = useState<User[]>([]);
  const [newMembers, setNewMembers] = useState<MemberForm[]>([]);
  const [memberForm, setMemberForm] = useState<MemberForm>({
    firstName: '',
    lastName: '',
    email: '',
    role: '',
    skillLevel: 1,
  });
  const [skipMemberCreation, setSkipMemberCreation] = useState(false);

  const loadProductHubUsers = useCallback(async () => {
    if (!organizationId) return;
    try {
      const users = await userService.getActiveOrganizationUsers(organizationId);
      setProductHubUsers(users);
    } catch {
      setProductHubUsers([]);
    }
  }, [organizationId]);

  useEffect(() => {
    if (currentStep === 2) loadProductHubUsers();
  }, [currentStep, loadProductHubUsers]);

  // Step 3: Create Team
  const [teamForm, setTeamForm] = useState<TeamForm>({
    teamName: '',
    description: '',
  });
  const [createdTeamId, setCreatedTeamId] = useState<string | null>(null);
  const [skipTeamCreation, setSkipTeamCreation] = useState(false);
  const [selectedMemberIds, setSelectedMemberIds] = useState<string[]>([]); // Selected existing members to assign

  // Step 4: Create Workflow
  const [workflowName, setWorkflowName] = useState('');
  const [description, setDescription] = useState('');
  const [stages, setStages] = useState<StageForm[]>([]);
  const [stageForm, setStageForm] = useState<StageForm>({
    stageName: '',
    stageOrder: 1,
    teamId: '',
    tempId: 0,
  });
  const [nextTempId, setNextTempId] = useState(1);
  const [editingStageIndex, setEditingStageIndex] = useState<number | null>(null);
  const [createdWorkflowId, setCreatedWorkflowId] = useState<string | null>(null);

  // Step 6: Create Rules
  const [rules, setRules] = useState<PriorityRuleCreate[]>([]);
  const [ruleForm, setRuleForm] = useState<PriorityRuleCreate>({
    ruleName: '',
    priority: 'Medium',
    salience: 0,
    isActive: true,
    conditionsJson: '{"all":[]}',
    maxWorkloadScore: undefined,
    teamName: undefined,
    workflowId: undefined,
  });
  const [skipRuleCreation, setSkipRuleCreation] = useState(false);
  const [editingRuleIndex, setEditingRuleIndex] = useState<number | null>(null);

  const [loading, setLoading] = useState(false);

  // Update rule form workflowId when workflow is created
  useEffect(() => {
    if (createdWorkflowId) {
      setRuleForm(prev => ({ ...prev, workflowId: createdWorkflowId }));
    }
  }, [createdWorkflowId]);

  // Step 3: Create Team
  const handleCreateTeam = async () => {
    if (!teamForm.teamName.trim()) {
      toast.error('Please enter a team name');
      return;
    }

    setLoading(true);
    try {
      // Create the team - that's it, no automatic member creation
      const team = await teamService.create(teamForm);
      setCreatedTeamId(team.teamId);
      await refetchTeams();
      
      // Assign selected existing members to the team (if any were selected)
      if (selectedMemberIds.length > 0) {
        try {
          // Get fresh member data
          const freshMembers = await memberService.getAll();
          for (const memberId of selectedMemberIds) {
            const member = freshMembers.find(m => m.memberId === memberId);
            if (member) {
              await memberService.update(memberId, {
                firstName: member.firstName,
                lastName: member.lastName,
                email: member.email,
                role: member.role,
                skillLevel: member.skillLevel,
                teamId: team.teamId, // Update team assignment
              });
            }
          }
          await refetchMembers(); // Refresh members list after updates
          toast.success(`Team created and ${selectedMemberIds.length} member(s) assigned successfully!`);
        } catch (assignError: any) {
          console.error('Error assigning members:', assignError);
          const errorMessage = apiErrorMessage(assignError, 'Failed to assign members');
          toast.error(`Team created but failed to assign members: ${errorMessage}`);
        }
      } else {
        toast.success('Team created successfully!');
      }
      
      // Clear selected members after successful assignment
      setSelectedMemberIds([]);
      
      if (!completedSteps.includes(3)) {
        setCompletedSteps([...completedSteps, 3]);
      }
    } catch (error: any) {
      toast.error(apiErrorMessage(error, 'Failed to create team'));
    } finally {
      setLoading(false);
    }
  };
  
  const handleMemberSelectionChange = (selectedOptions: any) => {
    const selectedIds = selectedOptions ? selectedOptions.map((option: any) => option.value) : [];
    setSelectedMemberIds(selectedIds);
  };

  // Prepare options for react-select
  const memberOptions = existingMembers.map((member) => ({
    value: member.memberId,
    label: `${member.firstName} ${member.lastName} (${member.email}) - ${member.role}${member.teamName ? ` - Current Team: ${member.teamName}` : ''}`,
  }));

  const selectedMemberOptions = memberOptions.filter(option => 
    selectedMemberIds.includes(option.value)
  );

  // Step 2: Add Members
  const handleAddMember = () => {
    if (!memberForm.firstName.trim()) {
      toast.error('Please enter first name');
      return;
    }
    if (!memberForm.lastName.trim()) {
      toast.error('Please enter last name');
      return;
    }
    if (!memberForm.email.trim()) {
      toast.error('Please enter email');
      return;
    }
    if (!memberForm.role.trim()) {
      toast.error('Please enter role');
      return;
    }
    // No team selection - members will be assigned when team is created
    
    setNewMembers([...newMembers, { ...memberForm }]);
    setMemberForm({
      firstName: '',
      lastName: '',
      email: '',
      role: '',
      skillLevel: 1,
    });
    toast.success('Member added to list');
  };

  const handleRemoveMember = (index: number) => {
    setNewMembers(newMembers.filter((_, i) => i !== index));
  };

  // Step 2: Add Members - Create members without team assignment
  const handleSaveMembers = async () => {
    if (newMembers.length === 0 && !skipMemberCreation) {
      toast.error('Please add at least one member or skip this step');
      return;
    }

    if (newMembers.length === 0) {
      // If skipping member creation, just mark step as completed
      if (!completedSteps.includes(2)) {
        setCompletedSteps([...completedSteps, 2]);
      }
      return;
    }

    // Create members without team assignment (they'll be assigned when team is created)
    setLoading(true);
    try {
      const membersCount = newMembers.length;
      for (const member of newMembers) {
        await memberService.create({
          firstName: member.firstName,
          lastName: member.lastName,
          email: member.email,
          role: member.role,
          skillLevel: member.skillLevel,
          userId: member.userId,
        });
      }
      
      // Clear new members list and refresh members
      setNewMembers([]);
      await refetchMembers();
      
      toast.success(`${membersCount} member(s) created successfully! They will be assigned to a team when you create the team in the next step.`);
      if (!completedSteps.includes(2)) {
        setCompletedSteps([...completedSteps, 2]);
      }
    } catch (error: any) {
      console.error('Error creating members:', error);
      const errorMessage = apiErrorMessage(error, 'Failed to create members');
      toast.error(errorMessage);
    } finally {
      setLoading(false);
    }
  };

  // Step 4: Create Workflow
  const handleAddStage = () => {
    if (stageForm.stageName.trim()) {
      if (editingStageIndex !== null) {
        const updated = [...stages];
        updated[editingStageIndex] = { ...stageForm, tempId: stages[editingStageIndex].tempId };
        setStages(updated);
        setEditingStageIndex(null);
      } else {
        const newStage = { ...stageForm, tempId: nextTempId, stageOrder: stages.length + 1 };
        setStages([...stages, newStage]);
        setNextTempId(nextTempId + 1);
      }
      const teamId = createdTeamId || (teams.length > 0 ? teams[0].teamId : '');
      setStageForm({ stageName: '', stageOrder: stages.length + 1, teamId, tempId: 0 });
    }
  };

  const handleCreateWorkflow = async () => {
    if (!workflowName.trim()) {
      toast.error('Please enter a workflow name');
      return;
    }

    if (stages.length === 0) {
      toast.error('Please add at least one stage');
      return;
    }

    setLoading(true);
    try {
      const workflow = await workflowService.create({
        workflowName,
        description,
      });

      await createStages(workflow.workflowId, stages);

      try {
        await workflowService.updateJson(workflow.workflowId);
      } catch (error) {
        console.warn('Failed to update workflow JSON:', error);
      }

      setCreatedWorkflowId(workflow.workflowId);
      toast.success('Workflow created successfully!');
      if (!completedSteps.includes(4)) {
        setCompletedSteps([...completedSteps, 4]);
      }
    } catch (error: any) {
      toast.error(apiErrorMessage(error, 'Failed to create workflow'));
    } finally {
      setLoading(false);
    }
  };

  const handleSLAConfigSuccess = () => {
    if (!completedSteps.includes(5)) {
      setCompletedSteps([...completedSteps, 5]);
    }
    // Don't call onSuccess here - wait for rule creation step
  };

  // Step 6: Create Rules
  const handleAddRule = () => {
    if (!ruleForm.ruleName.trim()) {
      toast.error('Please enter a rule name');
      return;
    }
    
    if (editingRuleIndex !== null) {
      const updated = [...rules];
      updated[editingRuleIndex] = { ...ruleForm };
      setRules(updated);
      setEditingRuleIndex(null);
    } else {
      setRules([...rules, { ...ruleForm }]);
    }
    
    // Reset form
    setRuleForm({
      ruleName: '',
      priority: 'Medium',
      salience: 0,
      isActive: true,
      conditionsJson: '{"all":[]}',
      maxWorkloadScore: undefined,
      teamName: undefined,
      workflowId: createdWorkflowId || undefined,
    });
    toast.success(editingRuleIndex !== null ? 'Rule updated' : 'Rule added to list');
  };

  const handleRemoveRule = (index: number) => {
    setRules(rules.filter((_, i) => i !== index));
  };

  const handleSaveRules = async () => {
    if (rules.length === 0 && !skipRuleCreation) {
      toast.error('Please add at least one rule or skip this step');
      return;
    }

    if (rules.length === 0) {
      if (!completedSteps.includes(6)) {
        setCompletedSteps([...completedSteps, 6]);
      }
      if (createdWorkflowId) {
        onSuccess(createdWorkflowId);
      }
      return;
    }

    if (!createdWorkflowId) {
      toast.error('Please complete workflow creation first');
      return;
    }

    setLoading(true);
    try {
      for (const rule of rules) {
        await priorityRulesService.create({
          ...rule,
          workflowId: createdWorkflowId, // Always use the created workflow ID
        });
      }
      toast.success(`${rules.length} rule(s) created successfully!`);
      setRules([]);
      if (!completedSteps.includes(6)) {
        setCompletedSteps([...completedSteps, 6]);
      }
      if (createdWorkflowId) {
        onSuccess(createdWorkflowId);
      }
    } catch (error: any) {
      console.error('Error creating rules:', error);
      const errorMessage = apiErrorMessage(error, 'Failed to create rules');
      toast.error(errorMessage);
    } finally {
      setLoading(false);
    }
  };

  const skillLabels = ['Beginner', 'Junior', 'Intermediate', 'Advanced', 'Expert'];

  const renderStepContent = () => {
    switch (currentStep) {
      case 1:
        return (
          <div className="max-w-2xl">
            <h2 className="text-title font-semibold text-ink">Set up a workflow end to end</h2>
            <p className="mt-1 text-body text-ink-muted">
              Five short steps take you from the people who do the work to the rules that prioritise it. The optional
              ones can be skipped if that part already exists.
            </p>
            <ol className="mt-6 relative">
              {[
                { icon: <FiUserPlus />, title: 'Add Members', body: 'People who will work on stages, with their skill levels.', optional: true },
                { icon: <FiUsers />, title: 'Create Team', body: 'Group members into the team that owns a stage.', optional: true },
                { icon: <FiGitMerge />, title: 'Create Workflow', body: 'Name it and lay out its stages, each owned by a team.' },
                { icon: <FiClock />, title: 'Configure SLA', body: 'Response time for each priority level.' },
                { icon: <FiSliders />, title: 'Create Rules', body: 'Conditions that set an enquiry’s priority automatically.', optional: true },
              ].map((item, index, all) => (
                <li key={item.title} className="relative flex gap-4 pb-5 last:pb-0">
                  {index < all.length - 1 && <span aria-hidden="true" className="absolute left-[17px] top-10 bottom-0 w-px bg-line" />}
                  <span aria-hidden="true" className="relative z-[1] h-9 w-9 shrink-0 rounded-full bg-primary-subtle text-primary ring-1 ring-inset ring-primary-border flex items-center justify-center">
                    {item.icon}
                  </span>
                  <div className="pt-1.5">
                    <p className="text-body font-semibold text-ink flex items-center gap-2">
                      {item.title}
                      {item.optional && <Badge>Optional</Badge>}
                    </p>
                    <p className="text-meta text-ink-subtle mt-0.5">{item.body}</p>
                  </div>
                </li>
              ))}
            </ol>
          </div>
        );

      case 2:
        return (
          <div>
            <h2 className="text-title font-semibold text-ink">Add Members</h2>
            <p className="mt-1 text-body text-ink-muted">
              Add the people who will work on stages. They join a team in the next step.
            </p>
            {!skipMemberCreation && (
              <div className="mt-6 grid grid-cols-1 xl:grid-cols-[minmax(0,3fr)_minmax(0,2fr)] gap-6 items-start">
                <div className="rounded-card border border-line p-5 space-y-4">
                  <Field htmlFor="wiz-member-login" label="Login" hint="(from Product Hub)" required>
                    <select
                      id="wiz-member-login"
                      value={memberForm.email}
                      onChange={(e) => {
                        const user = productHubUsers.find((u) => u.email === e.target.value);
                        if (user) {
                          const { firstName, lastName } = splitFullName(user.fullName);
                          setMemberForm({
                            ...memberForm,
                            email: user.email,
                            firstName: firstName || memberForm.firstName,
                            lastName: lastName || memberForm.lastName,
                            role: user.role || memberForm.role,
                            userId: user.userId,
                          });
                        }
                      }}
                      className={inputClass}
                    >
                      <option value="">Select a user…</option>
                      {productHubUsers
                        .filter(
                          (u) =>
                            !existingMembers.some((m) => m.email === u.email || (m.userId && m.userId === u.userId)) &&
                            !newMembers.some((nm) => nm.email === u.email)
                        )
                        .map((u) => (
                          <option key={u.userId} value={u.email}>
                            {u.fullName} ({u.email})
                          </option>
                        ))}
                    </select>
                  </Field>
                  <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                    <Field htmlFor="wiz-first" label="First name" required>
                      <input id="wiz-first" type="text" value={memberForm.firstName} onChange={(e) => setMemberForm({ ...memberForm, firstName: e.target.value })} className={inputClass} />
                    </Field>
                    <Field htmlFor="wiz-last" label="Last name" required>
                      <input id="wiz-last" type="text" value={memberForm.lastName} onChange={(e) => setMemberForm({ ...memberForm, lastName: e.target.value })} className={inputClass} />
                    </Field>
                  </div>
                  <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                    <Field htmlFor="wiz-role" label="Role" required>
                      <input id="wiz-role" type="text" value={memberForm.role} onChange={(e) => setMemberForm({ ...memberForm, role: e.target.value })} className={inputClass} placeholder="e.g. Estimator" />
                    </Field>
                    <Field htmlFor="wiz-skill" label="Skill level" required>
                      <select id="wiz-skill" value={memberForm.skillLevel} onChange={(e) => setMemberForm({ ...memberForm, skillLevel: parseInt(e.target.value) })} className={inputClass}>
                        {skillLabels.map((label, i) => (
                          <option key={label} value={i + 1}>{i + 1} — {label}</option>
                        ))}
                      </select>
                    </Field>
                  </div>
                  <Button variant="secondary" icon={<FiPlus />} onClick={handleAddMember}>
                    Add Member to List
                  </Button>
                </div>

                <div>
                  <p className="eyebrow mb-3">To create · {newMembers.length}</p>
                  {newMembers.length === 0 ? (
                    <div className="rounded-card border border-dashed border-line-strong bg-surface-muted px-4 py-8 text-center text-meta text-ink-subtle">
                      Members you add appear here before they are created.
                    </div>
                  ) : (
                    <>
                      <ul className="rounded-card border border-line divide-y divide-line-subtle">
                        {newMembers.map((member, index) => (
                          <li key={index} className="flex items-center gap-3 pl-3 pr-1.5 py-2">
                            <Avatar name={`${member.firstName} ${member.lastName}`} size="sm" />
                            <div className="min-w-0 flex-1">
                              <p className="text-body font-medium text-ink truncate">{member.firstName} {member.lastName}</p>
                              <p className="text-meta text-ink-subtle truncate">{member.role} · {member.email}</p>
                            </div>
                            <IconButton size="sm" tone="danger" label={`Remove ${member.firstName}`} icon={<FiX />} onClick={() => handleRemoveMember(index)} />
                          </li>
                        ))}
                      </ul>
                      <Button className="mt-3 w-full" variant="primary" loading={loading} onClick={handleSaveMembers}>
                        {loading ? 'Creating…' : `Create ${newMembers.length} member${newMembers.length === 1 ? '' : 's'}`}
                      </Button>
                    </>
                  )}
                </div>
              </div>
            )}
          </div>
        );

      case 3:
        return (
          <div className="max-w-2xl">
            <h2 className="text-title font-semibold text-ink">Create Team</h2>
            <p className="mt-1 text-body text-ink-muted">
              {teams.length > 0
                ? 'You already have teams, so this step can be skipped to use an existing one.'
                : 'A team owns stages; work reaches its members through it.'}
            </p>
            {teams.length === 0 && (
              <div role="alert" className="mt-4 flex items-start gap-2.5 px-4 py-3 rounded-card bg-warning-subtle border border-warning-border text-body text-warning">
                <FiAlertTriangle aria-hidden="true" className="mt-0.5 shrink-0" />
                No teams exist yet. Create one to continue.
              </div>
            )}
            {!skipTeamCreation && !createdTeamId && (
              <div className="mt-6 space-y-4">
                <Field htmlFor="wiz-team-name" label="Team name" required>
                  <input
                    id="wiz-team-name"
                    type="text"
                    value={teamForm.teamName}
                    onChange={(e) => setTeamForm({ ...teamForm, teamName: e.target.value })}
                    className={inputClass}
                    placeholder="e.g. Engineering"
                    required
                  />
                </Field>
                <Field htmlFor="wiz-team-desc" label="Description" hint="Optional">
                  <textarea
                    id="wiz-team-desc"
                    value={teamForm.description}
                    onChange={(e) => setTeamForm({ ...teamForm, description: e.target.value })}
                    className={inputClass}
                    rows={3}
                    placeholder="What this team is responsible for"
                  />
                </Field>

                {existingMembers.length > 0 && (
                  <Field
                    label="Members to assign"
                    hint="Optional"
                    help={selectedMemberIds.length > 0 ? `${selectedMemberIds.length} selected — they move onto this team.` : 'A member belongs to one team, so choosing someone moves them here.'}
                  >
                    <Select
                      isMulti
                      options={memberOptions}
                      value={selectedMemberOptions}
                      onChange={handleMemberSelectionChange}
                      placeholder="Search and select members…"
                      isSearchable
                      className="text-body"
                      styles={selectStyles}
                      theme={selectTheme}
                    />
                  </Field>
                )}

                <Button variant="primary" loading={loading} disabled={!teamForm.teamName.trim()} onClick={handleCreateTeam} icon={<FiUsers />}>
                  {loading ? 'Creating…' : 'Create Team'}
                </Button>
              </div>
            )}
            {createdTeamId && (
              <div role="status" className="mt-6 flex items-start gap-2.5 px-4 py-3 rounded-card bg-success-subtle border border-success-border text-body text-success">
                <FiCheckCircle aria-hidden="true" className="mt-0.5 shrink-0" />
                <div>
                  <p className="font-medium">Team created.</p>
                  <p className="text-meta mt-0.5">Members can be added or moved from the Teams page at any time.</p>
                </div>
              </div>
            )}
          </div>
        );

      case 4:
        return (
          <WorkflowStagesStep
            workflowName={workflowName}
            onWorkflowNameChange={setWorkflowName}
            description={description}
            onDescriptionChange={setDescription}
            teams={teams}
            stageForm={stageForm}
            onStageFormChange={setStageForm}
            onAddStage={handleAddStage}
            stages={stages}
            onStagesChange={setStages}
            editingStageIndex={editingStageIndex}
            onEditStage={(index) => {
              setEditingStageIndex(index);
              setStageForm(stages[index]);
            }}
            onCreateWorkflow={handleCreateWorkflow}
            loading={loading}
            createdWorkflowId={createdWorkflowId}
          />
        );

      case 5:
        if (!createdWorkflowId) {
          return (
            <div className="py-10 text-center text-body text-ink-muted">
              Create the workflow in the previous step first.
            </div>
          );
        }
        return (
          <div>
            <h2 className="text-title font-semibold text-ink">Configure SLA</h2>
            <p className="mt-1 text-body text-ink-muted mb-6">How quickly each priority must be responded to. Without these, enquiries are never assigned.</p>
            <SLAConfigure
              embedded
              onSuccess={handleSLAConfigSuccess}
              onCancel={() => {}}
              initialWorkflowId={createdWorkflowId}
            />
          </div>
        );

      case 6:
        if (!createdWorkflowId) {
          return (
            <div className="py-10 text-center text-body text-ink-muted">
              Create the workflow in the stages step first.
            </div>
          );
        }
        return (
          <div>
            <h2 className="text-title font-semibold text-ink">Create Priority Rules</h2>
            <p className="mt-1 text-body text-ink-muted">
              Rules set an enquiry’s priority from what it contains, so urgent work is picked up first.
            </p>

            {!skipRuleCreation && (
              <div className="mt-6 grid grid-cols-1 xl:grid-cols-[minmax(0,3fr)_minmax(0,2fr)] gap-6 items-start">
                <div className="rounded-card border border-line p-5 space-y-4">
                  <div className="grid grid-cols-1 sm:grid-cols-[minmax(0,1fr)_12rem] gap-4">
                    <Field htmlFor="wiz-rule-name" label="Rule name" required>
                      <input
                        id="wiz-rule-name"
                        type="text"
                        value={ruleForm.ruleName}
                        onChange={(e) => setRuleForm({ ...ruleForm, ruleName: e.target.value })}
                        className={inputClass}
                        placeholder="e.g. Government projects are high"
                      />
                    </Field>
                    <Field htmlFor="wiz-rule-priority" label="Sets priority to" required>
                      <select
                        id="wiz-rule-priority"
                        value={ruleForm.priority}
                        onChange={(e) => setRuleForm({ ...ruleForm, priority: e.target.value })}
                        className={inputClass}
                      >
                        {['Critical', 'High', 'Medium', 'Low'].map((p) => (
                          <option key={p} value={p}>{p}</option>
                        ))}
                      </select>
                    </Field>
                  </div>

                  <div>
                    <p className="block text-body font-medium text-ink mb-1.5">Conditions</p>
                    <ConditionBuilder
                      value={ruleForm.conditionsJson}
                      onChange={(json) => setRuleForm({ ...ruleForm, conditionsJson: json })}
                    />
                  </div>

                  <label className="flex items-center gap-2 text-body text-ink cursor-pointer">
                    <input
                      type="checkbox"
                      checked={ruleForm.isActive}
                      onChange={(e) => setRuleForm({ ...ruleForm, isActive: e.target.checked })}
                      className="h-4 w-4 rounded"
                    />
                    Active as soon as it is created
                  </label>

                  <Button variant="secondary" icon={editingRuleIndex !== null ? <FiEdit2 /> : <FiPlus />} onClick={handleAddRule}>
                    {editingRuleIndex !== null ? 'Update Rule' : 'Add Rule to List'}
                  </Button>
                </div>

                <div>
                  <p className="eyebrow mb-3">To create · {rules.length}</p>
                  {rules.length === 0 ? (
                    <div className="rounded-card border border-dashed border-line-strong bg-surface-muted px-4 py-8 text-center text-meta text-ink-subtle">
                      Rules you add appear here before they are created.
                    </div>
                  ) : (
                    <>
                      <ul className="rounded-card border border-line divide-y divide-line-subtle">
                        {rules.map((rule, index) => (
                          <li key={index} className="flex items-center gap-3 pl-3 pr-1.5 py-2">
                            <div className="min-w-0 flex-1">
                              <p className="text-body font-medium text-ink truncate">{rule.ruleName}</p>
                              <p className="text-meta text-ink-subtle">
                                Sets {rule.priority} · {rule.isActive ? 'Active' : 'Inactive'}
                              </p>
                            </div>
                            <IconButton
                              size="sm"
                              label={`Edit ${rule.ruleName}`}
                              icon={<FiEdit2 />}
                              onClick={() => {
                                setEditingRuleIndex(index);
                                setRuleForm(rules[index]);
                              }}
                            />
                            <IconButton size="sm" tone="danger" label={`Remove ${rule.ruleName}`} icon={<FiX />} onClick={() => handleRemoveRule(index)} />
                          </li>
                        ))}
                      </ul>
                      <Button className="mt-3 w-full" variant="primary" loading={loading} onClick={handleSaveRules}>
                        {loading ? 'Creating…' : `Create ${rules.length} rule${rules.length === 1 ? '' : 's'} and finish`}
                      </Button>
                    </>
                  )}
                </div>
              </div>
            )}
          </div>
        );

      default:
        return null;
    }
  };

  const isStepCompleted = (step: number) => completedSteps.includes(step);

  const handleStepClick = (step: number) => {
    if (isStepCompleted(step) || step === currentStep) {
      setCurrentStep(step);
    }
  };

  const skip = (step: number, next: () => void) => (
    <Button
      variant="ghost"
      onClick={() => {
        if (!completedSteps.includes(step)) {
          setCompletedSteps([...completedSteps, step]);
        }
        next();
      }}
    >
      Skip
    </Button>
  );

  return (
    <div>
      <PageHeader
        breadcrumbs={[{ label: 'Workflows', onClick: onCancel }]}
        title="Workflow Setup Wizard"
        subtitle="From the people who do the work to the rules that prioritise it."
        actions={
          <Button variant="ghost" icon={<FiX />} onClick={onCancel}>
            Cancel
          </Button>
        }
      />

      <div className="card">
        <div className="px-4 sm:px-8 pt-6 pb-5 border-b border-line-subtle">
          <WizardStepper steps={steps} current={currentStep} completed={completedSteps} onStepClick={handleStepClick} />
        </div>

        <div className="px-5 sm:px-8 py-7 min-h-[360px]">{renderStepContent()}</div>

        <div className="flex items-center justify-between gap-3 px-5 sm:px-8 py-4 border-t border-line-subtle bg-surface-muted rounded-b-card">
          <Button
            variant="secondary"
            icon={<FiChevronLeft />}
            onClick={() => {
              const previousStep = Math.max(1, currentStep - 1);
              setCompletedSteps(completedSteps.filter((step) => step < previousStep));
              setCurrentStep(previousStep);
            }}
            disabled={currentStep === 1}
          >
            Back
          </Button>
          <div className="flex items-center gap-2">
            <span className="hidden sm:inline text-meta text-ink-subtle mr-2 tabular">
              Step {currentStep} of {totalSteps}
            </span>
            {currentStep === 2 &&
              skip(2, () => {
                setSkipMemberCreation(true);
                setCurrentStep(Math.min(totalSteps, currentStep + 1));
              })}
            {currentStep === 3 &&
              skip(3, () => {
                setSkipTeamCreation(true);
                setCurrentStep(Math.min(totalSteps, currentStep + 1));
              })}
            {currentStep === 6 &&
              skip(6, () => {
                setSkipRuleCreation(true);
                if (createdWorkflowId) {
                  onSuccess(createdWorkflowId);
                }
              })}
            {currentStep < totalSteps && (
              <Button
                variant="primary"
                trailingIcon={<FiChevronRight />}
                onClick={() => {
                  // Validation logic for each step
                  // Creating the members empties the list, so a saved step must not be
                  // mistaken for an empty one.
                  if (currentStep === 2 && !skipMemberCreation) {
                    if (newMembers.length > 0) {
                      toast.error('Create the members in the list first, or remove them');
                      return;
                    }
                    if (!completedSteps.includes(2)) {
                      toast.error('Please add at least one member or skip this step');
                      return;
                    }
                  }
                  if (currentStep === 3 && !skipTeamCreation && !createdTeamId) {
                    toast.error('Please create a team or skip this step');
                    return;
                  }
                  if (currentStep === 4 && (!workflowName.trim() || stages.length === 0)) {
                    toast.error('Please complete workflow creation');
                    return;
                  }
                  if (currentStep === 5 && !createdWorkflowId) {
                    toast.error('Please complete workflow creation first');
                    return;
                  }
                  if (!completedSteps.includes(currentStep)) {
                    setCompletedSteps([...completedSteps, currentStep]);
                  }
                  setCurrentStep(Math.min(totalSteps, currentStep + 1));
                }}
              >
                Next
              </Button>
            )}
          </div>
        </div>
      </div>
    </div>
  );
};

export default WorkflowWizard;
