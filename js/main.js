/* ============================================================
   AETHERIA — Estados, título, cinemáticas y eventos
   ============================================================ */
'use strict';

/* ---------- Ayuda / controles ---------- */
const Help = {
  onDone: null,
  show(onDone) {
    const el = $('help-overlay');
    if (!el) { if (onDone) onDone(); return; }
    this.onDone = onDone || null;
    G.state = 'dialog';
    el.classList.remove('hidden');
    el.onclick = () => Help.hide();
  },
  hide() {
    const el = $('help-overlay');
    if (el) el.classList.add('hidden');
    G.state = 'play';
    const f = this.onDone; this.onDone = null;
    if (f) f();
  },
};

/* ---------- Título ---------- */
const Title = {
  sel: 0, options: [],
  show() {
    G.state = 'title';
    $('title-screen').classList.remove('hidden');
    $('title-menu').classList.add('hidden');
    $('title-press').classList.remove('hidden');
    AudioSys.playTrack('title');
    this.mode = 'press';
    this.sel = 0;
    // partículas de pétalos
    setInterval(() => {
      if (G.state !== 'title') return;
      Particles.spawn({ x:rand(0,canvas.width), y:-10, vx:rand(-20,20), vy:rand(30,70), life:rand(4,7), size:rand(2,4), color:pick(['#ffb7d5','#ffd75e','#fff','#cfe0ff']) });
    }, 180);
  },
  buildMenu() {
    this.mode = 'menu';
    $('title-press').classList.add('hidden');
    const cont = Save.has(0) || Save.has(1) || Save.has(2);
    this.options = cont ? ['Nueva Partida', 'Continuar', 'Créditos'] : ['Nueva Partida', 'Créditos'];
    const icons = { 'Nueva Partida':'⚔️', 'Continuar':'💾', 'Créditos':'✦' };
    $('title-menu').innerHTML = this.options.map((o,i) =>
      `<div class="choice ${i===this.sel?'sel':''}" data-i="${i}">${icons[o]||'·'}  ${o}</div>`).join('');
    // Táctil: tocar una opción la selecciona y la confirma
    $('title-menu').querySelectorAll('.choice').forEach(el => {
      el.addEventListener('click', () => { this.sel = +el.dataset.i; this.input('confirm'); });
    });
    $('title-menu').classList.remove('hidden');
  },
  input(k) {
    if (this.mode === 'press') {
      if (k==='confirm') { AudioSys.sfx('confirm'); this.buildMenu(); }
      return;
    }
    if (this.mode === 'load') return this.loadInput(k);
    if (this.mode === 'credits') { if (k==='confirm'||k==='cancel') this.buildMenu(); return; }
    const n = this.options.length;
    if (k==='up') { this.sel = (this.sel+n-1)%n; AudioSys.sfx('cursor'); }
    if (k==='down') { this.sel = (this.sel+1)%n; AudioSys.sfx('cursor'); }
    if (k==='confirm') {
      AudioSys.sfx('confirm');
      const opt = this.options[this.sel];
      if (opt==='Nueva Partida') Intro.start();
      else if (opt==='Continuar') this.showLoad();
      else if (opt==='Créditos') this.showCredits();
    }
  },
  showLoad() {
    let html = '<div style="margin-bottom:10px;color:#ffd75e;font-weight:700">Elige una partida</div>';
    this._slots = [];
    for (let i=0;i<3;i++) {
      const raw = localStorage.getItem('aetheria_save_'+i);
      let info = '— Vacío —';
      if (raw) { try { const d = JSON.parse(raw); info = `${d.party[0].name} Nv.${d.party[0].lv} · ${d.mapName||''}`; this._slots.push(i); } catch(e){} }
      html += `<div class="choice ${this._loadSel===i?'sel':''}" data-slot="${i}">Ranura ${i+1} <small style="color:#9fb4e8">${info}</small></div>`;
    }
    this.mode = 'load';
    this._loadSel = this._slots[0] ?? 0;
    $('title-menu').innerHTML = html;
    // Táctil: tocar una ranura la selecciona y la carga
    $('title-menu').querySelectorAll('.choice[data-slot]').forEach(el => {
      el.addEventListener('click', () => { this._loadSel = +el.dataset.slot; this.loadInput('confirm'); });
    });
    const first = $('title-menu').querySelector('.choice');
    if (first && this._slots.length) first.classList.add('sel');
  },
  showCredits() {
    $('title-menu').innerHTML = `<div id="credits-view" style="font-size:14px;line-height:1.75;color:#cfe0ff">
      <b style="color:#ffd75e;font-family:Palatino,Georgia,serif;letter-spacing:1px">AETHERIA</b><br>
      <span style="color:#9fb4e8;font-size:12px;letter-spacing:2px">CRÓNICAS DE OTRO MUNDO</span><br><br>
      Un JRPG de fantasía isekai.<br><br>
      Sprites: Charles Gabriel &amp; Antifarea<br><span style="color:#9fb4e8;font-size:12px">OpenGameArt, CC-BY 3.0</span><br><br>
      Tilesets: Lanea Zimmerman “Sharm”<br><span style="color:#9fb4e8;font-size:12px">Tiny32 / Tiny16 · CC-BY / CC0</span><br><br>
      Ilustraciones de escenas: IA<br>
      Música y efectos: chiptune WebAudio<br><br>
      <span class="blink" style="color:#fff">Z o toque para volver</span></div>`;
    $('credits-view').addEventListener('click', () => this.buildMenu());
    this.mode = 'credits';
  },
  loadInput(k) {
    const raw = localStorage.getItem('aetheria_save_'+this._loadSel);
    if (k==='confirm' && raw) {
      AudioSys.sfx('confirm');
      $('title-screen').classList.add('hidden');
      UI.hideAll();
      if (Save.load(this._loadSel)) { G.state = 'play'; }
    }
    if (k==='cancel') this.buildMenu();
    if (k==='up'||k==='down') {
      const idx = this._slots.indexOf(this._loadSel);
      const n = this._slots.length;
      if (n) { this._loadSel = this._slots[(idx + (k==='down'?1:n-1))%n]; AudioSys.sfx('cursor'); }
      this.showLoad();
      this._slots.forEach((s,i)=>{ const el=$('title-menu').children[i+1]; if(el) el.classList.toggle('sel', s===this._loadSel); });
    }
  },
};

