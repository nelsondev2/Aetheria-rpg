/* ============================================================
   AETHERIA — Interfaz de usuario (DOM)
   Diálogos, menús, tienda, HUD de batalla, guardado.
   ============================================================ */
'use strict';

const $ = id => document.getElementById(id);

const Dialog = {
  lines: [], idx: 0, charIdx: 0, typing: false, opts: null, onDone: null,
  el: $('dialog'), txt: $('dialog-text'), name: $('dialog-name'), face: $('dialog-face'),

  show(lines, opts={}) {
    this.lines = Array.isArray(lines) ? lines : [lines];
    this.idx = 0; this.opts = opts; this.onDone = opts.onDone || null;
    this.el.classList.remove('hidden');
    if (opts.face) {
      this.face.src = 'assets/sprites/' + opts.face + '.png';
      this.face.parentElement.style.display = 'flex';
    } else this.face.parentElement.style.display = 'none';
    this.name.textContent = opts.name || '';
    this.name.style.display = opts.name ? 'inline-block' : 'none';
    G.state = G.state === 'battle' ? G.state : 'dialog';
    this.type();
  },

  say(lines, opts) { this.show(lines, Object.assign({}, opts)); },

  type() {
    this.typing = true;
    this.charIdx = 0;
    this.txt.textContent = '';
    const line = this.lines[this.idx];
    clearInterval(this._t);
    this._t = setInterval(() => {
      this.charIdx += 2;
      this.txt.textContent = line.slice(0, this.charIdx);
      if (this.charIdx >= line.length) { clearInterval(this._t); this.typing = false; }
    }, 18);
  },

  advance() {
    if (this.typing) { clearInterval(this._t); this.txt.textContent = this.lines[this.idx]; this.typing = false; return; }
    this.idx++;
    if (this.idx >= this.lines.length) {
      this.el.classList.add('hidden');
      const f = this.onDone; this.onDone = null;
      if (G.state !== 'battle') G.state = 'play';
      if (f) f();
    } else this.type();
  },
};

/* ---------- Ejecutor de conversaciones NPC ---------- */
const DialogRunner = {
  run(npc) {
    const d = npc.data;
    const blocks = d.talk || [{ say:['...'] }];
    // primer bloque cuya condición se cumple
    let chosen = blocks[blocks.length-1];
    for (const b of blocks) {
      if (!b.cond) { chosen = b; break; }
      if (b.cond.startsWith('!') ? !G.flags[b.cond.slice(1)] : !!G.flags[b.cond]) { chosen = b; break; }
    }
    const steps = [];
    if (chosen.say) steps.push({ say: chosen.say, face: d.face, name: d.name });
    if (chosen.join) steps.push({ join: chosen.join });
    if (chosen.giveGold) steps.push({ giveGold: chosen.giveGold });
    if (chosen.giveItem) steps.push({ giveItem: chosen.giveItem });
    if (chosen.quest) steps.push({ quest: chosen.quest });
    if (chosen.shop) steps.push({ shop: chosen.shop });
    if (chosen.inn) steps.push({ inn: chosen.inn });
    if (chosen.set) steps.push({ set: chosen.set, sfx: chosen.sfx, after: chosen.after });
    this.exec(steps, 0, d);
  },

  exec(steps, i, d) {
    if (i >= steps.length) return;
    const s = steps[i];
    const next = () => this.exec(steps, i+1, d);
    if (s.say) Dialog.say(s.say, { face:s.face||null, name:s.name, onDone: next });
    else if (s.set) {
      G.flags[s.set] = true;
      if (s.sfx) AudioSys.sfx(s.sfx);
      if (s.after && s.after.startsWith('hide:')) {
        const nid = s.after.slice(5);
        const npc = G.map?.npcs.find(n => n.id === nid);
        if (npc) npc.hidden = true;
      }
      next();
    }
    else if (s.join) { Events.joinHero(s.join); next(); }
    else if (s.giveGold) { G.gold += s.giveGold; UI.toast(`+${s.giveGold} de oro`); AudioSys.sfx('coin'); next(); }
    else if (s.giveItem) { addItem(s.giveItem[0], s.giveItem[1]); UI.toast(`${ITEMS[s.giveItem[0]].icon} +${s.giveItem[1]} ${ITEMS[s.giveItem[0]].name}`); next(); }
    else if (s.removeItem) { removeItem(s.removeItem, s.qty||1); next(); }
    else if (s.quest) { Quests.offer(s.quest, next); }
    else if (s.complete) { Quests.complete(s.complete, next); }
    else if (s.shop) { Shop.open(s.shop, next); }
    else if (s.inn) { Shop.openInn(s.inn, next); }
  },
};

