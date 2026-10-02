// Bots de la Kanastra: juegan solo con su propia mano y lo que está a la vista en la mesa.
const E = require('./engine.js');
const { ACTIONS, analyze, isWild, isBlack3, rank, suit, runIdx, val, sum, GameErr, hk, tk, teamOf, OPEN, isKanastra } = E;
const clone = x => JSON.parse(JSON.stringify(x));

// Busca combinaciones en la mano. Prioridad: escaleras (A K Q J 10…) antes que grupos repetidos (9 9 9).
function findMelds(hand, allowWild) {
  const out = [], used = new Set();
  const nat = hand.filter(c => !isWild(c) && rank(c) !== 3);
  // escaleras naturales, las más largas primero
  const runsOf = () => {
    const found = [];
    for (let su = 0; su < 4; su++) {
      const seen = {};
      for (const c of nat) if (!used.has(c) && suit(c) === su && seen[runIdx(rank(c))] === undefined) seen[runIdx(rank(c))] = c;
      let run = [];
      const flush = () => { if (run.length >= 3) found.push(run.slice()); run = []; };
      for (let i = 0; i <= 10; i++) { if (seen[i] !== undefined) run.push(seen[i]); else flush(); }
      flush();
    }
    return found.sort((a, b) => b.length - a.length);
  };
  for (const r of runsOf()) { out.push(r); r.forEach(c => used.add(c)); }
  // grupos del mismo número con lo que no se usó en escaleras
  const byRank = {};
  for (const c of nat) if (!used.has(c)) (byRank[rank(c)] = byRank[rank(c)] || []).push(c);
  for (const r in byRank) if (byRank[r].length >= 3) { out.push(byRank[r].slice()); byRank[r].forEach(c => used.add(c)); }
  if (allowWild) {
    const w = hand.find(isWild);
    if (w !== undefined) {
      let made = null;
      // primero una escalera con comodín: dos cartas del mismo palo seguidas o con un hueco
      for (let su = 0; su < 4 && !made; su++) {
        const cs = nat.filter(c => !used.has(c) && suit(c) === su).sort((a, b) => runIdx(rank(a)) - runIdx(rank(b)));
        for (let i = 0; i + 1 < cs.length && !made; i++) {
          const d = runIdx(rank(cs[i + 1])) - runIdx(rank(cs[i]));
          if ((d === 1 || d === 2) && !analyze([cs[i], cs[i + 1], w]).err) made = [cs[i], cs[i + 1], w];
        }
      }
      if (!made) for (const r in byRank) {
        const left = byRank[r].filter(c => !used.has(c));
        if (left.length === 2) { made = left.concat([w]); break; }
      }
      if (made) out.push(made);
    }
  }
  const wilds = hand.filter(isWild);
  if (wilds.length >= 7) out.unshift(wilds.slice(0, 7)); // kanastra de comodines
  return out;
}
const meldsPts = ms => ms.reduce((x, m) => x + sum(m), 0);

function discardScore(c, hand, s, seat) {
  if (isBlack3(c)) return s.pile.length >= 3 ? -50 : -5;
  if (isWild(c)) return 1000;
  let u = 0;
  for (const o of hand) {
    if (o === c || isWild(o) || rank(o) === 3) continue;
    if (rank(o) === rank(c)) u += 2.5;
    if (suit(o) === suit(c)) { const d = Math.abs(runIdx(rank(o)) - runIdx(rank(c))); if (d === 1) u += 4.5; else if (d === 2) u += 2.5; }
  }
  const opp = s.melds[tk(1 - teamOf(seat))];
  if (opp.some(m => m.type === 'group' && m.cards.some(x => !isWild(x) && rank(x) === rank(c)))) u += 5;
  return u - val(c) / 10;
}