/* ---------- Cinemáticas ---------- */
const Intro = {
  scenes: [], idx: 0, alpha: 0, phase: 'in', text: '', textIdx: 0,
  start() {
    G.state = 'intro';
    $('title-screen').classList.add('hidden');
    this.scenes = [
      { bg:'cut_home', name:'Mundo Real', lines:[
        'Año 2042. La vida pasa entre clases, exámenes y el ruido de la ciudad.',
        'Alex vuelve a casa como cualquier otro tarde...',
        'Pero hoy, el aire huele distinto. La luna parece... observar.' ] },
      { bg:'cut_summon', name:'El Llamado', lines:[
        'Un círculo de luz dorada se abre bajo tus pies. ¡El mundo se disuelve!',
        'Una voz infinita resuena: "Héroe de otro mundo... escucha nuestro llamado."',
        '"El Reino de Aetheria perece bajo la sombra del Rey Demonio Vorthak."',
        '"Recibe nuestra bendición... y salva este mundo, Alex."' ] },
      { bg:'title_bg', name:'Reino de Aetheria', lines:[
        'Despiertas en el Templo de Lumina. La Hermana Mirena te acoge con asombro.',
        'La profecía se cumple: el Invocado ha llegado.',
        'Tu leyenda en otro mundo... ¡comienza ahora!' ] },
    ];
    this.idx = 0; this.phase = 'in'; this.alpha = 0;
    this.text = ''; this.textIdx = 0; this.lineIdx = 0;
    AudioSys.playTrack('sad');
  },
  update(dt) {
    const sc = this.scenes[this.idx];
    if (this.phase==='in') { this.alpha += dt*0.8; if (this.alpha>=1) { this.alpha=1; this.phase='text'; this.lineIdx=0; this.textIdx=0; } }
    else if (this.phase==='text') {
      const line = sc.lines[this.lineIdx];
      this.textIdx += dt*38;
      this.text = line.slice(0, Math.floor(this.textIdx));
      if (Input.hit('confirm')) {
        if (this.textIdx < line.length) this.textIdx = line.length;
        else {
          this.lineIdx++;
          if (this.lineIdx >= sc.lines.length) { this.phase='out'; }
          else this.textIdx = 0;
        }
      }
    }
    else if (this.phase==='out') {
      this.alpha -= dt*0.9;
      if (this.alpha<=0) {
        this.idx++;
        if (this.idx >= this.scenes.length) this.finish();
        else { this.phase='in'; this.alpha=0; AudioSys.playTrack(this.idx===1?'cave':'title'); }
      }
    }
  },
  render() {
    const c = ctx2d;
    c.fillStyle = '#000'; c.fillRect(0,0,canvas.width,canvas.height);
    const sc = this.scenes[this.idx];
    const im = Assets.img(sc.bg);
    if (im) {
      const s = Math.max(canvas.width/im.width, canvas.height/im.height);
      const w = im.width*s, h = im.height*s;
      c.globalAlpha = this.alpha;
      c.drawImage(im, (canvas.width-w)/2, (canvas.height-h)/2, w, h);
      c.globalAlpha = 1;
    }
    // franja inferior
    if (this.phase==='text') {
      c.fillStyle = 'rgba(8,10,26,.88)';
      c.fillRect(0, canvas.height-138, canvas.width, 138);
      c.strokeStyle = '#f0d78c'; c.lineWidth = 1.5;
      c.beginPath(); c.moveTo(40, canvas.height-137); c.lineTo(canvas.width-40, canvas.height-137); c.stroke();
      c.fillStyle = '#ffd75e'; c.font = '700 15px Palatino, Georgia, serif';
      c.fillText('✦  ' + sc.name + '  ✦', 60, canvas.height-108);
      c.fillStyle = '#fff'; c.font = '400 20px sans-serif';
      // wrap
      const words = this.text.split(' ');
      let line = '', y = canvas.height-70;
      for (const w of words) {
        if (c.measureText(line+w).width > canvas.width-120) { c.fillText(line, 60, y); y += 30; line = w+' '; }
        else line += w+' ';
      }
      c.fillText(line, 60, y);
    }
    c.fillStyle = `rgba(0,0,0,${1-this.alpha})`;
    c.fillRect(0,0,canvas.width,canvas.height);
  },
  finish() {
    // elegir nombre
    $('title-screen').classList.remove('hidden');
    $('title-menu').classList.add('hidden');
    $('title-bg').src = 'assets/bg/title_bg.png';
    $('title-logo').style.display = 'none';
    const ne = document.createElement('div');
    ne.id = 'name-entry'; ne.className = 'jwin';
    ne.innerHTML = `<div class="ne-q">La Diosa te bendice. ¿Cómo te llamarás, héroe?</div>
      <input id="hero-name" maxlength="10" value="Alex" autocomplete="off">
      <div style="margin-top:10px"><button id="hero-name-ok" class="ne-ok">Comenzar la leyenda</button></div>`;
    document.getElementById('ui-layer').appendChild(ne);
    $('hero-name').focus();
    $('hero-name-ok').onclick = () => {
      const name = $('hero-name').value.trim() || 'Alex';
      ne.remove();
      $('title-screen').classList.add('hidden');
      $('title-logo').style.display = '';
      startNewGame(name);
    };
    G.state = 'nameentry';
  },
};

