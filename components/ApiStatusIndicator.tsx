
import React from 'react';
import Tooltip from './Tooltip';

export type ApiStatus = 'checking' | 'ok' | 'error';

interface ApiStatusIndicatorProps {
  apiStatus: ApiStatus;
  userApiKey: string | null;
}

const ApiStatusIndicator: React.FC<ApiStatusIndicatorProps> = ({ apiStatus, userApiKey }) => {
    const statusInfo = React.useMemo(() => {
        if (userApiKey) {
            return {
                colorClass: 'bg-teal-400',
                animationClass: 'animate-[status-glow-teal_2s_ease-in-out_infinite]',
                tooltip: 'Connected using your personal API key.',
            };
        }
        
        if (apiStatus === 'error') {
            return {
                colorClass: 'bg-red-500',
                animationClass: 'animate-[status-glow-red_2s_ease-in-out_infinite]',
                tooltip: 'API key not configured. Please add your own key in Settings.',
            };
        }

        return {
            colorClass: 'bg-yellow-500',
            animationClass: 'animate-[status-glow-yellow_2s_ease-in-out_infinite]',
            tooltip: 'Checking API status...',
        };
    }, [apiStatus, userApiKey]);

    return (
        <div className="relative flex items-center justify-center">
            <Tooltip text={statusInfo.tooltip} position="left">
                <div className={`w-4 h-4 rounded-full ${statusInfo.colorClass} ${statusInfo.animationClass}`} />
            </Tooltip>
        </div>
    );
};

export default ApiStatusIndicator;
