
import React from 'react';
import Tooltip from './Tooltip';

interface ViewSwitcherProps {
  viewModeOverride: 'desktop' | 'mobile' | null;
  setViewModeOverride: (mode: 'desktop' | 'mobile' | null) => void;
}

const ViewSwitcher: React.FC<ViewSwitcherProps> = ({ viewModeOverride, setViewModeOverride }) => {
  const isMobileView = viewModeOverride === 'mobile';

  const handleClick = () => {
    if (isMobileView) {
      setViewModeOverride(null);
    } else {
      setViewModeOverride('mobile');
    }
  };

  const tooltipText = isMobileView ? 'Switch to Desktop View' : 'Switch to Mobile View';
  const icon = isMobileView ? 'fa-desktop' : 'fa-mobile-alt';

  return (
    <Tooltip content={tooltipText}>
      <button
        onClick={handleClick}
        className="w-8 h-8 rounded-full bg-slate-700/50 text-slate-300 hover:bg-slate-700/80 transition-colors flex items-center justify-center shadow-lg"
        aria-label={tooltipText}
      >
        <i className={`fas ${icon}`}></i>
      </button>
    </Tooltip>
  );
};

export default ViewSwitcher;