const Ending = {
  t: 0, started: false,
  start() {
    G.state = 'ending';
    this.t = 0;
    AudioSys.playTrack('ending');
    UI.hideAll();
  },
  update(dt) { this.t += dt; },
  render() {
    const c = ctx2d;
    const im = Assets.img('cut_ending');
    if (im) {
      const s = Math.max(canvas.width/im.width, canvas.height/im.height);
      c.drawImage(im, (canvas.width-im.width*s)/2, (canvas.height-im.height*s)/2, im.width*s, im.height*s);
    }
    const a = clamp(this.t-1, 0, 1);
    if (a>0) {
      c.globalAlpha = a;
      c.fillStyle = 'rgba(8,10,26,.85)';
      c.fillRect(0, canvas.height/2-110, canvas.width, 220);
      c.textAlign = 'center';
      c.fillStyle = '#ffd75e'; c.font = '700 34px Palatino, Georgia, serif';
      c.fillText('¡AETHERIA ES LIBRE!', canvas.width/2, canvas.height/2-58);
      c.fillStyle = '#fff'; c.font = '400 19px sans-serif';
      const qn = (G.quests || []).filter(q => q.done).length;
      const good = qn >= 3 || (G.flags.slimeClaimed && G.flags.flowerTurned && G.flags.relicTurned);
      const lines = good ? [
        `El Rey Demonio Vorthak ha caído. Las sombras se disuelven como niebla al alba.`,
        `Cumpliste cada promesa: el camino, la flor, la reliquia. Lumina te llama salvador.`,
        `Los pueblos cantan tu nombre, ${G.party[0].name}, Héroe Invocado.`,
        `Y en algún lugar entre dos mundos... una nueva leyenda nace.`,
        `★ FINAL BUENO — ¡Gracias por jugar AETHERIA!`,
      ] : [
        `El Rey Demonio Vorthak ha caído. Las sombras se disuelven como niebla al alba.`,
        `Aetheria es libre... aunque algunas promesas quedaron sin cumplir.`,
        `Los pueblos recuerdan tu espada, ${G.party[0].name}. La leyenda, a medias.`,
        ``,
        `FINAL — ¡Gracias por jugar AETHERIA — Crónicas de Otro Mundo!`,
      ];
      lines.forEach((l,i) => c.fillText(l, canvas.width/2, canvas.height/2-16+i*30));
      if (this.t > 6) {
        c.fillStyle = '#9fb4e8'; c.font = '400 15px sans-serif';
        c.fillText('Z — volver al título', canvas.width/2, canvas.height-24);
      }
      c.globalAlpha = 1;
    }
  },
};

