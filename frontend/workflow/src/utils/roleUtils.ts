// Permission codes seeded by WorkflowManagement.API (Program.cs). Each admin area
// has a matching `<area>.view` / `<area>.manage` pair.
export const PERMISSIONS = {
  workflowsView: 'workflows.view',
  tasksView: 'tasks.view',
  tasksManage: 'tasks.manage',
  teamsView: 'teams.view',
  membersView: 'members.view',
  slaView: 'sla.view',
  workloadView: 'workload.view',
  priorityRulesView: 'priority_rules.view',
  usersView: 'users.view',
  rolesView: 'roles.view',
} as const;

// `null` means the session could not determine a role — an unconfigured or
// not-yet-linked login keeps full access rather than being locked out of the
// screens needed to configure it. An empty array is a resolved "no access".
export const hasPermission = (permissions: string[] | null, code: string) =>
  permissions === null || permissions.includes(code);

export const hasAnyPermission = (permissions: string[] | null, codes: string[]) =>
  permissions === null || codes.some((code) => permissions.includes(code));
