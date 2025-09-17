import React from 'react';
import { type DiarizationSegment, type SpeakerId } from '../types';

interface DiarizationDebugProps {
    segments: DiarizationSegment[];
    activeSpeaker: SpeakerId | null;
    isEnabled: boolean;
    hasStream?: boolean;
    liveVolume?: number;
}

export const DiarizationDebug: React.FC<DiarizationDebugProps> = ({ segments, activeSpeaker, isEnabled, hasStream, liveVolume }) => {
    if (!isEnabled) return null;

    const lastUpdated = segments.length > 0 ? new Date(Math.max(...segments.map(s => s.endMs || s.startMs))) : null;

    return (
        <div className="fixed bottom-4 left-4 bg-black/80 text-white p-3 rounded-lg text-xs w-80 z-50">
            <div className="flex items-center justify-between mb-2">
                <h3 className="font-bold">Diarization Debug</h3>
                <div className="text-[11px] text-slate-400">{lastUpdated ? `${lastUpdated.toLocaleTimeString()}` : 'no segments'}</div>
            </div>
            <div className="flex items-center gap-4">
                <div className="flex-1 text-[13px]">
                    <div><span className="text-slate-400">Active:</span> <span className="text-green-400">{activeSpeaker || 'None'}</span></div>
                    <div><span className="text-slate-400">Stream:</span> <span className="text-yellow-300">{hasStream ? 'connected' : 'none'}</span></div>
                    <div><span className="text-slate-400">Live Vol:</span> <span className="text-yellow-300">{typeof liveVolume === 'number' ? liveVolume.toFixed(2) : 'n/a'}</span></div>
                </div>
                <div className="w-28 text-right">
                    <div className="text-blue-400 font-semibold">{segments.length}</div>
                    <div className="text-slate-400 text-[11px]">segments</div>
                </div>
            </div>
            <div className="mt-2 max-h-28 overflow-y-auto text-[12px] text-slate-300">
                {segments.slice(-5).map((seg, i) => (
                    <div key={i} className="opacity-80 flex justify-between">
                        <div className="truncate">{seg.speakerId}</div>
                        <div className="text-slate-400">{seg.startMs} - {seg.endMs || '...'}</div>
                    </div>
                ))}
            </div>
        </div>
    );
};

export default DiarizationDebug;
