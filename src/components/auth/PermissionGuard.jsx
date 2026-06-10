import { Lock, X } from 'lucide-react';
import { useNavigate } from 'react-router-dom';
import { useAuthStore } from '../../store/useAuthStore';
import { hasPermission } from '../../utils/permissions';

export default function PermissionGuard({ module, subModule, subModules, children }) {
  const { user } = useAuthStore();
  const navigate = useNavigate();
  const allowed = subModules
    ? subModules.some((sm) => hasPermission(user, module, sm))
    : hasPermission(user, module, subModule);

  if (allowed) return children;

  return (
    <div className="relative w-full h-full min-h-[60vh]">
      {/* Blurred content underneath */}
      <div
        className="pointer-events-none select-none"
        style={{ filter: 'blur(6px)', opacity: 0.55 }}
        aria-hidden="true"
      >
        {children}
      </div>

      {/* Lock overlay */}
      <div className="absolute inset-0 flex flex-col items-center justify-center z-10">
        <div className="relative bg-white/85 backdrop-blur-sm border border-gray-200 rounded-2xl shadow-xl px-10 py-8 flex flex-col items-center gap-3 max-w-sm text-center">

          {/* X close button */}
          <button
            onClick={() => navigate('/dashboard')}
            className="absolute top-3 right-3 p-1.5 rounded-lg text-gray-400 hover:text-gray-700 hover:bg-gray-100 transition-colors"
            title="Go to Dashboard"
          >
            <X className="w-4 h-4" />
          </button>

          <div className="w-14 h-14 rounded-full bg-red-50 flex items-center justify-center">
            <Lock className="w-7 h-7 text-red-500" />
          </div>
          <h3 className="text-lg font-semibold text-gray-800">Access Restricted</h3>
          <p className="text-sm text-gray-500 leading-relaxed">
            You don&apos;t have permission to access this page.
            <br />
            Contact your administrator to request access.
          </p>
        </div>
      </div>
    </div>
  );
}
