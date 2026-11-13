import { useMemo, useState } from 'react';
import {
  Area,
  AreaChart,
  CartesianGrid,
  ReferenceLine,
  ResponsiveContainer,
  Tooltip,
  XAxis,
  YAxis,
} from 'recharts';
import { Activity, TrendingDown, TrendingUp } from 'lucide-react';
import {
  THREAT_LEVEL_CONFIG,
  getCountryThreatHistory,
  type ThreatHistoryPoint,
  type ThreatLevelTier,
} from '../data/intelData';

interface ThreatTrendPanelProps {
  selectedCountry: string | null;
  countryCode: string;
  currentThreatTier: ThreatLevelTier;
  latestAlertReason?: string;
}

type WindowRange = 7 | 14 | 30;
type ChartMode = 'index' | 'tier';

interface CustomTooltipProps {
  active?: boolean;
  payload?: Array<{ payload: ThreatHistoryPoint }>;
}

function CustomThreatTooltip({ active, payload }: CustomTooltipProps) {
  if (!active || !payload || payload.length === 0) return null;
  const pt = payload[0].payload;
  const meta = THREAT_LEVEL_CONFIG[pt.tier];

  return (
    <div className="bg-slate-950/95 border border-cyan-500/40 rounded-lg p-3 shadow-2xl font-mono text-[11px] max-w-[260px]">
      <div className="flex items-center justify-between gap-3 border-b border-slate-800 pb-1.5 mb-2">
        <span className="text-slate-200 font-semibold">{pt.fullDate}</span>
        <span
          className="px-1.5 py-0.5 rounded text-[10px] font-bold border"
          style={{
            color: meta.hexColor,
            borderColor: `${meta.hexColor}55`,
            backgroundColor: `${meta.hexColor}18`,
          }}
        >
          {pt.tier.toUpperCase()}
        </span>
      </div>

      <div className="grid grid-cols-2 gap-2 text-[10px] mb-2 tabular-nums">
        <div>
          <span className="text-slate-500 block">RISK INDEX</span>
          <span className="text-white font-bold text-xs">{pt.riskIndex} / 100</span>
        </div>
        <div>
          <span className="text-slate-500 block">SIGNALS</span>
          <span className="text-cyan-300 font-bold text-xs">{pt.incidentCount} events</span>
        </div>
      </div>

      <p className="text-[11px] font-sans text-slate-300 leading-snug">{pt.triggerNote}</p>
    </div>
  );
}

const TIER_TICK_LABELS: Record<number, string> = {
  1: 'Guarded',
  2: 'Standard',
  3: 'Elevated',
  4: 'Critical',
};

