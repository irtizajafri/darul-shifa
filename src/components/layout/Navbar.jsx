import { Menu, LogOut, User } from 'lucide-react';
import ceoPhoto from '../../assets/ceo.JPG';
import { useAuthStore } from '../../store/useAuthStore';
import { useNavigate } from 'react-router-dom';

export default function Navbar({ onMenuClick }) {
  const { user, logout } = useAuthStore();
  const navigate = useNavigate();

  const handleLogout = () => {
    logout();
    navigate('/login');
  };

  return (
    <header className="sticky top-0 z-30 flex items-center justify-between h-16 px-4 bg-white border-b border-[#E2E8F0]">
      <button
        onClick={onMenuClick}
        className="lg:hidden p-2 rounded-lg hover:bg-[#F8FAFC]"
      >
        <Menu className="w-6 h-6 text-[#0F172A]" />
      </button>
      <div className="flex-1" />
      <div className="flex items-center gap-4">
        <div className="hidden sm:flex items-center gap-2 text-sm">
          <div className="w-8 h-8 rounded-full bg-[#2563EB]/15 flex items-center justify-center overflow-hidden">
            {user?.name?.toLowerCase() === 'dr.nadeem abbasi' ? (
              <img src={ceoPhoto} alt="Dr Nadeem Abbasi" className="w-full h-full object-cover" />
            ) : (
              <User className="w-4 h-4 text-[#2563EB]" />
            )}
          </div>
          <div>
            <p className="font-medium text-[#0F172A]">{user?.name || 'User'}</p>
            <p className="text-xs text-[#64748B]">{user?.role || 'Role'}</p>
          </div>
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
  );
}