/* condición extendida delegada al parser global: '!flag', 'flag', '?item', 'a&&b' */
DialogRunner.checkCond = function(cond) { return parseCond(cond); };
const _origRun = DialogRunner.run.bind(DialogRunner);
DialogRunner.run = function(npc) {
  const blocks = npc.data?.talk || [{ say:['...'] }];
  let chosen = blocks[blocks.length-1];
  for (const b of blocks) {
    if (!b.cond) { chosen = b; break; }
    if (DialogRunner.checkCond(b.cond)) { chosen = b; break; }
  }
  const steps = [];
  if (chosen.say) steps.push({ say: chosen.say, face: npc.data.face, name: npc.data.name });
  if (chosen.removeItem) steps.push({ removeItem: chosen.removeItem, qty: chosen.qty||1 });
  if (chosen.join) steps.push({ join: chosen.join });
  if (chosen.giveGold) steps.push({ giveGold: chosen.giveGold });
  if (chosen.giveItem) steps.push({ giveItem: chosen.giveItem });
  if (chosen.quest) steps.push({ quest: chosen.quest });
  if (chosen.shop) steps.push({ shop: chosen.shop });
  if (chosen.inn) steps.push({ inn: chosen.inn });
  if (chosen.complete) steps.push({ complete: chosen.complete });
  if (chosen.set) steps.push({ set: chosen.set, sfx: chosen.sfx, after: chosen.after });
  this.exec(steps, 0, npc.data);
};

Dialog.runNPC = npc => DialogRunner.run(npc);

/* ---------- Misiones ---------- */
const QUEST_DEFS = {
  slimes: { name:'Camino Peligroso', desc:'Derrota 3 grupos de monstruos en el Camino Real y vuelve con el alcalde Bram.', need:'kills3' },
  flower: { name:'Flor para Nino', desc:'Encuentra una Flor de Aurora en el Bosque de los Susurros y llévasela a Nino.', need:'q_flower' },
  relic:  { name:'La Reliquia Robada', desc:'Recupera la Reliquia del Templo de los goblins del bosque.', need:'q_relic' },
};
const Quests = {
  offer(id, next) {
    if (G.quests.some(q => q.id === id)) { if (next) next(); return; }
    const def = QUEST_DEFS[id];
    Dialog.say(['📜 Nueva misión: ' + def.name, def.desc], { face:null, name:'Misión', onDone: () => {
      G.quests.push({ id, name:def.name, desc:def.desc, done:false });
      if (next) next();
    }});
  },
  complete(id, next) {
    const q = G.quests.find(q => q.id===id && !q.done);
    if (!q) { if (next) next(); return; }
    q.done = true;
    AudioSys.sfx('chest');
    Dialog.say(['✅ Misión completada: ' + q.name], { face:null, name:'Misión', onDone: next });
  },
};

/* ---------- Tienda ---------- */
const Shop = {
  items: [], sel: 0, onDone: null, isInn: false, innPrice: 0,
  open(shopId, onDone) {
    const def = SHOPS[shopId];
    this.items = def.stock; this.sel = 0; this.onDone = onDone || null; this.isInn = false;
    G.state = 'shop';
    $('shop-title').textContent = def.name + '  —  Tu oro: ' + G.gold;
    this.render();
    $('shop').classList.remove('hidden');
  },
  openInn(price, onDone) {
    this.isInn = true; this.innPrice = price; this.onDone = onDone || null;
    G.state = 'shop';
    $('shop-title').textContent = '🛏️ Descansar — ' + price + ' de oro (tienes ' + G.gold + ')';
    $('shop-list').innerHTML = `<div class="item-row sel" data-i="0">Descansar (${price} oro) — restaura todo el grupo</div><div class="item-row" data-i="1">Salir</div>`;
    $('shop-info').innerHTML = 'Una noche acogedora. Todos tus PS y PM se restaurarán.';
    $('shop').classList.remove('hidden');
    this.bindShopTaps();
  },
  bindShopTaps() {
    // Táctil: tocar una fila la selecciona y la confirma
    $('shop-list').querySelectorAll('.item-row[data-i]').forEach(el =>
      el.addEventListener('click', () => { this.sel = +el.dataset.i; this.input('confirm'); }));
  },
  render() {
    if (this.isInn) return;
    let html = '';
    this.items.forEach((id, i) => {
      const it = ITEMS[id];
      html += `<div class="item-row ${i===this.sel?'sel':''}" data-i="${i}"><span>${it.icon} ${it.name}</span><span class="qty">${it.price} oro · tienes ${G.inventory[id]||0}</span></div>`;
    });
    html += `<div class="item-row ${this.items.length===this.sel?'sel':''}" data-i="${this.items.length}"><span>Salir</span></div>`;
    $('shop-list').innerHTML = html;
    const cur = this.items[this.sel];
    $('shop-info').innerHTML = cur ? `<b>${ITEMS[cur].name}</b><br>${ITEMS[cur].desc||''}<br><br><span style="color:#ffd75e">Oro: ${G.gold}</span>` : '';
    this.bindShopTaps();
  },
  input(k) {
    if (this.isInn) {
      if (k==='up'||k==='down') { this.sel = this.sel? 0:1; this.openInn(this.innPrice); $('shop-list').children[this.sel].classList.add('sel'); AudioSys.sfx('cursor'); }
      else if (k==='confirm') {
        if (this.sel===0) {
          if (G.gold >= this.innPrice) {
            G.gold -= this.innPrice;
            G.party.forEach(h => { h.hp = h.maxHp; h.mp = h.maxMp; });
            AudioSys.sfx('heal');
            $('shop').classList.add('hidden');
            Dialog.say(['¡Duermen profundamente... y despiertan como nuevos!'], { face:null, name:'Posada', onDone: () => { G.state='play'; const f=this.onDone; this.onDone=null; if(f) f(); } });
            return;
          } else UI.toast('No tienes suficiente oro...');
        } else { $('shop').classList.add('hidden'); G.state='play'; const f=this.onDone; this.onDone=null; if(f) f(); }
      }
      return;
    }
    const n = this.items.length + 1;
    if (k==='up') { this.sel = (this.sel-1+n)%n; AudioSys.sfx('cursor'); }
    if (k==='down') { this.sel = (this.sel+1)%n; AudioSys.sfx('cursor'); }
    if (k==='cancel') { $('shop').classList.add('hidden'); G.state='play'; const f=this.onDone; this.onDone=null; if(f) f(); return; }
    if (k==='confirm') {
      if (this.sel >= this.items.length) { $('shop').classList.add('hidden'); G.state='play'; const f=this.onDone; this.onDone=null; if(f) f(); return; }
      const id = this.items[this.sel];
      const it = ITEMS[id];
      if (G.gold >= it.price) {
        G.gold -= it.price;
        addItem(id, 1);
        AudioSys.sfx('coin');
        let extra = '';
        if (['weapon','armor','acc'].includes(it.type)) {
          const slot = it.type === 'weapon' ? 'weapon' : it.type === 'armor' ? 'armor' : 'acc';
          const who = G.party.find(h => {
            if (!it.who || it.who === 'all') return true;
            return Array.isArray(it.who) ? it.who.includes(h.id) : it.who === h.id;
          });
          if (who) {
            const before = statsOf(who);
            who.equip[slot] = id;
            const after = statsOf(who);
            extra = ` · ${who.name} ATQ ${before.atk}→${after.atk} DEF ${before.def}→${after.def}`;
          }
        }
        UI.toast(`Compraste ${it.icon} ${it.name}${extra}`);
        markDirty();
      } else { UI.toast('Oro insuficiente...'); AudioSys.sfx('cancel'); }
    }
    this.render();
  },
};

