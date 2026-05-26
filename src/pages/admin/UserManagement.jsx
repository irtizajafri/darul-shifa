import { useEffect, useState } from 'react';
import { Edit2, Trash2, ToggleLeft, ToggleRight, ShieldCheck, AlertTriangle } from 'lucide-react';
import toast from 'react-hot-toast';
import { useUserManagementStore } from '../../store/useUserManagementStore';
import { PERMISSIONS_MAP, normalizePermissions } from '../../utils/permissions';
import PageHeader from '../../components/shared/PageHeader';
import Button from '../../components/ui/Button';
import Modal from '../../components/ui/Modal';
import Input from '../../components/ui/Input';

// ─── Helpers ─────────────────────────────────────────────────────────────────
function isExpired(expiresAt) {
  if (!expiresAt) return false;
  return new Date(expiresAt) < new Date();
}

function formatExpiry(expiresAt) {
  if (!expiresAt) return 'No Expiry';
  const d = new Date(expiresAt);
  return d.toLocaleDateString('en-PK', { day: '2-digit', month: 'short', year: 'numeric' });
}

// ─── Permission Checkbox Tree ─────────────────────────────────────────────────
// permissions format: { employee: { gatepass: true, attendance: ['daily-view', ...] }, ... }
function PermissionTree({ permissions, onChange }) {
  const moduleKeys = Object.keys(PERMISSIONS_MAP);

  // ── Helpers ──────────────────────────────────────────────────────────────
  const isSubEnabled = (modKey, subKey) => {
    const modPerms = permissions[modKey];
    if (!modPerms || typeof modPerms !== 'object' || Array.isArray(modPerms)) return false;
    return subKey in modPerms;
  };

  const isTabEnabled = (modKey, subKey, tabKey) => {
    const modPerms = permissions[modKey];
    if (!modPerms) return false;
    const val = modPerms[subKey];
    if (val === true) return true;
    if (Array.isArray(val)) return val.includes(tabKey);
    return false;
  };

  const setModPerm = (modKey, newModPerms) =>
    onChange({ ...permissions, [modKey]: newModPerms });

  // ── Toggle handlers ───────────────────────────────────────────────────────
  const toggleModule = (modKey) => {
    const mod = PERMISSIONS_MAP[modKey];
    const modPerms = permissions[modKey] || {};
    const allOn = mod.subModules.every((s) => s.key in modPerms);
    if (allOn) {
      setModPerm(modKey, {});
    } else {
      const next = {};
      for (const s of mod.subModules) {
        next[s.key] = s.tabs ? s.tabs.map((t) => t.key) : true;
      }
      setModPerm(modKey, next);
    }
  };

  const toggleSub = (modKey, subKey) => {
    const subDef = PERMISSIONS_MAP[modKey].subModules.find((s) => s.key === subKey);
    const modPerms = { ...(permissions[modKey] || {}) };
    if (subKey in modPerms) {
      delete modPerms[subKey];
    } else {
      modPerms[subKey] = subDef.tabs ? subDef.tabs.map((t) => t.key) : true;
    }
    setModPerm(modKey, modPerms);
  };

  const toggleTab = (modKey, subKey, tabKey) => {
    const modPerms = { ...(permissions[modKey] || {}) };
    const current = Array.isArray(modPerms[subKey]) ? [...modPerms[subKey]] : [];
    modPerms[subKey] = current.includes(tabKey)
      ? current.filter((t) => t !== tabKey)
      : [...current, tabKey];
    setModPerm(modKey, modPerms);
  };

  // ── Render ────────────────────────────────────────────────────────────────
  return (
    <div className="space-y-4 mt-2">
      {moduleKeys.map((moduleKey) => {
        const mod = PERMISSIONS_MAP[moduleKey];
        const modPerms = permissions[moduleKey] || {};
        const enabledCount = Object.keys(modPerms).length;
        const totalSubs = mod.subModules.length;
        const allChecked = enabledCount === totalSubs;
        const someChecked = enabledCount > 0;

        return (
          <div key={moduleKey} className="border border-gray-200 rounded-lg overflow-hidden">
            {/* Module header */}
            <label className="flex items-center gap-3 px-4 py-3 bg-gray-50 cursor-pointer hover:bg-blue-50 transition-colors">
              <input
                type="checkbox"
                checked={allChecked}
                ref={(el) => { if (el) el.indeterminate = someChecked && !allChecked; }}
                onChange={() => toggleModule(moduleKey)}
                className="w-4 h-4 accent-blue-600 cursor-pointer"
              />
              <span className="font-semibold text-gray-800 text-sm">{mod.label}</span>
              {someChecked && (
                <span className="ml-auto text-xs text-blue-600 font-medium">
                  {enabledCount}/{totalSubs} selected
                </span>
              )}
            </label>

            {/* Sub-modules */}
            <div className="px-4 py-3 space-y-1">
              {mod.subModules.map((sub) => {
                const subOn = isSubEnabled(moduleKey, sub.key);
                return (
                  <div key={sub.key}>
                    {/* Sub-module row */}
                    <label className="flex items-center gap-2 cursor-pointer py-1">
                      <input
                        type="checkbox"
                        checked={subOn}
                        onChange={() => toggleSub(moduleKey, sub.key)}
                        className="w-4 h-4 accent-blue-600 cursor-pointer"
                      />
                      <span className="text-sm font-medium text-gray-700">{sub.label}</span>
                      {sub.tabs && subOn && (
                        <span className="ml-auto text-xs text-gray-400">
                          {Array.isArray(modPerms[sub.key]) ? modPerms[sub.key].length : sub.tabs.length}/{sub.tabs.length} tabs
                        </span>
                      )}
                    </label>

                    {/* Tab checkboxes — only when sub-module has tabs AND is enabled */}
                    {sub.tabs && subOn && (
                      <div className="ml-6 grid grid-cols-2 gap-x-4 gap-y-0 pb-2 pt-0.5">
                        {sub.tabs.map((tab) => (
                          <label key={tab.key} className="flex items-center gap-2 cursor-pointer py-0.5">
                            <input
                              type="checkbox"
                              checked={isTabEnabled(moduleKey, sub.key, tab.key)}
                              onChange={() => toggleTab(moduleKey, sub.key, tab.key)}
                              className="w-3.5 h-3.5 accent-blue-500 cursor-pointer"
                            />
                            <span className="text-xs text-gray-600">{tab.label}</span>
                          </label>
                        ))}
                      </div>
                    )}
                  </div>
                );
              })}
            </div>
          </div>
        );
      })}
    </div>
  );
}

