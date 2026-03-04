import { useState, useRef, useEffect, useCallback } from 'react';
import { Role, RoleCreate } from '../types';
import { FiPlus, FiEdit, FiTrash2, FiX, FiChevronDown } from 'react-icons/fi';
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
  const [permissionsDropdownOpen, setPermissionsDropdownOpen] = useState(false);
  const permissionsDropdownRef = useRef<HTMLDivElement>(null);
  const [roleToDelete, setRoleToDelete] = useState<Role | null>(null);
  const [deleting, setDeleting] = useState(false);

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

  useEffect(() => {
    if (!permissionsDropdownOpen) return;
    const handleClickOutside = (e: MouseEvent) => {
      if (permissionsDropdownRef.current && !permissionsDropdownRef.current.contains(e.target as Node)) {
        setPermissionsDropdownOpen(false);
      }
    };
    document.addEventListener('mousedown', handleClickOutside);
    return () => document.removeEventListener('mousedown', handleClickOutside);
  }, [permissionsDropdownOpen]);

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
    setPermissionsDropdownOpen(false);
  };

  const togglePermission = (permission: string) => {
    const current = roleForm.permissions ?? [];
    const next = current.includes(permission)
      ? current.filter((p) => p !== permission)
      : [...current, permission];
    setRoleForm({ ...roleForm, permissions: next });
  };

  const handleRoleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!organizationId) {
      toast.error('Organization context required');
      return;
    }
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

  return (
    <div className="p-8 bg-white font-sans">
      <h1 className="text-3xl font-semibold text-black font-sans tracking-tight">Roles & Permissions</h1>
      <p className="mt-1 text-sm text-black/60 font-sans mb-6">Manage roles and permissions</p>

      <div className="flex gap-6 border-b border-[#434E78]/20 mb-6">
        {(['roles', 'permissions'] as Tab[]).map((tab) => (
          <button
            key={tab}
            type="button"
            onClick={() => setActiveTab(tab)}
            className={`pb-3 font-medium text-sm font-sans transition-colors capitalize ${
              activeTab === tab
                ? 'text-[#434E78] border-b-2 border-[#434E78]'
                : 'text-black/60 hover:text-black/80'
            }`}
          >
            {tab}
          </button>
        ))}
      </div>

      {activeTab === 'roles' && (
        <>
          <div className="flex justify-between items-center mb-4">
            <h2 className="text-lg font-semibold text-black font-sans">Roles</h2>
            <button
              onClick={openAddRoleModal}
              disabled={!organizationId}
              className="bg-[#434E78] text-white px-4 py-2 rounded-azure-sm hover:bg-[#434E78]/90 font-medium text-sm shadow-azure-sm transition-colors font-sans flex items-center disabled:opacity-50 disabled:cursor-not-allowed"
            >
              <FiPlus className="mr-2" />
              Add Role
            </button>
          </div>

          {rolesLoading ? (
            <LoadingSpinner />
          ) : (
          <div className="bg-white rounded-azure-sm shadow-azure-sm overflow-hidden border border-[#434E78]/20">
            <table className="min-w-full divide-y divide-[#434E78]/20">
              <thead className="bg-[#434E78]/5">
                <tr>
                  <th className="px-6 py-3 text-left text-xs font-semibold text-black uppercase tracking-wider font-sans">
                    Role Name
                  </th>
                  <th className="px-6 py-3 text-left text-xs font-semibold text-black uppercase tracking-wider font-sans">
                    Description
                  </th>
                  <th className="px-6 py-3 text-right text-xs font-semibold text-black uppercase tracking-wider font-sans">
                    Actions
                  </th>
                </tr>
              </thead>
              <tbody className="bg-white divide-y divide-[#434E78]/20">
                {roles.length === 0 ? (
                  <tr>
                    <td colSpan={3} className="px-6 py-8 text-center text-black/60 font-sans">
                      No roles yet. Add a role to get started.
                    </td>
                  </tr>
                ) : (
                  roles.map((role) => (
                    <tr key={role.roleId} className="hover:bg-[#434E78]/5 transition-colors">
                      <td className="px-6 py-4 whitespace-nowrap font-semibold text-black font-sans">
                        {role.name}
                      </td>
                      <td className="px-6 py-4 text-black/70 font-sans">
                        {role.description || '—'}
                      </td>
                      <td className="px-6 py-4 whitespace-nowrap text-right text-sm font-medium">
                        <button
                          onClick={() => openEditRoleModal(role)}
                          className="text-green-600 hover:text-green-700 hover:bg-green-50 p-2 rounded-azure-sm mr-1 transition-colors inline-flex"
                          title="Edit"
                        >
                          <FiEdit className="text-base" />
                        </button>
                        <button
                          onClick={() => setRoleToDelete(role)}
                          className="text-red-600 hover:text-red-700 hover:bg-red-50 p-2 rounded-azure-sm transition-colors inline-flex"
                          title="Delete"
                        >
                          <FiTrash2 className="text-base" />
                        </button>
                      </td>
                    </tr>
                  ))
                )}
              </tbody>
            </table>
          </div>
          )}
        </>
      )}

      {activeTab === 'permissions' && (
        <>
          {permissionsLoading ? (
            <LoadingSpinner />
          ) : (() => {
            const byCategory = permissionsList.reduce<Record<string, PermissionRead[]>>((acc, p) => {
              const cat = p.category || 'Other';
              if (!acc[cat]) acc[cat] = [];
              acc[cat].push(p);
              return acc;
            }, {});
            const categories = Object.keys(byCategory).sort();
            if (categories.length === 0) {
              return (
                <div className="py-12 text-center text-black/60 font-sans">
                  No permissions found.
                </div>
              );
            }
            return (
              <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-4">
                {categories.map((category) => (
                  <div
                    key={category}
                    className="bg-white rounded-azure-sm shadow-azure-sm border border-[#434E78]/20 overflow-hidden"
                  >
                    <div className="px-4 py-3 bg-[#434E78]/5 border-b border-[#434E78]/20">
                      <h3 className="font-semibold text-black font-sans">{category}</h3>
                    </div>
                    <ul className="px-4 py-3 divide-y divide-[#434E78]/10">
                      {byCategory[category].map((p) => (
                        <li key={p.permissionId ?? p.code} className="py-2 text-sm font-sans">
                          <span className="font-medium text-black">{p.name}</span>
                          <span className="block text-black/50 text-xs font-mono">{p.code}</span>
                        </li>
                      ))}
                    </ul>
                  </div>
                ))}
              </div>
            );
          })()}
        </>
      )}

      {isRoleModalOpen && (
        <div className="fixed inset-0 bg-black/50 flex items-center justify-center z-50 backdrop-blur-sm">
          <div className="bg-white rounded-azure-sm shadow-azure-xl p-6 w-full max-w-md border border-[#434E78]/20 relative">
            <button
              type="button"
              onClick={closeRoleModal}
              className="absolute top-4 right-4 text-black/50 hover:text-black p-1 rounded-azure-sm"
            >
              <FiX className="text-xl" />
            </button>
            <h2 className="text-xl font-semibold mb-4 text-black font-sans">
              {editingRole ? 'Edit Role' : 'Add Role'}
            </h2>
            <form onSubmit={handleRoleSubmit}>
              <div className="mb-4">
                <label className="block text-black text-sm font-semibold mb-2 font-sans">
                  Role Name <span className="text-red-500">*</span>
                </label>
                <input
                  type="text"
                  placeholder="Enter role name"
                  value={roleForm.name}
                  onChange={(e) => setRoleForm({ ...roleForm, name: e.target.value })}
                  className="w-full px-3 py-2 border border-[#434E78]/30 rounded-azure-sm focus:outline-none focus:ring-2 focus:ring-[#434E78] focus:border-[#434E78] bg-white text-sm font-sans"
                  required
                />
              </div>
              <div className="mb-4">
                <label className="block text-black text-sm font-semibold mb-2 font-sans">
                  Description
                </label>
                <textarea
                  placeholder="Enter description (optional)"
                  value={roleForm.description}
                  onChange={(e) => setRoleForm({ ...roleForm, description: e.target.value })}
                  rows={3}
                  className="w-full px-3 py-2 border border-[#434E78]/30 rounded-azure-sm focus:outline-none focus:ring-2 focus:ring-[#434E78] focus:border-[#434E78] bg-white text-sm font-sans resize-none"
                />
              </div>
              <div className="mb-6 relative" ref={permissionsDropdownRef}>
                <label className="block text-black text-sm font-semibold mb-2 font-sans">
                  Permissions
                </label>
                <button
                  type="button"
                  onClick={() => setPermissionsDropdownOpen((o) => !o)}
                  className="w-full flex items-center justify-between px-3 py-2 border border-[#434E78]/30 rounded-azure-sm bg-white text-left text-sm font-sans focus:outline-none focus:ring-2 focus:ring-[#434E78] focus:border-[#434E78]"
                >
                  <span className={roleForm.permissions?.length ? 'text-black' : 'text-black/50'}>
                    {(roleForm.permissions?.length ?? 0) > 0
                      ? `${roleForm.permissions!.length} permission(s) selected`
                      : 'Select permissions'}
                  </span>
                  <FiChevronDown
                    className={`text-[#434E78] transition-transform ${permissionsDropdownOpen ? 'rotate-180' : ''}`}
                  />
                </button>
                {permissionsDropdownOpen && (
                  <div className="absolute z-10 mt-1 w-full max-h-48 overflow-auto border border-[#434E78]/30 rounded-azure-sm bg-white shadow-azure-sm py-1">
                    {permissionsLoading ? (
                      <div className="px-3 py-4 text-sm text-black/60 font-sans">Loading permissions...</div>
                    ) : permissionsList.length === 0 ? (
                      <div className="px-3 py-4 text-sm text-black/60 font-sans">No permissions available.</div>
                    ) : (
                      <>
                        <label
                          className="flex items-center gap-2 px-3 py-2 hover:bg-[#434E78]/5 cursor-pointer text-sm font-sans border-b border-[#434E78]/10"
                          onClick={() => {
                            const allCodes = permissionsList.map((p) => p.code);
                            const allSelected = (roleForm.permissions ?? []).length === allCodes.length;
                            setRoleForm({ ...roleForm, permissions: allSelected ? [] : allCodes });
                          }}
                        >
                          <input
                            type="checkbox"
                            checked={permissionsList.length > 0 && (roleForm.permissions ?? []).length === permissionsList.length}
                            onChange={() => {}}
                            className="rounded border-[#434E78]/30 text-[#434E78] focus:ring-[#434E78]"
                            readOnly
                          />
                          <span className="text-black font-medium">Select all</span>
                        </label>
                        {permissionsList
                        .sort((a, b) => (a.category || '').localeCompare(b.category || '') || a.name.localeCompare(b.name))
                        .map((p) => (
                          <label
                            key={p.permissionId ?? p.code}
                            className="flex items-center gap-2 px-3 py-2 hover:bg-[#434E78]/5 cursor-pointer text-sm font-sans"
                          >
                            <input
                              type="checkbox"
                              checked={(roleForm.permissions ?? []).includes(p.code)}
                              onChange={() => togglePermission(p.code)}
                              className="rounded border-[#434E78]/30 text-[#434E78] focus:ring-[#434E78]"
                            />
                            <span className="text-black">{p.name}</span>
                            <span className="text-black/50 text-xs font-mono">{p.code}</span>
                          </label>
                        ))}
                      </>
                    )}
                  </div>
                )}
              </div>
              <div className="flex justify-end gap-3">
                <button
                  type="button"
                  onClick={closeRoleModal}
                  className="px-4 py-2 border border-[#434E78]/30 rounded-azure-sm hover:bg-[#434E78]/5 text-black font-medium text-sm transition-colors font-sans"
                >
                  Cancel
                </button>
                <button
                  type="submit"
                  className="px-4 py-2 bg-[#434E78] text-white rounded-azure-sm hover:bg-[#434E78]/90 font-medium text-sm shadow-azure-sm transition-colors font-sans"
                >
                  {editingRole ? 'Update Role' : 'Add Role'}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

      {roleToDelete && (
        <div className="fixed inset-0 bg-black/50 flex items-center justify-center z-50 backdrop-blur-sm">
          <div className="bg-white rounded-azure-sm shadow-azure-xl p-6 w-full max-w-md border border-[#434E78]/20">
            <h2 className="text-xl font-semibold mb-2 text-black font-sans">Delete role</h2>
            <p className="text-black/70 text-sm font-sans mb-6">
              Are you sure you want to delete {roleToDelete.name}?
            </p>
            <div className="flex justify-end gap-3">
              <button
                type="button"
                onClick={() => setRoleToDelete(null)}
                disabled={deleting}
                className="px-4 py-2 border border-[#434E78]/30 rounded-azure-sm hover:bg-[#434E78]/5 text-black font-medium text-sm transition-colors font-sans disabled:opacity-60"
              >
                Cancel
              </button>
              <button
                type="button"
                onClick={() => handleDeleteRole(roleToDelete)}
                disabled={deleting}
                className="px-4 py-2 bg-red-600 text-white rounded-azure-sm hover:bg-red-700 font-medium text-sm shadow-azure-sm transition-colors font-sans disabled:opacity-60"
              >
                {deleting ? 'Deleting…' : 'Delete'}
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
};

export default RolesPermissions;
