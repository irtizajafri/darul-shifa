import { useEffect, useRef, useId } from 'react';
import { X } from 'lucide-react';
import clsx from 'clsx';
import useFocusTrap from '../../hooks/useFocusTrap';

export default function Modal({
  isOpen,
  onClose,
  title,
  children,
  size = 'md',
}) {
  const bodyRef = useRef(null);
  const titleId = useId();

  // Keyboard focus stays inside the modal body while it is open (Tab cycles,
  // first field gets focus on open) and returns to where it was on close.
  useFocusTrap(bodyRef, isOpen);

  useEffect(() => {
    const handleEscape = (e) => {
      if (e.key === 'Escape') onClose();
    };
    if (isOpen) {
      document.addEventListener('keydown', handleEscape);
      document.body.style.overflow = 'hidden';
    }
    return () => {
      document.removeEventListener('keydown', handleEscape);
      document.body.style.overflow = '';
    };
  }, [isOpen, onClose]);

  if (!isOpen) return null;

  const sizes = {
    sm: 'max-w-md',
    md: 'max-w-lg',
    lg: 'max-w-2xl',
    xl: 'max-w-4xl',
  };

  return (
    <div
      className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/50"
      onClick={onClose}
    >
      <div
        role="dialog"
        aria-modal="true"
        aria-labelledby={title ? titleId : undefined}
        className={clsx(
          'w-full bg-white rounded-xl shadow-xl max-h-[90vh] overflow-hidden flex flex-col',
          sizes[size] || sizes.md
        )}
        onClick={(e) => e.stopPropagation()}
      >
        <div className="flex items-center justify-between px-6 py-4 border-b border-[#E2E8F0]">
          <h2 id={titleId} className="text-lg font-semibold text-[#0F172A]">{title}</h2>
          <button
            type="button"
            onClick={onClose}
            aria-label="Close"
            title="Close"
            className="p-1 rounded-lg hover:bg-gray-100 text-[#64748B] hover:text-[#0F172A]"
          >
            <X className="w-5 h-5" />
          </button>
        </div>
        <div ref={bodyRef} className="flex-1 overflow-y-auto px-6 py-4">{children}</div>
      </div>
    </div>
  );
}
