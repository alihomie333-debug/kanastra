/* ===== Motor de reglas: Kanastra de la familia ===== */
const SUITS = ['♠','♥','♦','♣'];
const SUIT_NAMES = ['picas','corazones','diamantes','tréboles'];
const WIN = 5000, OPEN = 80, HAND = 15;
const BOT_NAMES = ['Bot Samir', 'Bot Yasmin', 'Bot Tony', 'Bot Rania'];
// Reacciones permitidas en la mesa (emoticonos y frases)
const REACTIONS = ['😂', '😮', '👏', '😎', '🔥', '😡', '🙏', '❤️', '🤔', '😴',
  '¡Wow!', 'Jajajaja', 'Buen intento', '¡Más rápido!', '¡Buena suerte!', '¡Bien jugado!', '¡Uy!', '¡Cuidado!'];
class GameErr extends Error {}
const fail = m => { throw new GameErr(m); };

const isJoker = c => c >= 104;
const suit = c => isJoker(c) ? -1 : Math.floor((c % 52) / 13);
const rank = c => isJoker(c) ? 0 : (c % 13) + 1;
const isJoly = c => !isJoker(c) && rank(c) === 2;
const isWild = c => isJoker(c) || isJoly(c);
const isRedSuit = c => suit(c) === 1 || suit(c) === 2;
const isRed3 = c => !isJoker(c) && rank(c) === 3 && isRedSuit(c);
const isBlack3 = c => !isJoker(c) && rank(c) === 3 && !isRedSuit(c);
const runIdx = r => r === 1 ? 10 : r - 4;           // 4..K -> 0..9, As -> 10
const RANK_LABEL = {1:'A',11:'J',12:'Q',13:'K'};
const rankLabel = c => isJoker(c) ? 'JK' : (RANK_LABEL[rank(c)] || String(rank(c)));
const cardName = c => isJoker(c) ? 'Joker' : rankLabel(c) + SUITS[suit(c)];
function val(c) {
  if (isJoker(c)) return 50;
  const r = rank(c);
  if (r === 1 || r === 2) return 20;
  if (r === 3) return 0;
  return r <= 7 ? 5 : 10;
}
const sum = cs => cs.reduce((a, c) => a + val(c), 0);
const teamOf = seat => seat % 2;
const hk = seat => 's' + seat;
const tk = t => 't' + t;

/* Analiza un conjunto de cartas como combinación. forced = 'run' | 'group' | undefined */
function analyze(cards, forced) {
  if (forced === 'wild') return { err: 'A la kanastra de comodines no se le añaden cartas.' };
  if (cards.length < 3) return { err: 'Una combinación necesita al menos 3 cartas.' };
  const wilds = cards.filter(isWild), nat = cards.filter(c => !isWild(c));
  if (!nat.length) {
    if (wilds.length === 7 && !forced) return { type: 'wild', clean: true };
    return { err: 'La kanastra de comodines se baja completa: 7 comodines juntos.' };
  }
  if (wilds.length > 1) return { err: 'Máximo un comodín por combinación.' };
  if (nat.some(c => rank(c) === 3)) return { err: 'Los 3 no se bajan en combinaciones.' };
  if (nat.length < 2) return { err: 'Necesitas al menos 2 cartas naturales.' };
  const w = wilds[0];
  const sameRank = nat.every(c => rank(c) === rank(nat[0]));
  if (forced !== 'run' && sameRank) {
    return { type: 'group', rank: rank(nat[0]), clean: w === undefined || isJoker(w) };
  }
  if (forced === 'group') return { err: 'En un grupo todas las cartas son del mismo número.' };
  const s = suit(nat[0]);
  if (!nat.every(c => suit(c) === s)) return { err: 'Una escalera va toda del mismo palo.' };
  const idx = nat.map(c => runIdx(rank(c))).sort((a, b) => a - b);
  for (let i = 1; i < idx.length; i++) if (idx[i] === idx[i - 1]) return { err: 'Una escalera no repite números.' };
  const span = idx[idx.length - 1] - idx[0] + 1, gaps = span - idx.length;
  if (gaps > 1 || gaps > wilds.length) return { err: 'A esa escalera le faltan cartas en el medio.' };
  if (gaps === 0 && w !== undefined && span + 1 > 11) return { err: 'No hay espacio para el comodín en esa escalera.' };
  const clean = w === undefined || isJoker(w) || suit(w) === s;
  return { type: 'run', suit: s, clean, lo: idx[0], hi: idx[idx.length - 1] };
}
function describe(a) {
  if (a.err) return a.err;
  if (a.type === 'wild') return 'Kanastra de comodines · +1.500';
  const kind = a.type === 'group'
    ? 'Grupo de ' + (RANK_LABEL[a.rank] || a.rank)
    : 'Escalera de ' + SUIT_NAMES[a.suit];
  return kind + (a.clean ? ' · limpia' : ' · sucia');
}
/* Orden para mostrar una combinación */
function arrange(m) {
  if (m.type === 'wild') return m.cards.slice().sort((x, y) => (isJoker(y) ? 1 : 0) - (isJoker(x) ? 1 : 0));
  const a = analyze(m.cards, m.type);
  if (a.err) return m.cards.slice();
  const w = m.cards.find(isWild), nat = m.cards.filter(c => !isWild(c));
  if (a.type === 'group') { const o = nat.sort((x, y) => suit(x) - suit(y)); if (w !== undefined) o.push(w); return o; }
  const at = {}; nat.forEach(c => at[runIdx(rank(c))] = c);
  const out = []; let used = false;
  for (let i = a.lo; i <= a.hi; i++) { if (at[i] !== undefined) out.push(at[i]); else { out.push(w); used = true; } }
  if (w !== undefined && !used) { if (a.hi < 10) out.push(w); else out.unshift(w); }
  return out;
}
const isKanastra = m => m.cards.length >= 7;
const meldClean = m => m.type === 'wild' || !!analyze(m.cards, m.type).clean;
// Darbi: solo después de que los cuatro jugaron su primer turno, y con kanastra limpia (o la de comodines).
const lapDone = s => (s.roundTurn || 0) >= 4;
const darbiAllowed = (s, t) => lapDone(s) && teamHasClean(s, t);
const darbiMsg = (s, t) => !teamHasClean(s, t)
  ? 'Para quedarte sin cartas (darbi) tu pareja necesita una kanastra limpia.'
  : 'El darbi se habilita cuando los cuatro hayan jugado su primer turno.';
