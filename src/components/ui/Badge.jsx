import clsx from 'clsx';

export default function Badge({ label, variant = 'default' }) {
  const variants = {
    success: 'bg-success/15 text-success',
    warning: 'bg-warning/15 text-warning',
    danger: 'bg-danger/15 text-danger',
    info: 'bg-primary/15 text-primary',
    default: 'bg-gray-100 text-gray-700',
  };

  return (
    <span
      className={clsx(
        'inline-flex items-center px-2.5 py-0.5 rounded-full text-xs font-medium',
        variants[variant] || variants.default
      )}
    >
      {label}
    </span>
  );
}
