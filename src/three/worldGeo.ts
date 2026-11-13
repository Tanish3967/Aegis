import * as THREE from 'three';
import { feature } from 'topojson-client';
import type { Feature, FeatureCollection, MultiPolygon, Polygon, Position } from 'geojson';
import worldTopology from 'world-atlas/countries-110m.json';

export const GLOBE_RADIUS = 2.0;
export const LAND_RADIUS = 2.012;
export const BORDER_RADIUS = 2.019;

export interface CountryGeoFeature {
  id: string;
  name: string;
  rawName: string;
  continent: string;
  centroidLat: number;
  centroidLon: number;
  centroidVec3: THREE.Vector3;
  geometry: THREE.BufferGeometry;
  borderGeometry: THREE.BufferGeometry;
  svgPath: string;
}

const NAME_ALIASES: Record<string, string> = {
  'United States of America': 'United States',
};

const CONTINENT_OVERRIDES: Record<string, string> = {
  Russia: 'Asia',
  Turkey: 'Asia',
  Egypt: 'Africa',
  Greenland: 'North America',
  Iceland: 'Europe',
  Indonesia: 'Asia',
  'Papua New Guinea': 'Oceania',
  Australia: 'Oceania',
  'New Zealand': 'Oceania',
  Fiji: 'Oceania',
  'Solomon Is.': 'Oceania',
  Vanuatu: 'Oceania',
  'New Caledonia': 'Oceania',
  Antarctica: 'Antarctica',
};

export function normalizeCountryName(rawName: string): string {
  return NAME_ALIASES[rawName] ?? rawName;
}

export function inferContinent(name: string, lat: number, lon: number): string {
  if (CONTINENT_OVERRIDES[name]) return CONTINENT_OVERRIDES[name];
  if (lat < -60) return 'Antarctica';
  if (lon < -30) {
    return lat >= 12 ? 'North America' : 'South America';
  }
  if (lon >= -30 && lon <= 60) {
    if (lat >= 35.5) return 'Europe';
    if (lat >= 12 && lon >= 34) return 'Asia';
    return 'Africa';
  }
  if (lon > 110 && lat < -10) return 'Oceania';
  return 'Asia';
}

export function latLonToVec3(lat: number, lon: number, radius = LAND_RADIUS): THREE.Vector3 {
  const phi = THREE.MathUtils.degToRad(90 - lat);
  const theta = THREE.MathUtils.degToRad(lon + 180);
  return new THREE.Vector3(
    -radius * Math.sin(phi) * Math.cos(theta),
    radius * Math.cos(phi),
    radius * Math.sin(phi) * Math.sin(theta)
  );
}

function unwrapRing(ring: Position[]): THREE.Vector2[] {
  if (ring.length === 0) return [];
  const pts: THREE.Vector2[] = [];
  let prevLon = ring[0][0];
  pts.push(new THREE.Vector2(prevLon, ring[0][1]));

  for (let i = 1; i < ring.length; i++) {
    let lon = ring[i][0];
    const lat = ring[i][1];
    while (lon - prevLon > 180) lon -= 360;
    while (lon - prevLon < -180) lon += 360;
    prevLon = lon;
    pts.push(new THREE.Vector2(lon, lat));
  }

  // Remove duplicate closing point if identical
  if (pts.length > 2 && pts[0].distanceToSquared(pts[pts.length - 1]) < 1e-8) {
    pts.pop();
  }
  return pts;
}

function polarProjectRing(ring: Position[]): THREE.Vector2[] {
  const pts: THREE.Vector2[] = [];
  for (let i = 0; i < ring.length; i++) {
    const lonRad = THREE.MathUtils.degToRad(ring[i][0]);
    const r = Math.max(0.1, 90 + ring[i][1]);
    pts.push(new THREE.Vector2(r * Math.cos(lonRad), r * Math.sin(lonRad)));
  }
  if (pts.length > 2 && pts[0].distanceToSquared(pts[pts.length - 1]) < 1e-8) {
    pts.pop();
  }
  return pts;
}

function inversePolarToLonLat(x: number, y: number): [number, number] {
  const r = Math.hypot(x, y);
  const lat = THREE.MathUtils.clamp(r - 90, -89.9, 89.9);
  const lon = THREE.MathUtils.radToDeg(Math.atan2(y, x));
  return [lon, lat];
}

