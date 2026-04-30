import clsx from 'clsx';

export default function Card({ title, children, className = '', onClick, ...rest }) {
  const isClickable = typeof onClick === 'function';

  return (
    <div
      className={clsx(
        'bg-white rounded-xl shadow-sm border border-[#E2E8F0] overflow-hidden',
        isClickable && 'cursor-pointer',
        className
      )}
      onClick={onClick}
      role={isClickable ? 'button' : undefined}
      tabIndex={isClickable ? 0 : undefined}
      onKeyDown={isClickable ? (e) => {
        if (e.key === 'Enter' || e.key === ' ') {
          e.preventDefault();
          onClick(e);
        }
      } : undefined}
      {...rest}
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
