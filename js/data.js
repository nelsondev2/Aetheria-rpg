/* ============================================================
   AETHERIA — Base de datos del juego
   ============================================================ */
'use strict';

/* ---------- HABILIDADES ---------- */
const SKILLS = {
  // Héroe (Alex) — espadachín versátil
  slash:      { name:'Tajo Veloz', mp:4,  type:'phys', power:1.4, target:'enemy', desc:'Un corte rápido que apenas falla.', anim:'slash' },
  courage:    { name:'Grito de Valor', mp:6, type:'buff', stat:'atk', mult:1.35, turns:4, target:'ally', desc:'Aumenta el ATQ de un aliado 4 turnos.', anim:'buff' },
  crossSlash: { name:'Cruz Lunar', mp:12, type:'phys', power:2.1, target:'enemy', desc:'Dos cortes en forma de cruz lunar.', anim:'slash', fx:'holy' },
  heroWave:   { name:'Onda del Héroe', mp:18, type:'phys', power:1.6, target:'all', desc:'Una onda de luz que golpea a todos.', anim:'wave', fx:'holy' },
  awaken:     { name:'Despertar', mp:30, type:'buff', stat:'all', mult:1.4, turns:5, target:'self', desc:'Libera el poder de la invocación.', anim:'buff' },
  // Kira — guerrera
  powerHit:   { name:'Golpe Brutal', mp:5, type:'phys', power:1.7, target:'enemy', desc:'Un mandoble devastador.', anim:'slash' },
  whirlwind:  { name:'Torbellino', mp:10, type:'phys', power:1.25, target:'all', desc:'Gira lanzando cortes a todos los enemigos.', anim:'wave' },
  warCry:     { name:'Rugido de Guerra', mp:6, type:'debuff', stat:'def', mult:0.75, turns:3, target:'enemies', desc:'Reduce la DEF enemiga 3 turnos.', anim:'buff' },
  execution:  { name:'Ejecución', mp:20, type:'phys', power:2.6, target:'enemy', desc:'Letal contra enemigos débiles (x2 si HP<25%).', anim:'slash', execute:true },
  // Elowen — maga
  fireball:   { name:'Bola de Fuego', mp:5, type:'magic', elem:'fire', power:1.5, target:'enemy', desc:'Una esfera ardiente.', anim:'fire' },
  iceLance:   { name:'Lanza de Hielo', mp:6, type:'magic', elem:'ice', power:1.6, target:'enemy', desc:'Perfora con hielo eterno.', anim:'ice' },
  spark:      { name:'Chispa Fulgor', mp:8, type:'magic', elem:'thunder', power:1.3, target:'all', desc:'Rayos que golpean a todos.', anim:'thunder' },
  meteor:     { name:'Llamado Estelar', mp:24, type:'magic', elem:'fire', power:2.0, target:'all', desc:'Lluvia de meteoros sobre el campo.', anim:'meteor' },
  focusMind:  { name:'Mente Serena', mp:5, type:'restore', stat:'mp', value:12, target:'ally', desc:'Restaura 12 PM de un aliado.', anim:'buff' },
  // Fina — clériga
  heal:       { name:'Curar', mp:5, type:'restore', stat:'hp', value:45, target:'ally', desc:'Restaura 45 PS.', anim:'heal' },
  massHeal:   { name:'Curación Masiva', mp:14, type:'restore', stat:'hp', value:38, target:'party', desc:'Restaura 38 PS a todo el grupo.', anim:'heal' },
  bless:      { name:'Bendición', mp:8, type:'buff', stat:'def', mult:1.4, turns:4, target:'ally', desc:'Aumenta la DEF 4 turnos.', anim:'buff' },
  revive:     { name:'Renascer', mp:20, type:'revive', value:.5, target:'ally', desc:'Revive a un aliado con mitad de PS.', anim:'holy' },
  smite:      { name:'Castigo Sagrado', mp:7, type:'magic', elem:'holy', power:1.4, target:'enemy', desc:'Luz que hiende a los malvados.', anim:'holy' },
  // Enemigos
  e_bite:     { name:'Mordisco', mp:0, type:'phys', power:1.3, target:'enemy', desc:'', anim:'slash' },
  e_fang:     { name:'Colmillos', mp:0, type:'phys', power:1.45, target:'enemy', desc:'', anim:'slash' },
  e_web:      { name:'Telaraña', mp:0, type:'debuff', stat:'agi', mult:0.6, turns:3, target:'enemies', desc:'', anim:'buff' },
  e_poison:   { name:'Aguijonazo', mp:0, type:'phys', power:1.2, target:'enemy', desc:'', anim:'slash' },
  e_fire:     { name:'Aliento Ígneo', mp:0, type:'magic', elem:'fire', power:1.4, target:'all', desc:'', anim:'fire' },
  e_dark:     { name:'Garra Sombría', mp:0, type:'magic', elem:'dark', power:1.35, target:'enemy', desc:'', anim:'dark' },
  e_drain:    { name:'Drenar Vida', mp:0, type:'drain', power:1.2, target:'enemy', desc:'', anim:'dark' },
  e_heal:     { name:'Maldición Vital', mp:0, type:'restore', stat:'hp', value:60, target:'ally', desc:'', anim:'heal' },
  e_quake:    { name:'Terremoto', mp:0, type:'phys', power:1.3, target:'all', desc:'', anim:'quake' },
  e_roar:     { name:'Aullido', mp:0, type:'debuff', stat:'atk', mult:0.8, turns:3, target:'enemies', desc:'', anim:'buff' },
  e_storm:    { name:'Tormenta Demoníaca', mp:0, type:'magic', elem:'dark', power:1.5, target:'all', desc:'', anim:'dark' },
  e_curse:    { name:'Maldición del Vacío', mp:0, type:'debuff', stat:'all', mult:0.8, turns:3, target:'enemies', desc:'', anim:'dark' },
};

