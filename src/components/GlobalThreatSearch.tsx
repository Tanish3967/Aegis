import { useEffect, useMemo, useRef, useState } from 'react';
import {
  AlertTriangle,
  Anchor,
  Compass,
  Crosshair,
  Flame,
  Globe2,
  Newspaper,
  Search,
  ShieldAlert,
  X,
} from 'lucide-react';
import {
  CHOKEPOINTS,
  CONTINENTS,
  COUNTRY_DATA,
  COUNTRY_NODES,
  HOTSPOTS,
  THREAT_LEVEL_CONFIG,
  THREAT_TIERS,
  getInitialThreatTier,
  type Article,
  type ThreatAlert,
  type ThreatLevelTier,
} from '../data/intelData';
import { buildWorldGeoDataset, inferContinent } from '../three/worldGeo';

export type ThreatSearchKind = 'country' | 'hotspot' | 'chokepoint' | 'alert';

export interface GlobalThreatSearchResult {
  id: string;
  kind: ThreatSearchKind;
  title: string;
  subtitle: string;
  country: string;
  code: string;
  continent: string;
  lat: number;
  lon: number;
  tier: ThreatLevelTier;
  matchContext: string;
  searchBlob: string;
  matchedArticle?: Article;
}

interface GlobalThreatSearchProps {
  selectedCountry: string | null;
  threatOverrides: Record<string, ThreatLevelTier>;
  scrapedArticlesByCountry: Record<string, Article[]>;
  alerts: ThreatAlert[];
  onSelectTarget: (result: GlobalThreatSearchResult) => void;
}

const CONTINENT_CODE_ALIASES: Record<string, string> = {
  'North America': 'NA North America Americas',
  Europe: 'EU Europe NATO',
  Asia: 'APAC Asia Pacific Asia-Pacific',
  'South America': 'LATAM South America Americas',
  Africa: 'AFR Africa',
  Oceania: 'OCN Oceania Pacific',
  Antarctica: 'ANT Antarctica Polar',
};

const HOTSPOT_TARGET_COUNTRY: Record<string, string> = {
  'Eastern Mediterranean Basin': 'Egypt',
  'Red Sea Maritime Corridor': 'Saudi Arabia',
  'South China Sea Spratly Sector': 'Philippines',
};

const CHOKEPOINT_TARGET_COUNTRY: Record<string, string> = {
  'Strait of Hormuz': 'Iran',
  'Strait of Malacca': 'Singapore',
  'Bab el-Mandeb': 'Yemen',
  'Taiwan Strait': 'Taiwan',
  'Suez Canal Gateway': 'Egypt',
  'Panama Canal Locks': 'Panama',
};

const TIER_SORT_WEIGHT: Record<ThreatLevelTier, number> = {
  Critical: 4,
  Elevated: 3,
  Standard: 2,
  Guarded: 1,
};

function mapHotspotLevelToTier(level: 'CRITICAL' | 'ELEVATED' | 'MODERATE'): ThreatLevelTier {
  if (level === 'CRITICAL') return 'Critical';
  if (level === 'ELEVATED') return 'Elevated';
  return 'Standard';
}

function mapChokepointStatusToTier(status: string): ThreatLevelTier {
  const s = status.toLowerCase();
  if (s.includes('restricted') || s.includes('defcon 3')) return 'Critical';
  if (s.includes('elevated') || s.includes('high') || s.includes('surveillance') || s.includes('watch')) {
    return 'Elevated';
  }
  return 'Standard';
}

