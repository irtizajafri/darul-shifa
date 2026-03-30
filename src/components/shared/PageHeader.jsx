import { ChevronRight } from 'lucide-react';
import { Link } from 'react-router-dom';
import Button from '../ui/Button';

export default function PageHeader({
  breadcrumbs = [],
  title,
  subtitle,
  action,
  actionLabel,
  actionIcon,
  onAction,
}) {
  return (
    <div className="mb-6">
      {breadcrumbs.length > 0 && (
        <nav className="flex items-center gap-1 text-sm text-[#64748B] mb-2">
          {breadcrumbs.map((item, i) => (
            <span key={i} className="flex items-center gap-1">
              {item.link ? (
                <Link to={item.link} className="hover:text-[#2563EB]">
                  {item.label}
                </Link>
              ) : (
                <span>{item.label}</span>
              )}
              {i < breadcrumbs.length - 1 && (
                <ChevronRight className="w-4 h-4 text-[#64748B]" />
              )}
            </span>
          ))}
        </nav>
      )}
      <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4">
        <div>
          <h1 className="text-2xl font-bold text-[#0F172A]">{title}</h1>
          {subtitle && <p className="text-[#64748B] mt-1">{subtitle}</p>}
        </div>
        {(action || (actionLabel && onAction)) && (
          <div>{action || <Button label={actionLabel} icon={actionIcon} onClick={onAction} />}</div>
        )}
      </div>
    </div>
  );
}
