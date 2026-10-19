import { useEffect, useRef, useState } from "react";

type GameMode = "start" | "playing" | "paused" | "gameover";
type EnemyType = "ghoul" | "runner" | "brute";
type ParticleKind = "blood" | "spark" | "wood" | "chunk" | "smoke";

interface Player {
  x: number;
  y: number;
  vx: number;
  vy: number;
  angle: number;
  hp: number;
  maxHp: number;
  reload: number;
  invulnerable: number;
  flash: number;
  recoil: number;
  frenzy: number;
  step: number;
}

interface Enemy {
  id: number;
  x: number;
  y: number;
  vx: number;
  vy: number;
  radius: number;
  hp: number;
  maxHp: number;
  speed: number;
  type: EnemyType;
  hit: number;
  age: number;
  dead: boolean;
}

interface Bullet {
  x: number;
  y: number;
  px: number;
  py: number;
  vx: number;
  vy: number;
  life: number;
  angle: number;
}

interface Particle {
  x: number;
  y: number;
  vx: number;
  vy: number;
  life: number;
  maxLife: number;
  size: number;
  color: string;
  kind: ParticleKind;
  drag: number;
  spin: number;
  rotation: number;
}

interface Decal {
  x: number;
  y: number;
  size: number;
  rotation: number;
  color: string;
  life: number;
}

interface Building {
  id: number;
  x: number;
  y: number;
  w: number;
  h: number;
  hp: number;
  maxHp: number;
  kind: "house" | "chapel" | "barn";
  roof: string;
  hit: number;
  destroyed: boolean;
}

interface Pickup {
  x: number;
  y: number;
  type: "frenzy" | "heart";
  life: number;
  bob: number;
}

interface ScorePopup {
  x: number;
  y: number;
  text: string;
  color: string;
  life: number;
}

interface TouchStick {
  id: number;
  ox: number;
  oy: number;
  x: number;
  y: number;
}

interface InputState {
  keys: Set<string>;
  pointerX: number;
  pointerY: number;
  pointerActive: boolean;
  mouseDown: boolean;
  leftTouch: TouchStick | null;
  rightTouch: TouchStick | null;
}

interface GameData {
  width: number;
  height: number;
  player: Player;
  enemies: Enemy[];
  bullets: Bullet[];
  particles: Particle[];
  decals: Decal[];
  buildings: Building[];
  pickups: Pickup[];
  popups: ScorePopup[];
  input: InputState;
  time: number;
  score: number;
  kills: number;
  combo: number;
  comboTimer: number;
  multiplier: number;
  spawnTimer: number;
  shake: number;
  enemyId: number;
  cleared: boolean;
  saved: boolean;
  banner: string;
  bannerLife: number;
}

interface HighScore {
  name: string;
  score: number;
  kills: number;
  date: string;
}

interface HudState {
  score: number;
  hp: number;
  maxHp: number;
  combo: number;
  multiplier: number;
  destroyed: number;
  totalBuildings: number;
  frenzy: number;
}

const SCORE_KEY = "ashfall-local-scores-v1";
const NAME_KEY = "ashfall-hunter-name-v1";
const BLOOD = ["#5b0a0a", "#851414", "#b01c1c", "#d13a2f"];
const EMPTY_HUD: HudState = {
  score: 0,
  hp: 4,
  maxHp: 4,
  combo: 0,
  multiplier: 1,
  destroyed: 0,
  totalBuildings: 6,
  frenzy: 0,
};

function clamp(value: number, min: number, max: number) {
  return Math.max(min, Math.min(max, value));
}

function distance(ax: number, ay: number, bx: number, by: number) {
  return Math.hypot(ax - bx, ay - by);
}

function pseudoNoise(x: number, y: number) {
  const n = Math.sin(x * 12.9898 + y * 78.233) * 43758.5453;
  return n - Math.floor(n);
}

function makeBuildings(width: number, height: number): Building[] {
  const scale = clamp(Math.min(width / 900, height / 540), 0.72, 1.1);
  const houseW = 92 * scale;
  const houseH = 70 * scale;
  const upper = Math.max(56, height * 0.1);
  const middle = Math.min(height * 0.39, upper + 150 * scale);

  const plans: Array<Omit<Building, "id" | "hp" | "maxHp" | "hit" | "destroyed"> & { hp: number }> = [
    { x: width * 0.5 - 55 * scale, y: upper - 18 * scale, w: 110 * scale, h: 102 * scale, kind: "chapel", roof: "#462125", hp: 26 },
    { x: width * 0.12 - houseW * 0.5, y: upper + 34 * scale, w: houseW, h: houseH, kind: "house", roof: "#583127", hp: 13 },
    { x: width * 0.84 - houseW * 0.5, y: upper + 42 * scale, w: houseW, h: houseH, kind: "house", roof: "#3f3130", hp: 13 },
    { x: width * 0.28 - houseW * 0.5, y: middle, w: houseW * 1.08, h: houseH * 0.92, kind: "barn", roof: "#542722", hp: 16 },
    { x: width * 0.71 - houseW * 0.5, y: middle + 8 * scale, w: houseW, h: houseH, kind: "house", roof: "#44302b", hp: 13 },
    { x: width * 0.49 - houseW * 0.5, y: middle + 35 * scale, w: houseW, h: houseH * 0.9, kind: "house", roof: "#562b28", hp: 13 },
  ];

  return plans.map((plan, id) => ({ ...plan, id, maxHp: plan.hp, hit: 0, destroyed: false }));
}

function createGame(width: number, height: number): GameData {
  const player: Player = {
    x: width * 0.5,
    y: height * 0.82,
    vx: 0,
    vy: 0,
    angle: -Math.PI / 2,
    hp: 4,
    maxHp: 4,
    reload: 0,
    invulnerable: 0,
    flash: 0,
    recoil: 0,
    frenzy: 0,
    step: 0,
  };

  return {
    width,
    height,
    player,
    enemies: [],
    bullets: [],
    particles: [],
    decals: [],
    buildings: makeBuildings(width, height),
    pickups: [],
    popups: [],
    input: {
      keys: new Set(),
      pointerX: width * 0.5,
      pointerY: height * 0.3,
      pointerActive: false,
      mouseDown: false,
      leftTouch: null,
      rightTouch: null,
    },
    time: 0,
    score: 0,
    kills: 0,
    combo: 0,
    comboTimer: 0,
    multiplier: 1,
    spawnTimer: 0.5,
    shake: 0,
    enemyId: 0,
    cleared: false,
    saved: false,
    banner: "THE BELL TOLLS",
    bannerLife: 2.2,
  };
}

function circleHitsBuilding(x: number, y: number, radius: number, building: Building) {
  const nearestX = clamp(x, building.x, building.x + building.w);
  const nearestY = clamp(y, building.y, building.y + building.h);
  return distance(x, y, nearestX, nearestY) < radius;
}