/* ---------- OBJETOS ---------- */
const ITEMS = {
  potion:    { name:'Poción', price:30,  type:'heal', value:60,  desc:'Restaura 60 PS.', icon:'🧪' },
  hipotion:  { name:'Mega Poción', price:120, type:'heal', value:220, desc:'Restaura 220 PS.', icon:'🧪' },
  ether:     { name:'Éter', price:90,  type:'mp', value:25, desc:'Restaura 25 PM.', icon:'🔹' },
  elixir:    { name:'Elixir', price:400, type:'full', value:0, desc:'Restaura todos los PS y PM.', icon:'⚗️' },
  antidote:  { name:'Antídoto', price:20, type:'cure', status:'poison', desc:'Cura el veneno.', icon:'🌿' },
  phoenix:   { name:'Pluma Fénix', price:150, type:'revive', value:.5, desc:'Revive a un aliado con 50% PS.', icon:'🪶' },
  bomb:      { name:'Bomba de Fuego', price:60, type:'damage', elem:'fire', value:70, desc:'70 de daño a un enemigo.', icon:'💥' },
  shuriken:  { name:'Shuriken Estelar', price:80, type:'damage', elem:'thunder', value:55, target:'all', desc:'55 a todos los enemigos.', icon:'✴️' },
  herb:      { name:'Hierba Lunar', price:8, type:'heal', value:25, desc:'Restaura 25 PS.', icon:'🌱' },
  // Armas (atk)
  w_bronze:  { name:'Espada de Bronce', price:100, type:'weapon', atk:6,  who:['hero','kira'], desc:'ATQ +6', icon:'🗡️' },
  w_iron:    { name:'Espada de Hierro', price:320, type:'weapon', atk:14, who:['hero','kira'], desc:'ATQ +14', icon:'🗡️' },
  w_flame:   { name:'Filo Ígneo', price:800, type:'weapon', atk:26, who:['hero','kira'], desc:'ATQ +26, a veces quema', icon:'🔥' },
  w_staff:   { name:'Bastón de Roble', price:90,  type:'weapon', atk:4, mag:6, who:['elowen','fina'], desc:'ATQ +4, MAG +6', icon:'🪄' },
  w_crystal: { name:'Cetro de Cristal', price:380, type:'weapon', atk:9, mag:16, who:['elowen','fina'], desc:'ATQ +9, MAG +16', icon:'🪄' },
  w_star:    { name:'Báculo Estelar', price:900, type:'weapon', atk:14, mag:30, who:['elowen','fina'], desc:'ATQ +14, MAG +30', icon:'✨' },
  // Armaduras (def)
  a_leather: { name:'Túnica de Cuero', price:80,  type:'armor', def:5,  who:'all', desc:'DEF +5', icon:'🥼' },
  a_chain:   { name:'Cota de Malla', price:300, type:'armor', def:12, who:'all', desc:'DEF +12', icon:'🛡️' },
  a_mythril: { name:'Armadura de Mitrilo', price:850, type:'armor', def:24, who:'all', desc:'DEF +24', icon:'🛡️' },
  // Accesorios
  ac_speed:  { name:'Botas Ligeras', price:200, type:'acc', agi:8, who:'all', desc:'AGI +8', icon:'👢' },
  ac_charm:  { name:'Amuleto Arcano', price:260, type:'acc', mag:10, who:'all', desc:'MAG +10', icon:'📿' },
  ac_guard:  { name:'Guardián de Piedra', price:240, type:'acc', def:8, who:'all', desc:'DEF +8', icon:'🪨' },
  // Objetos de misión
  q_flower:  { name:'Flor de Aurora', price:0, type:'quest', desc:'Una flor que solo florece en el bosque antiguo.', icon:'🌸', key:true },
  q_relic:   { name:'Reliquia del Templo', price:0, type:'quest', desc:'Un relicario robado por los goblins.', icon:'📜', key:true },
  q_letter:  { name:'Carta Sellada', price:0, type:'quest', desc:'Para la monja del templo.', icon:'✉️', key:true },
};

