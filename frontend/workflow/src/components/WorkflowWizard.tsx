import { useState, useEffect } from 'react';
import { useTeams } from '../hooks/useTeams';
import { useMembers } from '../hooks/useMembers';
import { teamService } from '../services/teamService';
import { memberService } from '../services/memberService';
import { workflowService } from '../services/workflowService';
import { stageService } from '../services/stageService';
import { toast } from 'react-toastify';
import { FiChevronLeft, FiChevronRight, FiX, FiPlus, FiEdit2, FiPlay, FiUserPlus, FiUsers, FiFileText, FiSettings, FiShield } from 'react-icons/fi';
import Select from 'react-select';
import SLAConfigure from './SLAConfigure';
import ConditionBuilder from './ConditionBuilder';
import { PriorityRuleCreate } from '../types';
import { priorityRulesService } from '../services/priorityRulesService';

interface WorkflowWizardProps {
  onSuccess: (workflowId: number) => void;
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
  // Members will be assigned to first available team when created
}

interface StageForm {
  stageName: string;
  stageOrder: number;
  teamId: number;
  tempId: number;
  stageType?: 'Process' | 'Escalation';
  transitionPolicy?: 'OnComplete' | 'OnTimeout' | 'Manual';
  timeoutMinutes?: number;
}

const WorkflowWizard = ({ onSuccess, onCancel }: WorkflowWizardProps) => {
  const { teams, refetch: refetchTeams } = useTeams();
  const { members: existingMembers, refetch: refetchMembers } = useMembers();
  const [currentStep, setCurrentStep] = useState(1);
  const [completedSteps, setCompletedSteps] = useState<number[]>([]);
  const totalSteps = 6;

  const stepIcons = [FiPlay, FiUserPlus, FiUsers, FiFileText, FiSettings, FiShield];

  // Step 1: Get Started (intro)
  // Step 2: Add Members (new members to be created)
  const [newMembers, setNewMembers] = useState<MemberForm[]>([]);
  const [memberForm, setMemberForm] = useState<MemberForm>({
    firstName: '',
    lastName: '',
    email: '',
    role: '',
    skillLevel: 1,
  });
  const [skipMemberCreation, setSkipMemberCreation] = useState(false);

  // Step 3: Create Team
  const [teamForm, setTeamForm] = useState<TeamForm>({
    teamName: '',
    description: '',
  });
  const [createdTeamId, setCreatedTeamId] = useState<number | null>(null);
  const [skipTeamCreation, setSkipTeamCreation] = useState(false);
  const [selectedMemberIds, setSelectedMemberIds] = useState<number[]>([]); // Selected existing members to assign

  // Step 4: Create Workflow
  const [workflowName, setWorkflowName] = useState('');
  const [description, setDescription] = useState('');
  const [stages, setStages] = useState<StageForm[]>([]);
  const [stageForm, setStageForm] = useState<StageForm>({
    stageName: '',
    stageOrder: 1,
    teamId: 0,
    tempId: 0,
  });
  const [nextTempId, setNextTempId] = useState(1);
  const [editingStageIndex, setEditingStageIndex] = useState<number | null>(null);
  const [createdWorkflowId, setCreatedWorkflowId] = useState<number | null>(null);

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
          const errorMessage = assignError.response?.data?.error || 
                              assignError.response?.data?.message || 
                              assignError.message || 
                              'Failed to assign members';
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
      toast.error(error.response?.data?.error || 'Failed to create team');
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
          // Don't assign teamId - members will be assigned in Step 3 when team is created
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
      const errorMessage = error.response?.data?.error || 
                          error.response?.data?.message || 
                          error.message || 
                          'Failed to create members';
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
      const teamId = createdTeamId || (teams.length > 0 ? teams[0].teamId : 0);
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

      for (let i = 0; i < stages.length; i++) {
        const stage = stages[i];
        await stageService.create({
          stageName: stage.stageName,
          stageOrder: stage.stageOrder,
          workflowId: workflow.workflowId,
          teamId: stage.teamId,
          stageType: stage.stageType || 'Process',
          transitionPolicy: stage.transitionPolicy || 'OnComplete',
          timeoutMinutes: stage.timeoutMinutes,
        });
      }

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
      toast.error(error.response?.data?.error || 'Failed to create workflow');
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
      const errorMessage = error.response?.data?.error || 
                          error.response?.data?.message || 
                          error.message || 
                          'Failed to create rules';
      toast.error(errorMessage);
    } finally {
      setLoading(false);
    }
  };

  const renderStepContent = () => {
    switch (currentStep) {
      case 1:
        return (
          <div className="text-center py-8">
            <h2 className="text-2xl font-semibold mb-4 text-black font-sans">Welcome to Workflow Creation</h2>
            <p className="text-black/70 mb-6 text-sm font-sans max-w-md mx-auto">
              Let's guide you through creating a complete workflow setup. We'll help you add members, create a team, set up your workflow, configure SLA settings, and create priority rules.
            </p>
            <div className="space-y-3 text-left max-w-md mx-auto">
              <div className="flex items-start">
                <div className="flex-shrink-0 w-6 h-6 rounded-full bg-[#434E78] text-white flex items-center justify-center text-xs font-semibold mr-3 mt-0.5">1</div>
                <div>
                  <p className="font-semibold text-black font-sans">Add Members</p>
                  <p className="text-sm text-black/60 font-sans">Add team members with their roles and skill levels (optional)</p>
                </div>
              </div>
              <div className="flex items-start">
                <div className="flex-shrink-0 w-6 h-6 rounded-full bg-[#434E78] text-white flex items-center justify-center text-xs font-semibold mr-3 mt-0.5">2</div>
                <div>
                  <p className="font-semibold text-black font-sans">Create Team</p>
                  <p className="text-sm text-black/60 font-sans">Set up a new team (optional if you already have teams)</p>
                </div>
              </div>
              <div className="flex items-start">
                <div className="flex-shrink-0 w-6 h-6 rounded-full bg-[#434E78] text-white flex items-center justify-center text-xs font-semibold mr-3 mt-0.5">3</div>
                <div>
                  <p className="font-semibold text-black font-sans">Create Workflow</p>
                  <p className="text-sm text-black/60 font-sans">Define your workflow stages and assign teams</p>
                </div>
              </div>
              <div className="flex items-start">
                <div className="flex-shrink-0 w-6 h-6 rounded-full bg-[#434E78] text-white flex items-center justify-center text-xs font-semibold mr-3 mt-0.5">4</div>
                <div>
                  <p className="font-semibold text-black font-sans">Configure SLA</p>
                  <p className="text-sm text-black/60 font-sans">Set up priority levels and response times</p>
                </div>
              </div>
              <div className="flex items-start">
                <div className="flex-shrink-0 w-6 h-6 rounded-full bg-[#434E78] text-white flex items-center justify-center text-xs font-semibold mr-3 mt-0.5">5</div>
                <div>
                  <p className="font-semibold text-black font-sans">Create Rules</p>
                  <p className="text-sm text-black/60 font-sans">Define priority rules for task assignment (optional)</p>
                </div>
              </div>
            </div>
          </div>
        );

      case 2:
        return (
          <div>
            <h2 className="text-xl font-semibold mb-4 text-black font-sans">Add Members</h2>
            <p className="text-sm text-black/60 mb-4 font-sans">
              Add members who will work on tasks. They will be assigned to a team in the next step.
            </p>
            {!skipMemberCreation && (
              <>
                <div className="mb-6 p-4 border border-[#434E78]/30 rounded-azure-sm bg-[#434E78]/5">
                  <div className="grid grid-cols-2 gap-4 mb-4">
                    <div>
                      <label className="block text-black text-sm font-semibold mb-2 font-sans">First Name *</label>
                      <input
                        type="text"
                        value={memberForm.firstName}
                        onChange={(e) => setMemberForm({ ...memberForm, firstName: e.target.value })}
                        className="w-full px-3 py-2 border border-[#434E78]/30 rounded-azure-sm focus:outline-none focus:ring-2 focus:ring-[#434E78] focus:border-[#434E78] bg-white text-black text-sm font-sans"
                      />
                    </div>
                    <div>
                      <label className="block text-black text-sm font-semibold mb-2 font-sans">Last Name *</label>
                      <input
                        type="text"
                        value={memberForm.lastName}
                        onChange={(e) => setMemberForm({ ...memberForm, lastName: e.target.value })}
                        className="w-full px-3 py-2 border border-[#434E78]/30 rounded-azure-sm focus:outline-none focus:ring-2 focus:ring-[#434E78] focus:border-[#434E78] bg-white text-black text-sm font-sans"
                      />
                    </div>
                  </div>
                  <div className="grid grid-cols-2 gap-4 mb-4">
                    <div>
                      <label className="block text-black text-sm font-semibold mb-2 font-sans">Email *</label>
                      <input
                        type="email"
                        value={memberForm.email}
                        onChange={(e) => setMemberForm({ ...memberForm, email: e.target.value })}
                        className="w-full px-3 py-2 border border-[#434E78]/30 rounded-azure-sm focus:outline-none focus:ring-2 focus:ring-[#434E78] focus:border-[#434E78] bg-white text-black text-sm font-sans"
                      />
                    </div>
                    <div>
                      <label className="block text-black text-sm font-semibold mb-2 font-sans">Role *</label>
                      <input
                        type="text"
                        value={memberForm.role}
                        onChange={(e) => setMemberForm({ ...memberForm, role: e.target.value })}
                        className="w-full px-3 py-2 border border-[#434E78]/30 rounded-azure-sm focus:outline-none focus:ring-2 focus:ring-[#434E78] focus:border-[#434E78] bg-white text-black text-sm font-sans"
                        placeholder="e.g., Developer, Manager"
                      />
                    </div>
                  </div>
                  <div className="mb-4">
                    <label className="block text-black text-sm font-semibold mb-2 font-sans">Skill Level *</label>
                    <select
                      value={memberForm.skillLevel}
                      onChange={(e) => setMemberForm({ ...memberForm, skillLevel: parseInt(e.target.value) })}
                      className="w-full px-3 py-2 border border-[#434E78]/30 rounded-azure-sm focus:outline-none focus:ring-2 focus:ring-[#434E78] focus:border-[#434E78] bg-white text-black text-sm font-sans"
                    >
                      <option value={1}>1 - Beginner</option>
                      <option value={2}>2 - Junior</option>
                      <option value={3}>3 - Intermediate</option>
                      <option value={4}>4 - Advanced</option>
                      <option value={5}>5 - Expert</option>
                    </select>
                  </div>
                  <button
                    onClick={handleAddMember}
                    className="bg-[#434E78] text-white px-4 py-2 rounded-azure-sm hover:bg-[#434E78]/90 font-medium text-sm shadow-azure-sm transition-colors font-sans"
                  >
                    <FiPlus className="inline mr-2" />
                    Add Member to List
                  </button>
                </div>

                {newMembers.length > 0 && (
                  <div className="mb-4">
                    <h3 className="text-lg font-semibold mb-3 text-black font-sans">New Members to Create ({newMembers.length})</h3>
                    <p className="text-sm text-black/60 mb-3 font-sans">
                      These members will be created without a team. You can assign them to a team in the next step.
                    </p>
                    <div className="space-y-2">
                      {newMembers.map((member, index) => (
                        <div
                          key={index}
                          className="flex items-center justify-between p-3 bg-[#434E78]/5 rounded-azure-sm border border-[#434E78]/20"
                        >
                          <span className="font-medium text-black font-sans">
                            {member.firstName} {member.lastName} ({member.email}) - {member.role}
                          </span>
                          <button
                            onClick={() => handleRemoveMember(index)}
                            className="text-red-600 hover:text-red-700 hover:bg-red-50 p-1.5 rounded-azure-sm transition-colors"
                          >
                            <FiX className="text-sm" />
                          </button>
                        </div>
                      ))}
                    </div>
                    <button
                      onClick={handleSaveMembers}
                      disabled={loading}
                      className="mt-4 bg-emerald-600 text-white px-4 py-2 rounded-azure-sm hover:bg-emerald-700 disabled:opacity-50 font-medium text-sm shadow-azure-sm transition-colors font-sans"
                    >
                      {loading ? 'Creating...' : 'Create Members'}
                    </button>
                  </div>
                )}
              </>
            )}
          </div>
        );

      case 3:
        return (
          <div>
            <h2 className="text-xl font-semibold mb-4 text-black font-sans">Create Team</h2>
            {teams.length === 0 && (
              <div className="mb-4 p-4 bg-amber-50 border border-amber-200 rounded-azure-sm">
                <p className="text-sm font-semibold text-amber-800 mb-1 font-sans">
                  ⚠️ No teams exist yet. You need to create a team to proceed.
                </p>
              </div>
            )}
            {teams.length > 0 && (
              <p className="text-sm text-black/60 mb-4 font-sans">You have existing teams. You can skip team creation if you want to use an existing team.</p>
            )}
            {!skipTeamCreation && (
              <>
                <div className="mb-4">
                  <label className="block text-black text-sm font-semibold mb-2 font-sans">Team Name *</label>
                  <input
                    type="text"
                    value={teamForm.teamName}
                    onChange={(e) => setTeamForm({ ...teamForm, teamName: e.target.value })}
                    className="w-full px-4 py-2 border border-[#434E78]/30 rounded-azure-sm focus:outline-none focus:ring-2 focus:ring-[#434E78] focus:border-[#434E78] bg-white text-black text-sm font-sans"
                    placeholder="Enter team name"
                    required
                  />
                </div>
                <div className="mb-4">
                  <label className="block text-black text-sm font-semibold mb-2 font-sans">Description</label>
                  <textarea
                    value={teamForm.description}
                    onChange={(e) => setTeamForm({ ...teamForm, description: e.target.value })}
                    className="w-full px-4 py-2 border border-[#434E78]/30 rounded-azure-sm focus:outline-none focus:ring-2 focus:ring-[#434E78] focus:border-[#434E78] bg-white text-black text-sm font-sans"
                    rows={4}
                    placeholder="Enter team description (optional)"
                  />
                </div>
                
                {/* Existing Members Selection */}
                {existingMembers.length > 0 && (
                  <div className="mb-4 p-4 border border-[#434E78]/30 rounded-azure-sm bg-[#434E78]/5">
                    <h3 className="text-lg font-semibold mb-3 text-black font-sans">Select Members to Assign</h3>
                    <p className="text-sm text-black/60 mb-3 font-sans">
                      Choose which existing members should be assigned to this team. This is optional - you can create the team without assigning members.
                    </p>
                    <Select
                      isMulti
                      options={memberOptions}
                      value={selectedMemberOptions}
                      onChange={handleMemberSelectionChange}
                      placeholder="Search and select members..."
                      isSearchable
                      className="text-sm font-sans"
                      styles={{
                        control: (base) => ({
                          ...base,
                          borderColor: 'rgba(67, 78, 120, 0.3)',
                          boxShadow: 'none',
                          '&:hover': {
                            borderColor: 'rgba(67, 78, 120, 0.5)',
                          },
                        }),
                        multiValue: (base) => ({
                          ...base,
                          backgroundColor: '#d1fae5',
                          color: '#065f46',
                        }),
                        multiValueLabel: (base) => ({
                          ...base,
                          color: '#065f46',
                          fontWeight: 500,
                        }),
                        multiValueRemove: (base) => ({
                          ...base,
                          color: '#065f46',
                          '&:hover': {
                            backgroundColor: '#a7f3d0',
                            color: '#064e3b',
                          },
                        }),
                        option: (base, state) => ({
                          ...base,
                          backgroundColor: state.isSelected
                            ? '#434E78'
                            : state.isFocused
                            ? 'rgba(67, 78, 120, 0.1)'
                            : 'white',
                          color: state.isSelected ? 'white' : 'black',
                          '&:active': {
                            backgroundColor: state.isSelected ? '#434E78' : 'rgba(67, 78, 120, 0.2)',
                          },
                        }),
                      }}
                      theme={(theme) => ({
                        ...theme,
                        colors: {
                          ...theme.colors,
                          primary: '#434E78',
                          primary25: 'rgba(67, 78, 120, 0.1)',
                          primary50: 'rgba(67, 78, 120, 0.2)',
                          primary75: '#434E78',
                        },
                      })}
                    />
                    {selectedMemberIds.length > 0 && (
                      <p className="text-sm text-emerald-700 mt-3 font-sans">
                        {selectedMemberIds.length} member(s) selected
                      </p>
                    )}
                  </div>
                )}
                
                <button
                  onClick={handleCreateTeam}
                  disabled={loading || !teamForm.teamName.trim()}
                  className="bg-[#434E78] text-white px-4 py-2 rounded-azure-sm hover:bg-[#434E78]/90 disabled:opacity-50 font-medium text-sm shadow-azure-sm transition-colors font-sans"
                >
                  {loading ? 'Creating...' : 'Create Team'}
                </button>
              </>
            )}
            {createdTeamId && (
              <div className="mt-4 p-3 bg-emerald-50 border border-emerald-200 rounded-azure-sm">
                <p className="text-sm text-emerald-800 font-sans">✓ Team created successfully!</p>
                {selectedMemberIds.length === 0 && (
                  <p className="text-sm text-emerald-700 mt-1 font-sans">No members were assigned. You can assign members later or go back to Step 2 to add new members.</p>
                )}
              </div>
            )}
          </div>
        );

      case 4:
        return (
          <div>
            <h2 className="text-xl font-semibold mb-4 text-black font-sans">Create Workflow</h2>
            <div className="mb-4">
              <label className="block text-black text-sm font-semibold mb-2 font-sans">Workflow Name *</label>
              <input
                type="text"
                value={workflowName}
                onChange={(e) => setWorkflowName(e.target.value)}
                className="w-full px-4 py-2 border border-[#434E78]/30 rounded-azure-sm focus:outline-none focus:ring-2 focus:ring-[#434E78] focus:border-[#434E78] bg-white text-black text-sm font-sans"
                placeholder="Enter workflow name"
                required
              />
            </div>
            <div className="mb-4">
              <label className="block text-black text-sm font-semibold mb-2 font-sans">Description</label>
              <textarea
                value={description}
                onChange={(e) => setDescription(e.target.value)}
                className="w-full px-4 py-2 border border-[#434E78]/30 rounded-azure-sm focus:outline-none focus:ring-2 focus:ring-[#434E78] focus:border-[#434E78] bg-white text-black text-sm font-sans"
                rows={4}
                placeholder="Enter workflow description (optional)"
              />
            </div>
            <div className="mb-6 p-4 border border-[#434E78]/30 rounded-azure-sm bg-[#434E78]/5">
              <h3 className="text-lg font-semibold mb-4 text-black font-sans">Add Stages</h3>
              <div className="grid grid-cols-2 gap-4 mb-4">
                <div>
                  <label className="block text-black text-sm font-semibold mb-2 font-sans">Stage Name *</label>
                  <input
                    type="text"
                    value={stageForm.stageName}
                    onChange={(e) => setStageForm({ ...stageForm, stageName: e.target.value })}
                    className="w-full px-3 py-2 border border-[#434E78]/30 rounded-azure-sm focus:outline-none focus:ring-2 focus:ring-[#434E78] focus:border-[#434E78] bg-white text-black text-sm font-sans"
                    placeholder="e.g., To Do, In Progress, Done"
                  />
                </div>
                <div>
                  <label className="block text-black text-sm font-semibold mb-2 font-sans">Assign Team *</label>
                  <select
                    value={stageForm.teamId || 0}
                    onChange={(e) => setStageForm({ ...stageForm, teamId: parseInt(e.target.value) || 0 })}
                    className="w-full px-3 py-2 border border-[#434E78]/30 rounded-azure-sm focus:outline-none focus:ring-2 focus:ring-[#434E78] focus:border-[#434E78] bg-white text-black text-sm font-sans"
                  >
                    <option value={0}>Select Team</option>
                    {teams.map((team) => (
                      <option key={team.teamId} value={team.teamId}>
                        {team.teamName}
                      </option>
                    ))}
                  </select>
                </div>
              </div>
              <button
                onClick={handleAddStage}
                className="bg-[#434E78] text-white px-4 py-2 rounded-azure-sm hover:bg-[#434E78]/90 font-medium text-sm shadow-azure-sm transition-colors font-sans"
              >
                {editingStageIndex !== null ? 'Update Stage' : 'Add Stage'}
              </button>
            </div>

            {stages.length > 0 && (
              <div className="mt-6">
                <h3 className="text-lg font-semibold mb-4 text-black font-sans">Added Stages</h3>
                <div className="space-y-2">
                  {stages.map((stage, index) => (
                    <div
                      key={index}
                      className="flex items-center justify-between p-3 bg-[#434E78]/5 rounded-azure-sm border border-[#434E78]/20"
                    >
                      <span className="font-medium text-black font-sans">
                        {stage.stageOrder}. {stage.stageName}
                        {stage.teamId > 0 && (
                          <span className="text-xs text-black/60 ml-2 font-sans">
                            (Team: {teams.find(t => t.teamId === stage.teamId)?.teamName})
                          </span>
                        )}
                      </span>
                      <div>
                        <button
                          onClick={() => {
                            setEditingStageIndex(index);
                            setStageForm(stages[index]);
                          }}
                          className="text-[#434E78] hover:text-[#434E78]/80 hover:bg-[#434E78]/10 p-1.5 rounded-azure-sm mr-2 transition-colors"
                        >
                          <FiEdit2 className="text-sm" />
                        </button>
                        <button
                          onClick={() => setStages(stages.filter((_, i) => i !== index).map((s, i) => ({ ...s, stageOrder: i + 1 })))}
                          className="text-red-600 hover:text-red-700 hover:bg-red-50 p-1.5 rounded-azure-sm transition-colors"
                        >
                          <FiX className="text-sm" />
                        </button>
                      </div>
                    </div>
                  ))}
                </div>
                <button
                  onClick={handleCreateWorkflow}
                  disabled={loading || !workflowName.trim() || stages.length === 0}
                  className="mt-4 bg-emerald-600 text-white px-4 py-2 rounded-azure-sm hover:bg-emerald-700 disabled:opacity-50 font-medium text-sm shadow-azure-sm transition-colors font-sans"
                >
                  {loading ? 'Creating...' : 'Create Workflow'}
                </button>
              </div>
            )}
            {createdWorkflowId && (
              <div className="mt-4 p-3 bg-emerald-50 border border-emerald-200 rounded-azure-sm">
                <p className="text-sm text-emerald-800 font-sans">✓ Workflow created successfully!</p>
              </div>
            )}
          </div>
        );

      case 5:
        if (!createdWorkflowId) {
          return (
            <div className="text-center py-8">
              <p className="text-black/70 font-sans">Please complete the workflow creation step first.</p>
            </div>
          );
        }
        return (
          <div>
            <h2 className="text-xl font-semibold mb-4 text-black font-sans">Configure SLA</h2>
            <SLAConfigure
              onSuccess={handleSLAConfigSuccess}
              onCancel={() => {}}
              initialWorkflowId={createdWorkflowId}
            />
          </div>
        );

      case 6:
        if (!createdWorkflowId) {
          return (
            <div className="text-center py-8">
              <p className="text-black/70 font-sans">Please complete the workflow creation step first.</p>
            </div>
          );
        }
        return (
          <div>
            <h2 className="text-xl font-semibold mb-4 text-black font-sans">Create Priority Rules</h2>
            <p className="text-sm text-black/60 mb-4 font-sans">
              Create priority rules for this workflow. Rules determine how tasks are prioritized based on conditions.
            </p>

            {!skipRuleCreation && (
              <>
                <div className="mb-6 p-4 border border-[#434E78]/30 rounded-azure-sm bg-[#434E78]/5">
                  <h3 className="text-lg font-semibold mb-4 text-black font-sans">Add Rule</h3>
                  
                  <div className="mb-4">
                    <label className="block text-black text-sm font-semibold mb-2 font-sans">Rule Name *</label>
                    <input
                      type="text"
                      value={ruleForm.ruleName}
                      onChange={(e) => setRuleForm({ ...ruleForm, ruleName: e.target.value })}
                      className="w-full px-3 py-2 border border-[#434E78]/30 rounded-azure-sm focus:outline-none focus:ring-2 focus:ring-[#434E78] focus:border-[#434E78] bg-white text-black text-sm font-sans"
                      placeholder="e.g., High Priority for Critical Tasks"
                    />
                  </div>

                  <div className="mb-4">
                    <label className="block text-black text-sm font-semibold mb-2 font-sans">Priority *</label>
                    <select
                      value={ruleForm.priority}
                      onChange={(e) => setRuleForm({ ...ruleForm, priority: e.target.value })}
                      className="w-full px-3 py-2 border border-[#434E78]/30 rounded-azure-sm focus:outline-none focus:ring-2 focus:ring-[#434E78] focus:border-[#434E78] bg-white text-black text-sm font-sans"
                    >
                      <option value="Critical">Critical</option>
                      <option value="High">High</option>
                      <option value="Medium">Medium</option>
                      <option value="Low">Low</option>
                    </select>
                  </div>

                  <div className="mb-4">
                    <label className="block text-black text-sm font-semibold mb-2 font-sans">Conditions *</label>
                    <ConditionBuilder
                      value={ruleForm.conditionsJson}
                      onChange={(json) => setRuleForm({ ...ruleForm, conditionsJson: json })}
                    />
                  </div>

                  <div className="flex items-center gap-2 mb-4">
                    <input
                      type="checkbox"
                      checked={ruleForm.isActive}
                      onChange={(e) => setRuleForm({ ...ruleForm, isActive: e.target.checked })}
                      className="rounded"
                    />
                    <label className="text-sm font-medium text-black font-sans">Active</label>
                  </div>

                  <button
                    onClick={handleAddRule}
                    className="bg-[#434E78] text-white px-4 py-2 rounded-azure-sm hover:bg-[#434E78]/90 font-medium text-sm shadow-azure-sm transition-colors font-sans"
                  >
                    {editingRuleIndex !== null ? 'Update Rule' : 'Add Rule to List'}
                  </button>
                </div>

                {rules.length > 0 && (
                  <div className="mb-4">
                    <h3 className="text-lg font-semibold mb-3 text-black font-sans">Rules to Create ({rules.length})</h3>
                    <div className="space-y-2">
                      {rules.map((rule, index) => (
                        <div
                          key={index}
                          className="flex items-center justify-between p-3 bg-[#434E78]/5 rounded-azure-sm border border-[#434E78]/20"
                        >
                          <div className="flex-1">
                            <span className="font-medium text-black font-sans">
                              {rule.ruleName} - {rule.priority}
                            </span>
                            <p className="text-xs text-black/60 mt-1 font-sans">
                              {rule.isActive ? 'Active' : 'Inactive'}
                            </p>
                          </div>
                          <div>
                            <button
                              onClick={() => {
                                setEditingRuleIndex(index);
                                setRuleForm(rules[index]);
                              }}
                              className="text-[#434E78] hover:text-[#434E78]/80 hover:bg-[#434E78]/10 p-1.5 rounded-azure-sm mr-2 transition-colors"
                              title="Edit"
                            >
                              <FiEdit2 className="text-sm" />
                            </button>
                            <button
                              onClick={() => handleRemoveRule(index)}
                              className="text-red-600 hover:text-red-700 hover:bg-red-50 p-1.5 rounded-azure-sm transition-colors"
                              title="Remove"
                            >
                              <FiX className="text-sm" />
                            </button>
                          </div>
                        </div>
                      ))}
                    </div>
                    <button
                      onClick={handleSaveRules}
                      disabled={loading}
                      className="mt-4 bg-emerald-600 text-white px-4 py-2 rounded-azure-sm hover:bg-emerald-700 disabled:opacity-50 font-medium text-sm shadow-azure-sm transition-colors font-sans"
                    >
                      {loading ? 'Creating...' : 'Create Rules'}
                    </button>
                  </div>
                )}
              </>
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

  return (
    <div className="p-8 bg-white font-sans">
      <div className="max-w-6xl mx-auto">
        <div className="flex items-center justify-between mb-6 pb-4 border-b border-[#434E78]/20">
          <h1 className="text-3xl font-semibold text-black font-sans tracking-tight">Workflow Setup Wizard</h1>
          <button
            onClick={onCancel}
            className="text-black/70 hover:text-black hover:bg-[#434E78]/10 p-2 rounded-azure-sm transition-colors"
          >
            <FiX className="text-xl" />
          </button>
        </div>

        <div className="flex gap-8">
          {/* Vertical Step Indicator */}
          <div className="w-16 flex-shrink-0">
            <div className="bg-white rounded-azure-sm shadow-azure-md p-4 border border-[#434E78]/20">
              <div className="relative">
                <div className="space-y-8">
                  {Array.from({ length: totalSteps }, (_, i) => i + 1).map((step) => {
                    const isCompleted = isStepCompleted(step);
                    const isActive = step === currentStep;
                    const StepIcon = stepIcons[step - 1];

                    return (
                      <div key={step} className="relative flex items-center">
                        {step < totalSteps && (
                          <div className="absolute left-3 top-3 w-0.5 z-0" style={{ height: '56px' }}>
                            <div
                              className={`w-full h-full ${
                                isCompleted ? 'bg-emerald-600' : 'bg-[#434E78]/30'
                              }`}
                            />
                          </div>
                        )}

                        <div
                          className={`relative z-10 flex-shrink-0 ${
                            (isCompleted || isActive) ? 'cursor-pointer' : 'cursor-not-allowed'
                          }`}
                          onClick={() => handleStepClick(step)}
                        >
                          {isCompleted && (
                            <div className="w-6 h-6 rounded-full bg-white flex items-center justify-center border-2 border-emerald-600 hover:bg-emerald-50 transition-colors shadow-azure-sm">
                              <StepIcon className="text-emerald-600 text-xs font-semibold" />
                            </div>
                          )}
                          {isActive && !isCompleted && (
                            <div className="relative">
                              <div className="absolute inset-0 rounded-full bg-[#434E78] animate-ping opacity-75" style={{ animationDuration: '2s' }}></div>
                              <div className="relative w-6 h-6 rounded-full bg-[#434E78] flex items-center justify-center border-2 border-white hover:bg-[#434E78]/90 transition-colors shadow-azure-md">
                                <StepIcon className="text-white text-xs font-semibold z-10 relative" />
                              </div>
                            </div>
                          )}
                          {!isActive && !isCompleted && (
                            <div className="w-6 h-6 rounded-full bg-[#434E78]/20 flex items-center justify-center border-2 border-white">
                              <StepIcon className="text-black text-xs font-semibold" />
                            </div>
                          )}
                        </div>
                      </div>
                    );
                  })}
                </div>
              </div>
            </div>
          </div>

          {/* Main Content Area */}
          <div className="flex-1">
            <div className="bg-white rounded-azure-sm shadow-azure-md p-8 mb-6 border border-[#434E78]/20">
              {renderStepContent()}
            </div>

            <div className="flex justify-between">
              <button
                onClick={() => {
                  const previousStep = Math.max(1, currentStep - 1);
                  setCompletedSteps(completedSteps.filter(step => step < previousStep));
                  setCurrentStep(previousStep);
                }}
                disabled={currentStep === 1}
                className="flex items-center px-5 py-2 border border-[#434E78]/30 rounded-azure-sm hover:bg-[#434E78]/5 disabled:opacity-50 disabled:cursor-not-allowed text-black font-medium text-sm transition-colors font-sans"
              >
                <FiChevronLeft className="mr-2" />
                Back
              </button>
              <div className="flex gap-3">
                {currentStep === 2 && (
                  <button
                    onClick={() => {
                      setSkipMemberCreation(true);
                      if (!completedSteps.includes(2)) {
                        setCompletedSteps([...completedSteps, 2]);
                      }
                      setCurrentStep(Math.min(totalSteps, currentStep + 1));
                    }}
                    className="flex items-center px-5 py-2 border border-[#434E78]/30 rounded-azure-sm hover:bg-[#434E78]/5 text-black font-medium text-sm transition-colors font-sans"
                  >
                    Skip
                  </button>
                )}
                {currentStep === 3 && (
                  <button
                    onClick={() => {
                      setSkipTeamCreation(true);
                      if (!completedSteps.includes(3)) {
                        setCompletedSteps([...completedSteps, 3]);
                      }
                      setCurrentStep(Math.min(totalSteps, currentStep + 1));
                    }}
                    className="flex items-center px-5 py-2 border border-[#434E78]/30 rounded-azure-sm hover:bg-[#434E78]/5 text-black font-medium text-sm transition-colors font-sans"
                  >
                    Skip
                  </button>
                )}
                {currentStep === 6 && (
                  <button
                    onClick={() => {
                      setSkipRuleCreation(true);
                      if (!completedSteps.includes(6)) {
                        setCompletedSteps([...completedSteps, 6]);
                      }
                      if (createdWorkflowId) {
                        onSuccess(createdWorkflowId);
                      }
                    }}
                    className="flex items-center px-5 py-2 border border-[#434E78]/30 rounded-azure-sm hover:bg-[#434E78]/5 text-black font-medium text-sm transition-colors font-sans"
                  >
                    Skip
                  </button>
                )}
                {currentStep < totalSteps ? (
                  <button
                    onClick={() => {
                      // Validation logic for each step
                      if (currentStep === 2 && !skipMemberCreation && newMembers.length === 0) {
                        toast.error('Please add at least one member or skip this step');
                        return;
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
                      if (currentStep === 6 && !createdWorkflowId) {
                        toast.error('Please complete workflow creation first');
                        return;
                      }
                      if (!completedSteps.includes(currentStep)) {
                        setCompletedSteps([...completedSteps, currentStep]);
                      }
                      setCurrentStep(Math.min(totalSteps, currentStep + 1));
                    }}
                    className="flex items-center px-5 py-2 bg-[#434E78] text-white rounded-azure-sm hover:bg-[#434E78]/90 font-medium text-sm shadow-azure-sm transition-colors font-sans"
                  >
                    Next
                    <FiChevronRight className="ml-2" />
                  </button>
                ) : (
                  <div></div>
                )}
              </div>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
};

export default WorkflowWizard;

