/* ============================================================
   AETHERIA — Motor del juego
   Carga de assets, input, render de mapas, movimiento,
   colisiones, encuentros, cámara e iluminación.
   ============================================================ */
'use strict';

/* ---------- Utilidades ---------- */
const clamp = (v,a,b) => Math.max(a, Math.min(b, v));
const rand = (a,b) => a + Math.random()*(b-a);
const randInt = (a,b) => Math.floor(rand(a, b+1));
const pick = arr => arr[Math.floor(Math.random()*arr.length)];
const lerp = (a,b,t) => a+(b-a)*t;

/* ---------- Carga de assets ---------- */
const Assets = {
  images: {},
  load(paths) {
    const promises = Object.entries(paths).map(([k, src]) => new Promise(res => {
      const im = new Image();
      let settled = false;
      const done = ok => {
        if (settled) return;
        settled = true;
        if (ok) this.images[k] = im;
        else console.warn('Falta asset:', src);
        res();
      };
      im.onload = () => done(true);
      im.onerror = () => done(false);
      setTimeout(() => done(false), 8000);
      im.src = src;
    }));
    return Promise.all(promises);
  },
  img(k) { return this.images[k]; }
};

/* ---------- Input ---------- */
const Input = {
  keys: {}, pressed: {}, touchDir: null, runLock: false,
  init() {
    addEventListener('keydown', e => {
      if (!this.keys[e.key]) this.pressed[this.norm(e.key)] = true;
      this.keys[e.key] = true;
      if (['ArrowUp','ArrowDown','ArrowLeft','ArrowRight',' '].includes(e.key)) e.preventDefault();
      AudioSys.resume();
    });
    addEventListener('keyup', e => { this.keys[e.key] = false; });
  },
  norm(k) {
    const map = { Enter:'confirm', z:'confirm', Z:'confirm', e:'confirm', E:'confirm', ' ':'confirm',
                  x:'cancel', X:'cancel', Escape:'cancel', Shift:'run',
                  ArrowUp:'up', ArrowDown:'down', ArrowLeft:'left', ArrowRight:'right',
                  w:'up', W:'up', s:'down', S:'down', a:'left', A:'left', d:'right', D:'right',
                  '1':'skill1', '2':'skill2', '3':'skill3', '4':'skill4',
                  q:'potion', Q:'potion', c:'dash', C:'dash' };
    return map[k] || k;
  },
  down(a) {
    if (a === 'run' && this.runLock) return true;   // botón CORRER del gamepad táctil
    if (['up','down','left','right'].includes(a) && this.touchDir === a) return true;
    return Object.keys(this.keys).some(k => this.norm(k) === a && this.keys[k]);
  },
  hit(a) {
    if (this.pressed[a]) { delete this.pressed[a]; return true; }
    return false;
  },
  clear() { this.pressed = {}; }
};

/* ---------- Estado global del juego ---------- */
const G = {
  state: 'boot',           // boot|title|intro|play|dialog|battle|menu|shop|gameover|ending
  map: null, mapId: null,
  player: null,
  party: [], reserve: [],
  gold: 150,
  inventory: { potion:3, herb:2 },
  flags: {},
  quests: [],              // {id, name, desc, done}
  steps: 0,
  time: 0,
  monstersSlain: 0,
  playtime: 0,
  dirty: false,
};

function markDirty() { G.dirty = true; }

/* Creación de miembros del grupo */
function makeHero(id, lv=1) {
  const def = HEROES[id];
  const h = { id, name:def.name, cls:def.cls, face:def.face, walkDef:def.walk, lv:1, exp:0,
              equip:{...def.equip}, skills:[], status:{} };
  applyLevel(h, lv);
  // aprender habilidades hasta lv
  def.skills.forEach(([sk, l]) => { if (lv >= l) h.skills.push(sk); });
  return h;
}
function statsOf(h) {
  const def = HEROES[h.id];
  const s = {};
  ['hp','mp','atk','def','mag','agi'].forEach(k => s[k] = Math.floor(def.base[k] + def.growth[k]*h.lv));
  let bonus = { atk:0, def:0, mag:0, agi:0 };
  Object.values(h.equip).forEach(itId => {
    if (!itId || !ITEMS[itId]) return;
    const it = ITEMS[itId];
    bonus.atk += it.atk||0; bonus.def += it.def||0; bonus.mag += it.mag||0; bonus.agi += it.agi||0;
  });
  Object.keys(bonus).forEach(k => s[k] += bonus[k]);
  if (h.buffs) for (const [st, b] of Object.entries(h.buffs)) {
    if (st === 'all') ['atk','def','mag','agi'].forEach(k => { s[k] = Math.floor(s[k]*b.mult); });
    else if (s[st]) s[st] = Math.floor(s[st]*b.mult);
  }
  return s;
}
/* Estadística efectiva de un enemigo (con debuffs aplicados) */
function enemyStat(e, k) {
  const b = e.buffs && e.buffs[k];
  return Math.max(1, Math.floor((e[k] || 1) * (b ? b.mult : 1)));
}
function applyLevel(h, lv) { h.lv = lv; h.hp = h.maxHp = statsOf(h).hp; h.mp = h.maxMp = statsOf(h).mp; }
function expNext(lv) { return expForLevel(lv+1); }

