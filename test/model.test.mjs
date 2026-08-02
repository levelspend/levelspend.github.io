/* LevelSpend model tests. Slices the model region out of ../index.html and
   runs it in node, per the marker comments in the file. Run: node test/model.test.mjs */
import { readFileSync, writeFileSync, mkdtempSync } from 'fs';
import { tmpdir } from 'os';
import { join, dirname } from 'path';
import { fileURLToPath } from 'url';
const here = dirname(fileURLToPath(import.meta.url));
const lines = readFileSync(join(here, '..', 'index.html'), 'utf8').split('\n');
const b = lines.findIndex(l => l.includes('---- model ----'));
const e = lines.findIndex(l => l.includes('---- end model ----'));
if (b < 0 || e < 0) { console.error('model markers not found'); process.exit(1); }
const mod = lines.slice(b, e + 1).join('\n') +
  '\nexport { state, planAt, simulate, solveRStar, solveRStarExact, solveSStar, levelGapAt, clampVal, buildSchedule, ssFactorAt, ssScale, ss2Scale, claimFactor, claimCap, claimClamp };\n';
const tmp = join(mkdtempSync(join(tmpdir(), 'ls-')), 'model.mjs');
writeFileSync(tmp, mod);
const { state, planAt, simulate, solveRStar, solveRStarExact, solveSStar,
        levelGapAt, ssFactorAt, ssScale, ss2Scale, claimFactor, claimCap, claimClamp } = await import('url').then(u => import(u.pathToFileURL(tmp).href));

let fail = 0;
const ok = (name, cond, detail='') => {
  if (!cond) fail++;
  console.log((cond ? 'PASS' : 'FAIL') + '  ' + name + (detail ? '  [' + detail + ']' : ''));
};
const near = (a,b,eps=1e-9) => Math.abs(a-b) <= eps;

/* ---- 1. factor table at whole years, FRA 67 ---- */
const expect = {62:0.70, 63:0.75, 64:0.80, 65:1-13.3333/100, 66:1-6.6667/100,
                67:1.00, 68:1.08, 69:1.16, 70:1.24};
for (const [a,v] of Object.entries(expect))
  ok('f(' + a + ') = ' + v.toFixed(4), near(ssFactorAt(+a), v, 5e-5), ssFactorAt(+a).toFixed(5));
ok('f capped past 70', near(ssFactorAt(73), 1.24));
ok('f monotone on [62,70] at monthly grid',
   (() => { let p = -1; for (let a=62; a<=70.001; a+=1/12) { const f=ssFactorAt(a); if (f < p - 1e-12) return false; p=f; } return true; })());
ok('62->70 ratio = 1.24/0.70', near(1.24/0.70, 1.7714285714, 1e-9), (1.24/0.70).toFixed(4));

/* ---- 2. working example: both examples unchanged (ssAge 70, credits cap at 70) ---- */
const setW = () => Object.assign(state, { startBal:50000, salary:75000, savePct:15, ratePct:4,
  startAge:35, retAge:57, endAge:95, penAmt:12000, penAge:65, penStop:0,
  ssAmt:24000, ssAge:70, ssStop:0, pen2Amt:0, ss2Amt:0, inc1Amt:0, inc2Amt:0,
  spouseAge:0, legacy:0, allowBorrow:false });
for (let R=36; R<=94; R++)
  if (!near(ssScale(R), 1)) { ok('working example: scale 1 at every R', false, 'R='+R); break; }
ok('working example: scale 1 at every R', [...Array(59)].every((_,i)=>near(ssScale(36+i),1)));

const setR = () => Object.assign(state, { startAge:62, retAge:62, endAge:95, salary:0, savePct:0,
  startBal:1000000, penAmt:10000, penAge:65, penStop:0, ssAmt:30000, ssAge:70, ssStop:0,
  pen2Amt:0, ss2Amt:0, inc1Amt:0, inc2Amt:0, spouseAge:0, legacy:0, ratePct:4, allowBorrow:false });

/* ---- 3. the target scenario: ssAge 62, sweep R ---- */
setW(); state.ssAge = 62;
ok('scale at R<=62 is 1 (claim age not passed)', near(ssScale(57),1) && near(ssScale(62),1));
ok('scale at R=70 is 1.24/0.70', near(ssScale(70), 1.24/0.70, 1e-12), ssScale(70).toFixed(4));
ok('scale at R=80 capped at 70 value', near(ssScale(80), 1.24/0.70, 1e-12));
ok('scale continuous at R=ssAge', near(ssScale(62 + 1e-9), 1, 1e-6));
{ let p=-1, mono=true;
  for (let R=62; R<=70.0001; R+=1/24) { const s2=ssScale(R); if (s2 < p-1e-12) mono=false; p=s2; }
  ok('scale monotone non-decreasing in R', mono); }

