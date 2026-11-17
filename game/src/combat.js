// Combat: bullets, muzzle flashes, impacts and the particle bursts (smoke, sparks,
// blood-less dust puffs — nobody bleeds on screen). Pools are allocated once.
import { PLAYER } from './config.js';

export function createCombat() {
  const bullets = [];
  for (let i = 0; i < 48; i += 1) bullets.push({ active: false, x: 0, y: 0, vx: 0, vy: 0, travelled: 0, friendly: true });
  const particles = [];
  for (let i = 0; i < 160; i += 1) particles.push({ active: false, x: 0, y: 0, vx: 0, vy: 0, life: 0, max: 1, size: 3, color: '#fff' });
  return { bullets, particles };
}

export function fireBullet(combat, x, y, angle, friendly) {
  for (const b of combat.bullets) {
    if (b.active) continue;
    b.active = true;
    b.x = x + Math.cos(angle) * 20;
    b.y = y + Math.sin(angle) * 20;
    b.vx = Math.cos(angle) * PLAYER.bulletSpeed;
    b.vy = Math.sin(angle) * PLAYER.bulletSpeed;
    b.travelled = 0;
    b.friendly = friendly;
    return b;
  }
  return null;
}

export function spawnParticles(combat, x, y, count, color, speed, life) {
  let made = 0;
  for (const p of combat.particles) {
    if (made >= count) break;
    if (p.active) continue;
    const a = Math.random() * Math.PI * 2;
    const s = speed * (0.4 + Math.random() * 0.8);
    p.active = true;
    p.x = x;
    p.y = y;
    p.vx = Math.cos(a) * s;
    p.vy = Math.sin(a) * s;
    p.max = life * (0.6 + Math.random() * 0.8);
    p.life = p.max;
    p.size = 2 + Math.random() * 4;
    p.color = color;
    made += 1;
  }
}

/** Advance bullets and particles; `hitTest(bullet)` returns 'block'|'ped'|'cop'|'car'|null. */
export function stepCombat(combat, dt, hitTest) {
  for (const b of combat.bullets) {
    if (!b.active) continue;
    b.x += b.vx * dt;
    b.y += b.vy * dt;
    b.travelled += PLAYER.bulletSpeed * dt;
    const hit = hitTest(b);
    if (hit || b.travelled > PLAYER.bulletRange) {
      if (hit === 'block') spawnParticles(combat, b.x, b.y, 5, '#c8c8c8', 120, 0.4);
      if (hit === 'ped' || hit === 'cop') spawnParticles(combat, b.x, b.y, 8, '#d8b88a', 140, 0.5);
      if (hit === 'car') spawnParticles(combat, b.x, b.y, 7, '#e8c33c', 200, 0.35);
      b.active = false;
    }
  }
  for (const p of combat.particles) {
    if (!p.active) continue;
    p.life -= dt;
    if (p.life <= 0) { p.active = false; continue; }
    p.x += p.vx * dt;
    p.y += p.vy * dt;
    p.vx *= 0.92;
    p.vy *= 0.92;
  }
}