/* ---------- HÉROES (plantilla; stats escalan con nivel) ---------- */
// curvas: hp/mp/atk/def/mag/agi = base + growth*level
const HEROES = {
  hero:   { id:'hero', name:'Alex',  cls:'Héroe Invocado', face:'face_young_m', walk:'walk_m_warrior',
            base:{ hp:78, mp:22, atk:14, def:10, mag:10, agi:12 }, growth:{ hp:16, mp:5, atk:3.2, def:2.2, mag:2.2, agi:2.4 },
            skills:[ ['slash',1],['courage',3],['crossSlash',7],['heroWave',12],['awaken',17] ],
            equip:{ weapon:'w_bronze', armor:null, acc:null } },
  kira:   { id:'kira', name:'Kira', cls:'Espadachina', face:'face_warrior_f', walk:'walk_f_warrior',
            base:{ hp:92, mp:14, atk:17, def:12, mag:5, agi:11 }, growth:{ hp:20, mp:3, atk:3.8, def:2.6, mag:1.2, agi:2.2 },
            skills:[ ['powerHit',1],['warCry',4],['whirlwind',8],['execution',14] ],
            equip:{ weapon:null, armor:'a_leather', acc:null } },
  elowen: { id:'elowen', name:'Elowen', cls:'Maga Élfica', face:'face_magician_f', walk:'walk_f_magician',
            base:{ hp:62, mp:40, atk:8, def:8, mag:18, agi:10 }, growth:{ hp:11, mp:9, atk:1.6, def:1.8, mag:4.2, agi:2 },
            skills:[ ['fireball',1],['iceLance',3],['focusMind',5],['spark',8],['meteor',15] ],
            equip:{ weapon:'w_staff', armor:null, acc:null } },
  fina:   { id:'fina', name:'Fina', cls:'Clériga', face:'face_nun', walk:'walk_f_healer',
            base:{ hp:70, mp:34, atk:9, def:11, mag:15, agi:9 }, growth:{ hp:13, mp:8, atk:1.8, def:2.4, mag:3.4, agi:1.8 },
            skills:[ ['heal',1],['bless',3],['smite',6],['massHeal',10],['revive',13] ],
            equip:{ weapon:null, armor:'a_leather', acc:null } },
};

