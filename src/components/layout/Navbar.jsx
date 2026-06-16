import { useEffect, useRef, useState } from 'react';
import { Menu, LogOut, User, KeyRound, X, Eye, EyeOff } from 'lucide-react';
import ceoPhoto from '../../assets/ceo.JPG';
import { useAuthStore } from '../../store/useAuthStore';
import { useNavigate } from 'react-router-dom';
import toast from 'react-hot-toast';

function ChangePasswordModal({ user, onClose }) {
  const { logout } = useAuthStore();
  const navigate = useNavigate();
  const [form, setForm] = useState({ current: '', next: '', confirm: '' });
  const [show, setShow] = useState({ current: false, next: false, confirm: false });
  const [loading, setLoading] = useState(false);

  const toggle = (field) => setShow((s) => ({ ...s, [field]: !s[field] }));
  const set = (field) => (e) => setForm((f) => ({ ...f, [field]: e.target.value }));

  const handleSubmit = async (e) => {
    e.preventDefault();
    if (form.next !== form.confirm) { toast.error('New passwords do not match'); return; }
    if (form.next.length < 6) { toast.error('New password must be at least 6 characters'); return; }
    setLoading(true);
    try {
      const res = await fetch('http://localhost:5001/api/auth/change-password', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ userId: user.id, currentPassword: form.current, newPassword: form.next }),
      });
      const json = await res.json();
      if (!json.ok) { toast.error(json.message || 'Failed to change password'); return; }
      toast.success('Password changed. Please login again.');
      logout();
      navigate('/login');
    } catch {
      toast.error('Could not connect to server');
    } finally {
      setLoading(false);
    }
  };

  const fields = [
    { key: 'current', label: 'Current Password' },
    { key: 'next',    label: 'New Password' },
    { key: 'confirm', label: 'Confirm New Password' },
  ];

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/40">
      <div className="bg-white rounded-xl shadow-xl w-full max-w-sm mx-4 p-6">
        <div className="flex items-center justify-between mb-5">
          <h2 className="text-base font-semibold text-slate-800">Change Password</h2>
          <button onClick={onClose} className="text-slate-400 hover:text-slate-600"><X className="w-4 h-4" /></button>
        </div>
        <form onSubmit={handleSubmit} className="space-y-4">
          {fields.map(({ key, label }) => (
            <div key={key}>
              <label className="block text-xs font-medium text-slate-600 mb-1">{label}</label>
              <div className="relative">
                <input
                  type={show[key] ? 'text' : 'password'}
                  value={form[key]}
                  onChange={set(key)}
                  required
                  className="w-full px-3 py-2 pr-9 border border-slate-300 rounded-lg text-sm focus:outline-none focus:border-blue-500"
                />
                <button type="button" onClick={() => toggle(key)} className="absolute right-2.5 top-1/2 -translate-y-1/2 text-slate-400 hover:text-slate-600">
                  {show[key] ? <EyeOff className="w-4 h-4" /> : <Eye className="w-4 h-4" />}
                </button>
              </div>
            </div>
          ))}
          <div className="flex gap-2 pt-1">
            <button type="button" onClick={onClose} className="flex-1 py-2 text-sm border border-slate-300 rounded-lg text-slate-600 hover:bg-slate-50">Cancel</button>
            <button type="submit" disabled={loading} className="flex-1 py-2 text-sm bg-blue-600 text-white rounded-lg hover:bg-blue-700 disabled:opacity-50">
              {loading ? 'Saving...' : 'Save Password'}
            </button>
          </div>
        </form>
      </div>
    </div>
  );
}

export default function Navbar({ onMenuClick }) {
  const { user, logout } = useAuthStore();
  const navigate = useNavigate();
  const [dropdownOpen, setDropdownOpen] = useState(false);
  const [showChangePwd, setShowChangePwd] = useState(false);
  const dropdownRef = useRef(null);

  const handleLogout = () => {
    logout();
    navigate('/login');
  };

  useEffect(() => {
    const handler = (e) => {
      if (dropdownRef.current && !dropdownRef.current.contains(e.target)) {
        setDropdownOpen(false);
      }
    };
    document.addEventListener('mousedown', handler);
    return () => document.removeEventListener('mousedown', handler);
  }, []);

  return (
    <>
      <header className="sticky top-0 z-30 flex items-center justify-between h-16 px-4 bg-white border-b border-[#E2E8F0]">
        <button onClick={onMenuClick} className="p-2 rounded-lg hover:bg-[#F8FAFC]">
          <Menu className="w-6 h-6 text-[#0F172A]" />
        </button>
        <div className="flex-1" />
        <div className="flex items-center gap-4">

          {/* User avatar — clickable for sub-users */}
          <div className="relative hidden sm:block" ref={dropdownRef}>
            <button
              onClick={() => !user?.isSuperAdmin && setDropdownOpen((s) => !s)}
              className={`flex items-center gap-2 text-sm rounded-lg px-2 py-1 transition-colors ${!user?.isSuperAdmin ? 'hover:bg-slate-100 cursor-pointer' : 'cursor-default'}`}
            >
              <div className="w-8 h-8 rounded-full bg-[#2563EB]/15 flex items-center justify-center overflow-hidden">
                {user?.name?.toLowerCase() === 'dr.nadeem abbasi' ? (
                  <img src={ceoPhoto} alt="Dr Nadeem Abbasi" className="w-full h-full object-cover" />
                ) : (
                  <User className="w-4 h-4 text-[#2563EB]" />
                )}
              </div>
              <div className="text-left">
                <p className="font-medium text-[#0F172A]">{user?.name || 'User'}</p>
                <p className="text-xs text-[#64748B]">{user?.role || 'Role'}</p>
              </div>
            </button>

            {dropdownOpen && !user?.isSuperAdmin && (
              <div className="absolute right-0 mt-1 w-48 bg-white border border-slate-200 rounded-xl shadow-lg py-1 z-50">
                <button
                  onClick={() => { setDropdownOpen(false); setShowChangePwd(true); }}
                  className="w-full flex items-center gap-2.5 px-4 py-2.5 text-sm text-slate-700 hover:bg-slate-50"
                >
                  <KeyRound className="w-4 h-4 text-slate-400" />
                  Change Password
                </button>
              </div>
            )}
          </div>

          <button
            onClick={handleLogout}
            className="flex items-center gap-2 px-3 py-2 text-sm text-[#64748B] hover:text-[#EF4444] hover:bg-[#FEF2F2] rounded-lg transition-colors"
          >
            <LogOut className="w-4 h-4" />
            <span className="hidden sm:inline">Logout</span>
          </button>
        </div>
      </header>

      {showChangePwd && user && (
        <ChangePasswordModal user={user} onClose={() => setShowChangePwd(false)} />
      )}
    </>
  );
}