/* ---------- Parser de condiciones global ----------
   Soporta: 'flag', '!flag', '?item' y conjunciones con '&&'
   Ej: 'bossDragonDown&&!bossFinalDown', '?q_relic&&!relicTurned' */
function parseCond(cond) {
  if (!cond) return true;
  return cond.split('&&').every(part => {
    part = part.trim();
    if (!part) return true;
    if (part.startsWith('!')) return !G.flags[part.slice(1)];
    if (part.startsWith('?')) return !!G.inventory[part.slice(1)];
    return !!G.flags[part];
  });
}

/* ---------- Entidades en mapa ---------- */
class Walker {
  constructor(sheet, x, y, opts={}) {
    this.sheet = sheet;        // imagen walk_*
    this.tx = x; this.ty = y;  // tile actual
    this.px = x; this.py = y;  // posición píxel interpolada (en tiles float)
    this.dir = opts.dir || 'down';
    this.moving = false; this.moveT = 0; this.fromX = x; this.fromY = y;
    this.speed = opts.speed || 5.2;      // tiles/seg
    this.wander = opts.wander || false;
    this.wanderTimer = rand(1, 3);
    this.hidden = opts.hidden || false;
    this.step = 0;
    this.npcIndex = opts.npcIndex || 0;
  }
  update(dt, map) {
    if (this.moving) {
      this.moveT += dt * this.speed;
      if (this.moveT >= 1) {
        this.moveT = 0; this.moving = false;
        this.px = this.tx; this.py = this.ty;
      } else {
        this.px = lerp(this.fromX, this.tx, this.moveT);
        this.py = lerp(this.fromY, this.ty, this.moveT);
      }
      this.step += dt * this.speed * 3;
    } else if (this.wander && map === G.map) {
      this.wanderTimer -= dt;
      if (this.wanderTimer <= 0) {
        this.wanderTimer = rand(1.5, 4);
        const dirs = ['up','down','left','right'];
        const d = pick(dirs);
        const [dx,dy] = DIRV[d];
        const nx = this.tx+dx, ny = this.ty+dy;
        if (walkable(map, nx, ny) && !(G.player.tx===nx && G.player.ty===ny) &&
            !map.npcAt.has(nx+','+ny)) {
          this.startMove(d, nx, ny);
        }
      }
    }
  }
  startMove(dir, nx, ny) {
    this.dir = dir; this.moving = true; this.moveT = 0;
    this.fromX = this.px; this.fromY = this.py;
    this.tx = nx; this.ty = ny;
  }
}

const DIRV = { up:[0,-1], down:[0,1], left:[-1,0], right:[1,0] };
const DIR_ROW = { up:0, right:1, down:2, left:3 };

/* ---------- Mapa activo ---------- */
function buildMap(id) {
  const def = MAPS[id];
  const grid = def.rows.map(r => r.split(''));
  const h = grid.length, w = Math.max(...grid.map(r => r.length));
  // normalizar filas
  grid.forEach(r => { while (r.length < w) r.push(r[r.length-1]==='x'?'x':'.'); });
  const map = {
    id, def, grid, w, h,
    name: def.name, music: def.music,
    npcAt: new Map(),
    objects: (def.objects||[]).map(o => ({...o})),
    npcs: [],
  };
  (def.npcs||[]).forEach((n, i) => {
    if (n.hiddenUntil && !G.flags[n.hiddenUntil]) return;
    // NPC reclutables: join/set viven en un bloque de talk; si ya se unió, no se instancia
    const joinBlock = (n.talk||[]).find(b => b.join && b.set);
    if (joinBlock && G.flags[joinBlock.set]) return; // ya se unió
    const [sheet, idx] = n.walk || ['walk_m_townfolk', 0];
    const npc = new Walker(sheet, n.x, n.y, { wander:n.wander, npcIndex:idx });
    npc.data = n; npc.id = n.id;
    map.npcs.push(npc);
    map.npcAt.set(n.x+','+n.y, npc);
  });
  return map;
}

function tileAt(map, x, y) {
  if (x<0||y<0||x>=map.w||y>=map.h) return 'x';
  return map.grid[y][x];
}
function walkable(map, x, y) {
  const t = tileAt(map, x, y);
  if (SOLID_TILES.has(t)) return false;
  // colisión de objetos
  for (const o of map.objects) {
    if (o.type === 'house') {
      if (x >= o.x && x < o.x+o.w && y >= o.y+1 && y < o.y+o.h) {
        if (o.door && x === o.door.x && y === o.door.y) return true;
        return false;
      }
    } else if (['tree','well','column','bed','table','counter','pot','throne'].includes(o.type)) {
      const tw = (o.type==='well'||o.type==='throne') ? 2 : 1;
      const th = tw; // aproximación cuadrada
      if (x >= o.x && x < o.x+tw && y >= o.y && y < o.y+th) return false;
    } else if (['sign','torch','crystal','mushroom','flowers'].includes(o.type)) {
      if (x === o.x && y === o.y+1) return false;
    }
    // canopy: no bloquea (voladizo)
  }
  return true;
}