/* ---------- UI principal ---------- */
function barClass(kind, cur, max) {
  const pct = max ? clamp(cur / max * 100, 0, 100) : 0;
  let extra = '';
  if (kind === 'hp') {
    if (pct <= 0) extra = ' danger';
    else if (pct < 25) extra = ' danger';
    else if (pct < 45) extra = ' warn';
  }
  return `bar ${kind}${extra}`;
}
function barFill(cur, max) {
  const pct = max ? clamp(cur / max * 100, 0, 100) : 0;
  return `<i style="width:${pct}%"></i>`;
}

const UI = {
  menuSel: 0, menuPage: 'main', itemSel: 0, equipSel: 0, saveSel: 0,

  hideAll() {
    ['dialog','choice-box','menu','shop','toast','play-hud','combat-bar','quest-hud','help-overlay'].forEach(id => { const el = $(id); if (el) el.classList.add('hidden'); });
    this.hideBattle();
  },

  toast(text, dur=2200) {
    const t = $('toast');
    t.innerHTML = text;
    t.classList.remove('hidden');
    clearTimeout(this._tt);
    this._tt = setTimeout(() => t.classList.add('hidden'), dur);
  },

  updateHUD() {
    if (G.map) $('menu-loc').textContent = '📍 ' + G.map.name;
    $('menu-gold').textContent = '💰 ' + G.gold + ' oro';
    this.renderPlayHUD();
  },

  showHUD() { this.updateHUD(); const h = $('play-hud'); if (h) h.classList.remove('hidden'); },
  hideHUD() { const h = $('play-hud'); if (h) h.classList.add('hidden'); },

  syncHUD() {
    const show = G.state === 'play' || G.state === 'dialog';
    const h = $('play-hud');
    if (!h) return;
    document.body.classList.toggle('ui-block', G.state === 'dialog');
    document.body.classList.toggle('ui-menu', G.state === 'menu' || G.state === 'shop');
    if (show && G.party && G.party.length) {
      h.classList.remove('hidden');
      const sig = (G.gold||0) + '|' + (G.map && G.map.name) + '|' + G.party.map(p => p.hp+','+p.mp+','+p.lv+','+p.name).join(';') + '|' + (G.quests||[]).map(q=>q.id+q.done+(G.flags.slimeCount||0)).join();
      if (sig !== this._hudSig) { this._hudSig = sig; this.renderPlayHUD(); this.renderQuestHUD(); }
    } else h.classList.add('hidden');
  },

  renderQuestHUD() {
    const el = $('quest-hud');
    if (!el) return;
    const active = (G.quests || []).filter(q => !q.done);
    if (!active.length || G.state !== 'play') { el.classList.add('hidden'); return; }
    el.classList.remove('hidden');
    el.innerHTML = active.map(q => {
      let extra = '';
      if (q.id === 'slimes') extra = ' · ' + (G.flags.slimeCount || 0) + '/3';
      if (q.id === 'flower') extra = G.inventory.q_flower ? ' · ¡Tienes la flor!' : '';
      if (q.id === 'relic') extra = G.inventory.q_relic ? ' · ¡Tienes la reliquia!' : '';
      return `<div>📜 ${q.name}${extra}</div>`;
    }).join('');
  },

  renderPlayHUD() {
    const gold = $('hud-gold'), loc = $('hud-loc'), party = $('hud-party');
    if (!gold || !party) return;
    gold.textContent = '💰 ' + (G.gold||0);
    loc.textContent = G.map ? '📍 ' + G.map.name : '';
    loc.style.display = G.map ? '' : 'none';
    party.innerHTML = (G.party||[]).map(h => {
      const ko = h.hp <= 0;
      const low = !ko && h.hp / h.maxHp < 0.25;
      return `<div class="hud-hero${ko?' ko':''}${low?' low':''}">
        <img src="assets/sprites/${h.face}.png" alt="">
        <div class="hud-hero-info">
          <div class="nm"><span>${h.name}</span><small>Nv.${h.lv}</small></div>
          <div class="${barClass('hp', h.hp, h.maxHp)}">${barFill(h.hp, h.maxHp)}</div>
          <div class="${barClass('mp', h.mp, h.maxMp)}">${barFill(h.mp, h.maxMp)}</div>
        </div>
      </div>`;
    }).join('');
  },

  /* ---------- Menú pausa ---------- */
  openMenu() {
    G.state = 'menu';
    this.menuSel = 0; this.menuPage = 'main';
    this.hideHUD();
    this.renderMenu();
    $('menu').classList.remove('hidden');
    AudioSys.sfx('confirm');
  },
  closeMenu() { $('menu').classList.add('hidden'); G.state = 'play'; this.showHUD(); AudioSys.sfx('cancel'); },

  renderMenu() {
    this.updateHUD();
    const opts = [
      ['🎒 Objetos', 'Usar o revisar tu inventario'],
      ['🛡️ Equipo', 'Armas y armaduras del grupo'],
      ['✦ Habilidades', 'Consulta las técnicas del grupo'],
      ['📜 Misiones', 'Tu registro de aventuras'],
      ['💾 Guardar', 'Registra tu progreso'],
      ['🕹️ Controles', 'Teclado y táctil'],
      ['↩ Cerrar', 'Vuelve al juego'],
    ];
    $('menu-list').innerHTML = opts.map((o,i) =>
      `<li class="${i===this.menuSel?'sel':''}">${o[0]}<small>${o[1]}</small></li>`).join('');
    const panel = $('menu-panel');
    if (this.menuPage === 'main') panel.innerHTML = this.partyHTML();
    else if (this.menuPage === 'items') panel.innerHTML = this.itemsHTML();
    else if (this.menuPage === 'useOn') panel.innerHTML = this.useOnHTML();
    else if (this.menuPage === 'equip') panel.innerHTML = this.equipHTML();
    else if (this.menuPage === 'skills') panel.innerHTML = this.skillsHTML();
    else if (this.menuPage === 'quests') panel.innerHTML = this.questsHTML();
    else if (this.menuPage === 'save') panel.innerHTML = this.saveHTML();
    this.bindMenuTaps(panel);
  },

  /* Táctil: tocar listas del menú equivale a seleccionar + confirmar */
  bindMenuTaps(panel) {
    const page = this.menuPage;
    if (page === 'main') {
      $('menu-list').querySelectorAll('li').forEach((li, i) =>
        li.addEventListener('click', () => { this.menuSel = i; this.menuInput('confirm'); }));
    } else if (page === 'items') {
      panel.querySelectorAll('.item-row[data-i]').forEach(el =>
        el.addEventListener('click', () => { this.itemSel = +el.dataset.i; this.menuInput('confirm'); }));
    } else if (page === 'useOn') {
      panel.querySelectorAll('.pcard[data-hi]').forEach(el =>
        el.addEventListener('click', () => { this.equipSel = +el.dataset.hi; this.menuInput('confirm'); }));
    } else if (page === 'save') {
      panel.querySelectorAll('.item-row[data-i]').forEach(el =>
        el.addEventListener('click', () => { this.saveSel = +el.dataset.i; this.menuInput('confirm'); }));
    } else { // equip / skills / quests: tocar el panel vuelve atrás
      panel.addEventListener('click', () => this.menuInput('cancel'));
    }
  },

  /* Página visual para elegir héroe al usar un objeto (imprescindible en táctil) */
  useOnHTML() {
    const it = ITEMS[this._useItem];
    let html = `<div class="menu-section-title">USAR ${it ? it.icon + ' ' + it.name : ''} EN…</div><div class="party-row">`;
    G.party.forEach((h, i) => {
      const sel = this.equipSel === i;
      html += `<div class="pcard${sel?' sel':''}" data-hi="${i}" style="cursor:pointer">
        <div class="pname"><img class="pface" src="assets/sprites/${h.face}.png"><span>${h.name}</span></div>
        <div class="pstat">${h.cls}</div>
        <div class="${barClass('hp', h.hp, h.maxHp)}">${barFill(h.hp, h.maxHp)}</div>
        <div class="bar-lab"><span>PS</span><span>${h.hp}/${h.maxHp}</span></div>
        <div class="${barClass('mp', h.mp, h.maxMp)}">${barFill(h.mp, h.maxMp)}</div>
        <div class="bar-lab"><span>PM</span><span>${h.mp}/${h.maxMp}</span></div>
      </div>`;
    });
    return html + '</div><div class="item-desc">Toca un héroe para usar el objeto. X o botón B para volver.</div>';
  },

  partyHTML() {
    const playMin = Math.floor((G.playtime||0) / 60);
    return '<div class="menu-section-title">GRUPO</div><div class="party-row">' + G.party.map(h => {
      const st = statsOf(h);
      const xn = expNext(h.lv), xp0 = expForLevel(h.lv);
      const pct = clamp((h.exp-xp0)/(xn-xp0)*100, 0, 100);
      return `<div class="pcard">
        <div class="pname"><img class="pface" src="assets/sprites/${h.face}.png"><span>${h.name}</span><span class="plv">Nv. ${h.lv}</span></div>
        <div class="pstat">${h.cls}</div>
        <div class="${barClass('hp', h.hp, h.maxHp)}">${barFill(h.hp, h.maxHp)}</div>
        <div class="bar-lab"><span>PS</span><span>${h.hp}/${h.maxHp}</span></div>
        <div class="${barClass('mp', h.mp, h.maxMp)}">${barFill(h.mp, h.maxMp)}</div>
        <div class="bar-lab"><span>PM</span><span>${h.mp}/${h.maxMp}</span></div>
        <div class="bar xp"><i style="width:${pct}%"></i></div>
        <div class="bar-lab"><span>EXP</span><span>${h.exp} / ${xn}</span></div>
        <div class="pstat">ATQ ${st.atk} · DEF ${st.def} · MAG ${st.mag} · AGI ${st.agi}</div>
      </div>`;
    }).join('') + '</div><div class="menu-section-title">ESTADÍSTICAS</div>' +
    `<div class="item-row"><span>Monstruos derrotados</span><span class="qty">${G.monstersSlain}</span></div>` +
    `<div class="item-row"><span>Pasos dados</span><span class="qty">${G.steps}</span></div>` +
    `<div class="item-row"><span>Oro</span><span class="qty">${G.gold}</span></div>` +
    `<div class="item-row"><span>Tiempo de juego</span><span class="qty">${playMin} min</span></div>` +
    `<div class="item-row"><span>A / Z — atacar o hablar</span><span class="qty">1-4 magia · Q poción</span></div>`;
  },

  itemsHTML() {
    const ids = Object.keys(G.inventory);
    let html = '<div class="menu-section-title">INVENTARIO — Z o toque para usar, X volver</div>';
    if (!ids.length) html += '<div class="item-row"><span>El inventario está vacío.</span></div>';
    ids.forEach((id, i) => {
      const it = ITEMS[id];
      html += `<div class="item-row ${i===this.itemSel?'sel':''}" data-i="${i}"><span>${it.icon} ${it.name}</span><span class="qty">x${G.inventory[id]}</span></div>`;
    });
    const cur = ids[this.itemSel];
    if (cur) html += `<div class="item-desc">${ITEMS[cur].desc||''}</div>`;
    return html;
  },

  equipHTML() {
    let html = '<div class="menu-section-title">EQUIPO — elige héroe con Z</div>';
    html += '<div class="party-row">' + G.party.map((h,i) => {
      const sel = this.equipSel === i;
      return `<div class="pcard${sel?' sel':''}">
        <div class="pname"><img class="pface" src="assets/sprites/${h.face}.png"><span>${h.name}</span></div>
        <div class="pstat">⚔️ ${h.equip.weapon?ITEMS[h.equip.weapon].name:'—'}</div>
        <div class="pstat">🛡️ ${h.equip.armor?ITEMS[h.equip.armor].name:'—'}</div>
        <div class="pstat">📿 ${h.equip.acc?ITEMS[h.equip.acc].name:'—'}</div>
      </div>`;
    }).join('') + '</div>';
    html += '<div class="item-desc">Compra armas y armaduras en las tiendas. Cada pieza suma ATQ/DEF/MAG.</div>';
    return html;
  },

  skillsHTML() {
    let html = '<div class="menu-section-title">HABILIDADES</div><div class="party-row">';
    G.party.forEach(h => {
      html += `<div class="pcard"><div class="pname"><img class="pface" src="assets/sprites/${h.face}.png"><span>${h.name}</span></div>`;
      h.skills.forEach(sk => {
        const s = SKILLS[sk];
        html += `<div class="pstat">✦ ${s.name} <span style="color:#7ec2ff">${s.mp?('PM '+s.mp):''}</span><br><span style="color:#9fb4e8;font-size:11px">${s.desc}</span></div>`;
      });
      html += '</div>';
    });
    return html + '</div>';
  },

  questsHTML() {
    let html = '<div class="menu-section-title">MISIONES</div>';
    if (!G.quests.length) html += '<div class="item-row"><span>Aún no tienes misiones. ¡Habla con la gente!</span></div>';
    G.quests.forEach(q => {
      html += `<div class="item-row"><span>${q.done?'✅':'📜'} ${q.name}</span></div><div class="item-desc" style="min-height:0">${q.desc}</div>`;
    });
    return html;
  },

  saveHTML() {
    let html = '<div class="menu-section-title">GUARDAR PARTIDA</div>';
    for (let i=0;i<3;i++) {
      const data = localStorage.getItem('aetheria_save_'+i);
      let info = '— Vacío —';
      if (data) { try { const d = JSON.parse(data); info = `${d.party[0].name} Nv.${d.party[0].lv} · ${d.mapName} · ${new Date(d.date).toLocaleString()}`; } catch(e){} }
      html += `<div class="item-row ${i===this.saveSel?'sel':''}" data-i="${i}"><span>💾 Ranura ${i+1}</span><span class="qty">${info}</span></div>`;
    }
    return html;
  },

  menuInput(k) {
    const opts = 7;
    if (this.menuPage === 'main') {
      if (k==='up') { this.menuSel = (this.menuSel+opts-1)%opts; AudioSys.sfx('cursor'); }
      if (k==='down') { this.menuSel = (this.menuSel+1)%opts; AudioSys.sfx('cursor'); }
      if (k==='confirm') {
        AudioSys.sfx('confirm');
        const pages = ['items','equip','skills','quests','save','help','close'];
        const p = pages[this.menuSel];
        if (p==='close') return this.closeMenu();
        if (p==='help') { this.closeMenu(); Help.show(); return; }
        this.menuPage = p;
        if (p==='items') this.itemSel = 0;
        if (p==='save') this.saveSel = 0;
      }
      if (k==='cancel') return this.closeMenu();
    }
    else if (this.menuPage === 'items') {
      const ids = Object.keys(G.inventory);
      if (k==='up' && ids.length) { this.itemSel = (this.itemSel+ids.length-1)%ids.length; AudioSys.sfx('cursor'); }
      if (k==='down' && ids.length) { this.itemSel = (this.itemSel+1)%ids.length; AudioSys.sfx('cursor'); }
      if (k==='confirm' && ids.length) {
        const id = ids[this.itemSel];
        const it = ITEMS[id];
        if (['heal','mp','full','cure','revive'].includes(it.type)) {
          this.menuPage = 'useOn'; this._useItem = id; this.equipSel = 0;
        } else UI.toast('Este objeto no puede usarse ahora.');
      }
      if (k==='cancel') { this.menuPage='main'; AudioSys.sfx('cancel'); }
    }
    else if (this.menuPage === 'useOn') {
      if (k==='up') { this.equipSel = (this.equipSel+G.party.length-1)%G.party.length; AudioSys.sfx('cursor'); }
      if (k==='down') { this.equipSel = (this.equipSel+1)%G.party.length; AudioSys.sfx('cursor'); }
      if (k==='cancel') { this.menuPage='items'; AudioSys.sfx('cancel'); }
      if (k==='confirm') {
        const id = this._useItem, it = ITEMS[id];
        const h = G.party[this.equipSel];
        let used = true;
        if (it.type==='heal') { if (h.hp>=h.maxHp) used=false; else h.hp = clamp(h.hp+it.value,0,h.maxHp); }
        else if (it.type==='mp') { h.mp = clamp(h.mp+it.value,0,h.maxMp); }
        else if (it.type==='full') { h.hp=h.maxHp; h.mp=h.maxMp; }
        else if (it.type==='cure') { delete h.status.poison; }
        else if (it.type==='revive') { if (h.hp<=0){ h.hp=Math.floor(h.maxHp*(it.value||.5)); } else used=false; }
        if (used) { removeItem(id,1); AudioSys.sfx('heal'); UI.toast(`${it.icon} ${it.name} → ${h.name}`); }
        else AudioSys.sfx('cancel');
        this.menuPage = 'items';
      }
    }
    else if (this.menuPage === 'equip' || this.menuPage === 'skills' || this.menuPage === 'quests') {
      if (k==='cancel' || k==='confirm') { this.menuPage = 'main'; AudioSys.sfx('cancel'); }
    }
    else if (this.menuPage === 'save') {
      if (k==='up') { this.saveSel = (this.saveSel+2)%3; AudioSys.sfx('cursor'); }
      if (k==='down') { this.saveSel = (this.saveSel+1)%3; AudioSys.sfx('cursor'); }
      if (k==='confirm') { Save.save(this.saveSel); AudioSys.sfx('chest'); UI.toast('💾 ¡Partida guardada en la ranura '+(this.saveSel+1)+'!'); }
      if (k==='cancel') { this.menuPage='main'; AudioSys.sfx('cancel'); }
    }
    else this.menuPage = 'main';
    this.renderMenu();
  },

  /* ---------- Batalla: DOM flotante dibujado en canvas ---------- */
  battleMsg: null,
  drawBattleMsg(c) {
    if (!Battle.msgQueue.length) return;
    const m = Battle.msgQueue[0];
    const W = canvas.width;
    c.save();
    const h = 64, y = canvas.height - h - 18;
    c.fillStyle = 'rgba(10,16,40,.92)';
    c.strokeStyle = '#f0d78c'; c.lineWidth = 2;
    roundRect(c, 30, y, W-60, h, 10); c.fill(); c.stroke();
    c.strokeStyle = 'rgba(21,32,72,.9)'; c.lineWidth = 4;
    roundRect(c, 27, y-3, W-54, h+6, 12); c.stroke();
    c.fillStyle = '#fff'; c.font = '600 19px "Segoe UI", sans-serif'; c.textAlign = 'left';
    c.fillText(m.text, 52, y+39);
    c.restore();
  },

  hideBattle() {
    if (this._battleEl) { this._battleEl.remove(); this._battleEl = null; }
  },

  showBattleCmd(battle) {
    this.hideBattle();
    const el = document.createElement('div');
    el.className = 'jwin bwin battle-panel';
    const h = battle.actor.ref.hero;
    let cmdHtml = `<div class="battle-cmd">
      <div class="battle-cmd-head"><span>¿Qué hará ${h.name}?</span><span class="hpmp">PS ${h.hp}/${h.maxHp} · PM ${h.mp}/${h.maxMp}</span></div>
      <div id="bcmd" class="bcmd-grid">
        ${['⚔️ Atacar','✦ Habilidad','🎒 Objeto','🛡️ Defender','💨 Huir'].map((t,i)=>`<div class="choice ${i===battle.cmdSel?'sel':''}" data-i="${i}">${t}</div>`).join('')}
      </div></div>`;
    cmdHtml += `<div class="battle-party">${G.party.map(hh => `<div class="bp-row${hh.hp>0?'':' ko'}">
      <img src="assets/sprites/${hh.face}.png" alt="">
      <div style="flex:1;min-width:0"><div class="nm"><b>${hh.name}</b> <small>Nv.${hh.lv}</small></div>
      <div class="${barClass('hp', hh.hp, hh.maxHp)}">${barFill(hh.hp, hh.maxHp)}</div></div>
      <div class="nums">${hh.hp}/${hh.maxHp}</div>
    </div>`).join('')}</div>`;
    el.innerHTML = cmdHtml;
    // Táctil: tocar una orden la selecciona y la confirma
    el.querySelectorAll('#bcmd .choice').forEach(c => c.addEventListener('click', () => {
      battle.cmdSel = +c.dataset.i; this.updateBattleCmd(battle); BattleKey('confirm');
    }));
    $('ui-layer').appendChild(el);
    this._battleEl = el;
  },

  updateBattleCmd(battle) {
    if (!this._battleEl) return;
    this._battleEl.querySelectorAll('#bcmd .choice').forEach((c,i)=>c.classList.toggle('sel', i===battle.cmdSel));
  },

  showBattleTargets(battle, targets, kind) {
    this.hideBattle();
    const el = document.createElement('div');
    el.className = 'jwin bwin battle-panel';
    const title = kind==='skill' ? 'Elige objetivo para ' + SKILLS[battle.pendingSkill].name : kind==='item' ? 'Usar ' + ITEMS[battle.pendingItem].name + ' en...' : '¿A quién atacas?';
    el.innerHTML = `<div class="battle-cmd" style="width:100%"><div class="battle-cmd-head">${title}</div>
      <div id="btgt" class="bcmd-grid">
      ${targets.map((t,i)=>`<div class="choice ${i===battle.targetSel?'sel':''}" data-i="${i}">
        ${t.side==='party'?t.hero.name:t.name} ${t.side==='party'?`<small style="color:#9fb4e8">PS ${t.hero.hp}/${t.hero.maxHp}</small>`:`<small style="color:#9fb4e8">PS ${t.hp}/${t.maxHp}</small>`}</div>`).join('')}
      </div>`;
    el.querySelectorAll('#btgt .choice').forEach(c => c.addEventListener('click', () => {
      battle.targetSel = +c.dataset.i; this.updateBattleTargets(battle, targets); BattleKey('confirm');
    }));
    $('ui-layer').appendChild(el);
    this._battleEl = el;
  },

  updateBattleTargets(battle, targets) {
    if (!this._battleEl) return;
    this._battleEl.querySelectorAll('#btgt .choice').forEach((c,i)=>c.classList.toggle('sel', i===battle.targetSel));
  },

  showBattleSkills(battle) {
    this.hideBattle();
    const h = battle.actor.ref.hero;
    const el = document.createElement('div');
    el.className = 'jwin bwin battle-panel';
    let html = `<div class="battle-cmd" style="width:100%"><div class="battle-cmd-head"><span>Habilidades de ${h.name}</span><span class="hpmp">PM ${h.mp}/${h.maxMp}</span></div>
      <div id="bskl" class="bcmd-grid">`;
    h.skills.forEach((id,i) => {
      const sk = SKILLS[id];
      const ok = h.mp >= sk.mp;
      html += `<div class="choice ${i===battle.subSel?'sel':''}" data-i="${i}" style="${ok?'':'opacity:.45'}">✦ ${sk.name} <small style="color:#7ec2ff">${sk.mp} PM</small></div>`;
    });
    html += `<div class="choice ${battle.subSel>=h.skills.length?'sel':''}" data-i="${h.skills.length}">← Volver</div></div>`;
    const cur = h.skills[battle.subSel];
    html += `<div class="item-desc" style="min-height:34px;margin-top:8px">${cur ? SKILLS[cur].desc : ''}</div></div>`;
    el.innerHTML = html;
    el.querySelectorAll('#bskl .choice').forEach(c => c.addEventListener('click', () => {
      battle.subSel = +c.dataset.i; BattleKey('confirm');
    }));
    $('ui-layer').appendChild(el);
    this._battleEl = el;
  },

  showBattleItems(battle) {
    this.hideBattle();
    const el = document.createElement('div');
    el.className = 'jwin bwin battle-panel';
    let html = `<div class="battle-cmd" style="width:100%"><div class="battle-cmd-head">Objetos</div><div id="bitem" class="bcmd-grid">`;
    battle.itemList.forEach((id,i) => {
      const it = ITEMS[id];
      html += `<div class="choice ${i===battle.subSel?'sel':''}" data-i="${i}">${it.icon} ${it.name} <small style="color:#9fb4e8">x${G.inventory[id]}</small></div>`;
    });
    html += `<div class="choice ${battle.subSel>=battle.itemList.length?'sel':''}" data-i="${battle.itemList.length}">← Volver</div></div>`;
    const cur = battle.itemList[battle.subSel];
    html += `<div class="item-desc" style="min-height:34px;margin-top:8px">${cur ? ITEMS[cur].desc : ''}</div></div>`;
    el.innerHTML = html;
    el.querySelectorAll('#bitem .choice').forEach(c => c.addEventListener('click', () => {
      battle.subSel = +c.dataset.i; BattleKey('confirm');
    }));
    $('ui-layer').appendChild(el);
    this._battleEl = el;
  },

  showVictory(battle, onDone) {
    this.hideBattle();
    const v = battle.victoryData;
    const el = document.createElement('div');
    el.className = 'jwin vwin';
    el.style.cssText = 'position:absolute;left:20%;right:20%;top:24%;padding:22px 24px;text-align:center;z-index:7;animation:pop .25s ease-out';
    let lvTxt = '';
    const seen = new Set();
    v.levels.forEach(l => { if (!seen.has(l.name)) { seen.add(l.name); lvTxt += `<div style="color:#ffd75e;font-weight:700;margin-top:4px">⬆ ${l.name} ¡sube al siguiente nivel!</div>`; } });
    v.levels.filter(l=>l.skill).forEach(l => { lvTxt += `<div style="color:#8ff0a0">✦ ${l.name} aprende ${SKILLS[l.skill].name}!</div>`; });
    el.innerHTML = `
      <div class="vic-title">¡VICTORIA!</div>
      <div class="title-ornament" style="margin:10px auto;width:70%"><i></i><span>✦</span><i></i></div>
      <div style="margin:8px 0 12px;font-size:clamp(14px,3vw,17px)">+${v.exp} EXP · +${v.gold} oro</div>
      ${v.drops.map(d=>`<div style="color:#8fd0ff">🎁 ${ITEMS[d].icon} ${ITEMS[d].name}</div>`).join('')}
      ${lvTxt}
      <div class="blink" style="margin-top:14px;color:#9fb4e8;font-size:14px">Toca la pantalla o pulsa Z para continuar</div>`;
    el.addEventListener('click', () => { if (UI._victoryDone) BattleKey('confirm'); });
    $('ui-layer').appendChild(el);
    this._battleEl = el;
    this._victoryDone = onDone;
  },

  showGameOver() {
    const el = document.createElement('div');
    el.id = 'gameover';
    el.innerHTML = `<div class="go-title">GAME OVER</div>
      <div class="title-ornament" style="margin:12px auto;width:min(280px,70%)"><i></i><span>◆</span><i></i></div>
      <div class="go-sub">Tu grupo cayó... pero los héroes nunca mueren de verdad.</div>
      <div class="blink cta-press" style="margin-top:8px">Toca la pantalla o pulsa Z para volver al título</div>`;
    el.addEventListener('click', () => location.reload());
    document.getElementById('ui-layer').appendChild(el);
  },
};

