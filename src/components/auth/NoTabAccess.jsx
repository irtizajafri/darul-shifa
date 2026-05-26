import { Lock } from 'lucide-react';
import { useNavigate } from 'react-router-dom';

/**
 * Shown inside a page when the user has sub-module access but zero
 * allowed tabs — e.g. attendance granted but all tab-level perms revoked.
 */
export default function NoTabAccess() {
  const navigate = useNavigate();

  return (
    <div className="flex flex-col items-center justify-center min-h-[55vh]">
      <div className="bg-white border border-gray-200 rounded-2xl shadow-xl px-10 py-8 flex flex-col items-center gap-3 max-w-sm text-center">
        <div className="w-14 h-14 rounded-full bg-red-50 flex items-center justify-center">
          <Lock className="w-7 h-7 text-red-500" />
        </div>
        <h3 className="text-lg font-semibold text-gray-800">Access Restricted</h3>
        <p className="text-sm text-gray-500 leading-relaxed">
          You don&apos;t have permission to access any section of this page.
          <br />
          Contact your administrator to request access.
        </p>
        <button
          onClick={() => navigate(-1)}
          className="mt-2 px-4 py-2 bg-blue-600 text-white text-sm rounded-lg hover:bg-blue-700 transition-colors"
        >
          Go Back
        </button>
      </div>
    </div>
  );
}