function spawnEnemy(game: GameData, forcedType?: EnemyType, close = false) {
  const time = game.time;
  let type: EnemyType = forcedType ?? "ghoul";
  const roll = Math.random();
  if (!forcedType && time > 14 && roll < 0.2) type = "runner";
  if (!forcedType && time > 24 && roll > 0.8) type = "brute";

  const sourceBuildings = game.buildings.filter((building) => !building.destroyed);
  let x: number;
  let y: number;

  if (close) {
    const angle = -Math.PI / 2 + (Math.random() - 0.5) * 1.3;
    const range = Math.min(170, game.height * 0.28);
    x = game.player.x + Math.cos(angle) * range;
    y = game.player.y + Math.sin(angle) * range;
  } else if (sourceBuildings.length && Math.random() < 0.72) {
    const building = sourceBuildings[Math.floor(Math.random() * sourceBuildings.length)];
    x = building.x + building.w * 0.5 + (Math.random() - 0.5) * building.w * 0.45;
    y = building.y + building.h + 8;
  } else {
    const side = Math.floor(Math.random() * 3);
    if (side === 0) {
      x = -16;
      y = game.height * (0.2 + Math.random() * 0.55);
    } else if (side === 1) {
      x = game.width + 16;
      y = game.height * (0.2 + Math.random() * 0.55);
    } else {
      x = Math.random() * game.width;
      y = -16;
    }
  }

  const config = {
    ghoul: { hp: 2, speed: 57 + Math.min(25, time * 0.35), radius: 12 },
    runner: { hp: 1, speed: 103 + Math.min(25, time * 0.25), radius: 10 },
    brute: { hp: 6, speed: 38 + Math.min(16, time * 0.2), radius: 18 },
  }[type];

  game.enemies.push({
    id: game.enemyId++,
    x,
    y,
    vx: 0,
    vy: 0,
    radius: config.radius,
    hp: config.hp,
    maxHp: config.hp,
    speed: config.speed,
    type,
    hit: 0,
    age: Math.random() * 4,
    dead: false,
  });
}

function addBurst(
  game: GameData,
  x: number,
  y: number,
  count: number,
  kind: ParticleKind,
  colors: string[],
  speed = 120,
) {
  for (let i = 0; i < count; i += 1) {
    const angle = Math.random() * Math.PI * 2;
    const force = speed * (0.28 + Math.random() * 0.72);
    const life = 0.25 + Math.random() * 0.55;
    game.particles.push({
      x,
      y,
      vx: Math.cos(angle) * force,
      vy: Math.sin(angle) * force,
      life,
      maxLife: life,
      size: kind === "chunk" ? 4 + Math.random() * 6 : 2 + Math.random() * 4,
      color: colors[Math.floor(Math.random() * colors.length)],
      kind,
      drag: kind === "spark" ? 2.2 : 4.4,
      spin: (Math.random() - 0.5) * 12,
      rotation: Math.random() * Math.PI,
    });
  }
}

function addBloodDecal(game: GameData, x: number, y: number, size: number) {
  game.decals.push({
    x: x + (Math.random() - 0.5) * 6,
    y: y + (Math.random() - 0.5) * 6,
    size,
    rotation: Math.random() * Math.PI,
    color: BLOOD[Math.floor(Math.random() * 3)],
    life: 1,
  });
  if (game.decals.length > 70) game.decals.shift();
}

function nearestEnemy(game: GameData) {
  let target: Enemy | null = null;
  let nearest = Infinity;
  for (const enemy of game.enemies) {
    const d = distance(game.player.x, game.player.y, enemy.x, enemy.y);
    if (!enemy.dead && d < nearest) {
      nearest = d;
      target = enemy;
    }
  }
  return target;
}

function fireBullet(game: GameData) {
  const player = game.player;
  const spread = player.frenzy > 0 ? (Math.random() - 0.5) * 0.07 : (Math.random() - 0.5) * 0.025;
  const angle = player.angle + spread;
  const muzzle = 24;
  const speed = 720;
  game.bullets.push({
    x: player.x + Math.cos(angle) * muzzle,
    y: player.y + Math.sin(angle) * muzzle,
    px: player.x + Math.cos(angle) * muzzle,
    py: player.y + Math.sin(angle) * muzzle,
    vx: Math.cos(angle) * speed,
    vy: Math.sin(angle) * speed,
    life: 0.82,
    angle,
  });
  player.reload = player.frenzy > 0 ? 0.072 : 0.135;
  player.flash = 0.065;
  player.recoil = 1;
  game.shake = Math.max(game.shake, 2.4);
  addBurst(game, player.x + Math.cos(angle) * 26, player.y + Math.sin(angle) * 26, 3, "spark", ["#fff4ba", "#efb24b"], 60);
}

function award(game: GameData, base: number, x: number, y: number, label?: string) {
  game.multiplier = Math.min(8, 1 + Math.floor(game.combo / 4));
  const points = base * game.multiplier;
  game.score += points;
  game.popups.push({
    x,
    y,
    text: label ?? `+${points}`,
    color: game.multiplier >= 4 ? "#f2bd54" : "#eee2bf",
    life: 0.9,
  });
}

function killEnemy(game: GameData, enemy: Enemy) {
  enemy.dead = true;
  game.kills += 1;
  game.combo += 1;
  game.comboTimer = 2.35;
  const base = enemy.type === "brute" ? 300 : enemy.type === "runner" ? 160 : 100;
  award(game, base, enemy.x, enemy.y - 15);
  addBloodDecal(game, enemy.x, enemy.y, enemy.type === "brute" ? 28 : 19);
  addBurst(game, enemy.x, enemy.y, enemy.type === "brute" ? 18 : 11, "blood", BLOOD, enemy.type === "brute" ? 190 : 145);
  addBurst(game, enemy.x, enemy.y, enemy.type === "brute" ? 5 : 3, "chunk", ["#491010", "#751715", "#9b4234"], 115);
  game.shake = Math.max(game.shake, enemy.type === "brute" ? 11 : 5.5);

  if (game.kills % 12 === 0 || Math.random() < 0.025) {
    game.pickups.push({
      x: enemy.x,
      y: enemy.y,
      type: game.player.hp < game.player.maxHp && Math.random() < 0.45 ? "heart" : "frenzy",
      life: 9,
      bob: Math.random() * Math.PI * 2,
    });
  }
}

function resolvePlayerBuildings(game: GameData) {
  const player = game.player;
  const radius = 13;
  for (const building of game.buildings) {
    if (building.destroyed || !circleHitsBuilding(player.x, player.y, radius, building)) continue;
    const left = Math.abs(player.x - building.x);
    const right = Math.abs(player.x - (building.x + building.w));
    const top = Math.abs(player.y - building.y);
    const bottom = Math.abs(player.y - (building.y + building.h));
    const edge = Math.min(left, right, top, bottom);
    if (edge === left) player.x = building.x - radius;
    else if (edge === right) player.x = building.x + building.w + radius;
    else if (edge === top) player.y = building.y - radius;
    else player.y = building.y + building.h + radius;
  }
}

function updateParticles(game: GameData, dt: number) {
  for (const particle of game.particles) {
    particle.life -= dt;
    const damping = Math.exp(-particle.drag * dt);
    particle.vx *= damping;
    particle.vy *= damping;
    particle.x += particle.vx * dt;
    particle.y += particle.vy * dt;
    particle.rotation += particle.spin * dt;
  }
  game.particles = game.particles.filter((particle) => particle.life > 0);

  for (const popup of game.popups) {
    popup.life -= dt;
    popup.y -= 28 * dt;
  }
  game.popups = game.popups.filter((popup) => popup.life > 0);
}

type SoundName = "shot" | "hit" | "kill" | "hurt" | "break" | "pickup";

