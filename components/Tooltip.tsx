
import React, { useState, useRef } from 'react';
import { createPortal } from 'react-dom';

interface TooltipProps {
  children: React.ReactNode;
  content: React.ReactNode;
  contentClassName?: string;
}

const Tooltip: React.FC<TooltipProps> = ({ children, content, contentClassName = 'w-max whitespace-nowrap' }) => {
  const [visible, setVisible] = useState(false);
  const [pos, setPos] = useState({ x: 0, y: 0 });
  const tooltipRef = useRef<HTMLDivElement>(null);

  const handleMouseEnter = (e: React.MouseEvent) => {
    // Set initial position to avoid flicker at (0,0)
    setPos({ x: e.clientX, y: e.clientY });
    setVisible(true);
  };

  const handleMouseMove = (e: React.MouseEvent) => {
    if (!visible) return;
    
    let x = e.clientX + 15;
    let y = e.clientY - 15;

    if (tooltipRef.current) {
        const rect = tooltipRef.current.getBoundingClientRect();
        y = e.clientY - 15 - rect.height; // Position above cursor

        // Check viewport collision
        if (y < 0) {
            y = e.clientY + 25; // Move below if no space above
        }
        if (x + rect.width > window.innerWidth) {
            x = e.clientX - 15 - rect.width; // Move left if no space right
        }
         if (x < 0) {
            x = 15;
         }
    }

    setPos({ x, y });
  };

  const tooltipJsx = visible ? (
    <div
      ref={tooltipRef}
      className={`fixed ${contentClassName} bg-slate-800 text-white text-xs font-semibold rounded-md px-2 py-1 shadow-lg z-[250] pointer-events-none backdrop-blur-sm bg-opacity-80`}
      style={{
        top: `${pos.y}px`,
        left: `${pos.x}px`,
      }}
    >
      {content}
    </div>
  ) : null;

  return (
    <div
      className="flex items-center"
      onMouseEnter={handleMouseEnter}
      onMouseLeave={() => setVisible(false)}
      onMouseMove={handleMouseMove}
    >
      {children}
      {tooltipJsx && createPortal(tooltipJsx, document.body)}
    </div>
  );
};

export default Tooltip;
