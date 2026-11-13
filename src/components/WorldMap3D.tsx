import { useEffect, useMemo, useRef, useState } from 'react';
import * as THREE from 'three';
import { OrbitControls } from 'three/addons/controls/OrbitControls.js';
import { RoomEnvironment } from 'three/addons/environments/RoomEnvironment.js';
import {
  AlertTriangle,
  ChevronDown,
  ChevronUp,
  Crosshair,
  Globe2,
  Map as MapIcon,
  Maximize2,
  Minimize2,
  Minus,
  Plus,
  RotateCcw,
  Shield,
  ShieldAlert,
  Target,
  X,
} from 'lucide-react';
import WorldMap2DSvg, { type SvgMapControlsHandle } from './WorldMap2DSvg';
import {
  CHOKEPOINTS,
  CONTINENT_VIEW_COORDS,
  COUNTRY_DATA,
  COUNTRY_NODES,
  HOTSPOTS,
  SATELLITES,
  TELECOM_ARCS,
  THREAT_LEVEL_CONFIG,
  formatLatLon,
  getInitialThreatTier,
  type Chokepoint,
  type Hotspot,
  type SatelliteNode,
  type ThreatAlert,
  type ThreatLevelTier,
} from '../data/intelData';
import {
  createAtmosphereMaterial,
  createGimbalRingAssembly,
  createGreatCircleArc,
  createOceanTextures,
  createOrbitalSatelliteGroup,
  createSolarPanelTexture,
  createTargetBeaconGroup,
} from '../three/proceduralAssets';
import {
  GLOBE_RADIUS,
  LAND_RADIUS,
  buildWorldGeoDataset,
  latLonToVec3,
  type CountryGeoFeature,
} from '../three/worldGeo';

interface WorldMap3DProps {
  selectedCountry: string | null;
  onSelectCountry: (country: string | null, meta?: { lat: number; lon: number; continent: string }) => void;
  selectedContinent: string;
  hoveredCountry: string | null;
  setHoveredCountry: (country: string | null) => void;
  threatOverrides: Record<string, ThreatLevelTier>;
  activeMapAlert: ThreatAlert | null;
  onDismissAlert: () => void;
}

type MapBeacon =
  | { type: 'chokepoint'; data: Chokepoint }
  | { type: 'satellite'; data: SatelliteNode }
  | { type: 'hotspot'; data: Hotspot };

// Pre-allocated scratch math helpers (zero GC inside animation loop)
const _up = new THREE.Vector3(0, 1, 0);
const _vec3A = new THREE.Vector3();
const _vec3B = new THREE.Vector3();
const _vec3C = new THREE.Vector3();
const _quatA = new THREE.Quaternion();
const _mat4A = new THREE.Matrix4();
const _colorA = new THREE.Color();