/* ---------- Eventos de la historia ---------- */
const Events = {
  run(evOrTrigger) {
    if (typeof evOrTrigger === 'object') {
      const tr = evOrTrigger;
      if (tr.boss) return this.bossIntro(tr);
      if (tr.event) return this.run(tr.event);
      return;
    }
    const fn = this['ev_' + evOrTrigger];
    if (fn) fn.call(this);
  },

  bossIntro(tr) {
    G.flags[tr.boss + 'Fight'] = true;
    G.flags['bossFight'] = true;
    Dialog.say(tr.intro, { face:null, name:'¡Amenaza!', onDone: () => {
      G.flags['bossFight'] = false;
      const post = () => {
        G.flags[tr.boss+'Down'] = true;
        markDirty();
        if (tr.boss === 'bossFinal') { G.flags['gameWon'] = true; Ending.start(); return; }
        if (tr.event) this.run(tr.event);
      };
      Battle.start([{ key: tr.boss }], { boss:true });
      Battle.postVictory = post;
    }});
  },

  ev_firstEnterVillage() {
    if (G.flags['villageWelcomed']) return;
    G.flags['villageWelcomed'] = true;
    Dialog.say([
      'Aldea de Lumina — el último bastión de luz en el este de Aetheria.',
      'Alcalde Bram te espera en la plaza. ¡Explora y habla con todos!',
      '(A / Z: atacar o hablar · 1-4: magia · Q: poción · X: menú · Shift: correr)',
    ], { face:null, name:'Aldea de Lumina' });
  },

  ev_kiraJoin() {
    const kira = G.map?.npcs.find(n => n.id==='kira');
    if (kira && !G.flags['kiraJoined']) return DialogRunner.run(kira);
    if (!G.flags['kiraJoined']) {
      // La NPC no fue instanciada (bandera aún no existía al construir el mapa)
      const def = MAPS.forest.npcs.find(n => n.id==='kira');
      if (def) DialogRunner.run({ data: def });
    }
  },

  joinHero(id) {
    if (G.party.some(h => h.id===id)) return;
    const lv = Math.max(...G.party.map(h=>h.lv));
    const h = makeHero(id, lv);
    h.lv = lv; h.maxHp = statsOf(h).hp; h.maxMp = statsOf(h).mp; h.hp = h.maxHp; h.mp = h.maxMp;
    G.party.push(h);
    AudioSys.sfx('levelup');
    UI.toast(`✨ ${HEROES[id].name} se une al grupo!`);
    if (typeof Combat !== 'undefined') Combat.syncBar();
  },

  joinKira() {
    const npc = G.map?.npcs.find(n => n.id==='kira');
    if (npc) npc.hidden = true;
  },

  ev_innSleepOffer() {
    DialogRunner.run({ data: { talk:[{ inn:20, say:['¿Descansar? 20 de oro la noche.'] }] } });
  },
  ev_altarOffer() {
    Choice.ask(['💾 Guardar partida', '🏔️ Descansar (gratis, templo)', '✖️ Nada'], sel => {
      if (sel===0) { Save.save(0); UI.toast('💾 ¡Guardado en la ranura 1!'); AudioSys.sfx('chest'); }
      else if (sel===1) { G.party.forEach(h=>{h.hp=h.maxHp;h.mp=h.maxMp;}); AudioSys.sfx('heal'); UI.toast('El grupo se siente renovado.'); }
    });
  },
};

