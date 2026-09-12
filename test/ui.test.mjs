/* LevelSpend UI tests: the behaviors the model suite cannot reach (drags,
   history, labels, render work). Loads ../index.html in jsdom.
   Needs: npm install jsdom.  Run: node test/ui.test.mjs [path/to/index.html]
   Every check here fails on build 2026.08.03f and passes from 2026.09.12a on. */
import { JSDOM } from 'jsdom';
import { readFileSync } from 'fs';
import { fileURLToPath } from 'url';
import { dirname, resolve } from 'path';

const here = dirname(fileURLToPath(import.meta.url));
const file = process.argv[2] ? resolve(process.argv[2]) : resolve(here, '../index.html');
const html = readFileSync(file, 'utf8');

let fails = 0, n = 0;
const ok = (cond, label, detail) => {
  n++;
  console.log((cond ? 'PASS  ' : 'FAIL  ') + label + (detail !== undefined ? '  [' + detail + ']' : ''));
  if (!cond) fails++;
};

function load() {
  const dom = new JSDOM(html, {
    runScripts: 'dangerously', url: 'https://levelspend.github.io/', pretendToBeVisual: true,
    beforeParse(w) {
      Object.defineProperty(w.SVGElement.prototype, 'clientWidth', { get() { return 800; }, configurable: true });
      Object.defineProperty(w.HTMLElement.prototype, 'clientWidth', { get() { return 300; }, configurable: true });
      Object.defineProperty(w.HTMLElement.prototype, 'offsetWidth', { get() { return 60; }, configurable: true });
      Object.defineProperty(w.HTMLElement.prototype, 'offsetHeight', { get() { return 60; }, configurable: true });
      w.SVGElement.prototype.getBoundingClientRect = () => ({ left: 0, top: 0, width: 800, height: 460 });
      w.matchMedia = () => ({ matches: false, addListener() {}, removeListener() {} });
      w.requestAnimationFrame = cb => setTimeout(() => cb(w.performance.now()), 0);
      w.__pushes = [];
      const push = w.history.pushState.bind(w.history);
      w.history.pushState = (st, t, u) => { w.__pushes.push(JSON.parse(JSON.stringify(st))); return push(st, t, u); };
    },
  });
  return dom.window;
}
/* the page's script is a classic script: its top-level bindings are reached
   by evaluating inside a script element, not from here */
const run = (w, src) => { const s = w.document.createElement('script'); s.textContent = '(function(){' + src + '})();'; w.document.body.appendChild(s); s.remove(); };
const get = (w, expr) => { run(w, 'window.__r = (' + expr + ');'); return w.__r; };
const move = (w, x, y) => w.dispatchEvent(new w.MouseEvent('pointermove', { bubbles: true, clientX: x, clientY: y }));
const down = (w, el, x, y) => el.dispatchEvent(new w.MouseEvent('pointerdown', { bubbles: true, clientX: x, clientY: y }));
const up = w => w.dispatchEvent(new w.MouseEvent('pointerup', { bubbles: true }));
const txt = (w, id) => w.document.getElementById(id).textContent.replace(/\s+/g, ' ').trim();

/* ---- 1. drags past the right edge stay on the chart ---- */
{
  const w = load();
  const g = get(w, 'geom');
  down(w, w.document.querySelector('#chart line.ret-handle'), g.X(57), 200);
  for (let i = 0; i < 6; i++) move(w, g.W - g.mR + 25 + (i % 2), 200);
  up(w);
  ok(get(w, 'state.retAge') === 100 && get(w, 'state.endAge') === 100,
     'retire line dragged past the right edge stops at the end age', get(w, 'state.retAge') + '/' + get(w, 'state.endAge'));
  ok(get(w, 'ratchetNote') === '', 'no ratchet note from the overshoot');

  run(w, 'applyPreset(DEFAULTS); state.glide = true; state.glideKink = true; render();');
  const g2 = get(w, 'geom');
  down(w, w.document.querySelector('#chart circle.rate-handle[data-key="rateMid"]'), g2.X(57), 200);
  for (let i = 0; i < 4; i++) move(w, g2.W - g2.mR + 30 + (i % 2), 200);
  up(w);
  ok(get(w, 'state.endAge') === 100 && get(w, 'state.retAge') === 99,
     'kink handle dragged past the right edge stops a year short of the end age', get(w, 'state.retAge') + '/' + get(w, 'state.endAge'));

  run(w, 'applyPreset(DEFAULTS);');
  const g3 = get(w, 'geom');
  down(w, w.document.querySelector('#chart line.band-v[data-stream="p1"][data-side="start"]'), g3.X(65), 300);
  move(w, g3.W - g3.mR + 60, 300);
  up(w);
  ok(get(w, 'state.penAge') === 99, 'band start edge dragged past the right edge stops at end age minus one', get(w, 'state.penAge'));
  ok(w.document.querySelectorAll('#chart [data-stream="p1"]').length > 0, 'the band survives the overshoot');
}