// Devuelve la lista de jugadas [acción, datos] del turno completo del bot.
function botPlan(state0) {
  let s = clone(state0);
  const seat = s.turn, steps = [];
  const live = () => s.status === 'playing' && s.turn === seat;
  function tryStep(name, args) {
    const c = clone(s);
    try { ACTIONS[name](c, seat, args); } catch (e) { if (e instanceof GameErr) return false; throw e; }
    s = c; steps.push([name, args]); return true;
  }
  const t = teamOf(seat);
  // 1. tomar carta: piso a una combinación, piso con 2 cartas, o robar
  if (s.phase === 'draw' || s.phase === 'final') {
    let bought = false;
    const top = s.pile[s.pile.length - 1];
    if (s.pile.length && !isBlack3(top) && s.opened[tk(t)]) {
      const order = s.melds[tk(t)].filter(m => m.type !== 'wild').sort((a, b) => (a.type === 'run' ? 0 : 1) - (b.type === 'run' ? 0 : 1));
      for (const m of order) if (tryStep('buyadd', { meldId: m.id })) { bought = true; break; }
    }
    if (!bought && s.pile.length && !isBlack3(top)) {
      const h = s.hands[hk(seat)];
      const nat = h.filter(c => !isWild(c) && rank(c) !== 3);
      const opts = [];
      for (let i = 0; i < nat.length; i++) for (let j = i + 1; j < nat.length; j++)
        if (!analyze([nat[i], nat[j], top]).err) opts.push([nat[i], nat[j]]);
      opts.sort((a, b) => (analyze(a.concat([top])).type === 'run' ? 0 : 1) - (analyze(b.concat([top])).type === 'run' ? 0 : 1));
      if (!opts.length && s.pile.length >= 5 && !isWild(top)) {
        const w = h.find(isWild);
        if (w !== undefined) for (const n of nat) if (!analyze([n, w, top]).err) { opts.push([n, w]); break; }
      }
      for (const pair of opts) {
        const rest = h.filter(c => !pair.includes(c));
        let dr = [];
        if (!s.opened[tk(t)]) { dr = findMelds(rest, false); if (meldsPts(dr) + sum(pair.concat([top])) < OPEN) dr = findMelds(rest, true); }
        if (tryStep('buy', { cards: pair, draft: dr })) { bought = true; break; }
      }
    }
    if (!bought) {
      if (s.phase === 'final') { tryStep('pass', {}); return steps; }
      if (!tryStep('draw', {})) return steps;
    }
  }
  // 2. bajar y añadir
  let guard = 0, progress = true;
  while (progress && guard++ < 40 && live()) {
    progress = false;
    const h = s.hands[hk(seat)];
    if (!s.opened[tk(t)]) {
      let ms = findMelds(h, false);
      if (meldsPts(ms) < OPEN) ms = findMelds(h, true);
      if (ms.length && meldsPts(ms) >= OPEN && tryStep('meld', { melds: ms })) progress = true;
      break;
    }
    const special = h.filter(isWild);
    if (special.length >= 7 && tryStep('meld', { melds: [special.slice(0, 7)] })) { progress = true; continue; }
    const runsFirst = s.melds[tk(t)].filter(m => m.type !== 'wild').sort((a, b) => (a.type === 'run' ? 0 : 1) - (b.type === 'run' ? 0 : 1));
    outer: for (const c of h.filter(c => !isWild(c))) {
      for (const m of runsFirst) if (tryStep('add', { meldId: m.id, cards: [c] })) { progress = true; break outer; }
    }
    if (progress) continue;
    for (const m of findMelds(h, false)) if (tryStep('meld', { melds: [m] })) { progress = true; break; }
    if (progress) continue;
    outer2: for (const w of h.filter(isWild)) {
      if (special.length >= 5) break; // guarda comodines si va armando la kanastra de comodines
      for (const m of s.melds[tk(t)]) {
        if (m.type === 'wild') continue;
        const res = analyze(m.cards.concat([w]), m.type);
        if (res.err) continue;
        const good = res.clean || (!isKanastra(m) && m.cards.length >= 5) || h.length <= 3;
        if (good && tryStep('add', { meldId: m.id, cards: [w] })) { progress = true; break outer2; }
      }
    }
  }
  if (!live()) return steps;
  // 3. cerrar: en el último piso no se tira
  if (s.flags.noDiscard) { tryStep('finish', {}); return steps; }
  if (s.phase === 'play') {
    const h = s.hands[hk(seat)];
    const cands = (s.flags.mustBlack3 && h.some(isBlack3)) ? h.filter(isBlack3)
      : h.slice().sort((a, b) => discardScore(a, h, s, seat) - discardScore(b, h, s, seat));
    for (const c of cands) if (tryStep('discard', { card: c })) break;
  }
  return steps;
}
module.exports = { botPlan };