// ─── User Form Modal ──────────────────────────────────────────────────────────
function UserFormModal({ isOpen, onClose, editUser, onSave }) {
  const isEdit = !!editUser;
  const [saving, setSaving] = useState(false);

  const [form, setForm] = useState({
    name: '',
    email: '',
    password: '',
    confirmPassword: '',
    role: '',
    hasExpiry: false,
    expiresAt: '',
    permissions: {},
  });

  // Populate form when editing — normalize old-format permissions to new format
  useEffect(() => {
    if (editUser) {
      setForm({
        name: editUser.name || '',
        email: editUser.email || '',
        password: '',
        confirmPassword: '',
        role: editUser.role || '',
        hasExpiry: !!editUser.expiresAt,
        expiresAt: editUser.expiresAt ? editUser.expiresAt.slice(0, 10) : '',
        permissions: normalizePermissions(editUser.permissions || {}),
      });
    } else {
      setForm({ name: '', email: '', password: '', confirmPassword: '', role: '', hasExpiry: false, expiresAt: '', permissions: {} });
    }
  }, [editUser, isOpen]);

  const set = (field, value) => setForm((f) => ({ ...f, [field]: value }));

  const handleSubmit = async (e) => {
    e.preventDefault();
    if (!form.name.trim() || !form.email.trim() || !form.role.trim()) {
      toast.error('Name, email and role are required');
      return;
    }
    if (!isEdit && !form.password) {
      toast.error('Password is required for new users');
      return;
    }
    if (form.password && form.password !== form.confirmPassword) {
      toast.error('Passwords do not match');
      return;
    }
    if (form.password && form.password.length < 6) {
      toast.error('Password must be at least 6 characters');
      return;
    }

    const payload = {
      name: form.name.trim(),
      email: form.email.trim().toLowerCase(),
      role: form.role.trim(),
      permissions: form.permissions,
      expiresAt: form.hasExpiry && form.expiresAt ? form.expiresAt : null,
    };
    if (!isEdit || form.password) payload.password = form.password;

    setSaving(true);
    try {
      await onSave(payload);
      onClose();
    } catch (err) {
      toast.error(err.message || 'Failed to save user');
    } finally {
      setSaving(false);
    }
  };

  return (
    <Modal isOpen={isOpen} onClose={onClose} title={isEdit ? 'Edit User' : 'Create New User'} size="lg">
      <form onSubmit={handleSubmit} className="space-y-4">
        {/* Basic info */}
        <div className="grid grid-cols-2 gap-4">
          <Input
            label="Full Name *"
            placeholder="Ahmed Ali"
            value={form.name}
            onChange={(e) => set('name', e.target.value)}
          />
          <Input
            label="Role / Designation *"
            placeholder="Receptionist"
            value={form.role}
            onChange={(e) => set('role', e.target.value)}
          />
        </div>
        <Input
          label="Email Address *"
          type="email"
          placeholder="ahmed@hospital.com"
          value={form.email}
          onChange={(e) => set('email', e.target.value)}
        />

        {/* Password */}
        <div className="border border-gray-200 rounded-lg p-4 space-y-3">
          <p className="text-sm font-semibold text-gray-700">
            {isEdit ? 'Change Password (leave blank to keep current)' : 'Set Password *'}
          </p>
          <div className="grid grid-cols-2 gap-4">
            <Input
              label="New Password"
              type="password"
              placeholder="Min 6 characters"
              value={form.password}
              onChange={(e) => set('password', e.target.value)}
            />
            <Input
              label="Confirm Password"
              type="password"
              placeholder="Re-enter password"
              value={form.confirmPassword}
              onChange={(e) => set('confirmPassword', e.target.value)}
            />
          </div>
        </div>

        {/* Account expiry */}
        <div className="border border-gray-200 rounded-lg p-4 space-y-3">
          <p className="text-sm font-semibold text-gray-700">Account Expiry</p>
          <div className="flex items-center gap-6">
            <label className="flex items-center gap-2 cursor-pointer">
              <input
                type="radio"
                checked={!form.hasExpiry}
                onChange={() => set('hasExpiry', false)}
                className="accent-blue-600"
              />
              <span className="text-sm text-gray-700">No Expiry</span>
            </label>
            <label className="flex items-center gap-2 cursor-pointer">
              <input
                type="radio"
                checked={form.hasExpiry}
                onChange={() => set('hasExpiry', true)}
                className="accent-blue-600"
              />
              <span className="text-sm text-gray-700">Set Expiry Date</span>
            </label>
            {form.hasExpiry && (
              <input
                type="date"
                value={form.expiresAt}
                onChange={(e) => set('expiresAt', e.target.value)}
                min={new Date().toISOString().slice(0, 10)}
                className="border border-gray-300 rounded-md px-3 py-1.5 text-sm focus:outline-none focus:ring-2 focus:ring-blue-500"
              />
            )}
          </div>
        </div>

        {/* Permissions */}
        <div>
          <p className="text-sm font-semibold text-gray-700 mb-1">Module Permissions</p>
          <PermissionTree
            permissions={form.permissions}
            onChange={(p) => set('permissions', p)}
          />
        </div>

        {/* Actions */}
        <div className="flex justify-end gap-3 pt-2 border-t border-gray-100">
          <Button label="Cancel" variant="secondary" type="button" onClick={onClose} />
          <Button label={isEdit ? 'Save Changes' : 'Create User'} variant="primary" type="submit" loading={saving} />
        </div>
      </form>
    </Modal>
  );
}

