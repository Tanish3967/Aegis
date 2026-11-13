import * as THREE from 'three';
import { GLOBE_RADIUS, latLonToVec3 } from './worldGeo';

export function createOceanTextures(maxAnisotropy: number) {
  const width = 2048;
  const height = 1024;

  const albedoCanvas = document.createElement('canvas');
  albedoCanvas.width = width;
  albedoCanvas.height = height;
  const ctx = albedoCanvas.getContext('2d')!;

  // Deep abyssal oceanic gradient
  const grad = ctx.createLinearGradient(0, 0, 0, height);
  grad.addColorStop(0, '#020917');
  grad.addColorStop(0.5, '#031126');
  grad.addColorStop(1, '#020816');
  ctx.fillStyle = grad;
  ctx.fillRect(0, 0, width, height);

  // Subtle bathymetry noise bands
  for (let i = 0; i < 180; i++) {
    const x = ((i * 73) % width);
    const y = ((i * 137) % height);
    const r = 35 + ((i * 29) % 90);
    const radial = ctx.createRadialGradient(x, y, 2, x, y, r);
    radial.addColorStop(0, 'rgba(14, 116, 144, 0.08)');
    radial.addColorStop(1, 'rgba(2, 8, 22, 0)');
    ctx.fillStyle = radial;
    ctx.beginPath();
    ctx.arc(x, y, r, 0, Math.PI * 2);
    ctx.fill();
  }

  // Latitude & longitude tactical graticules (every 15 deg)
  ctx.strokeStyle = 'rgba(56, 189, 248, 0.14)';
  ctx.lineWidth = 1;
  for (let lon = -180; lon <= 180; lon += 15) {
    const x = ((lon + 180) / 360) * width;
    ctx.beginPath();
    ctx.moveTo(x, 0);
    ctx.lineTo(x, height);
    ctx.stroke();
  }
  for (let lat = -75; lat <= 75; lat += 15) {
    const y = ((90 - lat) / 180) * height;
    ctx.strokeStyle = lat === 0 ? 'rgba(6, 182, 212, 0.34)' : 'rgba(56, 189, 248, 0.14)';
    ctx.lineWidth = lat === 0 ? 1.8 : 1;
    ctx.beginPath();
    ctx.moveTo(0, y);
    ctx.lineTo(width, y);
    ctx.stroke();
  }

  const albedoMap = new THREE.CanvasTexture(albedoCanvas);
  albedoMap.colorSpace = THREE.SRGBColorSpace;
  albedoMap.anisotropy = maxAnisotropy;
  albedoMap.needsUpdate = true;

  // Linear roughness map (subtle specular variation across oceans)
  const roughCanvas = document.createElement('canvas');
  roughCanvas.width = 512;
  roughCanvas.height = 256;
  const rCtx = roughCanvas.getContext('2d')!;
  rCtx.fillStyle = '#8e8e8e';
  rCtx.fillRect(0, 0, 512, 256);
  for (let i = 0; i < 320; i++) {
    const x = (i * 47) % 512;
    const y = (i * 83) % 256;
    const w = 12 + (i % 24);
    rCtx.fillStyle = i % 2 === 0 ? 'rgba(200,200,200,0.12)' : 'rgba(90,90,90,0.12)';
    rCtx.fillRect(x, y, w, 4);
  }
  const roughnessMap = new THREE.CanvasTexture(roughCanvas);
  roughnessMap.colorSpace = THREE.NoColorSpace;
  roughnessMap.anisotropy = maxAnisotropy;
  roughnessMap.needsUpdate = true;

  return { albedoMap, roughnessMap };
}

export function createSolarPanelTexture(maxAnisotropy: number): THREE.CanvasTexture {
  const canvas = document.createElement('canvas');
  canvas.width = 256;
  canvas.height = 128;
  const ctx = canvas.getContext('2d')!;

  ctx.fillStyle = '#0a1f44';
  ctx.fillRect(0, 0, 256, 128);

  ctx.strokeStyle = '#38bdf8';
  ctx.lineWidth = 2;
  for (let x = 0; x <= 256; x += 32) {
    ctx.beginPath();
    ctx.moveTo(x, 0);
    ctx.lineTo(x, 128);
    ctx.stroke();
  }
  for (let y = 0; y <= 128; y += 32) {
    ctx.beginPath();
    ctx.moveTo(0, y);
    ctx.lineTo(256, y);
    ctx.stroke();
  }

  const tex = new THREE.CanvasTexture(canvas);
  tex.colorSpace = THREE.SRGBColorSpace;
  tex.anisotropy = maxAnisotropy;
  tex.needsUpdate = true;
  return tex;
}