function updateGame(
  game: GameData,
  dt: number,
  playSound: (name: SoundName) => void,
  finish: () => void,
) {
  game.time += dt;
  const player = game.player;
  const input = game.input;

  player.reload = Math.max(0, player.reload - dt);
  player.invulnerable = Math.max(0, player.invulnerable - dt);
  player.flash = Math.max(0, player.flash - dt);
  player.recoil = Math.max(0, player.recoil - dt * 12);
  player.frenzy = Math.max(0, player.frenzy - dt);
  game.shake = Math.max(0, game.shake - dt * 22);
  game.bannerLife = Math.max(0, game.bannerLife - dt);

  if (game.combo > 0) {
    game.comboTimer -= dt;
    if (game.comboTimer <= 0) {
      game.combo = 0;
      game.multiplier = 1;
    }
  }

  let moveX = 0;
  let moveY = 0;
  if (input.keys.has("KeyA") || input.keys.has("ArrowLeft")) moveX -= 1;
  if (input.keys.has("KeyD") || input.keys.has("ArrowRight")) moveX += 1;
  if (input.keys.has("KeyW") || input.keys.has("ArrowUp")) moveY -= 1;
  if (input.keys.has("KeyS") || input.keys.has("ArrowDown")) moveY += 1;

  if (input.leftTouch) {
    const dx = input.leftTouch.x - input.leftTouch.ox;
    const dy = input.leftTouch.y - input.leftTouch.oy;
    const length = Math.hypot(dx, dy);
    if (length > 5) {
      moveX += dx / Math.max(46, length);
      moveY += dy / Math.max(46, length);
    }
  }

  const moveLength = Math.hypot(moveX, moveY);
  if (moveLength > 1) {
    moveX /= moveLength;
    moveY /= moveLength;
  }
  const speed = 205;
  const targetVx = moveX * speed;
  const targetVy = moveY * speed;
  const acceleration = 1 - Math.exp(-18 * dt);
  player.vx += (targetVx - player.vx) * acceleration;
  player.vy += (targetVy - player.vy) * acceleration;
  player.x += player.vx * dt;
  player.y += player.vy * dt;
  player.step += Math.hypot(player.vx, player.vy) * dt * 0.055;
  player.x = clamp(player.x, 18, game.width - 18);
  player.y = clamp(player.y, 32, game.height - 18);
  resolvePlayerBuildings(game);

  const firing = input.mouseDown || input.keys.has("Space") || Boolean(input.rightTouch);
  if (input.rightTouch) {
    let dx = input.rightTouch.x - input.rightTouch.ox;
    let dy = input.rightTouch.y - input.rightTouch.oy;
    if (Math.hypot(dx, dy) < 8) {
      dx = input.rightTouch.x - player.x;
      dy = input.rightTouch.y - player.y;
    }
    if (Math.hypot(dx, dy) > 3) player.angle = Math.atan2(dy, dx);
  } else if (input.pointerActive) {
    player.angle = Math.atan2(input.pointerY - player.y, input.pointerX - player.x);
  } else if (firing) {
    const target = nearestEnemy(game);
    if (target) player.angle = Math.atan2(target.y - player.y, target.x - player.x);
  }

  if (firing && player.reload <= 0) {
    fireBullet(game);
    playSound("shot");
  }

  game.spawnTimer -= dt;
  if (game.spawnTimer <= 0) {
    const count = game.time > 38 && Math.random() < 0.34 ? 2 : 1;
    for (let i = 0; i < count; i += 1) spawnEnemy(game);
    game.spawnTimer = Math.max(0.34, 1.05 - game.time * 0.008) * (0.82 + Math.random() * 0.34);
  }

  for (const bullet of game.bullets) {
    bullet.px = bullet.x;
    bullet.py = bullet.y;
    bullet.x += bullet.vx * dt;
    bullet.y += bullet.vy * dt;
    bullet.life -= dt;
    if (bullet.x < -20 || bullet.x > game.width + 20 || bullet.y < -20 || bullet.y > game.height + 20) bullet.life = 0;

    if (bullet.life <= 0) continue;
    for (const enemy of game.enemies) {
      if (enemy.dead || distance(bullet.x, bullet.y, enemy.x, enemy.y) > enemy.radius + 5) continue;
      enemy.hp -= 1;
      enemy.hit = 0.105;
      bullet.life = 0;
      addBurst(game, bullet.x, bullet.y, 5, "blood", BLOOD, 110);
      addBloodDecal(game, bullet.x, bullet.y, 6 + Math.random() * 5);
      game.shake = Math.max(game.shake, 3.3);
      playSound(enemy.hp <= 0 ? "kill" : "hit");
      if (enemy.hp <= 0) killEnemy(game, enemy);
      break;
    }

    if (bullet.life <= 0) continue;
    for (const building of game.buildings) {
      if (building.destroyed || !circleHitsBuilding(bullet.x, bullet.y, 3, building)) continue;
      building.hp -= 1;
      building.hit = 0.12;
      bullet.life = 0;
      addBurst(game, bullet.x, bullet.y, 6, "wood", ["#d4a45f", "#7a4c30", "#3d2922"], 95);
      if (building.hp <= 0) {
        building.destroyed = true;
        game.combo += 2;
        game.comboTimer = 2.8;
        award(game, building.kind === "chapel" ? 1200 : 650, building.x + building.w * 0.5, building.y, "STRUCTURE DOWN");
        addBurst(game, building.x + building.w * 0.5, building.y + building.h * 0.5, 34, "wood", ["#e6b96b", "#8b5134", "#35221e", "#b63b26"], 235);
        for (let i = 0; i < 7; i += 1) {
          game.particles.push({
            x: building.x + Math.random() * building.w,
            y: building.y + Math.random() * building.h,
            vx: (Math.random() - 0.5) * 60,
            vy: -15 - Math.random() * 50,
            life: 0.8 + Math.random() * 1.4,
            maxLife: 2.2,
            size: 8 + Math.random() * 12,
            color: "#302721",
            kind: "smoke",
            drag: 1.1,
            spin: 0,
            rotation: 0,
          });
        }
        game.shake = 16;
        playSound("break");
        spawnEnemy(game, "ghoul");
        spawnEnemy(game, Math.random() > 0.5 ? "runner" : "ghoul");
      } else {
        playSound("hit");
      }
      break;
    }
  }
  game.bullets = game.bullets.filter((bullet) => bullet.life > 0);

  for (let i = 0; i < game.enemies.length; i += 1) {
    const enemy = game.enemies[i];
    if (enemy.dead) continue;
    enemy.age += dt;
    enemy.hit = Math.max(0, enemy.hit - dt);
    const angle = Math.atan2(player.y - enemy.y, player.x - enemy.x);
    let separationX = 0;
    let separationY = 0;
    for (let j = 0; j < game.enemies.length; j += 1) {
      if (i === j || game.enemies[j].dead) continue;
      const other = game.enemies[j];
      const d = distance(enemy.x, enemy.y, other.x, other.y);
      if (d > 0 && d < enemy.radius + other.radius + 6) {
        separationX += (enemy.x - other.x) / d;
        separationY += (enemy.y - other.y) / d;
      }
    }
    enemy.vx = Math.cos(angle) * enemy.speed + separationX * 25;
    enemy.vy = Math.sin(angle) * enemy.speed + separationY * 25;
    enemy.x += enemy.vx * dt;
    enemy.y += enemy.vy * dt;

    if (distance(enemy.x, enemy.y, player.x, player.y) < enemy.radius + 12 && player.invulnerable <= 0) {
      player.hp -= 1;
      player.invulnerable = 1.25;
      game.combo = 0;
      game.multiplier = 1;
      game.shake = 18;
      addBurst(game, player.x, player.y, 13, "blood", BLOOD, 165);
      addBloodDecal(game, player.x, player.y, 13);
      const knockback = Math.atan2(player.y - enemy.y, player.x - enemy.x);
      player.x += Math.cos(knockback) * 24;
      player.y += Math.sin(knockback) * 24;
      playSound("hurt");
      if (player.hp <= 0) finish();
    }
  }
  game.enemies = game.enemies.filter((enemy) => !enemy.dead);

  for (const pickup of game.pickups) {
    pickup.life -= dt;
    pickup.bob += dt * 4;
    if (distance(pickup.x, pickup.y, player.x, player.y) < 25) {
      if (pickup.type === "heart") player.hp = Math.min(player.maxHp, player.hp + 1);
      else player.frenzy = 7;
      pickup.life = 0;
      award(game, 80, pickup.x, pickup.y - 12, pickup.type === "heart" ? "PATCHED UP" : "HELLFIRE");
      addBurst(game, pickup.x, pickup.y, 12, "spark", ["#f6de9b", "#d64032"], 120);
      playSound("pickup");
    }
  }
  game.pickups = game.pickups.filter((pickup) => pickup.life > 0);

  for (const building of game.buildings) building.hit = Math.max(0, building.hit - dt);

  const allDestroyed = game.buildings.every((building) => building.destroyed);
  if (allDestroyed && !game.cleared) {
    game.cleared = true;
    game.banner = "VILLAGE PURGED  +5000";
    game.bannerLife = 3;
    game.score += 5000;
    player.frenzy = Math.max(player.frenzy, 7);
  }

  updateParticles(game, dt);
}

