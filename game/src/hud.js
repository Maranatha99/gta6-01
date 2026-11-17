// HUD: health and money, wanted stars, the mission objective, speed, messages and the
// minimap. Everything is drawn in screen space, after the world. The minimap is a small
// live map of the whole city: roads, the player, the objective, police and the mission car.
import { WORLD } from './config.js';

export const FONT = 'system-ui, -apple-system, "Segoe UI", sans-serif';

const MAP_SIZE = 196;
const MAP_PAD = 14;

export function drawStars(ctx, x, y, stars) {
  ctx.font = `bold 26px ${FONT}`;
  ctx.textAlign = 'left';
  ctx.textBaseline = 'alphabetic';
  for (let i = 0; i < 5; i += 1) {
    ctx.fillStyle = i < stars ? '#ffd23c' : 'rgba(255,255,255,0.28)';
    ctx.strokeStyle = 'rgba(0,0,0,0.55)';
    ctx.lineWidth = 1.5;
    const cx = x + i * 32;
    drawStar(ctx, cx, y, 13);
  }
}

function drawStar(ctx, cx, cy, r) {
  ctx.beginPath();
  for (let i = 0; i < 10; i += 1) {
    const ang = -Math.PI / 2 + (i * Math.PI) / 5;
    const rad = i % 2 === 0 ? r : r * 0.45;
    const px = cx + Math.cos(ang) * rad;
    const py = cy + Math.sin(ang) * rad;
    if (i === 0) ctx.moveTo(px, py);
    else ctx.lineTo(px, py);
  }
  ctx.closePath();
  ctx.fill();
  ctx.stroke();
}

function bar(ctx, x, y, w, h, ratio, fill, bg) {
  ctx.fillStyle = bg;
  ctx.fillRect(x, y, w, h);
  ctx.fillStyle = fill;
  ctx.fillRect(x, y, w * Math.max(0, Math.min(1, ratio)), h);
  ctx.strokeStyle = 'rgba(0,0,0,0.6)';
  ctx.lineWidth = 2;
  ctx.strokeRect(x, y, w, h);
}

export function drawHud(ctx, view, state, ui) {
  const { width, height } = view;
  ctx.textBaseline = 'alphabetic';
  // Health bar + money, top-left.
  ctx.fillStyle = 'rgba(10,14,20,0.55)';
  roundRect(ctx, 12, 12, 250, 64, 10);
  ctx.fill();
  ctx.font = `bold 15px ${FONT}`;
  ctx.fillStyle = '#fff';
  ctx.textAlign = 'left';
  ctx.fillText('HEALTH', 24, 32);
  bar(ctx, 24, 38, 150, 14, state.player.health / 100, state.player.health > 30 ? '#4ad87c' : '#e84a4a', 'rgba(255,255,255,0.18)');
  ctx.font = `bold 20px ${FONT}`;
  ctx.fillStyle = '#7dff9a';
  ctx.fillText(`$${state.money.toLocaleString('en-US')}`, 186, 52);
  ctx.font = `13px ${FONT}`;
  ctx.fillStyle = 'rgba(255,255,255,0.75)';
  ctx.fillText(`Ammo ${state.player.ammo}`, 24, 68);

  // Wanted stars, top-right above the minimap.
  drawStars(ctx, width - MAP_SIZE - MAP_PAD - 8, 44, state.stars);

  // Minimap.
  drawMinimap(ctx, width - MAP_SIZE - MAP_PAD, 58, state, ui);

  // Mission objective banner, top-centre.
  const label = ui.objective;
  if (label) {
    ctx.font = `bold 17px ${FONT}`;
    const w = ctx.measureText(label).width + 36;
    ctx.fillStyle = 'rgba(10,14,20,0.6)';
    roundRect(ctx, (width - w) / 2, 12, w, 34, 8);
    ctx.fill();
    ctx.fillStyle = '#ffd23c';
    ctx.textAlign = 'center';
    ctx.fillText(label, width / 2, 35);
    if (ui.timer > 0) {
      ctx.font = `bold 16px ${FONT}`;
      ctx.fillStyle = ui.timer < 15 ? '#ff5a4a' : '#fff';
      ctx.fillText(`${Math.ceil(ui.timer)}s`, width / 2, 60);
    }
  }

  // Message banner (mission briefings, job done).
  if (ui.message) {
    ctx.font = `16px ${FONT}`;
    const lines = wrapText(ctx, ui.message, width - 200);
    const h = lines.length * 22 + 18;
    ctx.fillStyle = 'rgba(10,14,20,0.72)';
    roundRect(ctx, 40, height - h - 96, width - 80, h, 10);
    ctx.fill();
    ctx.fillStyle = '#fff';
    ctx.textAlign = 'center';
    lines.forEach((line, i) => ctx.fillText(line, width / 2, height - h - 96 + 26 + i * 22));
  }

  // Speed + car health, bottom-right, while driving.
  if (state.player.inCar) {
    const car = state.player.inCar;
    const kmh = Math.round(Math.abs(car.speed) * 0.32);
    ctx.font = `bold 30px ${FONT}`;
    ctx.textAlign = 'right';
    ctx.fillStyle = '#fff';
    ctx.fillText(`${kmh}`, width - 24, height - 44);
    ctx.font = `14px ${FONT}`;
    ctx.fillStyle = 'rgba(255,255,255,0.7)';
    ctx.fillText('km/h', width - 24, height - 24);
    bar(ctx, width - 174, height - 18, 150, 8, car.health / 100, car.health > 30 ? '#4ad87c' : '#e84a4a', 'rgba(255,255,255,0.18)');
  }

  // Controls hint, bottom-left, fading after a while.
  if (ui.hintAlpha > 0) {
    ctx.globalAlpha = ui.hintAlpha;
    ctx.font = `14px ${FONT}`;
    ctx.textAlign = 'left';
    ctx.fillStyle = '#fff';
    ctx.fillText('WASD move / drive  •  Mouse aim  •  Click shoot  •  E enter car  •  Space handbrake  •  P pause  •  M mute', 16, height - 16);
    ctx.globalAlpha = 1;
  }
}

