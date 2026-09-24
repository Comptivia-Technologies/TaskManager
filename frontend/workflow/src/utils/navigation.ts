import type { IconType } from 'react-icons';
import {
  FiActivity,
  FiClock,
  FiGitMerge,
  FiInbox,
  FiKey,
  FiSliders,
  FiUser,
  FiUsers,
  FiUserCheck,
} from 'react-icons/fi';
import { PERMISSIONS } from './roleUtils';

/**
 * Every destination in the application, with the permission that reveals it.
 *
 * The sidebar and the command palette both read this, so a screen can never appear
 * in one and not the other — and a new route needs adding in exactly one place.
 */
export interface NavDestination {
  path: string;
  label: string;
  /** Omitted for destinations everyone can reach. */
  permission?: string;
  /** The area it belongs to: a sidebar section and the palette's context hint. */
  group: NavGroup;
  icon: IconType;
  /** Extra search terms. Never displayed. */
  keywords?: string;
}

/**
 * Grouped by what a person is doing, not by which API owns it: working the
 * queue, shaping the process, managing the people who do it, and access.
 */
export type NavGroup = 'Work' | 'Process' | 'People' | 'User Management';

export const NAV_GROUPS: NavGroup[] = ['Work', 'Process', 'People', 'User Management'];

export const NAV_DESTINATIONS: NavDestination[] = [
  { path: '/enquiry', label: 'Enquiries', group: 'Work', icon: FiInbox, keywords: 'enquiries tasks queue my work inbox' },
  { path: '/workflows', label: 'Workflows', permission: PERMISSIONS.workflowsView, group: 'Process', icon: FiGitMerge, keywords: 'stages process flow' },
  { path: '/sla-configuration', label: 'SLA Targets', permission: PERMISSIONS.slaView, group: 'Process', icon: FiClock, keywords: 'sla configuration deadlines response time' },
  { path: '/priority-rules', label: 'Priority Rules', permission: PERMISSIONS.priorityRulesView, group: 'Process', icon: FiSliders, keywords: 'critical high urgency conditions' },
  { path: '/teams', label: 'Teams', permission: PERMISSIONS.teamsView, group: 'People', icon: FiUsers, keywords: 'groups' },
  { path: '/members', label: 'Members', permission: PERMISSIONS.membersView, group: 'People', icon: FiUser, keywords: 'people staff engineers' },
  { path: '/workload-configuration', label: 'Workload', permission: PERMISSIONS.workloadView, group: 'People', icon: FiActivity, keywords: 'workload configuration capacity assignment balance' },
  { path: '/users', label: 'Users', permission: PERMISSIONS.usersView, group: 'User Management', icon: FiUserCheck, keywords: 'accounts logins' },
  { path: '/roles-permissions', label: 'Roles & Permissions', permission: PERMISSIONS.rolesView, group: 'User Management', icon: FiKey, keywords: 'access rights' },
];

/** The destinations this session may actually reach. */
export const visibleDestinations = (
  permissions: string[] | null,
  hasPermission: (permissions: string[] | null, code: string) => boolean
) => NAV_DESTINATIONS.filter((d) => !d.permission || hasPermission(permissions, d.permission));