function drawPixelText(
  context: CanvasRenderingContext2D,
  text: string,
  x: number,
  y: number,
  size: number,
  color: string,
  align: CanvasTextAlign = "center",
) {
  context.save();
  context.font = `900 ${size}px "Courier New", monospace`;
  context.textAlign = align;
  context.textBaseline = "middle";
  context.fillStyle = "#120b0a";
  context.fillText(text, x + 2, y + 3);
  context.fillStyle = color;
  context.fillText(text, x, y);
  context.restore();
}

function drawGround(context: CanvasRenderingContext2D, game: GameData) {
  const { width, height, time } = game;
  context.fillStyle = "#141914";
  context.fillRect(0, 0, width, height);

  const tile = 32;
  for (let y = 0; y < height + tile; y += tile) {
    for (let x = 0; x < width + tile; x += tile) {
      const noise = pseudoNoise(x / tile, y / tile);
      context.fillStyle = noise > 0.72 ? "#1b2119" : noise < 0.18 ? "#10150f" : "#161c15";
      context.fillRect(x, y, tile, tile);
      if (noise > 0.55) {
        context.fillStyle = "#2c3222";
        context.fillRect(x + 6 + Math.floor(noise * 12), y + 8, 2, 5);
        context.fillRect(x + 10 + Math.floor(noise * 8), y + 11, 2, 3);
      }
    }
  }

  context.fillStyle = "#343128";
  context.beginPath();
  context.moveTo(width * 0.45, 0);
  context.lineTo(width * 0.57, 0);
  context.lineTo(width * 0.63, height);
  context.lineTo(width * 0.31, height);
  context.closePath();
  context.fill();

  context.fillStyle = "#2a2922";
  for (let y = 0; y < height; y += 26) {
    const spread = 0.12 + (y / height) * 0.18;
    const left = width * (0.51 - spread);
    const pathWidth = width * spread * 2;
    for (let x = left; x < left + pathWidth; x += 24) {
      const jitter = pseudoNoise(x, y) * 6;
      context.fillRect(x + jitter, y + 4, 16, 4);
    }
  }

  context.globalAlpha = 0.13;
  context.fillStyle = "#afc4a8";
  for (let i = 0; i < 8; i += 1) {
    const x = ((i * 173 + time * (4 + i)) % (width + 220)) - 110;
    const y = height * (0.15 + (i % 5) * 0.17);
    context.fillRect(Math.floor(x), Math.floor(y), 90 + (i % 3) * 35, 3);
  }
  context.globalAlpha = 1;

  const props = Math.floor(width / 80);
  for (let i = 0; i < props; i += 1) {
    const side = i % 2 === 0 ? 0.06 + (i % 4) * 0.035 : 0.88 - (i % 4) * 0.035;
    const x = width * side;
    const y = height * (0.22 + ((i * 0.17) % 0.64));
    if (i % 3 === 0) {
      context.fillStyle = "#090c09";
      context.fillRect(x - 13, y + 8, 28, 6);
      context.fillStyle = "#30342c";
      context.fillRect(x - 5, y - 5, 11, 18);
      context.fillRect(x - 3, y - 10, 7, 5);
    } else {
      context.strokeStyle = "#29271f";
      context.lineWidth = 6;
      context.beginPath();
      context.moveTo(x, y + 18);
      context.lineTo(x + (i % 2 ? 4 : -3), y - 12);
      context.lineTo(x + (i % 2 ? 13 : -12), y - 22);
      context.moveTo(x + 2, y - 4);
      context.lineTo(x + (i % 2 ? -11 : 12), y - 13);
      context.stroke();
    }
  }
}

function drawDecals(context: CanvasRenderingContext2D, game: GameData) {
  for (const decal of game.decals) {
    context.save();
    context.translate(Math.round(decal.x), Math.round(decal.y));
    context.rotate(decal.rotation);
    context.globalAlpha = 0.7;
    context.fillStyle = decal.color;
    context.fillRect(-decal.size * 0.5, -decal.size * 0.28, decal.size, decal.size * 0.56);
    context.fillRect(-decal.size * 0.28, -decal.size * 0.46, decal.size * 0.56, decal.size * 0.92);
    context.fillRect(decal.size * 0.42, -2, 3, 3);
    context.fillRect(-decal.size * 0.52, 4, 3, 3);
    context.restore();
  }
}

function drawBuilding(context: CanvasRenderingContext2D, building: Building, time: number) {
  const x = Math.round(building.x);
  const y = Math.round(building.y);
  const w = Math.round(building.w);
  const h = Math.round(building.h);

  context.fillStyle = "rgba(0,0,0,0.38)";
  context.fillRect(x + 7, y + 9, w, h);

  if (building.destroyed) {
    context.fillStyle = "#2b211d";
    context.fillRect(x, y + h * 0.56, w, h * 0.44);
    context.fillStyle = "#100e0c";
    context.fillRect(x + 9, y + h * 0.62, w - 18, h * 0.29);
    context.fillStyle = "#6c2a1d";
    const ember = 0.45 + Math.sin(time * 8 + building.id) * 0.2;
    context.globalAlpha = ember;
    context.fillRect(x + w * 0.27, y + h * 0.73, 4, 3);
    context.fillRect(x + w * 0.71, y + h * 0.66, 3, 3);
    context.globalAlpha = 1;
    return;
  }

  const damage = 1 - building.hp / building.maxHp;
  context.fillStyle = building.hit > 0 ? "#f0d3a0" : "#80664c";
  context.fillRect(x, y + h * 0.33, w, h * 0.67);
  context.fillStyle = "#4a382d";
  for (let row = y + h * 0.43; row < y + h; row += 12) context.fillRect(x, Math.floor(row), w, 2);

  context.fillStyle = building.hit > 0 ? "#d97852" : building.roof;
  context.beginPath();
  context.moveTo(x - 8, y + h * 0.4);
  context.lineTo(x + w * 0.5, y);
  context.lineTo(x + w + 8, y + h * 0.4);
  context.closePath();
  context.fill();
  context.fillStyle = "#24191a";
  context.fillRect(x - 3, y + h * 0.36, w + 6, 5);

  const doorW = Math.max(12, w * 0.17);
  context.fillStyle = "#1d1715";
  context.fillRect(x + w * 0.5 - doorW * 0.5, y + h * 0.67, doorW, h * 0.33);
  context.fillStyle = "#bd8b42";
  context.fillRect(x + w * 0.5 + doorW * 0.22, y + h * 0.82, 2, 2);

  const windowGlow = 0.72 + Math.sin(time * 3 + building.id * 1.7) * 0.18;
  context.globalAlpha = windowGlow;
  context.fillStyle = "#d9a33c";
  context.fillRect(x + w * 0.15, y + h * 0.56, 11, 10);
  context.fillRect(x + w * 0.76, y + h * 0.56, 11, 10);
  context.fillStyle = "#3b211c";
  context.fillRect(x + w * 0.15 + 5, y + h * 0.56, 2, 10);
  context.fillRect(x + w * 0.76 + 5, y + h * 0.56, 2, 10);
  context.globalAlpha = 1;

  if (building.kind === "chapel") {
    context.fillStyle = "#7c6049";
    context.fillRect(x + w * 0.4, y - h * 0.22, w * 0.2, h * 0.37);
    context.fillStyle = building.roof;
    context.beginPath();
    context.moveTo(x + w * 0.35, y - h * 0.18);
    context.lineTo(x + w * 0.5, y - h * 0.37);
    context.lineTo(x + w * 0.65, y - h * 0.18);
    context.closePath();
    context.fill();
    context.fillStyle = "#a98e64";
    context.fillRect(x + w * 0.48, y - h * 0.52, 4, h * 0.22);
    context.fillRect(x + w * 0.42, y - h * 0.46, w * 0.16, 4);
  }

  if (damage > 0.2) {
    context.strokeStyle = "#251817";
    context.lineWidth = 2;
    context.beginPath();
    context.moveTo(x + w * 0.33, y + h * 0.45);
    context.lineTo(x + w * 0.4, y + h * 0.58);
    context.lineTo(x + w * 0.35, y + h * 0.7);
    if (damage > 0.58) {
      context.moveTo(x + w * 0.7, y + h * 0.35);
      context.lineTo(x + w * 0.62, y + h * 0.53);
      context.lineTo(x + w * 0.69, y + h * 0.68);
    }
    context.stroke();
  }

  if (damage > 0) {
    context.fillStyle = "#160e0d";
    context.fillRect(x, y + h + 4, w, 3);
    context.fillStyle = "#b33a2e";
    context.fillRect(x, y + h + 4, w * (1 - damage), 3);
  }
}

