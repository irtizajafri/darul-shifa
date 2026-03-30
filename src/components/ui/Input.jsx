import { useState, forwardRef } from 'react';
import { Eye, EyeOff } from 'lucide-react';
import clsx from 'clsx';

const Input = forwardRef(function Input({
  label,
  name,
  type = 'text',
  placeholder,
  value,
  onChange,
  onBlur,
  error,
  required = false,
  disabled = false,
  className = '',
  ...props
}, ref) {
  const [showPassword, setShowPassword] = useState(false);
  const isPassword = type === 'password';
  const inputType = isPassword && showPassword ? 'text' : type;

  return (
    <div className={clsx('w-full', className)}>
      {label && (
        <label htmlFor={name} className="block text-sm font-medium text-text-main mb-1">
          {label}
          {required && <span className="text-danger ml-0.5">*</span>}
        </label>
      )}
      <div className="relative">
        <input
          ref={ref}
          id={name}
          name={name}
          type={inputType}
          placeholder={placeholder}
          value={value}
          onChange={onChange}
          onBlur={onBlur}
          disabled={disabled}
          required={required}
          className={clsx(
            'w-full px-3 py-2 border rounded-lg focus:outline-none focus:ring-2 focus:ring-primary/30 transition-colors',
            error
              ? 'border-danger focus:ring-danger/30'
              : 'border-[#E2E8F0] focus:border-primary',
            isPassword && 'pr-10',
            disabled && 'bg-gray-100 cursor-not-allowed'
          )}
          {...props}
        />
        {isPassword && (
          <button
            type="button"
            onClick={() => setShowPassword(!showPassword)}
            className="absolute right-3 top-1/2 -translate-y-1/2 text-text-muted hover:text-text-main"
            tabIndex={-1}
          >
            {showPassword ? <EyeOff className="w-4 h-4" /> : <Eye className="w-4 h-4" />}
          </button>
        )}
      </div>
      {error && <p className="mt-1 text-sm text-danger">{error}</p>}
    </div>
  );
});

export default Input;