function drawMinimap(ctx, x, y, state, ui) {
  const s = MAP_SIZE / WORLD.size;
  ctx.save();
  ctx.fillStyle = 'rgba(10,14,20,0.6)';
  roundRect(ctx, x - 6, y - 6, MAP_SIZE + 12, MAP_SIZE + 12, 12);
  ctx.fill();
  ctx.beginPath();
  roundRect(ctx, x, y, MAP_SIZE, MAP_SIZE, 8);
  ctx.clip();
  // Ocean + land.
  ctx.fillStyle = '#2f7fa8';
  ctx.fillRect(x, y, MAP_SIZE, MAP_SIZE);
  ctx.fillStyle = '#5a8a4a';
  ctx.fillRect(x, y, MAP_SIZE, MAP_SIZE * 0.94);
  // Roads.
  ctx.strokeStyle = 'rgba(40,40,44,0.9)';
  ctx.lineWidth = 3;
  const roads = [];
  for (let p = 200; p <= 3000; p += 400) roads.push(p);
  for (const p of roads) {
    ctx.beginPath(); ctx.moveTo(x + p * s, y); ctx.lineTo(x + p * s, y + MAP_SIZE); ctx.stroke();
    ctx.beginPath(); ctx.moveTo(x, y + p * s); ctx.lineTo(x + MAP_SIZE, y + p * s); ctx.stroke();
  }
  // Objective blip.
  if (ui.objectivePos) {
    ctx.fillStyle = '#ffd23c';
    ctx.beginPath();
    ctx.arc(x + ui.objectivePos.x * s, y + ui.objectivePos.y * s, 6, 0, Math.PI * 2);
    ctx.fill();
    ctx.strokeStyle = '#000';
    ctx.lineWidth = 1.5;
    ctx.stroke();
  }
  // Police blips.
  ctx.fillStyle = '#4a9ad8';
  for (const c of state.police.cars) {
    ctx.beginPath();
    ctx.arc(x + c.x * s, y + c.y * s, 3.5, 0, Math.PI * 2);
    ctx.fill();
  }
  // Mission car.
  if (state.missionCar && !state.missionCar.dead) {
    ctx.fillStyle = '#ff5a4a';
    ctx.beginPath();
    ctx.arc(x + state.missionCar.x * s, y + state.missionCar.y * s, 4, 0, Math.PI * 2);
    ctx.fill();
  }
  // Player arrow.
  const px = state.player.inCar ? state.player.inCar.x : state.player.x;
  const py = state.player.inCar ? state.player.inCar.y : state.player.y;
  const ang = state.player.inCar ? state.player.inCar.angle : state.player.angle;
  ctx.save();
  ctx.translate(x + px * s, y + py * s);
  ctx.rotate(ang);
  ctx.fillStyle = '#fff';
  ctx.beginPath();
  ctx.moveTo(8, 0);
  ctx.lineTo(-6, -5);
  ctx.lineTo(-6, 5);
  ctx.closePath();
  ctx.fill();
  ctx.strokeStyle = '#000';
  ctx.lineWidth = 1;
  ctx.stroke();
  ctx.restore();
  // North label.
  ctx.font = `bold 11px ${FONT}`;
  ctx.fillStyle = '#fff';
  ctx.textAlign = 'left';
  ctx.fillText('N', x + 4, y + 13);
  ctx.restore();
}

export function roundRect(ctx, x, y, w, h, r) {
  ctx.beginPath();
  ctx.moveTo(x + r, y);
  ctx.arcTo(x + w, y, x + w, y + h, r);
  ctx.arcTo(x + w, y + h, x, y + h, r);
  ctx.arcTo(x, y + h, x, y, r);
  ctx.arcTo(x, y, x + w, y, r);
  ctx.closePath();
}

export function wrapText(ctx, text, maxWidth) {
  const words = text.split(' ');
  const lines = [];
  let line = '';
  for (const word of words) {
    const test = line ? `${line} ${word}` : word;
    if (ctx.measureText(test).width > maxWidth && line) {
      lines.push(line);
      line = word;
    } else line = test;
  }
  if (line) lines.push(line);
  return lines;
}
