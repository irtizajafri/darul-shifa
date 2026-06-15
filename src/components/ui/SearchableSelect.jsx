import { useState, useRef, useEffect } from 'react';
import { createPortal } from 'react-dom';
import { ChevronDown, X, Search } from 'lucide-react';

export default function SearchableSelect({
  options = [],
  value,
  onChange,
  placeholder = 'Select an option',
  disabled = false,
  required = false,
  getLabel = (opt) => `${opt.name} (${opt.code})`,
  getKey = (opt) => opt.id,
  renderOption = null,
  renderSelected = null,
}) {
  const [isOpen, setIsOpen] = useState(false);
  const [searchTerm, setSearchTerm] = useState('');
  const [dropdownPos, setDropdownPos] = useState({ top: 0, left: 0, width: 0 });
  const triggerRef = useRef(null);
  const dropdownRef = useRef(null);
  const inputRef = useRef(null);

  const filteredOptions = options.filter((opt) => {
    try {
      const label = getLabel(opt).toLowerCase();
      return label.includes(searchTerm.toLowerCase());
    } catch {
      return true;
    }
  });

  const selectedOption = options.find((opt) => String(getKey(opt)) === String(value));
  const selectedLabel = selectedOption ? getLabel(selectedOption) : '';

  useEffect(() => {
    if (!isOpen) return;

    // Position dropdown below trigger
    const rect = triggerRef.current?.getBoundingClientRect();
    if (rect) {
      setDropdownPos({
        top: rect.bottom + window.scrollY + 4,
        left: rect.left + window.scrollX,
        width: rect.width,
      });
    }

    const handleClickOutside = (e) => {
      if (
        triggerRef.current && !triggerRef.current.contains(e.target) &&
        dropdownRef.current && !dropdownRef.current.contains(e.target)
      ) {
        setIsOpen(false);
        setSearchTerm('');
      }
    };

    document.addEventListener('mousedown', handleClickOutside);
    setTimeout(() => inputRef.current?.focus(), 0);
    return () => document.removeEventListener('mousedown', handleClickOutside);
  }, [isOpen]);

  const handleSelectOption = (option) => {
    onChange(String(getKey(option)));
    setIsOpen(false);
    setSearchTerm('');
  };

  const handleClear = (e) => {
    e.stopPropagation();
    onChange('');
    setSearchTerm('');
  };

  const dropdown = isOpen && !disabled && createPortal(
    <div
      ref={dropdownRef}
      style={{ position: 'absolute', top: dropdownPos.top, left: dropdownPos.left, width: dropdownPos.width, zIndex: 99999 }}
      className="bg-white border border-slate-200 rounded-2xl shadow-2xl"
    >
      <div className="p-3 border-b border-slate-100">
        <div className="flex items-center gap-2 px-3 py-2 border border-slate-300 rounded-full bg-white focus-within:border-blue-500 focus-within:ring-2 focus-within:ring-blue-100">
          <Search size={15} className="text-slate-400 shrink-0" />
          <input
            ref={inputRef}
            type="text"
            placeholder="Search..."
            value={searchTerm}
            onChange={(e) => setSearchTerm(e.target.value)}
            className="w-full text-sm focus:outline-none bg-transparent"
          />
        </div>
      </div>

      <div className="max-h-72 overflow-y-auto">
        {filteredOptions.length > 0 ? (
          filteredOptions.map((option) => {
            const optionKey = getKey(option);
            const isSelected = String(optionKey) === String(value);
            return (
              <button
                key={optionKey}
                onMouseDown={(e) => { e.preventDefault(); handleSelectOption(option); }}
                className={`w-full text-left px-3 py-2 text-sm transition ${
                  isSelected ? 'bg-blue-50 text-blue-700 font-medium' : 'hover:bg-slate-50 text-slate-900'
                }`}
                type="button"
              >
                {renderOption ? renderOption(option, isSelected) : getLabel(option)}
              </button>
            );
          })
        ) : (
          <div className="px-4 py-8 text-center">
            <div className="flex flex-col items-center gap-3 mb-3">
              {[0, 1, 2].map((i) => (
                <div key={i} className="flex items-center gap-2 w-40 opacity-20">
                  <div className="w-7 h-7 rounded-full bg-slate-300" />
                  <div className="flex-1 space-y-1">
                    <div className="h-2 bg-slate-300 rounded-full" />
                    <div className="h-2 bg-slate-200 rounded-full w-3/4" />
                  </div>
                </div>
              ))}
            </div>
            <p className="text-sm font-semibold text-slate-700">Oops.. No Results Found</p>
            <p className="text-xs text-slate-400 mt-1">
              Don't worry, it happens sometimes.<br />
              Perhaps you could try entering a different search term
            </p>
          </div>
        )}
      </div>
    </div>,
    document.body
  );

  return (
    <div ref={triggerRef} className="relative w-full">
      <div
        onClick={() => !disabled && setIsOpen(!isOpen)}
        className={`flex items-center justify-between px-3 py-2 border border-slate-300 rounded-md text-sm cursor-pointer transition ${
          disabled ? 'bg-slate-50 text-slate-500 cursor-not-allowed' : 'bg-white hover:border-slate-400'
        } ${isOpen ? 'border-blue-500 ring-2 ring-blue-200' : ''}`}
      >
        {selectedOption && renderSelected ? (
          renderSelected(selectedOption)
        ) : (
          <span className={selectedLabel ? 'text-slate-900' : 'text-slate-400'}>
            {selectedLabel || placeholder}
          </span>
        )}
        <div className="flex items-center gap-1">
          {value && (
            <button onClick={handleClear} className="p-0.5 hover:bg-slate-200 rounded" type="button">
              <X size={16} className="text-slate-500" />
            </button>
          )}
          <ChevronDown size={16} className={`text-slate-400 transition ${isOpen ? 'rotate-180' : ''}`} />
        </div>
      </div>

      {dropdown}

      {required && <input type="hidden" value={value} required={required} />}
    </div>
  );
}
