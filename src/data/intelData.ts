export interface ContinentOption {
  id: string;
  name: string;
  code: string;
  count: number;
}

export interface Article {
  id: string;
  title: string;
  source: string;
  time: string;
  category: 'Technology' | 'Security' | 'Economy' | 'Politics';
  sentiment: 'Positive' | 'Neutral' | 'Critical';
  sentimentScore: string;
  summary: string;
  fullReport: string;
  coordinates: string;
  reliability: string;
}

export interface TranscriptLine {
  timestamp: string;
  speaker: string;
  text: string;
}

export interface PressConference {
  id: string;
  title: string;
  speaker: string;
  time: string;
  status: string;
  keyQuote: string;
  transcript: TranscriptLine[];
}

export type ThreatLevelTier = 'Guarded' | 'Standard' | 'Elevated' | 'Critical';

export interface ThreatLevelMeta {
  tier: ThreatLevelTier;
  label: string;
  shortLabel: string;
  badgeClass: string;
  nodeAlert: 'emerald' | 'cyan' | 'amber' | 'rose';
  hexColor: string;
  defconRank: number;
}

export const THREAT_TIERS: ThreatLevelTier[] = ['Guarded', 'Standard', 'Elevated', 'Critical'];

export const THREAT_LEVEL_CONFIG: Record<ThreatLevelTier, ThreatLevelMeta> = {
  Guarded: {
    tier: 'Guarded',
    label: 'Guarded (DEFCON 5)',
    shortLabel: 'Guarded',
    badgeClass: 'text-emerald-400 border-emerald-500/30 bg-emerald-500/10',
    nodeAlert: 'emerald',
    hexColor: '#10b981',
    defconRank: 5,
  },
  Standard: {
    tier: 'Standard',
    label: 'Standard',
    shortLabel: 'Standard',
    badgeClass: 'text-cyan-400 border-cyan-500/30 bg-cyan-500/10',
    nodeAlert: 'cyan',
    hexColor: '#06b6d4',
    defconRank: 4,
  },
  Elevated: {
    tier: 'Elevated',
    label: 'Elevated (DEFCON 4)',
    shortLabel: 'Elevated',
    badgeClass: 'text-amber-400 border-amber-500/30 bg-amber-500/10',
    nodeAlert: 'amber',
    hexColor: '#f59e0b',
    defconRank: 3,
  },
  Critical: {
    tier: 'Critical',
    label: 'Critical (DEFCON 2)',
    shortLabel: 'Critical',
    badgeClass: 'text-rose-400 border-rose-500/40 bg-rose-500/15',
    nodeAlert: 'rose',
    hexColor: '#f43f5e',
    defconRank: 2,
  },
};

export interface ThreatAlert {
  id: string;
  country: string;
  code: string;
  continent: string;
  previousTier: ThreatLevelTier;
  newTier: ThreatLevelTier;
  timestamp: string;
  reason: string;
  isEscalation: boolean;
}

export function getInitialThreatTier(countryName: string): ThreatLevelTier {
  const intel = COUNTRY_DATA[countryName];
  if (!intel) return 'Standard';
  const lvl = intel.threatLevel.toLowerCase();
  if (lvl.includes('critical')) return 'Critical';
  if (lvl.includes('elevated') || lvl.includes('moderate')) return 'Elevated';
  if (lvl.includes('guarded')) return 'Guarded';
  return 'Standard';
}

export interface CountryIntel {
  code: string;
  continent: string;
  capital: string;
  latLon: string;
  threatLevel: string;
  threatColor: string;
  newsCount: number;
  aiExecutiveSummary: string[];
  alternateBriefing: string[];
  pressConferences: PressConference[];
  articles: Article[];
}

export interface CountryNode {
  name: string;
  lat: number;
  lon: number;
  continent: string;
  count: number;
  alert: 'amber' | 'emerald' | 'cyan' | 'rose';
  code: string;
  label: string;
}

export interface Chokepoint {
  name: string;
  lat: number;
  lon: number;
  note: string;
  throughput: string;
  status: string;
}

export interface SatelliteNode {
  id: string;
  lat: number;
  lon: number;
  altitudeRadius: number;
  inclinationRad: number;
  phaseRad: number;
  speed: number;
  alt: string;
  status: string;
  footprint: string;
}

export interface Hotspot {
  name: string;
  lat: number;
  lon: number;
  radius: number;
  level: 'CRITICAL' | 'ELEVATED' | 'MODERATE';
  color: string;
  advisory: string;
}

export interface TelecomArc {
  from: [number, number];
  to: [number, number];
  color: number;
}

export const CONTINENT_VIEW_COORDS: Record<string, { lat: number; lon: number; distance: number }> = {
  all: { lat: 24, lon: -20, distance: 5.5 },
  'North America': { lat: 42, lon: -98, distance: 4.3 },
  Europe: { lat: 50, lon: 12, distance: 3.9 },
  Asia: { lat: 32, lon: 96, distance: 4.4 },
  'South America': { lat: -18, lon: -60, distance: 4.3 },
  Africa: { lat: 4, lon: 20, distance: 4.3 },
  Oceania: { lat: -25, lon: 138, distance: 4.2 },
};

export const CONTINENTS: ContinentOption[] = [
  { id: 'all', name: 'Global View', code: 'GLB', count: 177 },
  { id: 'North America', name: 'North America', code: 'NA', count: 23 },
  { id: 'Europe', name: 'Europe', code: 'EU', count: 39 },
  { id: 'Asia', name: 'Asia-Pacific', code: 'APAC', count: 47 },
  { id: 'South America', name: 'South America', code: 'LATAM', count: 13 },
  { id: 'Africa', name: 'Africa', code: 'AFR', count: 51 },
  { id: 'Oceania', name: 'Oceania', code: 'OCN', count: 4 },
];

export const COUNTRY_NODES: CountryNode[] = [
  { name: 'United States', lat: 38.9, lon: -77.04, continent: 'North America', count: 28, alert: 'amber', code: 'USA', label: 'WASHINGTON D.C. [NORAD-HQ]' },
  { name: 'United Kingdom', lat: 51.51, lon: -0.13, continent: 'Europe', count: 19, alert: 'emerald', code: 'GBR', label: 'LONDON [NATO-NORTH]' },
  { name: 'Germany', lat: 52.52, lon: 13.4, continent: 'Europe', count: 16, alert: 'cyan', code: 'DEU', label: 'BERLIN [EU-CYBER]' },
  { name: 'Japan', lat: 35.68, lon: 139.65, continent: 'Asia', count: 22, alert: 'amber', code: 'JPN', label: 'TOKYO [INDOPAC-CMD]' },
  { name: 'India', lat: 28.61, lon: 77.21, continent: 'Asia', count: 25, alert: 'cyan', code: 'IND', label: 'NEW DELHI [ISRO-SAT]' },
  { name: 'Brazil', lat: -15.79, lon: -47.88, continent: 'South America', count: 14, alert: 'emerald', code: 'BRA', label: 'BRASÍLIA [AMAZON-SAR]' },
  { name: 'South Africa', lat: -25.75, lon: 28.23, continent: 'Africa', count: 11, alert: 'amber', code: 'ZAF', label: 'PRETORIA [SKA-ARRAY]' },
  { name: 'Australia', lat: -35.28, lon: 149.13, continent: 'Oceania', count: 12, alert: 'cyan', code: 'AUS', label: 'CANBERRA [PINE-GAP]' },
  { name: 'Canada', lat: 45.42, lon: -75.7, continent: 'North America', count: 9, alert: 'cyan', code: 'CAN', label: 'OTTAWA [ARCTIC-WATCH]' },
  { name: 'France', lat: 48.86, lon: 2.35, continent: 'Europe', count: 14, alert: 'cyan', code: 'FRA', label: 'PARIS [ESA-COORD]' },
  { name: 'Singapore', lat: 1.35, lon: 103.82, continent: 'Asia', count: 18, alert: 'emerald', code: 'SGP', label: 'SINGAPORE [MALACCA-FLOW]' },
  { name: 'Egypt', lat: 30.04, lon: 31.24, continent: 'Africa', count: 8, alert: 'cyan', code: 'EGY', label: 'CAIRO [SUEZ-GATE]' },
];