const teamHasClean = (s, t) => s.melds[tk(t)].some(m => isKanastra(m) && meldClean(m));
const teamKanastras = (s, t) => s.melds[tk(t)].filter(isKanastra).length;

/* ---------- utilidades de estado ---------- */
function shuffle(a) {
  for (let i = a.length - 1; i > 0; i--) {
    let r;
    if (typeof crypto !== 'undefined' && crypto.getRandomValues) { const b = new Uint32Array(1); crypto.getRandomValues(b); r = b[0] % (i + 1); }
    else r = Math.floor(Math.random() * (i + 1));
    [a[i], a[r]] = [a[r], a[i]];
  }
  return a;
}
const seatName = (s, i) => (s.seats[hk(i)] && s.seats[hk(i)].name) || ('Asiento ' + (i + 1));
function log(s, m) { s.log = (s.log || []).slice(-39); s.log.push({ m, n: s.turnNo || 0 }); }
function takeFromHand(s, seat, cards) {
  const h = s.hands[hk(seat)];
  const seen = new Set();
  for (const c of cards) {
    if (seen.has(c)) fail('Carta repetida en la selección.');
    seen.add(c);
    if (!h.includes(c)) fail('Esa carta ya no está en tu mano.');
  }
  s.hands[hk(seat)] = h.filter(c => !seen.has(c));
}
const middle = arr => Math.max(1, Math.floor(arr.length / 2));
function nextMeldId(s) { s.meldSeq = (s.meldSeq || 0) + 1; return 'm' + s.meldSeq; }

function newTable(code, cid, name) {
  return {
    v: 1, code, status: 'lobby', host: cid,
    seats: { s0: { cid, name }, s1: null, s2: null, s3: null },
    round: 0, turnNo: 0, scores: { t0: 0, t1: 0 }, history: [], log: [],
    rev: 1, created: Date.now(), updated: Date.now()
  };
}

