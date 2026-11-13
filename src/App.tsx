import { useEffect, useMemo, useRef, useState } from 'react';
import {
  AlertTriangle,
  Bell,
  BellOff,
  BellRing,
  CheckCircle2,
  Globe2,
  RefreshCw,
  RotateCcw,
  Search,
  Terminal,
  Zap,
} from 'lucide-react';
import DetailModal from './components/DetailModal';
import GlobalThreatSearch, { type GlobalThreatSearchResult } from './components/GlobalThreatSearch';
import IntelDrawer from './components/IntelDrawer';
import ThreatTrendPanel from './components/ThreatTrendPanel';
import WorldMap3D from './components/WorldMap3D';
import {
  CONTINENTS,
  COUNTRY_DATA,
  COUNTRY_NODES,
  THREAT_LEVEL_CONFIG,
  THREAT_TIERS,
  createLiveScrapedArticle,
  getCountryIntel,
  getInitialThreatTier,
  type Article,
  type PressConference,
  type ThreatAlert,
  type ThreatLevelTier,
} from './data/intelData';

const CATEGORIES = ['All', 'Technology', 'Security', 'Economy', 'Politics'] as const;

export default function App() {
  const [selectedContinent, setSelectedContinent] = useState<string>('all');
  const [selectedCountry, setSelectedCountry] = useState<string | null>('United States');
  const [selectedCountryMeta, setSelectedCountryMeta] = useState<
    { lat: number; lon: number; continent: string } | undefined
  >(undefined);
  const [hoveredCountry, setHoveredCountry] = useState<string | null>(null);
  const [activeTab, setActiveTab] = useState<'overview' | 'press'>('overview');
  const [filterCategory, setFilterCategory] = useState<string>('All');
  const [searchQuery, setSearchQuery] = useState<string>('');
  const [isScrapingLive, setIsScrapingLive] = useState<boolean>(false);
  const [isSummarizing, setIsSummarizing] = useState<boolean>(false);
  const [alternateBriefingMap, setAlternateBriefingMap] = useState<Record<string, boolean>>({});
  const [scrapedArticlesByCountry, setScrapedArticlesByCountry] = useState<Record<string, Article[]>>({});
  const [selectedArticle, setSelectedArticle] = useState<Article | null>(null);
  const [selectedPressConference, setSelectedPressConference] = useState<PressConference | null>(null);

  // Threat Level Alert System State
  const [threatOverrides, setThreatOverrides] = useState<Record<string, ThreatLevelTier>>({});
  const [alerts, setAlerts] = useState<ThreatAlert[]>([]);
  const [activeMapAlert, setActiveMapAlert] = useState<ThreatAlert | null>(null);
  const [showAlertsPanel, setShowAlertsPanel] = useState<boolean>(false);
  const alertTimerRef = useRef<number | null>(null);

  // Device Push Notification State
  const [notificationPermission, setNotificationPermission] = useState<NotificationPermission | 'unsupported'>(() => {
    if (typeof window === 'undefined' || !('Notification' in window)) return 'unsupported';
    return Notification.permission;
  });
  const [pushEnabled, setPushEnabled] = useState<boolean>(() => {
    if (typeof window === 'undefined' || !('Notification' in window)) return false;
    return Notification.permission === 'granted';
  });

  const [scrapeLogs, setScrapeLogs] = useState<string[]>([
    '[08:42:10] CONNECTED to global proxy gateway wss://edge.aegis.int/v2',
    '[08:42:11] RSS_PARSER: Synchronized 14 feed endpoints via CORS bypass',
    '[08:42:14] NLP_AGENT: Vector embeddings compiled for 84 headline dispatches',
  ]);

  useEffect(() => {
    return () => {
      if (alertTimerRef.current !== null) {
        window.clearTimeout(alertTimerRef.current);
      }
    };
  }, []);

  const currentThreatTier: ThreatLevelTier = useMemo(() => {
    if (!selectedCountry) return 'Elevated';
    return threatOverrides[selectedCountry] ?? getInitialThreatTier(selectedCountry);
  }, [threatOverrides, selectedCountry]);

  const currentIntel = useMemo(() => {
    const base = getCountryIntel(selectedCountry, selectedContinent, selectedCountryMeta);
    const liveItems = selectedCountry
      ? scrapedArticlesByCountry[selectedCountry] ?? []
      : Object.values(scrapedArticlesByCountry).flat();
    const tierMeta = THREAT_LEVEL_CONFIG[currentThreatTier];
    return {
      ...base,
      threatLevel: tierMeta.label,
      threatColor: tierMeta.badgeClass,
      newsCount: base.newsCount + liveItems.length,
      articles: [...liveItems, ...base.articles],
    };
  }, [selectedCountry, selectedContinent, selectedCountryMeta, scrapedArticlesByCountry, currentThreatTier]);

  const filteredArticles = useMemo(() => {
    let items = currentIntel.articles || [];
    if (filterCategory !== 'All') {
      items = items.filter((a) => a.category.toLowerCase() === filterCategory.toLowerCase());
    }
    if (searchQuery.trim()) {
      const q = searchQuery.toLowerCase();
      items = items.filter(
        (a) =>
          a.title.toLowerCase().includes(q) ||
          a.summary.toLowerCase().includes(q) ||
          a.source.toLowerCase().includes(q)
      );
    }
    return items;
  }, [currentIntel, filterCategory, searchQuery]);

  const countryAlerts = useMemo(
    () => (selectedCountry ? alerts.filter((a) => a.country === selectedCountry) : alerts),
    [alerts, selectedCountry]
  );

  const sendDevicePushNotification = (alert: ThreatAlert) => {
    if (!pushEnabled || typeof window === 'undefined' || !('Notification' in window)) return;
    if (Notification.permission !== 'granted') return;

    const direction = alert.isEscalation ? 'ESCALATION' : 'UPDATE';
    const newMeta = THREAT_LEVEL_CONFIG[alert.newTier];
    try {
      const notif = new Notification(`AEGIS HORIZON // ${direction}: ${alert.country}`, {
        body: `${alert.country} [${alert.code}] threat level changed from ${alert.previousTier} to ${newMeta.label}.\n${alert.reason}`,
        tag: `aegis-threat-${alert.country}`,
      });
      notif.onclick = () => {
        window.focus();
        setSelectedCountry(alert.country);
        notif.close();
      };
    } catch {
      // Ignore notification construction errors in restricted iframe sandboxes
    }
  };

  const triggerThreatLevelChange = (
    country: string,
    newTier: ThreatLevelTier,
    reason = 'Manual command posture adjustment.'
  ) => {
    const previousTier = threatOverrides[country] ?? getInitialThreatTier(country);
    if (previousTier === newTier) return;

    const previousRank = THREAT_LEVEL_CONFIG[previousTier].defconRank;
    const newRank = THREAT_LEVEL_CONFIG[newTier].defconRank;
    const isEscalation = newRank < previousRank;
    const info = COUNTRY_DATA[country];
    const node = COUNTRY_NODES.find((n) => n.name === country);
    const timestamp = new Date().toLocaleTimeString([], { hour12: false });

    const newAlert: ThreatAlert = {
      id: `alert-${country}-${Date.now()}`,
      country,
      code:
        info?.code ??
        node?.code ??
        (country.replace(/[^A-Za-z]/g, '').slice(0, 3).toUpperCase() || 'INT'),
      continent:
        info?.continent ??
        node?.continent ??
        (country === selectedCountry ? selectedCountryMeta?.continent : undefined) ??
        'Global',
      previousTier,
      newTier,
      timestamp,
      reason,
      isEscalation,
    };

    setThreatOverrides((prev) => ({
      ...prev,
      [country]: newTier,
    }));
    setAlerts((prev) => [newAlert, ...prev.slice(0, 19)]);
    setActiveMapAlert(newAlert);

    if (alertTimerRef.current !== null) {
      window.clearTimeout(alertTimerRef.current);
    }
    alertTimerRef.current = window.setTimeout(() => {
      setActiveMapAlert((current) => (current?.id === newAlert.id ? null : current));
    }, 10000);

    setScrapeLogs((prev) => [
      `[${timestamp}] ALERT_${isEscalation ? 'ESCALATION' : 'SHIFT'}: ${country.toUpperCase()} (${previousTier} → ${THREAT_LEVEL_CONFIG[newTier].label})`,
      ...prev.slice(0, 12),
    ]);

    sendDevicePushNotification(newAlert);
  };

  const handleTogglePushNotifications = async () => {
    const timestamp = new Date().toLocaleTimeString([], { hour12: false });
    if (typeof window === 'undefined' || !('Notification' in window)) {
      setNotificationPermission('unsupported');
      setScrapeLogs((prev) => [
        `[${timestamp}] PUSH_NOTIFY: Browser Notification API unavailable in this environment.`,
        ...prev.slice(0, 12),
      ]);
      return;
    }

    if (Notification.permission === 'granted') {
      const next = !pushEnabled;
      setPushEnabled(next);
      setScrapeLogs((prev) => [
        `[${timestamp}] PUSH_NOTIFY: Device push alerts ${next ? 'ENABLED' : 'MUTED'}.`,
        ...prev.slice(0, 12),
      ]);
      return;
    }

    if (Notification.permission === 'denied') {
      setNotificationPermission('denied');
      setPushEnabled(false);
      setScrapeLogs((prev) => [
        `[${timestamp}] PUSH_NOTIFY: Permission blocked by browser site settings. Visual map alerts remain active.`,
        ...prev.slice(0, 12),
      ]);
      return;
    }

    try {
      const result = await Notification.requestPermission();
      setNotificationPermission(result);
      if (result === 'granted') {
        setPushEnabled(true);
        setScrapeLogs((prev) => [
          `[${timestamp}] PUSH_NOTIFY: Device permission GRANTED. Real-time threat push alerts active.`,
          ...prev.slice(0, 12),
        ]);
        try {
          new Notification('AEGIS HORIZON // Push Alerts Armed', {
            body: 'Device push notifications are active for regional threat level transitions.',
          });
        } catch {
          // Ignore sandbox restriction
        }
      } else {
        setPushEnabled(false);
        setScrapeLogs((prev) => [
          `[${timestamp}] PUSH_NOTIFY: Permission ${result.toUpperCase()}. Visual map alerts remain active.`,
          ...prev.slice(0, 12),
        ]);
      }
    } catch {
      setScrapeLogs((prev) => [
        `[${timestamp}] PUSH_NOTIFY: Unable to prompt for notification permission in current context.`,
        ...prev.slice(0, 12),
      ]);
    }
  };

  const handleSimulateThreatShift = () => {
    const targetName = selectedCountry || COUNTRY_NODES[0].name;
    const currentTier = threatOverrides[targetName] ?? getInitialThreatTier(targetName);
    const currentIdx = THREAT_TIERS.indexOf(currentTier);
    const nextTier = THREAT_TIERS[(currentIdx + 1) % THREAT_TIERS.length];

    const reasons: Record<ThreatLevelTier, string> = {
      Guarded: 'Regional sensors confirm de-escalation and normal maritime corridor flow.',
      Standard: 'Routine surveillance baseline restored across telecom and airspace grids.',
      Elevated: 'Anomalous maritime AIS drift & elevated cyber scan telemetry detected.',
      Critical: 'High-priority multi-domain sensor alert triggered along regional chokepoints.',
    };

    triggerThreatLevelChange(targetName, nextTier, reasons[nextTier]);
  };

  const handleSelectContinent = (continentId: string) => {
    setSelectedContinent(continentId);
    if (continentId !== 'all' && selectedCountry) {
      const matchingNodes = COUNTRY_NODES.filter((n) => n.continent === continentId);
      const currentInContinent =
        matchingNodes.some((n) => n.name === selectedCountry) ||
        selectedCountryMeta?.continent === continentId;
      if (!currentInContinent) {
        setSelectedCountry(null);
        setSelectedCountryMeta(undefined);
      }
    }
  };

  const handleSelectCountry = (
    country: string | null,
    meta?: { lat: number; lon: number; continent: string }
  ) => {
    setSelectedCountry(country);
    setSelectedCountryMeta(country ? meta : undefined);
    const timestamp = new Date().toLocaleTimeString([], { hour12: false });
    setScrapeLogs((prev) => [
      country
        ? `[${timestamp}] TARGET_LOCK: Switched intelligence focus to ${country.toUpperCase()}`
        : `[${timestamp}] FOCUS_CLEARED: Returned to Global Orbit (no country selected)`,
      ...prev.slice(0, 11),
    ]);
  };

  const handleResetFocus = () => {
    setSelectedContinent('all');
    setSelectedCountry(null);
    setSelectedCountryMeta(undefined);
    setFilterCategory('All');
    setSearchQuery('');
    setActiveMapAlert(null);
    const timestamp = new Date().toLocaleTimeString([], { hour12: false });
    setScrapeLogs((prev) => [
      `[${timestamp}] RESET_FOCUS: Cleared country target and restored Global View.`,
      ...prev.slice(0, 11),
    ]);
  };

  const handleSelectGlobalThreat = (result: GlobalThreatSearchResult) => {
    if (selectedContinent !== 'all' && selectedContinent !== result.continent) {
      setSelectedContinent('all');
    }
    setSelectedCountry(result.country);
    setSelectedCountryMeta({
      lat: result.lat,
      lon: result.lon,
      continent: result.continent,
    });
    setActiveTab('overview');
    setFilterCategory('All');
    setSearchQuery('');

    const timestamp = new Date().toLocaleTimeString([], { hour12: false });
    setScrapeLogs((prev) => [
      `[${timestamp}] GLOBAL_SEARCH: Locked ${result.kind.toUpperCase()} "${result.title}" [${result.continent} · ${result.tier.toUpperCase()}]`,
      ...prev.slice(0, 11),
    ]);
  };

  const triggerLiveScrape = () => {
    if (isScrapingLive) return;
    setIsScrapingLive(true);
    const targetCountry = selectedCountry ?? 'Global Mesh';
    const timestamp = new Date().toLocaleTimeString([], { hour12: false });
    setScrapeLogs((prev) => [
      `[${timestamp}] INITIATING live fetch for ${targetCountry}...`,
      `[${timestamp}] BYPASSING CORS via HTTPS proxy pipeline (GNews / RSS2JSON)...`,
      ...prev.slice(0, 10),
    ]);

    setTimeout(() => {
      const finishTime = new Date().toLocaleTimeString([], { hour12: false });
      const existingCount = scrapedArticlesByCountry[targetCountry]?.length ?? 0;
      const freshArticle = createLiveScrapedArticle(targetCountry, existingCount);

      setScrapedArticlesByCountry((prev) => ({
        ...prev,
        [targetCountry]: [freshArticle, ...(prev[targetCountry] ?? [])],
      }));
      setScrapeLogs((prev) => [
        `[${finishTime}] SUCCESS: Received 200 OK. 18 items scanned, 1 priority dispatch indexed for ${targetCountry}.`,
        `[${finishTime}] AI SENTIMENT AGENT: Classification finished (76% Neutral, 24% Positive)`,
        ...prev.slice(0, 12),
      ]);
      setIsScrapingLive(false);
    }, 1100);
  };

  const refreshAISummary = () => {
    if (isSummarizing) return;
    setIsSummarizing(true);
    const key = selectedCountry ?? '__GLOBAL__';
    setTimeout(() => {
      setAlternateBriefingMap((prev) => ({
        ...prev,
        [key]: !prev[key],
      }));
      setIsSummarizing(false);
    }, 750);
  };

  return (
    <div className="min-h-screen flex flex-col bg-slate-950 text-slate-100 scanline">
      {/* Top Telemetry Header */}
      <header className="border-b border-cyan-500/20 bg-slate-950/90 backdrop-blur-md sticky top-0 z-40 px-4 lg:px-6 py-2.5">
        <div className="flex items-center justify-between gap-3">
          {/* Brand Logo & Mission Title */}
          <div className="flex items-center space-x-3 shrink-0">
            <div className="h-9 w-9 rounded-lg bg-gradient-to-br from-cyan-500 to-blue-600 flex items-center justify-center shadow-lg shadow-cyan-500/20 border border-cyan-300/40">
              <Globe2 className="w-5 h-5 text-slate-950 stroke-[2.25]" />
            </div>
            <div>
              <div className="flex items-center gap-2">
                <span className="font-mono text-base font-bold tracking-wider text-cyan-400 whitespace-nowrap">
                  AEGIS // HORIZON
                </span>
                <span className="px-1.5 py-0.5 rounded text-[10px] font-mono bg-cyan-950 text-cyan-300 border border-cyan-500/30 whitespace-nowrap">
                  GOD_VIEW v2.4
                </span>
              </div>
              <p className="text-[11px] text-slate-400 font-mono hidden sm:block whitespace-nowrap">
                GLOBAL MULTI-SOURCE INTELLIGENCE &amp; PRESS SURVEILLANCE
              </p>
            </div>
          </div>

          {/* Geographic Hierarchy Selector (Continent Filter) */}
          <nav
            aria-label="Geographic Theater Filter"
            className="hidden md:flex items-center space-x-1 bg-slate-900/90 p-1 rounded-lg border border-slate-800 overflow-x-auto custom-scrollbar min-w-0 flex-1 max-w-fit"
          >
            {CONTINENTS.map((cont) => (
              <button
                key={cont.id}
                type="button"
                onClick={() => handleSelectContinent(cont.id)}
                className={`px-3 py-1.5 rounded-md text-xs font-mono transition-all flex items-center gap-1.5 whitespace-nowrap shrink-0 cursor-pointer ${
                  selectedContinent === cont.id
                    ? 'bg-cyan-500 text-slate-950 font-semibold shadow-md shadow-cyan-500/25'
                    : 'text-slate-400 hover:text-slate-200 hover:bg-slate-800/60'
                }`}
              >
                <span>{cont.name}</span>
                <span
                  className={`text-[10px] px-1 rounded tabular-nums ${
                    selectedContinent === cont.id
                      ? 'bg-cyan-600 text-cyan-100'
                      : 'bg-slate-800 text-slate-400'
                  }`}
                >
                  {cont.count}
                </span>
              </button>
            ))}
          </nav>

          {/* Quick Actions: Global Threat Search, Push Toggle, Alerts Log, Live Scrape */}
          <div className="flex items-center space-x-2 shrink-0 relative">
            <GlobalThreatSearch
              selectedCountry={selectedCountry}
              threatOverrides={threatOverrides}
              scrapedArticlesByCountry={scrapedArticlesByCountry}
              alerts={alerts}
              onSelectTarget={handleSelectGlobalThreat}
            />

            {/* Device Push Notification Toggle */}
            <button
              type="button"
              onClick={handleTogglePushNotifications}
              className={`px-2.5 py-1.5 rounded-lg border text-xs font-mono flex items-center gap-1.5 transition-all whitespace-nowrap cursor-pointer ${
                pushEnabled
                  ? 'border-emerald-500/40 bg-emerald-500/10 text-emerald-300 hover:bg-emerald-500/20'
                  : notificationPermission === 'denied'
                    ? 'border-rose-500/30 bg-rose-500/10 text-rose-300'
                    : 'border-slate-700 bg-slate-900 text-slate-300 hover:border-cyan-500/40 hover:text-cyan-300'
              }`}
              title={
                notificationPermission === 'unsupported'
                  ? 'Browser push notifications not supported'
                  : notificationPermission === 'denied'
                    ? 'Notifications blocked in browser settings'
                    : pushEnabled
                      ? 'Mute device push alerts'
                      : 'Enable device push alerts on threat level shifts'
              }
            >
              {pushEnabled ? (
                <BellRing className="w-3.5 h-3.5 text-emerald-400" />
              ) : notificationPermission === 'denied' ? (
                <BellOff className="w-3.5 h-3.5 text-rose-400" />
              ) : (
                <Bell className="w-3.5 h-3.5" />
              )}
              <span className="hidden xl:inline">
                {pushEnabled
                  ? 'PUSH: ON'
                  : notificationPermission === 'denied'
                    ? 'PUSH: BLOCKED'
                    : 'PUSH: OFF'}
              </span>
            </button>

            {/* Threat Alert Feed Button */}
            <button
              type="button"
              onClick={() => setShowAlertsPanel((prev) => !prev)}
              className={`px-2.5 py-1.5 rounded-lg border text-xs font-mono flex items-center gap-1.5 transition-all whitespace-nowrap cursor-pointer ${
                showAlertsPanel || alerts.length > 0
                  ? 'border-amber-500/40 bg-amber-500/10 text-amber-300 hover:bg-amber-500/20'
                  : 'border-slate-700 bg-slate-900 text-slate-300 hover:border-cyan-500/40'
              }`}
              title="View Region Threat Alert Feed"
            >
              <AlertTriangle className="w-3.5 h-3.5" />
              <span className="hidden sm:inline">ALERTS</span>
              <span className="px-1.5 py-0.2 rounded bg-slate-950/80 text-[10px] tabular-nums">
                {alerts.length}
              </span>
            </button>

            {/* Live Scrape Button */}
            <button
              type="button"
              onClick={triggerLiveScrape}
              disabled={isScrapingLive}
              className="px-3 py-1.5 rounded-lg border border-cyan-500/40 bg-cyan-500/10 hover:bg-cyan-500/20 text-cyan-300 text-xs font-mono flex items-center gap-2 transition-all shadow-sm disabled:opacity-50 whitespace-nowrap cursor-pointer"
              title="Execute Live Ingestion Proxy Pipeline"
            >
              <RefreshCw
                className={`w-3.5 h-3.5 ${isScrapingLive ? 'animate-spin text-cyan-400' : ''}`}
              />
              <span className="hidden sm:inline">{isScrapingLive ? 'SCRAPING...' : 'LIVE SCRAPE'}</span>
            </button>

            {/* Alerts History Popover */}
            {showAlertsPanel && (
              <div className="absolute right-0 top-11 w-80 sm:w-96 bg-slate-950/95 border border-cyan-500/40 rounded-xl shadow-2xl backdrop-blur-md z-50 overflow-hidden font-mono">
                <div className="px-3.5 py-2.5 border-b border-slate-800 flex items-center justify-between bg-slate-900/80">
                  <span className="text-xs font-bold text-cyan-300">REGION THREAT ALERTS</span>
                  <button
                    type="button"
                    onClick={handleSimulateThreatShift}
                    className="px-2 py-1 rounded bg-amber-500/15 hover:bg-amber-500/25 border border-amber-500/40 text-amber-300 text-[10px] flex items-center gap-1 cursor-pointer"
                  >
                    <Zap className="w-3 h-3" /> SIMULATE SHIFT
                  </button>
                </div>
                <div className="max-h-72 overflow-y-auto custom-scrollbar divide-y divide-slate-800/80">
                  {alerts.length === 0 ? (
                    <div className="p-5 text-center text-[11px] text-slate-400 space-y-2">
                      <p>NO THREAT TRANSITIONS LOGGED YET.</p>
                      <p className="text-slate-500 font-sans">
                        Change any country&apos;s Threat Posture or click &ldquo;SIMULATE SHIFT&rdquo; to trigger a
                        map and device alert.
                      </p>
                    </div>
                  ) : (
                    alerts.map((alert) => {
                      const meta = THREAT_LEVEL_CONFIG[alert.newTier];
                      return (
                        <button
                          key={alert.id}
                          type="button"
                          onClick={() => {
                            setSelectedCountry(alert.country);
                            setActiveMapAlert(alert);
                            setShowAlertsPanel(false);
                          }}
                          className="w-full text-left p-3 hover:bg-slate-900/80 transition-colors cursor-pointer block"
                        >
                          <div className="flex items-center justify-between text-[10px]">
                            <span className="font-bold text-white">
                              {alert.country.toUpperCase()} [{alert.code}]
                            </span>
                            <span className="text-slate-500 tabular-nums">{alert.timestamp}</span>
                          </div>
                          <div className="text-[11px] mt-1">
                            <span className="text-slate-400">{alert.previousTier}</span>{' '}
                            <span className="text-slate-600">→</span>{' '}
                            <span className="font-bold" style={{ color: meta.hexColor }}>
                              {meta.label}
                            </span>
                          </div>
                          <p className="text-[11px] font-sans text-slate-400 mt-1 line-clamp-2">
                            {alert.reason}
                          </p>
                        </button>
                      );
                    })
                  )}
                </div>
              </div>
            )}
          </div>
        </div>

        {/* Mobile Continent Selector Bar */}
        <div className="md:hidden flex items-center space-x-1 overflow-x-auto py-2 mt-2 border-t border-slate-900 custom-scrollbar">
          {CONTINENTS.map((cont) => (
            <button
              key={cont.id}
              type="button"
              onClick={() => handleSelectContinent(cont.id)}
              className={`px-2.5 py-1 rounded text-xs font-mono whitespace-nowrap shrink-0 cursor-pointer ${
                selectedContinent === cont.id
                  ? 'bg-cyan-500 text-slate-950 font-semibold'
                  : 'text-slate-400 bg-slate-900'
              }`}
            >
              {cont.name}
            </button>
          ))}
        </div>
      </header>

      {/* Main Dashboard Layout */}
      <main className="flex-1 grid grid-cols-1 lg:grid-cols-12 gap-4 p-4 lg:p-6">
        {/* Left/Center Column: World Map & Ingestion Pipeline */}
        <div className="lg:col-span-7 xl:col-span-8 flex flex-col gap-4">
          <div className="h-[480px] xl:h-[580px] w-full">
            <WorldMap3D
              selectedCountry={selectedCountry}
              onSelectCountry={handleSelectCountry}
              selectedContinent={selectedContinent}
              hoveredCountry={hoveredCountry}
              setHoveredCountry={setHoveredCountry}
              threatOverrides={threatOverrides}
              activeMapAlert={activeMapAlert}
              onDismissAlert={() => setActiveMapAlert(null)}
            />
          </div>

          {/* Geographic Hierarchy Breadcrumb & Search Bar */}
          <div className="bg-slate-900/70 border border-slate-800 rounded-xl p-3 flex flex-wrap items-center justify-between gap-3 backdrop-blur-sm">
            <div className="flex items-center gap-2 text-xs font-mono flex-wrap">
              <span className="text-slate-500">HIERARCHY:</span>
              <span className="text-cyan-400 font-semibold">
                {selectedContinent === 'all' ? 'Earth (Global)' : selectedContinent}
              </span>
              <span className="text-slate-600">➔</span>
              <span className="px-2 py-0.5 rounded bg-cyan-950 text-cyan-300 border border-cyan-500/30 font-bold">
                {selectedCountry ?? 'All Countries (None Locked)'}
              </span>
              <span className="text-slate-600">➔</span>
              <span className="text-slate-300 font-medium">{filterCategory} Feed</span>
            </div>

            <div className="flex flex-wrap items-center gap-2">
              <button
                type="button"
                onClick={handleResetFocus}
                className="px-2.5 py-1 rounded-lg bg-cyan-500/10 hover:bg-cyan-500/20 border border-cyan-500/40 text-cyan-300 text-[11px] font-mono flex items-center gap-1.5 transition-colors whitespace-nowrap cursor-pointer"
                title="Clear country selection and return to Global View"
              >
                <RotateCcw className="w-3 h-3" />
                RESET FOCUS
              </button>

              <button
                type="button"
                onClick={handleSimulateThreatShift}
                className="px-2.5 py-1 rounded-lg bg-amber-500/10 hover:bg-amber-500/20 border border-amber-500/40 text-amber-300 text-[11px] font-mono flex items-center gap-1.5 transition-colors whitespace-nowrap cursor-pointer"
                title="Cycle Threat Level for Active Target to Test Visual & Push Alerts"
              >
                <Zap className="w-3 h-3" />
                TEST THREAT SHIFT
              </button>

              <div className="relative">
                <Search className="w-3.5 h-3.5 absolute left-2.5 top-1/2 -translate-y-1/2 text-slate-500" />
                <input
                  type="text"
                  placeholder="Filter articles..."
                  value={searchQuery}
                  onChange={(e) => setSearchQuery(e.target.value)}
                  className="bg-slate-950 border border-slate-800 rounded-lg pl-8 pr-3 py-1 text-xs text-slate-200 placeholder-slate-600 focus:outline-none focus:border-cyan-500/50 w-36 sm:w-48 font-mono"
                />
              </div>

              <div className="flex items-center space-x-1 overflow-x-auto">
                {CATEGORIES.map((cat) => (
                  <button
                    key={cat}
                    type="button"
                    onClick={() => setFilterCategory(cat)}
                    className={`px-2 py-1 rounded text-[11px] font-mono transition-colors whitespace-nowrap shrink-0 cursor-pointer ${
                      filterCategory === cat
                        ? 'bg-cyan-500/20 text-cyan-300 border border-cyan-500/40'
                        : 'text-slate-400 hover:text-slate-200 hover:bg-slate-800'
                    }`}
                  >
                    {cat}
                  </button>
                ))}
              </div>
            </div>
          </div>

          {/* 30-Day Historical Threat Fluctuation Panel (Recharts) */}
          <ThreatTrendPanel
            selectedCountry={selectedCountry}
            countryCode={currentIntel.code}
            currentThreatTier={currentThreatTier}
            latestAlertReason={countryAlerts[0]?.reason}
          />

          {/* Scraping Pipeline Terminal Simulator Bar */}
          <div className="bg-slate-950 border border-slate-900 rounded-xl p-3 font-mono text-[11px] text-slate-400 flex flex-col gap-1.5 shadow-inner">
            <div className="flex items-center justify-between text-xs text-slate-500 border-b border-slate-900 pb-1.5">
              <div className="flex items-center gap-2">
                <Terminal className="w-3.5 h-3.5 text-cyan-400" />
                <span>FREE-API INGESTION &amp; SCRAPE PIPELINE (CORS-BYPASS SIMULATOR)</span>
              </div>
              <span className="text-emerald-400 flex items-center gap-1 whitespace-nowrap">
                <CheckCircle2 className="w-3 h-3" /> ACTIVE POLLING
              </span>
            </div>
            <div className="h-16 overflow-y-auto custom-scrollbar flex flex-col space-y-1 text-slate-400 tabular-nums">
              {scrapeLogs.map((log, idx) => (
                <div key={idx} className="leading-tight">
                  <span className="text-cyan-500/80">{log.slice(0, 10)}</span>
                  <span
                    className={
                      log.includes('ALERT_') ? 'text-amber-300 font-semibold' : 'text-slate-300'
                    }
                  >
                    {log.slice(10)}
                  </span>
                </div>
              ))}
            </div>
          </div>
        </div>

        {/* Right Column: Country Intelligence Drawer */}
        <div className="lg:col-span-5 xl:col-span-4 flex flex-col min-h-[420px] lg:h-[calc(100vh-108px)] lg:sticky lg:top-[84px]">
          <IntelDrawer
            selectedCountry={selectedCountry}
            currentIntel={currentIntel}
            currentThreatTier={currentThreatTier}
            onChangeThreatLevel={(tier) => {
              if (!selectedCountry) return;
              triggerThreatLevelChange(
                selectedCountry,
                tier,
                `Command posture updated to ${THREAT_LEVEL_CONFIG[tier].label} for ${selectedCountry}.`
              );
            }}
            countryAlerts={countryAlerts}
            activeTab={activeTab}
            setActiveTab={setActiveTab}
            filteredArticles={filteredArticles}
            isSummarizing={isSummarizing}
            useAlternateBriefing={Boolean(
              alternateBriefingMap[selectedCountry ?? '__GLOBAL__']
            )}
            onRefreshSummary={refreshAISummary}
            onResetFocus={handleResetFocus}
            onSelectArticle={(article) => {
              setSelectedPressConference(null);
              setSelectedArticle(article);
            }}
            onSelectPressConference={(pc) => {
              setSelectedArticle(null);
              setSelectedPressConference(pc);
            }}
          />
        </div>
      </main>

      {/* Dispatch Details & Press Transcript Modal */}
      <DetailModal
        countryName={selectedCountry}
        article={selectedArticle}
        pressConference={selectedPressConference}
        onClose={() => {
          setSelectedArticle(null);
          setSelectedPressConference(null);
        }}
      />
    </div>
  );
}
