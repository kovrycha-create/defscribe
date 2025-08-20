import React from 'react';

const AnalyticsItemLoader: React.FC = () => {
    return (
        <div className="space-y-3">
            {[...Array(3)].map((_, i) => (
                <div key={i} className="flex items-start gap-3 bg-slate-800/50 p-3 rounded-lg">
                    <div className="w-5 h-5 skeleton-loader rounded-full mt-1"></div>
                    <div className="flex-1 space-y-2">
                        <div className="w-full h-3 skeleton-loader"></div>
                        <div className="w-3/4 h-3 skeleton-loader"></div>
                    </div>
                </div>
            ))}
        </div>
    );
};

export default AnalyticsItemLoader;
