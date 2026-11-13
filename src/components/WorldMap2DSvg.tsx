import { forwardRef, useEffect, useImperativeHandle, useMemo, useRef, useState } from 'react';
import {
  CHOKEPOINTS,
  COUNTRY_NODES,
  HOTSPOTS,
  TELECOM_ARCS,
  THREAT_LEVEL_CONFIG,
  getInitialThreatTier,
  type Chokepoint,
  type Hotspot,
  type ThreatAlert,
  type ThreatLevelTier,
} from '../data/intelData';
import type { CountryGeoFeature } from '../three/worldGeo';

export interface SvgMapControlsHandle {
  zoomBy: (factor: number) => void;
  resetView: () => void;
}

interface WorldMap2DSvgProps {
  countries: CountryGeoFeature[];
  selectedCountry: string | null;
  hoveredCountry: string | null;
  selectedContinent: string;
  threatOverrides: Record<string, ThreatLevelTier>;
  activeMapAlert: ThreatAlert | null;
  activeLayers: {
    satellites: boolean;
    cables: boolean;
    threats: boolean;
    conflicts: boolean;
  };
  onSelectCountry: (country: string | null, meta?: { lat: number; lon: number; continent: string }) => void;
  setHoveredCountry: (country: string | null) => void;
  onSelectBeacon: (
    beacon:
      | { type: 'chokepoint'; data: Chokepoint }
      | { type: 'hotspot'; data: Hotspot }
  ) => void;
}

const CONTINENT_SVG_PRESETS: Record<string, { cx: number; cy: number; zoom: number }> = {
  all: { cx: 500, cy: 250, zoom: 1 },
  'North America': { cx: 225, cy: 135, zoom: 2.35 },
  Europe: { cx: 540, cy: 105, zoom: 3.6 },
  Asia: { cx: 745, cy: 165, zoom: 2.2 },
  'South America': { cx: 330, cy: 310, zoom: 2.45 },
  Africa: { cx: 555, cy: 245, zoom: 2.3 },
  Oceania: { cx: 880, cy: 325, zoom: 2.9 },
};

function latLonToSvg(lat: number, lon: number): [number, number] {
  const x = ((lon + 180) / 360) * 1000;
  const y = ((90 - lat) / 180) * 500;
  return [x, y];
}

function clampView(cx: number, cy: number, zoom: number) {
  const clampedZoom = Math.max(1, Math.min(7.5, zoom));
  const halfW = 500 / clampedZoom;
  const halfH = 250 / clampedZoom;
  const clampedCx = Math.max(halfW, Math.min(1000 - halfW, cx));
  const clampedCy = Math.max(halfH, Math.min(500 - halfH, cy));
  return { cx: clampedCx, cy: clampedCy, zoom: clampedZoom };
}

