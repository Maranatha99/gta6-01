// Drawing only: the world's state and the current screen in, pixels out. The static city
// is painted once onto an offscreen canvas at boot; each frame draws the visible slice of
// it, then cars, people, bullets and particles, then the HUD. Camera follows the player
// (or their car) with a little shake on impacts.
import { CAR, COLORS, PLAYER, WORLD } from './config.js';
import { ROAD_LINES } from './city.js';
import { drawHud, FONT, roundRect } from './hud.js';

export const SCREEN_TITLE = 'title';
export const SCREEN_PLAY = 'play';
export const SCREEN_PAUSED = 'paused';
export const SCREEN_OVER = 'over';
export const SCREEN_HELP = 'help';

export function createRenderer(canvas, city) {
  const context = canvas.getContext('2d');
  const view = { width: 1280, height: 720, scale: 1, camX: 0, camY: 0 };
  const fonts = new Map();

  // ---- Static city layer, painted once -------------------------------------
  const layer = document.createElement('canvas');
  layer.width = WORLD.size;
  layer.height = WORLD.size;
  const lc = layer.getContext('2d');
  paintCityLayer(lc, city);

  function text(value, x, y, size, color, align, weight = '') {
    const key = `${weight}${size}`;
    if (!fonts.has(key)) fonts.set(key, `${weight} ${size}px ${FONT}`);
    context.font = fonts.get(key);
    context.fillStyle = color;
    context.textAlign = align;
    context.fillText(value, x, y);
  }

  function resize() {
    const ratio = window.devicePixelRatio || 1;
    view.width = window.innerWidth;
    view.height = window.innerHeight;
    view.ratio = ratio;
    canvas.width = Math.round(view.width * ratio);
    canvas.height = Math.round(view.height * ratio);
    context.setTransform(ratio, 0, 0, ratio, 0, 0);
    view.scale = Math.max(0.62, Math.min(view.width / 1150, view.height / 720));
  }

  function paintCityLayer(c, cityData) {
    // Grass base.
    c.fillStyle = COLORS.grass;
    c.fillRect(0, 0, WORLD.size, WORLD.size);
    // Mow stripes for texture.
    c.fillStyle = COLORS.grassDark;
    for (let y = 0; y < WORLD.size; y += 160) c.fillRect(0, y, WORLD.size, 80);
    // Ocean along the south edge.
    c.fillStyle = COLORS.oceanDeep;
    c.fillRect(0, WORLD.size - 90, WORLD.size, 90);
    c.fillStyle = COLORS.ocean;
    c.fillRect(0, WORLD.size - 78, WORLD.size, 66);
    c.fillStyle = 'rgba(255,255,255,0.25)';
    for (let x = 0; x < WORLD.size; x += 90) c.fillRect(x, WORLD.size - 70 + ((x / 90) % 2) * 14, 46, 3);
    // Beach sand strip.
    c.fillStyle = COLORS.sand;
    c.fillRect(0, WORLD.size - 150, WORLD.size, 60);
    // Parks and sand blocks.
    for (const park of cityData.parks) {
      c.fillStyle = park.kind === 'sand' ? COLORS.sand : '#6da34e';
      c.fillRect(park.x, park.y, park.w, park.h);
      if (park.kind === 'park') {
        c.fillStyle = 'rgba(255,255,255,0.12)';
        c.beginPath();
        c.arc(park.x + park.w / 2, park.y + park.h / 2, Math.min(park.w, park.h) / 4, 0, Math.PI * 2);
        c.fill();
      }
    }
    // Roads: sidewalk border, asphalt, centre dashes.
    const half = WORLD.roadWidth / 2;
    for (const p of ROAD_LINES) {
      c.fillStyle = COLORS.sidewalk;
      c.fillRect(0, p - half - 12, WORLD.size, WORLD.roadWidth + 24);
      c.fillRect(p - half - 12, 0, WORLD.roadWidth + 24, WORLD.size);
      c.fillStyle = COLORS.asphalt;
      c.fillRect(0, p - half, WORLD.size, WORLD.roadWidth);
      c.fillRect(p - half, 0, WORLD.roadWidth, WORLD.size);
    }
    // Centre dashes.
    c.fillStyle = COLORS.lineYellow;
    for (const p of ROAD_LINES) {
      for (let d = 0; d < WORLD.size; d += 64) {
        c.fillRect(d, p - 2, 34, 4);
        c.fillRect(p - 2, d, 4, 34);
      }
    }
    // Intersections: clear the dashes where roads cross.
    c.fillStyle = COLORS.asphalt;
    for (const px of ROAD_LINES) {
      for (const py of ROAD_LINES) c.fillRect(px - half, py - half, WORLD.roadWidth, WORLD.roadWidth);
    }
    // Crosswalk stripes at intersections.
    c.fillStyle = COLORS.lineWhite;
    for (const px of ROAD_LINES) {
      for (const py of ROAD_LINES) {
        for (let i = -3; i <= 3; i += 1) {
          c.fillRect(px - half + 6 + i * 14, py - half - 8, 7, 10);
          c.fillRect(px - half + 6 + i * 14, py + half - 2, 7, 10);
          c.fillRect(px - half - 8, py - half + 6 + i * 14, 10, 7);
          c.fillRect(px + half - 2, py - half + 6 + i * 14, 10, 7);
        }
      }
    }
    // Buildings: soft shadow, coloured body, darker roof inset, windows.
    for (const b of cityData.buildings) {
      c.fillStyle = 'rgba(0,0,0,0.25)';
      c.fillRect(b.x + 6, b.y + 8, b.w, b.h);
      c.fillStyle = b.color;
      c.fillRect(b.x, b.y, b.w, b.h);
      c.fillStyle = b.roof;
      c.fillRect(b.x + 6, b.y + 6, b.w - 12, b.h - 12);
      c.fillStyle = 'rgba(255,255,255,0.35)';
      const cols = Math.max(1, Math.floor(b.w / 34));
      const rows = Math.max(1, Math.floor(b.h / 34));
      for (let i = 0; i < cols; i += 1) {
        for (let j = 0; j < rows; j += 1) {
          if ((i + j) % 2 === 0) c.fillRect(b.x + 10 + i * 34, b.y + 10 + j * 34, 12, 9);
        }
      }
      // Door on the south face.
      c.fillStyle = '#4a3628';
      c.fillRect(b.x + b.w / 2 - 8, b.y + b.h - 12, 16, 12);
    }
    // Trees: trunk + canopy.
    for (const t of cityData.trees) {
      c.fillStyle = COLORS.trunk;
      c.fillRect(t.x - 2, t.y - 2, 4, 8);
      c.fillStyle = COLORS.palm;
      c.beginPath();
      c.arc(t.x, t.y - 4, t.palm ? 13 : 11, 0, Math.PI * 2);
      c.fill();
      c.fillStyle = 'rgba(255,255,255,0.18)';
      c.beginPath();
      c.arc(t.x - 4, t.y - 8, 5, 0, Math.PI * 2);
      c.fill();
    }
    // Lamps.
    for (const l of cityData.lamps) {
      c.fillStyle = '#3a3a3a';
      c.fillRect(l.x - 2, l.y - 2, 4, 4);
      c.fillStyle = 'rgba(255,240,180,0.7)';
      c.beginPath();
      c.arc(l.x, l.y, 4, 0, Math.PI * 2);
      c.fill();
    }
    // Named places get a label on the ground.
    c.font = `bold 15px ${FONT}`;
    c.textAlign = 'center';
    for (const place of cityData.places) {
      c.fillStyle = 'rgba(10,14,20,0.55)';
      const w = c.measureText(place.name).width + 16;
      roundRect(c, place.x - w / 2, place.y - 26, w, 22, 6);
      c.fill();
      c.fillStyle = place.color;
      c.fillText(place.name, place.x, place.y - 10);
    }
  }

  function drawCar(c) {
    context.save();
    context.translate(c.x, c.y);
    context.rotate(c.angle);
    context.fillStyle = 'rgba(0,0,0,0.3)';
    context.fillRect(-CAR.length / 2 + 4, -CAR.width / 2 + 5, CAR.length, CAR.width);
    context.fillStyle = c.color;
    roundRect(context, -CAR.length / 2, -CAR.width / 2, CAR.length, CAR.width, 8);
    context.fill();
    // Cabin + windows.
    context.fillStyle = 'rgba(20,30,40,0.85)';
    roundRect(context, -8, -CAR.width / 2 + 4, 20, CAR.width - 8, 5);
    context.fill();
    context.fillStyle = 'rgba(180,220,255,0.5)';
    context.fillRect(-6, -CAR.width / 2 + 6, 16, CAR.width - 12);
    // Headlights and taillights.
    context.fillStyle = '#fff8c8';
    context.fillRect(CAR.length / 2 - 3, -CAR.width / 2 + 3, 3, 6);
    context.fillRect(CAR.length / 2 - 3, CAR.width / 2 - 9, 3, 6);
    context.fillStyle = '#e84a4a';
    context.fillRect(-CAR.length / 2, -CAR.width / 2 + 3, 3, 6);
    context.fillRect(-CAR.length / 2, CAR.width / 2 - 9, 3, 6);
    if (c.police) {
      // Light bar + POLICE markings.
      context.fillStyle = '#e84a4a';
      context.fillRect(-4, -CAR.width / 2 + 2, 8, 7);
      context.fillStyle = '#4a7ad8';
      context.fillRect(-4, CAR.width / 2 - 9, 8, 7);
      context.fillStyle = '#222';
      context.font = `bold 9px ${FONT}`;
      context.textAlign = 'center';
      context.fillText('POLICE', 0, 3);
    }
    if (c.target) {
      context.fillStyle = '#ffd23c';
      context.font = `bold 9px ${FONT}`;
      context.textAlign = 'center';
      context.fillText('COMET GT', 0, 3);
    }
    context.restore();
  }

  function drawWreck(c) {
    context.save();
    context.translate(c.x, c.y);
    context.rotate(c.angle + 0.2);
    context.globalAlpha = 0.85;
    context.fillStyle = '#2a2a2a';
    roundRect(context, -CAR.length / 2, -CAR.width / 2, CAR.length, CAR.width, 8);
    context.fill();
    context.fillStyle = 'rgba(232,74,74,0.8)';
    context.fillRect(-CAR.length / 2, -CAR.width / 2 + 3, 3, 6);
    context.restore();
  }

  function drawPed(p) {
    if (p.state === 'dead') {
      context.save();
      context.translate(p.x, p.y);
      context.rotate(p.angle + Math.PI / 2);
      context.fillStyle = p.shirt;
      context.beginPath();
      context.ellipse(0, 0, 12, 6, 0, 0, Math.PI * 2);
      context.fill();
      context.fillStyle = p.color;
      context.beginPath();
      context.arc(13, 0, 6, 0, Math.PI * 2);
      context.fill();
      context.restore();
      return;
    }
    context.save();
    context.translate(p.x, p.y);
    context.rotate(p.angle);
    // Shadow.
    context.fillStyle = 'rgba(0,0,0,0.25)';
    context.beginPath();
    context.ellipse(1, 2, 11, 9, 0, 0, Math.PI * 2);
    context.fill();
    // Body: shoulders + head, facing the direction of travel.
    context.fillStyle = p.rival ? '#8a2a2a' : p.shirt;
    context.beginPath();
    context.arc(0, 0, 9, 0, Math.PI * 2);
    context.fill();
    context.fillStyle = p.color;
    context.beginPath();
    context.arc(7, 0, 6, 0, Math.PI * 2);
    context.fill();
    if (p.rival) {
      // A gun in hand.
      context.fillStyle = '#222';
      context.fillRect(10, -2, 9, 3);
    }
    context.restore();
  }

  function drawCop(cop) {
    context.save();
    context.translate(cop.x, cop.y);
    context.rotate(cop.angle);
    context.fillStyle = 'rgba(0,0,0,0.25)';
    context.beginPath();
    context.ellipse(1, 2, 11, 9, 0, 0, Math.PI * 2);
    context.fill();
    context.fillStyle = '#1a3a6a';
    context.beginPath();
    context.arc(0, 0, 9, 0, Math.PI * 2);
    context.fill();
    context.fillStyle = '#e8c8a8';
    context.beginPath();
    context.arc(7, 0, 6, 0, Math.PI * 2);
    context.fill();
    context.fillStyle = '#1a3a6a';
    context.fillRect(4, -7, 8, 14);
    context.fillStyle = '#222';
    context.fillRect(10, -2, 9, 3);
    context.restore();
  }

  function drawPlayer(state) {
    const p = state.player;
    if (p.inCar) return;
    context.save();
    context.translate(p.x, p.y);
    if (p.invulnerable > 0 && Math.floor(p.invulnerable * 12) % 2 === 0) context.globalAlpha = 0.45;
    context.rotate(p.angle);
    context.fillStyle = 'rgba(0,0,0,0.3)';
    context.beginPath();
    context.ellipse(1, 2, 12, 10, 0, 0, Math.PI * 2);
    context.fill();
    // Jax Mercer: teal jacket, dark jeans.
    context.fillStyle = '#1a8a7a';
    context.beginPath();
    context.arc(0, 0, 11, 0, Math.PI * 2);
    context.fill();
    context.fillStyle = '#e8b88a';
    context.beginPath();
    context.arc(8, 0, 7, 0, Math.PI * 2);
    context.fill();
    // Pistol.
    context.fillStyle = '#222';
    context.fillRect(12, -2, 11, 4);
    context.restore();
  }

  function drawObjectiveMarker(state, ui) {
    if (!ui.objectivePos) return;
    const t = state.elapsed;
    const pulse = 1 + Math.sin(t * 5) * 0.15;
    const { x, y } = ui.objectivePos;
    context.save();
    context.translate(x, y);
    context.strokeStyle = '#ffd23c';
    context.lineWidth = 4;
    context.beginPath();
    context.arc(0, 0, 26 * pulse, 0, Math.PI * 2);
    context.stroke();
    context.fillStyle = '#ffd23c';
    context.beginPath();
    context.moveTo(0, 34);
    context.lineTo(-9, 16);
    context.lineTo(9, 16);
    context.closePath();
    context.fill();
    context.restore();
    // Edge arrow: point at the objective when it is off-screen.
    const px = state.player.inCar ? state.player.inCar.x : state.player.x;
    const py = state.player.inCar ? state.player.inCar.y : state.player.y;
    const dx = x - px;
    const dy = y - py;
    const dist = Math.hypot(dx, dy);
    const vw = view.width / view.scale;
    const vh = view.height / view.scale;
    if (dist > Math.min(vw, vh) / 2 - 60) {
      const ang = Math.atan2(dy, dx);
      const ax = px + Math.cos(ang) * (Math.min(vw, vh) / 2 - 70);
      const ay = py + Math.sin(ang) * (Math.min(vw, vh) / 2 - 70);
      context.save();
      context.translate(ax, ay);
      context.rotate(ang);
      context.fillStyle = '#ffd23c';
      context.beginPath();
      context.moveTo(18, 0);
      context.lineTo(-8, -11);
      context.lineTo(-8, 11);
      context.closePath();
      context.fill();
      context.restore();
    }
  }

  function drawWorld(state, ui) {
    const p = state.player;
    const focusX = p.inCar ? p.inCar.x : p.x;
    const focusY = p.inCar ? p.inCar.y : p.y;
    const shake = state.cameraShake;
    const sx = shake > 0 ? (Math.random() - 0.5) * shake : 0;
    const sy = shake > 0 ? (Math.random() - 0.5) * shake : 0;
    view.camX = focusX - view.width / view.scale / 2 + sx;
    view.camY = focusY - view.height / view.scale / 2 + sy;
    const vw = view.width / view.scale;
    const vh = view.height / view.scale;
    const cx = Math.max(0, Math.min(WORLD.size - vw, view.camX));
    const cy = Math.max(0, Math.min(WORLD.size - vh, view.camY));

    const ratio = view.ratio || 1;
    const s = view.scale * ratio;
    context.setTransform(s, 0, 0, s, -cx * s, -cy * s);
    context.drawImage(layer, cx, cy, vw, vh, cx, cy, vw, vh);

    // Pickups.
    for (const pk of state.city.pickups) {
      if (pk.taken) continue;
      const bob = Math.sin(state.elapsed * 3 + pk.x) * 2;
      context.save();
      context.translate(pk.x, pk.y + bob);
      context.fillStyle = pk.kind === 'health' ? '#e84a4a' : '#e8c33c';
      context.beginPath();
      context.arc(0, 0, 13, 0, Math.PI * 2);
      context.fill();
      context.strokeStyle = '#fff';
      context.lineWidth = 2;
      context.stroke();
      context.fillStyle = '#fff';
      context.font = `bold 14px ${FONT}`;
      context.textAlign = 'center';
      context.fillText(pk.kind === 'health' ? '+' : 'A', 0, 5);
      context.restore();
    }

    for (const c of state.cars) {
      if (c.dead) drawWreck(c);
      else drawCar(c);
    }
    for (const c of state.police.cars) {
      if (c.dead) drawWreck(c);
      else drawCar(c);
    }
    for (const cop of state.police.cops) drawCop(cop);
    for (const ped of state.peds) drawPed(ped);
    for (const rival of state.rivals) drawPed(rival);
    drawPlayer(state);

    // Bullets.
    context.fillStyle = '#ffd76a';
    for (const b of state.combat.bullets) {
      if (!b.active) continue;
      context.beginPath();
      context.arc(b.x, b.y, 3, 0, Math.PI * 2);
      context.fill();
    }
    // Particles.
    for (const pt of state.combat.particles) {
      if (!pt.active) continue;
      context.globalAlpha = Math.max(0, pt.life / pt.max);
      context.fillStyle = pt.color;
      context.beginPath();
      context.arc(pt.x, pt.y, pt.size, 0, Math.PI * 2);
      context.fill();
    }
    context.globalAlpha = 1;

    drawObjectiveMarker(state, ui);
    context.setTransform(1, 0, 0, 1, 0, 0);
    // Screen-space: apply devicePixelRatio transform already set in resize; redraw HUD in CSS pixels.
    context.setTransform(ratio, 0, 0, ratio, 0, 0);
    drawHud(context, view, state, ui);
  }

  function drawPanel(title, lines, prompt, accent) {
    const w = Math.min(640, view.width - 60);
    const h = 150 + lines.length * 30 + 70;
    const x = (view.width - w) / 2;
    const y = (view.height - h) / 2;
    context.fillStyle = 'rgba(8,12,18,0.82)';
    roundRect(context, x, y, w, h, 14);
    context.fill();
    context.strokeStyle = accent || '#ffd23c';
    context.lineWidth = 2;
    context.stroke();
    text(title, view.width / 2, y + 62, 44, '#fff', 'center', 'bold');
    lines.forEach((line, i) => text(line, view.width / 2, y + 118 + i * 30, 19, 'rgba(255,255,255,0.85)', 'center'));
    text(prompt, view.width / 2, y + h - 34, 20, '#ffd23c', 'center', 'bold');
  }

  function drawTitle(state, ui) {
    // Slow pan over the city as the backdrop.
    const t = state.elapsed * 24;
    const focusX = 1600 + Math.cos(t * 0.00012) * 500;
    const focusY = 1600 + Math.sin(t * 0.00009) * 500;
    const vw = view.width / view.scale;
    const vh = view.height / view.scale;
    const cx = Math.max(0, Math.min(WORLD.size - vw, focusX - vw / 2));
    const cy = Math.max(0, Math.min(WORLD.size - vh, focusY - vh / 2));
    const ratio = view.ratio || 1;
    const s = view.scale * ratio;
    context.setTransform(s, 0, 0, s, -cx * s, -cy * s);
    context.drawImage(layer, cx, cy, vw, vh, cx, cy, vw, vh);
    context.setTransform(window.devicePixelRatio || 1, 0, 0, window.devicePixelRatio || 1, 0, 0);
    context.fillStyle = 'rgba(8,12,18,0.55)';
    context.fillRect(0, 0, view.width, view.height);

    const cxw = view.width / 2;
    text('SOLMAR BAY', cxw, view.height * 0.3, 84, '#ffd23c', 'center', 'bold');
    text('An open-world crime story  •  a city of sun, sand and bad decisions', cxw, view.height * 0.3 + 44, 20, '#fff', 'center');
    const items = ui.menuItems;
    items.forEach((item, i) => {
      const y = view.height * 0.46 + i * 46;
      const selected = i === ui.menuIndex;
      if (selected) {
        context.fillStyle = 'rgba(255,210,60,0.18)';
        roundRect(context, cxw - 190, y - 30, 380, 40, 8);
        context.fill();
      }
      text(item.label, cxw, y, 24, selected ? '#ffd23c' : '#fff', 'center', selected ? 'bold' : '');
    });
    text('WASD move & drive  •  Mouse aim  •  Click shoot  •  E enter car  •  P pause  •  M mute', cxw, view.height - 52, 16, 'rgba(255,255,255,0.75)', 'center');
    text('A wholly original game. No real city, person or brand appears in it.', cxw, view.height - 26, 14, 'rgba(255,255,255,0.5)', 'center');
  }

  function drawHelp() {
    const lines = [
      'On foot: WASD to move, Shift to sprint, mouse to aim, click to shoot.',
      'In a car: W accelerate, S brake / reverse, A D steer, Space handbrake.',
      'E gets in and out of a car. Stealing a car in front of the cops raises heat.',
      'Stars show your wanted level. Break line of sight and lay low to cool off.',
      'Follow the yellow marker: missions pay cash. Your save is kept in this browser.',
      'Green + pickups heal you, yellow A pickups refill ammo.',
    ];
    drawPanel('How to play', lines, 'Press Enter or click to go back', '#4ad8a8');
  }

  /** Paint one frame for the screen the game is on. `ui` carries HUD/menu state. */
  function draw(state, screen, ui) {
    context.setTransform(1, 0, 0, 1, 0, 0);
    context.fillStyle = '#11141b';
    context.fillRect(0, 0, canvas.width, canvas.height);
    if (screen === SCREEN_TITLE) {
      drawTitle(state, ui);
      return;
    }
    drawWorld(state, ui);
    if (screen === SCREEN_HELP) drawHelp();
    else if (screen === SCREEN_PAUSED) {
      drawPanel('Paused', ['Your save is kept in this browser.', `Cash $${state.money.toLocaleString('en-US')}  •  Jobs done ${state.missions.done.length} / 6`], 'P or click to resume  •  S to save now');
    } else if (screen === SCREEN_OVER) {
      const busted = ui.overKind === 'busted';
      drawPanel(busted ? 'BUSTED' : 'FLATLINED',
        [busted ? 'The Solmar Bay PD caught up with you.' : 'Jax is down — but the city never sleeps.',
          `Cash $${state.money.toLocaleString('en-US')}  •  Jobs done ${state.missions.done.length} / 6  •  Cars stolen ${state.carsStolen}`],
        'Press Enter to try again', '#e84a4a');
    }
  }

  resize();
  window.addEventListener('resize', resize);
  return { draw, view };
}