/* ---------- Elecciones ---------- */
const Choice = {
  ask(options, cb) {
    G.state = 'dialog';
    const el = $('choice-box');
    this.sel = 0; this.options = options; this.cb = cb;
    el.innerHTML = options.map((o,i)=>`<div class="choice ${i===0?'sel':''}" data-i="${i}">${o}</div>`).join('');
    // Táctil: tocar una opción la selecciona y la confirma
    el.querySelectorAll('.choice').forEach((c,i)=>c.addEventListener('click', () => {
      this.sel = i; this.input('confirm');
    }));
    el.classList.remove('hidden');
  },
  input(k) {
    const el = $('choice-box');
    const n = this.options.length;
    if (k==='up') { this.sel=(this.sel+n-1)%n; AudioSys.sfx('cursor'); }
    if (k==='down') { this.sel=(this.sel+1)%n; AudioSys.sfx('cursor'); }
    if (k==='cancel') { el.classList.add('hidden'); G.state='play'; return; }
    if (k==='confirm') {
      el.classList.add('hidden');
      G.state='play';
      AudioSys.sfx('confirm');
      this.cb(this.sel);
    } else {
      el.querySelectorAll('.choice').forEach((c,i)=>c.classList.toggle('sel', i===this.sel));
    }
  },
};

/* ---------- Nueva partida ---------- */
function startNewGame(name) {
  HEROES.hero.name = name;          // antes de makeHero para que el héroe nazca con su nombre
  G.gold = 150;
  G.inventory = { potion:3, herb:2 };
  G.flags = { gameStarted:true }; G.quests = []; G.steps = 0; G.monstersSlain = 0; G.playtime = 0;
  G.party = [makeHero('hero', 1)];
  G.mapId = null; G.player = null; G.map = null;
  enterMap('temple', 4, 3);
  G.state = 'play';
  // cinemática breve de bienvenida (solo si el jugador sigue en el templo en pantalla de juego)
  setTimeout(() => {
    if (G.state !== 'play' || G.mapId !== 'temple') return;
    Dialog.say([
      `Hermana Mirena: ¡${name}! Abriste los ojos... La bendición de la Diosa te trajo sano y salvo.`,
      'Hermana Mirena: El Rey Demonio Vorthak ha despertado. La profecía hablaba de ti: el héroe de otro mundo.',
      'Hermana Mirena: El grupo te espera fuera. Ve al norte, cruza el Camino Real y reúne aliados.',
      'Hermana Mirena: (Toca el altar del templo para guardar tu progreso. ¡Que la luz te acompañe!)',
    ], { face:'face_nun', name:'Hermana Mirena' });
  }, 600);
}

/* ---------- Enrutado de input global ----------
   Las teclas consumidas por un estado se eliminan de `pressed` para que
   el polling (updatePlayer/Intro) no las procese otra vez. */
addEventListener('keydown', e => {
  const k = Input.norm(e.key);
  const st = G.state;
  let consumed = true;
  if (st==='title') Title.input(k);
  else if (st==='intro') consumed = false; // se lee por polling en Intro.update
  else if (st==='dialog' && $('help-overlay') && !$('help-overlay').classList.contains('hidden')) Help.hide();
  else if (st==='dialog' && !Dialog.el.classList.contains('hidden')) { if (k==='confirm') Dialog.advance(); }
  else if (st==='dialog') Choice.input(k);
  else if (st==='menu') UI.menuInput(k);
  else if (st==='shop') Shop.input(k);
  else if (st==='battle') BattleKey(k);
  else if (st==='gameover') { if (k==='confirm') location.reload(); }
  else if (st==='ending') { if (k==='confirm' && Ending.t>6) location.reload(); }
  else consumed = false;
  if (consumed) delete Input.pressed[k];
});

