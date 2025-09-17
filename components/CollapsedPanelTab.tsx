import React from 'react';
import Tooltip from './Tooltip';

interface CollapsedPanelTabProps {
  title: string;
  icon: string;
  onClick: () => void;
}

const CollapsedPanelTab: React.FC<CollapsedPanelTabProps> = ({ title, icon, onClick }) => {
  return (
    <Tooltip content={title}>
      <button
        className="collapsed-panel-tab p-2 rounded-r-lg bg-slate-900/60 hover:bg-slate-800/60 border-l border-slate-700 text-slate-200"
        onClick={onClick}
        aria-label={`Restore ${title} panel`}
        title={title}
      >
        <i className={`fas ${icon} collapsed-icon text-lg`} aria-hidden="true"></i>
      </button>
    </Tooltip>
  );
};

export default CollapsedPanelTab;
