

import React, { useState, useRef, useEffect } from 'react';
import { createPortal } from 'react-dom';

interface CustomSelectProps {
  options: string[];
  value: string;
  onChange: (value: string) => void;
  label: string;
}

const CustomSelect: React.FC<CustomSelectProps> = ({ options, value, onChange, label }) => {
  const [isOpen, setIsOpen] = useState(false);
  const wrapperRef = useRef<HTMLDivElement>(null);
  const buttonRef = useRef<HTMLButtonElement>(null);
  const dropdownRef = useRef<HTMLUListElement>(null);
  const [dropdownStyle, setDropdownStyle] = useState<React.CSSProperties>({});

  useEffect(() => {
    if (isOpen && buttonRef.current) {
      const rect = buttonRef.current.getBoundingClientRect();
      setDropdownStyle({
        position: 'fixed',
        bottom: `${window.innerHeight - rect.top + 8}px`,
        left: `${rect.left}px`,
        width: `${rect.width}px`,
        zIndex: 100,
      });
    }
  }, [isOpen]);

  useEffect(() => {
    const handleClickOutside = (event: MouseEvent) => {
      if (
        isOpen &&
        wrapperRef.current && !wrapperRef.current.contains(event.target as Node) &&
        dropdownRef.current && !dropdownRef.current.contains(event.target as Node)
      ) {
        setIsOpen(false);
      }
    };
    document.addEventListener('mousedown', handleClickOutside);
    return () => document.removeEventListener('mousedown', handleClickOutside);
  }, [isOpen]);

  const handleSelect = (option: string) => {
    onChange(option);
    setIsOpen(false);
  };

  const dropdownList = (
    <ul
      ref={dropdownRef}
      className="z-[100] bg-slate-900 border border-slate-700 rounded-md shadow-lg max-h-60 overflow-y-auto animate-[fadeIn_0.1s_ease-out]"
      style={dropdownStyle}
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
  );

  return (
    <div className="relative" ref={wrapperRef}>
      <label id="custom-select-label" className="text-sm font-medium text-slate-400 sr-only">{label}</label>
      <button
        ref={buttonRef}
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
      {isOpen && createPortal(dropdownList, document.body)}
    </div>
  );
};

export default CustomSelect;