export const CHOKEPOINTS: Chokepoint[] = [
  { name: 'Strait of Hormuz', lat: 26.56, lon: 56.25, note: 'Tension: Defcon 3', throughput: '20.5M bbl/day', status: 'ELEVATED ESCORT' },
  { name: 'Strait of Malacca', lat: 2.5, lon: 101.2, note: 'Vessel Congestion 94%', throughput: '84,000 vessels/yr', status: 'HIGH DENSITY' },
  { name: 'Bab el-Mandeb', lat: 12.58, lon: 43.33, note: 'Escort Patrol Active', throughput: '8.8M bbl/day', status: 'RESTRICTED TRANSIT' },
  { name: 'Taiwan Strait', lat: 24.5, lon: 119.5, note: 'Carrier Fleet Transit', throughput: '48% global container fleet', status: 'ACTIVE SURVEILLANCE' },
  { name: 'Suez Canal Gateway', lat: 30.58, lon: 32.27, note: 'Clearance Nominal', throughput: '55 ships/day', status: 'NOMINAL' },
  { name: 'Panama Canal Locks', lat: 9.08, lon: -79.68, note: 'Draft Restriction 44ft', throughput: '34 transits/day', status: 'WATER-LEVEL WATCH' },
];

export const SATELLITES: SatelliteNode[] = [
  { id: 'KH-11 KENNEN', lat: 48, lon: -40, altitudeRadius: 2.36, inclinationRad: 0.78, phaseRad: 0.2, speed: 0.14, alt: '420km LEO', status: 'ACTIVE OPTICAL', footprint: 'North Atlantic Corridor' },
  { id: 'SAR-LUPE 04', lat: 52, lon: 65, altitudeRadius: 2.42, inclinationRad: 1.25, phaseRad: 2.1, speed: 0.11, alt: '510km POLAR', status: 'RADAR SYNTH', footprint: 'Eurasian Steppe & Levant' },
  { id: 'SBIRS GEO-6', lat: 12, lon: 145, altitudeRadius: 2.56, inclinationRad: 0.22, phaseRad: 4.1, speed: 0.06, alt: '35,786km GEO', status: 'IR SCAN', footprint: 'Western Pacific Rim' },
  { id: 'COSMO-SkyMed', lat: -28, lon: -20, altitudeRadius: 2.46, inclinationRad: -0.92, phaseRad: 5.2, speed: 0.12, alt: '619km SSO', status: 'OCEAN WATCH', footprint: 'South Atlantic Basin' },
];

export const HOTSPOTS: Hotspot[] = [
  {
    name: 'Eastern Mediterranean Basin',
    lat: 34.5,
    lon: 31.5,
    radius: 0.13,
    level: 'CRITICAL',
    color: '#f43f5e',
    advisory: 'Multi-domain maritime radar jamming and airborne early-warning patrols logged across sector.',
  },
  {
    name: 'Red Sea Maritime Corridor',
    lat: 18.5,
    lon: 39.5,
    radius: 0.11,
    level: 'ELEVATED',
    color: '#f59e0b',
    advisory: 'Commercial shipping rerouting alerts active; naval surface escort corridors enforced.',
  },
  {
    name: 'South China Sea Spratly Sector',
    lat: 10.5,
    lon: 114.5,
    radius: 0.12,
    level: 'ELEVATED',
    color: '#f59e0b',
    advisory: 'High-frequency AIS transponder density and coast guard perimeter patrols observed.',
  },
  {
    name: 'Sahel Security Perimeter',
    lat: 15.5,
    lon: 2.5,
    radius: 0.14,
    level: 'MODERATE',
    color: '#06b6d4',
    advisory: 'Cross-border reconnaissance relays monitoring overland logistics and border checkpoints.',
  },
];

export const TELECOM_ARCS: TelecomArc[] = [
  { from: [38.9, -77.04], to: [51.51, -0.13], color: 0x06b6d4 }, // DC <-> London
  { from: [51.51, -0.13], to: [52.52, 13.4], color: 0x06b6d4 }, // London <-> Berlin
  { from: [52.52, 13.4], to: [28.61, 77.21], color: 0x06b6d4 }, // Berlin <-> New Delhi
  { from: [28.61, 77.21], to: [1.35, 103.82], color: 0x10b981 }, // New Delhi <-> Singapore
  { from: [1.35, 103.82], to: [35.68, 139.65], color: 0x10b981 }, // Singapore <-> Tokyo
  { from: [35.68, 139.65], to: [-35.28, 149.13], color: 0x38bdf8 }, // Tokyo <-> Canberra
  { from: [38.9, -77.04], to: [35.68, 139.65], color: 0xf59e0b }, // DC <-> Tokyo
  { from: [38.9, -77.04], to: [-15.79, -47.88], color: 0x06b6d4 }, // DC <-> Brasilia
  { from: [51.51, -0.13], to: [-25.75, 28.23], color: 0x06b6d4 }, // London <-> Pretoria
];

