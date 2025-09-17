import React from 'react';
import { type Session } from '../types';
import { useFocusTrap } from '../hooks/useFocusTrap';

interface HistoryModalProps {
  isOpen: boolean;
  onClose: () => void;
  sessions: Session[];
  onLoad: (sessionId: string) => void;
  onDelete: (sessionId: string) => void;
}

const HistoryModal: React.FC<HistoryModalProps> = ({ isOpen, onClose, sessions, onLoad, onDelete }) => {
    const modalRef = React.useRef<HTMLDivElement>(null);
    useFocusTrap(modalRef, isOpen);
    
    if (!isOpen) return null;

    return (
        <div className="fixed inset-0 bg-black/60 z-[100] flex items-center justify-center p-4 animate-[fadeIn_0.2s_ease-out]" onClick={onClose}>
            <div
                ref={modalRef}
                className="cosmo-panel rounded-xl shadow-2xl p-6 w-full max-w-lg flex flex-col max-h-[80vh]"
                onClick={e => e.stopPropagation()}
                role="dialog"
                aria-modal="true"
                aria-labelledby="history-title"
            >
                <header className="flex-shrink-0 flex items-center justify-between pb-4 border-b border-[rgba(var(--color-primary-rgb),0.2)]">
                    <h2 id="history-title" className="text-xl font-bold">Session History</h2>
                    <button onClick={onClose} className="w-8 h-8 flex items-center justify-center text-slate-400 hover:text-white transition-colors">
                        <i className="fas fa-times"></i>
                    </button>
                </header>

                <div className="flex-1 overflow-y-auto mt-4 pr-2">
                    {sessions.length === 0 ? (
                        <div className="text-center text-slate-400 p-8">
                            <i className="fas fa-history text-4xl mb-3"></i>
                            <p>No saved sessions yet.</p>
                            <p className="text-sm">Your sessions will be saved here automatically when you clear them.</p>
                        </div>
                    ) : (
                        <ul className="space-y-3">
                            {sessions.map(session => (
                                <li key={session.id} className="bg-slate-800/50 rounded-lg p-3 flex items-center gap-4 transition-colors hover:bg-slate-700/50">
                                    <div className="flex-1">
                                        <p className="font-semibold text-white truncate">{session.title}</p>
                                        <p className="text-xs text-slate-400">{new Date(session.timestamp).toLocaleString()}</p>
                                    </div>
                                    <div className="flex-shrink-0 flex items-center gap-2">
                                        <button onClick={() => onLoad(session.id)} className="cosmo-button h-9 px-4 text-sm font-semibold">Load</button>
                                        <button onClick={() => onDelete(session.id)} className="h-9 w-9 cosmo-button hover:bg-red-500/50 hover:border-red-500 text-slate-300">
                                            <i className="fas fa-trash-alt"></i>
                                        </button>
                                    </div>
                                </li>
                            ))}
                        </ul>
                    )}
                </div>
            </div>
        </div>
    );
};

export default HistoryModal;
