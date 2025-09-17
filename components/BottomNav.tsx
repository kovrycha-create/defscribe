
import React from 'react';

type MobileTab = 'controls' | 'transcript' | 'analytics';

interface BottomNavProps {
  activeTab: MobileTab;
  onTabChange: (tab: MobileTab) => void;
  actionItemsCount: number;
  snippetsCount: number;
}

const NavButton: React.FC<{ icon: string; label: string; isActive: boolean; onClick: () => void; count?: number; }> = ({ icon, label, isActive, onClick, count }) => (
  <button
    onClick={onClick}
    aria-pressed={isActive}
    role="tab"
    className={`relative flex-1 flex flex-col items-center justify-center p-2 transition-all duration-150 touch-target ${isActive ? 'text-[var(--color-primary)]' : 'text-slate-400 hover:text-white'}`}
    aria-label={label}
  >
    <i className={`fas ${icon} text-2xl mb-1`} aria-hidden="true"></i>
    <span className="text-xs font-semibold">{label}</span>
    {isActive && <div className="w-1.5 h-1.5 bg-[var(--color-primary)] rounded-full mt-1 shadow-[0_0_4px_var(--color-primary)]" aria-hidden="true"></div>}
    {count && count > 0 ? (
        <span className="absolute top-1 right-4 text-[12px] bg-[var(--color-secondary)] text-white rounded-full h-5 w-5 flex items-center justify-center font-bold" aria-hidden="true">{count > 9 ? '9+' : count}</span>
    ) : null}
  </button>
);

const BottomNav: React.FC<BottomNavProps> = ({ activeTab, onTabChange, actionItemsCount, snippetsCount }) => {
  return (
    <nav aria-label="Main navigation" role="tablist" className="bottom-nav safe-bottom-pad sticky bottom-0 left-0 right-0 flex-shrink-0 w-full bg-[rgba(10,18,24,0.88)] border-t border-[rgba(var(--color-primary-rgb),0.2)] flex items-center justify-around backdrop-blur-md z-40">
      <NavButton icon="fa-sliders-h" label="Controls" isActive={activeTab === 'controls'} onClick={() => onTabChange('controls')} />
      <NavButton icon="fa-file-alt" label="Transcript" isActive={activeTab === 'transcript'} onClick={() => onTabChange('transcript')} />
      <NavButton icon="fa-chart-pie" label="Analytics" isActive={activeTab === 'analytics'} onClick={() => onTabChange('analytics')} count={actionItemsCount + snippetsCount} />
    </nav>
  );
};

export default BottomNav;
