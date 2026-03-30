import { Loader2 } from 'lucide-react';

export default function PageLoader() {
  return (
    <div className="fixed inset-0 z-[100] flex items-center justify-center bg-white/80">
      <div className="flex flex-col items-center gap-4">
        <Loader2 className="w-12 h-12 animate-spin text-primary" />
        <p className="text-sm text-[#64748B]">Loading...</p>
      </div>
    </div>
  );
}
