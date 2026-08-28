import { useEffect } from 'react';
import { useNavigate } from 'react-router-dom';
import { Lock, X } from 'lucide-react';
import { useAuthStore } from '../../store/useAuthStore';
import { hasPermission } from '../../utils/permissions';

function UnauthorizedModal() {
  const navigate = useNavigate();

  const goBack = () => navigate(-1);

  useEffect(() => {
    const onKey = (e) => { if (e.key === 'Escape') goBack(); };
    document.addEventListener('keydown', onKey);
    return () => document.removeEventListener('keydown', onKey);
  }, []);

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/40 backdrop-blur-sm">
      <div className="relative bg-white rounded-2xl shadow-2xl px-10 py-8 flex flex-col items-center gap-4 max-w-sm w-full mx-4 text-center">
        <button
          onClick={goBack}
          className="absolute top-3 right-3 p-1.5 rounded-lg text-gray-400 hover:text-gray-700 hover:bg-gray-100 transition-colors"
          title="Close (Esc)"
        >
          <X className="w-4 h-4" />
        </button>

        <div className="w-14 h-14 rounded-full bg-red-50 flex items-center justify-center">
          <Lock className="w-7 h-7 text-red-500" />
        </div>

        <div>
          <h3 className="text-lg font-semibold text-gray-800 mb-1">Access Restricted</h3>
          <p className="text-sm text-gray-500 leading-relaxed">
            You are not authorized to access this page.
            <br />
            Contact your administrator to request access.
          </p>
        </div>

        <button
          onClick={goBack}
          className="mt-1 px-5 py-2 bg-red-500 hover:bg-red-600 text-white text-sm font-medium rounded-lg transition-colors"
        >
          Go Back
        </button>
      </div>
    </div>
  );
}

export default function PermissionGuard({ module, subModule, subModules, tab, children }) {
  const { user } = useAuthStore();
  const allowed = subModules
    ? subModules.some((sm) => hasPermission(user, module, sm))
    : hasPermission(user, module, subModule, tab ?? null);

  if (allowed) return children;
  return <UnauthorizedModal />;
}
