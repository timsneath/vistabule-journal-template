// Bakes road-following route geometry for each trip into src/data/routes.json.
//
// Why this exists: Leaflet only draws straight lines between waypoints. To make
// the trip maps follow real roads we ask OSRM (the public demo router) for the
// driving geometry through a trip's ordered waypoints, then store the result so
// the route is computed ONCE — not on every build, and never in the visitor's
// browser. TripMap.astro reads the cached geometry and draws it.
//
// The cache is keyed by trip slug and carries a `signature` of the waypoint
// coordinates. We only call OSRM when that signature changes, so committed
// routes survive rebuilds (including on Cloudflare) without any network call.
//
// Each waypoint says how we reached it (`arrive`: drive | ferry). Consecutive
// drive legs are routed together in one OSRM call; ferry legs are stored as a
// straight crossing, since the driving profile would route around the water. The
// cache holds the result as `segments: [{ mode, geometry }]`.
//
// This script must never break a build: any OSRM failure logs a warning and
// exits 0. If a trip's waypoints changed and a drive run can't be routed, that
// run is stored as a straight `fallback` segment (a dashed guide in TripMap).

import { createHash } from 'node:crypto';
import { readdir, readFile, writeFile } from 'node:fs/promises';
import { fileURLToPath } from 'node:url';

const TRIPS_DIR = new URL('../src/content/trips/', import.meta.url);
const CACHE_FILE = new URL('../src/data/routes.json', import.meta.url);
const OSRM = 'https://router.project-osrm.org/route/v1/driving/';

// Parse a Sveltia map field (stringified GeoJSON Point, [lng, lat]) → [lng, lat].
function parseLngLat(location) {
  try {
    const geo = JSON.parse(location ?? '');
    if (geo?.type === 'Point' && Array.isArray(geo.coordinates)) {
      const [lng, lat] = geo.coordinates.map(Number);
      if (Number.isFinite(lng) && Number.isFinite(lat)) return [lng, lat];
    }
  } catch {
    /* malformed/empty → skip */
  }
  return null;
}

// Bump when the stored geometry changes shape or detail, to rebake every trip.
const FORMAT = 4;

function signature(points) {
  // Round to ~1m so trivial precision noise doesn't force a refetch. The leg mode
  // is part of the key, so switching a leg to ferry re-routes.
  const key = `v${FORMAT};` + points
    .map(({ coord: [lng, lat], arrive }) => `${arrive}:${lng.toFixed(5)},${lat.toFixed(5)}`)
    .join(';');
  return createHash('sha256').update(key).digest('hex').slice(0, 16);
}

// Douglas–Peucker line thinning. OSRM's own "simplified" overview is tuned for
// a whole-route view and cuts corners badly once the map zooms in on the
// destination, so we take the full geometry and thin it ourselves to ~15 m.
function thin(line, tolerance = 0.00015) {
  if (line.length < 3) return line;
  const keep = new Uint8Array(line.length);
  keep[0] = keep[line.length - 1] = 1;
  const stack = [[0, line.length - 1]];
  while (stack.length) {
    const [a, b] = stack.pop();
    const [ax, ay] = line[a];
    const [bx, by] = line[b];
    const dx = bx - ax;
    const dy = by - ay;
    const len = Math.hypot(dx, dy);
    let worst = -1;
    let far = 0;
    for (let i = a + 1; i < b; i++) {
      // Distance to the chord — or, for a loop that ends where it started, to
      // that shared endpoint.
      const d = len
        ? Math.abs(dy * (line[i][0] - ax) - dx * (line[i][1] - ay)) / len
        : Math.hypot(line[i][0] - ax, line[i][1] - ay);
      if (d > far) [far, worst] = [d, i];
    }
    if (far > tolerance) {
      keep[worst] = 1;
      stack.push([a, worst], [worst, b]);
    }
  }
  return line.filter((_, i) => keep[i]);
}

async function fetchRoute(coords) {
  const path = coords.map(([lng, lat]) => `${lng},${lat}`).join(';');
  const url = `${OSRM}${path}?overview=full&geometries=geojson`;
  const ctrl = new AbortController();
  const timer = setTimeout(() => ctrl.abort(), 15_000);
  try {
    const res = await fetch(url, { signal: ctrl.signal });
    if (!res.ok) throw new Error(`HTTP ${res.status}`);
    const data = await res.json();
    const line = data?.routes?.[0]?.geometry?.coordinates;
    if (!Array.isArray(line) || line.length < 2) throw new Error('no geometry');
    // Store as [lat, lng] (Leaflet order), trimmed to 5 decimals to stay lean.
    return thin(line).map(([lng, lat]) => [Number(lat.toFixed(5)), Number(lng.toFixed(5))]);
  } finally {
    clearTimeout(timer);
  }
}