/* ---------- ENEMIGOS ---------- */
// exp y gold base; hp/atk/def/mag/agi fijos por familia
const ENEMIES = {
  slime:    { name:'Limo', sprite:'mon_slime', hp:24, atk:9,  def:4,  mag:4,  agi:5,  exp:6,   gold:8,   skills:['e_bite'], weak:'fire' },
  slimeB:   { name:'Limo Ácido', sprite:'mon_slime_2', hp:36, atk:12, def:6, mag:6, agi:6, exp:10, gold:12, skills:['e_bite','e_poison'], weak:'fire' },
  rabbit:   { name:'Conejo Lunar', sprite:'mon_rabbit', hp:20, atk:8, def:3, mag:5, agi:12, exp:5, gold:6, skills:['e_bite'], weak:null },
  rat:      { name:'Rata Gigante', sprite:'mon_rat', hp:30, atk:11, def:5, mag:3, agi:9, exp:8, gold:9, skills:['e_fang'], weak:'fire' },
  bat:      { name:'Murciélago', sprite:'mon_bat', hp:26, atk:10, def:4, mag:5, agi:13, exp:7, gold:7, skills:['e_bite','e_drain'], weak:'thunder' },
  wolf:     { name:'Lobo Feroz', sprite:'mon_wolf', hp:44, atk:15, def:7, mag:5, agi:11, exp:14, gold:12, skills:['e_fang','e_roar'], weak:'fire' },
  goblin:   { name:'Goblin', sprite:'mon_goblin', hp:40, atk:14, def:8, mag:4, agi:8, exp:13, gold:16, skills:['e_bite'], weak:null },
  goblinB:  { name:'Goblin Chamán', sprite:'mon_goblin_1', hp:38, atk:12, def:7, mag:14, agi:9, exp:16, gold:20, skills:['e_fire'], weak:null },
  snake:    { name:'Serpiente Áspid', sprite:'mon_snake', hp:42, atk:16, def:8, mag:8, agi:10, exp:15, gold:14, skills:['e_poison'], weak:'ice' },
  cockatrice:{ name:'Cockatrice', sprite:'mon_cockatrice', hp:52, atk:18, def:9, mag:10, agi:12, exp:20, gold:18, skills:['e_fang','e_poison'], weak:'thunder' },
  spider:   { name:'Araña Sombra', sprite:'mon_spider', hp:48, atk:16, def:10, mag:10, agi:12, exp:19, gold:16, skills:['e_web','e_poison'], weak:'fire' },
  ghost:    { name:'Fantasma', sprite:'mon_ghost', hp:44, atk:14, def:8, mag:16, agi:11, exp:21, gold:18, skills:['e_dark','e_drain'], weak:'holy' },
  skeleton: { name:'Esqueleto', sprite:'mon_skeleton', hp:56, atk:18, def:12, mag:8, agi:9, exp:23, gold:20, skills:['e_fang'], weak:'holy' },
  lizard:   { name:'Hombre Lagarto', sprite:'mon_lizard', hp:64, atk:20, def:14, mag:10, agi:10, exp:27, gold:24, skills:['e_fang','e_roar'], weak:'ice' },
  eye:      { name:'Ojo Vigilante', sprite:'mon_eye', hp:40, atk:14, def:8, mag:18, agi:12, exp:22, gold:20, skills:['e_dark'], weak:null },
  soldier:  { name:'Soldado Oscuro', sprite:'mon_soldier', hp:70, atk:21, def:15, mag:10, agi:10, exp:30, gold:28, skills:['e_fang'], weak:'holy' },
  ninja:    { name:'Ninja de las Sombras', sprite:'mon_ninja', hp:66, atk:24, def:12, mag:12, agi:16, exp:34, gold:30, skills:['e_fang','e_web'], weak:null },
  pirate:   { name:'Pirata Maldito', sprite:'mon_pirate', hp:74, atk:22, def:14, mag:10, agi:11, exp:32, gold:34, skills:['e_fang'], weak:'holy' },
  tiger:    { name:'Tigre Espectral', sprite:'mon_tiger', hp:88, atk:27, def:15, mag:10, agi:15, exp:40, gold:32, skills:['e_fang','e_roar'], weak:null },
  captain:  { name:'Capitán Sombrío', sprite:'mon_captain', hp:95, atk:26, def:18, mag:12, agi:12, exp:48, gold:50, skills:['e_fang','e_roar','e_dark'], weak:'holy' },
  // JEFINES
  bossSpider:{ name:'Viuda Carmesí', sprite:'mon_spider_1', hp:260, atk:22, def:13, mag:14, agi:12, exp:120, gold:180, boss:true,
              skills:['e_fang','e_web','e_poison'], weak:'fire', drop:'hipotion' },
  bossGolem:{ name:'Gólem de Cristal', sprite:'mon_soldier_2', hp:420, atk:28, def:24, mag:14, agi:7, exp:260, gold:350, boss:true,
              skills:['e_quake','e_fang'], weak:'thunder', drop:'a_chain' },
  bossCaptain:{ name:'General Mordrax', sprite:'mon_captain_1', hp:560, atk:32, def:20, mag:18, agi:14, exp:400, gold:550, boss:true,
              skills:['e_fang','e_dark','e_storm','e_heal'], weak:'holy', drop:'w_flame' },
  bossDragon:{ name:'Draco Infernal', sprite:'mon_dragon_2', hp:760, atk:36, def:22, mag:26, agi:13, exp:600, gold:800, boss:true,
              skills:['e_fire','e_fang','e_roar'], weak:'ice', drop:'a_mythril' },
  bossFinal:{ name:'Vorthak, Rey Demonio', sprite:'mon_shadowboss_1', hp:1100, atk:40, def:24, mag:32, agi:16, exp:1200, gold:2000, boss:true,
              skills:['e_storm','e_dark','e_curse','e_drain','e_quake'], weak:'holy', drop:null, phases:2 },
};

