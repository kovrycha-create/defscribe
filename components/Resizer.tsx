import React, { useCallback } from 'react';
import Tooltip from './Tooltip';

interface ResizerProps {
  onDrag: (deltaX: number) => void;
  onDoubleClick: () => void;
  onCtrlClick: () => void;
  isPanelCollapsed?: boolean;
}

const Resizer: React.FC<ResizerProps> = ({ onDrag, onDoubleClick, onCtrlClick, isPanelCollapsed }) => {
  const handleMouseDown = useCallback((e: React.MouseEvent<HTMLDivElement>) => {
    e.preventDefault();

    if (e.ctrlKey || e.metaKey) {
      onCtrlClick();
      return;
    }

    let lastX = e.clientX;
    document.body.classList.add('resizing-panels');

    const handleMouseMove = (moveEvent: MouseEvent) => {
      const deltaX = moveEvent.clientX - lastX;
      onDrag(deltaX);
      lastX = moveEvent.clientX;
    };

    const handleMouseUp = () => {
      document.body.classList.remove('resizing-panels');
      window.removeEventListener('mousemove', handleMouseMove);
      window.removeEventListener('mouseup', handleMouseUp);
    };

    window.addEventListener('mousemove', handleMouseMove);
    window.addEventListener('mouseup', handleMouseUp);
  }, [onDrag, onCtrlClick]);
  
  const tooltipContent = isPanelCollapsed
    ? "Ctrl+click or double-click to expand"
    : "Drag to resize | Double-click to reset | Ctrl+click to collapse";

  const tooltipJsx = (
      <div className="text-center p-1">
          {tooltipContent.split(' | ').map(line => <div key={line}>{line}</div>)}
      </div>
  );

  return (
    <Tooltip content={tooltipJsx} contentClassName="w-max">
        <div
          className="vertical-resizer"
          onMouseDown={handleMouseDown}
          onDoubleClick={onDoubleClick}
          role="separator"
          aria-orientation="vertical"
          aria-label="Resizable panel separator"
        />
    </Tooltip>
  );
};

export default Resizer;