export const COUNTRY_DATA: Record<string, CountryIntel> = {
  'United States': {
    code: 'USA',
    continent: 'North America',
    capital: 'Washington, D.C.',
    latLon: "+38°53'51\" / -77°02'11\"",
    threatLevel: 'Elevated (DEFCON 4)',
    threatColor: 'text-amber-400 border-amber-500/30 bg-amber-500/10',
    newsCount: 28,
    aiExecutiveSummary: [
      'Federal Reserve holds benchmark rate amidst stabilizing core inflation data and resilient tech sector earnings.',
      'Bipartisan maritime security initiative ratified for enhanced Pacific monitoring and subsea fiber route hardening.',
      'Silicon Valley AI safety and semiconductor export framework undergoes congressional review.',
    ],
    alternateBriefing: [
      'Domestic 2nm lithography fabs in Arizona and Texas report ahead-of-schedule EUV calibration milestones.',
      'CISA & Energy Sector ISAC coordinate automated telemetry hardening across municipal grid substations.',
      'Trans-Atlantic power interconnect feasibility modeling enters joint review with European grid operators.',
    ],
    pressConferences: [
      {
        id: 'pc-us-1',
        title: 'White House National Security & Technology Briefing',
        speaker: 'Press Secretary & NSA Advisor',
        time: '24 mins ago',
        status: 'LIVE ARCHIVE',
        keyQuote: '"Autonomous critical infrastructure resilience remains our foremost multi-agency priority."',
        transcript: [
          {
            timestamp: '14:02:11 UTC',
            speaker: 'Press Secretary',
            text: 'Good afternoon. Today we are releasing the updated interagency directive on subsea telecommunications redundancy and energy grid telemetry.',
          },
          {
            timestamp: '14:04:45 UTC',
            speaker: 'NSA Advisor',
            text: 'Autonomous critical infrastructure resilience remains our foremost multi-agency priority. Over the past 90 days, joint exercises across 14 utility operators reduced anomaly isolation latency by 62%.',
          },
          {
            timestamp: '14:08:19 UTC',
            speaker: 'NSA Advisor',
            text: 'We are also expanding real-time threat indicator sharing with Pacific and European treaty partners covering orbital optical crosslinks and sovereign cloud boundaries.',
          },
        ],
      },
      {
        id: 'pc-us-2',
        title: 'Federal Reserve Policy Statement on Monetary Trajectory',
        speaker: 'Chairman Powell',
        time: '3 hours ago',
        status: 'VERIFIED',
        keyQuote: '"Data continuity confirms robust labor metrics while balance sheet runoff proceeds as scheduled."',
        transcript: [
          {
            timestamp: '11:30:00 UTC',
            speaker: 'Chairman Powell',
            text: 'The Committee decided to maintain the target range for the federal funds rate while continuing to assess incoming disinflationary trends.',
          },
          {
            timestamp: '11:33:18 UTC',
            speaker: 'Chairman Powell',
            text: 'Data continuity confirms robust labor metrics while balance sheet runoff proceeds as scheduled. Capital expenditure in domestic manufacturing and compute infrastructure remains historically elevated.',
          },
        ],
      },
    ],
    articles: [
      {
        id: 'us-1',
        title: 'Global Semiconductor Coalition Accelerates 2nm Lithography Deployments',
        source: 'Reuters Global Tech',
        time: '12m ago',
        category: 'Technology',
        sentiment: 'Positive',
        sentimentScore: '+0.78',
        summary: 'Joint consortium involving Arizona & Austin fabrication hubs signals early testing yields exceeding Q3 estimates.',
        fullReport: 'High-NA extreme ultraviolet lithography tools commissioned across Arizona and Austin wafer fabs have cleared initial defect-density benchmarks. Supply chain analysts indicate volume wafer ramp could stabilize advanced accelerator lead times by two quarters.',
        coordinates: '33.4484° N, 112.0740° W',
        reliability: '99.1% Tier-1 Wire',
      },
      {
        id: 'us-2',
        title: 'Trans-Atlantic Energy Grid Interconnect Feasibility Study Published',
        source: 'Financial Times',
        time: '45m ago',
        category: 'Economy',
        sentiment: 'Neutral',
        sentimentScore: '+0.12',
        summary: 'Assessment reveals subsea high-voltage DC lines could balance renewable diurnal peak loads between continents.',
        fullReport: 'Joint engineering modeling by North American and European transmission authorities evaluates bidirectional 525kV HVDC trunk lines capable of arbitrage across solar and wind peak time zones, contingent on seabed trenching protections.',
        coordinates: '40.7128° N, 74.0060° W',
        reliability: '97.8% Verified Press',
      },
      {
        id: 'us-3',
        title: 'Cybersecurity Directorate Flags Sophisticated Distributed Infrastructure Scans',
        source: 'Defense Intelligence Bulletin',
        time: '2h ago',
        category: 'Security',
        sentiment: 'Critical',
        sentimentScore: '-0.82',
        summary: 'Automated telemetry detected coordinated packet probes targeting municipal power SCADA protocols.',
        fullReport: 'Edge honeypot sensors across twelve regional balancing authorities logged synchronized DNP3 and IEC-61850 enumeration attempts originating from compromised edge routers. Mitigation signatures were pushed within 18 minutes with zero operational disruption.',
        coordinates: '38.8977° N, 77.0365° W',
        reliability: '98.6% Official Advisory',
      },
    ],
  },
  'United Kingdom': {
    code: 'GBR',
    continent: 'Europe',
    capital: 'London',
    latLon: "+51°30'26\" / -00°07'39\"",
    threatLevel: 'Guarded',
    threatColor: 'text-emerald-400 border-emerald-500/30 bg-emerald-500/10',
    newsCount: 19,
    aiExecutiveSummary: [
      'Bank of England outlines regulatory framework for institutional digital asset settlement sandboxes.',
      'North Sea offshore wind grid expansions hit record power generation milestones during winter swells.',
      'Diplomatic communiqué issued reaffirming defense supply agreements across eastern Baltic corridors.',
    ],
    alternateBriefing: [
      'UK Quantum Computing Centre validates fault-tolerant error-mitigation loops with partner labs in London and Oxford.',
      'Royal Navy deploys autonomous uncrewed surface and subsurface gliders along Celtic Sea subsea cable corridors.',
      'Treasury confirms bilateral green bond clearing partnership with Nordic sovereign funds.',
    ],
    pressConferences: [
      {
        id: 'pc-uk-1',
        title: 'Downing Street Geopolitical & Trade Update',
        speaker: 'Prime Minister Spox',
        time: '1h ago',
        status: 'OFFICIAL',
        keyQuote: '"UK clean energy investments continue to attract sovereign wealth partnerships."',
        transcript: [
          {
            timestamp: '13:15:00 UTC',
            speaker: 'Official Spokesperson',
            text: 'UK clean energy investments continue to attract sovereign wealth partnerships across offshore interconnectors and grid-scale storage.',
          },
          {
            timestamp: '13:18:40 UTC',
            speaker: 'Official Spokesperson',
            text: 'Simultaneously, maritime patrol allocations in the North Atlantic will integrate next-generation acoustic seabed sensors to safeguard data trunk integrity.',
          },
        ],
      },
    ],
    articles: [
      {
        id: 'uk-1',
        title: 'London AI Research Lab Announces Breakthrough in Quantum Simulation Algorithms',
        source: 'Nature Intelligence',
        time: '32m ago',
        category: 'Technology',
        sentiment: 'Positive',
        sentimentScore: '+0.88',
        summary: 'New quantum chemical approximation method cuts supercomputing drug discovery phases by 60%.',
        fullReport: 'Researchers demonstrated a variational tensor-network solver capable of modeling complex catalytic reaction pathways on hybrid classical-quantum clusters with substantially reduced qubit overhead.',
        coordinates: '51.5072° N, 0.1276° W',
        reliability: '99.4% Peer-Reviewed',
      },
      {
        id: 'uk-2',
        title: 'High Seas Maritime Patrols Deploy Unmanned Submersibles in North Atlantic',
        source: 'Naval Technology Monitor',
        time: '3h ago',
        category: 'Security',
        sentiment: 'Neutral',
        sentimentScore: '-0.05',
        summary: 'Autonomous glider arrays commissioned to monitor telecommunication trunk cables in the Celtic Sea.',
        fullReport: 'Six long-endurance autonomous underwater vehicles equipped with synthetic aperture sonar have commenced continuous patrol loops over high-capacity transatlantic fiber landing approaches.',
        coordinates: '50.1109° N, 5.5340° W',
        reliability: '96.5% Defense Wire',
      },
    ],
  },
  Germany: {
    code: 'DEU',
    continent: 'Europe',
    capital: 'Berlin',
    latLon: "+52°31'12\" / +13°24'17\"",
    threatLevel: 'Standard',
    threatColor: 'text-cyan-400 border-cyan-500/30 bg-cyan-500/10',
    newsCount: 16,
    aiExecutiveSummary: [
      'Industrial manufacturing index rebounds 1.8% driven by green hydrogen plant transitions in Rhine-Ruhr.',
      'European Union cyber defense interoperability summit hosted in Munich concludes with unified incident protocol.',
      'Renewable power generation hits 58% of domestic quarterly consumption.',
    ],
    alternateBriefing: [
      'Munich Quantum Valley hardware consortium achieves 99.6% two-qubit gate fidelity in cryogenic testbed.',
      'Automated rail freight corridors along the Baltic-Adriatic axis cut customs clearance latency by 45%.',
      'Federal grid agency accelerates North-South high-voltage corridor permitting.',
    ],
    pressConferences: [
      {
        id: 'pc-de-1',
        title: 'Federal Ministry for Economic Affairs & Climate Action',
        speaker: 'Vice Chancellor & Minister',
        time: '2h ago',
        status: 'VERIFIED',
        keyQuote: '"The decarbonization of our industrial core is proving technologically viable and economically sound."',
        transcript: [
          {
            timestamp: '12:05:00 UTC',
            speaker: 'Federal Minister',
            text: 'The decarbonization of our industrial core is proving technologically viable and economically sound, anchored by hydrogen-ready steel and chemical retrofits.',
          },
          {
            timestamp: '12:09:12 UTC',
            speaker: 'Federal Minister',
            text: 'Grid modernization metrics confirm steady reduction in curtailment losses across northern wind corridors.',
          },
        ],
      },
    ],
    articles: [
      {
        id: 'de-1',
        title: 'Munich Quantum Valley Integrates First Hybrid 100-Qubit Processor',
        source: 'Handelsblatt Tech',
        time: '1h ago',
        category: 'Technology',
        sentiment: 'Positive',
        sentimentScore: '+0.74',
        summary: 'Consortium achieves coherent gate operations at cryogenic thresholds without high-vacuum degradation.',
        fullReport: 'Joint academic and industrial engineering teams deployed a modular superconducting control backplane linking 100 physical qubits directly to Bavarian supercomputing pipelines.',
        coordinates: '48.1351° N, 11.5820° E',
        reliability: '98.2% Verified Press',
      },
      {
        id: 'de-2',
        title: 'Baltic Logistics Corridor Expands Rail Freight Automation Infrastructure',
        source: 'Deutsche Welle Business',
        time: '4h ago',
        category: 'Economy',
        sentiment: 'Neutral',
        sentimentScore: '+0.15',
        summary: 'Cross-border sensor relays reduce customs clearance latency for container trains by 45%.',
        fullReport: 'Digital automatic coupling trials and optical wayside telemetry allow seamless cross-border dispatch scheduling between Rostock, Hamburg, and Central European hubs.',
        coordinates: '53.5511° N, 9.9937° E',
        reliability: '97.0% Verified Press',
      },
    ],
  },
  Japan: {
    code: 'JPN',
    continent: 'Asia',
    capital: 'Tokyo',
    latLon: "+35°40'34\" / +139°46'02\"",
    threatLevel: 'Elevated',
    threatColor: 'text-amber-400 border-amber-500/30 bg-amber-500/10',
    newsCount: 22,
    aiExecutiveSummary: [
      'Ministry of Economy funds next-generation solid-state battery fabrication gigafactories.',
      'Joint naval aerospace radar integration test successful in East Sea international corridors.',
      'Cabinet approves emergency humanitarian response funding for disaster preparedness.',
    ],
    alternateBriefing: [
      'Grid-scale liquid sodium thermal & electrochemical storage enters commercial pilot in greater Tokyo.',
      'Rapid-deployment seismic ocean-bottom sensor arrays report 100% link uptime along the Nankai trough.',
      'METI signs critical gallium and silicon carbide supply resilience accord with regional partners.',
    ],
    pressConferences: [
      {
        id: 'pc-jp-1',
        title: 'Prime Minister Office — Regional Security & Economic Security Council',
        speaker: 'Chief Cabinet Secretary',
        time: '50m ago',
        status: 'LIVE DISPATCH',
        keyQuote: '"Resilience of supply chains and maritime peace in the Indo-Pacific remain unconditional priorities."',
        transcript: [
          {
            timestamp: '13:20:00 UTC',
            speaker: 'Chief Cabinet Secretary',
            text: 'Resilience of supply chains and maritime peace in the Indo-Pacific remain unconditional priorities for the Cabinet.',
          },
          {
            timestamp: '13:24:30 UTC',
            speaker: 'Chief Cabinet Secretary',
            text: 'Today the Council authorized accelerated subsidies for solid-state energy storage and resilient subsea optical repeater stations.',
          },
        ],
      },
    ],
    articles: [
      {
        id: 'jp-1',
        title: 'Tokyo Electric Power Tests Grid-Scale Liquid Sodium Storage Array',
        source: 'Nikkei Asian Review',
        time: '28m ago',
        category: 'Technology',
        sentiment: 'Positive',
        sentimentScore: '+0.81',
        summary: 'Substation pilot provides 12-hour continuous discharge capacity to stabilize offshore solar fluctuation.',
        fullReport: 'High-density modular sodium-ion and thermal storage racks achieved sub-second frequency response during peak evening ramp testing across metropolitan distribution feeders.',
        coordinates: '35.6762° N, 139.6503° E',
        reliability: '98.9% Tier-1 Wire',
      },
      {
        id: 'jp-2',
        title: 'Regional Satellite Telemetry Reports Unusual Deep Oceanic Acoustic Anomaly',
        source: 'Asia Geopolitics Digest',
        time: '2h ago',
        category: 'Security',
        sentiment: 'Critical',
        sentimentScore: '-0.65',
        summary: 'Seismologists clarify hydrothermal vent degassing near Izu-Ogasawara Trench as probable origin.',
        fullReport: 'Submarine hydrophone nodes recorded broadband low-frequency acoustic transients along the trench margin. Oceanographic vessels dispatched telemetry buoys confirming volcanic outgassing.',
        coordinates: '29.5000° N, 142.0000° E',
        reliability: '96.4% Scientific Wire',
      },
    ],
  },
  India: {
    code: 'IND',
    continent: 'Asia',
    capital: 'New Delhi',
    latLon: "+28°36'50\" / +77°12'32\"",
    threatLevel: 'Active Monitoring',
    threatColor: 'text-cyan-400 border-cyan-500/30 bg-cyan-500/10',
    newsCount: 25,
    aiExecutiveSummary: [
      'ISRO announces launch schedule for advanced spaceborne synthetic aperture radar constellation.',
      'UPI digital transaction volume breaks global record with 14.2 billion monthly settle points.',
      'Semiconductor assembly and test facility broke ground in Gujarat with international partners.',
    ],
    alternateBriefing: [
      'National Supercomputing Mission activates hybrid physics-AI monsoon forecast at 10km grid resolution.',
      'Andaman & Nicobar maritime surveillance hub hosts six-nation humanitarian response exercise.',
      'Renewable grid capacity additions exceed 18GW year-to-date across Rajasthan solar parks.',
    ],
    pressConferences: [
      {
        id: 'pc-in-1',
        title: 'Ministry of External Affairs Weekly Briefing',
        speaker: 'Official Spokesperson',
        time: '4h ago',
        status: 'OFFICIAL',
        keyQuote: '"India continues to champion multi-aligned technological sovereignty and equitable digital public goods."',
        transcript: [
          {
            timestamp: '10:15:00 UTC',
            speaker: 'MEA Spokesperson',
            text: 'India continues to champion multi-aligned technological sovereignty and equitable digital public goods across partner nations in the Global South.',
          },
          {
            timestamp: '10:19:22 UTC',
            speaker: 'MEA Spokesperson',
            text: 'Joint satellite telemetry sharing protocols for Indian Ocean cyclone early warning are now operational with twelve coastal states.',
          },
        ],
      },
    ],
    articles: [
      {
        id: 'in-1',
        title: 'National Supercomputing Mission Unveils High-Throughput Climate Model',
        source: 'The Hindu Tech & Science',
        time: '55m ago',
        category: 'Technology',
        sentiment: 'Positive',
        sentimentScore: '+0.69',
        summary: 'Monsoon predictive accuracy improved to 10-day granular grid resolution utilizing hybrid AI-physics simulation.',
        fullReport: 'Deployed across Param Rudra clusters, the coupled ocean-atmosphere neural operator cuts ensemble forecast runtime from 6 hours to 11 minutes.',
        coordinates: '18.5204° N, 73.8567° E',
        reliability: '98.1% Verified Press',
      },
      {
        id: 'in-2',
        title: 'Indian Ocean Naval Taskforce Conducts Joint Humanitarian Evacuation Drill',
        source: 'NDTV Defense',
        time: '3h ago',
        category: 'Security',
        sentiment: 'Neutral',
        sentimentScore: '+0.10',
        summary: 'Six nations participate in coordinated disaster response exercises off the Andaman coast.',
        fullReport: 'Amphibious sealift vessels and maritime patrol aircraft rehearsed rapid medical logistics, satellite mesh communications, and harbor clearance.',
        coordinates: '11.6234° N, 92.7265° E',
        reliability: '97.2% Defense Wire',
      },
    ],
  },
  Brazil: {
    code: 'BRA',
    continent: 'South America',
    capital: 'Brasília',
    latLon: "-15°47'38\" / -47°52'58\"",
    threatLevel: 'Guarded',
    threatColor: 'text-emerald-400 border-emerald-500/30 bg-emerald-500/10',
    newsCount: 14,
    aiExecutiveSummary: [
      'Amazonian real-time satellite deforestation monitoring registers lowest monthly loss in 7 years.',
      'Central Bank accelerates offline payment protocols for sovereign digital currency Drex.',
      'Agricultural export corridor expands bio-fuel shipping agreements with Mercosur partners.',
    ],
    alternateBriefing: [
      'Santos Port machine-vision grain terminal automation cuts Panamax vessel turnaround by 28 hours.',
      'INPE radar imaging constellation flags zero major illegal airstrip expansions in protected basin.',
      'Hydroelectric reservoir storage across Southeast basins reaches 78% seasonal capacity.',
    ],
    pressConferences: [
      {
        id: 'pc-br-1',
        title: 'Palácio do Planalto Environmental & Biome Protection Summit',
        speaker: 'Minister of Environment',
        time: '3h ago',
        status: 'VERIFIED',
        keyQuote: '"Zero illegal deforestation enforcement remains on track with AI satellite cross-validation."',
        transcript: [
          {
            timestamp: '11:10:00 UTC',
            speaker: 'Minister of Environment',
            text: 'Zero illegal deforestation enforcement remains on track with AI satellite cross-validation combining L-band SAR imagery and ground patrol telemetry.',
          },
        ],
      },
    ],
    articles: [
      {
        id: 'br-1',
        title: 'Santos Port Automates Grain Terminals with Machine Vision Freight Inspection',
        source: 'Folha de S.Paulo',
        time: '2h ago',
        category: 'Economy',
        sentiment: 'Positive',
        sentimentScore: '+0.54',
        summary: 'Turnaround duration for Panamax vessels decreases from 72 to 44 hours during peak harvest season.',
        fullReport: 'Overhead LiDAR and thermal inspection gates automate railcar-to-berth moisture grading and customs sealing along the Santos export corridor.',
        coordinates: '23.9608° S, 46.3336° W',
        reliability: '97.5% Verified Press',
      },
    ],
  },
  'South Africa': {
    code: 'ZAF',
    continent: 'Africa',
    capital: 'Pretoria',
    latLon: "-25°44'46\" / +28°11'17\"",
    threatLevel: 'Moderate',
    threatColor: 'text-amber-400 border-amber-500/30 bg-amber-500/10',
    newsCount: 11,
    aiExecutiveSummary: [
      'Renewable IPP independent grid connection reaches 4GW total milestone in Western Cape.',
      'Square Kilometre Array (SKA) mid-frequency telescope array commences primary digital synthesis tests.',
      'Cross-border regional security task force establishes anti-poaching drone monitoring belt.',
    ],
    alternateBriefing: [
      'Karoo SKA-Mid correlator prototype demonstrates sub-nanosecond fiber timing synchronization.',
      'Cape Town port container berth crane upgrades improve ship-to-shore dwell times by 19%.',
      'Grid stability reserve margins improve following battery storage commissioning in Northern Cape.',
    ],
    pressConferences: [
      {
        id: 'pc-za-1',
        title: 'Department of Mineral Resources and Energy Briefing',
        speaker: 'Director-General',
        time: '5h ago',
        status: 'ARCHIVE',
        keyQuote: '"Grid modernization contracts are successfully mitigating load curtailment risks."',
        transcript: [
          {
            timestamp: '09:00:00 UTC',
            speaker: 'Director-General',
            text: 'Grid modernization contracts are successfully mitigating load curtailment risks as independent utility-scale solar and storage projects synchronize onto the national backbone.',
          },
        ],
      },
    ],
    articles: [
      {
        id: 'za-1',
        title: 'Karoo Astronomy Hub Detects Ultra-Deep Radio Burst Series with SKA-Mid Prototype',
        source: 'Science Africa',
        time: '1h ago',
        category: 'Technology',
        sentiment: 'Positive',
        sentimentScore: '+0.85',
        summary: 'Astrophysicists trace synchronized galactic pulsar pulse train with unprecedented signal clarity.',
        fullReport: 'Early interferometry fringes across 16 newly commissioned dishes validated real-time FPGA beamforming pipelines at 1.4 GHz.',
        coordinates: '30.7129° S, 21.4438° E',
        reliability: '99.0% Scientific Wire',
      },
    ],
  },
  Australia: {
    code: 'AUS',
    continent: 'Oceania',
    capital: 'Canberra',
    latLon: "-35°16'51\" / +149°07'48\"",
    threatLevel: 'Standard',
    threatColor: 'text-cyan-400 border-cyan-500/30 bg-cyan-500/10',
    newsCount: 12,
    aiExecutiveSummary: [
      'Critical minerals strategic reserve expanded with bilateral battery supply pacts.',
      'Bureau of Meteorology deploys next-gen ocean glider flotilla in Southern Ocean.',
      'Cyber security advisory warns of supply chain firmware vulnerability patches.',
    ],
    alternateBriefing: [
      'Pilbara green hydrogen & direct-reduced iron pilot reaches Phase 2 civil engineering clearance.',
      'Northern maritime domain awareness radar network completes software-defined upgrade.',
      'CSIRO Antarctic telemetry buoys report sharper Southern Ocean thermal gradient readings.',
    ],
    pressConferences: [
      {
        id: 'pc-au-1',
        title: 'Australian Strategic Policy Institute Briefing',
        speaker: 'Defense & Technology Director',
        time: '2h ago',
        status: 'VERIFIED',
        keyQuote: '"Autonomous maritime surveillance capabilities in northern approaches are operational ahead of schedule."',
        transcript: [
          {
            timestamp: '12:20:00 UTC',
            speaker: 'Defense & Tech Director',
            text: 'Autonomous maritime surveillance capabilities in northern approaches are operational ahead of schedule, integrating over-the-horizon radar with high-altitude endurance drones.',
          },
        ],
      },
    ],
    articles: [
      {
        id: 'au-1',
        title: 'Pilbara Solar Hydrogen Hub Signs Direct Off-Take Protocol for Green Steel',
        source: 'Australian Financial Review',
        time: '45m ago',
        category: 'Economy',
        sentiment: 'Positive',
        sentimentScore: '+0.67',
        summary: '2.5 GW photovoltaic field project moves into phase 2 civil construction with zero carbon intensity certification.',
        fullReport: 'Electrolysis stacks powered by dedicated desert solar arrays will supply green hydrogen directly to Pilbara iron ore beneficiation plants.',
        coordinates: '20.7333° S, 116.8464° E',
        reliability: '98.4% Financial Wire',
      },
    ],
  },
  Canada: {
    code: 'CAN',
    continent: 'North America',
    capital: 'Ottawa',
    latLon: "+45°25'17\" / -75°41'50\"",
    threatLevel: 'Standard',
    threatColor: 'text-cyan-400 border-cyan-500/30 bg-cyan-500/10',
    newsCount: 9,
    aiExecutiveSummary: [
      'High-Arctic synthetic aperture radar ground station in Inuvik completes dual-polar antenna expansion.',
      'Federal critical minerals strategy funds three lithium & rare-earth processing corridors in Quebec.',
      'NORAD northern modernization radar relays register nominal atmospheric calibration.',
    ],
    alternateBriefing: [
      'St. Lawrence Seaway autonomous ice-monitoring sonar buoys enter seasonal deployment.',
      'Montreal AI safety consortium signs cross-border model auditing interoperability accord.',
      'Pacific liquefied energy terminal logistics reach 94% export berth readiness.',
    ],
    pressConferences: [
      {
        id: 'pc-ca-1',
        title: 'Department of National Defence Arctic Domain Briefing',
        speaker: 'NORAD Northern Commander',
        time: '2h ago',
        status: 'OFFICIAL',
        keyQuote: '"Polar over-the-horizon sensor coverage now provides continuous all-weather situational awareness."',
        transcript: [
          {
            timestamp: '12:40:00 UTC',
            speaker: 'NORAD Northern Commander',
            text: 'Polar over-the-horizon sensor coverage now provides continuous all-weather situational awareness across the Northwest Passage and High Arctic.',
          },
        ],
      },
    ],
    articles: [
      {
        id: 'ca-1',
        title: 'Inuvik Polar Ground Station Expands Real-Time Satellite Downlink Capacity',
        source: 'Canadian Space Dispatch',
        time: '1h ago',
        category: 'Technology',
        sentiment: 'Positive',
        sentimentScore: '+0.72',
        summary: 'High-latitude Ka-band dishes increase polar-orbiting earth observation throughput by 40%.',
        fullReport: 'Dual-band tracking radomes positioned above the Arctic Circle enable low-latency maritime ice and vessel tracking telemetry for northern shipping.',
        coordinates: '68.3607° N, 133.7230° W',
        reliability: '98.0% Official Dispatch',
      },
    ],
  },
  France: {
    code: 'FRA',
    continent: 'Europe',
    capital: 'Paris',
    latLon: "+48°51'24\" / +02°21'08\"",
    threatLevel: 'Guarded',
    threatColor: 'text-emerald-400 border-emerald-500/30 bg-emerald-500/10',
    newsCount: 14,
    aiExecutiveSummary: [
      'Ariane 6 heavy orbital launch campaign confirms next multi-payload European reconnaissance manifest.',
      'Nuclear fleet grid availability hits 84% winter readiness, stabilizing EU wholesale electricity benchmarks.',
      'Paris AI & Cybersecurity Directorate issues sovereign cloud encryption certification standards.',
    ],
    alternateBriefing: [
      'Toulouse aerospace cluster validates optical satellite-to-ground laser downlink at 100 Gbps.',
      'Marseille subsea cable landing hubs expand Mediterranean-Red Sea fiber diversity.',
      'Mediterranean naval task group conducts air-defense interoperability drills.',
    ],
    pressConferences: [
      {
        id: 'pc-fr-1',
        title: 'Élysée Strategic Space & Energy Resilience Briefing',
        speaker: 'Minister of Armed Forces & Space',
        time: '3h ago',
        status: 'VERIFIED',
        keyQuote: '"European orbital autonomy and resilient low-carbon baseload power are mutually reinforcing pillars."',
        transcript: [
          {
            timestamp: '11:45:00 UTC',
            speaker: 'Minister of Armed Forces',
            text: 'European orbital autonomy and resilient low-carbon baseload power are mutually reinforcing pillars of continental strategic sovereignty.',
          },
        ],
      },
    ],
    articles: [
      {
        id: 'fr-1',
        title: 'Toulouse Optical Link Experiment Hits 100 Gbps Geo-to-Ground Throughput',
        source: 'Le Monde Sciences',
        time: '50m ago',
        category: 'Technology',
        sentiment: 'Positive',
        sentimentScore: '+0.83',
        summary: 'Adaptive optics ground stations compensated for cloud scatter to sustain uninterrupted laser telemetry.',
        fullReport: 'Pre-operational tests aboard European geostationary relay payloads point toward congestion-free backhaul for high-resolution earth imaging.',
        coordinates: '43.6047° N, 1.4442° E',
        reliability: '98.5% Science Wire',
      },
    ],
  },
  Singapore: {
    code: 'SGP',
    continent: 'Asia',
    capital: 'Singapore',
    latLon: "+01°21'08\" / +103°49'11\"",
    threatLevel: 'Guarded',
    threatColor: 'text-emerald-400 border-emerald-500/30 bg-emerald-500/10',
    newsCount: 18,
    aiExecutiveSummary: [
      'Tuas Mega Port automated AGV fleet clears 1.2 million TEU milestone with zero berth collision incidents.',
      'MAS Project Guardian pilots tokenized cross-border treasury liquidity across four central banks.',
      'Malacca Strait vessel traffic service integrates predictive AI routing to relieve anchorage congestion.',
    ],
    alternateBriefing: [
      'Subsea cable landing corridor upgrades add 240 Tbps capacity linking Tokyo, Mumbai, and Perth.',
      'Smart Nation Cyber Operations Centre completes zero-trust API gateway audit across financial institutions.',
      'Maritime green-methanol bunkering trials achieve record single-day transfer volume.',
    ],
    pressConferences: [
      {
        id: 'pc-sg-1',
        title: 'Maritime and Port Authority Malacca Corridor Briefing',
        speaker: 'MPA Chief Executive',
        time: '1h ago',
        status: 'OFFICIAL',
        keyQuote: '"Predictive berth scheduling has cut Strait of Malacca anchorage wait times by 22%."',
        transcript: [
          {
            timestamp: '13:05:00 UTC',
            speaker: 'MPA Chief Executive',
            text: 'Predictive berth scheduling has cut Strait of Malacca anchorage wait times by 22%, reducing vessel fuel burn and improving lane safety.',
          },
        ],
      },
    ],
    articles: [
      {
        id: 'sg-1',
        title: 'Tuas Automated Terminal Achieves Record Container Crane Throughput',
        source: 'Straits Times Business',
        time: '38m ago',
        category: 'Economy',
        sentiment: 'Positive',
        sentimentScore: '+0.76',
        summary: 'Electric autonomous guided vehicles synchronize berth transfers using 5G private millimeter-wave meshes.',
        fullReport: 'Continuous telemetry from over 200 battery-electric AGVs enabled 42 gross crane moves per hour while cutting terminal emissions.',
        coordinates: '1.2644° N, 103.6380° E',
        reliability: '99.0% Tier-1 Wire',
      },
    ],
  },
  Egypt: {
    code: 'EGY',
    continent: 'Africa',
    capital: 'Cairo',
    latLon: "+30°02'40\" / +31°14'08\"",
    threatLevel: 'Active Monitoring',
    threatColor: 'text-cyan-400 border-cyan-500/30 bg-cyan-500/10',
    newsCount: 8,
    aiExecutiveSummary: [
      'Suez Canal Authority reports steady transit convoys with automated tug escort coverage across southern sector.',
      'Benban Solar Park expansion adds 1.2GW battery-backed dispatch capacity to Nile Delta grid.',
      'Red Sea maritime security coordination center logs improved AIS transponder compliance.',
    ],
    alternateBriefing: [
      'New subsea fiber landing corridor at Zafarana bypasses terrestrial congestion into European hubs.',
      'East Port Said logistics zone opens automated cold-chain customs inspection terminal.',
      'Nile hydro-telemetry sensors confirm steady reservoir stabilization across Upper Egypt.',
    ],
    pressConferences: [
      {
        id: 'pc-eg-1',
        title: 'Suez Canal Authority Operational Transit Statement',
        speaker: 'SCA Chairman',
        time: '3h ago',
        status: 'VERIFIED',
        keyQuote: '"Dual-channel convoy navigation remains uninterrupted with expanded tug and radar support."',
        transcript: [
          {
            timestamp: '11:00:00 UTC',
            speaker: 'SCA Chairman',
            text: 'Dual-channel convoy navigation remains uninterrupted with expanded tug and radar support along the southern widening corridor.',
          },
        ],
      },
    ],
    articles: [
      {
        id: 'eg-1',
        title: 'Suez Canal Southern Widening Enhances Cross-Section Safety for Ultra-Large Vessels',
        source: 'Al-Ahram Economic',
        time: '2h ago',
        category: 'Politics',
        sentiment: 'Positive',
        sentimentScore: '+0.58',
        summary: '40-meter channel expansion reduces hydrodynamic drift risks during high-wind northbound convoys.',
        fullReport: 'Dredging completion along the southern 30-kilometer approach increases navigable depth and allows simultaneous emergency tug staging.',
        coordinates: '30.5852° N, 32.2654° E',
        reliability: '97.4% Regional Wire',
      },
    ],
  },
};