/* ---------- GRUPOS DE ENCUENTRO POR MAPA ---------- */
const ENCOUNTERS = {
  plaza:   null,
  village: [ ['slime','rabbit'], ['slime','slime','rat'], ['rat','rat'], ['slimeB','slime'], ['rabbit','rat','slime'] ],
  road:    [ ['slime','rat'], ['goblin'], ['slimeB','bat'], ['goblin','rat'], ['snake'], ['bat','bat','rat'] ],
  forest:  [ ['wolf'], ['goblin','goblin'], ['snake','slimeB'], ['spider'], ['wolf','bat'], ['cockatrice'], ['goblinB','goblin'] ],
  deepforest:[ ['wolf','wolf'], ['spider','spider'], ['cockatrice','snake'], ['goblinB','wolf'], ['tiger'] ],
  cave:    [ ['skeleton'], ['bat','bat','bat'], ['ghost'], ['skeleton','spider'], ['eye'], ['lizard'], ['ghost','bat'] ],
  caveDeep:[ ['skeleton','skeleton'], ['lizard','ghost'], ['eye','skeleton'], ['tiger','bat'], ['captain'] ],
  castle:  [ ['soldier'], ['ninja'], ['soldier','soldier'], ['pirate'], ['lizard','soldier'], ['ninja','ninja'], ['eye','ghost'] ],
  throne:  [ ['captain','soldier'], ['ninja','ninja','soldier'], ['tiger','ninja'] ],
};

/* ---------- TIENDAS ---------- */
const SHOPS = {
  village: {
    name:'🌸 Tienda de Mira',
    stock:['herb','potion','antidote','ether','w_bronze','w_staff','a_leather','ac_speed'],
  },
  village2: {
    name:'⚔️ Bazar del Aventurero',
    stock:['hipotion','phoenix','bomb','shuriken','w_iron','a_chain','ac_charm','ac_guard'],
  },
  castleTown: {
    name:'💎 Mercader Errante',
    stock:['hipotion','ether','elixir','phoenix','w_flame','w_star','a_mythril','ac_charm','ac_guard'],
  },
};

/* ---------- CURVA DE EXPERIENCIA ---------- */
function expForLevel(lv) { return Math.floor(18 * Math.pow(lv, 2.1)); }