/* ---------- Render ---------- */
const canvas = document.getElementById('game');
const ctx2d = canvas.getContext('2d');
ctx2d.imageSmoothingEnabled = false;

const TILE = 32;
const manifest = { tiles:{}, atlas:null };

const Render = {
  cam: { x:0, y:0 },
  frame: 0,

  centerCam(map, fx, fy) {
    const vw = canvas.width/TILE, vh = canvas.height/TILE;
    this.cam.x = clamp(fx - vw/2, 0, Math.max(0, map.w - vw));
    this.cam.y = clamp(fy - vh/2, 0, Math.max(0, map.h - vh));
  },

  drawMap(map) {
    const atlas = Assets.img('atlas');
    const m = manifest.tiles;
    const cx = Math.floor(this.cam.x), cy = Math.floor(this.cam.y);
    const ox = -(this.cam.x - cx)*TILE, oy = -(this.cam.y - cy)*TILE;
    const vw = Math.ceil(canvas.width/TILE)+1, vh = Math.ceil(canvas.height/TILE)+1;
    const t = G.time;

    for (let y=0; y<vh; y++) for (let x=0; x<vw; x++) {
      const mx = cx+x, my = cy+y;
      let ch = tileAt(map, mx, my);
      let tname = LEGEND[ch] || ch;
      let frame = m[tname];
      if (!frame) continue;
      let img = atlas;
      // agua animada
      if (ch==='w') { const k = Math.floor(t*2)%2; frame = m[k? 'water2':'water1']; }
      // variación determinista de pasto
      if (['.','，',';'].includes(ch) || ['grass1','grass2'].includes(tname)) {
        const hsh = (mx*73856093 ^ my*19349663) % 100;
        if (hsh < 12 && m['grass2']) frame = m['grass2'];
      }
      const dx = Math.round(x*TILE + ox), dy = Math.round(y*TILE + oy);
      ctx2d.drawImage(img, frame[0]*TILE, frame[1]*TILE, TILE, TILE, dx, dy, TILE, TILE);
    }
  },

  drawSprite(sheetName, x, y, opts={}) {
    const im = Assets.img(sheetName);
    if (!im) return;
    const { sx=0, sy=0, sw=im.width, sh=im.height, scale=2, flip=false } = opts;
    ctx2d.save();
    if (flip) { ctx2d.translate(x + sw*scale, y); ctx2d.scale(-1,1); }
    else ctx2d.translate(x, y);
    ctx2d.drawImage(im, sx, sy, sw, sh, 0, 0, sw*scale, sh*scale);
    ctx2d.restore();
  },

  drawWalker(w, map) {
    if (w.hidden) return;
    const row = DIR_ROW[w.dir];
    const fr = w.moving ? (Math.floor(w.step)%3) : 1;
    const sx = fr*16, sy = row*18;
    const sxp = (w.px - this.cam.x)*TILE, syp = (w.py - this.cam.y)*TILE;
    // sombra
    ctx2d.fillStyle = 'rgba(0,0,0,.28)';
    ctx2d.beginPath(); ctx2d.ellipse(sxp+16, syp+34, 10, 4, 0, 0, Math.PI*2); ctx2d.fill();
    this.drawSprite(w.sheet, sxp, syp, { sx, sy, sw:16, sh:18, scale:2 });
    if (w.data && G.state === 'play') {
      const mk = npcQuestMark(w);
      if (mk) {
        const bob = Math.sin(G.time * 4) * 2;
        ctx2d.font = '800 16px sans-serif';
        ctx2d.textAlign = 'center';
        ctx2d.lineWidth = 3; ctx2d.strokeStyle = 'rgba(0,0,0,.7)';
        ctx2d.strokeText(mk, sxp + 16, syp - 2 + bob);
        ctx2d.fillStyle = mk === '!' ? '#ffd75e' : '#7ec2ff';
        ctx2d.fillText(mk, sxp + 16, syp - 2 + bob);
      }
    }
  },

  drawCompass(map) {
    const interiors = { temple:1, inn:1, shopA:1, shopB:1, throne:1, well:1 };
    const groups = {};
    for (const pt of map.def.portals || []) {
      if (pt.door || interiors[map.id]) continue;
      const dest = MAPS[pt.to];
      const name = dest ? dest.name : pt.to;
      const k = pt.to;
      if (!groups[k]) groups[k] = { xs: [], ys: [], name };
      groups[k].xs.push(pt.x); groups[k].ys.push(pt.y);
    }
    ctx2d.font = '700 12px sans-serif';
    ctx2d.textAlign = 'center';
    const pad = 18, W = canvas.width, H = canvas.height;
    for (const g of Object.values(groups)) {
      const mx = g.xs.reduce((a, b) => a + b, 0) / g.xs.length;
      const my = g.ys.reduce((a, b) => a + b, 0) / g.ys.length;
      let x = (mx - this.cam.x) * TILE + 16;
      let y = (my - this.cam.y) * TILE + 16;
      const on = x > 40 && x < W - 40 && y > 40 && y < H - 40;
      if (on) continue;
      x = clamp(x, pad + 40, W - pad - 40);
      y = clamp(y, pad + 16, H - pad - 16);
      const lab = g.name;
      const w = ctx2d.measureText(lab).width + 18;
      ctx2d.globalAlpha = 0.92;
      ctx2d.fillStyle = 'rgba(8,12,32,.88)';
      ctx2d.fillRect(x - w / 2, y - 10, w, 18);
      ctx2d.strokeStyle = '#f0d78c'; ctx2d.lineWidth = 1;
      ctx2d.strokeRect(x - w / 2, y - 10, w, 18);
      ctx2d.fillStyle = '#ffd75e';
      ctx2d.fillText('➤ ' + lab, x, y + 3);
      ctx2d.globalAlpha = 1;
    }
  },

  drawObjects(map, pass) {
    const atlas = Assets.img('atlas'), m = manifest.tiles;
    const t = G.time;
    for (const o of map.objects) {
      const sxp = (o.x - this.cam.x)*TILE, syp = (o.y - this.cam.y)*TILE;
      if (sxp < -200 || syp < -240 || sxp > canvas.width+200 || syp > canvas.height+240) continue;
      const isOver = ['canopy'].includes(o.type);
      if (pass==='over' && !isOver) continue;
      if (pass==='base' && isOver) continue;

      switch (o.type) {
        case 'house': {
          const im = Assets.img(o.sprite);
          if (im) {
            const dw = o.w * TILE;
            let dh = im.height * (dw / im.width);
            dh = Math.min(dh, o.h * TILE + 96);
            ctx2d.drawImage(im, Math.round(sxp), Math.round(syp + o.h * TILE - dh), dw, dh);
          }
          if (o.door) {
            const dx = (o.door.x - this.cam.x) * TILE, dy = (o.door.y - this.cam.y) * TILE;
            const glow = 0.18 + 0.12 * Math.sin(t * 3);
            ctx2d.fillStyle = `rgba(255,220,120,${glow})`;
            ctx2d.fillRect(dx + 4, dy + 6, TILE - 8, TILE - 8);
          }
          break;
        }
        case 'tree': case 'flowers': case 'mushroom': case 'crystal': {
          const spr = o.type==='tree' ? o.sprite : (o.type==='flowers'?'prop_flowers':o.type==='mushroom'?'prop_mushroom':'prop_crystal');
          const im = Assets.img(spr);
          if (!im) break;
          const dx = Math.round(sxp + (TILE - im.width*1)/2);
          const dy = Math.round(syp + TILE - im.height);
          if (o.type==='tree') {
            ctx2d.fillStyle='rgba(0,0,0,.25)';
            ctx2d.beginPath(); ctx2d.ellipse(sxp+16, syp+TILE-3, 12, 4, 0, 0, Math.PI*2); ctx2d.fill();
          }
          ctx2d.drawImage(im, dx, dy);
          break;
        }
        case 'canopy': {
          const im = Assets.img('prop_canopy');
          if (im) { ctx2d.globalAlpha = .95; ctx2d.drawImage(im, Math.round(sxp-16), Math.round(syp-38)); ctx2d.globalAlpha = 1; }
          break;
        }
        case 'well': case 'throne': {
          const im = Assets.img(o.type==='well'?'prop_well':'prop_throne');
          if (im) ctx2d.drawImage(im, Math.round(sxp-16), Math.round(syp+TILE-im.height));
          break;
        }
        case 'sign': {
          ctx2d.fillStyle = '#5a3a20';
          ctx2d.fillRect(Math.round(sxp+13), Math.round(syp+18), 6, 14);
          ctx2d.fillStyle = '#c89650';
          ctx2d.fillRect(Math.round(sxp+2), Math.round(syp+2), 28, 18);
          ctx2d.strokeStyle = '#7a5a30'; ctx2d.lineWidth = 2;
          ctx2d.strokeRect(Math.round(sxp+3), Math.round(syp+3), 26, 16);
          ctx2d.fillStyle = '#5a3a20';
          ctx2d.fillRect(Math.round(sxp+6), Math.round(syp+7), 20, 2);
          ctx2d.fillRect(Math.round(sxp+6), Math.round(syp+12), 14, 2);
          break;
        }
        case 'column': {
          const fr = m['column'];
          ctx2d.drawImage(atlas, fr[0]*TILE, fr[1]*TILE, TILE, TILE*2, Math.round(sxp), Math.round(syp), TILE, TILE*2);
          break;
        }
        case 'bed': {
          const fr = m['bed'];
          ctx2d.drawImage(atlas, fr[0]*TILE, fr[1]*TILE, TILE, TILE*2, Math.round(sxp), Math.round(syp), TILE, TILE*2);
          break;
        }
        case 'table': case 'counter': {
          const fr = m['table'];
          ctx2d.drawImage(atlas, fr[0]*TILE, fr[1]*TILE, TILE, TILE, Math.round(sxp), Math.round(syp), TILE, TILE);
          if (o.type==='counter') {
            ctx2d.fillStyle = 'rgba(150,110,60,.85)';
            ctx2d.fillRect(Math.round(sxp), Math.round(syp), TILE, TILE);
            ctx2d.fillStyle = 'rgba(190,150,90,.9)';
            ctx2d.fillRect(Math.round(sxp), Math.round(syp), TILE, 8);
          }
          break;
        }
        case 'pot': {
          const fr = m['pot1'];
          ctx2d.drawImage(atlas, fr[0]*TILE, fr[1]*TILE, TILE, TILE, Math.round(sxp), Math.round(syp), TILE, TILE);
          break;
        }
        case 'altar': {
          ctx2d.fillStyle = '#cfd6e8';
          ctx2d.fillRect(Math.round(sxp+4), Math.round(syp+10), 24, 20);
          ctx2d.fillStyle = '#9aa4c0';
          ctx2d.fillRect(Math.round(sxp+8), Math.round(syp+6), 16, 8);
          const glow = 0.35+0.2*Math.sin(t*2.5);
          ctx2d.fillStyle = `rgba(255,230,140,${glow})`;
          ctx2d.beginPath(); ctx2d.arc(sxp+16, syp+2, 5+Math.sin(t*2.5), 0, Math.PI*2); ctx2d.fill();
          break;
        }
        case 'torch': {
          const fr = m['torch_f'+(Math.floor(t*6)%3)];
          if (fr) {
            // soporte
            ctx2d.fillStyle = '#4a3220';
            ctx2d.fillRect(Math.round(sxp+13), Math.round(syp+34), 6, 30);
            ctx2d.drawImage(atlas, fr[0]*TILE, fr[1]*TILE, TILE, TILE, Math.round(sxp), Math.round(syp+2), TILE, TILE);
            // luz
            const g = ctx2d.createRadialGradient(sxp+16, syp+18, 4, sxp+16, syp+18, 80);
            g.addColorStop(0, 'rgba(255,180,80,.30)'); g.addColorStop(1, 'rgba(255,180,80,0)');
            ctx2d.fillStyle = g;
            ctx2d.fillRect(sxp-64, syp-46, 160, 160);
          }
          break;
        }
      }
    }
  },

  drawChests(map) {
    const atlas = Assets.img('atlas'), m = manifest.tiles;
    for (const c of map.def.chests||[]) {
      const key = map.id+':'+c.x+','+c.y;
      if (G.flags['chest_'+key] && !G.flags['chest_open_'+key]) continue;
      if (G.flags['chest_open_'+key]) continue;
      const opened = G.flags['opened_'+key];
      const fr = opened ? m['chest_open'] : m['chest'];
      const sxp = (c.x - this.cam.x)*TILE, syp = (c.y - this.cam.y)*TILE;
      ctx2d.drawImage(atlas, fr[0]*TILE, fr[1]*TILE, TILE, TILE, Math.round(sxp), Math.round(syp), TILE, TILE);
    }
  },

  drawLighting(map) {
    if (!map.def.dark) return;
    const px = (G.player.px - this.cam.x)*TILE + 16;
    const py = (G.player.py - this.cam.y)*TILE + 16;
    const g = ctx2d.createRadialGradient(px, py, 30, px, py, 190);
    g.addColorStop(0, 'rgba(8,6,20,0)');
    g.addColorStop(.6, 'rgba(8,6,20,.55)');
    g.addColorStop(1, 'rgba(8,6,20,.86)');
    ctx2d.fillStyle = g;
    ctx2d.fillRect(0, 0, canvas.width, canvas.height);
  },

  drawLocationTag() {
    if (!G.map) return;
    const a = clamp(1.35 - (G.time - (G.mapEnterT||0)), 0, 1);
    if (a <= 0) return;
    ctx2d.save();
    ctx2d.globalAlpha = a;
    ctx2d.font = '700 22px Palatino, "Palatino Linotype", Georgia, serif';
    ctx2d.textAlign = 'center';
    const txt = G.map.name;
    const w = ctx2d.measureText(txt).width + 64;
    const x = canvas.width/2 - w/2, y = 22;
    ctx2d.fillStyle = 'rgba(8,12,32,.82)';
    ctx2d.beginPath();
    const r = 8;
    ctx2d.moveTo(x+r, y); ctx2d.arcTo(x+w, y, x+w, y+42, r); ctx2d.arcTo(x+w, y+42, x, y+42, r);
    ctx2d.arcTo(x, y+42, x, y, r); ctx2d.arcTo(x, y, x+w, y, r); ctx2d.closePath();
    ctx2d.fill();
    ctx2d.strokeStyle = '#f0d78c'; ctx2d.lineWidth = 2;
    ctx2d.stroke();
    ctx2d.fillStyle = '#f0d78c';
    ctx2d.font = '12px sans-serif';
    ctx2d.fillText('◆', canvas.width/2 - w/2 + 16, 48);
    ctx2d.fillText('◆', canvas.width/2 + w/2 - 16, 48);
    ctx2d.fillStyle = '#fff';
    ctx2d.font = '700 20px Palatino, "Palatino Linotype", Georgia, serif';
    ctx2d.fillText(txt, canvas.width/2, 50);
    ctx2d.restore();
  },

  drawPortals(map) {
    const interiors = { temple:1, inn:1, shopA:1, shopB:1, throne:1 };
    const indoor = !!interiors[map.id];
    const t = G.time;
    const groups = {};
    for (const pt of map.def.portals || []) {
      const sxp = (pt.x - this.cam.x) * TILE, syp = (pt.y - this.cam.y) * TILE;
      if (sxp < -64 || syp < -64 || sxp > canvas.width + 64 || syp > canvas.height + 64) continue;
      const dest = MAPS[pt.to];
      const name = dest ? dest.name : (pt.to || '');
      if (pt.door || indoor) {
        ctx2d.fillStyle = 'rgba(92,48,18,.92)';
        ctx2d.fillRect(sxp + 3, syp + 16, 26, 14);
        ctx2d.fillStyle = '#d4a04a';
        ctx2d.fillRect(sxp + 5, syp + 18, 22, 10);
        const pulse = 0.55 + 0.4 * Math.sin(t * 4);
        ctx2d.fillStyle = `rgba(255,230,120,${pulse})`;
        ctx2d.beginPath();
        ctx2d.moveTo(sxp + 16, syp + 4);
        ctx2d.lineTo(sxp + 7, syp + 16);
        ctx2d.lineTo(sxp + 25, syp + 16);
        ctx2d.closePath();
        ctx2d.fill();
        ctx2d.fillStyle = '#fff8d0';
        ctx2d.font = '700 9px sans-serif';
        ctx2d.textAlign = 'center';
        ctx2d.strokeStyle = 'rgba(0,0,0,.65)'; ctx2d.lineWidth = 3;
        const lab = indoor ? 'SALIR' : 'ENTRAR';
        ctx2d.strokeText(lab, sxp + 16, syp + 40);
        ctx2d.fillText(lab, sxp + 16, syp + 40);
      } else {
        const pulse = 0.28 + 0.22 * Math.sin(t * 3);
        ctx2d.fillStyle = `rgba(255,215,94,${pulse})`;
        ctx2d.fillRect(sxp + 2, syp + 2, TILE - 4, TILE - 4);
        ctx2d.strokeStyle = `rgba(255,240,170,${0.45 + pulse})`;
        ctx2d.lineWidth = 2;
        ctx2d.strokeRect(sxp + 5, syp + 5, TILE - 10, TILE - 10);
        let ax = 0, ay = 0;
        if (pt.x <= 0) ax = -1; else if (pt.x >= map.w - 1) ax = 1;
        else if (pt.y <= 0) ay = -1; else if (pt.y >= map.h - 1) ay = 1;
        ctx2d.fillStyle = '#fffbe8';
        ctx2d.font = '700 16px sans-serif';
        ctx2d.textAlign = 'center';
        ctx2d.fillText(ax > 0 ? '▶' : ax < 0 ? '◀' : ay < 0 ? '▲' : '▼', sxp + 16, syp + 22);
        const k = pt.to + ':' + (ax || ay * 2);
        if (!groups[k]) groups[k] = { xs: [], ys: [], name, ax, ay };
        groups[k].xs.push(pt.x); groups[k].ys.push(pt.y);
      }
    }
    ctx2d.font = '700 11px sans-serif';
    ctx2d.textAlign = 'center';
    for (const g of Object.values(groups)) {
      const mx = g.xs.reduce((a, b) => a + b, 0) / g.xs.length;
      const my = g.ys.reduce((a, b) => a + b, 0) / g.ys.length;
      const x = (mx - this.cam.x) * TILE + 16;
      const y = (my - this.cam.y) * TILE + (g.ay < 0 ? -8 : g.ay > 0 ? 44 : -8);
      const w = ctx2d.measureText(g.name).width + 16;
      ctx2d.fillStyle = 'rgba(8,12,32,.86)';
      ctx2d.fillRect(x - w / 2, y - 12, w, 16);
      ctx2d.strokeStyle = '#f0d78c'; ctx2d.lineWidth = 1;
      ctx2d.strokeRect(x - w / 2, y - 12, w, 16);
      ctx2d.fillStyle = '#ffd75e';
      ctx2d.fillText(g.name, x, y);
    }
  },
};

