import { useState, useRef, useEffect } from 'react';
import { createPortal } from 'react-dom';
import { ChevronDown, X, Search } from 'lucide-react';

// Default accessors cope with the three option shapes used across the app:
//   - plain strings                       → label = key = the string
//   - { id, name, code }                  → "name (code)", key = id
//   - { id|value, name|label|description } → name/label/description, key = id|value
function defaultGetLabel(opt) {
  if (opt == null) return '';
  if (typeof opt !== 'object') return String(opt);
  const name = opt.name ?? opt.label ?? opt.description ?? opt.title ?? '';
  return opt.code != null && opt.code !== '' ? `${name} (${opt.code})` : String(name);
}
function defaultGetKey(opt) {
  if (opt == null) return '';
  if (typeof opt !== 'object') return opt;
  return opt.id ?? opt.value ?? opt.code ?? opt.key ?? defaultGetLabel(opt);
}

// How many options to render when the search box is empty. Lists in this
// app go up to several thousand rows (inventory items); rendering all of
// them on open is slow and useless — the user will type anyway. Filtered
// results are still shown in full.
const DEFAULT_MAX_UNFILTERED = 200;

export default function SearchableSelect({
  options = [],
  value,
  onChange,
  placeholder = 'Select an option',
  disabled = false,
  required = false,
  getLabel = defaultGetLabel,
  getKey = defaultGetKey,
  renderOption = null,
  renderSelected = null,
  // Styling hooks so the control can sit inside the many BEM-styled legacy
  // forms (cwf-input, adm-*, gopd-*, ve-form__*) without fighting them.
  className = '',          // extra classes on the trigger box
  wrapperClassName = '',   // extra classes on the outer wrapper
  style,                   // inline style on the outer wrapper (width etc.)
  size = 'md',             // 'sm' matches the dense legacy inputs, 'md' default
  id,
  name,
  title,
  clearable = true,
  maxUnfiltered = DEFAULT_MAX_UNFILTERED,
  emptyText = 'No results found',
  onOpenChange,
}) {
  const [isOpen, setIsOpen] = useState(false);
  const [searchTerm, setSearchTerm] = useState('');
  const [highlightedIndex, setHighlightedIndex] = useState(0);
  const [dropdownPos, setDropdownPos] = useState({ top: 0, left: 0, width: 0, openUp: false });
  const triggerRef = useRef(null);
  const dropdownRef = useRef(null);
  const inputRef = useRef(null);
  const listRef = useRef(null);

  const term = searchTerm.trim().toLowerCase();
  const allMatches = term
    ? options.filter((opt) => {
        try {
          return getLabel(opt).toLowerCase().includes(term);
        } catch {
          return true;
        }
      })
    : options;
  const truncated = !term && maxUnfiltered > 0 && allMatches.length > maxUnfiltered;
  const filteredOptions = truncated ? allMatches.slice(0, maxUnfiltered) : allMatches;

  const selectedOption = options.find((opt) => String(getKey(opt)) === String(value));
  const selectedLabel = selectedOption ? getLabel(selectedOption) : '';
  const hasValue = value !== undefined && value !== null && value !== '';

  const closeDropdown = () => {
    setIsOpen(false);
    setSearchTerm('');
    setHighlightedIndex(0);
    triggerRef.current?.querySelector('[role="combobox"]')?.focus();
  };

  useEffect(() => {
    onOpenChange?.(isOpen);
  }, [isOpen]); // eslint-disable-line react-hooks/exhaustive-deps

  const positionDropdown = () => {
    const rect = triggerRef.current?.getBoundingClientRect();
    if (!rect) return;
    const spaceBelow = window.innerHeight - rect.bottom;
    const estimatedHeight = 340; // search row + max-h-72 list
    const openUp = spaceBelow < estimatedHeight && rect.top > spaceBelow;
    setDropdownPos({
      top: openUp ? rect.top + window.scrollY - 4 : rect.bottom + window.scrollY + 4,
      left: rect.left + window.scrollX,
      width: rect.width,
      openUp,
    });
  };

  const openDropdown = (initialTerm = '') => {
    if (disabled) return;
    positionDropdown();
    setSearchTerm(initialTerm);
    setHighlightedIndex(0);
    setIsOpen(true);
  };

  const handleSearchChange = (e) => {
    setSearchTerm(e.target.value);
    setHighlightedIndex(0);
  };

  useEffect(() => {
    if (!isOpen) return;

    const handleClickOutside = (e) => {
      if (
        triggerRef.current && !triggerRef.current.contains(e.target) &&
        dropdownRef.current && !dropdownRef.current.contains(e.target)
      ) {
        closeDropdown();
      }
    };
    // Scrolling the page/panel under the dropdown closes it (the portal can't
    // follow the trigger). Scrolling *inside* the option list must not.
    const handleScroll = (e) => {
      if (dropdownRef.current && dropdownRef.current.contains(e.target)) return;
      closeDropdown();
    };
    const handleResize = () => positionDropdown();

    document.addEventListener('mousedown', handleClickOutside);
    window.addEventListener('blur', closeDropdown);
    window.addEventListener('scroll', handleScroll, true);
    window.addEventListener('resize', handleResize);
    setTimeout(() => inputRef.current?.focus(), 0);
    return () => {
      document.removeEventListener('mousedown', handleClickOutside);
      window.removeEventListener('blur', closeDropdown);
      window.removeEventListener('scroll', handleScroll, true);
      window.removeEventListener('resize', handleResize);
    };
  }, [isOpen]); // eslint-disable-line react-hooks/exhaustive-deps

  // Scroll highlighted item into view
  useEffect(() => {
    if (!isOpen || !listRef.current) return;
    const items = listRef.current.querySelectorAll('[data-option]');
    items[highlightedIndex]?.scrollIntoView({ block: 'nearest' });
  }, [highlightedIndex, isOpen]);

  const handleSelectOption = (option) => {
    onChange(String(getKey(option)), option);
    setIsOpen(false);
    setSearchTerm('');
    setHighlightedIndex(0);
    // Return focus to trigger
    setTimeout(() => triggerRef.current?.querySelector('[role="combobox"]')?.focus(), 0);
  };

  const handleClear = (e) => {
    e.stopPropagation();
    onChange('', null);
    setSearchTerm('');
  };

  // Trigger: Enter / Space / Arrow Down opens dropdown; typing a character
  // opens it with that character already in the search box.
  const handleTriggerKeyDown = (e) => {
    if (disabled) return;
    if (e.key === 'Enter' || e.key === ' ' || e.key === 'ArrowDown' || e.key === 'ArrowUp') {
      e.preventDefault();
      openDropdown();
    } else if ((e.key === 'Backspace' || e.key === 'Delete') && hasValue && clearable) {
      e.preventDefault();
      onChange('', null);
    } else if (e.key.length === 1 && !e.ctrlKey && !e.metaKey && !e.altKey) {
      e.preventDefault();
      openDropdown(e.key);
    }
  };

  // Search input: arrows navigate list, Enter selects, ESC closes, Tab closes
  const handleSearchKeyDown = (e) => {
    if (e.key === 'Escape') {
      e.preventDefault();
      e.stopPropagation(); // don't let a parent modal's ESC handler fire too
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
    } else if (e.key === 'Tab') {
      closeDropdown();
    }
  };

  const sizeClass = size === 'sm'
    ? 'px-2 py-[5px] text-[0.8rem] min-h-[30px]'
    : 'px-3 py-2 text-sm';

  const dropdown = isOpen && !disabled && createPortal(
    <div
      ref={dropdownRef}
      style={{
        position: 'absolute',
        top: dropdownPos.top,
        left: dropdownPos.left,
        width: Math.max(dropdownPos.width, 220),
        zIndex: 99999,
        transform: dropdownPos.openUp ? 'translateY(-100%)' : undefined,
      }}
      className="bg-white border border-slate-200 rounded-xl shadow-2xl"
    >
      <div className="p-2 border-b border-slate-100">
        <div className="flex items-center gap-2 px-3 py-1.5 border border-slate-300 rounded-full bg-white focus-within:border-blue-500 focus-within:ring-2 focus-within:ring-blue-100">
          <Search size={15} className="text-slate-400 shrink-0" />
          <input
            ref={inputRef}
            type="text"
            placeholder="Search..."
            value={searchTerm}
            onChange={handleSearchChange}
            onKeyDown={handleSearchKeyDown}
            className="w-full text-sm focus:outline-none bg-transparent"
          />
        </div>
      </div>

      <div ref={listRef} role="listbox" className="max-h-72 overflow-y-auto">
        {filteredOptions.length > 0 ? (
          <>
            {filteredOptions.map((option, idx) => {
              const optionKey = getKey(option);
              const isSelected = String(optionKey) === String(value);
              const isHighlighted = idx === highlightedIndex;
              return (
                <button
                  key={`${optionKey}-${idx}`}
                  data-option
                  role="option"
                  aria-selected={isSelected}
                  type="button"
                  onMouseDown={(e) => e.preventDefault()}
                  onClick={() => handleSelectOption(option)}
                  onMouseEnter={() => setHighlightedIndex(idx)}
                  className={`w-full text-left px-3 py-1.5 text-sm transition ${
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
            })}
            {truncated && (
              <div className="px-3 py-2 text-xs text-slate-500 border-t border-slate-100">
                Showing first {maxUnfiltered} of {allMatches.length}. Type to search.
              </div>
            )}
          </>
        ) : (
          <div className="px-4 py-6 text-center">
            <p className="text-sm font-semibold text-slate-700">{emptyText}</p>
            {term && (
              <p className="text-xs text-slate-400 mt-1">Try a different search term</p>
            )}
          </div>
        )}
      </div>
    </div>,
    document.body
  );

  return (
    <div ref={triggerRef} className={`relative w-full ${wrapperClassName}`} style={style}>
      <div
        id={id}
        role="combobox"
        tabIndex={disabled ? -1 : 0}
        aria-expanded={isOpen}
        aria-haspopup="listbox"
        aria-disabled={disabled || undefined}
        title={title || selectedLabel || undefined}
        onClick={() => (isOpen ? closeDropdown() : openDropdown())}
        onKeyDown={handleTriggerKeyDown}
        className={`flex items-center justify-between gap-1 border border-slate-300 rounded-md cursor-pointer transition focus:outline-none focus:ring-2 focus:ring-blue-200 focus:border-blue-500 ${sizeClass} ${
          disabled ? 'bg-slate-50 text-slate-500 cursor-not-allowed' : 'bg-white hover:border-slate-400'
        } ${isOpen ? 'border-blue-500 ring-2 ring-blue-200' : ''} ${className}`}
      >
        {selectedOption && renderSelected ? (
          renderSelected(selectedOption)
        ) : (
          <span className={`truncate ${selectedLabel ? 'text-slate-900' : 'text-slate-400'}`}>
            {selectedLabel || placeholder}
          </span>
        )}
        <div className="flex items-center gap-0.5 shrink-0">
          {hasValue && clearable && !disabled && (
            <button
              onClick={handleClear}
              className="p-0.5 hover:bg-slate-200 rounded"
              type="button"
              tabIndex={-1}
              aria-label="Clear selection"
              title="Clear"
            >
              <X size={14} className="text-slate-500" />
            </button>
          )}
          <ChevronDown size={16} className={`text-slate-400 transition ${isOpen ? 'rotate-180' : ''}`} />
        </div>
      </div>

      {dropdown}

      {/* Browsers skip validation on type="hidden", so for `required` we
          render a real, visually hidden text input that participates in the
          surrounding <form>'s native validation. */}
      {required && (
        <input
          tabIndex={-1}
          aria-hidden="true"
          name={name}
          value={hasValue ? String(value) : ''}
          onChange={() => {}}
          required
          onFocus={() => triggerRef.current?.querySelector('[role="combobox"]')?.focus()}
          style={{ position: 'absolute', opacity: 0, width: 1, height: 1, bottom: 0, left: 0, pointerEvents: 'none' }}
        />
      )}
      {!required && name && <input type="hidden" name={name} value={hasValue ? String(value) : ''} readOnly />}
    </div>
  );
}