function subdivideAndProjectTriangles(
  vertices2D: THREE.Vector2[],
  faces: number[][],
  isPolarProjection: boolean,
  positionsOut: number[],
  normalsOut: number[],
  uvsOut: number[]
) {
  const MAX_EDGE_DEG = 5.5;
  const MAX_DEPTH = 3;

  const pushTri = (a: THREE.Vector2, b: THREE.Vector2, c: THREE.Vector2, depth: number) => {
    const ab = a.distanceTo(b);
    const bc = b.distanceTo(c);
    const ca = c.distanceTo(a);
    const maxEdge = Math.max(ab, bc, ca);

    if (depth < MAX_DEPTH && maxEdge > MAX_EDGE_DEG) {
      const mAB = new THREE.Vector2().addVectors(a, b).multiplyScalar(0.5);
      const mBC = new THREE.Vector2().addVectors(b, c).multiplyScalar(0.5);
      const mCA = new THREE.Vector2().addVectors(c, a).multiplyScalar(0.5);
      pushTri(a, mAB, mCA, depth + 1);
      pushTri(mAB, b, mBC, depth + 1);
      pushTri(mCA, mBC, c, depth + 1);
      pushTri(mAB, mBC, mCA, depth + 1);
      return;
    }

    const triPts = [a, b, c];
    const vecs3D: THREE.Vector3[] = [];
    const lonLats: [number, number][] = [];

    for (const pt of triPts) {
      const [lon, lat] = isPolarProjection ? inversePolarToLonLat(pt.x, pt.y) : [pt.x, pt.y];
      lonLats.push([lon, lat]);
      vecs3D.push(latLonToVec3(lat, lon, LAND_RADIUS));
    }

    // Ensure outward winding relative to sphere normal
    const e1 = new THREE.Vector3().subVectors(vecs3D[1], vecs3D[0]);
    const e2 = new THREE.Vector3().subVectors(vecs3D[2], vecs3D[0]);
    const faceNormal = new THREE.Vector3().crossVectors(e1, e2);
    const avgNormal = new THREE.Vector3()
      .addVectors(vecs3D[0], vecs3D[1])
      .add(vecs3D[2])
      .normalize();

    const orderedIdx = faceNormal.dot(avgNormal) >= 0 ? [0, 1, 2] : [0, 2, 1];

    for (const idx of orderedIdx) {
      const v = vecs3D[idx];
      const n = v.clone().normalize();
      const [lon, lat] = lonLats[idx];
      positionsOut.push(v.x, v.y, v.z);
      normalsOut.push(n.x, n.y, n.z);
      uvsOut.push((lon + 180) / 360, (lat + 90) / 180);
    }
  };

  for (const face of faces) {
    const a = vertices2D[face[0]];
    const b = vertices2D[face[1]];
    const c = vertices2D[face[2]];
    if (!a || !b || !c) continue;
    pushTri(a, b, c, 0);
  }
}

function addBorderSegments(
  ring: Position[],
  borderPositions: number[],
  countryBorderPositions?: number[],
  radius = BORDER_RADIUS
) {
  if (ring.length < 2) return;
  for (let i = 0; i < ring.length - 1; i++) {
    const [lonA, latA] = ring[i];
    const [lonB, latB] = ring[i + 1];
    // Skip antimeridian seam edge on Antarctica pole boundary
    if (Math.abs(lonA - lonB) > 180 && Math.abs(latA) > 80) continue;

    const pA = latLonToVec3(latA, lonA, radius);
    const pB = latLonToVec3(latB, lonB, radius);
    borderPositions.push(pA.x, pA.y, pA.z, pB.x, pB.y, pB.z);
    if (countryBorderPositions) {
      const pAH = latLonToVec3(latA, lonA, radius + 0.004);
      const pBH = latLonToVec3(latB, lonB, radius + 0.004);
      countryBorderPositions.push(pAH.x, pAH.y, pAH.z, pBH.x, pBH.y, pBH.z);
    }
  }
}

function ringToSvgSubpath(pts: THREE.Vector2[], lonOffset = 0): string {
  if (pts.length < 3) return '';
  let d = '';
  for (let i = 0; i < pts.length; i++) {
    const x = (((pts[i].x + lonOffset) + 180) / 360) * 1000;
    const y = ((90 - pts[i].y) / 180) * 500;
    d += `${i === 0 ? 'M' : 'L'}${x.toFixed(2)},${y.toFixed(2)}`;
  }
  return `${d}Z`;
}

function buildPolygonSvgPath(ring: Position[], isAntarctica: boolean): string {
  const pts = unwrapRing(ring);
  if (pts.length < 3) return '';

  let minLon = Infinity;
  let maxLon = -Infinity;
  for (const p of pts) {
    if (p.x < minLon) minLon = p.x;
    if (p.x > maxLon) maxLon = p.x;
  }

  // Shift centroid into [-180, 180]
  const midLon = (minLon + maxLon) * 0.5;
  let baseShift = 0;
  if (midLon > 180) baseShift = -360;
  else if (midLon < -180) baseShift = 360;

  let path = ringToSvgSubpath(pts, baseShift);
  if (!isAntarctica) {
    if (maxLon + baseShift > 180) {
      path += ringToSvgSubpath(pts, baseShift - 360);
    } else if (minLon + baseShift < -180) {
      path += ringToSvgSubpath(pts, baseShift + 360);
    }
  }
  return path;
}