/* ---------- Bucle principal ---------- */
let lastT = 0;
function gameLoop(ts) {
  const dt = Math.min(0.05, (ts - lastT)/1000 || 0.016);
  lastT = ts;
  try {
    G.time += dt;
    Particles.update(dt);
    if (G.state === 'intro') Intro.update(dt);
    if (G.state === 'ending') Ending.update(dt);
    if (G.state === 'play' || G.state === 'dialog') { G.playtime += dt; updatePlay(dt); }
    renderFrame();
    if (typeof UI !== 'undefined' && UI.syncHUD) UI.syncHUD();
  } catch(e) { console.error('loop:', e.message, e.stack?.split('\n')[1]||''); }
  Input.clear();
  requestAnimationFrame(gameLoop);
}

function updatePlay(dt) {
  const map = G.map;
  if (!map) return;
  map.npcs.forEach(n => n.update(dt, map));
  if (G.state === 'play') {
    updatePlayer(dt, map);
    if (typeof Combat !== 'undefined') Combat.update(dt);
  }
}

function updatePlayer(dt, map) {
  const p = G.player;
  p.update(dt, map);
  Combat.dashCD = Math.max(0, (Combat.dashCD || 0) - dt);

  if (!p.moving) {
    let dir = null;
    if (Input.down('up')) dir='up'; else if (Input.down('down')) dir='down';
    else if (Input.down('left')) dir='left'; else if (Input.down('right')) dir='right';
    const fresh = dir && dir !== Input._heldDir;
    const tapDash = fresh && Input.lastDir === dir && (G.time - (Input.lastDirT || 0)) < 0.28;
    const wantDash = Input.hit('dash') || tapDash;
    if (dir) {
      p.dir = dir;
      const [dx,dy] = DIRV[dir];
      const dash = wantDash && Combat.dashCD <= 0;
      const nx = p.tx+dx, ny = p.ty+dy;
      const nx2 = p.tx+dx*2, ny2 = p.ty+dy*2;
      const speed = dash ? 16 : (Input.down('run') ? 8 : p.speed);
      p.speedBase = p.speed; p.speed = speed;
      const free = (x,y) => walkable(map, x, y) && !map.npcAt.has(x+','+y) && !npcAt2(map, x, y);
      if (dash && free(nx, ny)) {
        const destX = free(nx2, ny2) ? nx2 : nx, destY = free(nx2, ny2) ? ny2 : ny;
        p.startMove(dir, destX, destY);
        Combat.dashCD = 0.7; Combat.iFrames = 0.32; Combat.flashes = 0.08;
        AudioSys.sfx('dash');
        G.steps++; markDirty();
      } else if (free(nx, ny)) {
        p.startMove(dir, nx, ny);
        G.steps++;
      }
      p.speed = p.speedBase;
      if (fresh) { Input.lastDir = dir; Input.lastDirT = G.time; }
    }
    Input._heldDir = dir;
    if (Input.hit('cancel')) { UI.openMenu(); }
  }
  if (Input.hit('confirm')) {
    if (!tryInteract(map)) Combat.tryAttack();
  }
  if (Input.hit('skill1')) Combat.trySkill(0);
  if (Input.hit('skill2')) Combat.trySkill(1);
  if (Input.hit('skill3')) Combat.trySkill(2);
  if (Input.hit('skill4')) Combat.trySkill(3);
  if (Input.hit('potion')) Combat.useQuickItem();
  if (!p.moving) checkPortal(map);
  Render.centerCam(map, p.px+0.5, p.py+0.5);
}