function drawEnemy(context: CanvasRenderingContext2D, enemy: Enemy) {
  const wobble = Math.sin(enemy.age * (enemy.type === "runner" ? 14 : 8)) * 2;
  const size = enemy.type === "brute" ? 1.35 : enemy.type === "runner" ? 0.82 : 1;
  context.save();
  context.translate(Math.round(enemy.x), Math.round(enemy.y));
  context.rotate(Math.atan2(enemy.vy, enemy.vx) + Math.PI / 2);
  context.scale(size, size);

  context.fillStyle = "rgba(0,0,0,0.45)";
  context.fillRect(-11, 10, 22, 7);
  context.fillStyle = enemy.hit > 0 ? "#f5e4c1" : enemy.type === "brute" ? "#594f37" : "#59634b";
  context.fillRect(-8, -5 + wobble, 16, 18);
  context.fillStyle = enemy.type === "runner" ? "#74503b" : "#3c2e2b";
  context.fillRect(-10, 3 + wobble, 5, 15);
  context.fillRect(5, 3 - wobble, 5, 15);
  context.fillStyle = enemy.hit > 0 ? "#fff0ce" : "#8a8d68";
  context.fillRect(-7, -14, 14, 11);
  context.fillStyle = "#11140f";
  context.fillRect(-5, -11, 3, 3);
  context.fillRect(3, -11, 3, 3);
  context.fillStyle = "#b51f1f";
  context.fillRect(-4, -10, 2, 2);
  context.fillRect(3, -10, 2, 2);
  context.fillStyle = "#241716";
  context.fillRect(-6, 13, 5, 7);
  context.fillRect(2, 13, 5, 7);

  if (enemy.type === "brute") {
    context.fillStyle = "#342724";
    context.fillRect(-15, -2, 7, 16);
    context.fillRect(8, -2, 7, 16);
  }
  context.restore();

  if (enemy.type === "brute" && enemy.hp < enemy.maxHp) {
    context.fillStyle = "#140d0c";
    context.fillRect(enemy.x - 16, enemy.y - 26, 32, 4);
    context.fillStyle = "#b82e28";
    context.fillRect(enemy.x - 16, enemy.y - 26, 32 * (enemy.hp / enemy.maxHp), 4);
  }
}

function drawPlayer(context: CanvasRenderingContext2D, player: Player) {
  const flicker = player.invulnerable > 0 && Math.floor(player.invulnerable * 14) % 2 === 0;
  if (flicker) context.globalAlpha = 0.35;
  const walk = Math.sin(player.step) * Math.min(3, Math.hypot(player.vx, player.vy) / 50);
  context.save();
  context.translate(Math.round(player.x), Math.round(player.y));

  context.fillStyle = "rgba(0,0,0,0.48)";
  context.fillRect(-12, 10, 25, 7);
  context.fillStyle = "#2a2020";
  context.fillRect(-8, 8 + walk, 6, 11);
  context.fillRect(3, 8 - walk, 6, 11);
  context.fillStyle = player.invulnerable > 0 ? "#f0d4b0" : "#d7c8a5";
  context.fillRect(-10, -7, 20, 19);
  context.fillStyle = "#a32625";
  context.fillRect(-11, -3, 22, 5);
  context.fillRect(4, 1, 5, 11);
  context.fillStyle = "#4a3228";
  context.fillRect(-8, -14, 16, 9);
  context.fillRect(-13, -9, 26, 4);
  context.fillStyle = "#c7aa7d";
  context.fillRect(-5, -8, 10, 5);

  context.rotate(player.angle);
  const recoil = player.recoil * 5;
  context.fillStyle = "#221e1a";
  context.fillRect(2 - recoil, -3, 29, 6);
  context.fillStyle = "#8b6d44";
  context.fillRect(-1 - recoil, -4, 13, 8);
  context.fillStyle = "#bca06d";
  context.fillRect(20 - recoil, -2, 13, 3);
  if (player.flash > 0) {
    context.fillStyle = "#fff2a8";
    context.beginPath();
    context.moveTo(33 - recoil, 0);
    context.lineTo(45 - recoil, -8);
    context.lineTo(41 - recoil, 0);
    context.lineTo(45 - recoil, 8);
    context.closePath();
    context.fill();
    context.fillStyle = "#e64d2f";
    context.fillRect(34 - recoil, -2, 7, 4);
  }
  context.restore();
  context.globalAlpha = 1;
}

function drawParticles(context: CanvasRenderingContext2D, game: GameData) {
  for (const particle of game.particles) {
    const alpha = clamp(particle.life / particle.maxLife, 0, 1);
    context.save();
    context.globalAlpha = particle.kind === "smoke" ? alpha * 0.32 : alpha;
    context.translate(Math.round(particle.x), Math.round(particle.y));
    context.rotate(particle.rotation);
    context.fillStyle = particle.color;
    if (particle.kind === "smoke") {
      const growth = 1 + (1 - alpha) * 1.5;
      context.fillRect(-particle.size * growth * 0.5, -particle.size * growth * 0.5, particle.size * growth, particle.size * growth);
    } else if (particle.kind === "spark") {
      context.fillRect(-particle.size, -1, particle.size * 2.5, 2);
    } else {
      context.fillRect(-particle.size * 0.5, -particle.size * 0.5, particle.size, particle.size * (particle.kind === "blood" ? 0.6 : 1));
    }
    context.restore();
  }
}