export interface WorldGeoDataset {
  countries: CountryGeoFeature[];
  bordersGeometry: THREE.BufferGeometry;
  byName: Map<string, CountryGeoFeature>;
}

let cachedDataset: WorldGeoDataset | null = null;

export function buildWorldGeoDataset(): WorldGeoDataset {
  if (cachedDataset) return cachedDataset;

  const fc = feature(
    worldTopology,
    worldTopology.objects.countries
  ) as unknown as FeatureCollection<Polygon | MultiPolygon, { name: string }>;

  const countries: CountryGeoFeature[] = [];
  const byName = new Map<string, CountryGeoFeature>();
  const borderPositions: number[] = [];

  for (const feat of fc.features as Feature<Polygon | MultiPolygon, { name: string }>[]) {
    const rawName = feat.properties?.name ?? `Territory ${feat.id ?? ''}`;
    const name = normalizeCountryName(rawName);
    const isAntarctica = name === 'Antarctica';

    const polygons: Position[][][] =
      feat.geometry.type === 'Polygon' ? [feat.geometry.coordinates] : feat.geometry.coordinates;

    const positionsOut: number[] = [];
    const normalsOut: number[] = [];
    const uvsOut: number[] = [];
    const countryBorderPositions: number[] = [];
    const svgSubpaths: string[] = [];

    let largestPolyRing: Position[] = [];

    for (const poly of polygons) {
      if (!poly.length) continue;
      const outerRaw = poly[0];
      if (outerRaw.length > largestPolyRing.length) {
        largestPolyRing = outerRaw;
      }

      for (const ring of poly) {
        addBorderSegments(ring, borderPositions, countryBorderPositions);
        const sub = buildPolygonSvgPath(ring, isAntarctica);
        if (sub) svgSubpaths.push(sub);
      }

      const outer2D = isAntarctica ? polarProjectRing(outerRaw) : unwrapRing(outerRaw);
      if (outer2D.length < 3) continue;

      const holes2D: THREE.Vector2[][] = [];
      for (let h = 1; h < poly.length; h++) {
        const hole = isAntarctica ? polarProjectRing(poly[h]) : unwrapRing(poly[h]);
        if (hole.length >= 3) holes2D.push(hole);
      }

      const faces = THREE.ShapeUtils.triangulateShape(outer2D, holes2D);
      const combinedPts = outer2D.concat(...holes2D);

      subdivideAndProjectTriangles(
        combinedPts,
        faces,
        isAntarctica,
        positionsOut,
        normalsOut,
        uvsOut
      );
    }

    if (positionsOut.length === 0) continue;

    const geometry = new THREE.BufferGeometry();
    geometry.setAttribute('position', new THREE.Float32BufferAttribute(positionsOut, 3));
    geometry.setAttribute('normal', new THREE.Float32BufferAttribute(normalsOut, 3));
    geometry.setAttribute('uv', new THREE.Float32BufferAttribute(uvsOut, 2));
    geometry.computeBoundingSphere();

    const borderGeometry = new THREE.BufferGeometry();
    borderGeometry.setAttribute(
      'position',
      new THREE.Float32BufferAttribute(countryBorderPositions, 3)
    );
    borderGeometry.computeBoundingSphere();

    // Calculate visual centroid from largest polygon ring
    let sumLat = 0;
    let sumLon = 0;
    const unwrappedCentroidRing = unwrapRing(largestPolyRing);
    for (const pt of unwrappedCentroidRing) {
      sumLon += pt.x;
      sumLat += pt.y;
    }
    const count = Math.max(1, unwrappedCentroidRing.length);
    let centroidLon = sumLon / count;
    while (centroidLon > 180) centroidLon -= 360;
    while (centroidLon < -180) centroidLon += 360;
    const centroidLat = isAntarctica ? -82 : THREE.MathUtils.clamp(sumLat / count, -85, 85);

    const centroidVec3 = latLonToVec3(centroidLat, centroidLon, LAND_RADIUS);
    const continent = inferContinent(name, centroidLat, centroidLon);

    const countryFeature: CountryGeoFeature = {
      id: String(feat.id ?? name),
      name,
      rawName,
      continent,
      centroidLat,
      centroidLon,
      centroidVec3,
      geometry,
      borderGeometry,
      svgPath: svgSubpaths.join(' '),
    };

    countries.push(countryFeature);
    byName.set(name, countryFeature);
  }

  const bordersGeometry = new THREE.BufferGeometry();
  bordersGeometry.setAttribute('position', new THREE.Float32BufferAttribute(borderPositions, 3));
  bordersGeometry.computeBoundingSphere();

  cachedDataset = { countries, bordersGeometry, byName };
  return cachedDataset;
}
