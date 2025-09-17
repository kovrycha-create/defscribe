import React, { useMemo, useState } from 'react';
import {
  BarChart,
  Bar,
  RadarChart,
  PolarGrid,
  PolarAngleAxis,
  PolarRadiusAxis,
  Radar,
  PieChart,
  Pie,
  Cell,
  XAxis,
  YAxis,
  CartesianGrid,
  Tooltip,
  Legend,
  ResponsiveContainer,
  Area,
  AreaChart
} from 'recharts';

interface SpeakerProfile {
  id: string;
  label?: string;
  color?: string;
}

interface DiarizationSegment {
  speakerId: string;
  startMs: number;
  endMs?: number | null;
}

interface SpeakerStats {
  averagePitch: number; // Hz
  pitchVariance: number; // 0-100
  speakingRate: number; // words/min
  energyLevel: number; // 0-1
  confidence: number; // 0-1
  sampleCount: number;
  lastActive: number; // timestamp ms
}

interface Props {
  segments?: DiarizationSegment[];
  speakerProfiles?: Record<string, SpeakerProfile>;
  speakerStats?: Record<string, SpeakerStats>;
  isListening?: boolean;
}

const DEFAULT_COLORS = ['#4d8aff', '#ff6b6b', '#4ecdc4', '#ffd93d', '#95e1d3', '#ff9ff3'];

/**
 * SpeakerAnalyticsPanel
 * - Defensive and accessible speaker analytics UI
 * - Shows talk-time pie, radar of characteristics, comparison bar, timeline, interaction flow, and live status
 */