export function createAtmosphereMaterial(): THREE.ShaderMaterial {
  return new THREE.ShaderMaterial({
    uniforms: {
      glowColor: { value: new THREE.Color(0x06b6d4) },
    },
    vertexShader: `
      varying vec3 vNormal;
      varying vec3 vViewDir;
      void main() {
        vec4 mvPos = modelViewMatrix * vec4(position, 1.0);
        vNormal = normalize(normalMatrix * normal);
        vViewDir = normalize(-mvPos.xyz);
        gl_Position = projectionMatrix * mvPos;
      }
    `,
    fragmentShader: `
      uniform vec3 glowColor;
      varying vec3 vNormal;
      varying vec3 vViewDir;
      void main() {
        float rim = 1.0 - max(0.0, dot(vNormal, vViewDir));
        float intensity = pow(rim, 3.2) * 0.72;
        gl_FragColor = vec4(glowColor, intensity);
      }
    `,
    transparent: true,
    depthWrite: false,
    blending: THREE.AdditiveBlending,
    side: THREE.FrontSide,
  });
}

// Composite 7-part procedural Orbital Reconnaissance Satellite (THREE.Group)
export function createOrbitalSatelliteGroup(
  solarTex: THREE.CanvasTexture,
  satelliteId: string
): THREE.Group {
  const group = new THREE.Group();
  group.name = `satellite-${satelliteId}`;

  const titaniumMat = new THREE.MeshStandardMaterial({
    color: 0xcbd5e1,
    metalness: 0.88,
    roughness: 0.24,
  });

  const kaptonFoilMat = new THREE.MeshStandardMaterial({
    color: 0xf59e0b,
    metalness: 0.92,
    roughness: 0.34,
  });

  const solarPanelMat = new THREE.MeshStandardMaterial({
    map: solarTex,
    metalness: 0.45,
    roughness: 0.18,
    emissive: 0x082f49,
    emissiveIntensity: 0.35,
  });

  const lensMat = new THREE.MeshStandardMaterial({
    color: 0x38bdf8,
    metalness: 0.15,
    roughness: 0.08,
    emissive: 0x06b6d4,
    emissiveIntensity: 0.65,
  });

  // Part 1: Primary octagonal chassis bus
  const busGeo = new THREE.CylinderGeometry(0.026, 0.026, 0.068, 8);
  const busMesh = new THREE.Mesh(busGeo, titaniumMat);
  busMesh.rotation.z = Math.PI / 2;
  group.add(busMesh);

  // Part 2: Aft gold Kapton thermal foil module
  const aftGeo = new THREE.CylinderGeometry(0.021, 0.024, 0.026, 8);
  const aftMesh = new THREE.Mesh(aftGeo, kaptonFoilMat);
  aftMesh.rotation.z = Math.PI / 2;
  aftMesh.position.x = -0.044;
  group.add(aftMesh);

  // Part 3: Forward optical turret barrel
  const turretGeo = new THREE.CylinderGeometry(0.015, 0.019, 0.028, 12);
  const turretMesh = new THREE.Mesh(turretGeo, titaniumMat);
  turretMesh.position.y = -0.028;
  group.add(turretMesh);

  // Part 4: Sapphire optical lens element
  const lensGeo = new THREE.SphereGeometry(0.013, 12, 12);
  const lensMesh = new THREE.Mesh(lensGeo, lensMat);
  lensMesh.position.y = -0.042;
  group.add(lensMesh);

  // Part 5: Parabolic high-gain dish via LatheGeometry
  const dishPts = [
    new THREE.Vector2(0.001, 0),
    new THREE.Vector2(0.014, 0.003),
    new THREE.Vector2(0.026, 0.012),
  ];
  const dishGeo = new THREE.LatheGeometry(dishPts, 16);
  const dishMesh = new THREE.Mesh(dishGeo, titaniumMat);
  dishMesh.position.y = 0.026;
  group.add(dishMesh);

  // Part 6 & 7: Port and Starboard solar wing struts + photovoltaic panels
  const boomGeo = new THREE.CylinderGeometry(0.0035, 0.0035, 0.17, 6);
  const boomMesh = new THREE.Mesh(boomGeo, titaniumMat);
  boomMesh.rotation.x = Math.PI / 2;
  group.add(boomMesh);

  const wingGeo = new THREE.BoxGeometry(0.036, 0.004, 0.072);
  const portWing = new THREE.Mesh(wingGeo, solarPanelMat);
  portWing.position.z = 0.056;
  group.add(portWing);

  const starboardWing = new THREE.Mesh(wingGeo, solarPanelMat);
  starboardWing.position.z = -0.056;
  group.add(starboardWing);

  // Invisible raycast proxy sphere on Layer 1 so selecting orbiting satellites is effortless
  const hitProxy = new THREE.Mesh(
    new THREE.SphereGeometry(0.095, 8, 8),
    new THREE.MeshBasicMaterial({ visible: false })
  );
  hitProxy.layers.enable(1);
  hitProxy.userData = { beaconType: 'satellite', satelliteId };
  group.add(hitProxy);

  return group;
}