export default function GlobalThreatSearch({
  selectedCountry,
  threatOverrides,
  scrapedArticlesByCountry,
  alerts,
  onSelectTarget,
}: GlobalThreatSearchProps) {
  const [query, setQuery] = useState('');
  const [isOpen, setIsOpen] = useState(false);
  const [tierFilter, setTierFilter] = useState<ThreatLevelTier | 'ALL'>('ALL');
  const [continentScope, setContinentScope] = useState<string>('all');
  const [highlightedIdx, setHighlightedIdx] = useState(0);

  const containerRef = useRef<HTMLDivElement | null>(null);
  const inputRef = useRef<HTMLInputElement | null>(null);

  const worldGeo = useMemo(() => buildWorldGeoDataset(), []);

  // Build unified global threat search index across all 177+ countries, hotspots, chokepoints, and live alerts
  const indexItems = useMemo<GlobalThreatSearchResult[]>(() => {
    const items: GlobalThreatSearchResult[] = [];
    const seenCountries = new Set<string>();

    const addCountryEntry = (
      name: string,
      continent: string,
      lat: number,
      lon: number
    ) => {
      if (seenCountries.has(name)) return;
      seenCountries.add(name);

      const intel = COUNTRY_DATA[name];
      const node = COUNTRY_NODES.find((n) => n.name === name);
      const code =
        intel?.code ??
        node?.code ??
        (name.replace(/[^A-Za-z]/g, '').slice(0, 3).toUpperCase() || 'INT');
      const tier = threatOverrides[name] ?? getInitialThreatTier(name);
      const tierMeta = THREAT_LEVEL_CONFIG[tier];
      const liveArticles = scrapedArticlesByCountry[name] ?? [];
      const allArticles = [...liveArticles, ...(intel?.articles ?? [])];
      const summaryText = (intel?.aiExecutiveSummary ?? []).join(' ');
      const articlesText = allArticles
        .map((a) => `${a.title} ${a.category} ${a.summary} ${a.source}`)
        .join(' ');
      const pressText = (intel?.pressConferences ?? [])
        .map((p) => `${p.title} ${p.keyQuote}`)
        .join(' ');

      const topDispatch = allArticles[0];
      const matchContext = topDispatch
        ? topDispatch.title
        : intel?.aiExecutiveSummary[0] ?? `${continent} sector surveillance nominal.`;

      items.push({
        id: `country-${name}`,
        kind: 'country',
        title: name,
        subtitle: intel?.capital ?? node?.label ?? `${continent} Operations Sector`,
        country: name,
        code,
        continent,
        lat,
        lon,
        tier,
        matchContext,
        matchedArticle: topDispatch,
        searchBlob: [
          name,
          code,
          continent,
          CONTINENT_CODE_ALIASES[continent] ?? '',
          intel?.capital ?? '',
          node?.label ?? '',
          tier,
          tierMeta.label,
          summaryText,
          articlesText,
          pressText,
        ]
          .join(' ')
          .toLowerCase(),
      });
    };

    for (const feat of worldGeo.countries) {
      addCountryEntry(feat.name, feat.continent, feat.centroidLat, feat.centroidLon);
    }
    for (const node of COUNTRY_NODES) {
      addCountryEntry(node.name, node.continent, node.lat, node.lon);
    }

    // Add active conflict hotspots
    for (const hs of HOTSPOTS) {
      const targetCountry = HOTSPOT_TARGET_COUNTRY[hs.name] ?? 'Egypt';
      const continent = inferContinent(hs.name, hs.lat, hs.lon);
      const tier = mapHotspotLevelToTier(hs.level);
      items.push({
        id: `hotspot-${hs.name}`,
        kind: 'hotspot',
        title: hs.name,
        subtitle: `ACTIVE HOTSPOT · ${hs.level}`,
        country: targetCountry,
        code: 'HSP',
        continent,
        lat: hs.lat,
        lon: hs.lon,
        tier,
        matchContext: hs.advisory,
        searchBlob: [
          hs.name,
          'hotspot conflict maritime radar',
          hs.level,
          hs.advisory,
          targetCountry,
          continent,
          CONTINENT_CODE_ALIASES[continent] ?? '',
          tier,
        ]
          .join(' ')
          .toLowerCase(),
      });
    }

    // Add maritime chokepoints
    for (const cp of CHOKEPOINTS) {
      const targetCountry = CHOKEPOINT_TARGET_COUNTRY[cp.name] ?? 'Egypt';
      const continent = inferContinent(cp.name, cp.lat, cp.lon);
      const tier = mapChokepointStatusToTier(cp.status);
      items.push({
        id: `chokepoint-${cp.name}`,
        kind: 'chokepoint',
        title: cp.name,
        subtitle: `CHOKEPOINT · ${cp.status} (${cp.throughput})`,
        country: targetCountry,
        code: 'CHK',
        continent,
        lat: cp.lat,
        lon: cp.lon,
        tier,
        matchContext: `${cp.note} · Throughput ${cp.throughput}`,
        searchBlob: [
          cp.name,
          'chokepoint maritime strait canal shipping',
          cp.status,
          cp.note,
          cp.throughput,
          targetCountry,
          continent,
          CONTINENT_CODE_ALIASES[continent] ?? '',
          tier,
        ]
          .join(' ')
          .toLowerCase(),
      });
    }

    // Add recent live threat transition alerts
    for (const alert of alerts) {
      items.push({
        id: `live-alert-${alert.id}`,
        kind: 'alert',
        title: `${alert.country} Threat Shift (${alert.previousTier} → ${alert.newTier})`,
        subtitle: `LIVE ALERT · ${alert.timestamp} · ${alert.continent}`,
        country: alert.country,
        code: alert.code,
        continent: alert.continent,
        lat: worldGeo.byName.get(alert.country)?.centroidLat ?? 20,
        lon: worldGeo.byName.get(alert.country)?.centroidLon ?? 0,
        tier: alert.newTier,
        matchContext: alert.reason,
        searchBlob: [
          alert.country,
          alert.code,
          alert.continent,
          alert.previousTier,
          alert.newTier,
          alert.reason,
          'alert shift escalation',
        ]
          .join(' ')
          .toLowerCase(),
      });
    }

    return items;
  }, [worldGeo, threatOverrides, scrapedArticlesByCountry, alerts]);

  // Step 1: Filter by query & threat tier across ALL continents simultaneously
  const queryAndTierMatches = useMemo(() => {
    const trimmed = query.trim().toLowerCase();
    const tokens = trimmed ? trimmed.split(/\s+/).filter(Boolean) : [];

    const scored: Array<{ item: GlobalThreatSearchResult; score: number }> = [];

    for (const item of indexItems) {
      if (tierFilter !== 'ALL' && item.tier !== tierFilter) continue;

      if (tokens.length > 0) {
        const allTokensMatch = tokens.every((tok) => item.searchBlob.includes(tok));
        if (!allTokensMatch) continue;
      }

      // Compute relevance + threat priority score
      let score = TIER_SORT_WEIGHT[item.tier] * 25;
      if (item.kind === 'alert') score += 40;
      if (item.kind === 'hotspot') score += 22;
      if (item.kind === 'chokepoint') score += 16;
      if (COUNTRY_DATA[item.country]) score += 12;

      if (trimmed) {
        const titleLow = item.title.toLowerCase();
        const codeLow = item.code.toLowerCase();
        if (titleLow === trimmed || codeLow === trimmed) score += 200;
        else if (titleLow.startsWith(trimmed)) score += 120;
        else if (titleLow.includes(trimmed)) score += 60;
      }

      // Check if an individual article matches the query to surface it as matchContext
      let bestItem = item;
      if (trimmed && item.kind === 'country') {
        const intel = COUNTRY_DATA[item.country];
        const pool = [...(scrapedArticlesByCountry[item.country] ?? []), ...(intel?.articles ?? [])];
        const hit = pool.find(
          (a) =>
            a.title.toLowerCase().includes(trimmed) ||
            a.summary.toLowerCase().includes(trimmed) ||
            a.category.toLowerCase().includes(trimmed)
        );
        if (hit) {
          bestItem = {
            ...item,
            matchContext: `[${hit.category}] ${hit.title}`,
            matchedArticle: hit,
          };
          score += 30;
        }
      }

      scored.push({ item: bestItem, score });
    }

    scored.sort((a, b) => b.score - a.score || a.item.title.localeCompare(b.item.title));
    return scored.map((entry) => entry.item);
  }, [indexItems, query, tierFilter, scrapedArticlesByCountry]);

  // Live continent counts across current query + tier filter
  const continentCounts = useMemo(() => {
    const counts: Record<string, number> = { all: queryAndTierMatches.length };
    for (const item of queryAndTierMatches) {
      counts[item.continent] = (counts[item.continent] ?? 0) + 1;
    }
    return counts;
  }, [queryAndTierMatches]);

  // Step 2: Apply optional continent scope chip inside dropdown
  const visibleResults = useMemo(() => {
    const filtered =
      continentScope === 'all'
        ? queryAndTierMatches
        : queryAndTierMatches.filter((r) => r.continent === continentScope);
    return filtered.slice(0, 40);
  }, [queryAndTierMatches, continentScope]);

  // Tier counts across current query (regardless of tierFilter)
  const tierCounts = useMemo(() => {
    const trimmed = query.trim().toLowerCase();
    const tokens = trimmed ? trimmed.split(/\s+/).filter(Boolean) : [];
    const counts: Record<ThreatLevelTier, number> = {
      Critical: 0,
      Elevated: 0,
      Standard: 0,
      Guarded: 0,
    };
    for (const item of indexItems) {
      if (tokens.length > 0 && !tokens.every((t) => item.searchBlob.includes(t))) continue;
      counts[item.tier] += 1;
    }
    return counts;
  }, [indexItems, query]);

  // Reset highlighted row when result list changes
  useEffect(() => {
    setHighlightedIdx(0);
  }, [query, tierFilter, continentScope]);

  // Global Cmd/Ctrl + K shortcut & click-outside dismissal
  useEffect(() => {
    const handleGlobalKey = (e: KeyboardEvent) => {
      if ((e.metaKey || e.ctrlKey) && e.key.toLowerCase() === 'k') {
        e.preventDefault();
        setIsOpen(true);
        requestAnimationFrame(() => inputRef.current?.focus());
      } else if (e.key === 'Escape' && isOpen) {
        setIsOpen(false);
        inputRef.current?.blur();
      }
    };

    const handleClickOutside = (e: MouseEvent) => {
      if (containerRef.current && !containerRef.current.contains(e.target as Node)) {
        setIsOpen(false);
      }
    };

    window.addEventListener('keydown', handleGlobalKey);
    document.addEventListener('mousedown', handleClickOutside);
    return () => {
      window.removeEventListener('keydown', handleGlobalKey);
      document.removeEventListener('mousedown', handleClickOutside);
    };
  }, [isOpen]);

  const handleChooseResult = (result: GlobalThreatSearchResult) => {
    onSelectTarget(result);
    setIsOpen(false);
  };

  const handleInputKeyDown = (e: React.KeyboardEvent<HTMLInputElement>) => {
    if (!isOpen && (e.key === 'ArrowDown' || e.key === 'Enter')) {
      setIsOpen(true);
      return;
    }
    if (!isOpen || visibleResults.length === 0) return;

    if (e.key === 'ArrowDown') {
      e.preventDefault();
      setHighlightedIdx((prev) => (prev + 1) % visibleResults.length);
    } else if (e.key === 'ArrowUp') {
      e.preventDefault();
      setHighlightedIdx((prev) => (prev - 1 + visibleResults.length) % visibleResults.length);
    } else if (e.key === 'Enter') {
      e.preventDefault();
      const target = visibleResults[highlightedIdx];
      if (target) handleChooseResult(target);
    }
  };

  return (
    <div ref={containerRef} className="relative">
      {/* Header Search Input & Mobile Trigger */}
      <div className="flex items-center">
        <div className="relative hidden sm:block">
          <Search className="w-3.5 h-3.5 absolute left-2.5 top-1/2 -translate-y-1/2 text-cyan-400 pointer-events-none" />
          <input
            ref={inputRef}
            type="text"
            role="combobox"
            aria-expanded={isOpen}
            aria-label="Global threat search across all regions and continents"
            placeholder="Query global threats..."
            value={query}
            onFocus={() => setIsOpen(true)}
            onChange={(e) => {
              setQuery(e.target.value);
              if (!isOpen) setIsOpen(true);
            }}
            onKeyDown={handleInputKeyDown}
            className="w-44 lg:w-52 xl:w-64 bg-slate-900/90 border border-slate-700/80 hover:border-cyan-500/40 focus:border-cyan-400 rounded-lg pl-8 pr-14 py-1.5 text-xs font-mono text-slate-100 placeholder-slate-500 focus:outline-none focus:ring-1 focus:ring-cyan-500/40 transition-all"
          />
          {query ? (
            <button
              type="button"
              onClick={() => {
                setQuery('');
                inputRef.current?.focus();
              }}
              aria-label="Clear global threat search"
              className="absolute right-2 top-1/2 -translate-y-1/2 text-slate-400 hover:text-slate-200 p-0.5 cursor-pointer"
            >
              <X className="w-3.5 h-3.5" />
            </button>
          ) : (
            <kbd className="absolute right-2 top-1/2 -translate-y-1/2 px-1.5 py-0.5 text-[9px] font-mono text-slate-400 bg-slate-950 border border-slate-800 rounded pointer-events-none">
              ⌘K
            </kbd>
          )}
        </div>

        {/* Compact Icon Trigger for Mobile */}
        <button
          type="button"
          onClick={() => {
            setIsOpen((prev) => !prev);
            requestAnimationFrame(() => inputRef.current?.focus());
          }}
          className="sm:hidden px-2.5 py-1.5 rounded-lg border border-slate-700 bg-slate-900 text-cyan-300 hover:border-cyan-500/40 text-xs font-mono flex items-center gap-1.5 cursor-pointer"
          title="Global Threat Search"
        >
          <Search className="w-3.5 h-3.5" />
        </button>
      </div>

      {/* Global Cross-Region Threat Search Dropdown */}
      {isOpen && (
        <div className="fixed sm:absolute left-4 right-4 sm:left-auto sm:right-0 top-16 sm:top-11 sm:w-[540px] lg:w-[620px] bg-slate-950/98 border border-cyan-500/40 rounded-xl shadow-2xl shadow-cyan-950/50 backdrop-blur-xl z-50 overflow-hidden">
          {/* Mobile Input Row inside Dropdown */}
          <div className="sm:hidden p-2.5 border-b border-slate-800 bg-slate-900/80">
            <div className="relative">
              <Search className="w-3.5 h-3.5 absolute left-2.5 top-1/2 -translate-y-1/2 text-cyan-400" />
              <input
                type="text"
                autoFocus
                placeholder="Search threats, countries, hotspots, chokepoints..."
                value={query}
                onChange={(e) => setQuery(e.target.value)}
                onKeyDown={handleInputKeyDown}
                className="w-full bg-slate-950 border border-slate-700 rounded-lg pl-8 pr-8 py-1.5 text-xs font-mono text-slate-100 placeholder-slate-500 focus:outline-none focus:border-cyan-400"
              />
              {query && (
                <button
                  type="button"
                  onClick={() => setQuery('')}
                  className="absolute right-2 top-1/2 -translate-y-1/2 text-slate-400 hover:text-slate-200"
                >
                  <X className="w-3.5 h-3.5" />
                </button>
              )}
            </div>
          </div>

          {/* Panel Header & Summary */}
          <div className="px-3.5 py-2 border-b border-slate-800/90 bg-slate-900/70 flex items-center justify-between gap-2 font-mono">
            <div className="flex items-center gap-2 text-[11px] text-cyan-300 font-semibold">
              <Globe2 className="w-3.5 h-3.5 text-cyan-400" />
              <span>GLOBAL THREAT MATRIX SEARCH</span>
            </div>
            <span className="text-[10px] text-slate-400 tabular-nums">
              {queryAndTierMatches.length} MATCHES ACROSS ALL REGIONS
            </span>
          </div>

          {/* Threat Tier Quick Filters */}
          <div className="px-3.5 py-2 border-b border-slate-800/70 bg-slate-950/60 flex flex-wrap items-center gap-1.5 font-mono text-[10px]">
            <span className="text-slate-500 mr-1">POSTURE:</span>
            <button
              type="button"
              onClick={() => setTierFilter('ALL')}
              className={`px-2 py-0.5 rounded border transition-colors cursor-pointer ${
                tierFilter === 'ALL'
                  ? 'bg-cyan-500/20 border-cyan-500/50 text-cyan-200 font-semibold'
                  : 'bg-slate-900 border-slate-800 text-slate-400 hover:text-slate-200'
              }`}
            >
              ALL
            </button>
            {THREAT_TIERS.slice()
              .reverse()
              .map((tier) => {
                const meta = THREAT_LEVEL_CONFIG[tier];
                const isActive = tierFilter === tier;
                return (
                  <button
                    key={tier}
                    type="button"
                    onClick={() => setTierFilter((prev) => (prev === tier ? 'ALL' : tier))}
                    className={`px-2 py-0.5 rounded border transition-colors flex items-center gap-1 cursor-pointer tabular-nums ${
                      isActive
                        ? meta.badgeClass
                        : 'bg-slate-900 border-slate-800 text-slate-400 hover:text-slate-200'
                    }`}
                  >
                    <span
                      className="w-1.5 h-1.5 rounded-full"
                      style={{ backgroundColor: meta.hexColor }}
                    />
                    <span>{tier.toUpperCase()}</span>
                    <span className="opacity-75">({tierCounts[tier]})</span>
                  </button>
                );
              })}
          </div>

          {/* Simultaneous Continent Match Breakdown Tabs */}
          <div className="px-3.5 py-1.5 border-b border-slate-800/80 bg-slate-900/40 flex items-center gap-1 overflow-x-auto custom-scrollbar font-mono text-[10px]">
            {CONTINENTS.map((cont) => {
              const count = continentCounts[cont.id] ?? 0;
              const isActive = continentScope === cont.id;
              return (
                <button
                  key={cont.id}
                  type="button"
                  onClick={() => setContinentScope(cont.id)}
                  className={`px-2 py-0.5 rounded whitespace-nowrap shrink-0 flex items-center gap-1 transition-colors cursor-pointer tabular-nums ${
                    isActive
                      ? 'bg-cyan-500 text-slate-950 font-bold'
                      : count > 0
                        ? 'text-slate-300 hover:bg-slate-800'
                        : 'text-slate-600 hover:text-slate-400'
                  }`}
                >
                  <span>{cont.id === 'all' ? 'All Regions' : cont.code}</span>
                  <span className="opacity-80">({count})</span>
                </button>
              );
            })}
          </div>

          {/* Matching Threat Records List */}
          <div className="max-h-80 overflow-y-auto custom-scrollbar divide-y divide-slate-800/60">
            {visibleResults.length === 0 ? (
              <div className="p-6 text-center space-y-2">
                <p className="text-xs font-mono text-slate-300">
                  NO MATCHING THREAT TELEMETRY FOUND
                </p>
                <p className="text-[11px] text-slate-500">
                  Try querying a country (&ldquo;Taiwan&rdquo;, &ldquo;USA&rdquo;), continent (&ldquo;Europe&rdquo;, &ldquo;APAC&rdquo;), maritime chokepoint (&ldquo;Hormuz&rdquo;), or threat topic (&ldquo;cyber&rdquo;, &ldquo;maritime&rdquo;, &ldquo;Critical&rdquo;).
                </p>
                {(tierFilter !== 'ALL' || continentScope !== 'all' || query) && (
                  <button
                    type="button"
                    onClick={() => {
                      setQuery('');
                      setTierFilter('ALL');
                      setContinentScope('all');
                    }}
                    className="mt-1 px-2.5 py-1 rounded bg-slate-900 border border-slate-700 text-[11px] font-mono text-cyan-300 hover:border-cyan-500/40 cursor-pointer"
                  >
                    RESET SEARCH FILTERS
                  </button>
                )}
              </div>
            ) : (
              visibleResults.map((res, idx) => {
                const meta = THREAT_LEVEL_CONFIG[res.tier];
                const isSelected = res.country === selectedCountry && res.kind === 'country';
                const isHighlighted = idx === highlightedIdx;

                return (
                  <button
                    key={res.id}
                    type="button"
                    onMouseEnter={() => setHighlightedIdx(idx)}
                    onClick={() => handleChooseResult(res)}
                    className={`w-full text-left px-3.5 py-2.5 transition-colors flex items-start justify-between gap-3 cursor-pointer ${
                      isHighlighted
                        ? 'bg-cyan-500/12'
                        : isSelected
                          ? 'bg-slate-900/90'
                          : 'hover:bg-slate-900/70'
                    }`}
                  >
                    <div className="flex items-start gap-2.5 min-w-0">
                      <div className="mt-0.5 shrink-0">
                        {res.kind === 'hotspot' ? (
                          <Flame className="w-4 h-4 text-rose-400" />
                        ) : res.kind === 'chokepoint' ? (
                          <Anchor className="w-4 h-4 text-amber-400" />
                        ) : res.kind === 'alert' ? (
                          <AlertTriangle className="w-4 h-4 text-amber-400" />
                        ) : res.matchedArticle ? (
                          <Newspaper className="w-4 h-4 text-cyan-400" />
                        ) : (
                          <Compass className="w-4 h-4 text-slate-400" />
                        )}
                      </div>

                      <div className="min-w-0">
                        <div className="flex items-center gap-2 flex-wrap">
                          <span className="text-xs font-semibold text-slate-100 truncate">
                            {res.title}
                          </span>
                          <span className="px-1.5 py-0.2 rounded bg-slate-900 border border-slate-700 text-[10px] font-mono text-slate-300">
                            {res.code}
                          </span>
                          <span className="text-[10px] font-mono text-cyan-400/90">
                            {res.continent}
                          </span>
                          {isSelected && (
                            <span className="text-[9px] font-mono text-emerald-400 flex items-center gap-0.5">
                              <Crosshair className="w-2.5 h-2.5" /> LOCKED
                            </span>
                          )}
                        </div>
                        <p className="text-[11px] text-slate-400 truncate mt-0.5">
                          {res.matchContext}
                        </p>
                      </div>
                    </div>

                    <div className="shrink-0 flex flex-col items-end gap-1">
                      <span
                        className={`px-1.5 py-0.5 rounded border text-[10px] font-mono font-bold whitespace-nowrap ${meta.badgeClass}`}
                      >
                        {res.tier.toUpperCase()}
                      </span>
                      <span className="text-[9px] font-mono text-slate-500 uppercase">
                        {res.kind}
                      </span>
                    </div>
                  </button>
                );
              })
            )}
          </div>

          {/* Footer Hints */}
          <div className="px-3.5 py-1.5 border-t border-slate-800/80 bg-slate-900/70 flex items-center justify-between text-[10px] font-mono text-slate-500">
            <span className="flex items-center gap-1.5">
              <ShieldAlert className="w-3 h-3 text-cyan-400" />
              SELECT ANY TARGET TO FLY GLOBE &amp; LOAD TELEMETRY
            </span>
            <span className="hidden sm:inline">↑↓ NAVIGATE · ↵ LOCK · ESC CLOSE</span>
          </div>
        </div>
      )}
    </div>
  );
}