function BattleKey(k) {
  const b = Battle;
  // Táctil/teclado: saltar la espera del mensaje en curso
  if (b.phase === 'msg') { if (k === 'confirm') Battle.skipMsg(); return; }
  if (b.phase==='victory' && UI._victoryDone) {
    if (k==='confirm') { const f = UI._victoryDone; UI._victoryDone = null; UI.hideBattle(); f(); }
    return;
  }
  if (b.phase==='cmd') {
    if (k==='up') { b.cmdSel = (b.cmdSel+4)%5; UI.updateBattleCmd(b); AudioSys.sfx('cursor'); }
    if (k==='down') { b.cmdSel = (b.cmdSel+1)%5; UI.updateBattleCmd(b); AudioSys.sfx('cursor'); }
    if (k==='left') { b.cmdSel = (b.cmdSel%2===0)?(b.cmdSel+1)%5:b.cmdSel-1; UI.updateBattleCmd(b); AudioSys.sfx('cursor'); }
    if (k==='right') { b.cmdSel = (b.cmdSel%2===0)?(b.cmdSel+1)%5:b.cmdSel-1; UI.updateBattleCmd(b); AudioSys.sfx('cursor'); }
    if (k==='confirm') {
      AudioSys.sfx('confirm');
      const acts = ['attack','skill','item','guard','flee'];
      const a = acts[b.cmdSel];
      if (a==='attack') b.playerAct({type:'attack'});
      else if (a==='skill') {
        // elegir habilidad
        b.skillList = b.actor.ref.hero.skills;
        b.subSel = 0;
        b.phase = 'skill';
        UI.showBattleSkills(b);
      }
      else if (a==='item') {
        b.itemList = Object.keys(G.inventory).filter(id=>['heal','mp','full','damage','revive','cure'].includes(ITEMS[id].type));
        if (!b.itemList.length) { UI.toast('No tienes objetos utilizables'); return; }
        b.subSel = 0;
        b.phase = 'item';
        UI.showBattleItems(b);
      }
      else b.playerAct({type:a});
    }
    return;
  }
  if (b.phase==='skill') {
    const n = b.skillList.length + 1;
    if (k==='up') { b.subSel=(b.subSel+n-1)%n; AudioSys.sfx('cursor'); UI.showBattleSkills(b); }
    if (k==='down') { b.subSel=(b.subSel+1)%n; AudioSys.sfx('cursor'); UI.showBattleSkills(b); }
    if (k==='cancel') { b.phase='cmd'; UI.showBattleCmd(b); }
    if (k==='confirm') {
      if (b.subSel >= b.skillList.length) { b.phase='cmd'; UI.showBattleCmd(b); return; }
      AudioSys.sfx('confirm');
      b.playerAct({type:'skill', id:b.skillList[b.subSel]});
    }
    return;
  }
  if (b.phase==='item') {
    const n = b.itemList.length + 1;
    if (k==='up') { b.subSel=(b.subSel+n-1)%n; AudioSys.sfx('cursor'); UI.showBattleItems(b); }
    if (k==='down') { b.subSel=(b.subSel+1)%n; AudioSys.sfx('cursor'); UI.showBattleItems(b); }
    if (k==='cancel') { b.phase='cmd'; UI.showBattleCmd(b); }
    if (k==='confirm') {
      if (b.subSel >= b.itemList.length) { b.phase='cmd'; UI.showBattleCmd(b); return; }
      AudioSys.sfx('confirm');
      b.playerAct({type:'item', id:b.itemList[b.subSel]});
    }
    return;
  }
  if (b.phase==='target') {
    const isPartyTarget = b.pendingSkill && ['restore','revive'].includes(SKILLS[b.pendingSkill].type) || (b.pendingItem && ['heal','mp','full','revive','cure'].includes(ITEMS[b.pendingItem].type));
    const targets = isPartyTarget ? b.party.filter(p=>!p.dead || (b.pendingSkill&&SKILLS[b.pendingSkill].type==='revive')) : b.aliveEnemies();
    const n = targets.length;
    if (k==='up'||k==='left') { b.targetSel=(b.targetSel+n-1)%n; AudioSys.sfx('cursor'); UI.updateBattleTargets(b, targets); }
    if (k==='down'||k==='right') { b.targetSel=(b.targetSel+1)%n; AudioSys.sfx('cursor'); UI.updateBattleTargets(b, targets); }
    if (k==='cancel') { b.phase='cmd'; UI.showBattleCmd(b); }
    if (k==='confirm') {
      AudioSys.sfx('confirm');
      const t = targets[b.targetSel];
      b.pendingTarget = t;
      UI.hideBattle();
      if (b.pendingSkill) { const sk = SKILLS[b.pendingSkill]; if (sk.target==='party') b.execSkillParty(b.pendingSkill); else b.execSkill(b.pendingSkill, t); b.pendingSkill = null; }
      else if (b.pendingItem) { b.useItem(b.pendingItem, t); b.pendingItem = null; }
      else { b.execAttack(b.actor.ref, t); }
    }
    return;
  }
}

