import { useState, useRef, useEffect } from 'react';
import { ChevronDown, X } from 'lucide-react';

export default function SearchableSelect({
  options = [],
  value,
  onChange,
  placeholder = 'Select an option',
  disabled = false,
  required = false,
  getLabel = (opt) => `${opt.name} (${opt.code})`,
  getKey = (opt) => opt.id,
}) {
  const [isOpen, setIsOpen] = useState(false);
  const [searchTerm, setSearchTerm] = useState('');
  const containerRef = useRef(null);
  const inputRef = useRef(null);

  // Filter options based on search term
  const filteredOptions = options.filter((opt) => {
    const label = getLabel(opt).toLowerCase();
    return label.includes(searchTerm.toLowerCase());
  });

  // Get selected option label
  const selectedOption = options.find((opt) => String(getKey(opt)) === String(value));
  const selectedLabel = selectedOption ? getLabel(selectedOption) : '';

  // Handle outside click
  useEffect(() => {
    const handleClickOutside = (event) => {
      if (containerRef.current && !containerRef.current.contains(event.target)) {
        setIsOpen(false);
      }
    };

    if (isOpen) {
      document.addEventListener('mousedown', handleClickOutside);
      inputRef.current?.focus();
    }

    return () => document.removeEventListener('mousedown', handleClickOutside);
  }, [isOpen]);

  // Handle option select
  const handleSelectOption = (option) => {
    onChange(String(getKey(option)));
    setIsOpen(false);
    setSearchTerm('');
  };

  // Handle clear
  const handleClear = (e) => {
    e.stopPropagation();
    onChange('');
    setSearchTerm('');
  };

  return (
    <div ref={containerRef} className="relative w-full">
      {/* Main Input */}
      <div
        onClick={() => !disabled && setIsOpen(!isOpen)}
        className={`flex items-center justify-between px-3 py-2 border border-slate-300 rounded-md text-sm cursor-pointer transition ${
          disabled
            ? 'bg-slate-50 text-slate-500 cursor-not-allowed'
            : 'bg-white hover:border-slate-400'
        } ${isOpen ? 'border-blue-500 ring-2 ring-blue-200' : ''}`}
      >
        <span className={selectedLabel ? 'text-slate-900' : 'text-slate-400'}>
          {selectedLabel || placeholder}
        </span>
        <div className="flex items-center gap-1">
          {value && (
            <button
              onClick={handleClear}
              className="p-0.5 hover:bg-slate-200 rounded"
              type="button"
            >
              <X size={16} className="text-slate-500" />
            </button>
          )}
          <ChevronDown
            size={16}
            className={`text-slate-400 transition ${isOpen ? 'rotate-180' : ''}`}
          />
        </div>
      </div>

      {/* Dropdown Menu */}
      {isOpen && !disabled && (
        <div className="absolute top-full left-0 right-0 mt-1 bg-white border border-slate-300 rounded-md shadow-lg z-50">
          {/* Search Input */}
          <div className="p-2 border-b border-slate-200">
            <input
              ref={inputRef}
              type="text"
              placeholder="Search..."
              value={searchTerm}
              onChange={(e) => setSearchTerm(e.target.value)}
              className="w-full px-3 py-2 border border-slate-300 rounded-md text-sm focus:outline-none focus:border-blue-500"
            />
          </div>

          {/* Options List */}
          <div className="max-h-48 overflow-y-auto">
            {filteredOptions.length > 0 ? (
              filteredOptions.map((option) => {
                const optionKey = getKey(option);
                const isSelected = String(optionKey) === String(value);
                return (
                  <button
                    key={optionKey}
                    onClick={() => handleSelectOption(option)}
                    className={`w-full text-left px-3 py-2.5 text-sm transition ${
                      isSelected
                        ? 'bg-blue-50 text-blue-700 font-medium'
                        : 'hover:bg-slate-50 text-slate-900'
                    }`}
                    type="button"
                  >
                    {getLabel(option)}
                  </button>
                );
              })
            ) : (
              <div className="px-3 py-6 text-center text-slate-400 text-sm">
                No options found
              </div>
            )}
          </div>
        </div>
      )}

      {/* Hidden input for form submission */}
      {required && (
        <input type="hidden" value={value} required={required} />
      )}
    </div>
  );
}
