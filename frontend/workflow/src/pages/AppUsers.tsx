import { useState, useEffect, useCallback } from 'react';
import { FiPlus, FiEdit, FiTrash2 } from 'react-icons/fi';
import { toast } from 'react-toastify';
import { appUserService, AppUser, AppUserCreate } from '../services/appUserService';
import { roleService } from '../services/roleService';
import { Role } from '../types';
import LoadingSpinner from '../components/LoadingSpinner';

const AppUsers = () => {
  const [users, setUsers] = useState<AppUser[]>([]);
  const [roles, setRoles] = useState<Role[]>([]);
  const [loading, setLoading] = useState(true);
  const [isModalOpen, setIsModalOpen] = useState(false);
  const [editing, setEditing] = useState<AppUser | null>(null);
  const [form, setForm] = useState({ email: '', fullName: '', password: '', roleId: '', isActive: true });
  const [userToDelete, setUserToDelete] = useState<AppUser | null>(null);

  const load = useCallback(async () => {
    setLoading(true);
    try {
      const [u, r] = await Promise.all([appUserService.getAll(), roleService.getAll()]);
      setUsers(u);
      setRoles(r);
    } catch {
      toast.error('Failed to load app users');
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => { load(); }, [load]);

  const openCreate = () => {
    setEditing(null);
    setForm({ email: '', fullName: '', password: '', roleId: roles[0]?.roleId ?? '', isActive: true });
    setIsModalOpen(true);
  };

  const openEdit = (u: AppUser) => {
    setEditing(u);
    setForm({ email: u.email, fullName: u.fullName, password: '', roleId: u.roleId, isActive: u.isActive });
    setIsModalOpen(true);
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    try {
      if (editing) {
        await appUserService.update(editing.userId, {
          email: form.email,
          fullName: form.fullName,
          roleId: form.roleId,
          isActive: form.isActive,
          ...(form.password ? { password: form.password } : {}),
        });
        toast.success('User updated');
      } else {
        const payload: AppUserCreate = {
          email: form.email,
          fullName: form.fullName,
          password: form.password,
          roleId: form.roleId,
          isActive: form.isActive,
        };
        await appUserService.create(payload);
        toast.success('User created');
      }
      setIsModalOpen(false);
      load();
    } catch (err: unknown) {
      const msg = (err as { response?: { data?: { error?: string } } })?.response?.data?.error || 'Save failed';
      toast.error(msg);
    }
  };

  const handleDelete = async () => {
    if (!userToDelete) return;
    try {
      await appUserService.delete(userToDelete.userId);
      toast.success('User deleted');
      setUserToDelete(null);
      load();
    } catch {
      toast.error('Delete failed');
    }
  };

  if (loading) return <LoadingSpinner />;

  return (
    <div className="p-8 bg-white font-sans">
      <div className="flex justify-between items-center mb-6 pb-4 border-b border-[#434E78]/20">
        <h1 className="text-3xl font-semibold text-black">App Users</h1>
        <button onClick={openCreate} className="bg-[#434E78] text-white px-4 py-2 rounded-azure-sm flex items-center text-sm">
          <FiPlus className="mr-2" /> Add user
        </button>
      </div>

      <table className="min-w-full border border-[#434E78]/20 rounded-azure-sm overflow-hidden">
        <thead className="bg-[#434E78]/5">
          <tr>
            <th className="px-4 py-2 text-left text-xs uppercase">Name</th>
            <th className="px-4 py-2 text-left text-xs uppercase">Email</th>
            <th className="px-4 py-2 text-left text-xs uppercase">Role</th>
            <th className="px-4 py-2 text-left text-xs uppercase">Active</th>
            <th className="px-4 py-2 text-right text-xs uppercase">Actions</th>
          </tr>
        </thead>
        <tbody>
          {users.map((u) => (
            <tr key={u.userId} className="border-t border-[#434E78]/10">
              <td className="px-4 py-3">{u.fullName}</td>
              <td className="px-4 py-3">{u.email}</td>
              <td className="px-4 py-3">{u.roleName}</td>
              <td className="px-4 py-3">{u.isActive ? 'Yes' : 'No'}</td>
              <td className="px-4 py-3 text-right">
                <button onClick={() => openEdit(u)} className="p-2 text-[#434E78]"><FiEdit /></button>
                <button onClick={() => setUserToDelete(u)} className="p-2 text-red-600"><FiTrash2 /></button>
              </td>
            </tr>
          ))}
        </tbody>
      </table>

      {isModalOpen && (
        <div className="fixed inset-0 bg-black/50 flex items-center justify-center z-50">
          <div className="bg-white p-6 rounded-azure-sm w-full max-w-md">
            <h2 className="text-lg font-semibold mb-4">{editing ? 'Edit user' : 'New user'}</h2>
            <form onSubmit={handleSubmit} className="space-y-3">
              <input className="w-full border px-3 py-2 rounded text-sm" placeholder="Full name" value={form.fullName} onChange={(e) => setForm({ ...form, fullName: e.target.value })} required />
              <input type="email" className="w-full border px-3 py-2 rounded text-sm" placeholder="Email" value={form.email} onChange={(e) => setForm({ ...form, email: e.target.value })} required />
              <input type="password" className="w-full border px-3 py-2 rounded text-sm" placeholder={editing ? 'New password (optional)' : 'Password'} value={form.password} onChange={(e) => setForm({ ...form, password: e.target.value })} required={!editing} minLength={6} />
              <select className="w-full border px-3 py-2 rounded text-sm" value={form.roleId} onChange={(e) => setForm({ ...form, roleId: e.target.value })} required>
                <option value="">Select role</option>
                {roles.map((r) => <option key={r.roleId} value={r.roleId}>{r.name}</option>)}
              </select>
              <label className="flex items-center gap-2 text-sm">
                <input type="checkbox" checked={form.isActive} onChange={(e) => setForm({ ...form, isActive: e.target.checked })} />
                Active
              </label>
              <div className="flex justify-end gap-2 pt-2">
                <button type="button" onClick={() => setIsModalOpen(false)} className="px-4 py-2 border rounded text-sm">Cancel</button>
                <button type="submit" className="px-4 py-2 bg-[#434E78] text-white rounded text-sm">Save</button>
              </div>
            </form>
          </div>
        </div>
      )}

      {userToDelete && (
        <div className="fixed inset-0 bg-black/50 flex items-center justify-center z-50">
          <div className="bg-white p-6 rounded max-w-sm">
            <p className="mb-4">Delete {userToDelete.email}?</p>
            <div className="flex justify-end gap-2">
              <button onClick={() => setUserToDelete(null)} className="px-4 py-2 border rounded">Cancel</button>
              <button onClick={handleDelete} className="px-4 py-2 bg-red-600 text-white rounded">Delete</button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
};

export default AppUsers;