function npcAt2(map, x, y) {
  return map.npcs.some(n => !n.hidden && n.tx===x && n.ty===y);
}

function checkPortal(map) {
  const p = G.player;
  for (const pt of map.def.portals||[]) {
    if (p.tx === pt.x && p.ty === pt.y) {
      if (pt.door) AudioSys.sfx('door');
      transitionTo(pt.to, pt.tx, pt.ty);
      return;
    }
  }
  // triggers
  for (const tr of map.def.triggers||[]) {
    if (tr.done) continue;
    if (tr.cond && !parseCond(tr.cond)) continue;
    if (p.tx >= tr.x && p.tx < tr.x+tr.w && p.ty >= tr.y && p.ty < tr.y+tr.h) {
      if (tr.boss) {
        if (G.flags[tr.boss + 'Down']) continue;
        if (G.flags[tr.boss + 'Fight']) {
          if (typeof Combat !== 'undefined' && !Combat.foes.some(f => f.boss && !f.dead)) {
            Combat.spawnBoss(tr.boss);
          }
          return;
        }
        Events.run(tr.event || tr);
        return;
      }
      if (tr.once) tr.done = true;
      Events.run(tr.event || tr);
      return;
    }
  }
}

function transitionTo(mapId, tx, ty, opts={}) {
  G.state = 'transition';
  const fx = document.getElementById('encounter-fx');
  fx.classList.remove('active'); void fx.offsetWidth;
  fx.classList.add('active');
  setTimeout(() => {
    enterMap(mapId, tx, ty);
    setTimeout(() => { fx.classList.remove('active'); G.state = 'play'; }, 120);
  }, 430);
}