function drawPickup(context: CanvasRenderingContext2D, pickup: Pickup) {
  const y = pickup.y + Math.sin(pickup.bob) * 4;
  context.save();
  context.translate(Math.round(pickup.x), Math.round(y));
  context.fillStyle = "rgba(232,190,74,0.18)";
  context.fillRect(-15, -15, 30, 30);
  if (pickup.type === "heart") {
    context.fillStyle = "#d84437";
    context.fillRect(-9, -6, 7, 7);
    context.fillRect(2, -6, 7, 7);
    context.fillRect(-7, 0, 14, 7);
    context.fillRect(-3, 7, 6, 4);
  } else {
    context.fillStyle = "#e5c26e";
    context.fillRect(-8, -10, 16, 20);
    context.fillStyle = "#38251f";
    context.fillRect(-5, -7, 10, 4);
    context.fillRect(-5, 1, 10, 6);
    context.fillStyle = "#d84437";
    context.fillRect(-2, 2, 4, 4);
  }
  context.restore();
}

function drawTouchControls(context: CanvasRenderingContext2D, game: GameData) {
  const sticks = [game.input.leftTouch, game.input.rightTouch];
  for (const stick of sticks) {
    if (!stick) continue;
    const dx = stick.x - stick.ox;
    const dy = stick.y - stick.oy;
    const length = Math.hypot(dx, dy);
    const amount = Math.min(1, 46 / Math.max(1, length));
    context.globalAlpha = 0.5;
    context.strokeStyle = "#dccda9";
    context.lineWidth = 2;
    context.beginPath();
    context.arc(stick.ox, stick.oy, 47, 0, Math.PI * 2);
    context.stroke();
    context.fillStyle = "#d13a2f";
    context.fillRect(stick.ox + dx * amount - 9, stick.oy + dy * amount - 9, 18, 18);
    context.globalAlpha = 1;
  }
}

function renderGame(context: CanvasRenderingContext2D, game: GameData, mode: GameMode) {
  context.imageSmoothingEnabled = false;
  context.clearRect(0, 0, game.width, game.height);
  context.save();
  const shakeX = mode === "playing" ? (Math.random() - 0.5) * game.shake : 0;
  const shakeY = mode === "playing" ? (Math.random() - 0.5) * game.shake : 0;
  context.translate(Math.round(shakeX), Math.round(shakeY));

  drawGround(context, game);
  drawDecals(context, game);
  for (const building of game.buildings) drawBuilding(context, building, game.time);
  for (const pickup of game.pickups) drawPickup(context, pickup);
  for (const enemy of game.enemies) drawEnemy(context, enemy);

  context.lineCap = "square";
  for (const bullet of game.bullets) {
    context.strokeStyle = "#f7e7a2";
    context.lineWidth = 3;
    context.beginPath();
    context.moveTo(bullet.px, bullet.py);
    context.lineTo(bullet.x, bullet.y);
    context.stroke();
  }

  drawPlayer(context, game.player);
  drawParticles(context, game);
  for (const popup of game.popups) {
    context.globalAlpha = clamp(popup.life * 1.5, 0, 1);
    drawPixelText(context, popup.text, popup.x, popup.y, 12, popup.color);
    context.globalAlpha = 1;
  }
  context.restore();

  if (game.input.pointerActive && mode === "playing" && !game.input.rightTouch) {
    const x = Math.round(game.input.pointerX);
    const y = Math.round(game.input.pointerY);
    context.strokeStyle = "#e7d9b6";
    context.lineWidth = 2;
    context.beginPath();
    context.moveTo(x - 9, y);
    context.lineTo(x - 3, y);
    context.moveTo(x + 3, y);
    context.lineTo(x + 9, y);
    context.moveTo(x, y - 9);
    context.lineTo(x, y - 3);
    context.moveTo(x, y + 3);
    context.lineTo(x, y + 9);
    context.stroke();
  }

  drawTouchControls(context, game);

  if (game.bannerLife > 0 && mode === "playing") {
    const alpha = Math.min(1, game.bannerLife * 1.5);
    context.globalAlpha = alpha;
    drawPixelText(context, game.banner, game.width * 0.5, game.height * 0.32, Math.min(24, game.width / 18), "#e9d5a7");
    context.globalAlpha = 1;
  }

  const vignette = context.createRadialGradient(
    game.width * 0.5,
    game.height * 0.52,
    Math.min(game.width, game.height) * 0.18,
    game.width * 0.5,
    game.height * 0.52,
    Math.max(game.width, game.height) * 0.72,
  );
  vignette.addColorStop(0, "rgba(0,0,0,0)");
  vignette.addColorStop(1, "rgba(0,0,0,0.52)");
  context.fillStyle = vignette;
  context.fillRect(0, 0, game.width, game.height);
}

function loadScores(): HighScore[] {
  try {
    const raw = localStorage.getItem(SCORE_KEY);
    if (!raw) return [];
    const parsed = JSON.parse(raw) as HighScore[];
    return Array.isArray(parsed) ? parsed.slice(0, 8) : [];
  } catch {
    return [];
  }
}

function ScoreTable({ scores, highlightScore }: { scores: HighScore[]; highlightScore?: number }) {
  return (
    <div className="score-table" aria-label="Local high scores">
      <div className="score-table__heading">
        <span>LOCAL LEGENDS</span>
        <span>SCORE</span>
      </div>
      {scores.length === 0 ? (
        <p className="score-table__empty">No names in the dirt yet.</p>
      ) : (
        <ol>
          {scores.slice(0, 5).map((entry, index) => (
            <li className={entry.score === highlightScore ? "is-current" : ""} key={`${entry.name}-${entry.score}-${entry.date}-${index}`}>
              <span className="score-rank">{String(index + 1).padStart(2, "0")}</span>
              <span className="score-name">{entry.name}</span>
              <span className="score-kills">{entry.kills} K</span>
              <strong>{entry.score.toLocaleString()}</strong>
            </li>
          ))}
        </ol>
      )}
    </div>
  );
}

function PauseIcon() {
  return (
    <svg viewBox="0 0 24 24" aria-hidden="true">
      <path d="M7 5h3v14H7zM14 5h3v14h-3z" fill="currentColor" />
    </svg>
  );
}

function SoundIcon({ muted }: { muted: boolean }) {
  return (
    <svg viewBox="0 0 24 24" aria-hidden="true">
      <path d="M4 9h4l5-4v14l-5-4H4V9Z" fill="currentColor" />
      {muted ? (
        <path d="m16 9 5 6m0-6-5 6" fill="none" stroke="currentColor" strokeWidth="2" />
      ) : (
        <path d="M16 8c2 2 2 6 0 8m3-11c4 4 4 10 0 14" fill="none" stroke="currentColor" strokeWidth="2" />
      )}
    </svg>
  );
}