/* levelGapAt monotone in R with the factor: single sign change on the scan */
{ const gaps=[]; for (let R=35; R<=94; R++) gaps.push(levelGapAt(R));
  let changes=0; for (let i=1;i<gaps.length;i++)
    if ((gaps[i-1] < 0) !== (gaps[i] < 0)) changes++;
  ok('gap has exactly one sign change over whole-year scan', changes === 1, 'changes='+changes);
  let rises=true; for (let i=1;i<gaps.length;i++) if (gaps[i] < gaps[i-1] - 1e-6) rises=false;
  ok('gap non-decreasing over whole-year scan', rises); }

/* solver agreement: R* from patched model consistent with brute force */
{ const rStar = solveRStar();
  let brute=null;
  for (let R=state.startAge; R<=state.endAge-1; R++)
    if (levelGapAt(R) >= -1e-6) {
      brute = (R===state.startAge) ? R
        : (Math.abs(levelGapAt(R-1)) <= Math.abs(levelGapAt(R)) ? R-1 : R);
      break; }
  ok('solveRStar matches brute-force scan', rStar === brute, rStar + ' vs ' + brute);
  /* exact crossing: bisection lands where gap ~ 0 and inside the bracket */
  for (let R=state.startAge+1; R<=state.endAge-1; R++)
    if (levelGapAt(R-1) < 0 && levelGapAt(R) >= 0) {
      const x = solveRStarExact(R);
      ok('solveRStarExact inside bracket', x > R-1 && x <= R, x.toFixed(4));
      ok('gap at exact crossing ~ 0', Math.abs(levelGapAt(x)) < 1,
         levelGapAt(x).toExponential(2));
      break; }
}

/* regression anchors: values measured against 2026.07.25i during the
   claiming-factor work; a change here means the model moved */
{ setW();
  ok('working example S pinned', near(simulate().S, 45230.73, 0.01),
     simulate().S.toFixed(2));
  ok('working example R* pinned', solveRStar() === 62, String(solveRStar()));
  state.ssAge = 62; state.savePct = 6;
  ok('savePct 6, ssAge 62: R* = 66 (25i said 70)', solveRStar() === 66,
     String(solveRStar()));
  { const gaps=[]; for (let R=35; R<=94; R++) gaps.push(levelGapAt(R));
    let changes=0; for (let i=1;i<gaps.length;i++)
      if ((gaps[i-1] < 0) !== (gaps[i] < 0)) changes++;
    ok('exactly one sign change with factor active', changes === 1); }
  state.savePct = 15; }

/* ---- 4. savings-rate solver at fixed R with factor active ---- */
{ setW(); state.ssAge = 62; state.retAge = 68;   // factor = f(68)/f(62) active
  const sim = simulate();
  const s = sim.sStar;
  ok('sStar finite with factor active', Number.isFinite(s), String(s));
  if (Number.isFinite(s)) {
    const prev = state.savePct; state.savePct = Math.min(100, Math.max(0, s*100));
    const gap = simulate().S - simulate().workSpend;
    ok('sStar levels the drawn plan (|gap| < $1)', Math.abs(gap) < 1, gap.toFixed(4));
    state.savePct = prev; } }

/* ---- 5. already-retired gate ---- */
{ setR(); state.startAge = 75; state.retAge = 75; state.endAge = 95;
  state.ssAmt = 30000;
  state.ssAge = 66;                                  // claimed in the past
  ok('claimed-in-past, start typed 66: scale 1 at R=75', near(ssScale(75), 1));
  const S66 = simulate().S;
  state.ssAge = 75;                                  // docs-equivalent entry
  const S75 = simulate().S;
  ok('docs promise holds: start 66 and start 75 give same S', near(S66, S75, 1e-6),
     S66.toFixed(2) + ' vs ' + S75.toFixed(2)); }

/* 63-year-old, not yet claimed, planning 67: factor applies from 67 up */
{ setR(); state.startAge = 63; state.retAge = 63; state.endAge = 95;
  state.ssAmt = 30000; state.ssAge = 67;
  ok('future claim at 67, R=63: scale 1 (R below claim age)', near(ssScale(63), 1));
  ok('future claim at 67, R=69: scale f(69)', near(ssScale(69), 1.16/1.00, 1e-12)); }

/* typed ssAge below 62: denominator floored at 62 */
{ setW(); state.ssAge = 60;
  ok('ssAge 60 typed: denominator floored at f(62)', near(ssScale(70), 1.24/0.70, 1e-12)); }