function enterMap(mapId, tx, ty) {
  G.mapId = mapId;
  const map = buildMap(mapId);
  G.map = map;
  if (!G.player) {
    G.player = new Walker(G.party[0].walkDef, tx, ty);
  } else {
    G.player.sheet = G.party[0].walkDef;
    G.player.tx = tx; G.player.ty = ty; G.player.px = tx; G.player.py = ty;
    G.player.moving = false;
  }
  map.npcAt.clear();
  map.npcs.forEach(n => map.npcAt.set(n.tx+','+n.ty, n));
  G.mapEnterT = G.time;
  AudioSys.playTrack(map.music);
  if (typeof Combat !== 'undefined') Combat.spawnForMap(map);
  markDirty();
  UI.updateHUD();
}

/* ---------- Interacción ---------- */
function tryInteract(map) {
  const p = G.player;
  const [dx,dy] = DIRV[p.dir];
  const fx = p.tx+dx, fy = p.ty+dy;

  const npc = map.npcs.find(n => !n.hidden && n.tx===fx && n.ty===fy);
  if (npc) {
    npc.dir = { up:'down', down:'up', left:'right', right:'left' }[p.dir];
    Dialog.runNPC(npc);
    return true;
  }
  const chest = (map.def.chests||[]).find(c => c.x===fx && c.y===fy);
  if (chest) {
    const key = map.id+':'+chest.x+','+chest.y;
    if (G.flags['opened_'+key]) { UI.toast('El cofre está vacío.'); return true; }
    G.flags['opened_'+key] = true;
    AudioSys.sfx('chest');
    if (chest.gold) {
      G.gold += chest.gold;
      markDirty();
      Dialog.say([`¡Has encontrado ${chest.gold} de oro!`], { face:null, name:'Cofre' });
    } else {
      addItem(chest.item, chest.qty||1);
      Dialog.say([`¡Has encontrado ${ITEMS[chest.item].icon} ${ITEMS[chest.item].name}${(chest.qty||1)>1?' x'+chest.qty:''}!`], { face:null, name:'Cofre' });
    }
    return true;
  }
  const sign = (map.objects||[]).find(o => o.type==='sign' &&
      ((o.x===fx && o.y+1===fy) || (o.x===fx && o.y===fy)));
  if (sign && sign.text) {
    Dialog.say([sign.text], { face:null, name:'Letrero' });
    return true;
  }
  const bed = (map.objects||[]).find(o => o.type==='bed' && ((o.x===fx && (o.y===fy||o.y+1===fy))));
  if (bed && map.id==='inn') { Events.run('innSleepOffer'); return true; }
  const altar = (map.objects||[]).find(o => o.type==='altar' && o.x===fx && o.y===fy);
  if (altar) { Events.run('altarOffer'); return true; }
  const well = (map.objects||[]).find(o => o.type==='well' && fx >= o.x && fx < o.x+2 && fy >= o.y && fy < o.y+2);
  if (well && map.id === 'village') {
    AudioSys.sfx('door');
    transitionTo('well', 5, 6);
    return true;
  }
  return false;
}

