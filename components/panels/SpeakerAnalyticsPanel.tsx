import React, { useMemo, useState } from 'react';
import { BarChart, Bar, RadarChart, PolarGrid, PolarAngleAxis, PolarRadiusAxis, Radar, PieChart, Pie, Cell, XAxis, YAxis, CartesianGrid, Tooltip, Legend, ResponsiveContainer, Area, AreaChart } from 'recharts';

interface SpeakerProfile {
  id: string;
  label: string;
  color: string;
}

interface DiarizationSegment {
  speakerId: string;
  startMs: number;
  endMs: number;
}

interface SpeakerStats {
  averagePitch: number;
  pitchVariance: number;
  speakingRate: number;
  energyLevel: number;
  confidence: number;
  sampleCount: number;
  lastActive: number;
}

interface Props {
  segments: DiarizationSegment[];
  speakerProfiles: Record<string, SpeakerProfile>;
  speakerStats: Record<string, SpeakerStats>;
  isListening: boolean;
  recordingDuration: number;
}

const CHART_COLORS = ['#4d8aff', '#ff6b6b', '#4ecdc4', '#ffd93d', '#95e1d3', '#ff9ff3'];

const SpeakerAnalyticsPanel: React.FC<Props> = ({ segments, speakerProfiles, speakerStats, isListening, recordingDuration }) => {
  const [selectedMetric, setSelectedMetric] = useState<'pitch' | 'energy' | 'pace'>('pitch');

  const talkTimeData = useMemo(() => {
    const talkTimes: Record<string, number> = {};
    segments.forEach(segment => {
      const duration = (segment.endMs || segment.startMs) - segment.startMs;
      talkTimes[segment.speakerId] = (talkTimes[segment.speakerId] || 0) + duration;
    });
    return Object.entries(talkTimes).map(([speakerId, time], index) => ({
      name: speakerProfiles[speakerId]?.label || speakerId,
      value: Math.round(time / 1000),
      percentage: recordingDuration > 0 ? Math.round((time / (recordingDuration * 1000)) * 100) : 0,
      fill: CHART_COLORS[index % CHART_COLORS.length]
    }));
  }, [segments, speakerProfiles, recordingDuration]);

  const timelineData = useMemo(() => {
    if (segments.length === 0) return [];
    const interval = 1000;
    const maxTime = segments[segments.length - 1]?.endMs || 0;
    const dataPoints: any[] = [];
    for (let time = 0; time <= maxTime; time += interval) {
      const activeSpeaker = segments.find(seg => seg.startMs <= time && (seg.endMs || seg.startMs) >= time);
      const point: any = { time: time / 1000 };
      if (activeSpeaker) {
        point[activeSpeaker.speakerId] = 1;
        point.speaker = speakerProfiles[activeSpeaker.speakerId]?.label || activeSpeaker.speakerId;
      }
      dataPoints.push(point);
    }
    return dataPoints;
  }, [segments, speakerProfiles]);

  const radarData = useMemo(() => {
    const characteristics = ['Pitch', 'Energy', 'Pace', 'Clarity', 'Confidence'];
    return characteristics.map(metric => {
      const dataPoint: any = { metric };
      Object.entries(speakerStats).forEach(([speakerId, stats]) => {
        let value = 0;
        switch (metric) {
          case 'Pitch':
            value = Math.min(100, (stats.averagePitch / 500) * 100);
            break;
          case 'Energy':
            value = Math.min(100, stats.energyLevel * 100);
            break;
          case 'Pace':
            value = Math.min(100, (stats.speakingRate / 200) * 100);
            break;
          case 'Clarity':
            value = Math.min(100, 100 - stats.pitchVariance);
            break;
          case 'Confidence':
            value = Math.min(100, stats.confidence * 100);
            break;
        }
        dataPoint[speakerId] = Math.round(value);
      });
      return dataPoint;
    });
  }, [speakerStats]);

  const comparisonData = useMemo(() => {
    return Object.entries(speakerStats).map(([speakerId, stats], index) => ({
      speaker: speakerProfiles[speakerId]?.label || speakerId,
      pitch: Math.round(stats.averagePitch),
      variance: Math.round(stats.pitchVariance),
      energy: Math.round(stats.energyLevel * 100),
      pace: Math.round(stats.speakingRate),
      samples: stats.sampleCount,
      color: CHART_COLORS[index % CHART_COLORS.length]
    }));
  }, [speakerStats, speakerProfiles]);

  const interactionMatrix = useMemo(() => {
    const matrix: Record<string, Record<string, number>> = {};
    for (let i = 1; i < segments.length; i++) {
      const prevSpeaker = segments[i - 1].speakerId;
      const currSpeaker = segments[i].speakerId;
      if (!matrix[prevSpeaker]) matrix[prevSpeaker] = {};
      matrix[prevSpeaker][currSpeaker] = (matrix[prevSpeaker][currSpeaker] || 0) + 1;
    }
    return matrix;
  }, [segments]);

  const hasData = segments.length > 0 && Object.keys(speakerStats).length > 0;

  if (!hasData && !isListening) {
    return (
      <div className="h-full flex items-center justify-center p-4">
        <div className="text-center text-slate-400">
          <i className="fas fa-users text-4xl mb-4 opacity-50"></i>
          <p>Start recording to see speaker analytics</p>
        </div>
      </div>
    );
  }

  return (
    <div className="h-full overflow-y-auto p-4 space-y-4 bg-slate-900">
      <div className="bg-slate-800/50 rounded-lg p-4 border border-slate-700">
        <h3 className="text-lg font-bold text-white mb-2 flex items-center gap-2">
          <i className="fas fa-microphone-alt text-blue-400"></i>
          Speaker Detection Analytics
        </h3>
        <div className="flex items-center gap-4 text-sm">
          <div className="flex items-center gap-2">
            <span className="text-slate-400">Speakers Detected:</span>
            <span className="text-white font-semibold">{Object.keys(speakerStats).length}</span>
          </div>
          <div className="flex items-center gap-2">
            <span className="text-slate-400">Total Segments:</span>
            <span className="text-white font-semibold">{segments.length}</span>
          </div>
          {isListening && (
            <div className="flex items-center gap-2 ml-auto">
              <div className="w-2 h-2 bg-green-500 rounded-full animate-pulse"></div>
              <span className="text-green-400 text-xs">Live Analysis</span>
            </div>
          )}
        </div>
      </div>

      <div className="bg-slate-800/50 rounded-lg p-4 border border-slate-700">
        <h4 className="text-sm font-semibold text-white mb-3">Talk Time Distribution</h4>
        <ResponsiveContainer width="100%" height={200}>
          <PieChart>
            <Pie data={talkTimeData} cx="50%" cy="50%" labelLine={false} label={({ name, percentage }) => `${name}: ${percentage}%`} outerRadius={70} fill="#8884d8" dataKey="value">
              {talkTimeData.map((entry, index) => (<Cell key={`cell-${index}`} fill={entry.fill} />))}
            </Pie>
            <Tooltip formatter={(value: any) => `${value}s`} />
          </PieChart>
        </ResponsiveContainer>
      </div>

      <div className="bg-slate-800/50 rounded-lg p-4 border border-slate-700">
        <h4 className="text-sm font-semibold text-white mb-3">Speaker Characteristics</h4>
        <ResponsiveContainer width="100%" height={250}>
          <RadarChart data={radarData}>
            <PolarGrid stroke="#475569" />
            <PolarAngleAxis dataKey="metric" tick={{ fill: '#94a3b8', fontSize: 11 }} />
            <PolarRadiusAxis angle={90} domain={[0, 100]} tick={{ fill: '#64748b', fontSize: 10 }} />
            {Object.keys(speakerStats).map((speakerId, index) => (
              <Radar key={speakerId} name={speakerProfiles[speakerId]?.label || speakerId} dataKey={speakerId} stroke={CHART_COLORS[index % CHART_COLORS.length]} fill={CHART_COLORS[index % CHART_COLORS.length]} fillOpacity={0.3} />
            ))}
            <Tooltip />
            <Legend />
          </RadarChart>
        </ResponsiveContainer>
      </div>

      <div className="bg-slate-800/50 rounded-lg p-4 border border-slate-700">
        <div className="flex justify-between items-center mb-3">
          <h4 className="text-sm font-semibold text-white">Speech Patterns</h4>
          <div className="flex gap-1">
            {(['pitch', 'energy', 'pace'] as const).map(metric => (
              <button key={metric} onClick={() => setSelectedMetric(metric)} className={`px-2 py-1 text-xs rounded transition-colors ${selectedMetric === metric ? 'bg-blue-500 text-white' : 'bg-slate-700 text-slate-400 hover:bg-slate-600'}`}>
                {metric.charAt(0).toUpperCase() + metric.slice(1)}
              </button>
            ))}
          </div>
        </div>
        <ResponsiveContainer width="100%" height={200}>
          <BarChart data={comparisonData}>
            <CartesianGrid strokeDasharray="3 3" stroke="#475569" />
            <XAxis dataKey="speaker" tick={{ fill: '#94a3b8', fontSize: 11 }} />
            <YAxis tick={{ fill: '#94a3b8', fontSize: 11 }} />
            <Tooltip />
            <Bar dataKey={selectedMetric === 'pitch' ? 'pitch' : selectedMetric === 'energy' ? 'energy' : 'pace'} fill="#4d8aff">
              {comparisonData.map((entry, index) => (<Cell key={`cell-${index}`} fill={entry.color} />))}
            </Bar>
          </BarChart>
        </ResponsiveContainer>
      </div>

      <div className="bg-slate-800/50 rounded-lg p-4 border border-slate-700">
        <h4 className="text-sm font-semibold text-white mb-3">Speaker Timeline</h4>
        <ResponsiveContainer width="100%" height={150}>
          <AreaChart data={timelineData}>
            <CartesianGrid strokeDasharray="3 3" stroke="#475569" />
            <XAxis dataKey="time" tick={{ fill: '#94a3b8', fontSize: 11 }} label={{ value: 'Time (s)', position: 'insideBottom', offset: -5, style: { fill: '#64748b', fontSize: 10 } }} />
            <YAxis domain={[0, Object.keys(speakerProfiles).length + 1]} ticks={Object.keys(speakerProfiles).map((_, i) => i + 1)} tick={{ fill: '#94a3b8', fontSize: 11 }} tickFormatter={(value) => { const speakers = Object.values(speakerProfiles); return speakers[value - 1]?.label || ''; }} />
            <Tooltip content={({ payload }) => { if (payload && payload[0]) { const data = payload[0].payload; return (<div className="bg-slate-800 p-2 rounded border border-slate-600"><p className="text-white text-xs">{data.speaker || 'Silence'} @ {data.time}s</p></div>); } return null; }} />
            {Object.keys(speakerProfiles).map((speakerId, index) => (
              <Area key={speakerId} type="stepAfter" dataKey={speakerId} stroke={CHART_COLORS[index % CHART_COLORS.length]} fill={CHART_COLORS[index % CHART_COLORS.length]} fillOpacity={0.6} />
            ))}
          </AreaChart>
        </ResponsiveContainer>
      </div>

      <div className="bg-slate-800/50 rounded-lg p-4 border border-slate-700">
        <h4 className="text-sm font-semibold text-white mb-3">Interaction Flow</h4>
        <div className="space-y-2">
          {Object.entries(interactionMatrix).map(([fromSpeaker, toSpeakers]) => (
            <div key={fromSpeaker} className="flex items-center gap-2">
              <span className="text-xs text-slate-400 w-16 text-right">{speakerProfiles[fromSpeaker]?.label || fromSpeaker}</span>
              <div className="flex gap-1 flex-1">
                {Object.entries(toSpeakers).map(([toSpeaker, count]) => (
                  <div key={toSpeaker} className="flex items-center gap-1 bg-slate-700 px-2 py-1 rounded text-xs">
                    <i className="fas fa-arrow-right text-slate-500 text-[10px]"></i>
                    <span className="text-white">{speakerProfiles[toSpeaker]?.label || toSpeaker}</span>
                    <span className="text-slate-400">({count})</span>
                  </div>
                ))}
              </div>
            </div>
          ))}
        </div>
      </div>

      {isListening && Object.keys(speakerStats).length > 0 && (
        <div className="bg-slate-800/50 rounded-lg p-4 border border-slate-700">
          <h4 className="text-sm font-semibold text-white mb-3">Live Speaker Status</h4>
          <div className="grid grid-cols-2 gap-2">
            {Object.entries(speakerStats).map(([speakerId, stats]) => {
              const isRecent = Date.now() - stats.lastActive < 5000;
              return (
                <div key={speakerId} className={`p-2 rounded border ${isRecent ? 'bg-green-500/10 border-green-500/50' : 'bg-slate-700/50 border-slate-600'}`}>
                  <div className="flex items-center justify-between">
                    <span className="text-xs font-medium text-white">{speakerProfiles[speakerId]?.label || speakerId}</span>
                    {isRecent && (<div className="w-2 h-2 bg-green-500 rounded-full animate-pulse"></div>)}
                  </div>
                  <div className="mt-1 text-[10px] text-slate-400">Confidence: {Math.round(stats.confidence * 100)}%</div>
                </div>
              );
            })}
          </div>
        </div>
      )}

      <div className="bg-slate-800/50 rounded-lg p-3 border border-slate-700">
        <div className="flex items-center justify-between">
          <span className="text-xs text-slate-400">Detection Quality</span>
          <div className="flex items-center gap-2">
            <div className="w-24 h-2 bg-slate-700 rounded-full overflow-hidden">
              <div className="h-full bg-gradient-to-r from-red-500 via-yellow-500 to-green-500 transition-all" style={{ width: `${Math.min(100, Object.keys(speakerStats).length > 0 ? Object.values(speakerStats).reduce((acc, s) => acc + s.confidence, 0) / Object.keys(speakerStats).length * 100 : 0)}%` }} />
            </div>
            <span className="text-xs text-white">{Object.keys(speakerStats).length > 0 ? `${Math.round(Object.values(speakerStats).reduce((acc, s) => acc + s.confidence, 0) / Object.keys(speakerStats).length * 100)}%` : 'N/A'}</span>
          </div>
        </div>
      </div>
    </div>
  );
};

export default SpeakerAnalyticsPanel;