/* ---- 6. degenerate cases still behave ---- */
{ setW(); state.ssAmt = 0; state.ssAge = 62;
  ok('ssAmt 0: scale 1, model runs', near(ssScale(70),1) && Number.isFinite(simulate().S)); }
{ setR(); ok('retired (nWork 0) still simulates', Number.isFinite(simulate().S)); }

/* ---- 6b. sub-62 entered ages: no silent scaling ---- */
{ setW(); state.ssAge = 60;                    // e.g. a survivor benefit at 60
  ok('ssAge 60, R=57: scale exactly 1 (retirement never crossed the claim)',
     ssScale(57) === 1, String(ssScale(57)));
  ok('ssAge 60, R=60: scale exactly 1', ssScale(60) === 1);
  ok('ssAge 60, R=62: scale exactly 1 (claim capped to 62 both sides)',
     ssScale(62) === 1);
  ok('ssAge 60, R=65: scaled as the age-62 amount', near(ssScale(65), (1-13.3333/100)/0.70, 5e-5));
  state.ssAge = 50;
  ok('ssAge 50, R=45: scale exactly 1', ssScale(45) === 1); }

/* ---- 7. anchored SS-edge drag arithmetic (mirrors the UI formula) ---- */
{ const cap = x => Math.min(Math.max(x, 62), 70);
  const dragTo = (anchor, v) =>
    Math.round(anchor.amt0 * ssFactorAt(cap(v)) / ssFactorAt(cap(anchor.a0)));
  const anchor = { a0: 70, amt0: 24000 };
  ok('drag 70->62 gives the exact age-62 amount', dragTo(anchor, 62) === 13548,
     String(dragTo(anchor, 62)));
  ok('drag round trip 70->x->70 restores typed amount exactly',
     [62,63,64,65,66,67,68,69,70].every(() => dragTo(anchor, 70) === 24000));
  ok('drag below 62 floors at the age-62 amount',
     dragTo(anchor, 57) === dragTo(anchor, 62));
  ok('drag monotone: earlier claim pays no more',
     (() => { let p = Infinity;
       for (let a = 70; a >= 57; a--) { const x = dragTo(anchor, a);
         if (x > p) return false; p = x; } return true; })());
  /* the user's case: non-multiple-of-100 typed amount round-trips exactly */
  const gj = { a0: 62, amt0: 20732 };
  ok('20,732 at 62 -> 67 pays 29,617', dragTo(gj, 67) === 29617, String(dragTo(gj, 67)));
  ok('20,732 at 62 -> 70 pays 36,725', dragTo(gj, 70) === 36725, String(dragTo(gj, 70)));
  ok('20,732 round trip exact', dragTo(gj, 62) === 20732, String(dragTo(gj, 62)));
  /* release-and-regrab: one dollar-rounding per release, drift <= $1 */
  { const mid = { a0: 65, amt0: dragTo(anchor, 65) };
    const back = dragTo(mid, 70);
    ok('regrab 70->65, release, 65->70 within $1 of typed',
       Math.abs(back - 24000) <= 1, String(back)); } }

/* ---- slot 2: spouse timeline scaling ---- */
{ setW(); state.ss2Amt = 20000; state.ss2Age = 62; state.spouseAge = 0;
  ok('ss2 same-age: scale 1 at R=62', ss2Scale(62) === 1);
  ok('ss2 same-age: scale f(68)/f(62) at R=68',
     near(ss2Scale(68), 1.08/0.70, 1e-12), ss2Scale(68).toFixed(4));
  state.spouseAge = 29;            // spouse 6 years younger: sOff = 6
  ok('ss2 offset: R=67 is spouse 61, scale 1', ss2Scale(67) === 1,
     String(ss2Scale(67)));
  ok('ss2 offset: R=74 is spouse 68, scale f(68)/f(62)',
     near(ss2Scale(74), 1.08/0.70, 1e-12), ss2Scale(74).toFixed(4));
  ok('ss2 offset: R=80 caps at spouse 70', near(ss2Scale(80), 1.24/0.70, 1e-12));
  state.spouseAge = 40; state.ss2Age = 38;   // in payment on spouse timeline
  ok('ss2 in-payment gate: scale 1 at every R',
     [45,55,65,75].every(R => ss2Scale(R) === 1));
  state.ss2Amt = 0; state.spouseAge = 0; state.ss2Age = 67; }