function npcQuestMark(npc) {
  const blocks = (npc.data && npc.data.talk) || [];
  let chosen = null;
  for (const b of blocks) {
    if (!b.cond || parseCond(b.cond)) { chosen = b; break; }
  }
  if (!chosen) return null;
  if (chosen.quest && !G.quests.some(q => q.id === chosen.quest)) return '!';
  if (chosen.join && chosen.set && !G.flags[chosen.set]) return '!';
  if (chosen.complete || chosen.removeItem) return '?';
  if (chosen.giveItem && chosen.set && !G.flags[chosen.set]) return '?';
  return null;
}

/* ---------- Inventario ---------- */
function addItem(id, qty=1) {
  G.inventory[id] = (G.inventory[id]||0) + qty;
  markDirty();
}
function removeItem(id, qty=1) {
  if (!G.inventory[id]) return false;
  G.inventory[id] -= qty;
  if (G.inventory[id] <= 0) delete G.inventory[id];
  return true;
}

/* ---------- Render frame ---------- */
function renderFrame() {
  if (!Assets.img('atlas')) return; // aún cargando
  ctx2d.fillStyle = '#000'; ctx2d.fillRect(0,0,canvas.width,canvas.height);
  if (G.state==='play' || G.state==='dialog' || G.state==='transition' || G.state==='menu' || G.state==='shop') {
    if (G.map) {
      Render.drawMap(G.map);
      Render.drawObjects(G.map, 'base');
      Render.drawChests(G.map);
      // y-sort: npcs + player
      const ents = [...G.map.npcs, G.player].filter(e => !e.hidden).sort((a,b) => a.py - b.py);
      ents.forEach(e => Render.drawWalker(e, G.map));
      Render.drawObjects(G.map, 'over');
      if (typeof Combat !== 'undefined') Combat.render();
      Render.drawLighting(G.map);
      Render.drawPortals(G.map);
      Render.drawCompass(G.map);
      Render.drawLocationTag();
    }
  } else if (G.state==='battle') {
    Battle.render();
  } else if (G.state==='intro') {
    Intro.render();
  } else if (G.state==='ending') {
    Ending.render();
  }
  // partículas globales
  Particles.render(ctx2d);
}

/* ---------- Partículas (título, batalla, etc.) ---------- */
const Particles = {
  list: [],
  spawn(cfg) { this.list.push(Object.assign({ x:0,y:0,vx:0,vy:0,life:1,age:0,size:3,color:'#fff',grav:0,shape:'circle' }, cfg)); },
  update(dt) {
    for (const p of this.list) { p.age += dt; p.x += p.vx*dt; p.y += p.vy*dt; p.vy += p.grav*dt; }
    this.list = this.list.filter(p => p.age < p.life);
  },
  render(c) {
    for (const p of this.list) {
      const a = 1 - p.age/p.life;
      c.globalAlpha = a;
      c.fillStyle = p.color;
      if (p.shape==='circle') { c.beginPath(); c.arc(p.x, p.y, p.size*a+0.5, 0, Math.PI*2); c.fill(); }
      else c.fillRect(p.x, p.y, p.size, p.size);
    }
    c.globalAlpha = 1;
  }
};

/* El listener de teclado se registra aquí (antes del enrutador de main.js)
   para que el enrutador pueda consumir la tecla y evitar doble proceso. */
Input.init();
