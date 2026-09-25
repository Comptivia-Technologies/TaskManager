import Tabs from '../components/Tabs';
import EmptyState from '../components/EmptyState';
import DataTable from '../components/DataTable';
import Badge from '../components/Badge';
import Button, { IconButton } from '../components/Button';
import PageHeader from '../components/PageHeader';
import Modal from '../components/Modal';
import Field from '../components/Field';
import ConfirmDialog from '../components/ConfirmDialog';
import Avatar from '../components/Avatar';
import SearchInput from '../components/SearchInput';
import { inputClass } from '../utils/formStyles';
import { useState, useEffect, useCallback } from 'react';
import { User, UserCreate, UserStatus, Role } from '../types';
import { FiArchive, FiEdit2, FiPlus, FiRefreshCw, FiUserCheck, FiUsers } from 'react-icons/fi';
import { toast } from 'react-toastify';
import { useAuth } from '../contexts/AuthContext';
import { userService, CreateOrganizationUserPayload, UpdateOrganizationUserPayload } from '../services/userService';
import { roleService } from '../services/roleService';
import LoadingSpinner from '../components/LoadingSpinner';
import { formatDateOnlyIST } from '../utils/dateUtils';

const errorText = (err: unknown, fallback: string) =>
  err && typeof err === 'object' && 'response' in err && err.response && typeof err.response === 'object' && 'data' in err
    ? String((err.response as { data?: unknown }).data)
    : fallback;