export default function WorldMap3D({
  selectedCountry,
  onSelectCountry,
  selectedContinent,
  hoveredCountry,
  setHoveredCountry,
  threatOverrides,
  activeMapAlert,
  onDismissAlert,
}: WorldMap3DProps) {
  const containerRef = useRef<HTMLDivElement | null>(null);
  const canvasMountRef = useRef<HTMLDivElement | null>(null);
  const svgControlsRef = useRef<SvgMapControlsHandle | null>(null);

  const [mapMode, setMapMode] = useState<'3d' | 'svg'>('3d');
  const [isFullscreen, setIsFullscreen] = useState(false);
  const [dockCollapsed, setDockCollapsed] = useState(false);
  const [autoRotate, setAutoRotate] = useState(false);
  const [webglError, setWebglError] = useState<string | null>(null);
  const [activeBeacon, setActiveBeacon] = useState<MapBeacon | null>(null);

  const [activeLayers, setActiveLayers] = useState({
    satellites: true,
    cables: true,
    threats: true,
    conflicts: true,
  });

  const worldGeo = useMemo(() => buildWorldGeoDataset(), []);
  const sortedCountryNames = useMemo(() => {
    const names = new Set<string>(worldGeo.countries.map((c) => c.name));
    names.add('Singapore');
    return Array.from(names).sort((a, b) => a.localeCompare(b));
  }, [worldGeo]);

  // Mutable refs so React state updates never recreate the WebGL scene
  const selectedCountryRef = useRef(selectedCountry);
  const hoveredCountryRef = useRef(hoveredCountry);
  const selectedContinentRef = useRef(selectedContinent);
  const threatOverridesRef = useRef(threatOverrides);
  const activeMapAlertRef = useRef(activeMapAlert);
  const autoRotateRef = useRef(autoRotate);
  const activeLayersRef = useRef(activeLayers);
  const mapModeRef = useRef(mapMode);
  const onSelectCountryRef = useRef(onSelectCountry);
  const setHoveredCountryRef = useRef(setHoveredCountry);

  selectedCountryRef.current = selectedCountry;
  hoveredCountryRef.current = hoveredCountry;
  selectedContinentRef.current = selectedContinent;
  threatOverridesRef.current = threatOverrides;
  activeMapAlertRef.current = activeMapAlert;
  autoRotateRef.current = autoRotate;
  activeLayersRef.current = activeLayers;
  mapModeRef.current = mapMode;
  onSelectCountryRef.current = onSelectCountry;
  setHoveredCountryRef.current = setHoveredCountry;

  // Imperative scene control handles
  const sceneControlsRef = useRef<{
    flyToLatLon: (lat: number, lon: number, distance?: number) => void;
    zoomBy: (factor: number) => void;
    resetCamera: () => void;
    syncCountryStyles: () => void;
    syncLayerVisibility: () => void;
    updateTargetBeacon: () => void;
  } | null>(null);

  const toggleLayer = (layerKey: keyof typeof activeLayers) => {
    setActiveLayers((prev) => ({ ...prev, [layerKey]: !prev[layerKey] }));
  };

  useEffect(() => {
    const handleKey = (e: KeyboardEvent) => {
      if (e.key === 'Escape' && isFullscreen) {
        setIsFullscreen(false);
      }
      if (e.key.toLowerCase() === 'h' && document.activeElement?.tagName !== 'INPUT' && document.activeElement?.tagName !== 'SELECT') {
        setDockCollapsed((prev) => !prev);
      }
    };
    window.addEventListener('keydown', handleKey);
    return () => window.removeEventListener('keydown', handleKey);
  }, [isFullscreen]);

  // Initialize Three.js WebGL scene once
  useEffect(() => {
    const mountEl = canvasMountRef.current;
    if (!mountEl) return;

    const isSoftwareGl = (() => {
      try {
        const probe = document.createElement('canvas');
        const gl = probe.getContext('webgl2');
        if (!gl) return true;
        const ext = gl.getExtension('WEBGL_debug_renderer_info');
        const param = ext ? ext.UNMASKED_RENDERER_WEBGL : gl.RENDERER;
        const gpu = String(gl.getParameter(param));
        gl.getExtension('WEBGL_lose_context')?.loseContext();
        return /SwiftShader|llvmpipe|softpipe|Software|Basic Render/i.test(gpu);
      } catch {
        return true;
      }
    })();

    let renderer: THREE.WebGLRenderer;
    try {
      renderer = new THREE.WebGLRenderer({
        antialias: !isSoftwareGl,
        powerPreference: 'high-performance',
      });
    } catch {
      setWebglError('WebGL2 context unavailable in this browser.');
      return;
    }

    renderer.outputColorSpace = THREE.SRGBColorSpace;
    renderer.toneMapping = THREE.ACESFilmicToneMapping;
    renderer.toneMappingExposure = 1.15;
    renderer.setPixelRatio(isSoftwareGl ? 1 : Math.min(window.devicePixelRatio, 2));
    renderer.shadowMap.enabled = !isSoftwareGl;
    renderer.shadowMap.type = THREE.PCFSoftShadowMap;

    const initialW = Math.max(300, mountEl.clientWidth);
    const initialH = Math.max(300, mountEl.clientHeight);
    renderer.setSize(initialW, initialH);
    renderer.domElement.style.display = 'block';
    renderer.domElement.style.width = '100%';
    renderer.domElement.style.height = '100%';
    mountEl.appendChild(renderer.domElement);

    const scene = new THREE.Scene();
    scene.background = new THREE.Color(0x020714);
    scene.fog = new THREE.FogExp2(0x020714, 0.042);

    const pmremGenerator = new THREE.PMREMGenerator(renderer);
    const envTarget = pmremGenerator.fromScene(new RoomEnvironment(), 0.04);
    scene.environment = envTarget.texture;
    pmremGenerator.dispose();

    const camera = new THREE.PerspectiveCamera(42, initialW / initialH, 0.1, 100);
    const initialVec = latLonToVec3(32, -78, 5.1);
    camera.position.copy(initialVec);

    const controls = new OrbitControls(camera, renderer.domElement);
    controls.enablePan = false;
    controls.enableDamping = !isSoftwareGl;
    controls.dampingFactor = 0.065;
    controls.minDistance = 2.75;
    controls.maxDistance = 8.5;
    controls.rotateSpeed = 0.65;
    controls.zoomSpeed = 0.85;
    controls.autoRotate = false;
    controls.autoRotateSpeed = 0.45;

    // 3-Point Warm/Cool Studio Lighting
    const hemiLight = new THREE.HemisphereLight(0x38bdf8, 0x020617, 1.15);
    scene.add(hemiLight);

    const keyLight = new THREE.DirectionalLight(0xfff1dc, 2.2);
    keyLight.position.set(6, 5, 7);
    scene.add(keyLight);

    const rimLight = new THREE.DirectionalLight(0x06b6d4, 1.3);
    rimLight.position.set(-7, -3, -6);
    scene.add(rimLight);

    // Instanced Orbital Starfield (>20 repeated items)
    const starCount = 240;
    const starGeo = new THREE.OctahedronGeometry(0.018, 0);
    const starMat = new THREE.MeshBasicMaterial({ color: 0x7dd3fc, transparent: true, opacity: 0.72 });
    const starInstances = new THREE.InstancedMesh(starGeo, starMat, starCount);
    for (let i = 0; i < starCount; i++) {
      const r = 11 + ((i * 19) % 14);
      const theta = i * 2.39996;
      const phi = Math.acos(1 - (2 * (i + 0.5)) / starCount);
      _vec3A.set(
        r * Math.sin(phi) * Math.cos(theta),
        r * Math.cos(phi),
        r * Math.sin(phi) * Math.sin(theta)
      );
      const s = 0.65 + ((i * 13) % 10) * 0.09;
      _vec3B.set(s, s, s);
      _quatA.identity();
      _mat4A.compose(_vec3A, _quatA, _vec3B);
      starInstances.setMatrixAt(i, _mat4A);
    }
    starInstances.instanceMatrix.needsUpdate = true;
    starInstances.computeBoundingSphere();
    scene.add(starInstances);

    // Hero Globe Group
    const globeGroup = new THREE.Group();
    scene.add(globeGroup);

    const maxAnisotropy = renderer.capabilities.getMaxAnisotropy();
    const { albedoMap, roughnessMap } = createOceanTextures(maxAnisotropy);
    const solarTex = createSolarPanelTexture(maxAnisotropy);

    // Ocean Core Sphere
    const oceanGeo = new THREE.SphereGeometry(GLOBE_RADIUS, 72, 48);
    const oceanMat = new THREE.MeshStandardMaterial({
      map: albedoMap,
      roughnessMap,
      roughness: 0.55,
      metalness: 0.25,
    });
    const oceanMesh = new THREE.Mesh(oceanGeo, oceanMat);
    globeGroup.add(oceanMesh);

    // Atmosphere Fresnel Rim Shell
    const atmoGeo = new THREE.SphereGeometry(GLOBE_RADIUS + 0.11, 64, 40);
    const atmoMat = createAtmosphereMaterial();
    const atmoMesh = new THREE.Mesh(atmoGeo, atmoMat);
    globeGroup.add(atmoMesh);

    // Equatorial & Polar Gimbal Ring Assembly
    const gimbalGroup = createGimbalRingAssembly();
    globeGroup.add(gimbalGroup);

    // Country Polygons (ALL 177 Countries Interactive on Layer 1)
    const countriesGroup = new THREE.Group();
    globeGroup.add(countriesGroup);

    const countryMeshes: THREE.Mesh[] = [];
    const countryMaterialMap = new Map<string, THREE.MeshStandardMaterial>();
    const countryFeatureMap = new Map<string, CountryGeoFeature>();

    for (const country of worldGeo.countries) {
      const mat = new THREE.MeshStandardMaterial({
        color: 0x0b253c,
        emissive: 0x031326,
        emissiveIntensity: 0.35,
        roughness: 0.62,
        metalness: 0.28,
        side: THREE.DoubleSide,
      });
      const mesh = new THREE.Mesh(country.geometry, mat);
      mesh.layers.enable(1);
      mesh.userData = {
        beaconType: 'country',
        countryName: country.name,
        continent: country.continent,
        lat: country.centroidLat,
        lon: country.centroidLon,
      };
      countriesGroup.add(mesh);
      countryMeshes.push(mesh);
      countryMaterialMap.set(country.name, mat);
      countryFeatureMap.set(country.name, country);
    }

    // Crisp Country Borders Wireframe
    const borderMat = new THREE.LineBasicMaterial({
      color: 0x1d70a2,
      transparent: true,
      opacity: 0.72,
      polygonOffset: true,
      polygonOffsetFactor: -1,
      polygonOffsetUnits: -1,
    });
    const borderLines = new THREE.LineSegments(worldGeo.bordersGeometry, borderMat);
    globeGroup.add(borderLines);

    // Glowing Hovered Country Outline Highlight (high-density region visibility)
    const hoverBorderMat = new THREE.LineBasicMaterial({
      color: 0x67e8f9,
      transparent: true,
      opacity: 0.98,
    });
    const hoverBorderLines = new THREE.LineSegments(new THREE.BufferGeometry(), hoverBorderMat);
    hoverBorderLines.visible = false;
    globeGroup.add(hoverBorderLines);

    // Singapore clickable micro-hub marker (since 110m Natural Earth omits microstates)
    const singaporeMat = new THREE.MeshStandardMaterial({
      color: 0x10b981,
      emissive: 0x10b981,
      emissiveIntensity: 0.7,
      roughness: 0.3,
      metalness: 0.6,
    });
    const singaporeGeo = new THREE.OctahedronGeometry(0.025, 0);
    const singaporeMesh = new THREE.Mesh(singaporeGeo, singaporeMat);
    singaporeMesh.position.copy(latLonToVec3(1.35, 103.82, LAND_RADIUS + 0.014));
    singaporeMesh.layers.enable(1);
    singaporeMesh.userData = {
      beaconType: 'country',
      countryName: 'Singapore',
      continent: 'Asia',
      lat: 1.35,
      lon: 103.82,
    };
    globeGroup.add(singaporeMesh);
    countryMaterialMap.set('Singapore', singaporeMat);

    // Layer: Threat Hub Pips (12 Primary Command Nodes)
    const threatNodesGroup = new THREE.Group();
    globeGroup.add(threatNodesGroup);
    const threatPipMap = new Map<string, THREE.MeshStandardMaterial>();
    const pipGeo = new THREE.SphereGeometry(0.022, 12, 12);

    for (const node of COUNTRY_NODES) {
      const mat = new THREE.MeshStandardMaterial({
        color: 0x06b6d4,
        emissive: 0x06b6d4,
        emissiveIntensity: 0.8,
        roughness: 0.25,
        metalness: 0.5,
      });
      const pip = new THREE.Mesh(pipGeo, mat);
      pip.position.copy(latLonToVec3(node.lat, node.lon, LAND_RADIUS + 0.015));
      pip.layers.enable(1);
      pip.userData = {
        beaconType: 'country',
        countryName: node.name,
        continent: node.continent,
        lat: node.lat,
        lon: node.lon,
      };
      threatNodesGroup.add(pip);
      threatPipMap.set(node.name, mat);
    }

    // Layer: Subsea Telecom Arcs & Maritime Chokepoints
    const cablesGroup = new THREE.Group();
    globeGroup.add(cablesGroup);

    for (const arc of TELECOM_ARCS) {
      const arcMesh = createGreatCircleArc(
        arc.from[0],
        arc.from[1],
        arc.to[0],
        arc.to[1],
        arc.color
      );
      cablesGroup.add(arcMesh);
    }

    const chokepointGeo = new THREE.OctahedronGeometry(0.026, 0);
    const chokepointMat = new THREE.MeshStandardMaterial({
      color: 0xf59e0b,
      emissive: 0xd97706,
      emissiveIntensity: 0.75,
      roughness: 0.25,
      metalness: 0.75,
    });
    for (const cp of CHOKEPOINTS) {
      const cpMesh = new THREE.Mesh(chokepointGeo, chokepointMat);
      cpMesh.position.copy(latLonToVec3(cp.lat, cp.lon, LAND_RADIUS + 0.016));
      cpMesh.layers.enable(1);
      cpMesh.userData = { beaconType: 'chokepoint', chokepointName: cp.name };
      cablesGroup.add(cpMesh);
    }

    // Layer: Conflict Hotspots
    const hotspotsGroup = new THREE.Group();
    globeGroup.add(hotspotsGroup);
    const hotspotRings: { mesh: THREE.Mesh; baseRadius: number; phase: number }[] = [];

    HOTSPOTS.forEach((hs, idx) => {
      const hsGroup = new THREE.Group();
      const pos = latLonToVec3(hs.lat, hs.lon, LAND_RADIUS + 0.012);
      hsGroup.position.copy(pos);
      _vec3A.copy(pos).normalize();
      _quatA.setFromUnitVectors(_up, _vec3A);
      hsGroup.quaternion.copy(_quatA);

      const colorNum = new THREE.Color(hs.color).getHex();
      const ringGeo = new THREE.RingGeometry(hs.radius * 0.65, hs.radius * 0.88, 32);
      const ringMat = new THREE.MeshBasicMaterial({
        color: colorNum,
        side: THREE.DoubleSide,
        transparent: true,
        opacity: 0.75,
        depthWrite: false,
      });
      const ringMesh = new THREE.Mesh(ringGeo, ringMat);
      ringMesh.rotation.x = -Math.PI / 2;
      ringMesh.layers.enable(1);
      ringMesh.userData = { beaconType: 'hotspot', hotspotName: hs.name };
      hsGroup.add(ringMesh);

      const coreMesh = new THREE.Mesh(
        new THREE.CylinderGeometry(0.014, 0.014, 0.01, 12),
        new THREE.MeshBasicMaterial({ color: colorNum })
      );
      coreMesh.layers.enable(1);
      coreMesh.userData = { beaconType: 'hotspot', hotspotName: hs.name };
      hsGroup.add(coreMesh);

      hotspotsGroup.add(hsGroup);
      hotspotRings.push({ mesh: ringMesh, baseRadius: 1, phase: idx * 1.4 });
    });

    // Layer: Composite 7-Part Orbital Satellites
    const satellitesGroup = new THREE.Group();
    globeGroup.add(satellitesGroup);
    const satEntries = SATELLITES.map((sat) => {
      const satModel = createOrbitalSatelliteGroup(solarTex, sat.id);
      satellitesGroup.add(satModel);
      return { data: sat, model: satModel };
    });

    // Target Beacon & Alert Shockwave Assembly
    const targetBeacon = createTargetBeaconGroup();
    globeGroup.add(targetBeacon.group);

    // Sync Country Materials (Selection, Hover, Continent Filter, Threat Levels)
    const syncCountryStyles = () => {
      const sel = selectedCountryRef.current;
      const hov = hoveredCountryRef.current;
      const cont = selectedContinentRef.current;
      const overrides = threatOverridesRef.current;
      const alert = activeMapAlertRef.current;

      for (const [name, mat] of countryMaterialMap.entries()) {
        const feat = countryFeatureMap.get(name);
        const tier = overrides[name];
        const isSelected = name === sel;
        const isHovered = name === hov;
        const isAlerted = alert?.country === name;
        const inContinent =
          cont === 'all' || !feat || feat.continent === cont || isSelected || isAlerted;

        if (isAlerted && alert) {
          const alertHex = THREAT_LEVEL_CONFIG[alert.newTier].hexColor;
          _colorA.set(alertHex);
          mat.color.copy(_colorA).multiplyScalar(0.55);
          mat.emissive.copy(_colorA);
          mat.emissiveIntensity = 0.85;
        } else if (isSelected) {
          const effectiveTier = tier ?? getInitialThreatTier(name);
          _colorA.set(THREAT_LEVEL_CONFIG[effectiveTier].hexColor);
          mat.color.copy(_colorA).multiplyScalar(0.45);
          mat.emissive.copy(_colorA);
          mat.emissiveIntensity = 0.68;
        } else if (isHovered) {
          mat.color.setHex(0x134e6f);
          mat.emissive.setHex(0x06b6d4);
          mat.emissiveIntensity = 0.45;
        } else if (tier) {
          const tierHex = THREAT_LEVEL_CONFIG[tier].hexColor;
          _colorA.set(tierHex);
          mat.color.copy(_colorA).multiplyScalar(0.28);
          mat.emissive.copy(_colorA);
          mat.emissiveIntensity = inContinent ? 0.34 : 0.14;
        } else {
          mat.color.setHex(inContinent ? 0x0d2b45 : 0x061321);
          mat.emissive.setHex(inContinent ? 0x041d33 : 0x020912);
          mat.emissiveIntensity = inContinent ? 0.36 : 0.15;
        }
      }

      for (const node of COUNTRY_NODES) {
        const pipMat = threatPipMap.get(node.name);
        if (!pipMat) continue;
        const effectiveTier = overrides[node.name] ?? getInitialThreatTier(node.name);
        const hex = THREAT_LEVEL_CONFIG[effectiveTier].hexColor;
        pipMat.color.set(hex);
        pipMat.emissive.set(hex);
        pipMat.emissiveIntensity =
          node.name === sel || alert?.country === node.name ? 1.25 : 0.75;
      }

      const hoveredFeat = hov ? countryFeatureMap.get(hov) : undefined;
      if (hoveredFeat && hov) {
        const hoverTier =
          alert?.country === hov
            ? alert.newTier
            : overrides[hov] ?? getInitialThreatTier(hov);
        hoverBorderMat.color.set(THREAT_LEVEL_CONFIG[hoverTier].hexColor);
        hoverBorderLines.geometry = hoveredFeat.borderGeometry;
        hoverBorderLines.visible = true;
      } else {
        hoverBorderLines.visible = false;
      }
    };

    const updateTargetBeacon = () => {
      const targetName = activeMapAlertRef.current?.country ?? selectedCountryRef.current;
      if (!targetName) {
        targetBeacon.group.visible = false;
        return;
      }
      targetBeacon.group.visible = true;

      const feat = countryFeatureMap.get(targetName);
      const fallbackNode = COUNTRY_NODES.find((n) => n.name === targetName);

      const lat = feat?.centroidLat ?? fallbackNode?.lat ?? 38.9;
      const lon = feat?.centroidLon ?? fallbackNode?.lon ?? -77.04;
      const surfacePos = latLonToVec3(lat, lon, LAND_RADIUS + 0.004);

      targetBeacon.group.position.copy(surfacePos);
      _vec3A.copy(surfacePos).normalize();
      _quatA.setFromUnitVectors(_up, _vec3A);
      targetBeacon.group.quaternion.copy(_quatA);

      const effectiveTier =
        threatOverridesRef.current[targetName] ?? getInitialThreatTier(targetName);
      const hex = THREAT_LEVEL_CONFIG[effectiveTier].hexColor;
      targetBeacon.ringMat.color.set(hex);
      targetBeacon.spireMat.color.set(hex);
      targetBeacon.spireMat.emissive.set(hex);
      targetBeacon.shockwaveMat.color.set(hex);
    };

    const syncLayerVisibility = () => {
      const layers = activeLayersRef.current;
      satellitesGroup.visible = layers.satellites;
      cablesGroup.visible = layers.cables;
      threatNodesGroup.visible = layers.threats;
      hotspotsGroup.visible = layers.conflicts;
    };

    // Smooth camera fly-to target (cancelled immediately on user drag)
    let flyTargetPos: THREE.Vector3 | null = null;

    const flyToLatLon = (lat: number, lon: number, desiredDistance?: number) => {
      const dist = desiredDistance ?? Math.max(3.4, Math.min(6.0, camera.position.length()));
      flyTargetPos = latLonToVec3(lat, lon, dist);
    };

    controls.addEventListener('start', () => {
      flyTargetPos = null;
    });

    sceneControlsRef.current = {
      flyToLatLon,
      zoomBy: (factor: number) => {
        flyTargetPos = null;
        const currentLen = camera.position.length();
        const nextLen = THREE.MathUtils.clamp(currentLen * factor, 2.75, 8.5);
        camera.position.setLength(nextLen);
      },
      resetCamera: () => {
        const view = CONTINENT_VIEW_COORDS.all;
        flyToLatLon(view.lat, view.lon, view.distance);
      },
      syncCountryStyles,
      syncLayerVisibility,
      updateTargetBeacon,
    };

    syncCountryStyles();
    syncLayerVisibility();
    updateTargetBeacon();

    // Pre-compile shaders on hardware GPUs
    if (!isSoftwareGl) {
      renderer.compile(scene, camera);
    }

    // Raycasting on Layer 1 (throttled hover + click-vs-drag protection)
    const raycaster = new THREE.Raycaster();
    raycaster.layers.set(1);
    const pointerNDC = new THREE.Vector2();
    let lastHoverCheck = 0;
    let pointerDownPos = { x: 0, y: 0 };

    const updateNDC = (clientX: number, clientY: number) => {
      const rect = renderer.domElement.getBoundingClientRect();
      pointerNDC.x = ((clientX - rect.left) / rect.width) * 2 - 1;
      pointerNDC.y = -((clientY - rect.top) / rect.height) * 2 + 1;
    };

    const getInteractables = (): THREE.Object3D[] => {
      const list: THREE.Object3D[] = [...countryMeshes, singaporeMesh];
      if (activeLayersRef.current.threats) list.push(...threatNodesGroup.children);
      if (activeLayersRef.current.cables) {
        for (const c of cablesGroup.children) {
          if (c.userData?.beaconType === 'chokepoint') list.push(c);
        }
      }
      if (activeLayersRef.current.conflicts) {
        for (const g of hotspotsGroup.children) {
          list.push(...g.children);
        }
      }
      if (activeLayersRef.current.satellites) {
        for (const s of satEntries) {
          list.push(...s.model.children);
        }
      }
      return list;
    };

    const onPointerDown = (e: PointerEvent) => {
      pointerDownPos = { x: e.clientX, y: e.clientY };
    };

    const onPointerMove = (e: PointerEvent) => {
      const now = performance.now();
      if (now - lastHoverCheck < 45) return;
      lastHoverCheck = now;

      updateNDC(e.clientX, e.clientY);
      raycaster.setFromCamera(pointerNDC, camera);
      const hits = raycaster.intersectObjects(getInteractables(), false);

      if (hits.length > 0) {
        const hitData = hits[0].object.userData;
        renderer.domElement.style.cursor = 'pointer';
        if (hitData?.beaconType === 'country' && hitData.countryName) {
          if (hoveredCountryRef.current !== hitData.countryName) {
            setHoveredCountryRef.current(hitData.countryName);
          }
          return;
        }
      } else {
        renderer.domElement.style.cursor = 'grab';
      }

      if (hoveredCountryRef.current !== null) {
        setHoveredCountryRef.current(null);
      }
    };

    const onPointerUp = (e: PointerEvent) => {
      const distMoved = Math.hypot(e.clientX - pointerDownPos.x, e.clientY - pointerDownPos.y);
      if (distMoved > 6) return;

      updateNDC(e.clientX, e.clientY);
      raycaster.setFromCamera(pointerNDC, camera);
      const hits = raycaster.intersectObjects(getInteractables(), false);
      if (hits.length === 0) {
        setActiveBeacon(null);
        if (selectedCountryRef.current !== null) {
          onSelectCountryRef.current(null);
        }
        return;
      }

      const hitData = hits[0].object.userData;
      if (hitData?.beaconType === 'country' && hitData.countryName) {
        setActiveBeacon(null);
        if (selectedCountryRef.current === hitData.countryName) {
          onSelectCountryRef.current(null);
        } else {
          onSelectCountryRef.current(hitData.countryName, {
            lat: hitData.lat,
            lon: hitData.lon,
            continent: hitData.continent,
          });
        }
      } else if (hitData?.beaconType === 'chokepoint') {
        const cp = CHOKEPOINTS.find((c) => c.name === hitData.chokepointName);
        if (cp) setActiveBeacon({ type: 'chokepoint', data: cp });
      } else if (hitData?.beaconType === 'hotspot') {
        const hs = HOTSPOTS.find((h) => h.name === hitData.hotspotName);
        if (hs) setActiveBeacon({ type: 'hotspot', data: hs });
      } else if (hitData?.beaconType === 'satellite') {
        const sat = SATELLITES.find((s) => s.id === hitData.satelliteId);
        if (sat) setActiveBeacon({ type: 'satellite', data: sat });
      }
    };

    renderer.domElement.addEventListener('pointerdown', onPointerDown);
    renderer.domElement.addEventListener('pointermove', onPointerMove);
    renderer.domElement.addEventListener('pointerup', onPointerUp);

    // WebGL context loss safety
    const onContextLost = (e: Event) => {
      e.preventDefault();
      setWebglError('WebGL rendering context suspended. Restoring...');
    };
    const onContextRestored = () => {
      setWebglError(null);
    };
    renderer.domElement.addEventListener('webglcontextlost', onContextLost);
    renderer.domElement.addEventListener('webglcontextrestored', onContextRestored);

    // ResizeObserver handles both container resizes and fullscreen toggle
    const resizeObserver = new ResizeObserver(() => {
      const w = Math.max(280, mountEl.clientWidth);
      const h = Math.max(280, mountEl.clientHeight);
      camera.aspect = w / h;
      camera.updateProjectionMatrix();
      renderer.setSize(w, h);
    });
    resizeObserver.observe(mountEl);

    // Animation Loop with Software-GL pacing & zero GC
    let frameId = 0;
    let disposed = false;
    const clock = new THREE.Clock();

    function afterDraw(cb: () => void) {
      const gl = renderer.getContext() as WebGL2RenderingContext;
      const sync = gl.fenceSync ? gl.fenceSync(gl.SYNC_GPU_COMMANDS_COMPLETE, 0) : null;
      if (!sync) {
        frameId = window.setTimeout(cb, 80);
        return;
      }
      gl.flush();
      const poll = () => {
        if (disposed) return;
        const state = gl.getSyncParameter(sync, gl.SYNC_STATUS);
        if (state === gl.UNSIGNALED) {
          frameId = window.setTimeout(poll, 5);
        } else {
          gl.deleteSync(sync);
          frameId = window.setTimeout(cb, 80);
        }
      };
      frameId = window.setTimeout(poll, 5);
    }

    function tick() {
      if (disposed) return;
      const dt = Math.min(clock.getDelta(), 0.05);
      const elapsed = clock.getElapsedTime();

      // Smooth damped camera fly-to
      if (flyTargetPos) {
        const dampAlpha = 1 - Math.exp(-5.5 * dt);
        _vec3A.copy(camera.position).normalize();
        _vec3B.copy(flyTargetPos).normalize();
        _vec3C.lerpVectors(_vec3A, _vec3B, dampAlpha).normalize();

        const targetLen = flyTargetPos.length();
        const currLen = camera.position.length();
        const nextLen = THREE.MathUtils.lerp(currLen, targetLen, dampAlpha);
        camera.position.copy(_vec3C.multiplyScalar(nextLen));

        if (camera.position.distanceTo(flyTargetPos) < 0.025) {
          flyTargetPos = null;
        }
      }

      controls.autoRotate = !isSoftwareGl && autoRotateRef.current && !flyTargetPos;
      controls.update();

      // Animate orbital satellites smoothly along inclined circular paths
      for (const sat of satEntries) {
        const angle = sat.data.phaseRad + elapsed * sat.data.speed;
        const r = sat.data.altitudeRadius;
        const x = Math.cos(angle) * r;
        const zFlat = Math.sin(angle) * r;
        const inc = sat.data.inclinationRad;
        const y = zFlat * Math.sin(inc);
        const z = zFlat * Math.cos(inc);

        sat.model.position.set(x, y, z);
        sat.model.lookAt(0, 0, 0);
      }

      // Subtle gimbal calibration rotation
      gimbalGroup.rotation.y = elapsed * 0.04;

      // Animate Target Reticle & Alert Shockwave
      targetBeacon.reticle.rotation.z = elapsed * 1.1;
      if (activeMapAlertRef.current) {
        const waveProgress = (elapsed * 0.9) % 1;
        const scale = 1 + waveProgress * 2.8;
        targetBeacon.shockwave.scale.set(scale, scale, 1);
        targetBeacon.shockwaveMat.opacity = (1 - waveProgress) * 0.85;
      } else {
        targetBeacon.shockwaveMat.opacity = 0;
      }

      // Animate Hotspot rings
      for (const hs of hotspotRings) {
        const pulse = 0.88 + Math.sin(elapsed * 2.4 + hs.phase) * 0.14;
        hs.mesh.scale.set(pulse, pulse, 1);
      }

      if (mapModeRef.current === '3d') {
        renderer.render(scene, camera);
      }

      if (isSoftwareGl) {
        afterDraw(tick);
      } else {
        frameId = requestAnimationFrame(tick);
      }
    }

    tick();

    return () => {
      disposed = true;
      cancelAnimationFrame(frameId);
      clearTimeout(frameId);
      resizeObserver.disconnect();

      renderer.domElement.removeEventListener('pointerdown', onPointerDown);
      renderer.domElement.removeEventListener('pointermove', onPointerMove);
      renderer.domElement.removeEventListener('pointerup', onPointerUp);
      renderer.domElement.removeEventListener('webglcontextlost', onContextLost);
      renderer.domElement.removeEventListener('webglcontextrestored', onContextRestored);

      controls.dispose();
      albedoMap.dispose();
      roughnessMap.dispose();
      solarTex.dispose();
      envTarget.dispose();
      oceanGeo.dispose();
      oceanMat.dispose();
      atmoGeo.dispose();
      atmoMat.dispose();
      borderMat.dispose();
      hoverBorderMat.dispose();
      pipGeo.dispose();
      chokepointGeo.dispose();
      chokepointMat.dispose();
      starGeo.dispose();
      starMat.dispose();

      for (const mat of countryMaterialMap.values()) mat.dispose();
      for (const mat of threatPipMap.values()) mat.dispose();

      renderer.dispose();
      if (mountEl.contains(renderer.domElement)) {
        mountEl.removeChild(renderer.domElement);
      }
    };
  }, [worldGeo]);

  // Sync material colors when country selection, hover, continent, or threat level changes
  useEffect(() => {
    sceneControlsRef.current?.syncCountryStyles();
    sceneControlsRef.current?.updateTargetBeacon();
  }, [selectedCountry, hoveredCountry, selectedContinent, threatOverrides, activeMapAlert]);

  // Sync layer toggles
  useEffect(() => {
    sceneControlsRef.current?.syncLayerVisibility();
  }, [activeLayers]);

  // Fly camera to selected country when changed, or back to continent/global view when cleared
  useEffect(() => {
    if (!selectedCountry) {
      const view = CONTINENT_VIEW_COORDS[selectedContinent] ?? CONTINENT_VIEW_COORDS.all;
      sceneControlsRef.current?.flyToLatLon(view.lat, view.lon, view.distance);
      return;
    }
    const feat = worldGeo.byName.get(selectedCountry);
    const node = COUNTRY_NODES.find((n) => n.name === selectedCountry);
    const lat = feat?.centroidLat ?? node?.lat;
    const lon = feat?.centroidLon ?? node?.lon;
    if (lat !== undefined && lon !== undefined) {
      sceneControlsRef.current?.flyToLatLon(lat, lon);
    }
  }, [selectedCountry, selectedContinent, worldGeo]);

  // Fly camera to selected continent when continent theater changes
  useEffect(() => {
    const view = CONTINENT_VIEW_COORDS[selectedContinent];
    if (view && selectedContinent === 'all') {
      sceneControlsRef.current?.flyToLatLon(view.lat, view.lon, view.distance);
    }
  }, [selectedContinent]);

  const activeCoords = useMemo(() => {
    if (!selectedCountry) {
      return { lat: '00.00° N', lon: '00.00° E' };
    }
    const entry = COUNTRY_DATA[selectedCountry];
    if (entry) {
      const [lat, lon] = entry.latLon.split(' / ');
      return { lat, lon };
    }
    const feat = worldGeo.byName.get(selectedCountry);
    if (feat) {
      return {
        lat: formatLatLon(feat.centroidLat, feat.centroidLon).split(' / ')[0],
        lon: formatLatLon(feat.centroidLat, feat.centroidLon).split(' / ')[1],
      };
    }
    return { lat: '00.00° N', lon: '00.00° E' };
  }, [selectedCountry, worldGeo]);

  const hoveredFeature = useMemo(() => {
    if (!hoveredCountry) return null;
    const feat = worldGeo.byName.get(hoveredCountry);
    const node = COUNTRY_NODES.find((n) => n.name === hoveredCountry);
    const tier = threatOverrides[hoveredCountry] ?? getInitialThreatTier(hoveredCountry);
    return {
      name: hoveredCountry,
      continent: feat?.continent ?? node?.continent ?? COUNTRY_DATA[hoveredCountry]?.continent ?? 'Global',
      tier,
      meta: THREAT_LEVEL_CONFIG[tier],
    };
  }, [hoveredCountry, worldGeo, threatOverrides]);

  const alertMeta = activeMapAlert ? THREAT_LEVEL_CONFIG[activeMapAlert.newTier] : null;

  return (
    <div
      ref={containerRef}
      className={
        isFullscreen
          ? 'fixed inset-0 z-50 w-screen h-screen flex flex-col justify-between overflow-hidden bg-[#020714] select-none'
          : 'relative w-full h-full flex flex-col justify-between overflow-hidden bg-[#020714] rounded-xl border border-cyan-500/30 shadow-[0_0_40px_rgba(6,182,212,0.12)] select-none'
      }
    >
      {/* Tactical Corner Brackets */}
      <div className="corner-bracket corner-tl z-20" />
      <div className="corner-bracket corner-tr z-20" />
      <div className="corner-bracket corner-bl z-20" />
      <div className="corner-bracket corner-br z-20" />

      {/* Top HUD Telemetry Banner (solid rgba surface - zero backdrop-filter over WebGL) */}
      <div
        className="relative z-20 flex flex-wrap items-center justify-between gap-2 px-4 py-2.5 border-b border-cyan-500/20 text-[11px] font-mono"
        style={{ backgroundColor: 'rgba(2, 6, 23, 0.92)' }}
      >
        <div className="flex items-center space-x-3 text-cyan-400">
          <Crosshair className="w-3.5 h-3.5 text-cyan-400 shrink-0" />
          <span className="font-bold tracking-wider text-slate-100 whitespace-nowrap">
            {mapMode === '3d' ? 'ORBITAL_GEO_3D' : 'TACTICAL_SVG_2D'} // {worldGeo.countries.length} SOVEREIGN POLYGONS
          </span>
          <span className="text-slate-600 hidden sm:inline">|</span>
          <span className="text-slate-400 hidden sm:inline tabular-nums whitespace-nowrap">
            LAT: <span className="text-cyan-300">{activeCoords.lat}</span> LON:{' '}
            <span className="text-cyan-300">{activeCoords.lon}</span>
          </span>
        </div>

        {/* Projection Switcher, Country Quick Jump & Fullscreen Toggle */}
        <div className="flex items-center gap-2">
          <div
            role="group"
            aria-label="Map Projection Mode"
            className="flex items-center bg-slate-900 p-0.5 rounded border border-slate-700"
          >
            <button
              type="button"
              onClick={() => setMapMode('3d')}
              className={`px-2 py-0.5 rounded text-[10px] font-mono flex items-center gap-1 transition-colors cursor-pointer whitespace-nowrap ${
                mapMode === '3d'
                  ? 'bg-cyan-500 text-slate-950 font-bold'
                  : 'text-slate-400 hover:text-slate-200'
              }`}
              title="3D Orbital WebGL Globe"
            >
              <Globe2 className="w-3 h-3" />
              <span>3D GLOBE</span>
            </button>
            <button
              type="button"
              onClick={() => setMapMode('svg')}
              className={`px-2 py-0.5 rounded text-[10px] font-mono flex items-center gap-1 transition-colors cursor-pointer whitespace-nowrap ${
                mapMode === 'svg'
                  ? 'bg-cyan-500 text-slate-950 font-bold'
                  : 'text-slate-400 hover:text-slate-200'
              }`}
              title="2D Tactical Vector SVG Map"
            >
              <MapIcon className="w-3 h-3" />
              <span>2D SVG</span>
            </button>
          </div>

          <label htmlFor="globe-country-jump" className="sr-only">
            Jump to country
          </label>
          <select
            id="globe-country-jump"
            value={selectedCountry ?? ''}
            onChange={(e) => {
              const name = e.target.value;
              if (!name) {
                onSelectCountry(null);
                return;
              }
              const feat = worldGeo.byName.get(name);
              onSelectCountry(
                name,
                feat
                  ? { lat: feat.centroidLat, lon: feat.centroidLon, continent: feat.continent }
                  : undefined
              );
            }}
            className="bg-slate-900 border border-slate-700 hover:border-cyan-500/50 rounded px-2 py-1 text-[11px] font-mono text-slate-200 focus:outline-none focus:border-cyan-400 max-w-[165px] cursor-pointer"
          >
            <option value="">-- Global View (None) --</option>
            {sortedCountryNames.map((name) => (
              <option key={name} value={name}>
                {name}
              </option>
            ))}
          </select>

          <button
            type="button"
            onClick={() => setIsFullscreen((prev) => !prev)}
            className="p-1.5 rounded border border-cyan-500/30 bg-slate-900 hover:bg-cyan-500/20 text-cyan-300 transition-colors cursor-pointer"
            title={isFullscreen ? 'Exit Fullscreen Map (Esc)' : 'Expand Fullscreen Map'}
            aria-label={isFullscreen ? 'Exit Fullscreen Map' : 'Expand Fullscreen Map'}
          >
            {isFullscreen ? <Minimize2 className="w-3.5 h-3.5" /> : <Maximize2 className="w-3.5 h-3.5" />}
          </button>
        </div>
      </div>

      {/* Interactive Map Viewport (3D WebGL Globe + 2D Tactical SVG Projection) */}
      <div className="relative flex-1 w-full h-full min-h-[380px] overflow-hidden">
        {/* Stable Ref Mount for WebGL Canvas */}
        <div
          ref={canvasMountRef}
          className={
            mapMode === '3d'
              ? 'absolute inset-0 w-full h-full'
              : 'absolute inset-0 w-full h-full invisible pointer-events-none'
          }
        />

        {/* 2D Tactical SVG Projection with .world-tactical-landmass CSS filter glow */}
        {mapMode === 'svg' && (
          <WorldMap2DSvg
            ref={svgControlsRef}
            countries={worldGeo.countries}
            selectedCountry={selectedCountry}
            hoveredCountry={hoveredCountry}
            selectedContinent={selectedContinent}
            threatOverrides={threatOverrides}
            activeMapAlert={activeMapAlert}
            activeLayers={activeLayers}
            onSelectCountry={onSelectCountry}
            setHoveredCountry={setHoveredCountry}
            onSelectBeacon={(beacon) => setActiveBeacon(beacon)}
          />
        )}

        {/* Graceful Fallback if WebGL Unavailable */}
        {webglError && mapMode === '3d' && (
          <div
            className="absolute inset-0 z-30 flex items-center justify-center p-6 text-center font-mono text-xs text-slate-300"
            style={{ backgroundColor: 'rgba(2, 7, 20, 0.95)' }}
          >
            <div className="max-w-sm border border-cyan-500/30 rounded-xl p-5 bg-slate-950 space-y-3">
              <AlertTriangle className="w-6 h-6 text-amber-400 mx-auto" />
              <div className="font-bold text-white">3D GLOBE CONTEXT NOTICE</div>
              <p className="text-slate-400 font-sans">{webglError}</p>
              <button
                type="button"
                onClick={() => setMapMode('svg')}
                className="px-3 py-1.5 rounded bg-cyan-500/20 border border-cyan-500/50 text-cyan-300 hover:bg-cyan-500/30 font-mono text-[11px] cursor-pointer"
              >
                SWITCH TO 2D TACTICAL SVG
              </button>
            </div>
          </div>
        )}

        {/* Live Map Threat Alert Visual Notification Banner */}
        {activeMapAlert && alertMeta && (
          <div
            role="alert"
            className="absolute top-3 left-3 right-14 sm:right-auto sm:max-w-md z-30 border rounded-lg p-3 shadow-2xl font-mono"
            style={{
              backgroundColor: 'rgba(2, 6, 23, 0.94)',
              borderColor: `${alertMeta.hexColor}99`,
            }}
          >
            <div className="flex items-start justify-between gap-3">
              <div className="flex items-start gap-2.5">
                <div
                  className="p-1.5 rounded-md border shrink-0 mt-0.5"
                  style={{
                    backgroundColor: `${alertMeta.hexColor}22`,
                    borderColor: `${alertMeta.hexColor}66`,
                    color: alertMeta.hexColor,
                  }}
                >
                  {activeMapAlert.newTier === 'Critical' ? (
                    <ShieldAlert className="w-4 h-4" />
                  ) : (
                    <AlertTriangle className="w-4 h-4" />
                  )}
                </div>
                <div className="min-w-0">
                  <div className="flex flex-wrap items-center gap-1.5 text-[10px] font-bold tracking-wider">
                    <span style={{ color: alertMeta.hexColor }}>
                      {activeMapAlert.isEscalation ? 'THREAT ESCALATION' : 'THREAT LEVEL UPDATE'}
                    </span>
                    <span className="text-slate-600">·</span>
                    <span className="text-slate-400 tabular-nums">{activeMapAlert.timestamp}</span>
                  </div>
                  <div className="text-xs font-bold text-white mt-0.5">
                    {activeMapAlert.country.toUpperCase()} [{activeMapAlert.code}]
                  </div>
                  <div className="flex items-center gap-1.5 text-[11px] mt-1">
                    <span className="text-slate-400">{activeMapAlert.previousTier}</span>
                    <span className="text-slate-500">→</span>
                    <span className="font-bold" style={{ color: alertMeta.hexColor }}>
                      {alertMeta.label}
                    </span>
                  </div>
                  <p className="text-[11px] font-sans text-slate-300 mt-1 leading-snug">
                    {activeMapAlert.reason}
                  </p>
                  {selectedCountry !== activeMapAlert.country && (
                    <button
                      type="button"
                      onClick={() => {
                        const feat = worldGeo.byName.get(activeMapAlert.country);
                        onSelectCountry(
                          activeMapAlert.country,
                          feat
                            ? {
                                lat: feat.centroidLat,
                                lon: feat.centroidLon,
                                continent: feat.continent,
                              }
                            : undefined
                        );
                      }}
                      className="mt-2 px-2 py-0.5 rounded text-[10px] font-mono border border-cyan-500/40 bg-cyan-500/15 text-cyan-300 hover:bg-cyan-500/25 transition-colors cursor-pointer"
                    >
                      LOCK ON {activeMapAlert.code}
                    </button>
                  )}
                </div>
              </div>
              <button
                type="button"
                onClick={onDismissAlert}
                className="text-slate-400 hover:text-white p-0.5 cursor-pointer shrink-0"
                aria-label="Dismiss map threat alert"
              >
                <X className="w-3.5 h-3.5" />
              </button>
            </div>
          </div>
        )}

        {/* Hovered Country HUD Tooltip */}
        {hoveredFeature && (
          <div
            className="absolute top-3 left-1/2 -translate-x-1/2 z-20 pointer-events-none px-3 py-1.5 rounded-lg border border-cyan-500/40 font-mono text-[11px] flex items-center gap-2 whitespace-nowrap shadow-xl"
            style={{ backgroundColor: 'rgba(2, 6, 23, 0.92)' }}
          >
            <span className="font-bold text-white">{hoveredFeature.name.toUpperCase()}</span>
            <span className="text-slate-500">·</span>
            <span className="text-cyan-400">{hoveredFeature.continent}</span>
            <span className="text-slate-500">·</span>
            <span className="font-semibold" style={{ color: hoveredFeature.meta.hexColor }}>
              {hoveredFeature.meta.shortLabel}
            </span>
          </div>
        )}

        {/* Floating Zoom Controls (Top Right) */}
        <div
          className="absolute top-4 right-4 z-20 flex flex-col gap-1 p-1 rounded-lg border border-cyan-500/30 shadow-xl"
          style={{ backgroundColor: 'rgba(15, 23, 42, 0.92)' }}
        >
          <button
            type="button"
            onClick={() =>
              mapMode === '3d'
                ? sceneControlsRef.current?.zoomBy(0.84)
                : svgControlsRef.current?.zoomBy(0.82)
            }
            className="w-7 h-7 flex items-center justify-center rounded hover:bg-cyan-500/20 text-cyan-300 hover:text-cyan-100 transition-colors cursor-pointer"
            title="Zoom In"
            aria-label="Zoom In"
          >
            <Plus className="w-4 h-4" />
          </button>
          <button
            type="button"
            onClick={() =>
              mapMode === '3d'
                ? sceneControlsRef.current?.zoomBy(1.18)
                : svgControlsRef.current?.zoomBy(1.22)
            }
            className="w-7 h-7 flex items-center justify-center rounded hover:bg-cyan-500/20 text-cyan-300 hover:text-cyan-100 transition-colors cursor-pointer"
            title="Zoom Out"
            aria-label="Zoom Out"
          >
            <Minus className="w-4 h-4" />
          </button>
          <div className="h-px bg-slate-800 my-0.5" />
          <button
            type="button"
            onClick={() =>
              mapMode === '3d'
                ? sceneControlsRef.current?.resetCamera()
                : svgControlsRef.current?.resetView()
            }
            className="w-7 h-7 flex items-center justify-center rounded hover:bg-cyan-500/20 text-cyan-300 hover:text-cyan-100 text-[10px] font-mono transition-colors cursor-pointer"
            title={mapMode === '3d' ? 'Reset Globe Camera' : 'Reset Vector Map View'}
            aria-label={mapMode === '3d' ? 'Reset Globe Camera' : 'Reset Vector Map View'}
          >
            <RotateCcw className="w-3.5 h-3.5" />
          </button>
        </div>

        {/* Interactive Map Beacon Inspector Overlay */}
        {activeBeacon && (
          <div
            className="absolute bottom-16 left-4 z-20 max-w-xs border border-cyan-500/40 rounded-lg p-3 shadow-2xl font-mono text-[11px]"
            style={{ backgroundColor: 'rgba(2, 6, 23, 0.94)' }}
          >
            <div className="flex items-start justify-between gap-3 mb-1.5">
              <span className="text-[10px] text-cyan-400 font-semibold uppercase tracking-wider">
                {activeBeacon.type === 'chokepoint' && 'MARITIME CHOKEPOINT'}
                {activeBeacon.type === 'satellite' && 'ORBITAL SENSOR ASSET'}
                {activeBeacon.type === 'hotspot' && `SECTOR HOTSPOT // ${activeBeacon.data.level}`}
              </span>
              <button
                type="button"
                onClick={() => setActiveBeacon(null)}
                className="text-slate-400 hover:text-white cursor-pointer"
                aria-label="Close beacon readout"
              >
                <X className="w-3.5 h-3.5" />
              </button>
            </div>
            {activeBeacon.type === 'chokepoint' && (
              <>
                <div className="text-xs font-bold text-white">{activeBeacon.data.name}</div>
                <div className="text-amber-300 mt-1">{activeBeacon.data.note}</div>
                <div className="text-slate-400 mt-1">
                  THROUGHPUT: <span className="text-slate-200">{activeBeacon.data.throughput}</span>
                </div>
                <div className="text-slate-400">
                  STATUS: <span className="text-emerald-400">{activeBeacon.data.status}</span>
                </div>
              </>
            )}
            {activeBeacon.type === 'satellite' && (
              <>
                <div className="text-xs font-bold text-white">{activeBeacon.data.id}</div>
                <div className="text-cyan-300 mt-1">
                  {activeBeacon.data.alt} · {activeBeacon.data.status}
                </div>
                <div className="text-slate-400 mt-1">
                  FOOTPRINT: <span className="text-slate-200">{activeBeacon.data.footprint}</span>
                </div>
              </>
            )}
            {activeBeacon.type === 'hotspot' && (
              <>
                <div className="text-xs font-bold text-white">{activeBeacon.data.name}</div>
                <div className="text-slate-300 mt-1 font-sans leading-relaxed">{activeBeacon.data.advisory}</div>
              </>
            )}
          </div>
        )}

        {/* Collapsible Bottom Control Dock inside 3D Viewport */}
        <div className="absolute bottom-3 left-1/2 -translate-x-1/2 z-20 flex flex-col items-center max-w-[94%]">
          <button
            type="button"
            onClick={() => setDockCollapsed((prev) => !prev)}
            className="px-3 py-0.5 rounded-t-md border border-b-0 border-cyan-500/30 text-[10px] font-mono text-cyan-300 hover:text-white flex items-center gap-1 cursor-pointer"
            style={{ backgroundColor: 'rgba(2, 6, 23, 0.9)' }}
          >
            {dockCollapsed ? <ChevronUp className="w-3 h-3" /> : <ChevronDown className="w-3 h-3" />}
            {dockCollapsed ? 'Show Globe Controls (H)' : 'Hide Controls (H)'}
          </button>

          {!dockCollapsed && (
            <div
              className="flex flex-wrap items-center justify-center gap-1.5 px-3 py-1.5 rounded-lg border border-cyan-500/30 text-[10px] font-mono shadow-xl"
              style={{ backgroundColor: 'rgba(2, 6, 23, 0.92)' }}
            >
              <button
                type="button"
                onClick={() => setAutoRotate((prev) => !prev)}
                className={`px-2 py-1 rounded border transition-colors whitespace-nowrap cursor-pointer ${
                  autoRotate
                    ? 'bg-cyan-500/20 text-cyan-300 border-cyan-500/50'
                    : 'bg-slate-900 text-slate-400 border-slate-800 hover:text-slate-200'
                }`}
              >
                ORBIT SPIN: {autoRotate ? 'ON' : 'OFF'}
              </button>
              <span className="text-slate-700">|</span>
              <button
                type="button"
                onClick={() => toggleLayer('satellites')}
                className={`px-2 py-1 rounded border transition-colors whitespace-nowrap cursor-pointer ${
                  activeLayers.satellites
                    ? 'bg-cyan-500/20 text-cyan-300 border-cyan-500/50'
                    : 'bg-slate-900 text-slate-500 border-slate-800 hover:text-slate-300'
                }`}
              >
                SATS
              </button>
              <button
                type="button"
                onClick={() => toggleLayer('cables')}
                className={`px-2 py-1 rounded border transition-colors whitespace-nowrap cursor-pointer ${
                  activeLayers.cables
                    ? 'bg-emerald-500/20 text-emerald-300 border-emerald-500/50'
                    : 'bg-slate-900 text-slate-500 border-slate-800 hover:text-slate-300'
                }`}
              >
                CABLES/CHOKES
              </button>
              <button
                type="button"
                onClick={() => toggleLayer('threats')}
                className={`px-2 py-1 rounded border transition-colors whitespace-nowrap cursor-pointer ${
                  activeLayers.threats
                    ? 'bg-amber-500/20 text-amber-300 border-amber-500/50'
                    : 'bg-slate-900 text-slate-500 border-slate-800 hover:text-slate-300'
                }`}
              >
                HUB NODES
              </button>
              <button
                type="button"
                onClick={() => toggleLayer('conflicts')}
                className={`px-2 py-1 rounded border transition-colors whitespace-nowrap cursor-pointer ${
                  activeLayers.conflicts
                    ? 'bg-rose-500/20 text-rose-300 border-rose-500/50'
                    : 'bg-slate-900 text-slate-500 border-slate-800 hover:text-slate-300'
                }`}
              >
                HOTSPOTS
              </button>
            </div>
          )}
        </div>
      </div>

      {/* Bottom HUD Bar */}
      <div
        className="relative z-20 flex flex-wrap items-center justify-between gap-3 px-4 py-2 border-t border-cyan-500/20 text-[11px] font-mono text-slate-400"
        style={{ backgroundColor: 'rgba(2, 6, 23, 0.94)' }}
      >
        <div className="flex items-center space-x-3">
          <span className="flex items-center gap-1.5 text-cyan-400 font-semibold">
            <Target className="w-3.5 h-3.5" />
            LOCKED TARGET:{' '}
            <span className="text-white bg-slate-900 px-2 py-0.5 rounded border border-cyan-500/30">
              {selectedCountry || 'NONE (GLOBAL VIEW)'}
            </span>
          </span>
          <span className="hidden md:inline text-slate-600">|</span>
          <span className="hidden md:inline text-slate-400">
            THEATER: <span className="text-slate-200">{selectedContinent.toUpperCase()}</span>
          </span>
        </div>

        <div className="flex items-center space-x-3 text-[10px]">
          <span className="text-slate-500 hidden sm:inline">READINESS:</span>
          <div className="flex items-center space-x-1.5">
            <span className="px-1.5 py-0.5 rounded bg-emerald-500/10 text-emerald-400 border border-emerald-500/30 font-bold whitespace-nowrap">
              DEFCON 5 NORMAL
            </span>
            <span className="px-1.5 py-0.5 rounded bg-amber-500/10 text-amber-400 border border-amber-500/30 font-bold whitespace-nowrap">
              DEFCON 4 ELEVATED
            </span>
            <span className="px-1.5 py-0.5 rounded bg-rose-500/10 text-rose-400 border border-rose-500/30 font-bold whitespace-nowrap">
              DEFCON 2 CRITICAL
            </span>
          </div>
          <span className="hidden lg:inline text-slate-600">|</span>
          <span className="hidden lg:flex items-center gap-1 text-emerald-400 whitespace-nowrap">
            <Shield className="w-3 h-3" />{' '}
            {mapMode === '3d'
              ? 'DRAG TO ORBIT · CLICK ANY COUNTRY'
              : 'DRAG TO PAN · SCROLL TO ZOOM · HOVER FOR GLOW'}
          </span>
        </div>
      </div>
    </div>
  );
}
