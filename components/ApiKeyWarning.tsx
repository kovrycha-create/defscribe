import React, { useState, useEffect } from 'react';

interface ApiKeyWarningProps {
    onClose: () => void;
}

const ApiKeyWarning: React.FC<ApiKeyWarningProps> = ({ onClose }) => {
    const [visible, setVisible] = useState(false);

    useEffect(() => {
        const fadeInTimer = setTimeout(() => setVisible(true), 100);
        return () => clearTimeout(fadeInTimer);
    }, []);
    
    const handleClose = () => {
        setVisible(false);
        setTimeout(onClose, 500);
    };

    return (
        <div 
            className={`fixed top-4 left-1/2 -translate-x-1/2 z-[200] w-full max-w-lg transition-all duration-500 ease-in-out ${visible ? 'opacity-100 translate-y-0' : 'opacity-0 -translate-y-full'}`}
            role="alert"
        >
            <div className="cosmo-panel rounded-xl shadow-2xl p-4 flex items-start gap-4 border-l-4 border-amber-400">
                 <i className="fas fa-key text-xl text-amber-400 mt-1 flex-shrink-0"></i>
                 <div className="flex-1">
                    <h2 className="font-bold text-white">API Key Required</h2>
                    <p className="text-sm text-slate-300">
                       This application requires a Google Gemini API key to use its AI features. Please go to the settings panel to add your own key.
                    </p>
                 </div>
                 <button onClick={handleClose} className="text-slate-400 hover:text-white transition-colors">
                    <i className="fas fa-times"></i>
                 </button>
            </div>
        </div>
    );
};

export default ApiKeyWarning;
