import Button, { IconButton } from '../components/Button';
import Tabs from '../components/Tabs';
import PageHeader from '../components/PageHeader';
import Modal from '../components/Modal';
import Field from '../components/Field';
import ConfirmDialog from '../components/ConfirmDialog';
import DataTable from '../components/DataTable';
import EmptyState from '../components/EmptyState';
import Badge from '../components/Badge';
import { inputClass } from '../utils/formStyles';
import { useState, useEffect, useCallback, useMemo } from 'react';
import { Role, RoleCreate } from '../types';
import { FiEdit2, FiKey, FiLock, FiPlus, FiShield, FiTrash2 } from 'react-icons/fi';
import { toast } from 'react-toastify';
import { permissionService, PermissionRead } from '../services/permissionService';
import { roleService } from '../services/roleService';
import { useAuth } from '../contexts/AuthContext';
import LoadingSpinner from '../components/LoadingSpinner';

type Tab = 'roles' | 'permissions';

const RolesPermissions = () => {
  const { organizationId } = useAuth();
  const [activeTab, setActiveTab] = useState<Tab>('roles');
  const [roles, setRoles] = useState<Role[]>([]);
  const [rolesLoading, setRolesLoading] = useState(false);
  const [permissionsList, setPermissionsList] = useState<PermissionRead[]>([]);
  const [permissionsLoading, setPermissionsLoading] = useState(false);
  const [isRoleModalOpen, setIsRoleModalOpen] = useState(false);
  const [editingRole, setEditingRole] = useState<Role | null>(null);
  const [roleForm, setRoleForm] = useState<RoleCreate>({ name: '', description: '', permissions: [] });
  const [roleToDelete, setRoleToDelete] = useState<Role | null>(null);
  const [deleting, setDeleting] = useState(false);
  const [saving, setSaving] = useState(false);

  const loadPermissions = useCallback(async () => {
    setPermissionsLoading(true);
    try {
      const list = await permissionService.getAll();
      setPermissionsList(list);
    } catch {
      toast.error('Failed to load permissions');
      setPermissionsList([]);
    } finally {
      setPermissionsLoading(false);
    }
  }, []);

  const loadRoles = useCallback(async () => {
    if (!organizationId) return;
    setRolesLoading(true);
    try {
      const list = await roleService.getByOrganization(organizationId);
      setRoles(list);
    } catch {
      toast.error('Failed to load roles');
      setRoles([]);
    } finally {
      setRolesLoading(false);
    }
  }, [organizationId]);

  useEffect(() => {
    loadPermissions();
  }, [loadPermissions]);

  useEffect(() => {
    loadRoles();
  }, [loadRoles]);

  const byCategory = useMemo(() => {
    const grouped = permissionsList.reduce<Record<string, PermissionRead[]>>((acc, p) => {
      const cat = p.category || 'Other';
      if (!acc[cat]) acc[cat] = [];
      acc[cat].push(p);
      return acc;
    }, {});
    Object.values(grouped).forEach((list) => list.sort((a, b) => a.name.localeCompare(b.name)));
    return grouped;
  }, [permissionsList]);
  const categories = Object.keys(byCategory).sort();

  const openAddRoleModal = () => {
    setEditingRole(null);
    setRoleForm({ name: '', description: '', permissions: [] });
    setIsRoleModalOpen(true);
  };

  const openEditRoleModal = (role: Role) => {
    setEditingRole(role);
    setRoleForm({
      name: role.name,
      description: role.description || '',
      permissions: role.permissions ?? [],
    });
    setIsRoleModalOpen(true);
  };

  const closeRoleModal = () => {
    setIsRoleModalOpen(false);
    setEditingRole(null);
    setRoleForm({ name: '', description: '', permissions: [] });
  };

  const togglePermission = (permission: string) => {
    const current = roleForm.permissions ?? [];
    const next = current.includes(permission) ? current.filter((p) => p !== permission) : [...current, permission];
    setRoleForm({ ...roleForm, permissions: next });
  };

  const toggleCategory = (category: string) => {
    const codes = byCategory[category].map((p) => p.code);
    const current = roleForm.permissions ?? [];
    const allOn = codes.every((c) => current.includes(c));
    setRoleForm({
      ...roleForm,
      permissions: allOn ? current.filter((c) => !codes.includes(c)) : Array.from(new Set([...current, ...codes])),
    });
  };

  const handleRoleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!organizationId) {
      toast.error('Organization context required');
      return;
    }
    setSaving(true);
    try {
      if (editingRole) {
        await roleService.update(editingRole.roleId, {
          name: roleForm.name,
          description: roleForm.description || undefined,
          permissions: roleForm.permissions,
        });
        toast.success('Role updated successfully');
      } else {
        await roleService.create(organizationId, {
          name: roleForm.name,
          description: roleForm.description || undefined,
          permissions: roleForm.permissions,
        });
        toast.success('Role added successfully');
      }
      closeRoleModal();
      loadRoles();
    } catch {
      toast.error(editingRole ? 'Failed to update role' : 'Failed to add role');
    } finally {
      setSaving(false);
    }
  };

  const handleDeleteRole = async (role: Role) => {
    setDeleting(true);
    try {
      await roleService.delete(role.roleId);
      toast.success('Role deleted');
      setRoleToDelete(null);
      loadRoles();
    } catch {
      toast.error('Failed to delete role');
    } finally {
      setDeleting(false);
    }
  };

  const areasFor = (role: Role) => {
    const codes = role.permissions ?? [];
    return categories.filter((c) => byCategory[c].some((p) => codes.includes(p.code)));
  };

  const selected = roleForm.permissions ?? [];

  return (
    <div>
      <PageHeader
        title="Roles & Permissions"
        subtitle="Roles are defined here and assigned to users in Product Hub. Both sides apply."
        actions={
          activeTab === 'roles' ? (
            <Button variant="primary" icon={<FiPlus />} disabled={!organizationId} onClick={openAddRoleModal}>
              Add Role
            </Button>
          ) : null
        }
      />

      <div className="mb-5">
        <Tabs
          label="Roles and permissions"
          activeId={activeTab}
          onChange={(id) => setActiveTab(id as Tab)}
          tabs={[
            { id: 'roles', label: 'Roles', icon: <FiShield />, count: roles.length },
            { id: 'permissions', label: 'Permissions', icon: <FiKey />, count: permissionsList.length },
          ]}
        />
      </div>

      {activeTab === 'roles' && (
        <DataTable<Role>
          caption="Roles"
          rows={roles}
          rowKey={(r) => r.roleId}
          loading={rolesLoading}
          onRowClick={openEditRoleModal}
          empty={
            <EmptyState
              icon={<FiShield />}
              title="No roles yet"
              body="Add a role to get started, then assign it to users in Product Hub."
              action={
                <Button variant="primary" icon={<FiPlus />} disabled={!organizationId} onClick={openAddRoleModal}>
                  Add Role
                </Button>
              }
            />
          }
          columns={[
            {
              key: 'name',
              header: 'Role',
              sortValue: (r) => r.name.toLowerCase(),
              render: (r) => (
                <div className="flex items-center gap-3 min-w-0">
                  <span aria-hidden="true" className="h-9 w-9 shrink-0 rounded-control bg-primary-subtle text-primary ring-1 ring-inset ring-primary-border flex items-center justify-center">
                    <FiShield />
                  </span>
                  <div className="min-w-0">
                    <p className="font-semibold text-ink truncate">{r.name}</p>
                    <p className="text-meta text-ink-subtle truncate max-w-sm">{r.description || 'No description'}</p>
                  </div>
                </div>
              ),
            },
            {
              key: 'access',
              header: 'Access',
              hideOnMobile: true,
              render: (r) => {
                const areas = areasFor(r);
                return areas.length === 0 ? (
                  <span className="text-meta text-ink-subtle">No permissions</span>
                ) : (
                  <div className="flex flex-wrap gap-1 max-w-md">
                    {areas.slice(0, 4).map((a) => (
                      <Badge key={a}>{a}</Badge>
                    ))}
                    {areas.length > 4 && <Badge>+{areas.length - 4}</Badge>}
                  </div>
                );
              },
            },
            {
              key: 'count',
              header: 'Permissions',
              align: 'right',
              sortValue: (r) => r.permissions?.length ?? 0,
              render: (r) => (
                <span className="font-mono text-meta text-ink-muted tabular">
                  {r.permissions?.length ?? 0}
                  {permissionsList.length > 0 ? ` / ${permissionsList.length}` : ''}
                </span>
              ),
            },
            {
              key: 'actions',
              header: 'Actions',
              align: 'right',
              width: '100px',
              render: (r) => (
                <div className="flex justify-end gap-1" onClick={(e) => e.stopPropagation()}>
                  <IconButton size="sm" label={`Edit ${r.name}`} icon={<FiEdit2 />} onClick={() => openEditRoleModal(r)} />
                  <IconButton size="sm" tone="danger" label={`Delete ${r.name}`} icon={<FiTrash2 />} onClick={() => setRoleToDelete(r)} />
                </div>
              ),
            },
          ]}
        />
      )}

      {activeTab === 'permissions' &&
        (permissionsLoading ? (
          <LoadingSpinner label="Loading permissions" />
        ) : categories.length === 0 ? (
          <div className="card">
            <EmptyState icon={<FiKey />} title="No permissions found" />
          </div>
        ) : (
          <div className="grid grid-cols-1 md:grid-cols-2 xl:grid-cols-3 gap-4">
            {categories.map((category) => (
              <section key={category} className="card overflow-hidden" aria-labelledby={`perm-${category}`}>
                <header className="flex items-center justify-between px-4 py-3 border-b border-line-subtle bg-surface-muted">
                  <h2 id={`perm-${category}`} className="text-body font-semibold text-ink">{category}</h2>
                  <span className="text-meta text-ink-subtle tabular">{byCategory[category].length}</span>
                </header>
                <ul className="divide-y divide-line-subtle">
                  {byCategory[category].map((p) => (
                    <li key={p.permissionId ?? p.code} className="flex items-center gap-3 px-4 py-2.5">
                      <FiLock aria-hidden="true" className="shrink-0 text-ink-subtle" />
                      <div className="min-w-0">
                        <p className="text-body font-medium text-ink">{p.name}</p>
                        <p className="text-[11px] text-ink-subtle font-mono">{p.code}</p>
                      </div>
                    </li>
                  ))}
                </ul>
              </section>
            ))}
          </div>
        ))}

      <Modal
        isOpen={isRoleModalOpen}
        title={editingRole ? 'Edit Role' : 'Add Role'}
        icon={<FiShield />}
        size="lg"
        onClose={closeRoleModal}
        footer={
          <>
            <Button variant="secondary" onClick={closeRoleModal} disabled={saving}>
              Cancel
            </Button>
            <Button variant="primary" type="submit" form="role-form" loading={saving}>
              {editingRole ? 'Update Role' : 'Add Role'}
            </Button>
          </>
        }
      >
        <form id="role-form" onSubmit={handleRoleSubmit} className="space-y-5">
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
            <Field htmlFor="role-name" label="Role Name" required>
              <input
                id="role-name"
                type="text"
                placeholder="e.g. Estimator"
                value={roleForm.name}
                onChange={(e) => setRoleForm({ ...roleForm, name: e.target.value })}
                className={inputClass}
                required
              />
            </Field>
            <Field htmlFor="role-description" label="Description" hint="Optional">
              <input
                id="role-description"
                placeholder="What this role is for"
                value={roleForm.description}
                onChange={(e) => setRoleForm({ ...roleForm, description: e.target.value })}
                className={inputClass}
              />
            </Field>
          </div>

          <div>
            <div className="flex items-center justify-between mb-2">
              <p className="text-body font-medium text-ink">Permissions</p>
              <div className="flex items-center gap-3 text-meta">
                <span className="text-ink-subtle tabular">{selected.length} of {permissionsList.length} selected</span>
                <button
                  type="button"
                  className="font-medium text-primary hover:underline underline-offset-2 cursor-pointer"
                  onClick={() => {
                    const allCodes = permissionsList.map((p) => p.code);
                    const allSelected = selected.length === allCodes.length;
                    setRoleForm({ ...roleForm, permissions: allSelected ? [] : allCodes });
                  }}
                >
                  {permissionsList.length > 0 && selected.length === permissionsList.length ? 'Clear all' : 'Select all'}
                </button>
              </div>
            </div>
            {permissionsLoading ? (
              <p className="text-body text-ink-subtle">Loading permissions…</p>
            ) : categories.length === 0 ? (
              <p className="text-body text-ink-subtle">No permissions available.</p>
            ) : (
              <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                {categories.map((category) => {
                  const codes = byCategory[category].map((p) => p.code);
                  const on = codes.filter((c) => selected.includes(c)).length;
                  return (
                    <fieldset key={category} className="rounded-card border border-line overflow-hidden">
                      <legend className="sr-only">{category}</legend>
                      <label className="flex items-center gap-2.5 px-3 py-2 bg-surface-muted border-b border-line-subtle cursor-pointer">
                        <input
                          type="checkbox"
                          checked={on === codes.length}
                          ref={(el) => {
                            if (el) el.indeterminate = on > 0 && on < codes.length;
                          }}
                          onChange={() => toggleCategory(category)}
                          className="h-4 w-4 rounded"
                        />
                        <span className="text-body font-semibold text-ink flex-1">{category}</span>
                        <span className="text-meta text-ink-subtle tabular">{on}/{codes.length}</span>
                      </label>
                      <div className="py-1">
                        {byCategory[category].map((p) => (
                          <label key={p.permissionId ?? p.code} className="flex items-start gap-2.5 px-3 py-1.5 hover:bg-surface-muted cursor-pointer">
                            <input
                              type="checkbox"
                              checked={selected.includes(p.code)}
                              onChange={() => togglePermission(p.code)}
                              className="mt-0.5 h-4 w-4 rounded"
                            />
                            <span className="min-w-0">
                              <span className="block text-body text-ink">{p.name}</span>
                              <span className="block text-[11px] text-ink-subtle font-mono">{p.code}</span>
                            </span>
                          </label>
                        ))}
                      </div>
                    </fieldset>
                  );
                })}
              </div>
            )}
          </div>
        </form>
      </Modal>

      <ConfirmDialog
        isOpen={Boolean(roleToDelete)}
        title="Delete role"
        body={
          <>
            Delete <span className="font-medium text-ink">{roleToDelete?.name}</span> and its{' '}
            {roleToDelete?.permissions?.length ?? 0} permissions?
          </>
        }
        confirmLabel="Delete role"
        busy={deleting}
        onCancel={() => setRoleToDelete(null)}
        onConfirm={() => roleToDelete && handleDeleteRole(roleToDelete)}
      />
    </div>
  );
};

export default RolesPermissions;