const WorldMap2DSvg = forwardRef<SvgMapControlsHandle, WorldMap2DSvgProps>(
  function WorldMap2DSvg(
    {
      countries,
      selectedCountry,
      hoveredCountry,
      selectedContinent,
      threatOverrides,
      activeMapAlert,
      activeLayers,
      onSelectCountry,
      setHoveredCountry,
      onSelectBeacon,
    },
    ref
  ) {
    const svgRef = useRef<SVGSVGElement | null>(null);
    const [view, setView] = useState({ cx: 500, cy: 250, zoom: 1 });
    const dragRef = useRef<{
      active: boolean;
      moved: boolean;
      startX: number;
      startY: number;
      startCx: number;
      startCy: number;
    }>({
      active: false,
      moved: false,
      startX: 0,
      startY: 0,
      startCx: 500,
      startCy: 250,
    });

    useImperativeHandle(ref, () => ({
      zoomBy: (factor: number) => {
        setView((prev) => clampView(prev.cx, prev.cy, prev.zoom / factor));
      },
      resetView: () => {
        setView(CONTINENT_SVG_PRESETS.all);
      },
    }));

    // Auto-frame continent when user switches geographic theater filter
    useEffect(() => {
      const preset = CONTINENT_SVG_PRESETS[selectedContinent] ?? CONTINENT_SVG_PRESETS.all;
      setView(clampView(preset.cx, preset.cy, preset.zoom));
    }, [selectedContinent]);

    const viewBoxStr = useMemo(() => {
      const w = 1000 / view.zoom;
      const h = 500 / view.zoom;
      const x = view.cx - w / 2;
      const y = view.cy - h / 2;
      return `${x.toFixed(2)} ${y.toFixed(2)} ${w.toFixed(2)} ${h.toFixed(2)}`;
    }, [view]);

    // Raise selected & hovered landmasses to top of SVG stack so glowing outlines aren't occluded in dense regions
    const orderedCountries = useMemo(() => {
      return [...countries].sort((a, b) => {
        const scoreA =
          (a.name === hoveredCountry ? 3 : 0) +
          (a.name === activeMapAlert?.country ? 2 : 0) +
          (a.name === selectedCountry ? 1 : 0);
        const scoreB =
          (b.name === hoveredCountry ? 3 : 0) +
          (b.name === activeMapAlert?.country ? 2 : 0) +
          (b.name === selectedCountry ? 1 : 0);
        return scoreA - scoreB;
      });
    }, [countries, hoveredCountry, selectedCountry, activeMapAlert]);

    const telecomPaths = useMemo(() => {
      return TELECOM_ARCS.map((arc, idx) => {
        const [x1, y1] = latLonToSvg(arc.from[0], arc.from[1]);
        const [x2, y2] = latLonToSvg(arc.to[0], arc.to[1]);
        const mx = (x1 + x2) / 2;
        const my = (y1 + y2) / 2 - Math.min(48, Math.abs(x2 - x1) * 0.14);
        return {
          id: `svg-arc-${idx}`,
          d: `M${x1.toFixed(1)},${y1.toFixed(1)} Q${mx.toFixed(1)},${my.toFixed(1)} ${x2.toFixed(1)},${y2.toFixed(1)}`,
          stroke: `#${arc.color.toString(16).padStart(6, '0')}`,
        };
      });
    }, []);

    const handleWheel = (e: React.WheelEvent<SVGSVGElement>) => {
      e.preventDefault();
      const factor = e.deltaY < 0 ? 1.18 : 0.85;
      setView((prev) => clampView(prev.cx, prev.cy, prev.zoom * factor));
    };

    const handlePointerDown = (e: React.PointerEvent<SVGSVGElement>) => {
      if (e.button !== 0) return;
      dragRef.current = {
        active: true,
        moved: false,
        startX: e.clientX,
        startY: e.clientY,
        startCx: view.cx,
        startCy: view.cy,
      };
    };

    const handlePointerMove = (e: React.PointerEvent<SVGSVGElement>) => {
      if (!dragRef.current.active || !svgRef.current) return;
      const dxPx = e.clientX - dragRef.current.startX;
      const dyPx = e.clientY - dragRef.current.startY;
      if (Math.hypot(dxPx, dyPx) > 4) {
        dragRef.current.moved = true;
      }
      const rect = svgRef.current.getBoundingClientRect();
      const scaleX = (1000 / view.zoom) / Math.max(1, rect.width);
      const scaleY = (500 / view.zoom) / Math.max(1, rect.height);
      setView((prev) =>
        clampView(
          dragRef.current.startCx - dxPx * scaleX,
          dragRef.current.startCy - dyPx * scaleY,
          prev.zoom
        )
      );
    };

    const handlePointerUp = () => {
      dragRef.current.active = false;
    };

    const singaporePos = latLonToSvg(1.35, 103.82);

    const hoveredLandmass = useMemo(() => {
      if (!hoveredCountry || hoveredCountry === 'Singapore') return null;
      const feat = countries.find((c) => c.name === hoveredCountry);
      if (!feat) return null;
      const tier =
        activeMapAlert?.country === feat.name
          ? activeMapAlert.newTier
          : threatOverrides[feat.name] ?? getInitialThreatTier(feat.name);
      return {
        name: feat.name,
        svgPath: feat.svgPath,
        tier,
        hexColor: THREAT_LEVEL_CONFIG[tier].hexColor,
      };
    }, [hoveredCountry, countries, threatOverrides, activeMapAlert]);

    return (
      <div className="absolute inset-0 w-full h-full bg-[#020714] grid-bg overflow-hidden">
        <svg
          ref={svgRef}
          viewBox={viewBoxStr}
          preserveAspectRatio="xMidYMid meet"
          onWheel={handleWheel}
          onPointerDown={handlePointerDown}
          onPointerMove={handlePointerMove}
          onPointerUp={handlePointerUp}
          onPointerLeave={handlePointerUp}
          onClick={() => {
            if (dragRef.current.moved) return;
            if (selectedCountry !== null) {
              onSelectCountry(null);
            }
          }}
          className="w-full h-full touch-none select-none cursor-grab active:cursor-grabbing"
          role="img"
          aria-label="Interactive Tactical 2D World Threat Map"
        >
          {/* Clip Path for Secondary Hovered Landmass Inner-Glow */}
          <defs>
            <clipPath id="hovered-landmass-clip">
              {hoveredLandmass && (
                <path d={hoveredLandmass.svgPath} clipRule="evenodd" />
              )}
            </clipPath>
          </defs>

          {/* Lat/Lon Tactical Graticule */}
          <g stroke="rgba(56, 189, 248, 0.08)" strokeWidth="0.6" vectorEffect="non-scaling-stroke">
            {[-60, -30, 0, 30, 60].map((lat) => {
              const [, y] = latLonToSvg(lat, 0);
              return (
                <line
                  key={`lat-${lat}`}
                  x1={0}
                  y1={y}
                  x2={1000}
                  y2={y}
                  strokeDasharray={lat === 0 ? '4 2' : '2 4'}
                  stroke={lat === 0 ? 'rgba(6, 182, 212, 0.22)' : undefined}
                />
              );
            })}
            {[-120, -60, 0, 60, 120].map((lon) => {
              const [x] = latLonToSvg(0, lon);
              return (
                <line
                  key={`lon-${lon}`}
                  x1={x}
                  y1={0}
                  x2={x}
                  y2={500}
                  strokeDasharray="2 4"
                />
              );
            })}
          </g>

          {/* All 177 Interactive Sovereign Landmasses with .world-tactical-landmass CSS filter hover */}
          <g>
            {orderedCountries.map((feat) => {
              const isSelected = feat.name === selectedCountry;
              const isHovered = feat.name === hoveredCountry;
              const isAlerted = activeMapAlert?.country === feat.name;
              const effectiveTier =
                threatOverrides[feat.name] ?? getInitialThreatTier(feat.name);
              const tierMeta = THREAT_LEVEL_CONFIG[effectiveTier];
              const hasCustomOrElevated =
                Boolean(threatOverrides[feat.name]) || effectiveTier !== 'Standard';
              const inContinent =
                selectedContinent === 'all' ||
                feat.continent === selectedContinent ||
                isSelected ||
                isAlerted;

              let fill = inContinent ? '#0c2740' : '#061423';
              let stroke = inContinent ? '#1e6b96' : '#0f304a';
              let strokeWidth = 0.7;

              if (isAlerted && activeMapAlert) {
                const alertHex = THREAT_LEVEL_CONFIG[activeMapAlert.newTier].hexColor;
                fill = `${alertHex}66`;
                stroke = alertHex;
                strokeWidth = 1.5;
              } else if (isSelected) {
                fill = `${tierMeta.hexColor}52`;
                stroke = tierMeta.hexColor;
                strokeWidth = 1.4;
              } else if (isHovered) {
                fill = `${tierMeta.hexColor}3d`;
                stroke = tierMeta.hexColor;
                strokeWidth = 1.45;
              } else if (hasCustomOrElevated) {
                fill = `${tierMeta.hexColor}33`;
                stroke = `${tierMeta.hexColor}aa`;
                strokeWidth = 0.9;
              }

              return (
                <path
                  key={feat.id}
                  d={feat.svgPath}
                  fill={fill}
                  fillRule="evenodd"
                  stroke={stroke}
                  strokeWidth={strokeWidth}
                  opacity={inContinent ? 1 : 0.48}
                  tabIndex={0}
                  data-threat={effectiveTier.toLowerCase()}
                  aria-label={`${feat.name} (${feat.continent}) - ${effectiveTier}`}
                  className={`world-tactical-landmass${isSelected ? ' is-selected' : ''}${
                    isAlerted ? ' is-alerted' : ''
                  }`}
                  onMouseEnter={() => setHoveredCountry(feat.name)}
                  onMouseLeave={() => setHoveredCountry(null)}
                  onFocus={() => setHoveredCountry(feat.name)}
                  onBlur={() => setHoveredCountry(null)}
                  onClick={(e) => {
                    e.stopPropagation();
                    if (dragRef.current.moved) return;
                    if (isSelected) {
                      onSelectCountry(null);
                    } else {
                      onSelectCountry(feat.name, {
                        lat: feat.centroidLat,
                        lon: feat.centroidLon,
                        continent: feat.continent,
                      });
                    }
                  }}
                  onKeyDown={(e) => {
                    if (e.key === 'Enter' || e.key === ' ') {
                      e.preventDefault();
                      if (isSelected) {
                        onSelectCountry(null);
                      } else {
                        onSelectCountry(feat.name, {
                          lat: feat.centroidLat,
                          lon: feat.centroidLon,
                          continent: feat.continent,
                        });
                      }
                    }
                  }}
                />
              );
            })}
          </g>

          {/* Secondary Clipped Inner-Glow Animation Layer (CSS variable stroke mapped to threat tier) */}
          <g clipPath="url(#hovered-landmass-clip)" className="pointer-events-none">
            {hoveredLandmass && (
              <path
                d={hoveredLandmass.svgPath}
                fillRule="evenodd"
                data-threat={hoveredLandmass.tier.toLowerCase()}
                className="world-tactical-landmass-inner-glow"
              />
            )}
          </g>

          {/* Singapore Microstate Interactive Landmass Node */}
          <circle
            cx={singaporePos[0]}
            cy={singaporePos[1]}
            r={3.2 / Math.sqrt(view.zoom)}
            fill={
              selectedCountry === 'Singapore'
                ? '#10b981'
                : THREAT_LEVEL_CONFIG[threatOverrides.Singapore ?? getInitialThreatTier('Singapore')]
                    .hexColor
            }
            stroke="#a7f3d0"
            strokeWidth={0.9}
            data-threat={(
              threatOverrides.Singapore ?? getInitialThreatTier('Singapore')
            ).toLowerCase()}
            className={`world-tactical-landmass${selectedCountry === 'Singapore' ? ' is-selected' : ''}`}
            onMouseEnter={() => setHoveredCountry('Singapore')}
            onMouseLeave={() => setHoveredCountry(null)}
            onClick={(e) => {
              e.stopPropagation();
              if (dragRef.current.moved) return;
              if (selectedCountry === 'Singapore') {
                onSelectCountry(null);
              } else {
                onSelectCountry('Singapore', { lat: 1.35, lon: 103.82, continent: 'Asia' });
              }
            }}
          />

          {/* Subsea Telecom Arcs & Maritime Chokepoints */}
          {activeLayers.cables && (
            <g>
              {telecomPaths.map((arc) => (
                <path
                  key={arc.id}
                  d={arc.d}
                  fill="none"
                  stroke={arc.stroke}
                  strokeWidth={1.1}
                  strokeOpacity={0.65}
                  vectorEffect="non-scaling-stroke"
                  className="animated-arc pointer-events-none"
                />
              ))}
              {CHOKEPOINTS.map((cp) => {
                const [cx, cy] = latLonToSvg(cp.lat, cp.lon);
                const r = 4.2 / Math.sqrt(view.zoom);
                return (
                  <polygon
                    key={cp.name}
                    points={`${cx},${cy - r} ${cx + r},${cy} ${cx},${cy + r} ${cx - r},${cy}`}
                    fill="#f59e0b"
                    stroke="#fef3c7"
                    strokeWidth={0.8}
                    vectorEffect="non-scaling-stroke"
                    className="cursor-pointer"
                    onClick={() => onSelectBeacon({ type: 'chokepoint', data: cp })}
                  />
                );
              })}
            </g>
          )}

          {/* Conflict Hotspots */}
          {activeLayers.conflicts && (
            <g>
              {HOTSPOTS.map((hs) => {
                const [cx, cy] = latLonToSvg(hs.lat, hs.lon);
                const r = 11 / Math.sqrt(view.zoom);
                return (
                  <g
                    key={hs.name}
                    className="cursor-pointer"
                    onClick={() => onSelectBeacon({ type: 'hotspot', data: hs })}
                  >
                    <circle
                      cx={cx}
                      cy={cy}
                      r={r}
                      fill={`${hs.color}22`}
                      stroke={hs.color}
                      strokeWidth={1.1}
                      strokeDasharray="3 2"
                      vectorEffect="non-scaling-stroke"
                    />
                    <circle
                      cx={cx}
                      cy={cy}
                      r={2.5 / Math.sqrt(view.zoom)}
                      fill={hs.color}
                    />
                  </g>
                );
              })}
            </g>
          )}

          {/* Strategic Command Hub Nodes */}
          {activeLayers.threats && (
            <g>
              {COUNTRY_NODES.map((node) => {
                const [cx, cy] = latLonToSvg(node.lat, node.lon);
                const tier = threatOverrides[node.name] ?? getInitialThreatTier(node.name);
                const hex = THREAT_LEVEL_CONFIG[tier].hexColor;
                const isSelected = node.name === selectedCountry;
                return (
                  <g
                    key={node.name}
                    className="cursor-pointer"
                    onMouseEnter={() => setHoveredCountry(node.name)}
                    onMouseLeave={() => setHoveredCountry(null)}
                    onClick={(e) => {
                      e.stopPropagation();
                      if (dragRef.current.moved) return;
                      if (isSelected) {
                        onSelectCountry(null);
                      } else {
                        onSelectCountry(node.name, {
                          lat: node.lat,
                          lon: node.lon,
                          continent: node.continent,
                        });
                      }
                    }}
                  >
                    {isSelected && (
                      <circle
                        cx={cx}
                        cy={cy}
                        r={8 / Math.sqrt(view.zoom)}
                        fill="none"
                        stroke={hex}
                        strokeWidth={1.2}
                        vectorEffect="non-scaling-stroke"
                      />
                    )}
                    <circle
                      cx={cx}
                      cy={cy}
                      r={(isSelected ? 3.8 : 2.8) / Math.sqrt(view.zoom)}
                      fill={hex}
                      stroke="#020617"
                      strokeWidth={0.8}
                      vectorEffect="non-scaling-stroke"
                    />
                  </g>
                );
              })}
            </g>
          )}
        </svg>
      </div>
    );
  }
);

export default WorldMap2DSvg;