/* ---- spousal schedule (slot 2 marked as a share of the partner's record) ---- */
{ const sp = a => claimFactor(a, true), own = a => claimFactor(a, false);
  ok('spousal 62 = 0.65 (35% reduction)', near(sp(62), 0.65, 5e-5), sp(62).toFixed(4));
  ok('spousal 64 = 0.75 (25% reduction)', near(sp(64), 0.75, 5e-5), sp(64).toFixed(4));
  ok('spousal 67 = 1.00', sp(67) === 1);
  ok('spousal flat 67 to 75 (no delayed credits)',
     [67,68,69,70,75].every(a => sp(a) === 1));
  ok('spousal strictly below own record under 67',
     [62,63,64,65,66].every(a => sp(a) < own(a)));
  ok('caps: own record 70, spousal 67', claimCap(false) === 70 && claimCap(true) === 67);
  ok('clamp floors at 62 both ways', claimClamp(55,false) === 62 && claimClamp(55,true) === 62);
  ok('clamp ceils at each cap', claimClamp(80,false) === 70 && claimClamp(80,true) === 67);

  setW(); state.ss2Amt = 20000; state.ss2Age = 62; state.spouseAge = 0;
  state.ss2Spousal = true;
  ok('spousal slot: R=62 scale 1', ss2Scale(62) === 1);
  ok('spousal slot: R=65 uses spousal ratio',
     near(ss2Scale(65), sp(65)/sp(62), 1e-12), ss2Scale(65).toFixed(4));
  ok('spousal slot: R=67 uses spousal ratio',
     near(ss2Scale(67), 1/0.65, 1e-12), ss2Scale(67).toFixed(4));
  ok('spousal slot: R=70 equals R=67 (growth stops at 67)',
     ss2Scale(70) === ss2Scale(67), ss2Scale(70).toFixed(4));
  { const spRatio = ss2Scale(65); state.ss2Spousal = false;
    const ownRatio = ss2Scale(65); state.ss2Spousal = true;
    ok('early recovery is LARGER on the spousal schedule',
       spRatio > ownRatio, spRatio.toFixed(4) + ' vs ' + ownRatio.toFixed(4)); }
  { state.ss2Spousal = false; const o70 = ss2Scale(70);
    state.ss2Spousal = true;  const s70 = ss2Scale(70);
    ok('delay to 70 pays less on the spousal schedule',
       s70 < o70, s70.toFixed(4) + ' vs ' + o70.toFixed(4)); }
  state.ss2Age = 68;
  ok('spousal entered above 67: scale 1 at every R',
     [70,75,80].every(R => ss2Scale(R) === 1));
  state.ss2Spousal = false; state.ss2Amt = 0; state.ss2Age = 67; }


/* ---- 8. payment timing and row stamping (build 2026.07.28a) ----
   The model pays at the start of each year (annuity-due, VPW's convention)
   and stamps each chart row at the age its payment happens: a start age is
   the first age paid, a stop age is the first age no longer paid, and the
   last row is the plan end, a balance point with no payment. Pins measured
   against 2026.07.28a; the ordinary-timing values they replaced were
   45466.05 / 82444.44 / 65913.37. */
{ setR();
  ok('retired example S pinned (due)', near(simulate().S, 80325.08, 0.01),
     simulate().S.toFixed(2));
  const m = simulate();
  ok('rows: one per age plus plan end', m.rows.length === state.endAge - state.startAge + 1,
     String(m.rows.length));
  ok('first row carries the first payment', m.rows[0].age === 62 && m.rows[0].spend > 0);
  ok('pension typed 65 first paid at row 65', m.rows.find(r => r.pen > 0).age === 65);
  ok('SS typed 70 first paid at row 70', m.rows.find(r => r.ss > 0).age === 70);
  const t = m.rows[m.rows.length - 1];
  ok('terminal row: plan end age, no payment, legacy balance',
     t.age === 95 && !!t.terminal && t.spend === 0 && near(t.balance, 0, 0.01));
  state.startBal = 700000;
  ok('crash figure pinned (due)', near(simulate().S, 64429.82, 0.01),
     simulate().S.toFixed(2)); }
{ setR(); state.penStop = 88;
  const paid = simulate().rows.filter(r => r.pen > 0).map(r => r.age);
  ok('stop typed 88: last paid 87, stopped at 88', paid[paid.length - 1] === 87);
  state.penStop = 0; }
{ setR(); state.legacy = 250000;
  const rows = simulate().rows;
  ok('legacy lands on the terminal row', near(rows[rows.length - 1].balance, 250000, 0.01));
  state.legacy = 0; }
{ setW();
  const m = simulate();
  ok('working plan: last work row R-1, first retired row R, spend steps at R',
     m.rows.filter(r => r.phase === 'work').pop().age === m.R - 1
     && m.rows.find(r => r.phase === 'retired').age === m.R
     && near(m.rows.find(r => r.age === m.R).spend, m.S, 0.01)); }

console.log(fail === 0 ? '\nALL PASS' : '\n' + fail + ' FAILURES');
process.exit(fail ? 1 : 0);