function deal(s) {
  const deck = shuffle([...Array(106).keys()]);   // 2 barajas de 52 + 2 jokers
  s.hands = { s0: [], s1: [], s2: [], s3: [] };
  s.melds = { t0: [], t1: [] };
  s.red3 = { t0: [], t1: [] };
  s.opened = { t0: false, t1: false };
  for (let i = 0; i < HAND; i++) for (let p = 0; p < 4; p++) s.hands[hk(p)].push(deck.pop());
  s.stock = deck;
  s.round = (s.round || 0) + 1;
  s.starter = (s.round - 1) % 4;
  s.log = [];
  log(s, `Ronda ${s.round}. Reparte la mesa; empieza ${seatName(s, s.starter)}.`);
  // 3 rojos repartidos: se apartan y se reponen
  for (let p = 0; p < 4; p++) {
    let h = s.hands[hk(p)];
    let red = h.filter(isRed3);
    while (red.length) {
      h = h.filter(c => !isRed3(c));
      for (const c of red) { s.red3[tk(teamOf(p))].push(c); h.push(s.stock.pop()); }
      log(s, `${seatName(s, p)} apartó ${red.length === 1 ? 'un 3 rojo' : red.length + ' treses rojos'}.`);
      red = h.filter(isRed3);
    }
    s.hands[hk(p)] = h;
  }
  // un comodín no puede quedar como última carta del mazo
  let g = 0;
  while (isWild(s.stock[0]) && g++ < 30) { const c = s.stock.shift(); s.stock.splice(middle(s.stock), 0, c); }
  // se inicia el piso: un 3 rojo se aparta y se voltea otra; cualquier otra carta se queda (un 3 negro bloquea)
  s.dead = [];
  let top = s.stock.pop();
  while (isRed3(top) && s.stock.length) {
    s.dead.push(top);
    log(s, 'Salió un 3 rojo al iniciar el piso: se aparta y se voltea otra.');
    top = s.stock.pop();
  }
  s.pile = [top];
  if (isBlack3(top)) log(s, 'El piso empieza con un 3 negro: el primero debe robar.');
  s.turn = s.starter; s.phase = 'draw'; s.turnNo = (s.turnNo || 0) + 1;
  s.roundTurn = 0;
  s.flags = { mustBlack3: false, lastTurn: false, noDiscard: false };
  s.status = 'playing';
  s.lastResult = null;
}

function drawOne(s, seat) {
  while (true) {
    if (!s.stock.length) return 'empty';
    const c = s.stock.pop();
    if (isRed3(c)) {
      s.red3[tk(teamOf(seat))].push(c);
      log(s, `${seatName(s, seat)} sacó un 3 rojo y lo apartó.`);
      if (!s.stock.length) { s.flags.lastTurn = true; return 'red3last'; }
      continue;
    }
    s.hands[hk(seat)].push(c);
    if (!s.stock.length) s.flags.lastTurn = true;
    return c;
  }
}

function assertTurn(s, seat, phase) {
  if (s.status !== 'playing') fail('La ronda no está en juego.');
  if (seat == null || s.turn !== seat) fail('No es tu turno.');
  if (phase && s.phase !== phase) fail(phase === 'draw' ? 'Ya tomaste carta este turno.' : 'Primero roba o compra el piso.');
}

function afterMeld(s, seat) {
  const t = teamOf(seat), n = s.hands[hk(seat)].length;
  const limit = s.flags.noDiscard ? 0 : 1; // en el cierre final no se tira, así que puede quedar con 1
  if (n <= limit && !darbiAllowed(s, t)) fail(darbiMsg(s, t));
  if (n === 0) endRound(s, 'darbi', seat);
}
const canBuyPhase = s => s.phase === 'draw' || s.phase === 'final';
function takePile(s, seat, top) {
  const t = teamOf(seat), final = s.phase === 'final';
  const rest = s.pile; s.pile = [];
  s.hands[hk(seat)].push(...rest);
  s.flags.mustBlack3 = !final && rest.some(isBlack3);
  s.phase = 'play';
  if (final) { s.flags.noDiscard = true; log(s, `${seatName(s, seat)} compró el último piso: baja lo que pueda y termina la ronda.`); }
  else log(s, `${seatName(s, seat)} compró el piso con ${cardName(top)} (${rest.length} cartas más).`);
  return t;
}

function validateNewMelds(list) {
  const out = [];
  for (const cards of list) {
    const a = analyze(cards);
    if (a.err) fail(a.err);
    out.push({ cards: cards.slice(), type: a.type });
  }
  return out;
}

