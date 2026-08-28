/* ============================================================
   AETHERIA — Capa mobile-first
   · Escalado responsivo del lienzo + sincronización de la capa UI
   · Gamepad táctil (cruceta + A/B + correr) con multitáctil
   · Puente tap → acciones (mismo enrutador que el teclado)
   · Desbloqueo de audio, pantalla completa, prevención de gestos
   ============================================================ */
'use strict';

/* ---------- Puente tap → acción ----------
   Replica el enrutador de teclado de main.js para que un toque
   virtual se comporte exactamente igual que una tecla. */
function fireVirtual(k) {
  const st = G.state;
  if (st === 'title') Title.input(k);
  else if (st === 'intro') Input.pressed[k] = true;                 // Intro.update hace polling
  else if (st === 'dialog' && $('help-overlay') && !$('help-overlay').classList.contains('hidden')) Help.hide();
  else if (st === 'dialog' && !Dialog.el.classList.contains('hidden')) { if (k === 'confirm') Dialog.advance(); }
  else if (st === 'dialog') Choice.input(k);
  else if (st === 'menu') UI.menuInput(k);
  else if (st === 'shop') Shop.input(k);
  else if (st === 'battle') BattleKey(k);
  else if (st === 'gameover') { if (k === 'confirm') location.reload(); }
  else if (st === 'ending') { if (k === 'confirm' && Ending.t > 6) location.reload(); }
  else Input.pressed[k] = true;                                     // play/transition/etc. → polling
}

/* ---------- Escalado y disposición responsiva ---------- */
const Mobile = {
  portrait: false,

  fit() {
    const vv = window.visualViewport;
    const vw = vv ? vv.width : innerWidth;
    const vh = vv ? vv.height : innerHeight;
    const s = Math.min(vw / 960, vh / 540);
    const stage = $('stage');
    stage.style.transform = `scale(${s})`;

    this.portrait = vh > vw;
    document.body.classList.toggle('portrait', this.portrait);
    document.body.classList.toggle('landscape', !this.portrait);

    // La capa UI se dibuja a resolución nativa: en horizontal cubre el
    // rectángulo visual del lienzo; en retrato, todo el viewport.
    const ui = $('ui-layer');
    const r = stage.getBoundingClientRect();
    if (this.portrait) {
      ui.style.left = '0'; ui.style.top = '0';
      ui.style.width = '100%'; ui.style.height = '100%';
    } else {
      ui.style.left = r.left + 'px'; ui.style.top = r.top + 'px';
      ui.style.width = r.width + 'px'; ui.style.height = r.height + 'px';
    }
    document.documentElement.style.setProperty('--stage-bottom', r.bottom + 'px');
  },

  init() {
    // Detección de pantalla táctil (el puntero grueso manda)
    const coarse = matchMedia('(pointer:coarse)').matches;
    const fine = matchMedia('(pointer:fine)').matches;
    const isTouch = coarse || (!fine && ('ontouchstart' in window || navigator.maxTouchPoints > 0));
    if (isTouch) document.body.classList.add('has-gamepad');

    // Eventos de disposición
    addEventListener('resize', () => this.fit());
    addEventListener('orientationchange', () => { this.fit(); setTimeout(() => this.fit(), 150); });
    if (window.visualViewport) {
      visualViewport.addEventListener('resize', () => this.fit());
      visualViewport.addEventListener('scroll', () => this.fit());
    }
    this.fit();

    // Desbloqueo de audio con el primer gesto
    document.addEventListener('pointerdown', () => AudioSys.resume(), { capture: true, passive: true });

    // Prevención de gestos del navegador
    document.addEventListener('contextmenu', e => { if (!e.target.closest('input,textarea')) e.preventDefault(); });
    document.addEventListener('gesturestart', e => e.preventDefault());
    document.addEventListener('dblclick', e => { if (!e.target.closest('input')) e.preventDefault(); });

    TouchUI.init();
  },
};

/* ---------- Gamepad táctil ---------- */
const TouchUI = {
  init() {
    const dpad = $('gp-dpad');
    let dpadPointer = null;

    const dirFromEvent = e => {
      const r = dpad.getBoundingClientRect();
      const dx = e.clientX - (r.left + r.width / 2);
      const dy = e.clientY - (r.top + r.height / 2);
      const dead = r.width * 0.13;
      if (Math.abs(dx) < dead && Math.abs(dy) < dead) return null;
      if (Math.abs(dx) > Math.abs(dy)) return dx > 0 ? 'right' : 'left';
      return dy > 0 ? 'down' : 'up';
    };
    const setDir = d => {
      if (Input.touchDir === d) return;
      Input.touchDir = d;
      dpad.querySelectorAll('.gp-pad').forEach(p => p.classList.toggle('lit', p.dataset.dir === d));
      if (d) AudioSys.resume();
    };

    dpad.addEventListener('pointerdown', e => {
      dpadPointer = e.pointerId;
      try { dpad.setPointerCapture(e.pointerId); } catch (err) {}
      setDir(dirFromEvent(e));
      e.preventDefault();
    });
    dpad.addEventListener('pointermove', e => {
      if (e.pointerId !== dpadPointer) return;
      setDir(dirFromEvent(e));
    });
    const releaseDir = e => {
      if (e.pointerId !== dpadPointer) return;
      dpadPointer = null;
      setDir(null);
    };
    dpad.addEventListener('pointerup', releaseDir);
    dpad.addEventListener('pointercancel', releaseDir);

    // Botones A (confirmar) y B (cancelar/menú)
    const bindAction = (el, action) => {
      el.addEventListener('pointerdown', e => {
        e.preventDefault();
        AudioSys.resume();
        fireVirtual(action);
      });
    };
    bindAction($('gp-a'), 'confirm');
    bindAction($('gp-b'), 'cancel');

    // Correr: alternar (más cómodo que mantener pulsado en móvil)
    $('gp-run').addEventListener('pointerdown', e => {
      e.preventDefault();
      AudioSys.resume();
      Input.runLock = !Input.runLock;
      $('gp-run').classList.toggle('on', Input.runLock);
    });

    // Toque en el escenario = aceptar (avanza diálogos, combate, cinemáticas)
    const stageTap = e => {
      if (e.target && e.target.closest && e.target.closest('#gamepad')) return;
      fireVirtual('confirm');
    };
    $('stage').addEventListener('pointerup', stageTap);
    $('game-wrap').addEventListener('pointerup', e => {
      if (e.target === $('game-wrap') || e.target === $('stage') || e.target.id === 'game') stageTap(e);
    });

    // Toque en el cuadro de diálogo = avanzar
    $('dialog').addEventListener('pointerdown', e => {
      e.preventDefault();
      if (!Dialog.el.classList.contains('hidden')) Dialog.advance();
    });

    // Pantalla completa (donde el navegador lo permita)
    $('fs-btn').addEventListener('click', async () => {
      try {
        if (document.fullscreenElement) await document.exitFullscreen();
        else {
          await document.documentElement.requestFullscreen();
          if (screen.orientation && screen.orientation.lock) screen.orientation.lock('landscape').catch(() => {});
        }
      } catch (err) { /* iOS Safari: sin soporte → se ignora */ }
    });

    // Descartar aviso de rotación
    $('rotate-close').addEventListener('click', e => {
      e.stopPropagation();
      $('rotate-hint').classList.add('dismissed');
    });
  },
};

Mobile.init();