export function formatLatLon(lat: number, lon: number): string {
  const latDir = lat >= 0 ? 'N' : 'S';
  const lonDir = lon >= 0 ? 'E' : 'W';
  return `${Math.abs(lat).toFixed(2)}° ${latDir} / ${Math.abs(lon).toFixed(2)}° ${lonDir}`;
}

export function getGlobalIntelOverview(continentName = 'all'): CountryIntel {
  const entries = Object.values(COUNTRY_DATA).filter(
    (c) => continentName === 'all' || c.continent === continentName
  );
  const pool = entries.length > 0 ? entries : Object.values(COUNTRY_DATA);
  const aggregatedArticles = pool.flatMap((c) => c.articles).slice(0, 8);
  const aggregatedPress = pool.flatMap((c) => c.pressConferences).slice(0, 4);
  const scopeLabel = continentName === 'all' ? 'Earth (All Continents)' : continentName;

  return {
    code: continentName === 'all' ? 'GLB' : continentName.slice(0, 3).toUpperCase(),
    continent: scopeLabel,
    capital: 'Multi-Region Orbital Mesh',
    latLon: '00.00° N / 00.00° E',
    threatLevel: 'Elevated (DEFCON 4)',
    threatColor: 'text-amber-400 border-amber-500/30 bg-amber-500/10',
    newsCount: pool.reduce((sum, c) => sum + c.newsCount, 0),
    aiExecutiveSummary: [
      `Multi-theater telemetry active across ${scopeLabel} with 177 sovereign polygons under continuous surveillance.`,
      'Maritime AIS escort corridors and subsea fiber trunk repeaters report heightened monitoring near Hormuz, Malacca, and Red Sea chokepoints.',
      'Select any country on the 3D Globe, 2D SVG Map, or via Global Threat Search to isolate a national dossier.',
    ],
    alternateBriefing: [
      `Orbital SAR constellations and LEO optical passes report active coverage across ${scopeLabel}.`,
      'Cross-continental financial and semiconductor supply chain wires reflect synchronized resilience protocols.',
      'Click any landmass or command hub node to lock regional analytics and 30-day risk telemetry.',
    ],
    pressConferences: aggregatedPress,
    articles: aggregatedArticles,
  };
}

