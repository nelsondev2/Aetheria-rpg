/* ============================================================
   AETHERIA — Motor de audio chiptune (WebAudio, sin archivos)
   Secuenciador simple con canales square/triangle/noise + SFX
   ============================================================ */
'use strict';

const AudioSys = (() => {
  let ctx = null, masterGain = null, musicGain = null, sfxGain = null;
  let currentTrack = null, seqTimer = null, muted = false;

  const NOTE = (() => {
    const names = ['C','C#','D','D#','E','F','F#','G','G#','A','A#','B'];
    const map = {};
    for (let oct = 1; oct <= 7; oct++)
      names.forEach((n, i) => { map[n + oct] = 440 * Math.pow(2, (oct * 12 + i - 57) / 12); });
    map['-'] = 0;
    return map;
  })();

  function init() {
    if (ctx) return;
    ctx = new (window.AudioContext || window.webkitAudioContext)();
    masterGain = ctx.createGain(); masterGain.gain.value = 0.55; masterGain.connect(ctx.destination);
    musicGain = ctx.createGain(); musicGain.gain.value = 0.5; musicGain.connect(masterGain);
    sfxGain = ctx.createGain(); sfxGain.gain.value = 0.8; sfxGain.connect(masterGain);
  }

  function resume() { init(); if (ctx.state === 'suspended') ctx.resume(); }

  // ---------- osciladores ----------
  function playTone(freq, t0, dur, type, vol, dest, slide) {
    const o = ctx.createOscillator(), g = ctx.createGain();
    o.type = type; o.frequency.setValueAtTime(freq, t0);
    if (slide) o.frequency.exponentialRampToValueAtTime(Math.max(30, freq * slide), t0 + dur);
    g.gain.setValueAtTime(0, t0);
    g.gain.linearRampToValueAtTime(vol, t0 + 0.008);
    g.gain.setValueAtTime(vol, t0 + dur * 0.6);
    g.gain.exponentialRampToValueAtTime(0.001, t0 + dur);
    o.connect(g); g.connect(dest || sfxGain);
    o.start(t0); o.stop(t0 + dur + 0.02);
  }

  function playNoise(t0, dur, vol, dest, freq) {
    const len = Math.max(1, (dur * ctx.sampleRate) | 0);
    const buf = ctx.createBuffer(1, len, ctx.sampleRate);
    const d = buf.getChannelData(0);
    for (let i = 0; i < len; i++) d[i] = Math.random() * 2 - 1;
    const src = ctx.createBufferSource(); src.buffer = buf;
    const f = ctx.createBiquadFilter(); f.type = 'bandpass'; f.frequency.value = freq || 2000; f.Q.value = 0.6;
    const g = ctx.createGain();
    g.gain.setValueAtTime(vol, t0);
    g.gain.exponentialRampToValueAtTime(0.001, t0 + dur);
    src.connect(f); f.connect(g); g.connect(dest || sfxGain);
    src.start(t0); src.stop(t0 + dur);
  }

  // ---------- SFX ----------
  const SFX = {
    cursor: () => playTone(880, ctx.currentTime, 0.05, 'square', 0.15),
    confirm: () => { const t = ctx.currentTime; playTone(660, t, .06, 'square', .18); playTone(990, t + .06, .09, 'square', .18); },
    cancel: () => { const t = ctx.currentTime; playTone(440, t, .07, 'square', .16, null, .6); },
    hit: () => { const t = ctx.currentTime; playNoise(t, .12, .35, null, 900); playTone(180, t, .1, 'sawtooth', .22, null, .5); },
    crit: () => { const t = ctx.currentTime; playNoise(t, .18, .45, null, 1400); playTone(90, t, .18, 'sawtooth', .3, null, .4); playTone(1400, t+.02, .1, 'square', .12); },
    heal: () => { const t = ctx.currentTime; [523,659,784,1047].forEach((f,i)=>playTone(f, t+i*.07, .12, 'triangle', .2)); },
    buff: () => { const t = ctx.currentTime; [392,523,659].forEach((f,i)=>playTone(f, t+i*.06, .1, 'square', .15)); },
    fire: () => { const t = ctx.currentTime; playNoise(t, .3, .4, null, 600); playTone(220, t, .25, 'sawtooth', .2, null, .3); },
    ice: () => { const t = ctx.currentTime; [1319,1568,2093].forEach((f,i)=>playTone(f, t+i*.05, .1, 'triangle', .16)); playNoise(t, .2, .15, null, 6000); },
    thunder: () => { const t = ctx.currentTime; playNoise(t, .35, .5, null, 2500); playTone(70, t, .3, 'sawtooth', .3, null, .5); },
    dark: () => { const t = ctx.currentTime; playTone(110, t, .5, 'sawtooth', .22, null, 2.2); playNoise(t+.1, .3, .2, null, 400); },
    holy: () => { const t = ctx.currentTime; [1047,1319,1568,2093].forEach((f,i)=>playTone(f, t+i*.08, .2, 'triangle', .18)); },
    levelup: () => { const t = ctx.currentTime; [523,659,784,1047,1319].forEach((f,i)=>playTone(f, t+i*.09, .14, 'square', .2)); },
    chest: () => { const t = ctx.currentTime; [392,494,587,784].forEach((f,i)=>playTone(f, t+i*.08, .12, 'square', .18)); },
    door: () => playNoise(ctx.currentTime, .18, .25, null, 500),
    encounter: () => { const t = ctx.currentTime; for (let i=0;i<8;i++) playTone(400+i*180, t+i*.05, .06, 'sawtooth', .2); },
    faint: () => { const t = ctx.currentTime; playTone(392, t, .3, 'square', .2, null, .25); },
    flee: () => { const t = ctx.currentTime; for (let i=0;i<5;i++) playTone(800-i*100, t+i*.06, .05, 'square', .15); },
    coin: () => { const t = ctx.currentTime; playTone(988, t, .07, 'square', .18); playTone(1319, t+.07, .12, 'square', .18); },
  };

  // ---------- Música: secuenciador ----------
  // Cada track: {bpm, loop, channels:[{wave, vol, notes:[[nota,dur],...] }]}
  // n = negra base; las duraciones en corcheas (0.5 = corchea, 1 = negra)
  function n(name, d) { return [name, d]; }

  const TRACKS = {
    title: { bpm: 96, channels: [
      { wave:'square', vol:.16, notes:[
        ['G4',1],['C5',1],['E5',1],['G5',1.5],['E5',.5],['F5',1],['D5',1],
        ['B4',1],['D5',1.5],['C5',1.5],['A4',1],['C5',1],['F5',1],['A5',1.5],['G5',.5],['E5',1],
        ['C5',1],['G4',1],['E5',1],['D5',1.5],['C5',1.5],['-',1]] },
      { wave:'triangle', vol:.22, notes:[
        ['C3',1],['G3',1],['C4',1],['G3',1.5],['A3',.5],['F3',1],['A3',1],
        ['G2',1],['G3',1.5],['C3',1.5],['F3',1],['C4',1],['A3',1],['F3',1.5],['C3',.5],['G3',1],
        ['C4',1],['E3',1],['G3',1],['G2',1.5],['C3',1.5],['-',1]] },
      { wave:'square', vol:.07, notes:[
        ['E5',.5],['G5',.5],['C6',.5],['B5',.5],['G5',.5],['E5',.5],['D5',.5],['E5',.5],
        ['F5',.5],['A5',.5],['D6',.5],['C6',.5],['A5',.5],['F5',.5],['E5',.5],['D5',.5],
        ['E5',.5],['G5',.5],['C6',.5],['B5',.5],['G5',.5],['E5',.5],['D5',.5],['E5',.5],
        ['F5',.5],['E5',.5],['D5',.5],['C5',.5],['G4',.5],['A4',.5],['B4',.5],['C5',.5]] },
    ]},
    village: { bpm: 112, channels: [
      { wave:'square', vol:.15, notes:[
        ['C5',.5],['E5',.5],['G5',1],['E5',.5],['C5',.5],['D5',1],['E5',1],
        ['F5',.5],['A5',.5],['G5',1],['E5',.5],['C5',.5],['G4',2],
        ['A4',.5],['C5',.5],['F5',1],['E5',.5],['C5',.5],['D5',1],['B4',1],
        ['C5',.5],['D5',.5],['E5',.5],['G5',.5],['A5',1],['G5',2]] },
      { wave:'triangle', vol:.22, notes:[
        ['C3',.5],['G3',.5],['E3',1],['C3',.5],['G3',.5],['F3',1],['G3',1],
        ['F3',.5],['C4',.5],['G3',1],['C3',.5],['G3',.5],['G2',2],
        ['F3',.5],['C4',.5],['A3',1],['F3',.5],['C4',.5],['G3',1],['G2',1],
        ['C3',.5],['G3',.5],['C4',.5],['E4',.5],['F3',1],['G2',2]] },
    ]},
    forest: { bpm: 100, channels: [
      { wave:'triangle', vol:.2, notes:[
        ['A4',1],['C5',.5],['E5',1.5],['D5',1],['B4',1],
        ['G4',1],['B4',.5],['D5',1.5],['C5',2],
        ['F4',1],['A4',.5],['C5',1.5],['B4',1],['G4',1],
        ['E4',.5],['G4',.5],['B4',1],['A4',2],['-',1]] },
      { wave:'square', vol:.08, notes:[
        ['E5',.5],['-',.5],['A5',.5],['-',.5],['G5',1],['E5',.5],['D5',.5],
        ['B4',.5],['-',.5],['D5',.5],['-',.5],['E5',2],
        ['C5',.5],['-',.5],['F5',.5],['-',.5],['E5',1],['C5',.5],['B4',.5],
        ['G4',.5],['A4',.5],['B4',.5],['C5',.5],['A4',2],['-',1]] },
    ]},
    cave: { bpm: 84, channels: [
      { wave:'triangle', vol:.22, notes:[
        ['D3',1.5],['A3',.5],['F3',1],['D3',1],['C3',1.5],['G3',.5],['E3',1],['C3',1],
        ['B2',1.5],['F3',.5],['D3',1],['B2',1],['A2',2],['-',2]] },
      { wave:'sine', vol:.14, notes:[
        ['D5',.5],['-',1.5],['A4',.5],['-',.5],['F4',.5],['-',1.5],
        ['C5',.5],['-',1.5],['G4',.5],['-',.5],['E4',.5],['-',1.5],
        ['B4',.5],['-',1.5],['F4',.5],['-',.5],['D4',.5],['-',3.5]] },
    ]},
    castle: { bpm: 92, channels: [
      { wave:'sawtooth', vol:.12, notes:[
        ['E3',.5],['E3',.5],['G3',.5],['E3',.5],['B3',1],['A3',1],
        ['D3',.5],['D3',.5],['F3',.5],['D3',.5],['A3',1],['G3',1],
        ['C3',.5],['C3',.5],['E3',.5],['C3',.5],['G3',1],['F3',1],
        ['B2',.5],['D3',.5],['F3',.5],['B3',.5],['A3',1],['G3',1.5],['F3',.5]] },
      { wave:'triangle', vol:.22, notes:[
        ['E2',1],['E2',1],['E2',.5],['D2',.5],['C2',2],
        ['D2',1],['D2',1],['D2',.5],['C2',.5],['B1',2],
        ['C2',1],['C2',1],['C2',.5],['B1',.5],['A1',2],
        ['G1',1],['B1',1],['D2',1],['E2',2]] },
    ]},
    battle: { bpm: 148, channels: [
      { wave:'square', vol:.15, notes:[
        ['A4',.5],['A4',.5],['C5',.5],['E5',.5],['A5',1],['G5',.5],['E5',.5],
        ['F5',.5],['E5',.5],['D5',.5],['C5',.5],['B4',1],['E4',1],
        ['A4',.5],['A4',.5],['C5',.5],['E5',.5],['A5',1],['G5',.5],['E5',.5],
        ['F5',.5],['G5',.5],['A5',.5],['B5',.5],['C6',2]] },
      { wave:'triangle', vol:.24, notes:[
        ['A2',.5],['A2',.5],['A2',.5],['A2',.5],['F2',.5],['F2',.5],['G2',.5],['G2',.5],
        ['C3',.5],['C3',.5],['G2',.5],['G2',.5],['E2',.5],['E2',.5],['E2',.5],['E2',.5],
        ['A2',.5],['A2',.5],['A2',.5],['A2',.5],['F2',.5],['F2',.5],['G2',.5],['G2',.5],
        ['C3',.5],['E3',.5],['G3',.5],['G2',.5],['A2',2]] },
      { wave:'square', vol:.06, notes:[
        ['E5',.25],['-',.25],['E5',.25],['-',.25],['A5',.25],['-',.25],['C6',.25],['-',.25],
        ['B5',.5],['A5',.5],['G5',.5],['E5',.5],
        ['F5',.25],['-',.25],['F5',.25],['-',.25],['A5',.25],['-',.25],['D6',.25],['-',.25],
        ['C6',.5],['B5',.5],['A5',.5],['E5',.5],
        ['E5',.25],['-',.25],['E5',.25],['-',.25],['A5',.25],['-',.25],['C6',.25],['-',.25],
        ['B5',.5],['A5',.5],['G5',.5],['E5',.5],
        ['F5',.25],['G5',.25],['A5',.25],['B5',.25],['C6',.5],['E6',.5],['A5',1]] },
    ]},
    boss: { bpm: 160, channels: [
      { wave:'sawtooth', vol:.13, notes:[
        ['D4',.5],['D4',.25],['D4',.25],['D4',.5],['F4',.5],['A4',1],
        ['G4',.5],['F4',.5],['E4',.5],['D4',.5],['C#4',1],['E4',1],
        ['D4',.5],['D4',.25],['D4',.25],['D4',.5],['F4',.5],['A4',1],
        ['B4',.5],['A4',.5],['G4',.5],['F4',.5],['E4',2]] },
      { wave:'triangle', vol:.26, notes:[
        ['D2',.5],['D2',.5],['D2',.5],['D2',.5],['D2',.5],['C2',.5],['B1',.5],['C2',.5],
        ['A1',.5],['A1',.5],['A1',.5],['A1',.5],['A1',.5],['G1',.5],['A1',.5],['A1',.5],
        ['D2',.5],['D2',.5],['D2',.5],['D2',.5],['D2',.5],['C2',.5],['B1',.5],['C2',.5],
        ['B1',.5],['B1',.5],['C2',.5],['C2',.5],['D2',2]] },
    ]},
    victory: { bpm: 120, loop: false, channels: [
      { wave:'square', vol:.18, notes:[
        ['C5',.33],['C5',.33],['C5',.33],['C5',1.5],['A4',.5],['B4',.5],['C5',.5],['B4',.5],['C5',.5],['D5',1],
        ['E5',.33],['E5',.33],['E5',.33],['E5',1.5],['C5',.5],['D5',.5],['E5',.5],['D5',.5],['E5',.5],['F5',1],
        ['G5',.66],['E5',.66],['C5',.66],['G5',1.5],['E5',.5],['F5',.5],['G5',.5],['F5',.5],['E5',.5],['D5',1],
        ['C5',.5],['D5',.5],['E5',.5],['F5',.5],['E5',.5],['D5',.5],['C5',2]] },
      { wave:'triangle', vol:.24, notes:[
        ['C3',.33],['C3',.33],['C3',.33],['F3',1.5],['F3',.5],['G3',.5],['C4',.5],['G3',.5],['C4',.5],['G3',1],
        ['C4',.33],['C4',.33],['C4',.33],['C4',1.5],['C4',.5],['G3',.5],['C4',.5],['G3',.5],['C4',.5],['A3',1],
        ['G3',.66],['C4',.66],['E4',.66],['G3',1.5],['C4',.5],['A3',.5],['G3',.5],['F3',.5],['E3',.5],['D3',1],
        ['C3',.5],['G3',.5],['C4',.5],['F3',.5],['G3',.5],['G2',.5],['C3',2]] },
    ]},
    sad: { bpm: 76, channels: [
      { wave:'triangle', vol:.2, notes:[
        ['A4',1.5],['G4',.5],['E4',1],['D4',1],['C4',1.5],['D4',.5],['E4',2],
        ['F4',1.5],['E4',.5],['D4',1],['C4',1],['B3',1.5],['A3',.5],['B3',2],
        ['A4',1.5],['G4',.5],['E4',1],['G4',1],['F4',1.5],['E4',.5],['D4',2],
        ['E4',1],['C4',1],['D4',1],['B3',1],['A3',3]] },
    ]},
    ending: { bpm: 104, channels: [
      { wave:'square', vol:.15, notes:[
        ['G4',1],['C5',1],['E5',1],['G5',2],['F5',1],['E5',1],
        ['D5',1],['F5',1],['A5',1],['G5',2],['E5',1],['C5',1],
        ['D5',1],['E5',1],['F5',1],['D5',2],['B4',1],['G4',1],
        ['C5',1],['E5',1],['G5',1],['C6',3]] },
      { wave:'triangle', vol:.24, notes:[
        ['C3',1],['G3',1],['E3',1],['C3',2],['F3',1],['C4',1],
        ['G3',1],['D4',1],['B3',1],['G3',2],['C4',1],['G3',1],
        ['A3',1],['F3',1],['D3',1],['F3',2],['G3',1],['G2',1],
        ['C3',1],['G3',1],['E3',1],['C3',3]] },
    ]},
  };

  function stopMusic() {
    if (seqTimer) { clearTimeout(seqTimer); seqTimer = null; }
    currentTrack = null;
  }

  function playTrack(name) {
    resume();
    if (currentTrack === name) return;
    stopMusic();
    const track = TRACKS[name];
    if (!track) return;
    currentTrack = name;
    const beat = 60 / track.bpm;           // negra
    const eighth = beat / 2;

    function schedule() {
      if (currentTrack !== name) return;
      let total = 0;
      const t0 = ctx.currentTime + 0.05;
      track.channels.forEach(ch => {
        let t = t0;
        ch.notes.forEach(([note, dur]) => {
          const f = NOTE[note];
          if (f) playTone(f, t, dur * eighth * 0.92, ch.wave, ch.vol, musicGain);
          t += dur * eighth;
        });
        total = Math.max(total, t - t0);
      });
      seqTimer = setTimeout(() => { if (track.loop !== false) schedule(); else currentTrack = null; }, (total + 0.25) * 1000);
    }
    schedule();
  }

  function sfx(name) { resume(); if (SFX[name]) SFX[name](); }
  function toggleMute() { muted = !muted; if (masterGain) masterGain.gain.value = muted ? 0 : 0.55; return muted; }

  return { resume, playTrack, stopMusic, sfx, toggleMute };
})();