async function readCache() {
  try {
    return JSON.parse(await readFile(CACHE_FILE, 'utf8'));
  } catch {
    return {};
  }
}

const toLatLng = ([lng, lat]) => [Number(lat.toFixed(5)), Number(lng.toFixed(5))];

// Split the ordered points into runs travelled the same way. Each point's
// `arrive` is the mode of the leg ending at it; consecutive drive legs share a
// run so they cost one OSRM call, and every ferry leg is its own two-point run.
function runs(points) {
  const out = [];
  for (let i = 1; i < points.length; i++) {
    const mode = points[i].arrive;
    const last = out.at(-1);
    if (mode === 'drive' && last?.mode === 'drive') {
      last.coords.push(points[i].coord);
    } else {
      out.push({ mode, coords: [points[i - 1].coord, points[i].coord] });
    }
  }
  return out;
}

async function buildSegments(slug, points) {
  const segments = [];
  for (const run of runs(points)) {
    if (run.mode === 'ferry') {
      segments.push({ mode: 'ferry', geometry: run.coords.map(toLatLng) });
      continue;
    }
    try {
      segments.push({ mode: 'drive', geometry: await fetchRoute(run.coords) });
    } catch (err) {
      console.warn(`  ⚠ could not route part of ${slug}: ${err.message} — using a straight line`);
      segments.push({ mode: 'drive', geometry: run.coords.map(toLatLng), fallback: true });
    }
  }
  return segments;
}

const cache = await readCache();
const files = (await readdir(TRIPS_DIR)).filter((f) => f.endsWith('.json'));
const seen = new Set();
let changed = false;

for (const file of files) {
  const slug = file.replace(/\.json$/, '');
  seen.add(slug);
  const trip = JSON.parse(await readFile(new URL(file, TRIPS_DIR), 'utf8'));
  const points = (trip.waypoints ?? [])
    .map((w) => ({ coord: parseLngLat(w.location), arrive: w.arrive === 'ferry' ? 'ferry' : 'drive' }))
    .filter((p) => p.coord);

  // Round trips loop back to where they started, by road. Appending the first
  // point here also flows into the signature, so toggling roundTrip re-routes.
  if (trip.roundTrip && points.length >= 2) {
    points.push({ coord: points[0].coord, arrive: 'drive' });
  }

  // Need at least two real points to have a route.
  if (points.length < 2) {
    if (cache[slug]) {
      delete cache[slug];
      changed = true;
    }
    continue;
  }

  const sig = signature(points);
  const cached = cache[slug];
  // Up to date, with nothing left to retry → no OSRM call.
  if (
    cached?.signature === sig &&
    Array.isArray(cached?.segments) &&
    !cached.segments.some((s) => s.fallback)
  ) {
    continue;
  }

  const segments = await buildSegments(slug, points);
  // A run that failed this time but was routed before keeps its old route
  // rather than regressing to a straight line.
  if (cached?.signature === sig && segments.some((s) => s.fallback)) continue;
  cache[slug] = { signature: sig, segments };
  changed = true;
  const ferries = segments.filter((s) => s.mode === 'ferry').length;
  console.log(
    `  routed ${slug} (${points.length} points → ${segments.length} segment(s)` +
      (ferries ? `, ${ferries} ferry` : '') +
      ')'
  );
}

// Drop cache entries for trips that no longer exist.
for (const slug of Object.keys(cache)) {
  if (!seen.has(slug)) {
    delete cache[slug];
    changed = true;
  }
}

if (changed) {
  // One [lat, lng] pair per line keeps the file (and its diffs) compact.
  const json = JSON.stringify(cache, null, 2).replace(
    /\[\s+(-?[\d.]+),\s+(-?[\d.]+)\s+\]/g,
    '[$1, $2]'
  );
  await writeFile(CACHE_FILE, json + '\n');
  console.log(`Updated ${fileURLToPath(CACHE_FILE)}`);
} else {
  console.log('Routes up to date — no OSRM calls needed.');
}
