import React, { useState, useRef, useEffect } from 'react';

interface CustomSelectProps {
  options: string[];
  value: string;
  onChange: (value: string) => void;
  label: string;
  onOpenChange?: (isOpen: boolean) => void;
}

const CustomSelect: React.FC<CustomSelectProps> = ({ options, value, onChange, label, onOpenChange }) => {
  const [isOpen, setIsOpen] = useState(false);
  const wrapperRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    onOpenChange?.(isOpen);
  }, [isOpen, onOpenChange]);

  useEffect(() => {
    const handleClickOutside = (event: MouseEvent) => {
      if (wrapperRef.current && !wrapperRef.current.contains(event.target as Node)) {
        setIsOpen(false);
      }
    };
    document.addEventListener('mousedown', handleClickOutside);
    return () => document.removeEventListener('mousedown', handleClickOutside);
  }, []);

  const handleSelect = (option: string) => {
    onChange(option);
    setIsOpen(false);
  };

  return (
    <div className="relative" ref={wrapperRef}>
      <label id="custom-select-label" className="text-sm font-medium text-slate-400 sr-only">{label}</label>
      <button
        type="button"
        className="cosmo-input w-full flex items-center justify-between rounded-md text-sm p-2 text-left"
        onClick={() => setIsOpen(!isOpen)}
        aria-haspopup="listbox"
        aria-expanded={isOpen}
        aria-labelledby="custom-select-label"
      >
        <span>{value}</span>
        <i className={`fas fa-chevron-down transition-transform duration-200 ${isOpen ? 'rotate-180' : ''}`}></i>
      </button>
      {isOpen && (
        <ul
          className="absolute z-20 bottom-full mb-2 w-full bg-slate-900 border border-slate-700 rounded-md shadow-lg max-h-60 overflow-y-auto animate-[fadeIn_0.1s_ease-out]"
          role="listbox"
        >
          {options.map((option) => (
            <li
              key={option}
              className={`px-3 py-2 text-sm cursor-pointer hover:bg-slate-700/50 transition-colors ${value === option ? 'text-[var(--color-primary)] font-semibold' : 'text-slate-200'}`}
              onClick={() => handleSelect(option)}
              role="option"
              aria-selected={value === option}
            >
              {option}
            </li>
          ))}
        </ul>
      )}
    </div>
  );
};

export default CustomSelect;
