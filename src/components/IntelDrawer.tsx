import {
  AlertTriangle,
  ExternalLink,
  Loader,
  Mic,
  Radio,
  RotateCcw,
  RotateCw,
  ShieldCheck,
  Sparkles,
} from 'lucide-react';
import {
  THREAT_LEVEL_CONFIG,
  THREAT_TIERS,
  type Article,
  type CountryIntel,
  type PressConference,
  type ThreatAlert,
  type ThreatLevelTier,
} from '../data/intelData';

interface IntelDrawerProps {
  selectedCountry: string | null;
  currentIntel: CountryIntel;
  currentThreatTier: ThreatLevelTier;
  onChangeThreatLevel: (tier: ThreatLevelTier) => void;
  countryAlerts: ThreatAlert[];
  activeTab: 'overview' | 'press';
  setActiveTab: (tab: 'overview' | 'press') => void;
  filteredArticles: Article[];
  isSummarizing: boolean;
  useAlternateBriefing: boolean;
  onRefreshSummary: () => void;
  onResetFocus: () => void;
  onSelectArticle: (article: Article) => void;
  onSelectPressConference: (pc: PressConference) => void;
}

export default function IntelDrawer({
  selectedCountry,
  currentIntel,
  currentThreatTier,
  onChangeThreatLevel,
  countryAlerts,
  activeTab,
  setActiveTab,
  filteredArticles,
  isSummarizing,
  useAlternateBriefing,
  onRefreshSummary,
  onResetFocus,
  onSelectArticle,
  onSelectPressConference,
}: IntelDrawerProps) {
  const briefingPoints = useAlternateBriefing
    ? currentIntel.alternateBriefing
    : currentIntel.aiExecutiveSummary;

  const threatMeta = THREAT_LEVEL_CONFIG[currentThreatTier];

  return (
    <div className="bg-slate-900/80 border border-cyan-500/30 rounded-xl flex flex-col h-full overflow-hidden shadow-2xl backdrop-blur-md">
      {/* Drawer Header: Selected Country Dossier */}
      <div className="p-4 border-b border-slate-800 bg-slate-950/60 flex flex-col gap-3">
        <div className="flex items-start justify-between gap-2">
          <div>
            <div className="flex items-center gap-2">
              <h2 className="text-xl font-bold text-white tracking-wide">
                {selectedCountry ?? 'Global Overview'}
              </h2>
              <span className="text-xs font-mono px-2 py-0.5 rounded bg-slate-800 text-slate-300 border border-slate-700">
                {currentIntel.code}
              </span>
            </div>
            <p className="text-xs text-slate-400 font-mono mt-0.5">
              {selectedCountry ? 'CAPITAL' : 'MESH'}:{' '}
              <span className="text-slate-200">{currentIntel.capital}</span> //{' '}
              {selectedCountry ? 'CONTINENT' : 'SCOPE'}:{' '}
              <span className="text-cyan-400">{currentIntel.continent}</span>
            </p>
          </div>

          <div className="flex flex-col items-end shrink-0 gap-1.5">
            <span
              className={`text-[11px] font-mono px-2.5 py-0.5 rounded-full border ${threatMeta.badgeClass} font-semibold whitespace-nowrap`}
            >
              {threatMeta.label}
            </span>
            <div className="flex items-center gap-2">
              <span className="text-[10px] text-slate-500 font-mono">
                {selectedCountry ? 'STATUS: MONITORED' : 'NO COUNTRY LOCKED'}
              </span>
              <button
                type="button"
                onClick={onResetFocus}
                className="px-2 py-0.5 rounded border border-cyan-500/40 bg-cyan-500/10 hover:bg-cyan-500/20 text-cyan-300 text-[10px] font-mono flex items-center gap-1 transition-colors cursor-pointer whitespace-nowrap"
                title="Clear country selection and reset filters to Global View"
              >
                <RotateCcw className="w-2.5 h-2.5" />
                RESET FOCUS
              </button>
            </div>
          </div>
        </div>

        {/* Interactive Threat Assessment Override Control */}
        <div className="flex flex-wrap items-center justify-between gap-2 pt-2 border-t border-slate-800/70">
          <span className="text-[10px] font-mono text-slate-400 uppercase tracking-wider flex items-center gap-1.5">
            <AlertTriangle className="w-3 h-3 text-amber-400" />
            {selectedCountry ? 'THREAT POSTURE:' : 'POSTURE (SELECT COUNTRY):'}
          </span>
          <div className="flex items-center gap-1 bg-slate-900/90 p-0.5 rounded-lg border border-slate-800">
            {THREAT_TIERS.map((tier) => {
              const meta = THREAT_LEVEL_CONFIG[tier];
              const isActive = currentThreatTier === tier;
              return (
                <button
                  key={tier}
                  type="button"
                  disabled={!selectedCountry}
                  onClick={() => onChangeThreatLevel(tier)}
                  className={`px-2 py-1 rounded text-[10px] font-mono transition-all whitespace-nowrap ${
                    !selectedCountry ? 'opacity-45 cursor-not-allowed' : 'cursor-pointer'
                  } ${
                    isActive
                      ? `${meta.badgeClass} border font-bold shadow-sm`
                      : 'text-slate-400 hover:text-slate-200 hover:bg-slate-800/70 border border-transparent'
                  }`}
                >
                  {meta.shortLabel}
                </button>
              );
            })}
          </div>
        </div>

        {/* Latest Country Threat Alert Strip */}
        {countryAlerts.length > 0 && (
          <div className="px-2.5 py-1.5 rounded-md bg-slate-900/90 border border-slate-800 text-[10px] font-mono flex items-center justify-between gap-2">
            <span className="text-slate-300 truncate">
              LAST SHIFT: <span className="text-slate-400">{countryAlerts[0].previousTier}</span> →{' '}
              <span
                className="font-bold"
                style={{ color: THREAT_LEVEL_CONFIG[countryAlerts[0].newTier].hexColor }}
              >
                {countryAlerts[0].newTier.toUpperCase()}
              </span>
            </span>
            <span className="text-slate-500 shrink-0 tabular-nums">{countryAlerts[0].timestamp}</span>
          </div>
        )}
      </div>

      {/* Sub-Navigation Tabs */}
      <div className="flex border-b border-slate-800 bg-slate-900/90 text-xs font-mono">
        <button
          type="button"
          onClick={() => setActiveTab('overview')}
          className={`flex-1 py-2.5 px-3 flex items-center justify-center gap-2 border-b-2 transition-colors whitespace-nowrap cursor-pointer ${
            activeTab === 'overview'
              ? 'border-cyan-400 text-cyan-400 bg-cyan-950/20 font-semibold'
              : 'border-transparent text-slate-400 hover:text-slate-200 hover:bg-slate-800/40'
          }`}
        >
          <Sparkles className="w-3.5 h-3.5" />
          AI BRIEFING &amp; DISPATCHES
        </button>
        <button
          type="button"
          onClick={() => setActiveTab('press')}
          className={`flex-1 py-2.5 px-3 flex items-center justify-center gap-2 border-b-2 transition-colors whitespace-nowrap cursor-pointer ${
            activeTab === 'press'
              ? 'border-cyan-400 text-cyan-400 bg-cyan-950/20 font-semibold'
              : 'border-transparent text-slate-400 hover:text-slate-200 hover:bg-slate-800/40'
          }`}
        >
          <Radio className="w-3.5 h-3.5" />
          PRESS CONFERENCES
          <span className="px-1.5 py-0.5 rounded-full text-[10px] bg-cyan-500/20 text-cyan-300 tabular-nums">
            {currentIntel.pressConferences.length}
          </span>
        </button>
      </div>

      {/* Drawer Content Body */}
      <div className="p-4 flex-1 overflow-y-auto custom-scrollbar flex flex-col gap-4">
        {activeTab === 'overview' && (
          <>
            {/* AI News Summarizer Card */}
            <div className="rounded-xl border border-cyan-500/40 bg-gradient-to-b from-cyan-950/30 to-slate-950/80 p-3.5 relative overflow-hidden">
              <div className="flex items-center justify-between mb-2">
                <div className="flex items-center gap-2 text-xs font-mono text-cyan-300 font-semibold">
                  <span className="relative flex h-2 w-2">
                    <span className="animate-ping absolute inline-flex h-full w-full rounded-full bg-cyan-400 opacity-75" />
                    <span className="relative inline-flex rounded-full h-2 w-2 bg-cyan-500" />
                  </span>
                  <span>AI AGENT EXECUTIVE BRIEFING</span>
                </div>
                <button
                  type="button"
                  onClick={onRefreshSummary}
                  className="text-slate-400 hover:text-cyan-400 p-1 transition-colors cursor-pointer"
                  title="Regenerate Executive Briefing"
                  aria-label="Regenerate Executive Briefing"
                >
                  <RotateCw className={`w-3.5 h-3.5 ${isSummarizing ? 'animate-spin text-cyan-400' : ''}`} />
                </button>
              </div>

              {isSummarizing ? (
                <div className="py-6 flex flex-col items-center justify-center space-y-2 text-xs font-mono text-cyan-400">
                  <Loader className="w-5 h-5 animate-spin" />
                  <span>COMPILING MULTI-FEED EMBEDDINGS...</span>
                </div>
              ) : (
                <ul className="space-y-2 text-xs text-slate-300">
                  {briefingPoints.map((bullet, idx) => (
                    <li key={idx} className="flex items-start gap-2">
                      <span className="font-mono text-cyan-400 font-bold mt-0.5 tabular-nums">
                        0{idx + 1}.
                      </span>
                      <span className="leading-relaxed">{bullet}</span>
                    </li>
                  ))}
                </ul>
              )}

              <div className="mt-3 pt-2 border-t border-cyan-500/20 flex items-center justify-between text-[10px] font-mono text-cyan-400/70 tabular-nums">
                <span>SYNTHESIZED FROM {currentIntel.newsCount} GLOBAL FEEDS</span>
                <span>CONFIDENCE: 98.4%</span>
              </div>
            </div>

            {/* Aggregated Real-Time News Stream */}
            <div className="flex flex-col gap-2.5">
              <div className="flex items-center justify-between text-xs font-mono text-slate-400 px-1 tabular-nums">
                <span>LIVE ARTICLES ({filteredArticles.length})</span>
                <span>SORT: CHRONOLOGICAL</span>
              </div>

              {filteredArticles.length === 0 ? (
                <div className="p-8 text-center text-xs font-mono text-slate-500 border border-dashed border-slate-800 rounded-lg">
                  NO ARTICLES MATCHING SEARCH OR CATEGORY FILTER.
                </div>
              ) : (
                filteredArticles.map((article) => {
                  const isCritical = article.sentiment === 'Critical';
                  const isPositive = article.sentiment === 'Positive';
                  const badgeColor = isCritical
                    ? 'bg-rose-500/10 text-rose-400 border-rose-500/30'
                    : isPositive
                      ? 'bg-emerald-500/10 text-emerald-400 border-emerald-500/30'
                      : 'bg-slate-800 text-slate-300 border-slate-700';

                  return (
                    <article
                      key={article.id}
                      className="group p-3 rounded-lg bg-slate-950/60 border border-slate-800/80 hover:border-cyan-500/40 transition-all hover:bg-slate-900/60"
                    >
                      <div className="flex flex-wrap items-start justify-between gap-2 mb-1.5">
                        <div className="flex items-center gap-2">
                          <span className="text-[10px] font-mono text-cyan-400/90 font-medium">
                            {article.source}
                          </span>
                          <span className="text-[10px] text-slate-500 font-mono">• {article.time}</span>
                        </div>
                        <div className="flex items-center gap-1.5">
                          <span
                            className={`text-[9px] font-mono px-1.5 py-0.5 rounded border tabular-nums ${badgeColor}`}
                          >
                            {article.sentiment} ({article.sentimentScore})
                          </span>
                          <span className="text-[9px] font-mono px-1.5 py-0.5 rounded bg-slate-800/80 text-slate-400 border border-slate-700">
                            {article.category}
                          </span>
                        </div>
                      </div>

                      <h4 className="text-xs font-semibold text-slate-200 group-hover:text-cyan-300 transition-colors leading-snug">
                        {article.title}
                      </h4>
                      <p className="text-[11px] text-slate-400 mt-1 leading-relaxed">{article.summary}</p>

                      <div className="mt-2 pt-2 border-t border-slate-900 flex items-center justify-between text-[10px] font-mono text-slate-500">
                        <span className="flex items-center gap-1">
                          <ShieldCheck className="w-3 h-3 text-emerald-400" />
                          VERIFIED SOURCE
                        </span>
                        <button
                          type="button"
                          onClick={() => onSelectArticle(article)}
                          className="text-cyan-400/80 hover:text-cyan-300 flex items-center gap-1 cursor-pointer"
                        >
                          DISPATCH DETAILS <ExternalLink className="w-2.5 h-2.5" />
                        </button>
                      </div>
                    </article>
                  );
                })
              )}
            </div>
          </>
        )}

        {activeTab === 'press' && (
          <div className="flex flex-col gap-3">
            <div className="p-3 rounded-lg bg-cyan-950/20 border border-cyan-500/30 text-xs font-mono text-cyan-300 flex items-center justify-between">
              <span>GOVERNMENT BRIEFING SURVEILLANCE FEED</span>
              <span className="flex items-center gap-1 text-[10px] text-emerald-400">
                <span className="h-1.5 w-1.5 rounded-full bg-emerald-400 animate-ping" />
                TRANSCRIBING
              </span>
            </div>

            {currentIntel.pressConferences.map((pc) => (
              <div
                key={pc.id}
                className="p-3.5 rounded-lg bg-slate-950/70 border border-slate-800 flex flex-col gap-2"
              >
                <div className="flex items-center justify-between">
                  <span className="px-2 py-0.5 rounded text-[10px] font-mono bg-cyan-500/10 text-cyan-400 border border-cyan-500/30 font-semibold">
                    {pc.status}
                  </span>
                  <span className="text-[10px] font-mono text-slate-500">{pc.time}</span>
                </div>

                <div>
                  <h4 className="text-xs font-bold text-slate-200">{pc.title}</h4>
                  <p className="text-[11px] font-mono text-slate-400 mt-0.5">SPEAKER: {pc.speaker}</p>
                </div>

                <div className="bg-slate-900/90 p-2.5 rounded border-l-2 border-cyan-400 text-xs text-slate-300 italic">
                  {pc.keyQuote}
                </div>

                <div className="flex items-center justify-between text-[10px] font-mono text-slate-500 pt-1">
                  <span className="flex items-center gap-1">
                    <Mic className="w-3 h-3 text-cyan-400" />
                    AUDIO SYNC: 100%
                  </span>
                  <button
                    type="button"
                    onClick={() => onSelectPressConference(pc)}
                    className="text-cyan-400 hover:underline cursor-pointer"
                  >
                    FULL TRANSCRIPT &gt;&gt;
                  </button>
                </div>
              </div>
            ))}

            <div className="p-3 rounded-lg border border-dashed border-slate-800 text-center text-xs font-mono text-slate-500">
              MONITORING OFFICIAL STATE BROADCAST FREQUENCIES IN REAL-TIME.
            </div>
          </div>
        )}
      </div>

      {/* Drawer Footer Telemetry Status */}
      <div className="p-3 border-t border-slate-800 bg-slate-950/90 flex items-center justify-between text-[11px] font-mono text-slate-400">
        <div className="flex items-center gap-2">
          <span className="h-1.5 w-1.5 rounded-full bg-cyan-400" />
          <span>SEC_LEVEL: ALPHA</span>
        </div>
        <button
          type="button"
          onClick={onResetFocus}
          className="text-cyan-400 hover:text-cyan-300 text-[10px] cursor-pointer"
        >
          RESET FOCUS
        </button>
      </div>
    </div>
  );
}