const ACTIONS = {
  sit(s, _seat, { seat, cid, name }) {
    if (s.status !== 'lobby') fail('La partida ya empezó.');
    if (!name) fail('Escribe tu nombre primero.');
    const cur = s.seats[hk(seat)];
    if (cur && cur.cid !== cid) fail('Ese asiento ya está ocupado.');
    for (let i = 0; i < 4; i++) if (s.seats[hk(i)] && s.seats[hk(i)].cid === cid) s.seats[hk(i)] = null;
    s.seats[hk(seat)] = { cid, name };
  },
  stand(s, _seat, { cid }) {
    if (s.status !== 'lobby') fail('La partida ya empezó.');
    for (let i = 0; i < 4; i++) if (s.seats[hk(i)] && s.seats[hk(i)].cid === cid) s.seats[hk(i)] = null;
  },
  takeover(s, _seat, { seat, cid }) {
    const cur = s.seats[hk(seat)];
    if (!cur) fail('Ese asiento está vacío.');
    for (let i = 0; i < 4; i++) if (s.seats[hk(i)] && s.seats[hk(i)].cid === cid) fail('Ya tienes un asiento en esta mesa.');
    s.seats[hk(seat)] = { cid, name: cur.name };
    log(s, `${cur.name} volvió a la mesa desde otro dispositivo.`);
  },
  addbot(s, _seat, { seat }) {
    if (s.status !== 'lobby') fail('La partida ya empezó.');
    if (!(seat >= 0 && seat <= 3)) fail('Asiento no válido.');
    if (s.seats[hk(seat)]) fail('Ese asiento ya está ocupado.');
    const used = new Set([0, 1, 2, 3].map(i => s.seats[hk(i)] && s.seats[hk(i)].name));
    const name = BOT_NAMES.find(n => !used.has(n)) || ('Bot ' + (seat + 1));
    s.seats[hk(seat)] = { cid: 'bot' + seat + '-' + Math.floor(Math.random() * 1e6), name, bot: true };
  },
  removebot(s, _seat, { seat }) {
    if (s.status !== 'lobby') fail('La partida ya empezó.');
    const cur = s.seats[hk(seat)];
    if (!cur || !cur.bot) fail('Ese asiento no tiene un bot.');
    s.seats[hk(seat)] = null;
  },
  start(s) {
    if (s.status !== 'lobby') fail('La partida ya empezó.');
    for (let i = 0; i < 4; i++) if (!s.seats[hk(i)]) fail('Faltan jugadores: se necesitan 4.');
    s.round = 0; s.scores = { t0: 0, t1: 0 }; s.history = [];
    deal(s);
  },
  next(s) {
    if (s.status !== 'roundEnd') fail('La ronda sigue en juego.');
    deal(s);
  },
  rematch(s) {
    if (s.status !== 'over') fail('La partida no ha terminado.');
    s.round = 0; s.scores = { t0: 0, t1: 0 }; s.history = []; s.winner = null;
    deal(s);
  },
  draw(s, seat) {
    if (s.phase === 'final' && s.turn === seat) fail('Ya no hay mazo: compra el piso o termina la ronda.');
    assertTurn(s, seat, 'draw');
    const r = drawOne(s, seat);
    if (r === 'empty') { log(s, 'No quedan cartas en el mazo: termina la ronda.'); endRound(s, 'mazo', seat); return; }
    s.phase = 'play';
    if (r === 'red3last') log(s, `Era la última carta del mazo: ${seatName(s, seat)} juega sin reponer y debe tirar.`);
    else log(s, `${seatName(s, seat)} robó del mazo.`);
  },
  buy(s, seat, { cards, draft }) {
    assertTurn(s, seat);
    if (!canBuyPhase(s)) fail('Ya tomaste carta este turno.');
    if (!s.pile.length) fail('El piso está vacío.');
    const top = s.pile[s.pile.length - 1];
    if (isBlack3(top)) fail('El piso está bloqueado con un 3 negro.');
    if (!cards || cards.length < 2) fail('Selecciona al menos 2 cartas de tu mano.');
    const t = teamOf(seat);
    const combo = cards.concat([top]);
    const a = analyze(combo);
    if (a.err) fail('Con la carta del piso: ' + a.err);
    if (a.type === 'wild') fail('La kanastra de comodines se baja completa desde la mano.');
    const extra = s.opened[tk(t)] ? [] : validateNewMelds(draft || []);
    const all = cards.concat(...extra.map(m => m.cards));
    if (!s.opened[tk(t)]) {
      const pts = sum(combo) + extra.reduce((x, m) => x + sum(m.cards), 0);
      if (pts < OPEN) fail(`Para abrir necesitas ${OPEN} puntos. Llevas ${pts}.`);
    }
    takeFromHand(s, seat, all);
    s.pile.pop();
    s.melds[tk(t)].push({ id: nextMeldId(s), type: a.type, cards: combo });
    for (const m of extra) s.melds[tk(t)].push({ id: nextMeldId(s), type: m.type, cards: m.cards });
    if (!s.opened[tk(t)]) { s.opened[tk(t)] = true; log(s, `${seatName(s, seat)} abrió para su pareja.`); }
    takePile(s, seat, top);
    afterMeld(s, seat);
  },
  // Comprar el piso añadiendo SOLO la carta de arriba a una combinación ya bajada por la pareja
  buyadd(s, seat, { meldId }) {
    assertTurn(s, seat);
    if (!canBuyPhase(s)) fail('Ya tomaste carta este turno.');
    if (!s.pile.length) fail('El piso está vacío.');
    const top = s.pile[s.pile.length - 1];
    if (isBlack3(top)) fail('El piso está bloqueado con un 3 negro.');
    const t = teamOf(seat);
    if (!s.opened[tk(t)]) fail('Tu pareja aún no ha abierto: para abrir necesitas 80 puntos con cartas de tu mano.');
    const m = s.melds[tk(t)].find(x => x.id === meldId);
    if (!m) fail('Esa combinación no es de tu pareja.');
    const a = analyze(m.cards.concat([top]), m.type);
    if (a.err) fail('La carta del piso no va en esa combinación: ' + a.err);
    const wasKan = isKanastra(m), wasClean = wasKan && meldClean(m);
    s.pile.pop();
    m.cards = m.cards.concat([top]);
    if (!wasKan && isKanastra(m)) log(s, a.clean ? '¡Kanastra limpia!' : '¡Kanastra sucia!');
    else if (wasClean && !a.clean) log(s, 'La kanastra quedó sucia.');
    takePile(s, seat, top);
    afterMeld(s, seat);
  },
  // Cierre: el siguiente al que robó la última carta no puede o no quiere comprar el piso
  pass(s, seat) {
    assertTurn(s, seat);
    if (s.phase !== 'final') fail('Solo se puede terminar así cuando se acabó el mazo.');
    log(s, `${seatName(s, seat)} no compró el piso: termina la ronda.`);
    endRound(s, 'mazo', seat);
  },
  finish(s, seat) {
    assertTurn(s, seat, 'play');
    if (!s.flags.noDiscard) fail('Termina tu turno tirando una carta.');
    log(s, `${seatName(s, seat)} terminó de bajar: fin de la ronda.`);
    endRound(s, 'mazo', seat);
  },
  meld(s, seat, { melds }) {
    assertTurn(s, seat, 'play');
    const t = teamOf(seat);
    if (!melds || !melds.length) fail('No hay nada que bajar.');
    const list = validateNewMelds(melds);
    if (!s.opened[tk(t)]) {
      const pts = list.reduce((x, m) => x + sum(m.cards), 0);
      if (pts < OPEN) fail(`Para abrir necesitas ${OPEN} puntos. Llevas ${pts}.`);
    }
    takeFromHand(s, seat, [].concat(...list.map(m => m.cards)));
    for (const m of list) s.melds[tk(t)].push({ id: nextMeldId(s), type: m.type, cards: m.cards });
    if (!s.opened[tk(t)]) { s.opened[tk(t)] = true; log(s, `${seatName(s, seat)} abrió para su pareja.`); }
    log(s, `${seatName(s, seat)} bajó ${list.length === 1 ? 'una combinación' : list.length + ' combinaciones'}.`);
    afterMeld(s, seat);
  },
  add(s, seat, { meldId, cards }) {
    assertTurn(s, seat, 'play');
    const t = teamOf(seat);
    if (!s.opened[tk(t)]) fail('Tu pareja aún no ha abierto.');
    const m = s.melds[tk(t)].find(x => x.id === meldId);
    if (!m) fail('Esa combinación no es de tu pareja.');
    if (m.type === 'wild') fail('A la kanastra de comodines no se le añaden cartas.');
    if (!cards || !cards.length) fail('Selecciona cartas para añadir.');
    const before = isKanastra(m) ? meldClean(m) : null;
    const a = analyze(m.cards.concat(cards), m.type);
    if (a.err) fail(a.err);
    takeFromHand(s, seat, cards);
    m.cards = m.cards.concat(cards);
    let note = '';
    if (isKanastra(m) && before === null) note = a.clean ? ' ¡Kanastra limpia!' : ' ¡Kanastra sucia!';
    else if (before === true && !a.clean) note = ' La kanastra quedó sucia.';
    log(s, `${seatName(s, seat)} añadió ${cards.length} a una combinación.${note}`);
    afterMeld(s, seat);
  },
  discard(s, seat, { card }) {
    assertTurn(s, seat, 'play');
    if (s.flags.noDiscard) fail('En este cierre no se tira: baja lo que puedas y toca Terminar ronda.');
    const h = s.hands[hk(seat)];
    if (!h.includes(card)) fail('Esa carta no está en tu mano.');
    if (s.flags.mustBlack3 && h.some(isBlack3) && !isBlack3(card)) fail('Compraste un piso con 3 negro: debes tirar un 3 negro.');
    const t = teamOf(seat);
    // Caso raro: robó un 3 rojo como última carta y le queda una sola; puede tirarla y la ronda termina por mazo agotado.
    const lastCardOut = h.length === 1 && !darbiAllowed(s, t) && s.flags.lastTurn;
    if (h.length === 1 && !darbiAllowed(s, t) && !lastCardOut) fail(darbiMsg(s, t));
    takeFromHand(s, seat, [card]);
    s.pile.push(card);
    log(s, `${seatName(s, seat)} tiró ${cardName(card)}${isBlack3(card) ? ' y bloqueó el piso' : ''}.`);
    if (!s.hands[hk(seat)].length) { endRound(s, lastCardOut ? 'mazo' : 'darbi', seat); return; }
    s.roundTurn = (s.roundTurn || 0) + 1;
    const next = (seat + 1) % 4;
    if (s.flags.lastTurn) {
      if (isBlack3(card)) { log(s, 'Se acabó el mazo y el piso quedó bloqueado: termina la ronda.'); endRound(s, 'mazo', seat); return; }
      s.turn = next; s.phase = 'final'; s.turnNo = (s.turnNo || 0) + 1;
      s.flags = { mustBlack3: false, lastTurn: false, noDiscard: false };
      log(s, `Se acabó el mazo: ${seatName(s, next)} puede comprar el piso; si no, termina la ronda.`);
      return;
    }
    s.turn = next; s.phase = 'draw'; s.turnNo = (s.turnNo || 0) + 1;
    s.flags = { mustBlack3: false, lastTurn: false, noDiscard: false };
  }
};