/* ---- 2. drawn curves take part in history ---- */
{
  const w = load();
  run(w, 'state.curveOn = true; render(); pushHistory();');
  let n0 = w.__pushes.length;
  run(w, 'paintAt(40,-10); paintAt(41,-10); paintAt(42,-10); paintAt(43,5); render(); pushHistory();');
  ok(w.__pushes.length === n0 + 1, 'a paint stroke pushes one history entry');
  const painted = w.__pushes[w.__pushes.length - 1];
  n0 = w.__pushes.length;
  w.document.getElementById('curveReset').click();
  ok(w.__pushes.length === n0 + 1 && Object.keys(get(w, 'rateCurve')).length === 0, 'reset curve pushes one entry');
  w.dispatchEvent(new w.PopStateEvent('popstate', { state: painted }));
  ok(JSON.stringify(get(w, 'rateCurve')) === JSON.stringify({ 40: -10, 41: -10, 42: -10, 43: 5 }),
     'Back restores the drawing', JSON.stringify(get(w, 'rateCurve')));
  n0 = w.__pushes.length;
  w.document.getElementById('curveShuffle').click();
  ok(w.__pushes.length === n0 + 1, 'shuffle order pushes one entry');
  run(w, 'state.tiltOn = true; render(); pushHistory();');
  n0 = w.__pushes.length;
  run(w, 'tiltPaintAt(70, 2); render(); pushHistory();');
  ok(w.__pushes.length === n0 + 1 && w.__pushes[n0].tc && w.__pushes[n0].tc[70] === 2, 'a tilt stroke pushes one entry carrying the tilt curve');
  w.dispatchEvent(new w.PopStateEvent('popstate', { state: { startBal: 77777 } }));
  ok(get(w, 'state.startBal') === 77777, 'an entry in the pre-curve shape still restores');
  ok(!('rateCurve' in get(w, 'state')) && !('s' in get(w, 'state')), 'popstate leaves state free of snapshot keys');
}

/* ---- 3. every labeled input has an accessible name ---- */
{
  const w = load();
  const d = w.document;
  const unnamed = [...d.querySelectorAll('#inputs input')].filter(i =>
    !(i.id && d.querySelector('label[for="' + i.id + '"]')) && !i.closest('label') && !i.getAttribute('aria-label'));
  ok(unnamed.length === 0, 'no input on the panel lacks an accessible name', unnamed.map(i => i.id).join(',') || 'none');
  const dup = [...d.querySelectorAll('#inputs label[for]')].filter(l => !d.getElementById(l.getAttribute('for')));
  ok(dup.length === 0, 'every label for= names an existing input');
}

/* ---- 4. s* is solved once per render ---- */
{
  const w = load();
  run(w, 'window.__c = 0; const _s = solveSStar; solveSStar = function(p){ window.__c++; return _s(p); };');
  run(w, 'state.startBal = 5000; state.ssAmt = 60000; render();');
  ok(get(w, 'simulate().steps.length') > 1, 'the scenario is a split (stepped) plan');
  run(w, 'window.__c = 0; render();');
  ok(w.__c === 1, 'solveSStar runs once per render', w.__c);
}

/* ---- 5. a clamped s* does not dress the button settled ---- */
{
  const w = load();
  run(w, 'state.legacy = 3e7; state.savePct = 100; render();');
  ok(get(w, 'simulate().sStar') > 1, 'premise: s* above 1');
  ok(!w.document.getElementById('setSStar').classList.contains('settled'), 'savings button is not settled', txt(w, 'sLead'));
}

/* ---- stamps ---- */
{
  const w = load();
  const top = (html.match(/<!-- LevelSpend build ([^ ]+) -->/) || [])[1];
  ok(top && get(w, 'buildStamp()') === 'build ' + top, 'HTML comment and footer stamps agree', top);
}

console.log('\n' + (fails ? fails + ' FAILED of ' + n : 'ALL PASS (' + n + ' checks)'));
process.exit(fails ? 1 : 0);
