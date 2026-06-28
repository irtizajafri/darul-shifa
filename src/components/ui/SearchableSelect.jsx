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
  const [highlightedIndex, setHighlightedIndex] = useState(0);
  const [dropdownPos, setDropdownPos] = useState({ top: 0, left: 0, width: 0 });
  const triggerRef = useRef(null);
  const dropdownRef = useRef(null);
  const inputRef = useRef(null);
  const listRef = useRef(null);

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

  // Reset highlight when search changes
  useEffect(() => {
    setHighlightedIndex(0);
  }, [searchTerm]);

  useEffect(() => {
    if (!isOpen) return;

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
        closeDropdown();
      }
    };

    document.addEventListener('mousedown', handleClickOutside);
    setTimeout(() => inputRef.current?.focus(), 0);
    return () => document.removeEventListener('mousedown', handleClickOutside);
  }, [isOpen]);

  // Scroll highlighted item into view
  useEffect(() => {
    if (!isOpen || !listRef.current) return;
    const items = listRef.current.querySelectorAll('[data-option]');
    items[highlightedIndex]?.scrollIntoView({ block: 'nearest' });
  }, [highlightedIndex, isOpen]);

  const closeDropdown = () => {
    setIsOpen(false);
    setSearchTerm('');
    setHighlightedIndex(0);
    triggerRef.current?.querySelector('[tabindex]')?.focus() ?? triggerRef.current?.focus();
  };

  const handleSelectOption = (option) => {
    onChange(String(getKey(option)));
    setIsOpen(false);
    setSearchTerm('');
    setHighlightedIndex(0);
    // Return focus to trigger
    setTimeout(() => triggerRef.current?.querySelector('[role="combobox"]')?.focus(), 0);
  };

  const handleClear = (e) => {
    e.stopPropagation();
    onChange('');
    setSearchTerm('');
  };

  // Trigger: Enter / Space / Arrow Down opens dropdown
  const handleTriggerKeyDown = (e) => {
    if (disabled) return;
    if (e.key === 'Enter' || e.key === ' ' || e.key === 'ArrowDown' || e.key === 'ArrowUp') {
      e.preventDefault();
      setIsOpen(true);
    }
  };

  // Search input: arrows navigate list, Enter selects, ESC closes
  const handleSearchKeyDown = (e) => {
    if (e.key === 'Escape') {
      e.preventDefault();
      closeDropdown();
    } else if (e.key === 'ArrowDown') {
      e.preventDefault();
      setHighlightedIndex((i) => Math.min(i + 1, filteredOptions.length - 1));
    } else if (e.key === 'ArrowUp') {
      e.preventDefault();
      setHighlightedIndex((i) => Math.max(i - 1, 0));
    } else if (e.key === 'Enter') {
      e.preventDefault();
      if (filteredOptions[highlightedIndex]) {
        handleSelectOption(filteredOptions[highlightedIndex]);
      }
    }
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
            onKeyDown={handleSearchKeyDown}
            className="w-full text-sm focus:outline-none bg-transparent"
          />
        </div>
      </div>

      <div ref={listRef} className="max-h-72 overflow-y-auto">
        {filteredOptions.length > 0 ? (
          filteredOptions.map((option, idx) => {
            const optionKey = getKey(option);
            const isSelected = String(optionKey) === String(value);
            const isHighlighted = idx === highlightedIndex;
            return (
              <button
                key={optionKey}
                data-option
                type="button"
                onMouseDown={(e) => e.preventDefault()}
                onClick={() => handleSelectOption(option)}
                onMouseEnter={() => setHighlightedIndex(idx)}
                className={`w-full text-left px-3 py-2 text-sm transition ${
                  isSelected
                    ? 'bg-blue-50 text-blue-700 font-medium'
                    : isHighlighted
                    ? 'bg-slate-100 text-slate-900'
                    : 'text-slate-900'
                }`}
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
        role="combobox"
        tabIndex={disabled ? -1 : 0}
        aria-expanded={isOpen}
        aria-haspopup="listbox"
        onClick={() => !disabled && setIsOpen((o) => !o)}
        onKeyDown={handleTriggerKeyDown}
        className={`flex items-center justify-between px-3 py-2 border border-slate-300 rounded-md text-sm cursor-pointer transition focus:outline-none focus:ring-2 focus:ring-blue-200 focus:border-blue-500 ${
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
            <button
              onClick={handleClear}
              className="p-0.5 hover:bg-slate-200 rounded"
              type="button"
              tabIndex={-1}
            >
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