export function getCountryIntel(
  countryName: string | null,
  continentName = 'Global View',
  centroidLatLon?: { lat: number; lon: number; continent?: string }
): CountryIntel {
  if (!countryName) {
    return getGlobalIntelOverview(continentName === 'Global View' ? 'all' : continentName);
  }
  if (COUNTRY_DATA[countryName]) {
    return COUNTRY_DATA[countryName];
  }

  const resolvedContinent =
    centroidLatLon?.continent ?? (continentName === 'all' ? 'Global' : continentName);
  const coordStr = centroidLatLon
    ? formatLatLon(centroidLatLon.lat, centroidLatLon.lon)
    : "+00°00'00\" / +00°00'00\"";

  return {
    code: countryName.replace(/[^A-Za-z]/g, '').slice(0, 3).toUpperCase() || 'INT',
    continent: resolvedContinent,
    capital: `${countryName} Operations Sector`,
    latLon: coordStr,
    threatLevel: 'Standard',
    threatColor: 'text-cyan-400 border-cyan-500/30 bg-cyan-500/10',
    newsCount: 10,
    aiExecutiveSummary: [
      `Continuous satellite telemetry confirms normal maritime and airspace traffic through ${countryName}.`,
      'National telecommunication relays show sustained latency stability across primary fiber trunks.',
      'Regional commerce and customs gateways report smooth border clearing workflows.',
    ],
    alternateBriefing: [
      `Orbital SAR passes over ${countryName} indicate nominal critical infrastructure thermal signatures.`,
      'Regional grid interconnectors maintain balanced frequency regulation.',
      'Diplomatic and trade dispatches show stable bilateral logistics flows.',
    ],
    pressConferences: [
      {
        id: `pc-${countryName.toLowerCase()}`,
        title: `${countryName} Ministerial Press Briefing`,
        speaker: 'Director of Information',
        time: '3h ago',
        status: 'VERIFIED',
        keyQuote: '"National digital infrastructure and border logistics maintain full operational readiness."',
        transcript: [
          {
            timestamp: '11:20:00 UTC',
            speaker: 'Director of Information',
            text: `National digital infrastructure and border logistics across ${countryName} maintain full operational readiness across all primary corridors.`,
          },
        ],
      },
    ],
    articles: [
      {
        id: `art-${countryName.toLowerCase()}-pol`,
        title: `${countryName} Ratifies Regional Infrastructure Modernization Pact`,
        source: 'World Regional Dispatch',
        time: '1h ago',
        category: 'Politics',
        sentiment: 'Positive',
        sentimentScore: '+0.52',
        summary: `Multilateral trade delegation in ${countryName} signs technical standard harmonization agreements for high-speed fiber transit.`,
        fullReport: `Delegations representing ${countryName} finalized cross-border customs data exchange standards and resilient subsea/terrestrial cable transit protocols.`,
        coordinates: coordStr,
        reliability: '96.8% Regional Wire',
      },
      {
        id: `art-${countryName.toLowerCase()}-eco`,
        title: `${countryName} Energy & Logistics Corridor Reports Steady Grid Throughput`,
        source: 'Global Economic Monitor',
        time: '2h ago',
        category: 'Economy',
        sentiment: 'Neutral',
        sentimentScore: '+0.18',
        summary: 'Automated telemetry confirms balanced regional power distribution and port clearing times.',
        fullReport: `Real-time logistics and wholesale grid sensors across ${countryName} indicate uninterrupted freight flows and nominal reserve capacity.`,
        coordinates: coordStr,
        reliability: '97.2% Economic Wire',
      },
      {
        id: `art-${countryName.toLowerCase()}-sec`,
        title: `${countryName} Airspace & Telecom Telemetry Passes Routine Integrity Audit`,
        source: 'Aegis Global Telemetry',
        time: '4h ago',
        category: 'Security',
        sentiment: 'Positive',
        sentimentScore: '+0.41',
        summary: 'Orbital optical and SAR passes register zero anomalous RF interference across national corridors.',
        fullReport: `Scheduled multi-spectral scans over ${countryName} verified continuous transponder compliance and uninterrupted terrestrial gateway handoffs.`,
        coordinates: coordStr,
        reliability: '98.1% Telemetry Feed',
      },
    ],
  };
}