export default function App() {
  const canvasRef = useRef<HTMLCanvasElement>(null);
  const stageRef = useRef<HTMLDivElement>(null);
  const gameRef = useRef<GameData>(createGame(960, 540));
  const modeRef = useRef<GameMode>("start");
  const audioRef = useRef<AudioContext | null>(null);
  const mutedRef = useRef(false);
  const nameRef = useRef("HUNTER");
  const scoresRef = useRef<HighScore[]>([]);
  const actionsRef = useRef({ start: () => {}, togglePause: () => {} });
  const [mode, setMode] = useState<GameMode>("start");
  const [muted, setMuted] = useState(false);
  const [hunterName, setHunterName] = useState(() => {
    try {
      return localStorage.getItem(NAME_KEY) || "HUNTER";
    } catch {
      return "HUNTER";
    }
  });
  const [scores, setScores] = useState<HighScore[]>(() => loadScores());
  const [hud, setHud] = useState<HudState>(EMPTY_HUD);
  const [finalScore, setFinalScore] = useState(0);
  const [finalKills, setFinalKills] = useState(0);

  nameRef.current = hunterName;
  scoresRef.current = scores;
  mutedRef.current = muted;

  useEffect(() => {
    const canvas = canvasRef.current;
    const stage = stageRef.current;
    if (!canvas || !stage) return;
    const context = canvas.getContext("2d", { alpha: false });
    if (!context) return;

    let animationFrame = 0;
    let lastTime = performance.now();
    let hudClock = 0;

    const setGameMode = (nextMode: GameMode) => {
      modeRef.current = nextMode;
      setMode(nextMode);
    };

    const ensureAudio = () => {
      if (!audioRef.current) audioRef.current = new AudioContext();
      if (audioRef.current.state === "suspended") void audioRef.current.resume();
      return audioRef.current;
    };

    const playSound = (name: SoundName) => {
      if (mutedRef.current) return;
      const audio = ensureAudio();
      const oscillator = audio.createOscillator();
      const gain = audio.createGain();
      const now = audio.currentTime;
      const settings: Record<SoundName, [OscillatorType, number, number, number]> = {
        shot: ["square", 115, 48, 0.055],
        hit: ["sawtooth", 74, 44, 0.045],
        kill: ["square", 90, 33, 0.075],
        hurt: ["sawtooth", 58, 25, 0.18],
        break: ["sawtooth", 48, 18, 0.28],
        pickup: ["square", 280, 620, 0.16],
      };
      const [type, from, to, duration] = settings[name];
      oscillator.type = type;
      oscillator.frequency.setValueAtTime(from, now);
      oscillator.frequency.exponentialRampToValueAtTime(Math.max(1, to), now + duration);
      gain.gain.setValueAtTime(name === "shot" ? 0.028 : 0.022, now);
      gain.gain.exponentialRampToValueAtTime(0.0001, now + duration);
      oscillator.connect(gain);
      gain.connect(audio.destination);
      oscillator.start(now);
      oscillator.stop(now + duration);
    };

    const publishHud = (game: GameData) => {
      setHud({
        score: game.score,
        hp: game.player.hp,
        maxHp: game.player.maxHp,
        combo: game.combo,
        multiplier: game.multiplier,
        destroyed: game.buildings.filter((building) => building.destroyed).length,
        totalBuildings: game.buildings.length,
        frenzy: game.player.frenzy,
      });
    };

    const resize = () => {
      const rect = stage.getBoundingClientRect();
      const ratio = Math.max(0.38, rect.width / Math.max(1, rect.height));
      let width: number;
      let height: number;
      if (ratio >= 1) {
        height = 540;
        width = Math.round(height * ratio);
      } else {
        width = 420;
        height = Math.round(width / ratio);
      }
      const old = gameRef.current;
      if (old.width === width && old.height === height) return;
      canvas.width = width;
      canvas.height = height;

      if (modeRef.current === "start") {
        gameRef.current = createGame(width, height);
      } else {
        const scaleX = width / old.width;
        const scaleY = height / old.height;
        old.width = width;
        old.height = height;
        old.player.x *= scaleX;
        old.player.y *= scaleY;
        for (const enemy of old.enemies) {
          enemy.x *= scaleX;
          enemy.y *= scaleY;
        }
        for (const bullet of old.bullets) {
          bullet.x *= scaleX;
          bullet.px *= scaleX;
          bullet.y *= scaleY;
          bullet.py *= scaleY;
        }
        for (const building of old.buildings) {
          building.x *= scaleX;
          building.y *= scaleY;
          building.w *= scaleX;
          building.h *= scaleY;
        }
        old.input.pointerX *= scaleX;
        old.input.pointerY *= scaleY;
      }
    };

    const saveResult = (game: GameData) => {
      if (game.saved || game.score <= 0) return;
      game.saved = true;
      const cleanName = nameRef.current.trim().toUpperCase().replace(/[^A-Z0-9 ]/g, "").slice(0, 10) || "HUNTER";
      const entry: HighScore = { name: cleanName, score: game.score, kills: game.kills, date: new Date().toISOString() };
      const next = [...scoresRef.current, entry].sort((a, b) => b.score - a.score).slice(0, 8);
      scoresRef.current = next;
      setScores(next);
      try {
        localStorage.setItem(SCORE_KEY, JSON.stringify(next));
      } catch {
        // Scores remain available for this session when storage is blocked.
      }
    };

    const finish = () => {
      if (modeRef.current !== "playing") return;
      const game = gameRef.current;
      setFinalScore(game.score);
      setFinalKills(game.kills);
      saveResult(game);
      setGameMode("gameover");
      publishHud(game);
    };

    const start = () => {
      ensureAudio();
      const width = canvas.width || 960;
      const height = canvas.height || 540;
      const game = createGame(width, height);
      spawnEnemy(game, "ghoul", true);
      spawnEnemy(game, "runner", true);
      gameRef.current = game;
      setFinalScore(0);
      setFinalKills(0);
      publishHud(game);
      setGameMode("playing");
      lastTime = performance.now();
      try {
        localStorage.setItem(NAME_KEY, nameRef.current);
      } catch {
        // The callsign is optional persistence.
      }
    };

    const togglePause = () => {
      if (modeRef.current === "playing") {
        gameRef.current.input.mouseDown = false;
        setGameMode("paused");
      } else if (modeRef.current === "paused") {
        lastTime = performance.now();
        setGameMode("playing");
      }
    };

    actionsRef.current = { start, togglePause };

    const canvasPoint = (event: PointerEvent) => {
      const rect = canvas.getBoundingClientRect();
      return {
        x: ((event.clientX - rect.left) / rect.width) * gameRef.current.width,
        y: ((event.clientY - rect.top) / rect.height) * gameRef.current.height,
      };
    };

    const onPointerDown = (event: PointerEvent) => {
      if (modeRef.current !== "playing") return;
      event.preventDefault();
      ensureAudio();
      const point = canvasPoint(event);
      const input = gameRef.current.input;
      if (event.pointerType === "touch") {
        const stick: TouchStick = { id: event.pointerId, ox: point.x, oy: point.y, x: point.x, y: point.y };
        if (point.x < gameRef.current.width * 0.48 && !input.leftTouch) input.leftTouch = stick;
        else if (!input.rightTouch) input.rightTouch = stick;
        try {
          canvas.setPointerCapture(event.pointerId);
        } catch {
          // Capture can fail when the pointer has already ended.
        }
      } else {
        input.pointerActive = true;
        input.pointerX = point.x;
        input.pointerY = point.y;
        input.mouseDown = true;
      }
    };

    const onPointerMove = (event: PointerEvent) => {
      const point = canvasPoint(event);
      const input = gameRef.current.input;
      if (event.pointerType === "touch") {
        const stick = input.leftTouch?.id === event.pointerId ? input.leftTouch : input.rightTouch?.id === event.pointerId ? input.rightTouch : null;
        if (stick) {
          event.preventDefault();
          stick.x = point.x;
          stick.y = point.y;
        }
      } else {
        input.pointerActive = true;
        input.pointerX = point.x;
        input.pointerY = point.y;
      }
    };

    const onPointerUp = (event: PointerEvent) => {
      const input = gameRef.current.input;
      if (event.pointerType === "touch") {
        if (input.leftTouch?.id === event.pointerId) input.leftTouch = null;
        if (input.rightTouch?.id === event.pointerId) input.rightTouch = null;
      } else {
        input.mouseDown = false;
      }
    };

    const onKeyDown = (event: KeyboardEvent) => {
      if (["ArrowUp", "ArrowDown", "ArrowLeft", "ArrowRight", "Space"].includes(event.code)) event.preventDefault();
      if ((event.code === "Enter" || event.code === "KeyR") && (modeRef.current === "start" || modeRef.current === "gameover")) {
        start();
        return;
      }
      if (event.code === "KeyP" || event.code === "Escape") {
        if (modeRef.current === "playing" || modeRef.current === "paused") togglePause();
        return;
      }
      gameRef.current.input.keys.add(event.code);
    };

    const onKeyUp = (event: KeyboardEvent) => gameRef.current.input.keys.delete(event.code);

    const onBlur = () => {
      gameRef.current.input.keys.clear();
      gameRef.current.input.mouseDown = false;
      gameRef.current.input.leftTouch = null;
      gameRef.current.input.rightTouch = null;
      if (modeRef.current === "playing") setGameMode("paused");
    };

    const onVisibility = () => {
      if (document.hidden) onBlur();
    };

    resize();
    const resizeObserver = new ResizeObserver(resize);
    resizeObserver.observe(stage);
    canvas.addEventListener("pointerdown", onPointerDown, { passive: false });
    canvas.addEventListener("pointermove", onPointerMove, { passive: false });
    canvas.addEventListener("pointerup", onPointerUp);
    canvas.addEventListener("pointercancel", onPointerUp);
    window.addEventListener("keydown", onKeyDown, { passive: false });
    window.addEventListener("keyup", onKeyUp);
    window.addEventListener("blur", onBlur);
    document.addEventListener("visibilitychange", onVisibility);

    const frame = (now: number) => {
      const dt = Math.min(0.033, Math.max(0, (now - lastTime) / 1000));
      lastTime = now;
      const game = gameRef.current;
      if (modeRef.current === "playing") {
        updateGame(game, dt, playSound, finish);
        hudClock += dt;
        if (hudClock >= 0.08) {
          publishHud(game);
          hudClock = 0;
        }
      } else if (modeRef.current === "start") {
        game.time += dt * 0.35;
      } else if (modeRef.current === "gameover") {
        updateParticles(game, dt * 0.45);
      }
      renderGame(context, game, modeRef.current);
      animationFrame = requestAnimationFrame(frame);
    };
    animationFrame = requestAnimationFrame(frame);

    return () => {
      cancelAnimationFrame(animationFrame);
      resizeObserver.disconnect();
      canvas.removeEventListener("pointerdown", onPointerDown);
      canvas.removeEventListener("pointermove", onPointerMove);
      canvas.removeEventListener("pointerup", onPointerUp);
      canvas.removeEventListener("pointercancel", onPointerUp);
      window.removeEventListener("keydown", onKeyDown);
      window.removeEventListener("keyup", onKeyUp);
      window.removeEventListener("blur", onBlur);
      document.removeEventListener("visibilitychange", onVisibility);
    };
  }, []);

  const changeName = (value: string) => {
    setHunterName(value.toUpperCase().replace(/[^A-Z0-9 ]/g, "").slice(0, 10));
  };

  const toggleMute = () => setMuted((value) => !value);

  return (
    <main className="game-app">
      <div className="game-stage" ref={stageRef}>
        <canvas ref={canvasRef} className="game-canvas" aria-label="Ashfall game world" />
        <div className="scanlines" aria-hidden="true" />

        {mode === "playing" && (
          <div className="hud" aria-live="polite">
            <div className="hud__left">
              <span className="hud__label">SCORE</span>
              <strong>{hud.score.toLocaleString().padStart(6, "0")}</strong>
              <span className="hud__purge">PURGE {hud.destroyed}/{hud.totalBuildings}</span>
            </div>
            <div className="hud__center">
              <div className="health-pips" aria-label={`${hud.hp} health remaining`}>
                {Array.from({ length: hud.maxHp }, (_, index) => (
                  <span key={index} className={index < hud.hp ? "is-full" : ""} />
                ))}
              </div>
              {hud.combo >= 2 && (
                <div className="combo-readout">
                  <strong>x{hud.multiplier}</strong>
                  <span>{hud.combo} CHAIN</span>
                </div>
              )}
              {hud.frenzy > 0 && (
                <div className="frenzy-meter">
                  <span>HELLFIRE</span>
                  <i style={{ width: `${(hud.frenzy / 7) * 100}%` }} />
                </div>
              )}
            </div>
            <div className="hud__actions">
              <button className="icon-button" onClick={toggleMute} aria-label={muted ? "Unmute sound" : "Mute sound"}>
                <SoundIcon muted={muted} />
              </button>
              <button className="icon-button" onClick={() => actionsRef.current.togglePause()} aria-label="Pause game">
                <PauseIcon />
              </button>
            </div>
          </div>
        )}

        {mode === "start" && (
          <section className="screen screen--start">
            <div className="start-copy">
              <p className="eyebrow">MIDNIGHT CARTRIDGE PRESENTS</p>
              <h1 aria-label="Ashfall">ASH<span>FALL</span></h1>
              <p className="tagline">The village rang the wrong bell.</p>
              <p className="intro">Load silver. Break the doors. Put every grave-born thing back in the dirt.</p>
              <div className="start-form">
                <label htmlFor="hunter-name">CALLSIGN</label>
                <input
                  id="hunter-name"
                  value={hunterName}
                  onChange={(event) => changeName(event.target.value)}
                  maxLength={10}
                  spellCheck={false}
                  aria-label="Hunter callsign"
                />
                <button className="primary-button" onClick={() => actionsRef.current.start()}>
                  ENTER THE VILLAGE
                  <span>PRESS ENTER</span>
                </button>
              </div>
              <div className="control-hints" aria-label="Controls">
                <span><b>WASD</b> MOVE</span>
                <span><b>MOUSE</b> AIM</span>
                <span><b>HOLD</b> FIRE</span>
                <span><b>P</b> PAUSE</span>
              </div>
              <p className="touch-hint">ON TOUCH: LEFT SIDE MOVES. RIGHT SIDE AIMS AND FIRES.</p>
            </div>
            <div className="start-scores">
              <ScoreTable scores={scores} />
            </div>
            <button className="sound-corner" onClick={toggleMute} aria-label={muted ? "Unmute sound" : "Mute sound"}>
              <SoundIcon muted={muted} />
            </button>
          </section>
        )}

        {mode === "paused" && (
          <section className="screen screen--modal">
            <div className="modal-panel">
              <p className="eyebrow">PAUSED</p>
              <h2>THE NIGHT WAITS</h2>
              <p>Catch your breath. The dead will not.</p>
              <button className="primary-button" onClick={() => actionsRef.current.togglePause()}>
                KEEP HUNTING
                <span>PRESS P</span>
              </button>
              <button className="text-button" onClick={() => actionsRef.current.start()}>RESTART RUN</button>
            </div>
          </section>
        )}

        {mode === "gameover" && (
          <section className="screen screen--gameover">
            <div className="gameover-copy">
              <p className="eyebrow">RUN ENDED</p>
              <h2>YOU FED<br />THE SOIL</h2>
              <div className="final-result">
                <span>FINAL SCORE</span>
                <strong>{finalScore.toLocaleString()}</strong>
                <small>{finalKills} CREATURES BURIED</small>
              </div>
              <button className="primary-button" onClick={() => actionsRef.current.start()}>
                RISE AGAIN
                <span>ENTER OR R</span>
              </button>
              <p className="restart-note">Instant restart. No mercy, no loading.</p>
            </div>
            <div className="gameover-scores">
              <ScoreTable scores={scores} highlightScore={finalScore} />
            </div>
          </section>
        )}
      </div>
    </main>
  );
}