const Users = () => {
  const { organizationId } = useAuth();
  const [activeUsers, setActiveUsers] = useState<User[]>([]);
  const [pendingUsers, setPendingUsers] = useState<User[]>([]);
  const [loading, setLoading] = useState(true);
  const [statusFilter, setStatusFilter] = useState<UserStatus>('Active');
  const [search, setSearch] = useState('');
  const [isModalOpen, setIsModalOpen] = useState(false);
  const [editingUser, setEditingUser] = useState<User | null>(null);
  const [formData, setFormData] = useState<UserCreate>({
    fullName: '',
    email: '',
    organisationId: '',
    role: '',
  });
  const [selectedRoleId, setSelectedRoleId] = useState('');
  const [submitting, setSubmitting] = useState(false);
  const [archiving, setArchiving] = useState(false);
  const [userToArchive, setUserToArchive] = useState<User | null>(null);
  const [restoring, setRestoring] = useState(false);
  const [userToRestore, setUserToRestore] = useState<User | null>(null);
  const [roles, setRoles] = useState<Role[]>([]);

  const loadUsers = useCallback(async () => {
    if (!organizationId) {
      setLoading(false);
      setActiveUsers([]);
      setPendingUsers([]);
      setRoles([]);
      return;
    }
    setLoading(true);
    try {
      const [active, pending, rolesList] = await Promise.all([
        userService.getActiveOrganizationUsers(organizationId),
        userService.getPendingInvitations(organizationId),
        roleService.getByOrganization(organizationId),
      ]);
      setActiveUsers(active);
      setPendingUsers(pending);
      setRoles(rolesList);
    } catch (err: unknown) {
      toast.error('Failed to load users');
      setActiveUsers([]);
      setPendingUsers([]);
      setRoles([]);
    } finally {
      setLoading(false);
    }
  }, [organizationId]);

  useEffect(() => {
    loadUsers();
  }, [loadUsers]);

  const activeList = activeUsers.filter((u) => u.status === 'Active');
  const archivedList = activeUsers.filter((u) => u.status === 'Archived');
  const byStatus = statusFilter === 'Active' ? activeList : statusFilter === 'Pending' ? pendingUsers : archivedList;
  const term = search.trim().toLowerCase();
  const filteredUsers = term
    ? byStatus.filter((u) => [u.fullName, u.email, u.role].some((v) => v?.toLowerCase().includes(term)))
    : byStatus;

  const openAddModal = () => {
    setEditingUser(null);
    setFormData({ fullName: '', email: '', organisationId: organizationId || '', role: '' });
    setSelectedRoleId('');
    setIsModalOpen(true);
  };

  const openEditModal = (user: User) => {
    setEditingUser(user);
    setFormData({
      fullName: user.fullName,
      email: user.email,
      organisationId: user.organisationId,
      role: user.role,
    });
    const roleId = roles.find((r) => r.name === user.role)?.roleId ?? '';
    setSelectedRoleId(roleId);
    setIsModalOpen(true);
  };

  const closeModal = () => {
    setIsModalOpen(false);
    setEditingUser(null);
    setFormData({ fullName: '', email: '', organisationId: organizationId || '', role: '' });
    setSelectedRoleId('');
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    const productId = process.env.REACT_APP_PRODUCT_ID;
    if (editingUser) {
      if (!productId) {
        toast.error('Product not configured');
        return;
      }
      const roleId = selectedRoleId || roles.find((r) => r.name === formData.role)?.roleId;
      if (!roleId) {
        toast.error('Please select a role');
        return;
      }
      setSubmitting(true);
      try {
        const payload: UpdateOrganizationUserPayload = {
          full_name: formData.fullName,
          email: formData.email,
          role_id: roleId,
          role_name: formData.role,
        };
        await userService.updateOrganizationUser(editingUser.userId, payload);
        toast.success('User updated successfully');
        closeModal();
        loadUsers();
      } catch (err: unknown) {
        toast.error(errorText(err, 'Failed to update user'));
      } finally {
        setSubmitting(false);
      }
      return;
    }
    if (!organizationId || !productId) {
      toast.error('Organization or product not configured');
      return;
    }
    const roleId = selectedRoleId || roles.find((r) => r.name === formData.role)?.roleId;
    if (!roleId) {
      toast.error('Please select a role');
      return;
    }
    setSubmitting(true);
    try {
      const payload: CreateOrganizationUserPayload = {
        organization_id: organizationId,
        email: formData.email,
        full_name: formData.fullName,
        user_type: 'organization',
        product_id: productId,
        role_id: roleId,
        role_name: formData.role,
      };
      await userService.createOrganizationUser(payload);
      toast.success('User added successfully');
      closeModal();
      loadUsers();
    } catch (err: unknown) {
      toast.error(errorText(err, 'Failed to add user'));
    } finally {
      setSubmitting(false);
    }
  };

  const handleRestoreUser = async (user: User) => {
    const idToRestore = user.id ?? user.userId;
    if (!idToRestore) {
      toast.error('User id not found');
      return;
    }
    setRestoring(true);
    try {
      await userService.updateUserStatus(idToRestore, 'active');
      toast.success('User restored');
      setUserToRestore(null);
      loadUsers();
    } catch (err: unknown) {
      toast.error(errorText(err, 'Failed to restore user'));
    } finally {
      setRestoring(false);
    }
  };

  const handleArchiveUser = async (user: User) => {
    const idToArchive = user.id ?? user.userId;
    if (!idToArchive) {
      toast.error('User id not found');
      return;
    }
    setArchiving(true);
    try {
      await userService.deleteUser(idToArchive);
      toast.success('User archived');
      setUserToArchive(null);
      loadUsers();
    } catch (err: unknown) {
      toast.error(errorText(err, 'Failed to archive user'));
    } finally {
      setArchiving(false);
    }
  };

  if (loading) {
    return <LoadingSpinner label="Loading users" />;
  }

  return (
    <div>
      <PageHeader
        title="Users"
        subtitle="Accounts come from Product Hub. Roles assigned here or there both apply."
        actions={
          <Button variant="primary" icon={<FiPlus />} onClick={openAddModal}>
            Add User
          </Button>
        }
      />

      <div className="mb-5">
        <Tabs
          label="User status"
          activeId={statusFilter}
          onChange={(id) => setStatusFilter(id as UserStatus)}
          tabs={[
            { id: 'Active', label: 'Active', count: activeList.length },
            { id: 'Pending', label: 'Pending', count: pendingUsers.length },
            { id: 'Archived', label: 'Archived', count: archivedList.length },
          ]}
        />
      </div>

      <DataTable<User>
        caption={`${statusFilter} users`}
        rows={filteredUsers}
        rowKey={(u) => u.userId}
        toolbar={
          byStatus.length > 0 ? (
            <>
              <SearchInput label="Search users" placeholder="Search by name, email or role" value={search} onChange={setSearch} className="w-full sm:w-72" />
              <span className="sm:ml-auto text-meta text-ink-subtle tabular">{filteredUsers.length} of {byStatus.length}</span>
            </>
          ) : undefined
        }
        empty={
          <EmptyState
            icon={<FiUsers />}
            title={term ? 'No users match' : `No ${statusFilter.toLowerCase()} users`}
            body={
              term
                ? 'Try a different name, email or role.'
                : statusFilter === 'Active'
                  ? 'Add a user to give someone access to this organisation.'
                  : `Users appear here once they are ${statusFilter.toLowerCase()}.`
            }
            action={
              statusFilter === 'Active' && !term ? (
                <Button variant="primary" icon={<FiPlus />} onClick={openAddModal}>
                  Add User
                </Button>
              ) : null
            }
          />
        }
        columns={[
          {
            key: 'fullName',
            header: 'Name',
            sortValue: (u) => u.fullName.toLowerCase(),
            render: (u) => (
              <div className="flex items-center gap-3 min-w-0">
                <Avatar name={u.fullName || u.email} size="md" />
                <div className="min-w-0">
                  <span className="font-semibold text-ink block truncate">{u.fullName}</span>
                  <span className="text-meta text-ink-subtle block truncate">{u.email}</span>
                </div>
              </div>
            ),
          },
          {
            key: 'role',
            header: 'Role',
            sortValue: (u) => u.role ?? '',
            render: (u) => (u.role ? <Badge tone="primary">{u.role}</Badge> : <span className="text-ink-subtle">—</span>),
          },
          {
            key: 'status',
            header: 'Status',
            sortValue: (u) => u.status,
            render: (u) => (
              <Badge dot tone={u.status === 'Active' ? 'success' : u.status === 'Pending' ? 'warning' : 'neutral'}>
                {u.status}
              </Badge>
            ),
          },
          {
            key: 'updatedAt',
            header: 'Updated',
            hideOnMobile: true,
            align: 'right',
            sortValue: (u) => u.updatedAt,
            render: (u) => <span className="text-meta text-ink-subtle">{formatDateOnlyIST(u.updatedAt)}</span>,
          },
          {
            key: 'actions',
            header: 'Actions',
            align: 'right',
            width: '110px',
            render: (u) =>
              statusFilter === 'Archived' ? (
                <div className="flex justify-end">
                  <IconButton size="sm" label={`Restore ${u.fullName}`} icon={<FiRefreshCw />} onClick={() => setUserToRestore(u)} />
                </div>
              ) : (
                <div className="flex justify-end gap-1">
                  <IconButton size="sm" label={`Edit ${u.fullName}`} icon={<FiEdit2 />} onClick={() => openEditModal(u)} />
                  <IconButton size="sm" tone="danger" label={`Archive ${u.fullName}`} icon={<FiArchive />} onClick={() => setUserToArchive(u)} />
                </div>
              ),
          },
        ]}
      />

      <Modal
        isOpen={isModalOpen}
        title={editingUser ? 'Edit User' : 'Add User'}
        icon={<FiUserCheck />}
        onClose={closeModal}
        footer={
          <>
            <Button variant="secondary" onClick={closeModal} disabled={submitting}>
              Cancel
            </Button>
            <Button variant="primary" type="submit" form="user-form" loading={submitting}>
              {submitting ? (editingUser ? 'Updating…' : 'Adding…') : editingUser ? 'Update User' : 'Add User'}
            </Button>
          </>
        }
      >
        <form id="user-form" onSubmit={handleSubmit} className="space-y-4">
          <Field htmlFor="user-name" label="Full Name" required>
            <input
              id="user-name"
              type="text"
              placeholder="Enter full name"
              value={formData.fullName}
              onChange={(e) => setFormData({ ...formData, fullName: e.target.value })}
              className={inputClass}
              required
            />
          </Field>
          <Field htmlFor="user-email" label="Email" required>
            <input
              id="user-email"
              type="email"
              placeholder="name@company.com"
              value={formData.email}
              onChange={(e) => setFormData({ ...formData, email: e.target.value })}
              className={inputClass}
              required
            />
          </Field>
          <Field htmlFor="user-org" label="Organisation Id" required>
            <input
              id="user-org"
              type="text"
              placeholder="Enter organisation ID"
              value={formData.organisationId}
              onChange={(e) => setFormData({ ...formData, organisationId: e.target.value })}
              className={`${inputClass} font-mono text-meta`}
              required
            />
          </Field>
          <Field htmlFor="user-role" label="Role" required>
            <select
              id="user-role"
              value={roles.find((r) => r.name === formData.role)?.roleId ?? ''}
              onChange={(e) => {
                const r = roles.find((role) => role.roleId === e.target.value);
                if (r) {
                  setFormData((prev) => ({ ...prev, role: r.name }));
                  setSelectedRoleId(r.roleId);
                }
              }}
              className={inputClass}
              required
            >
              <option value="">Select a role</option>
              {roles.map((r) => (
                <option key={r.roleId} value={r.roleId}>
                  {r.name}
                </option>
              ))}
            </select>
          </Field>
        </form>
      </Modal>

      <ConfirmDialog
        isOpen={Boolean(userToArchive)}
        title="Archive user"
        icon={<FiArchive />}
        body={
          <>
            Archive <span className="font-medium text-ink">{userToArchive?.fullName || userToArchive?.email}</span>? They can be
            restored from the Archived tab.
          </>
        }
        confirmLabel="Archive"
        busy={archiving}
        onCancel={() => setUserToArchive(null)}
        onConfirm={() => userToArchive && handleArchiveUser(userToArchive)}
      />

      <ConfirmDialog
        isOpen={Boolean(userToRestore)}
        destructive={false}
        title="Restore user"
        icon={<FiRefreshCw />}
        body={
          <>
            Restore <span className="font-medium text-ink">{userToRestore?.fullName || userToRestore?.email}</span>? They will
            appear in the Active tab.
          </>
        }
        confirmLabel="Restore"
        busy={restoring}
        onCancel={() => setUserToRestore(null)}
        onConfirm={() => userToRestore && handleRestoreUser(userToRestore)}
      />
    </div>
  );
};

export default Users;