export function createLiveScrapedArticle(countryName: string, index: number): Article {
  const templates: Array<{
    category: Article['category'];
    sentiment: Article['sentiment'];
    sentimentScore: string;
    title: string;
    source: string;
    summary: string;
  }> = [
    {
      category: 'Security',
      sentiment: 'Neutral',
      sentimentScore: '+0.08',
      title: `${countryName} Orbital Telemetry Confirms Subsea Trunk Link Integrity`,
      source: 'Aegis Maritime Wire',
      summary: 'Real-time optical repeaters and coastal acoustic sensors verify nominal packet throughput across major landing stations.',
    },
    {
      category: 'Technology',
      sentiment: 'Positive',
      sentimentScore: '+0.76',
      title: `${countryName} National Compute Mesh Completes Low-Latency Sync`,
      source: 'Global Tech Feed',
      summary: 'Cross-regional fiber backbones achieved sub-4ms routing stability during peak telemetry ingestion.',
    },
    {
      category: 'Economy',
      sentiment: 'Positive',
      sentimentScore: '+0.61',
      title: `${countryName} Export Logistics Corridor Reports Elevated Container Velocity`,
      source: 'Reuters Trade Pulse',
      summary: 'Automated port clearance gateways registered a 14% reduction in customs dwell time over the last 6 hours.',
    },
  ];
  const pick = templates[index % templates.length];
  return {
    id: `live-${countryName}-${Date.now()}-${index}`,
    title: pick.title,
    source: pick.source,
    time: 'Just now',
    category: pick.category,
    sentiment: pick.sentiment,
    sentimentScore: pick.sentimentScore,
    summary: pick.summary,
    fullReport: `${pick.summary} Verified via multi-feed proxy ingestion at ${new Date().toISOString()} with cross-validated geospatial signatures.`,
    coordinates: COUNTRY_DATA[countryName]?.latLon ?? 'Global Sector',
    reliability: '98.7% Live Feed',
  };
}