export default function ThreatTrendPanel({
  selectedCountry,
  countryCode,
  currentThreatTier,
  latestAlertReason,
}: ThreatTrendPanelProps) {
  const [windowDays, setWindowDays] = useState<WindowRange>(30);
  const [chartMode, setChartMode] = useState<ChartMode>('index');

  const fullHistory = useMemo(
    () => getCountryThreatHistory(selectedCountry, currentThreatTier, latestAlertReason),
    [selectedCountry, currentThreatTier, latestAlertReason]
  );

  const visibleData = useMemo(() => {
    return fullHistory.slice(fullHistory.length - windowDays);
  }, [fullHistory, windowDays]);

  const stats = useMemo(() => {
    if (visibleData.length === 0) {
      return {
        avgIndex: 0,
        peakTier: currentThreatTier,
        elevatedDays: 0,
        delta: 0,
      };
    }

    const total = visibleData.reduce((acc, p) => acc + p.riskIndex, 0);
    const avgIndex = Math.round(total / visibleData.length);
    const maxPoint = visibleData.reduce(
      (best, curr) => (curr.tierScore > best.tierScore ? curr : best),
      visibleData[0]
    );
    const elevatedDays = visibleData.filter(
      (p) => p.tier === 'Elevated' || p.tier === 'Critical'
    ).length;
    const first = visibleData[0].riskIndex;
    const last = visibleData[visibleData.length - 1].riskIndex;

    return {
      avgIndex,
      peakTier: maxPoint.tier,
      elevatedDays,
      delta: last - first,
    };
  }, [visibleData, currentThreatTier]);

  const activeMeta = THREAT_LEVEL_CONFIG[currentThreatTier];
  const peakMeta = THREAT_LEVEL_CONFIG[stats.peakTier];
  const gradientId = `threatGrad-${countryCode}`;

  return (
    <section
      aria-label="30-Day Historical Threat Trend"
      className="bg-slate-900/75 border border-cyan-500/25 rounded-xl p-3.5 flex flex-col gap-3"
    >
      {/* Panel Header */}
      <div className="flex flex-wrap items-center justify-between gap-2 border-b border-slate-800/80 pb-2.5">
        <div className="flex items-center gap-2">
          <Activity className="w-4 h-4 text-cyan-400 shrink-0" />
          <div>
            <h3 className="text-xs font-mono font-bold text-slate-100 tracking-wide">
              THREAT FLUCTUATION TREND ({windowDays}-DAY) ·{' '}
              {(selectedCountry ?? 'Global Composite').toUpperCase()} [{countryCode}]
            </h3>
            <p className="text-[10px] font-mono text-slate-400">
              HISTORICAL POSTURE TRAJECTORY &amp; LIVE ESCALATION TELEMETRY
            </p>
          </div>
        </div>

        {/* Mode & Window Controls */}
        <div className="flex flex-wrap items-center gap-1.5 font-mono text-[10px]">
          <div className="flex items-center bg-slate-950 p-0.5 rounded-md border border-slate-800">
            <button
              type="button"
              onClick={() => setChartMode('index')}
              className={`px-2 py-1 rounded transition-colors cursor-pointer whitespace-nowrap ${
                chartMode === 'index'
                  ? 'bg-cyan-500/20 text-cyan-300 font-semibold'
                  : 'text-slate-400 hover:text-slate-200'
              }`}
            >
              INDEX (0-100)
            </button>
            <button
              type="button"
              onClick={() => setChartMode('tier')}
              className={`px-2 py-1 rounded transition-colors cursor-pointer whitespace-nowrap ${
                chartMode === 'tier'
                  ? 'bg-cyan-500/20 text-cyan-300 font-semibold'
                  : 'text-slate-400 hover:text-slate-200'
              }`}
            >
              TIER STEP
            </button>
          </div>

          <div className="flex items-center bg-slate-950 p-0.5 rounded-md border border-slate-800">
            {([7, 14, 30] as WindowRange[]).map((days) => (
              <button
                key={days}
                type="button"
                onClick={() => setWindowDays(days)}
                className={`px-2 py-1 rounded transition-colors cursor-pointer tabular-nums ${
                  windowDays === days
                    ? 'bg-cyan-500 text-slate-950 font-bold'
                    : 'text-slate-400 hover:text-slate-200'
                }`}
              >
                {days}D
              </button>
            ))}
          </div>
        </div>
      </div>

      {/* Compact Quantitative Summary Strip */}
      <div className="grid grid-cols-2 sm:grid-cols-4 gap-2 text-[11px] font-mono tabular-nums">
        <div className="px-2.5 py-1.5 rounded-lg bg-slate-950/70 border border-slate-800/80">
          <span className="text-[10px] text-slate-500 block">CURRENT LEVEL</span>
          <span className="font-bold" style={{ color: activeMeta.hexColor }}>
            {currentThreatTier.toUpperCase()}
          </span>
        </div>
        <div className="px-2.5 py-1.5 rounded-lg bg-slate-950/70 border border-slate-800/80">
          <span className="text-[10px] text-slate-500 block">{windowDays}D PEAK</span>
          <span className="font-bold" style={{ color: peakMeta.hexColor }}>
            {stats.peakTier.toUpperCase()}
          </span>
        </div>
        <div className="px-2.5 py-1.5 rounded-lg bg-slate-950/70 border border-slate-800/80">
          <span className="text-[10px] text-slate-500 block">{windowDays}D AVG INDEX</span>
          <span className="text-slate-100 font-bold flex items-center gap-1.5">
            {stats.avgIndex}
            <span
              className={`text-[10px] flex items-center gap-0.5 ${
                stats.delta > 0
                  ? 'text-amber-400'
                  : stats.delta < 0
                    ? 'text-emerald-400'
                    : 'text-slate-400'
              }`}
            >
              {stats.delta > 0 ? (
                <TrendingUp className="w-3 h-3" />
              ) : stats.delta < 0 ? (
                <TrendingDown className="w-3 h-3" />
              ) : null}
              {stats.delta > 0 ? `+${stats.delta}` : stats.delta}
            </span>
          </span>
        </div>
        <div className="px-2.5 py-1.5 rounded-lg bg-slate-950/70 border border-slate-800/80">
          <span className="text-[10px] text-slate-500 block">ELEVATED+ DAYS</span>
          <span className="text-cyan-300 font-bold">
            {stats.elevatedDays} / {visibleData.length}d
          </span>
        </div>
      </div>

      {/* Recharts Area / Step Visualization */}
      <div className="w-full h-48 sm:h-52">
        <ResponsiveContainer width="100%" height="100%">
          <AreaChart data={visibleData} margin={{ top: 8, right: 12, left: -8, bottom: 0 }}>
            <defs>
              <linearGradient id={gradientId} x1="0" y1="0" x2="0" y2="1">
                <stop offset="5%" stopColor={activeMeta.hexColor} stopOpacity={0.42} />
                <stop offset="95%" stopColor={activeMeta.hexColor} stopOpacity={0.02} />
              </linearGradient>
            </defs>

            <CartesianGrid stroke="rgba(56, 189, 248, 0.08)" strokeDasharray="3 3" vertical={false} />

            <XAxis
              dataKey="dateLabel"
              tick={{ fill: '#64748b', fontSize: 10, fontFamily: 'JetBrains Mono, monospace' }}
              tickLine={false}
              axisLine={{ stroke: '#1e293b' }}
              minTickGap={22}
            />

            {chartMode === 'index' ? (
              <YAxis
                domain={[0, 100]}
                ticks={[0, 25, 50, 75, 100]}
                tick={{ fill: '#64748b', fontSize: 10, fontFamily: 'JetBrains Mono, monospace' }}
                tickLine={false}
                axisLine={false}
              />
            ) : (
              <YAxis
                domain={[1, 4]}
                ticks={[1, 2, 3, 4]}
                tickFormatter={(v) => TIER_TICK_LABELS[v] ?? String(v)}
                width={64}
                tick={{ fill: '#94a3b8', fontSize: 10, fontFamily: 'JetBrains Mono, monospace' }}
                tickLine={false}
                axisLine={false}
              />
            )}

            <Tooltip content={<CustomThreatTooltip />} />

            {chartMode === 'index' ? (
              <>
                <ReferenceLine
                  y={50}
                  stroke="#f59e0b"
                  strokeOpacity={0.45}
                  strokeDasharray="4 4"
                  label={{
                    value: 'ELEVATED',
                    position: 'insideTopRight',
                    fill: '#f59e0b',
                    fontSize: 9,
                    fontFamily: 'JetBrains Mono, monospace',
                  }}
                />
                <ReferenceLine
                  y={75}
                  stroke="#f43f5e"
                  strokeOpacity={0.45}
                  strokeDasharray="4 4"
                  label={{
                    value: 'CRITICAL',
                    position: 'insideTopRight',
                    fill: '#f43f5e',
                    fontSize: 9,
                    fontFamily: 'JetBrains Mono, monospace',
                  }}
                />
                <Area
                  type="monotone"
                  dataKey="riskIndex"
                  stroke={activeMeta.hexColor}
                  strokeWidth={2}
                  fill={`url(#${gradientId})`}
                  activeDot={{ r: 5, fill: activeMeta.hexColor, stroke: '#020617', strokeWidth: 2 }}
                />
              </>
            ) : (
              <Area
                type="stepAfter"
                dataKey="tierScore"
                stroke={activeMeta.hexColor}
                strokeWidth={2.2}
                fill={`url(#${gradientId})`}
                activeDot={{ r: 5, fill: activeMeta.hexColor, stroke: '#020617', strokeWidth: 2 }}
              />
            )}
          </AreaChart>
        </ResponsiveContainer>
      </div>
    </section>
  );
}
