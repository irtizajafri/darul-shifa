import clsx from 'clsx';

export default function Card({ title, children, className = '' }) {
  return (
    <div
      className={clsx(
        'bg-white rounded-xl shadow-sm border border-[#E2E8F0] overflow-hidden',
        className
      )}
    >
      {title && (
        <div className="px-6 py-4 border-b border-[#E2E8F0]">
          <h3 className="text-base font-semibold text-[#0F172A]">{title}</h3>
        </div>
      )}
      <div className="p-6">{children}</div>
    </div>
  );
}