function scoreTeam(s, t, reason, seat) {
  const melds = s.melds[tk(t)];
  const mesa = melds.reduce((x, m) => x + sum(m.cards), 0);
  let limpias = 0, sucias = 0, esp = 0;
  for (const m of melds) {
    if (!isKanastra(m)) continue;
    if (m.type === 'wild') esp++; else if (meldClean(m)) limpias++; else sucias++;
  }
  const r3 = s.red3[tk(t)].length;
  const tres = (limpias + sucias + esp) > 0 ? r3 * 100 : 0;
  const darbi = reason === 'darbi' && teamOf(seat) === t ? 100 : 0;
  const mano = reason === 'darbi' ? sum(s.hands[hk(t)]) + sum(s.hands[hk(t + 2)]) : 0;
  const total = mesa + limpias * 500 + sucias * 300 + esp * 1500 + tres + darbi - mano;
  return { mesa, limpias, sucias, esp, r3, tres, darbi, mano, total };
}

function endRound(s, reason, seat) {
  const r = [0, 1].map(t => scoreTeam(s, t, reason, seat));
  s.scores.t0 += r[0].total; s.scores.t1 += r[1].total;
  const entry = { round: s.round, reason, by: seat, t0: r[0], t1: r[1], after: { t0: s.scores.t0, t1: s.scores.t1 } };
  s.history = (s.history || []).concat([entry]).slice(-40);
  s.lastResult = entry;
  log(s, reason === 'darbi' ? `¡${seatName(s, seat)} hizo darbi! Termina la ronda.` : 'Fin de la ronda por mazo agotado.');
  const A = s.scores.t0, B = s.scores.t1;
  if ((A > WIN || B > WIN) && A !== B) { s.status = 'over'; s.winner = A > B ? 0 : 1; }
  else s.status = 'roundEnd';
  s.phase = 'done';
}

if (typeof module !== 'undefined') module.exports = { ACTIONS, analyze, arrange, deal, newTable, endRound, scoreTeam, isWild, isBlack3, isRed3, isJoker, rank, suit, runIdx, val, sum, cardName, GameErr, teamHasClean, darbiAllowed, isKanastra, meldClean, hk, tk, teamOf, OPEN, BOT_NAMES, REACTIONS };