const SpeakerAnalyticsPanel: React.FC<Props> = ({
  segments = [],
  speakerProfiles = {},
  speakerStats = {},
  isListening = false
}) => {
  const [selectedMetric, setSelectedMetric] = useState<'pitch' | 'energy' | 'pace'>('pitch');

  // derive ordered list of speaker ids for stable color mapping
  const speakerIds = useMemo(() => {
    const ids = Array.from(new Set([...Object.keys(speakerProfiles), ...Object.keys(speakerStats), ...segments.map(s => s.speakerId)]));
    return ids;
  }, [speakerProfiles, speakerStats, segments]);

  const getColor = (index: number) => speakerProfiles[speakerIds[index]]?.color || DEFAULT_COLORS[index % DEFAULT_COLORS.length];

  // Talk time per speaker (ms)
  const talkTimeData = useMemo(() => {
    const map = new Map<string, number>();
    for (const seg of segments) {
      const end = typeof seg.endMs === 'number' ? Math.max(seg.endMs, seg.startMs) : seg.startMs;
      const dur = Math.max(0, end - seg.startMs);
      map.set(seg.speakerId, (map.get(seg.speakerId) || 0) + dur);
    }
    const totalMs = Array.from(map.values()).reduce((a, b) => a + b, 0);
    return Array.from(map.entries()).map(([speakerId, ms], idx) => ({
      id: speakerId,
      name: speakerProfiles[speakerId]?.label || `Speaker ${speakerId}`,
      value: Math.round(ms / 1000),
      percentage: totalMs > 0 ? +(ms / totalMs * 100).toFixed(1) : 0,
      fill: getColor(idx)
    }));
  }, [segments, speakerProfiles, speakerIds]);

  // Timeline: bucket segments into second-by-second timeline with speaker id or null
  const timelineData = useMemo(() => {
    if (segments.length === 0) return [];
    const maxEnd = segments.reduce((max, s) => Math.max(max, (s.endMs ?? s.startMs)), 0);
    const interval = 1000; // 1s buckets
    const buckets: any[] = [];
    for (let t = 0; t <= maxEnd; t += interval) {
      const sec = Math.round(t / 1000);
      const active = segments.find(s => s.startMs <= t && (s.endMs ?? s.startMs) > t);
      const point: any = { time: sec };
      if (active) point[active.speakerId] = 1;
      buckets.push(point);
    }
    return buckets;
  }, [segments]);

  // Radar data: normalize metrics to 0..100
  const radarData = useMemo(() => {
    const metrics = ['Pitch', 'Energy', 'Pace', 'Clarity', 'Confidence'];
    return metrics.map(metric => {
      const row: any = { metric };
      for (const id of speakerIds) {
        const s = speakerStats[id];
        let value = 0;
        if (s) {
          switch (metric) {
            case 'Pitch':
              // assume human pitch 75-400Hz, map to 0-100
              value = Math.max(0, Math.min(100, ((s.averagePitch - 75) / (400 - 75)) * 100));
              break;
            case 'Energy':
              value = Math.max(0, Math.min(100, s.energyLevel * 100));
              break;
            case 'Pace':
              // speakingRate roughly 100-200 wpm -> normalize
              value = Math.max(0, Math.min(100, ((s.speakingRate - 80) / (220 - 80)) * 100));
              break;
            case 'Clarity':
              value = Math.max(0, Math.min(100, 100 - s.pitchVariance));
              break;
            case 'Confidence':
              value = Math.max(0, Math.min(100, s.confidence * 100));
              break;
          }
        }
        row[id] = Math.round(value);
      }
      return row;
    });
  }, [speakerStats, speakerIds]);

  // Comparison data for bar chart
  const comparisonData = useMemo(() => {
    return speakerIds.map((id, idx) => {
      const s = speakerStats[id];
      return {
        speaker: speakerProfiles[id]?.label || `Speaker ${id}`,
        pitch: Math.round(s?.averagePitch ?? 0),
        variance: Math.round(s?.pitchVariance ?? 0),
        energy: Math.round((s?.energyLevel ?? 0) * 100),
        pace: Math.round(s?.speakingRate ?? 0),
        samples: s?.sampleCount ?? 0,
        color: getColor(idx),
        id
      };
    });
  }, [speakerIds, speakerProfiles, speakerStats]);

  // Interaction matrix
  const interactionMatrix = useMemo(() => {
    const m: Record<string, Record<string, number>> = {};
    for (let i = 1; i < segments.length; i++) {
      const prev = segments[i - 1].speakerId;
      const curr = segments[i].speakerId;
      if (!m[prev]) m[prev] = {};
      m[prev][curr] = (m[prev][curr] || 0) + 1;
    }
    return m;
  }, [segments]);

  const hasData = segments.length > 0 && Object.keys(speakerStats).length > 0;

  // Small helper for accessible empty / loading states
  if (!hasData && !isListening) {
    return (
      <section aria-labelledby="speaker-analytics-heading" className="h-full flex items-center justify-center p-4">
        <div className="text-center text-slate-400 max-w-xs">
          <svg aria-hidden className="mx-auto mb-3 h-12 w-12 text-slate-500" viewBox="0 0 24 24" fill="none">
            <path d="M12 3v4" stroke="currentColor" strokeWidth={1.5} strokeLinecap="round" strokeLinejoin="round" />
            <path d="M7 8v8" stroke="currentColor" strokeWidth={1.5} strokeLinecap="round" strokeLinejoin="round" />
            <path d="M17 8v8" stroke="currentColor" strokeWidth={1.5} strokeLinecap="round" strokeLinejoin="round" />
          </svg>
          <h2 id="speaker-analytics-heading" className="text-sm font-semibold text-white">No speaker analytics yet</h2>
          <p className="mt-2 text-xs">Start or upload an audio recording to view detection results and live analytics.</p>
        </div>
      </section>
    );
  }

  return (
    <div className="h-full overflow-y-auto p-4 space-y-4 bg-slate-900" aria-live="polite">
      <section className="bg-slate-800/50 rounded-lg p-4 border border-slate-700" aria-label="summary">
        <div className="flex items-start gap-3">
          <div className="flex-shrink-0">
            <svg className="h-8 w-8 text-blue-400" viewBox="0 0 24 24" fill="none" aria-hidden>
              <path d="M12 1v22" stroke="currentColor" strokeWidth={1.5} strokeLinecap="round" strokeLinejoin="round" />
            </svg>
          </div>
          <div className="flex-1">
            <h3 className="text-lg font-bold text-white">Speaker Detection Analytics</h3>
            <p className="mt-1 text-xs text-slate-400">Overview of detected speakers, talk time, and audio characteristics. Updates live while recording.</p>
            <div className="mt-3 flex flex-wrap gap-3 text-sm">
              <div className="flex items-center gap-2">
                <span className="text-slate-400">Speakers</span>
                <span className="text-white font-semibold">{speakerIds.length}</span>
              </div>
              <div className="flex items-center gap-2">
                <span className="text-slate-400">Segments</span>
                <span className="text-white font-semibold">{segments.length}</span>
              </div>
              <div className="flex items-center gap-2 ml-auto">
                {isListening ? (
                  <div className="flex items-center gap-2">
                    <span className="sr-only">Live analysis active</span>
                    <span className="inline-block w-2 h-2 bg-green-400 rounded-full animate-pulse" aria-hidden />
                    <span className="text-green-300 text-xs">Live</span>
                  </div>
                ) : (
                  <span className="text-slate-500 text-xs">Not recording</span>
                )}
              </div>
            </div>
          </div>
        </div>
      </section>

      <section className="bg-slate-800/50 rounded-lg p-4 border border-slate-700" aria-label="talk time distribution">
        <h4 className="text-sm font-semibold text-white mb-3">Talk time</h4>
        <div className="flex items-center gap-4">
          <div className="w-36 h-36">
            <ResponsiveContainer width="100%" height="100%">
              <PieChart>
                <Pie
                  data={talkTimeData}
                  cx="50%"
                  cy="50%"
                  labelLine={false}
                  // show only a simple label inside each slice if needed; keep it minimal
                  label={(entry: any) => `${entry.name}`}
                  outerRadius={56}
                  dataKey="value"
                >
                  {talkTimeData.map((entry, i) => (
                    <Cell key={entry.id || i} fill={entry.fill} />
                  ))}
                </Pie>
              </PieChart>
            </ResponsiveContainer>
          </div>

          <div className="flex-1">
            <ul className="space-y-2">
              {talkTimeData.length === 0 && <li className="text-xs text-slate-400">No talk time available</li>}
              {talkTimeData.map((t) => (
                <li key={t.id} className="flex items-center justify-between">
                  <div className="flex items-center gap-2">
                    <span className="inline-block w-3 h-3 rounded" style={{ background: t.fill }} aria-hidden />
                    <span className="text-sm text-white">{t.name}</span>
                  </div>
                  <div className="text-xs text-slate-400">{t.value}s</div>
                </li>
              ))}
            </ul>
          </div>
        </div>
      </section>

      <section className="bg-slate-800/50 rounded-lg p-4 border border-slate-700" aria-label="characteristics">
        <h4 className="text-sm font-semibold text-white mb-3">Characteristics</h4>
        <div style={{ width: '100%', height: 220 }}>
          <ResponsiveContainer>
            <RadarChart data={radarData}>
              <PolarGrid stroke="#475569" />
              <PolarAngleAxis dataKey="metric" tick={{ fill: '#94a3b8', fontSize: 11 }} />
              <PolarRadiusAxis angle={90} domain={[0, 100]} tick={{ fill: '#64748b', fontSize: 10 }} />
              {speakerIds.map((id, i) => (
                <Radar key={id} name={speakerProfiles[id]?.label || id} dataKey={id} stroke={getColor(i)} fill={getColor(i)} fillOpacity={0.25} />
              ))}
              <Tooltip />
              <Legend wrapperStyle={{ paddingTop: 8 }} />
            </RadarChart>
          </ResponsiveContainer>
        </div>
      </section>

      <section className="bg-slate-800/50 rounded-lg p-4 border border-slate-700" aria-label="speech patterns">
        <div className="flex items-center justify-between mb-3">
          <h4 className="text-sm font-semibold text-white">Speech patterns</h4>
          <div className="flex gap-2" role="tablist" aria-label="Select metric">
            {(['pitch', 'energy', 'pace'] as const).map(metric => (
              <button
                key={metric}
                role="tab"
                aria-selected={selectedMetric === metric}
                onClick={() => setSelectedMetric(metric)}
                className={`px-2 py-1 text-xs rounded transition-colors ${selectedMetric === metric ? 'bg-blue-500 text-white' : 'bg-slate-700 text-slate-400 hover:bg-slate-600'}`}>
                {metric[0].toUpperCase() + metric.slice(1)}
              </button>
            ))}
          </div>
        </div>

        <div style={{ width: '100%', height: 200 }}>
          <ResponsiveContainer>
            <BarChart data={comparisonData} aria-label="comparison chart">
              <CartesianGrid strokeDasharray="3 3" stroke="#475569" />
              <XAxis dataKey="speaker" tick={{ fill: '#94a3b8', fontSize: 11 }} />
              <YAxis tick={{ fill: '#94a3b8', fontSize: 11 }} />
              <Tooltip />
              <Bar dataKey={selectedMetric === 'pitch' ? 'pitch' : selectedMetric === 'energy' ? 'energy' : 'pace'}>
                {comparisonData.map((entry, i) => (
                  <Cell key={entry.id || i} fill={entry.color} />
                ))}
              </Bar>
            </BarChart>
          </ResponsiveContainer>
        </div>
      </section>

      <section className="bg-slate-800/50 rounded-lg p-4 border border-slate-700" aria-label="timeline">
        <h4 className="text-sm font-semibold text-white mb-3">Timeline</h4>
        <div style={{ width: '100%', height: 140 }}>
          <ResponsiveContainer>
            <AreaChart data={timelineData}>
              <CartesianGrid strokeDasharray="3 3" stroke="#475569" />
              <XAxis dataKey="time" tick={{ fill: '#94a3b8', fontSize: 11 }} label={{ value: 'Time (s)', position: 'insideBottom', offset: -5, style: { fill: '#64748b', fontSize: 10 } }} />
              <YAxis tick={{ fill: '#94a3b8', fontSize: 11 }} />
              <Tooltip content={({ payload }) => {
                if (!payload || payload.length === 0) return null;
                const data = payload[0].payload as any;
                const speaker = speakerProfiles && Object.keys(data).find(k => k !== 'time');
                return (
                  <div className="bg-slate-800 p-2 rounded border border-slate-600"><p className="text-white text-xs">{(speaker && speakerProfiles[speaker]?.label) || 'Silence'} • {data.time}s</p></div>
                );
              }} />
              {speakerIds.map((id, i) => (
                <Area key={id} type="stepAfter" dataKey={id} stroke={getColor(i)} fill={getColor(i)} fillOpacity={0.45} />
              ))}
            </AreaChart>
          </ResponsiveContainer>
        </div>
      </section>

      <section className="bg-slate-800/50 rounded-lg p-4 border border-slate-700" aria-label="interaction-flow">
        <h4 className="text-sm font-semibold text-white mb-3">Interaction flow</h4>
        <div className="space-y-2">
          {Object.keys(interactionMatrix).length === 0 && <div className="text-xs text-slate-400">No interaction transitions detected</div>}
          {Object.entries(interactionMatrix).map(([from, tos]) => (
            <div key={from} className="flex items-center gap-2">
              <span className="text-xs text-slate-400 w-20 text-right">{speakerProfiles[from]?.label || from}</span>
              <div className="flex gap-2 flex-1 flex-wrap">
                {Object.entries(tos).map(([to, count]) => (
                  <div key={to} className="flex items-center gap-2 bg-slate-700 px-2 py-1 rounded text-xs">
                    <svg className="h-3 w-3 text-slate-400" viewBox="0 0 24 24" fill="none" aria-hidden>
                      <path d="M5 12h14" stroke="currentColor" strokeWidth={1.5} strokeLinecap="round" strokeLinejoin="round" />
                      <path d="M15 8l4 4-4 4" stroke="currentColor" strokeWidth={1.5} strokeLinecap="round" strokeLinejoin="round" />
                    </svg>
                    <span className="text-white">{speakerProfiles[to]?.label || to}</span>
                    <span className="text-slate-400">({count})</span>
                  </div>
                ))}
              </div>
            </div>
          ))}
        </div>
      </section>

      {isListening && Object.keys(speakerStats).length > 0 && (
        <section className="bg-slate-800/50 rounded-lg p-4 border border-slate-700" aria-label="live status">
          <h4 className="text-sm font-semibold text-white mb-3">Live speaker status</h4>
          <div className="grid grid-cols-2 gap-2">
            {Object.entries(speakerStats).map(([id, stats]) => {
              const recent = Date.now() - (stats.lastActive || 0) < 5000;
              return (
                <div key={id} className={`p-2 rounded border ${recent ? 'bg-green-500/8 border-green-500/40' : 'bg-slate-700/50 border-slate-600'}`}>
                  <div className="flex items-center justify-between">
                    <span className="text-xs font-medium text-white">{speakerProfiles[id]?.label || id}</span>
                    {recent && <span className="inline-block w-2 h-2 bg-green-400 rounded-full animate-pulse" aria-hidden />}
                  </div>
                  <div className="mt-1 text-[10px] text-slate-400">Confidence: {Math.round((stats.confidence ?? 0) * 100)}%</div>
                </div>
              );
            })}
          </div>
        </section>
      )}

      <section className="bg-slate-800/50 rounded-lg p-3 border border-slate-700" aria-label="quality">
        <div className="flex items-center justify-between">
          <span className="text-xs text-slate-400">Detection quality</span>
          <div className="flex items-center gap-2">
            <div className="w-28 h-2 bg-slate-700 rounded-full overflow-hidden">
              <div className="h-full bg-gradient-to-r from-red-500 via-yellow-500 to-green-500 transition-all" style={{ width: `${Math.min(100, Object.keys(speakerStats).length > 0 ? Math.round(Object.values(speakerStats).reduce((a, s) => a + (s.confidence || 0), 0) / Object.keys(speakerStats).length * 100) : 0)}%` }} />
            </div>
            <span className="text-xs text-white">{Object.keys(speakerStats).length > 0 ? `${Math.round(Object.values(speakerStats).reduce((a, s) => a + (s.confidence || 0), 0) / Object.keys(speakerStats).length * 100)}%` : 'N/A'}</span>
          </div>
        </div>
      </section>
    </div>
  );
};

export default SpeakerAnalyticsPanel;
