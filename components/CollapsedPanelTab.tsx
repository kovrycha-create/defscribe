import React from 'react';

interface CollapsedPanelTabProps {
  title: string;
  icon: string;
  onClick: () => void;
}

const CollapsedPanelTab: React.FC<CollapsedPanelTabProps> = ({ title, icon, onClick }) => {
  return (
    <div
      className="collapsed-panel-tab"
      onClick={onClick}
      role="button"
      tabIndex={0}
      onKeyDown={(e) => { if (e.key === 'Enter' || e.key === ' ') onClick(); }}
      aria-label={`Restore ${title} panel`}
    >
      <i className={`fas ${icon} collapsed-icon`}></i>
      <span className="collapsed-text">{title}</span>
    </div>
  );
};

export default CollapsedPanelTab;