// ─── Main Page ────────────────────────────────────────────────────────────────
export default function UserManagement() {
  const { users, loading, error, fetchUsers, createUser, updateUser, deleteUser, toggleActive } = useUserManagementStore();
  const [modalOpen, setModalOpen] = useState(false);
  const [editUser, setEditUser] = useState(null);
  const [deletingId, setDeletingId] = useState(null);

  useEffect(() => {
    fetchUsers();
  }, [fetchUsers]);

  const openCreate = () => { setEditUser(null); setModalOpen(true); };
  const openEdit = (user) => { setEditUser(user); setModalOpen(true); };
  const closeModal = () => { setModalOpen(false); setEditUser(null); };

  const handleSave = async (payload) => {
    if (editUser) {
      await updateUser(editUser.id, payload);
      toast.success('User updated successfully');
    } else {
      await createUser(payload);
      toast.success('User created successfully');
    }
  };

  const handleDelete = async (id) => {
    if (!window.confirm('Are you sure you want to delete this user? This cannot be undone.')) return;
    setDeletingId(id);
    try {
      await deleteUser(id);
      toast.success('User deleted');
    } catch (err) {
      toast.error(err.message || 'Failed to delete user');
    } finally {
      setDeletingId(null);
    }
  };

  const handleToggle = async (user) => {
    try {
      const result = await toggleActive(user.id);
      toast.success(`${user.name} ${result.isActive ? 'activated' : 'deactivated'}`);
    } catch (err) {
      toast.error(err.message || 'Failed to update status');
    }
  };

  // Count enabled sub-modules for display
  const countPermissions = (permissions) => {
    if (!permissions) return 0;
    let count = 0;
    for (const modPerms of Object.values(permissions)) {
      if (Array.isArray(modPerms)) count += modPerms.length;         // legacy
      else if (typeof modPerms === 'object') count += Object.keys(modPerms).length; // new
    }
    return count;
  };

  return (
    <div className="p-6">
      <PageHeader
        title="User Management"
        subtitle="Create sub-users and control their module access"
        action={
          <Button
            label="+ Create User"
            variant="primary"
            onClick={openCreate}
          />
        }
      />

      {loading ? (
        <div className="flex items-center justify-center py-16">
          <div className="w-8 h-8 border-4 border-blue-600 border-t-transparent rounded-full animate-spin" />
        </div>
      ) : error ? (
        <div className="flex flex-col items-center justify-center py-20 text-red-400">
          <AlertTriangle className="w-12 h-12 mb-3 opacity-60" />
          <p className="text-base font-medium text-red-600">Could not load users</p>
          <p className="text-sm mt-1 text-gray-500 max-w-md text-center">{error}</p>
          <button
            onClick={fetchUsers}
            className="mt-4 px-4 py-2 bg-blue-600 text-white text-sm rounded-lg hover:bg-blue-700 transition-colors"
          >
            Retry
          </button>
        </div>
      ) : users.length === 0 ? (
        <div className="flex flex-col items-center justify-center py-20 text-gray-400">
          <ShieldCheck className="w-16 h-16 mb-4 opacity-30" />
          <p className="text-lg font-medium">No sub-users yet</p>
          <p className="text-sm mt-1">Click "Create User" to add your first staff account</p>
        </div>
      ) : (
        <div className="mt-6 bg-white rounded-xl border border-gray-200 overflow-hidden">
          <table className="w-full text-sm">
            <thead>
              <tr className="bg-gray-50 border-b border-gray-200">
                <th className="text-left px-5 py-3.5 font-semibold text-gray-600">Name</th>
                <th className="text-left px-5 py-3.5 font-semibold text-gray-600">Email</th>
                <th className="text-left px-5 py-3.5 font-semibold text-gray-600">Role</th>
                <th className="text-left px-5 py-3.5 font-semibold text-gray-600">Permissions</th>
                <th className="text-left px-5 py-3.5 font-semibold text-gray-600">Expiry</th>
                <th className="text-left px-5 py-3.5 font-semibold text-gray-600">Status</th>
                <th className="text-right px-5 py-3.5 font-semibold text-gray-600">Actions</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-gray-100">
              {users.map((user) => {
                const expired = isExpired(user.expiresAt);
                return (
                  <tr key={user.id} className={`hover:bg-gray-50 transition-colors ${expired ? 'opacity-70' : ''}`}>
                    <td className="px-5 py-3.5 font-medium text-gray-800">{user.name}</td>
                    <td className="px-5 py-3.5 text-gray-500">{user.email}</td>
                    <td className="px-5 py-3.5">
                      <span className="inline-flex items-center px-2.5 py-0.5 rounded-full text-xs font-medium bg-blue-50 text-blue-700 border border-blue-100">
                        {user.role}
                      </span>
                    </td>
                    <td className="px-5 py-3.5 text-gray-500">
                      {countPermissions(user.permissions) > 0
                        ? `${countPermissions(user.permissions)} access${countPermissions(user.permissions) > 1 ? 'es' : ''}`
                        : <span className="text-gray-400 italic">None</span>
                      }
                    </td>
                    <td className="px-5 py-3.5">
                      {expired ? (
                        <span className="inline-flex items-center gap-1 text-amber-600 font-medium text-xs">
                          <AlertTriangle className="w-3.5 h-3.5" />
                          Expired {formatExpiry(user.expiresAt)}
                        </span>
                      ) : (
                        <span className="text-gray-500 text-xs">{formatExpiry(user.expiresAt)}</span>
                      )}
                    </td>
                    <td className="px-5 py-3.5">
                      <button
                        onClick={() => handleToggle(user)}
                        className="flex items-center gap-1.5 text-xs font-medium transition-colors"
                        title={user.isActive ? 'Click to deactivate' : 'Click to activate'}
                      >
                        {user.isActive ? (
                          <>
                            <ToggleRight className="w-5 h-5 text-green-500" />
                            <span className="text-green-600">Active</span>
                          </>
                        ) : (
                          <>
                            <ToggleLeft className="w-5 h-5 text-gray-400" />
                            <span className="text-gray-400">Inactive</span>
                          </>
                        )}
                      </button>
                    </td>
                    <td className="px-5 py-3.5">
                      <div className="flex items-center justify-end gap-2">
                        <button
                          onClick={() => openEdit(user)}
                          className="p-1.5 rounded-md text-gray-400 hover:text-blue-600 hover:bg-blue-50 transition-colors"
                          title="Edit user"
                        >
                          <Edit2 className="w-4 h-4" />
                        </button>
                        <button
                          onClick={() => handleDelete(user.id)}
                          disabled={deletingId === user.id}
                          className="p-1.5 rounded-md text-gray-400 hover:text-red-600 hover:bg-red-50 transition-colors disabled:opacity-40"
                          title="Delete user"
                        >
                          <Trash2 className="w-4 h-4" />
                        </button>
                      </div>
                    </td>
                  </tr>
                );
              })}
            </tbody>
          </table>
        </div>
      )}

      <UserFormModal
        isOpen={modalOpen}
        onClose={closeModal}
        editUser={editUser}
        onSave={handleSave}
      />
    </div>
  );
}