function roundRect(c, x, y, w, h, r) {
  c.beginPath();
  c.moveTo(x+r, y);
  c.arcTo(x+w, y, x+w, y+h, r);
  c.arcTo(x+w, y+h, x, y+h, r);
  c.arcTo(x, y+h, x, y, r);
  c.arcTo(x, y, x+w, y, r);
  c.closePath();
}

/* ---------- Guardado ---------- */
const Save = {
  save(slot) {
    const data = {
      date: Date.now(),
      mapId: G.mapId, mapName: G.map?.name,
      px: G.player.tx, py: G.player.ty, dir: G.player.dir,
      party: G.party.map(h => ({ id:h.id, name:h.name, lv:h.lv, exp:h.exp, hp:h.hp, mp:h.mp, equip:{...h.equip}, skills:[...h.skills] })),
      gold: G.gold, inventory: {...G.inventory}, flags: {...G.flags},
      quests: G.quests, steps: G.steps, monstersSlain: G.monstersSlain, playtime: G.playtime,
      chests: Object.fromEntries(Object.entries(G.flags).filter(([k])=>k.startsWith('opened_')||k.startsWith('chest_'))),
    };
    localStorage.setItem('aetheria_save_'+slot, JSON.stringify(data));
  },
  load(slot) {
    const raw = localStorage.getItem('aetheria_save_'+slot);
    if (!raw) return false;
    const d = JSON.parse(raw);
    G.gold = d.gold; G.inventory = d.inventory; G.flags = d.flags || {};
    G.quests = d.quests || []; G.steps = d.steps||0; G.monstersSlain = d.monstersSlain||0; G.playtime = d.playtime||0;
    G.party = d.party.map(p => {
      const h = makeHero(p.id, p.lv);
      h.name = p.name || h.name;   // conserva el nombre elegido por el jugador
      h.exp = p.exp; h.hp = Math.max(1, Math.min(p.hp, h.maxHp)); h.mp = Math.min(p.mp, h.maxMp);
      h.equip = p.equip || h.equip; h.skills = p.skills || h.skills;
      return h;
    });
    // triggers "once" se reconstruyen; los cofres ya en flags
    enterMap(d.mapId, d.px, d.py);
    G.player.dir = d.dir || 'down';
    G.dirty = false;
    return true;
  },
  has(slot) { return !!localStorage.getItem('aetheria_save_'+slot); },
};

addEventListener('beforeunload', e => {
  if (G.dirty && ['play','dialog','menu','shop'].includes(G.state)) {
    e.preventDefault();
    e.returnValue = '';
  }
});