export interface ThreatHistoryPoint {
  day: number;
  dateLabel: string;
  fullDate: string;
  tier: ThreatLevelTier;
  tierScore: number; // 1=Guarded, 2=Standard, 3=Elevated, 4=Critical
  riskIndex: number; // 0-100 composite threat index
  incidentCount: number;
  triggerNote: string;
}

const TIER_BASE_INDEX: Record<ThreatLevelTier, number> = {
  Guarded: 18,
  Standard: 40,
  Elevated: 64,
  Critical: 88,
};

function tierFromIndex(idx: number): { tier: ThreatLevelTier; score: number } {
  if (idx >= 75) return { tier: 'Critical', score: 4 };
  if (idx >= 50) return { tier: 'Elevated', score: 3 };
  if (idx >= 25) return { tier: 'Standard', score: 2 };
  return { tier: 'Guarded', score: 1 };
}

export function getCountryThreatHistory(
  countryName: string | null,
  currentTier: ThreatLevelTier,
  latestReason?: string
): ThreatHistoryPoint[] {
  const effectiveName = countryName ?? 'Global Composite';
  let seed = 0;
  for (let i = 0; i < effectiveName.length; i++) {
    seed = (seed * 31 + effectiveName.charCodeAt(i)) >>> 0;
  }

  const nextRand = () => {
    seed = (seed * 1664525 + 1013904223) >>> 0;
    return seed / 4294967296;
  };

  const initialTier = countryName ? getInitialThreatTier(countryName) : 'Elevated';
  const anchorBase = TIER_BASE_INDEX[initialTier];
  const spikeDay1 = 6 + Math.floor(nextRand() * 9);
  const spikeDay2 = 17 + Math.floor(nextRand() * 9);

  const notesByTier: Record<ThreatLevelTier, string[]> = {
    Guarded: [
      'Routine orbital sweeps; baseline maritime & grid telemetry.',
      'Stable telecom routing and border customs throughput.',
    ],
    Standard: [
      'Standard regional monitoring; minor packet scan noise isolated.',
      'Scheduled diplomatic & naval corridor transits nominal.',
    ],
    Elevated: [
      'Elevated cyber perimeter probes and AIS transponder anomalies.',
      'Increased maritime patrol density and airspace telemetry alerts.',
    ],
    Critical: [
      'High-intensity multi-domain alert across critical corridors.',
      'Coordinated infrastructure scan wave & emergency posture shift.',
    ],
  };

  const today = new Date();
  const points: ThreatHistoryPoint[] = [];
  let rolling = anchorBase;

  for (let i = 29; i >= 0; i--) {
    const d = new Date(today);
    d.setDate(today.getDate() - i);

    const dateLabel = d.toLocaleDateString('en-US', { month: 'short', day: 'numeric' });
    const fullDate = d.toLocaleDateString('en-US', {
      month: 'short',
      day: 'numeric',
      year: 'numeric',
    });
    const dayNum = 30 - i;

    if (i === 0) {
      const liveIndex = TIER_BASE_INDEX[currentTier] + Math.round((nextRand() - 0.5) * 8);
      const clampedLive = Math.max(8, Math.min(98, liveIndex));
      const { score } = tierFromIndex(TIER_BASE_INDEX[currentTier]);
      points.push({
        day: dayNum,
        dateLabel: 'Today',
        fullDate,
        tier: currentTier,
        tierScore: score,
        riskIndex: clampedLive,
        incidentCount: score * 4 + Math.floor(nextRand() * 5),
        triggerNote:
          latestReason ??
          notesByTier[currentTier][0],
      });
      continue;
    }

    const wave = Math.sin((dayNum + (seed % 7)) * 0.45) * 9;
    const noise = (nextRand() - 0.5) * 18;
    const spike =
      dayNum === spikeDay1 || dayNum === spikeDay1 + 1
        ? 18
        : dayNum === spikeDay2
          ? 22
          : 0;

    rolling = rolling * 0.55 + (anchorBase + wave + noise + spike) * 0.45;
    const riskIndex = Math.round(Math.max(8, Math.min(96, rolling)));
    const { tier, score } = tierFromIndex(riskIndex);
    const notePool = notesByTier[tier];

    points.push({
      day: dayNum,
      dateLabel,
      fullDate,
      tier,
      tierScore: score,
      riskIndex,
      incidentCount: score * 3 + Math.floor(nextRand() * 6),
      triggerNote: notePool[dayNum % notePool.length],
    });
  }

  return points;
}