// Composite 4-part Target & Alert Beacon Assembly (THREE.Group) pivoted at surface y=0
export function createTargetBeaconGroup() {
  const group = new THREE.Group();

  const ringMat = new THREE.MeshBasicMaterial({
    color: 0x06b6d4,
    side: THREE.DoubleSide,
    transparent: true,
    opacity: 0.9,
    depthWrite: false,
  });

  const spireMat = new THREE.MeshStandardMaterial({
    color: 0x38bdf8,
    emissive: 0x06b6d4,
    emissiveIntensity: 0.75,
    metalness: 0.7,
    roughness: 0.25,
  });

  const shockwaveMat = new THREE.MeshBasicMaterial({
    color: 0xf59e0b,
    side: THREE.DoubleSide,
    transparent: true,
    opacity: 0,
    depthWrite: false,
  });

  // Part 1: Flush contact ring on globe surface
  const baseRingGeo = new THREE.RingGeometry(0.028, 0.044, 32);
  const baseRing = new THREE.Mesh(baseRingGeo, ringMat);
  baseRing.rotation.x = -Math.PI / 2;
  baseRing.position.y = 0.004;
  group.add(baseRing);

  // Part 2: Tapered vertical telemetry needle pivoted at base
  const spireGeo = new THREE.CylinderGeometry(0.004, 0.011, 0.14, 12);
  spireGeo.translate(0, 0.07, 0);
  const spire = new THREE.Mesh(spireGeo, spireMat);
  group.add(spire);

  // Part 3: Orbiting reticle torus
  const reticleGeo = new THREE.TorusGeometry(0.055, 0.0045, 8, 32);
  const reticle = new THREE.Mesh(reticleGeo, ringMat);
  reticle.rotation.x = Math.PI / 2;
  reticle.position.y = 0.018;
  group.add(reticle);

  // Part 4: Expanding alert shockwave ring
  const shockGeo = new THREE.RingGeometry(0.035, 0.052, 32);
  const shockwave = new THREE.Mesh(shockGeo, shockwaveMat);
  shockwave.rotation.x = -Math.PI / 2;
  shockwave.position.y = 0.006;
  group.add(shockwave);

  return {
    group,
    ringMat,
    spireMat,
    shockwave,
    shockwaveMat,
    reticle,
  };
}

// Composite Equatorial & Polar Gimbal Calibration Assembly (THREE.Group)
export function createGimbalRingAssembly(): THREE.Group {
  const group = new THREE.Group();

  const steelMat = new THREE.MeshStandardMaterial({
    color: 0x0e7490,
    metalness: 0.85,
    roughness: 0.28,
    transparent: true,
    opacity: 0.42,
  });

  const accentMat = new THREE.MeshStandardMaterial({
    color: 0x38bdf8,
    emissive: 0x0284c7,
    emissiveIntensity: 0.5,
    metalness: 0.8,
    roughness: 0.2,
  });

  // Part 1: Equatorial gimbal ring
  const eqRing = new THREE.Mesh(new THREE.TorusGeometry(GLOBE_RADIUS + 0.18, 0.004, 8, 128), steelMat);
  eqRing.rotation.x = Math.PI / 2;
  group.add(eqRing);

  // Part 2: Inclined polar meridian ring
  const polarRing = new THREE.Mesh(new THREE.TorusGeometry(GLOBE_RADIUS + 0.23, 0.003, 8, 128), steelMat);
  polarRing.rotation.y = Math.PI / 4;
  group.add(polarRing);

  // Part 3-6: Cardinal calibration lugs on equatorial gimbal
  const lugGeo = new THREE.BoxGeometry(0.025, 0.018, 0.04);
  for (let i = 0; i < 4; i++) {
    const angle = (i * Math.PI) / 2;
    const lug = new THREE.Mesh(lugGeo, accentMat);
    const r = GLOBE_RADIUS + 0.18;
    lug.position.set(Math.cos(angle) * r, 0, Math.sin(angle) * r);
    lug.rotation.y = -angle;
    group.add(lug);
  }

  return group;
}

export function createGreatCircleArc(
  latA: number,
  lonA: number,
  latB: number,
  lonB: number,
  colorHex: number
): THREE.Mesh {
  const start = latLonToVec3(latA, lonA, GLOBE_RADIUS + 0.018);
  const end = latLonToVec3(latB, lonB, GLOBE_RADIUS + 0.018);
  const dist = start.distanceTo(end);
  const arcHeight = GLOBE_RADIUS + 0.04 + dist * 0.14;

  const mid1 = new THREE.Vector3().lerpVectors(start, end, 0.28).normalize().multiplyScalar(arcHeight * 0.96);
  const midCenter = new THREE.Vector3().lerpVectors(start, end, 0.5).normalize().multiplyScalar(arcHeight);
  const mid2 = new THREE.Vector3().lerpVectors(start, end, 0.72).normalize().multiplyScalar(arcHeight * 0.96);

  const curve = new THREE.CatmullRomCurve3([start, mid1, midCenter, mid2, end]);
  const geo = new THREE.TubeGeometry(curve, 36, 0.0055, 6, false);
  const mat = new THREE.MeshBasicMaterial({
    color: colorHex,
    transparent: true,
    opacity: 0.65,
  });

  return new THREE.Mesh(geo, mat);
}
