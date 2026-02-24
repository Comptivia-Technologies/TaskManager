import { useState, useEffect, useCallback } from 'react';
import { User, UserCreate, UserStatus } from '../types';
import { FiPlus, FiEdit, FiTrash2, FiGrid, FiX } from 'react-icons/fi';
import { toast } from 'react-toastify';
import { useAuth } from '../contexts/AuthContext';
import { userService } from '../services/userService';
import LoadingSpinner from '../components/LoadingSpinner';

const ROLES = ['Admin', 'User', 'Folder Manager', 'Content Creator', 'Workspace Manager'];

const formatDate = (iso: string) => {
  const d = new Date(iso);
  return `${String(d.getDate()).padStart(2, '0')}/${String(d.getMonth() + 1).padStart(2, '0')}/${d.getFullYear()}`;
};

const Users = () => {
  const { organizationId } = useAuth();
  const [activeUsers, setActiveUsers] = useState<User[]>([]);
  const [pendingUsers, setPendingUsers] = useState<User[]>([]);
  const [loading, setLoading] = useState(true);
  const [statusFilter, setStatusFilter] = useState<UserStatus>('Active');
  const [isModalOpen, setIsModalOpen] = useState(false);
  const [editingUser, setEditingUser] = useState<User | null>(null);
  const [formData, setFormData] = useState<UserCreate>({
    fullName: '',
    email: '',
    organisationId: '',
    role: '',
  });

  const loadUsers = useCallback(async () => {
    if (!organizationId || !process.env.REACT_APP_AUTH_API_URL) {
      setLoading(false);
      setActiveUsers([]);
      setPendingUsers([]);
      return;
    }
    setLoading(true);
    try {
      const [active, pending] = await Promise.all([
        userService.getByOrganization(organizationId, 'Active'),
        userService.getPendingInvitations(organizationId),
      ]);
      setActiveUsers(active);
      setPendingUsers(pending);
    } catch (err: unknown) {
      toast.error('Failed to load users');
      setActiveUsers([]);
      setPendingUsers([]);
    } finally {
      setLoading(false);
    }
  }, [organizationId]);

  useEffect(() => {
    loadUsers();
  }, [loadUsers]);

  const filteredUsers =
    statusFilter === 'Active' ? activeUsers : statusFilter === 'Pending' ? pendingUsers : [];
  const activeCount = activeUsers.length;
  const pendingCount = pendingUsers.length;
  const archivedCount = 0;

  const openAddModal = () => {
    setEditingUser(null);
    setFormData({ fullName: '', email: '', organisationId: organizationId || '', role: '' });
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
    setIsModalOpen(true);
  };

  const closeModal = () => {
    setIsModalOpen(false);
    setEditingUser(null);
    setFormData({ fullName: '', email: '', organisationId: organizationId || '', role: '' });
  };

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    const updated = { ...formData, updatedAt: new Date().toISOString().slice(0, 10) };
    if (editingUser) {
      if (editingUser.status === 'Active') {
        setActiveUsers((prev) =>
          prev.map((u) => (u.userId === editingUser.userId ? { ...u, ...updated } : u))
        );
      } else {
        setPendingUsers((prev) =>
          prev.map((u) => (u.userId === editingUser.userId ? { ...u, ...updated } : u))
        );
      }
      toast.success('User updated successfully');
    } else {
      const newUser: User = {
        userId: String(Date.now()),
        ...formData,
        status: 'Active',
        createdAt: new Date().toISOString().slice(0, 10),
        updatedAt: new Date().toISOString().slice(0, 10),
      };
      setActiveUsers((prev) => [...prev, newUser]);
      toast.success('User added successfully');
    }
    closeModal();
  };

  const handleDelete = (user: User) => {
    if (!window.confirm('Are you sure you want to delete this user?')) return;
    if (user.status === 'Active') {
      setActiveUsers((prev) => prev.filter((u) => u.userId !== user.userId));
    } else {
      setPendingUsers((prev) => prev.filter((u) => u.userId !== user.userId));
    }
    toast.success('User deleted');
  };

  const handleArchive = (user: User) => {
    setActiveUsers((prev) => prev.filter((u) => u.userId !== user.userId));
    toast.success('User archived');
  };

  if (loading) {
    return <LoadingSpinner />;
  }

  return (
    <div className="p-8 bg-white font-sans">
      <div className="flex justify-between items-start mb-4">
        <div>
          <h1 className="text-3xl font-semibold text-black font-sans tracking-tight">Users</h1>
          <p className="mt-1 text-sm text-black/60 font-sans">Manage users from Product Hub</p>
        </div>
        <button
          onClick={openAddModal}
          className="bg-[#434E78] text-white px-4 py-2 rounded-azure-sm hover:bg-[#434E78]/90 font-medium text-sm shadow-azure-sm transition-colors font-sans flex items-center"
        >
          <FiPlus className="mr-2" />
          Add User
        </button>
      </div>

      <div className="flex gap-6 border-b border-[#434E78]/20 mb-6">
        {(['Active', 'Pending', 'Archived'] as UserStatus[]).map((status) => {
          const count = status === 'Active' ? activeCount : status === 'Pending' ? pendingCount : archivedCount;
          const isSelected = statusFilter === status;
          return (
            <button
              key={status}
              type="button"
              onClick={() => setStatusFilter(status)}
              className={`pb-3 font-medium text-sm font-sans transition-colors flex items-center gap-2 ${
                isSelected ? 'text-[#434E78] border-b-2 border-[#434E78]' : 'text-black/60 hover:text-black/80'
              }`}
            >
              {status}
              <span
                className={`inline-flex items-center justify-center min-w-[1.25rem] h-5 px-1.5 rounded-full text-xs font-semibold ${
                  isSelected ? 'bg-[#434E78]/15 text-[#434E78]' : 'bg-black/10 text-black/60'
                }`}
              >
                {count}
              </span>
            </button>
          );
        })}
      </div>

      <div className="bg-white rounded-azure-sm shadow-azure-sm overflow-hidden border border-[#434E78]/20">
        <table className="min-w-full divide-y divide-[#434E78]/20">
          <thead className="bg-[#434E78]/5">
            <tr>
              <th className="px-6 py-3 text-left text-xs font-semibold text-black uppercase tracking-wider font-sans">
                Full Name
              </th>
              <th className="px-6 py-3 text-left text-xs font-semibold text-black uppercase tracking-wider font-sans">
                Email
              </th>
              <th className="px-6 py-3 text-left text-xs font-semibold text-black uppercase tracking-wider font-sans">
                Role
              </th>
              <th className="px-6 py-3 text-left text-xs font-semibold text-black uppercase tracking-wider font-sans">
                Status
              </th>
              <th className="px-6 py-3 text-left text-xs font-semibold text-black uppercase tracking-wider font-sans">
                Created
              </th>
              <th className="px-6 py-3 text-left text-xs font-semibold text-black uppercase tracking-wider font-sans">
                Updated
              </th>
              <th className="px-6 py-3 text-right text-xs font-semibold text-black uppercase tracking-wider font-sans">
                Actions
              </th>
            </tr>
          </thead>
          <tbody className="bg-white divide-y divide-[#434E78]/20">
            {filteredUsers.length === 0 ? (
              <tr>
                <td colSpan={7} className="px-6 py-8 text-center text-black/60 font-sans">
                  No users found
                </td>
              </tr>
            ) : (
              filteredUsers.map((user) => (
                <tr key={user.userId} className="hover:bg-[#434E78]/5 transition-colors">
                  <td className="px-6 py-4 whitespace-nowrap font-semibold text-black font-sans">
                    {user.fullName}
                  </td>
                  <td className="px-6 py-4 whitespace-nowrap text-black/70 font-sans">
                    {user.email}
                  </td>
                  <td className="px-6 py-4 whitespace-nowrap text-black/70 font-sans">
                    {user.role}
                  </td>
                  <td className="px-6 py-4 whitespace-nowrap">
                    <span
                      className={`inline-flex px-2.5 py-0.5 rounded-full text-xs font-medium ${
                        user.status === 'Active'
                          ? 'bg-green-100 text-green-800'
                          : user.status === 'Pending'
                          ? 'bg-amber-100 text-amber-800'
                          : 'bg-black/10 text-black/70'
                      }`}
                    >
                      {user.status}
                    </span>
                  </td>
                  <td className="px-6 py-4 whitespace-nowrap text-black/70 font-sans text-sm">
                    {formatDate(user.createdAt)}
                  </td>
                  <td className="px-6 py-4 whitespace-nowrap text-black/70 font-sans text-sm">
                    {formatDate(user.updatedAt)}
                  </td>
                  <td className="px-6 py-4 whitespace-nowrap text-right text-sm font-medium">
                    <button
                      onClick={() => openEditModal(user)}
                      className="text-green-600 hover:text-green-700 hover:bg-green-50 p-2 rounded-azure-sm mr-1 transition-colors inline-flex"
                      title="Edit"
                    >
                      <FiEdit className="text-base" />
                    </button>
                    <button
                      onClick={() => handleDelete(user)}
                      className="text-red-600 hover:text-red-700 hover:bg-red-50 p-2 rounded-azure-sm mr-1 transition-colors inline-flex"
                      title="Delete"
                    >
                      <FiTrash2 className="text-base" />
                    </button>
                    <button
                      onClick={() => handleArchive(user)}
                      className="text-[#434E78] hover:bg-[#434E78]/10 p-2 rounded-azure-sm transition-colors inline-flex"
                      title="More options"
                    >
                      <FiGrid className="text-base" />
                    </button>
                  </td>
                </tr>
              ))
            )}
          </tbody>
        </table>
      </div>

      {isModalOpen && (
        <div className="fixed inset-0 bg-black/50 flex items-center justify-center z-50 backdrop-blur-sm">
          <div className="bg-white rounded-azure-sm shadow-azure-xl p-6 w-full max-w-md border border-[#434E78]/20 relative">
            <button
              type="button"
              onClick={closeModal}
              className="absolute top-4 right-4 text-black/50 hover:text-black p-1 rounded-azure-sm"
            >
              <FiX className="text-xl" />
            </button>
            <h2 className="text-xl font-semibold mb-4 text-black font-sans">
              {editingUser ? 'Edit User' : 'Add User'}
            </h2>
            <form onSubmit={handleSubmit}>
              <div className="mb-4">
                <label className="block text-black text-sm font-semibold mb-2 font-sans">
                  Full Name <span className="text-red-500">*</span>
                </label>
                <input
                  type="text"
                  placeholder="Enter full name"
                  value={formData.fullName}
                  onChange={(e) => setFormData({ ...formData, fullName: e.target.value })}
                  className="w-full px-3 py-2 border border-[#434E78]/30 rounded-azure-sm focus:outline-none focus:ring-2 focus:ring-[#434E78] focus:border-[#434E78] bg-white text-sm font-sans"
                  required
                />
              </div>
              <div className="mb-4">
                <label className="block text-black text-sm font-semibold mb-2 font-sans">
                  Email <span className="text-red-500">*</span>
                </label>
                <input
                  type="email"
                  placeholder="Enter email address"
                  value={formData.email}
                  onChange={(e) => setFormData({ ...formData, email: e.target.value })}
                  className="w-full px-3 py-2 border border-[#434E78]/30 rounded-azure-sm focus:outline-none focus:ring-2 focus:ring-[#434E78] focus:border-[#434E78] bg-white text-sm font-sans"
                  required
                />
              </div>
              <div className="mb-4">
                <label className="block text-black text-sm font-semibold mb-2 font-sans">
                  Organisation Id <span className="text-red-500">*</span>
                </label>
                <input
                  type="text"
                  placeholder="Enter organisation ID"
                  value={formData.organisationId}
                  onChange={(e) => setFormData({ ...formData, organisationId: e.target.value })}
                  className="w-full px-3 py-2 border border-[#434E78]/30 rounded-azure-sm focus:outline-none focus:ring-2 focus:ring-[#434E78] focus:border-[#434E78] bg-white text-sm font-sans"
                  required
                />
              </div>
              <div className="mb-6">
                <label className="block text-black text-sm font-semibold mb-2 font-sans">
                  Role <span className="text-red-500">*</span>
                </label>
                <select
                  value={formData.role}
                  onChange={(e) => setFormData({ ...formData, role: e.target.value })}
                  className="w-full px-3 py-2 border border-[#434E78]/30 rounded-azure-sm focus:outline-none focus:ring-2 focus:ring-[#434E78] focus:border-[#434E78] bg-white text-sm font-sans appearance-none cursor-pointer"
                  required
                >
                  <option value="">Select a role</option>
                  {ROLES.map((r) => (
                    <option key={r} value={r}>
                      {r}
                    </option>
                  ))}
                </select>
              </div>
              <div className="flex justify-end gap-3">
                <button
                  type="button"
                  onClick={closeModal}
                  className="px-4 py-2 border border-[#434E78]/30 rounded-azure-sm hover:bg-[#434E78]/5 text-black font-medium text-sm transition-colors font-sans"
                >
                  Cancel
                </button>
                <button
                  type="submit"
                  className="px-4 py-2 bg-[#434E78] text-white rounded-azure-sm hover:bg-[#434E78]/90 font-medium text-sm shadow-azure-sm transition-colors font-sans"
                >
                  {editingUser ? 'Update User' : 'Add User'}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}
    </div>
  );
};

export default Users;
