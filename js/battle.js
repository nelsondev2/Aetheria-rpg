/* ============================================================
   AETHERIA — Combate en tiempo real (sobre el mapa)
   Z / A / toque = atacar (si no hay NPC). 1-4 = habilidades.
   Q = poción rápida. Aliados siguen y golpean solos.
   ============================================================ */
'use strict';

const Combat = {
  foes: [],
  slash: null,
  cooldown: 0,
  iFrames: 0,
  skillCD: [0, 0, 0, 0],
  flashes: 0,
  pops: [],
  followers: [],
  bossKey: null,
  onBossDown: null,
  musicWas: null,

  clear() {
    this.foes = [];
    this.slash = null;
    this.cooldown = 0;
    this.iFrames = 0;
    this.skillCD = [0, 0, 0, 0];
    this.followers = [];
    this.bossKey = null;
    this.onBossDown = null;
    this._barSig = null;
  },

  spawnForMap(map) {
    this.clear();
    const pool = map && map.def.enc && ENCOUNTERS[map.def.enc];
    if (pool && pool.length) {
      const n = map.def.enc === 'throne' ? 2 : (3 + randInt(0, 2));
      let tries = 0;
      while (this.foes.length < n && tries++ < 80) {
        const group = pick(pool);
        const key = pick(group);
        const tx = randInt(1, map.w - 2), ty = randInt(1, map.h - 2);
        if (!walkable(map, tx, ty)) continue;
        if (G.player && Math.hypot(tx - G.player.tx, ty - G.player.ty) < 6) continue;
        if ((map.def.portals || []).some(p => Math.abs(p.x - tx) + Math.abs(p.y - ty) < 3)) continue;
        if (this.foes.some(f => Math.abs(f.tx - tx) + Math.abs(f.ty - ty) < 2)) continue;
        this.foes.push(this.makeFoe(key, tx, ty, false));
      }
    }
    if (map) (map.def.triggers || []).forEach(tr => {
      if (tr.boss && G.flags[tr.boss + 'Fight'] && !G.flags[tr.boss + 'Down']) {
        if (!this.foes.some(f => f.boss)) this.spawnBoss(tr.boss);
      }
    });
    this.syncBar();
  },

  spawnBoss(key, opts) {
    opts = opts || {};
    const p = G.player;
    let tx = Math.round(opts.x != null ? opts.x : p.tx + 2);
    let ty = Math.round(opts.y != null ? opts.y : p.ty);
    tx = clamp(tx, 1, G.map.w - 2);
    ty = clamp(ty, 1, G.map.h - 2);
    if (!walkable(G.map, tx, ty)) {
      for (const [dx, dy] of [[2, 0], [-2, 0], [0, 2], [0, -2], [3, 1], [-3, 1]]) {
        if (walkable(G.map, p.tx + dx, p.ty + dy)) { tx = p.tx + dx; ty = p.ty + dy; break; }
      }
    }
    const f = this.makeFoe(key, tx, ty, true);
    this.foes.push(f);
    this.bossKey = key;
    this.onBossDown = opts.onDown || null;
    this.musicWas = G.map.music;
    AudioSys.playTrack('boss');
    this.syncBar();
    return f;
  },

  makeFoe(key, tx, ty, boss) {
    const def = ENEMIES[key];
    const lv = G.party[0] ? Math.max(0, G.party[0].lv - 1) : 0;
    return {
      key, name: def.name, sprite: def.sprite,
      hp: def.hp + lv * 6, maxHp: def.hp + lv * 6,
      atk: def.atk + (lv >> 1), def: def.def, mag: def.mag, agi: def.agi,
      exp: def.exp, gold: def.gold, drop: def.drop, weak: def.weak,
      boss: boss || !!def.boss, skills: def.skills || [],
      tx, ty, px: tx, py: ty, dir: 'down',
      moving: false, moveT: 0, fromX: tx, fromY: ty,
      speed: (boss || def.boss) ? 2.6 : 2.2 + (def.agi || 8) * 0.04,
      hurtT: 0, atkCD: rand(0.4, 1.2), dead: false, fade: 1, t: Math.random() * 6,
      wander: rand(0.6, 2.2),
    };
  },

  dist(a, b) { return Math.hypot((a.px ?? a.tx) - (b.px ?? b.tx), (a.py ?? a.ty) - (b.py ?? b.ty)); },

  alive() { return this.foes.filter(f => !f.dead); },

  /* ---------- Ataque del héroe ---------- */
  tryAttack() {
    if (this.cooldown > 0 || !G.player || G.state !== 'play') return false;
    const p = G.player;
    this.cooldown = 0.38;
    this.slash = { dir: p.dir, t: 0, x: p.px, y: p.py };
    AudioSys.sfx('slash');
    const [dx, dy] = DIRV[p.dir];
    const st = statsOf(G.party[0]);
    let hit = 0;
    for (const f of this.alive()) {
      const fx = f.px - p.px, fy = f.py - p.py;
      const along = fx * dx + fy * dy;
      const side = Math.abs(fx * dy - fy * dx);
      if (along > -0.15 && along < 1.55 && side < 0.85) {
        this.hurtFoe(f, st.atk, { phys: true });
        hit++;
      }
    }
    if (!hit) {
      for (let i = 0; i < 6; i++) Particles.spawn({
        x: (p.px - Render.cam.x + 0.5 + dx * 0.7) * TILE + rand(-8, 8),
        y: (p.py - Render.cam.y + 0.4 + dy * 0.7) * TILE + rand(-8, 8),
        vx: dx * 40, vy: dy * 40, life: 0.25, size: 2, color: '#ffe08a',
      });
    }
    return true;
  },

  trySkill(i) {
    if (G.state !== 'play' || !G.party[0]) return;
    const h = G.party[0];
    const id = h.skills[i];
    if (!id) return;
    const sk = SKILLS[id];
    if (!sk) return;
    if (this.skillCD[i] > 0) { UI.toast('…aún no'); return; }
    if (h.mp < (sk.mp || 0)) { UI.toast('PM insuficiente'); AudioSys.sfx('cancel'); return; }
    h.mp -= sk.mp || 0;
    this.skillCD[i] = 2.4 + (sk.mp || 0) * 0.12;
    this.castSkill(h, sk);
    this.syncBar();
  },

  useQuickItem() {
    if (G.state !== 'play') return;
    const h = G.party[0];
    const id = ['potion', 'hipotion', 'herb', 'elixir'].find(k => G.inventory[k] > 0);
    if (!id) { UI.toast('Sin pociones'); return; }
    const it = ITEMS[id];
    if (it.type === 'heal') {
      if (h.hp >= h.maxHp) { UI.toast('PS al máximo'); return; }
      h.hp = clamp(h.hp + it.value, 0, h.maxHp);
    } else if (it.type === 'full') { h.hp = h.maxHp; h.mp = h.maxMp; }
    removeItem(id, 1);
    AudioSys.sfx('heal');
    this.pop(h, '+' + (it.value || 'OK'), '#8ff0a0');
    this.syncBar();
  },

  castSkill(h, sk) {
    const p = G.player;
    const st = statsOf(h);
    const foes = this.alive();
    const nearest = foes.slice().sort((a, b) => this.dist(p, a) - this.dist(p, b))[0];
    const color = ({ fire: '#ff8a3d', ice: '#7ad8ff', thunder: '#ffe95e', holy: '#fff3b0', dark: '#b06ee8', heal: '#8ff0a0', buff: '#ffd75e', slash: '#fff', wave: '#cfe8ff', meteor: '#ff6a3d' })[sk.anim] || '#fff';
    AudioSys.sfx(({ fire: 'fire', ice: 'ice', thunder: 'thunder', holy: 'holy', dark: 'dark', heal: 'heal', buff: 'buff' })[sk.anim] || (sk.type === 'phys' ? 'hit' : 'confirm'));

    const burst = (wx, wy) => {
      for (let i = 0; i < 12; i++) Particles.spawn({
        x: (wx - Render.cam.x) * TILE + rand(-18, 18),
        y: (wy - Render.cam.y) * TILE + rand(-18, 10),
        vx: rand(-80, 80), vy: rand(-120, -20), grav: 180, life: rand(.3, .6), size: rand(2, 5), color,
      });
    };

    if (sk.type === 'restore') {
      const who = sk.target === 'party' ? G.party.filter(x => x.hp > 0) : [h];
      who.forEach(tgt => {
        if (sk.stat === 'mp') tgt.mp = clamp(tgt.mp + (sk.value || 12), 0, tgt.maxMp);
        else tgt.hp = clamp(tgt.hp + (sk.value || 40), 0, tgt.maxHp);
      });
      this.pop(p, '+' + (sk.value || 40), '#8ff0a0');
      burst(p.px + 0.5, p.py + 0.3);
      return;
    }
    if (sk.type === 'debuff') {
      const targets = foes.filter(f => this.dist(p, f) < 4.5);
      targets.forEach(f => {
        const st = sk.stat || 'def';
        if (st === 'all') { f.atk = Math.max(1, Math.floor(f.atk * (sk.mult || 0.8))); f.def = Math.max(1, Math.floor(f.def * (sk.mult || 0.8))); }
        else if (f[st] != null) f[st] = Math.max(1, Math.floor(f[st] * (sk.mult || 0.75)));
      });
      this.pop(p, '▼ ' + (sk.stat || 'DEF').toUpperCase(), '#c080ff');
      burst(p.px + 0.5, p.py + 0.3);
      return;
    }
    if (sk.type === 'buff') {
      h.buffs = h.buffs || {};
      h.buffs[sk.stat || 'atk'] = { mult: sk.mult || 1.3, turns: sk.turns || 4 };
      this.pop(p, '▲ ' + (sk.stat || 'ATQ').toUpperCase(), '#ffd75e');
      burst(p.px + 0.5, p.py + 0.3);
      return;
    }
    if (sk.type === 'revive') {
      const down = G.party.find(x => x.hp <= 0);
      if (down) { down.hp = Math.floor(down.maxHp * (sk.value || 0.5)); this.pop(p, '¡Revive!', '#fff3b0'); }
      else UI.toast('Nadie está caído');
      return;
    }
    const aoe = sk.target === 'all' || sk.target === 'enemies';
    const targets = aoe ? foes.filter(f => this.dist(p, f) < 4.5) : (nearest && this.dist(p, nearest) < 3.2 ? [nearest] : []);
    if (!targets.length) { UI.toast('Sin objetivo cerca'); h.mp = clamp(h.mp + (sk.mp || 0), 0, h.maxMp); return; }
    targets.forEach(f => {
      let dmg;
      if (sk.type === 'phys') dmg = Math.max(1, Math.floor((st.atk * 2 - f.def) * (sk.power || 1.4) * rand(0.9, 1.12)));
      else dmg = Math.max(1, Math.floor((st.mag * 2.2 - f.mag * 0.5) * (sk.power || 1.4) * rand(0.9, 1.12)));
      this.hurtFoe(f, 0, { raw: dmg, elem: sk.elem, execute: sk.execute });
      burst(f.px + 0.5, f.py + 0.2);
    });
  },

  hurtFoe(f, atk, opts) {
    opts = opts || {};
    let dmg = opts.raw != null ? opts.raw : Math.max(1, Math.floor((atk * 2 - f.def) * rand(0.9, 1.12)));
    const crit = !opts.raw && Math.random() < 0.1;
    if (crit) dmg = Math.floor(dmg * 1.7);
    if (opts.elem && f.weak === opts.elem) { dmg = Math.floor(dmg * 1.5); this.pop(f, '¡DÉBIL!', '#ff9e5e'); }
    if (opts.execute && f.hp < f.maxHp * 0.25) dmg *= 2;
    f.hp = clamp(f.hp - dmg, 0, f.maxHp);
    f.hurtT = 0.28;
    this.pop(f, (crit ? '¡' : '') + dmg + (crit ? '!' : ''), crit ? '#ffde5e' : '#fff', crit);
    AudioSys.sfx(crit ? 'crit' : 'hit');
    this.hitStop = Math.max(this.hitStop || 0, crit ? 0.09 : 0.05);
    markDirty();
    const p = G.player;
    const kx = Math.sign(f.px - p.px) || 1, ky = Math.sign(f.py - p.py);
    const nx = f.tx + kx, ny = f.ty + ky;
    if (walkable(G.map, nx, ny)) { f.tx = nx; f.ty = ny; f.px = nx; f.py = ny; f.moving = false; }
    if (f.hp <= 0) this.kill(f);
  },

  kill(f) {
    if (f.dead) return;
    f.dead = true;
    G.monstersSlain++;
    this.pop(f, '¡Derrotado!', '#ffd75e');
    G.gold += f.gold || 0;
    if (f.drop && Math.random() < 0.45) { addItem(f.drop, 1); UI.toast(`${ITEMS[f.drop].icon} ${ITEMS[f.drop].name}`); }
    G.party.forEach(h => {
      if (h.hp <= 0) return;
      h.exp += f.exp || 0;
      while (h.exp >= expNext(h.lv) && h.lv < 50) {
        h.lv++;
        h.maxHp = statsOf(h).hp; h.maxMp = statsOf(h).mp;
        h.hp = h.maxHp; h.mp = h.maxMp;
        const def = HEROES[h.id];
        (def.skills || []).forEach(([sk, l]) => {
          if (l === h.lv && !h.skills.includes(sk)) { h.skills.push(sk); UI.toast(`✦ ${h.name} aprende ${SKILLS[sk].name}`); }
        });
        AudioSys.sfx('levelup');
        UI.toast(`⬆ ${h.name} sube al Nv. ${h.lv}`);
      }
    });
    if (G.quests.some(q => q.id === 'slimes' && !q.done) && G.mapId === 'road') {
      G.flags.slimeCount = (G.flags.slimeCount || 0) + 1;
      if (G.flags.slimeCount >= 3) { G.flags.slimeQuestDone = true; UI.toast('📜 ¡Vuelve con el alcalde Bram!'); }
      else UI.toast('📜 Misión: ' + G.flags.slimeCount + '/3');
    }
    if (f.boss) {
      const key = this.bossKey || f.key;
      G.flags[key + 'Down'] = true;
      AudioSys.playTrack(this.musicWas || (G.map && G.map.music) || 'village');
      const cb = this.onBossDown; this.onBossDown = null; this.bossKey = null;
      if (cb) setTimeout(cb, 400);
    }
  },

  hitHero(f) {
    if (this.iFrames > 0) return;
    const h = G.party[0];
    if (!h || h.hp <= 0) return;
    const st = statsOf(h);
    let dmg = Math.max(1, Math.floor((f.atk * 2 - st.def) * rand(0.85, 1.05)));
    h.hp = clamp(h.hp - dmg, 0, h.maxHp);
    this.iFrames = 0.7;
    this.flashes = 0.18;
    this.pop(G.player, dmg + '', '#ff7a6e');
    AudioSys.sfx('hurt');
    markDirty();
    const p = G.player;
    const kx = Math.sign(p.tx - f.tx), ky = Math.sign(p.ty - f.ty);
    const nx = p.tx + kx, ny = p.ty + ky;
    if (!p.moving && walkable(G.map, nx, ny) && !npcAt2(G.map, nx, ny)) {
      p.startMove(kx < 0 ? 'left' : kx > 0 ? 'right' : (ky < 0 ? 'up' : 'down'), nx, ny);
    }
    if (h.hp <= 0) {
      const ph = G.inventory.phoenix;
      if (ph) {
        removeItem('phoenix', 1);
        h.hp = Math.floor(h.maxHp * 0.5);
        AudioSys.sfx('holy');
        UI.toast('🪶 ¡La Pluma Fénix te levanta!');
      } else {
        AudioSys.sfx('faint');
        AudioSys.stopMusic();
        G.state = 'gameover';
        UI.showGameOver();
      }
    }
  },

  pop(ref, text, color, big) {
    const isPlayer = ref === G.player || ref === G.party[0];
    const px = isPlayer ? G.player.px : (ref.px ?? ref.tx);
    const py = isPlayer ? G.player.py : (ref.py ?? ref.ty);
    this.pops.push({ x: px, y: py, text, color: color || '#fff', life: 0.9, age: 0, big: !!big });
  },

  /* ---------- IA ---------- */
  stepFoe(f, dt) {
    if (f.dead) { f.fade = Math.max(0, f.fade - dt * 1.6); return; }
    f.t += dt;
    f.hurtT = Math.max(0, f.hurtT - dt);
    f.atkCD = Math.max(0, f.atkCD - dt);
    if (f.moving) {
      f.moveT += dt * f.speed;
      if (f.moveT >= 1) { f.moveT = 0; f.moving = false; f.px = f.tx; f.py = f.ty; }
      else { f.px = lerp(f.fromX, f.tx, f.moveT); f.py = lerp(f.fromY, f.ty, f.moveT); }
      return;
    }
    const p = G.player;
    if (!p) return;
    const d = this.dist(f, p);
    const aggro = f.boss ? 9 : 6.2;
    const melee = this.alive().filter(o => this.dist(o, p) < 1.55).sort((a, b) => this.dist(a, p) - this.dist(b, p));
    const canMelee = f.boss || melee[0] === f;
    if (d < 1.15 && canMelee) {
      if (f.atkCD <= 0) { this.hitHero(f); f.atkCD = f.boss ? 0.85 : 1.05; }
      return;
    }
    if (!canMelee && d < 2.3) {
      const left = f.dir === 'up' || f.dir === 'down' ? pick(['left', 'right']) : pick(['up', 'down']);
      const [sx, sy] = DIRV[left];
      const nx = f.tx + sx, ny = f.ty + sy;
      if (walkable(G.map, nx, ny) && !(nx === p.tx && ny === p.ty)) {
        f.dir = left; f.moving = true; f.moveT = 0; f.fromX = f.px; f.fromY = f.py; f.tx = nx; f.ty = ny;
      }
      return;
    }
    if (d < aggro) {
      const dx = Math.sign(Math.round(p.px - f.px));
      const dy = Math.sign(Math.round(p.py - f.py));
      let dir = null, nx = f.tx, ny = f.ty;
      if (Math.abs(p.px - f.px) > Math.abs(p.py - f.py)) {
        if (dx && walkable(G.map, f.tx + dx, f.ty)) { dir = dx > 0 ? 'right' : 'left'; nx = f.tx + dx; }
        else if (dy && walkable(G.map, f.tx, f.ty + dy)) { dir = dy > 0 ? 'down' : 'up'; ny = f.ty + dy; }
      } else {
        if (dy && walkable(G.map, f.tx, f.ty + dy)) { dir = dy > 0 ? 'down' : 'up'; ny = f.ty + dy; }
        else if (dx && walkable(G.map, f.tx + dx, f.ty)) { dir = dx > 0 ? 'right' : 'left'; nx = f.tx + dx; }
      }
      if (dir && !(nx === p.tx && ny === p.ty)) {
        f.dir = dir; f.moving = true; f.moveT = 0; f.fromX = f.px; f.fromY = f.py; f.tx = nx; f.ty = ny;
      }
      return;
    }
    f.wander -= dt;
    if (f.wander <= 0) {
      f.wander = rand(1.2, 3);
      const dir = pick(['up', 'down', 'left', 'right']);
      const [dx, dy] = DIRV[dir];
      const nx = f.tx + dx, ny = f.ty + dy;
      if (walkable(G.map, nx, ny) && !(G.player.tx === nx && G.player.ty === ny)) {
        f.dir = dir; f.moving = true; f.moveT = 0; f.fromX = f.px; f.fromY = f.py; f.tx = nx; f.ty = ny;
      }
    }
  },

  updateFollowers(dt) {
    const p = G.player;
    if (!p) return;
    while (this.followers.length < Math.max(0, G.party.length - 1)) this.followers.push({ x: p.px, y: p.py, atkCD: 1 });
    this.followers.length = Math.max(0, G.party.length - 1);
    this.followers.forEach((fl, i) => {
      const h = G.party[i + 1];
      if (!h || h.hp <= 0) return;
      const ox = (i % 2 === 0 ? -0.85 : 0.85), oy = 0.7 + i * 0.15;
      fl.x = lerp(fl.x, p.px + ox, 1 - Math.pow(0.04, dt));
      fl.y = lerp(fl.y, p.py + oy, 1 - Math.pow(0.04, dt));
      fl.atkCD = (fl.atkCD || 0) - dt;
      if (fl.atkCD <= 0) {
        const foe = this.alive().sort((a, b) => this.dist({ px: fl.x, py: fl.y }, a) - this.dist({ px: fl.x, py: fl.y }, b))[0];
        if (foe && this.dist({ px: fl.x, py: fl.y }, foe) < 1.7) {
          const st = statsOf(h);
          this.hurtFoe(foe, Math.floor(st.atk * 0.75), {});
          fl.atkCD = 1.15;
        } else fl.atkCD = 0.3;
      }
    });
  },

  update(dt) {
    if (!G.map || G.state !== 'play') return;
    if (this.hitStop > 0) { this.hitStop -= dt; dt *= 0.12; }
    this.cooldown = Math.max(0, this.cooldown - dt);
    this.iFrames = Math.max(0, this.iFrames - dt);
    this.flashes = Math.max(0, this.flashes - dt);
    this.skillCD = this.skillCD.map(t => Math.max(0, t - dt));
    if (this.slash) { this.slash.t += dt; if (this.slash.t > 0.22) this.slash = null; }
    this.foes.forEach(f => this.stepFoe(f, dt));
    this.foes = this.foes.filter(f => !f.dead || f.fade > 0.02);
    this.updateFollowers(dt);
    this.pops.forEach(p => p.age += dt);
    this.pops = this.pops.filter(p => p.age < p.life);
    this._barT = (this._barT || 0) + dt;
    if (this._barT > 0.25) { this._barT = 0; this.syncBar(); }
    const p = G.player;
    const close = p && this.alive().some(f => this.dist(f, p) < (f.boss ? 9 : 6.2));
    const boss = this.alive().some(f => f.boss);
    if (boss) AudioSys.playTrack('boss');
    else if (close) AudioSys.playTrack('battle');
    else if (G.map) AudioSys.playTrack(G.map.music);
  },

  /* ---------- Render ---------- */
  render() {
    const c = ctx2d;
    const cam = Render.cam;
    // aliados
    this.followers.forEach((fl, i) => {
      const h = G.party[i + 1];
      if (!h || h.hp <= 0) return;
      const im = Assets.img(HEROES[h.id].walk);
      if (!im) return;
      const x = (fl.x - cam.x) * TILE, y = (fl.y - cam.y) * TILE;
      c.globalAlpha = 0.95;
      c.drawImage(im, 16, DIR_ROW[G.player.dir] * 18, 16, 18, x, y, 32, 36);
      c.globalAlpha = 1;
    });
    for (const f of this.foes) {
      const im = Assets.img(f.sprite);
      const x = (f.px - cam.x) * TILE + 16, y = (f.py - cam.y) * TILE + 16;
      const bob = Math.sin(f.t * 3) * 2;
      const scale = f.boss ? 2.2 : 1.55;
      c.globalAlpha = f.fade * (f.hurtT > 0 && Math.floor(f.hurtT * 20) % 2 === 0 ? 0.45 : 1);
      if (im) {
        const w = im.width * scale, h = im.height * scale;
        c.fillStyle = 'rgba(0,0,0,.28)';
        c.beginPath(); c.ellipse(x, y + 14, w * 0.28, 6, 0, 0, Math.PI * 2); c.fill();
        c.drawImage(im, x - w / 2, y - h + 18 + bob, w, h);
      }
      c.globalAlpha = f.fade;
      const bw = f.boss ? 54 : 36;
      c.fillStyle = 'rgba(8,10,20,.75)';
      c.fillRect(x - bw / 2, y + 16, bw, 5);
      c.fillStyle = f.hp / f.maxHp < 0.3 ? '#e8434a' : '#3ad05a';
      c.fillRect(x - bw / 2, y + 16, bw * (f.hp / f.maxHp), 5);
      if (f.boss) {
        c.fillStyle = '#ffd75e'; c.font = '700 11px sans-serif'; c.textAlign = 'center';
        c.fillText(f.name, x, y + 30);
      }
      c.globalAlpha = 1;
    }
    // tajo
    if (this.slash) {
      const p = G.player;
      const [dx, dy] = DIRV[this.slash.dir];
      const a = 1 - this.slash.t / 0.22;
      const sx = (p.px - cam.x + 0.5 + dx * 0.85) * TILE;
      const sy = (p.py - cam.y + 0.35 + dy * 0.85) * TILE;
      c.save();
      c.globalAlpha = a;
      c.strokeStyle = '#ffe08a'; c.lineWidth = 3;
      c.beginPath();
      c.arc(sx, sy, 16 + this.slash.t * 20, 0, Math.PI * 1.4);
      c.stroke();
      c.restore();
    }
    // números
    for (const p of this.pops) {
      const a = 1 - p.age / p.life;
      const x = (p.x - cam.x + 0.5) * TILE;
      const y = (p.y - cam.y) * TILE - p.age * 28;
      c.globalAlpha = a;
      c.font = (p.big ? '900 20px' : '800 15px') + ' sans-serif';
      c.textAlign = 'center';
      c.lineWidth = 3; c.strokeStyle = 'rgba(0,0,0,.75)';
      c.strokeText(p.text, x, y);
      c.fillStyle = p.color; c.fillText(p.text, x, y);
      c.globalAlpha = 1;
    }
    if (this.flashes > 0) {
      c.fillStyle = `rgba(220,40,40,${this.flashes * 1.4})`;
      c.fillRect(0, 0, canvas.width, canvas.height);
    }
    const boss = this.alive().find(f => f.boss);
    if (boss) {
      const W = canvas.width;
      c.fillStyle = 'rgba(8,10,20,.82)';
      c.fillRect(W * 0.18, 10, W * 0.64, 22);
      c.strokeStyle = '#f0d78c'; c.lineWidth = 2;
      c.strokeRect(W * 0.18, 10, W * 0.64, 22);
      c.fillStyle = boss.hp / boss.maxHp < 0.3 ? '#e8434a' : '#c45a3a';
      c.fillRect(W * 0.18 + 2, 12, (W * 0.64 - 4) * (boss.hp / boss.maxHp), 18);
      c.fillStyle = '#ffd75e'; c.font = '700 12px sans-serif'; c.textAlign = 'center';
      c.fillText(boss.name + '  ' + boss.hp + '/' + boss.maxHp, W / 2, 26);
    }
  },

  syncBar() {
    const el = document.getElementById('combat-bar');
    if (!el) return;
    const show = G.state === 'play' && G.map && G.party && G.party[0];
    el.classList.toggle('hidden', !show);
    if (!show) return;
    const h = G.party[0];
    const skills = (h.skills || []).slice(0, 4);
    const sig = skills.join(',') + '|' + this.skillCD.map(t => t > 0 ? 1 : 0).join('') + '|' + skills.map(id => (h.mp >= (SKILLS[id].mp || 0) ? 1 : 0)).join('');
    if (sig === this._barSig) return;
    this._barSig = sig;
    const box = document.getElementById('cb-skills');
    if (box) {
      box.innerHTML = skills.map((id, i) => {
        const sk = SKILLS[id];
        const cd = this.skillCD[i] > 0;
        const ok = h.mp >= (sk.mp || 0);
        return `<button type="button" class="cb-sk${cd || !ok ? ' off' : ''}" data-i="${i}" title="${sk.name}">✦<small>${i + 1}</small></button>`;
      }).join('');
      box.querySelectorAll('.cb-sk').forEach(b => b.addEventListener('click', e => {
        e.preventDefault(); Combat.trySkill(+b.dataset.i);
      }));
    }
  },
};

/* Compatibilidad con el código antiguo de jefes */
const Battle = {
  postVictory: null,
  msgQueue: [],
  phase: null,
  start(enemyKeys, opts) {
    opts = opts || {};
    const keys = (enemyKeys || []).map(e => e.key || e);
    if (opts.boss && keys[0]) {
      Combat.spawnBoss(keys[0], { onDown: () => {
        const pv = Battle.postVictory; Battle.postVictory = null; if (pv) pv();
      }});
    } else {
      const p = G.player;
      keys.forEach((key, i) => {
        const tx = clamp(p.tx + 2 + (i % 2), 1, G.map.w - 2);
        const ty = clamp(p.ty - 1 + (i >> 1), 1, G.map.h - 2);
        Combat.foes.push(Combat.makeFoe(key, tx, ty, false));
      });
      Combat.syncBar();
    }
  },
  get active() { return Combat.alive().length > 0; },
  update() {},
  render() { Combat.render(); },
  skipMsg() {},
};