/* ---------- Boot ---------- */
async function boot() {
  // manifiesto de tiles (fetch falla en file:// → usa copia embebida)
  try {
    const res = await fetch('assets/sprites/tiles_manifest.json');
    manifest.tiles = await res.json();
  } catch(e) {
    console.warn('Usando manifiesto embebido (file://)');
    manifest.tiles = (typeof TILES_MANIFEST !== 'undefined') ? TILES_MANIFEST : {};
  }
  manifest.tiles['water2'] = manifest.tiles['water2'] || manifest.tiles['water1'];

  const paths = {
    atlas: 'assets/sprites/tiles_atlas.png',
    title_bg: 'assets/bg/title_bg.png',
    bb_field: 'assets/bg/bb_field.png', bb_forest: 'assets/bg/bb_forest.png',
    bb_cave: 'assets/bg/bb_cave.png', bb_castle: 'assets/bg/bb_castle.png',
    cut_home: 'assets/bg/cut_home.png', cut_summon: 'assets/bg/cut_summon.png', cut_ending: 'assets/bg/cut_ending.png',
    prop_tree_oak:'assets/sprites/prop_tree_oak.png', prop_tree_pine:'assets/sprites/prop_tree_pine.png',
    prop_tree_autumn:'assets/sprites/prop_tree_autumn.png', prop_tree_small:'assets/sprites/prop_tree_small.png',
    prop_canopy:'assets/sprites/prop_canopy.png', prop_flowers:'assets/sprites/prop_flowers.png',
    prop_mushroom:'assets/sprites/prop_mushroom.png', prop_crystal:'assets/sprites/prop_crystal.png',
    prop_well:'assets/sprites/prop_well.png', prop_throne:'assets/sprites/prop_throne.png',
  };
  // sheets de walk + monstruos usados
  Object.values(HEROES).forEach(h => { paths[h.walk] = 'assets/sprites/'+h.walk+'.png'; });
  // sheets de walk de los NPCs
  Object.values(MAPS).forEach(m => (m.npcs||[]).forEach(n => {
    if (n.walk && !paths[n.walk[0]]) paths[n.walk[0]] = 'assets/sprites/'+n.walk[0]+'.png';
  }));
  Object.values(ENEMIES).forEach(e => paths[e.sprite] = 'assets/sprites/'+e.sprite+'.png');
  // caras usadas
  const faceSet = new Set();
  Object.values(MAPS).forEach(m => (m.npcs||[]).forEach(n => n.face && faceSet.add(n.face)));
  Object.values(HEROES).forEach(h => faceSet.add(h.face));
  faceSet.add('face_nun');
  faceSet.forEach(f => paths[f] = 'assets/sprites/'+f+'.png');
  // casas
  ['house_inn','house_shop','house_temple','house_red_s','house_teal_s','house_green_m','house_blue_m'].forEach(h => paths[h] = 'assets/sprites/'+h+'.png');

  await Assets.load(paths);
  requestAnimationFrame(gameLoop);
  Title.show();

  // click/touch en título (toque o clic para comenzar)
  $('title-screen').addEventListener('pointerdown', () => {
    if (G.state==='title' && Title.mode==='press') { AudioSys.resume(); Title.buildMenu(); }
  });
  // Escalado responsivo (mobile-first) — la lógica vive en touch.js
  Mobile.fit();
}
boot();
