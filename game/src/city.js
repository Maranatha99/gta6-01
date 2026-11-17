// City generation: a fixed grid of roads, blocks of buildings, parks, the beach and the
// ocean. Everything is decided by the seeded RNG, so the same seed builds the same city.
// Buildings are axis-aligned boxes used both for drawing and for collision.
import { COLORS, WORLD } from './config.js';

export const ROAD_LINES = [];
for (let p = WORLD.firstRoad; p <= WORLD.size - WORLD.firstRoad; p += WORLD.roadSpacing) ROAD_LINES.push(p);

export function isOnRoad(x, y) {
  const half = WORLD.roadWidth / 2;
  for (const p of ROAD_LINES) {
    if (Math.abs(x - p) < half || Math.abs(y - p) < half) return true;
  }
  return false;
}

/** The nearest road coordinate to a value (for snapping traffic and parking). */
export function nearestRoad(v) {
  let best = ROAD_LINES[0];
  for (const p of ROAD_LINES) if (Math.abs(p - v) < Math.abs(best - v)) best = p;
  return best;
}

export function createCity(random) {
  const buildings = [];
  const trees = [];
  const lamps = [];
  const parks = [];
  const pickups = [];
  const roadHalf = WORLD.roadWidth / 2;
  const block = WORLD.roadSpacing - WORLD.roadWidth;

  // Named places the missions and the HUD point at.
  const places = [
    { name: 'Mara\u2019s Garage', x: 1000, y: 600, color: '#e8c33c' },
    { name: 'Marina', x: 3000, y: 2600, color: '#7fb8d8' },
    { name: 'Hotel Palm Row', x: 1800, y: 1000, color: '#e8a87c' },
    { name: 'Casino Solmar', x: 2200, y: 1400, color: '#d88ad8' },
    { name: 'Chop Shop', x: 600, y: 2600, color: '#e87c5a' },
    { name: 'Warehouse Row', x: 2600, y: 2200, color: '#a8a8a8' },
    { name: 'Sun Bank', x: 1400, y: 600, color: '#e8c33c' },
    { name: 'Safehouse', x: 1000, y: 2600, color: '#7fb8a8' },
    { name: 'Solmar Beach', x: 1600, y: 3050, color: '#e8d29a' },
  ];

  for (let bx = 0; bx < ROAD_LINES.length - 1; bx += 1) {
    for (let by = 0; by < ROAD_LINES.length - 1; by += 1) {
      const x0 = ROAD_LINES[bx] + roadHalf + 10;
      const y0 = ROAD_LINES[by] + roadHalf + 10;
      const w = block - 20;
      const h = block - 20;
      const roll = random();
      // The south strip is the beach; the south-east corner is the marina.
      const isBeach = by === ROAD_LINES.length - 2 && random() < 0.7;
      if (isBeach) {
        parks.push({ x: x0, y: y0, w, h, kind: 'sand' });
        for (let t = 0; t < 5; t += 1) trees.push({ x: x0 + 20 + random() * (w - 40), y: y0 + 20 + random() * (h - 40), palm: true });
        continue;
      }
      if (roll < 0.16) {
        parks.push({ x: x0, y: y0, w, h, kind: 'park' });
        for (let t = 0; t < 6; t += 1) trees.push({ x: x0 + 20 + random() * (w - 40), y: y0 + 20 + random() * (h - 40), palm: random() < 0.5 });
        continue;
      }
      // 1-4 buildings per block, each with a roof colour and a height for shading.
      const count = 1 + Math.floor(random() * 3.4);
      for (let b = 0; b < count; b += 1) {
        const bw = 60 + random() * 90;
        const bh = 60 + random() * 90;
        const px = x0 + random() * Math.max(1, w - bw);
        const py = y0 + random() * Math.max(1, h - bh);
        let hit = false;
        for (const other of buildings) {
          if (px < other.x + other.w + 14 && px + bw + 14 > other.x && py < other.y + other.h + 14 && py + bh + 14 > other.y) { hit = true; break; }
        }
        if (hit) continue;
        const ci = Math.floor(random() * COLORS.building.length);
        buildings.push({
          x: px, y: py, w: bw, h: bh,
          color: COLORS.building[ci],
          roof: COLORS.roof[Math.floor(random() * COLORS.roof.length)],
          height: 14 + random() * 46,
          windows: Math.floor(random() * 3),
        });
      }
      // A lamp on two corners of most blocks.
      if (random() < 0.8) {
        lamps.push({ x: x0 - 4, y: y0 - 4 });
        lamps.push({ x: x0 + w + 4, y: y0 + h + 4 });
      }
      // A few palm trees along the sidewalk.
      if (random() < 0.6) trees.push({ x: x0 + random() * w, y: y0 - 2, palm: true });
    }
  }

  // Health and ammo pickups scattered near roads.
  for (let i = 0; i < 10; i += 1) {
    const rx = nearestRoad(random() * WORLD.size) + (random() - 0.5) * 60;
    const ry = nearestRoad(random() * WORLD.size) + (random() - 0.5) * 60;
    pickups.push({ x: rx, y: ry, kind: i % 2 === 0 ? 'health' : 'ammo', taken: false, respawn: 0 });
  }

  /** Circle (x, y, r) against every building: returns the pushed-out position or null. */
  function collideCircle(x, y, r) {
    let nx = x;
    let ny = y;
    let hit = false;
    for (const b of buildings) {
      const cx = Math.max(b.x, Math.min(nx, b.x + b.w));
      const cy = Math.max(b.y, Math.min(ny, b.y + b.h));
      const dx = nx - cx;
      const dy = ny - cy;
      const d2 = dx * dx + dy * dy;
      if (d2 < r * r && d2 > 0.0001) {
        const d = Math.sqrt(d2);
        nx = cx + (dx / d) * r;
        ny = cy + (dy / d) * r;
        hit = true;
      } else if (d2 <= 0.0001) {
        // Centre inside the box: push out along the smallest penetration axis.
        const left = nx - b.x;
        const right = b.x + b.w - nx;
        const top = ny - b.y;
        const bottom = b.y + b.h - ny;
        const m = Math.min(left, right, top, bottom);
        if (m === left) nx = b.x - r;
        else if (m === right) nx = b.x + b.w + r;
        else if (m === top) ny = b.y - r;
        else ny = b.y + b.h + r;
        hit = true;
      }
    }
    return hit ? { x: nx, y: ny } : null;
  }

  function insideBuilding(x, y, pad) {
    for (const b of buildings) {
      if (x > b.x - pad && x < b.x + b.w + pad && y > b.y - pad && y < b.y + b.h + pad) return true;
    }
    return false;
  }

  /** True when no building stands between (x1, y1) and (x2, y2): the slab test
   * against every building box. A unit inside a building sees nothing. */
  function hasLineOfSight(x1, y1, x2, y2) {
    const dx = x2 - x1;
    const dy = y2 - y1;
    for (const b of buildings) {
      let tmin = 0;
      let tmax = 1;
      let blocked = false;
      if (Math.abs(dx) < 1e-9) {
        if (x1 < b.x || x1 > b.x + b.w) continue;
      } else {
        let t1 = (b.x - x1) / dx;
        let t2 = (b.x + b.w - x1) / dx;
        if (t1 > t2) { const t = t1; t1 = t2; t2 = t; }
        tmin = Math.max(tmin, t1);
        tmax = Math.min(tmax, t2);
        if (tmin > tmax) continue;
      }
      if (Math.abs(dy) < 1e-9) {
        if (y1 < b.y || y1 > b.y + b.h) continue;
      } else {
        let t1 = (b.y - y1) / dy;
        let t2 = (b.y + b.h - y1) / dy;
        if (t1 > t2) { const t = t1; t1 = t2; t2 = t; }
        tmin = Math.max(tmin, t1);
        tmax = Math.min(tmax, t2);
        if (tmin > tmax) continue;
      }
      blocked = true;
      if (blocked) return false;
    }
    return true;
  }

  return { buildings, trees, lamps, parks, pickups, places, collideCircle, insideBuilding, hasLineOfSight };
}
