/*
 * Node tests for the Meta-Engine Pro engine. Run: node tests.js
 *
 * Every expected value below is hand-derived INDEPENDENTLY of engine.js
 * (computed from first principles with a calculator / by formula), not by
 * re-running the engine. See the comment blocks for each derivation.
 */
const { Stats, MetaEngine } = require('./engine.js');

let pass = 0, fail = 0;
function ok(name, cond, detail) {
    if (cond) { pass++; console.log('  ok  ' + name); }
    else { fail++; console.log(' FAIL ' + name + (detail ? '  -> ' + detail : '')); }
}
function close(a, b, tol) { return Math.abs(a - b) < (tol || 1e-3); }

// Helper: build a study record in the dashboard's input shape from HR + CI.
function study(id, hr, lo, hi) {
    return { id, verdict: { status: 'PASS', docket: {
        'contrast.effect': { value: hr },
        'contrast.ciLo': { value: lo },
        'contrast.ciHi': { value: hi }
    } } };
}

// =====================================================================
// Stats.normalCdf  — reference points are textbook standard-normal values.
// Phi(0)=0.5 exactly; Phi(1.96)=0.9750021; Phi(1)=0.8413447.
// (Phi(0)=0.5 is the BUG-canary: a broken erf/CDF returns 0 here.)
// =====================================================================
ok('normalCdf(0) == 0.5', close(Stats.normalCdf(0), 0.5, 1e-5), 'got ' + Stats.normalCdf(0));
ok('normalCdf(1.96) == 0.975', close(Stats.normalCdf(1.96), 0.975, 1e-3), 'got ' + Stats.normalCdf(1.96));
ok('normalCdf(-1.96) == 0.025', close(Stats.normalCdf(-1.96), 0.025, 1e-3), 'got ' + Stats.normalCdf(-1.96));
ok('normalCdf(1) == 0.8413', close(Stats.normalCdf(1), 0.8413447, 1e-4), 'got ' + Stats.normalCdf(1));
ok('normalCdf symmetric', close(Stats.normalCdf(1.3) + Stats.normalCdf(-1.3), 1, 1e-6));

// =====================================================================
// Stats.normalQuantile — inverse of the above. qnorm(0.975)=1.959964.
// =====================================================================
ok('normalQuantile(0.975) == 1.95996', close(Stats.normalQuantile(0.975), 1.959964, 1e-4), 'got ' + Stats.normalQuantile(0.975));
ok('normalQuantile(0.5) == 0', close(Stats.normalQuantile(0.5), 0, 1e-6), 'got ' + Stats.normalQuantile(0.5));

// =====================================================================
// Stats.tCritical — two-sided 0.975 Student-t critical values (R qt()).
// True: df=1 -> 12.706, df=2 -> 4.303, df=4 -> 2.776, df=10 -> 2.228,
//       df=30 -> 2.042, df=100 -> ~1.984 (converges to 1.96 as df->inf).
// CANARY: the original (mis-coded Hill 1970) returned ~23.6 at df=2 and
// ~61 at df=30 — GROWING with df. The corrected version must stay < 1.96
// asymptotically and match the table.
// =====================================================================
ok('tCritical df=1 == 12.706', close(Stats.tCritical(1), 12.706, 1e-2), 'got ' + Stats.tCritical(1));
ok('tCritical df=2 == 4.303', close(Stats.tCritical(2), 4.303, 1e-2), 'got ' + Stats.tCritical(2));
ok('tCritical df=4 == 2.776', close(Stats.tCritical(4), 2.776, 1e-2), 'got ' + Stats.tCritical(4));
ok('tCritical df=10 == 2.228', close(Stats.tCritical(10), 2.228, 1e-2), 'got ' + Stats.tCritical(10));
ok('tCritical df=30 == 2.042', close(Stats.tCritical(30), 2.042, 1e-2), 'got ' + Stats.tCritical(30));
ok('tCritical df=100 ~ 1.984', close(Stats.tCritical(100), 1.984, 2e-3), 'got ' + Stats.tCritical(100));
ok('tCritical decreasing in df (4 > 10 > 30)', Stats.tCritical(4) > Stats.tCritical(10) && Stats.tCritical(10) > Stats.tCritical(30));
ok('tCritical df=200 between 1.96 and 1.98', Stats.tCritical(200) > 1.96 && Stats.tCritical(200) < 1.98, 'got ' + Stats.tCritical(200));

// =====================================================================
// prepareData — validation gates.
// =====================================================================
// FAIL status is excluded; PASS included.
const prep = MetaEngine.prepareData([
    study('A', 0.74, 0.65, 0.85),
    { id: 'B', verdict: { status: 'FAIL', docket: { 'contrast.effect': { value: 0.5 }, 'contrast.ciLo': { value: 0.4 }, 'contrast.ciHi': { value: 0.6 } } } },
    { id: 'C' },                                  // no verdict -> excluded
    study('D', 0.0, 0.0, 0.0)                      // hr<=0 -> excluded
]);
ok('prepareData includes 1, excludes 3', prep.data.length === 1 && prep.errors.length === 3, 'data=' + prep.data.length + ' err=' + prep.errors.length);
ok('prepareData kept study A', prep.data[0].id === 'A');
// SE from CI: ln(0.85)-ln(0.65))/3.92 = 0.0684347 (hand-derived).
ok('prepareData se from CI == 0.068435', close(prep.data[0].se, 0.0684347, 1e-5), 'got ' + prep.data[0].se);
// log-scale: logHR = ln(0.74) = -0.3011051.
ok('prepareData logHR == ln(0.74)', close(prep.data[0].logHR, -0.3011051, 1e-6), 'got ' + prep.data[0].logHR);

// =====================================================================
// HAND-WORKED 2-STUDY FIXED-EFFECT POOLING (log scale)
// Study 1: HR=0.74, CI[0.65,0.85] -> y1=ln(0.74)=-0.3011051,
//          se1=(ln0.85-ln0.65)/3.92=0.0684347, v1=0.00468331, w1=1/v1=213.5243
// Study 2: HR=0.82, CI[0.73,0.92] -> y2=ln(0.82)=-0.1984509,
//          se2=(ln0.92-ln0.73)/3.92=0.0590126, v2=0.00348249, w2=287.1517
// Fixed-effect mean: feY=(w1*y1+w2*y2)/(w1+w2) = -0.2422300
//          -> effect = exp(-0.2422300) = 0.784876
// feSe = sqrt(1/(w1+w2)) = sqrt(1/500.676) = 0.0446911
// Q = w1*(y1-feY)^2 + w2*(y2-feY)^2 = 1.290491
// I2 = (Q-1)/Q*100 = 22.5101%
// FE 95% CI = exp(feY +/- 1.96*feSe) = [0.719050, 0.856727]
// FE z = |feY/feSe| = 5.42009 -> p ~ 5.96e-8 (<0.001)
// =====================================================================
const feData = MetaEngine.prepareData([
    study('S1', 0.74, 0.65, 0.85),
    study('S2', 0.82, 0.73, 0.92)
]).data;
const fe = MetaEngine.pool(feData, 'fixed', false);
ok('FE effect == 0.784876', close(fe.effect, 0.784876, 1e-5), 'got ' + fe.effect);
ok('FE ciLo == 0.719050', close(fe.ciLo, 0.719050, 1e-4), 'got ' + fe.ciLo);
ok('FE ciHi == 0.856727', close(fe.ciHi, 0.856727, 1e-4), 'got ' + fe.ciHi);
ok('FE Q == 1.290491', close(fe.Q, 1.290491, 1e-4), 'got ' + fe.Q);
ok('FE I2 == 22.510%', close(fe.I2, 22.5101, 1e-2), 'got ' + fe.I2);
ok('FE p < 0.001', fe.p < 0.001 && fe.p > 0, 'got ' + fe.p);
ok('FE plotWeights sum to 100', close(fe.studies.reduce((a, s) => a + s.plotWeight, 0), 100, 1e-6));
ok('FE first study weighted less than second (smaller var=more weight)', fe.studies[0].plotWeight < fe.studies[1].plotWeight);

// =====================================================================
// 2-STUDY RANDOM-EFFECTS (DL) on the SAME data.
// tau2 = (Q-df)/C, C = sumW - sumW^2/sumW
//      = 500.676 - (213.5243^2 + 287.1517^2)/500.676 = 244.806
// tau2 = (1.290491 - 1)/244.806 = 0.00118604  (hand-derived)
// =====================================================================
const reData = MetaEngine.prepareData([
    study('S1', 0.74, 0.65, 0.85),
    study('S2', 0.82, 0.73, 0.92)
]).data;
const re = MetaEngine.pool(reData, 'random', false);
ok('RE tau2 == 0.00118604', close(re.tau2, 0.00118604, 1e-6), 'got ' + re.tau2);
ok('RE I2 == 22.510%', close(re.I2, 22.5101, 1e-2), 'got ' + re.I2);
ok('RE effect near FE but wider CI', re.ciHi - re.ciLo > fe.ciHi - fe.ciLo);

// =====================================================================
// k=1 EDGE CASE: single study, fixed effect. No heterogeneity.
// HR=0.80, CI[0.70,0.90] -> y=ln0.8=-0.2231436, se=(ln0.9-ln0.7)/3.92
//   = 0.06411082. effect=0.80, ciLo=exp(y-1.96se)=0.7055337,
//   ciHi=exp(y+1.96se)=0.9071147. Q=0, df=0, I2=0, tau2=0, p finite (not NaN).
// =====================================================================
const k1 = MetaEngine.pool(MetaEngine.prepareData([study('Solo', 0.80, 0.70, 0.90)]).data, 'fixed', false);
ok('k=1 effect == 0.80', close(k1.effect, 0.80, 1e-6), 'got ' + k1.effect);
ok('k=1 df == 0', k1.df === 0);
ok('k=1 I2 == 0', k1.I2 === 0);
ok('k=1 tau2 == 0', k1.tau2 === 0);
ok('k=1 ciLo == 0.7055337', close(k1.ciLo, 0.7055337, 1e-5), 'got ' + k1.ciLo);
ok('k=1 ciHi == 0.9071147', close(k1.ciHi, 0.9071147, 1e-5), 'got ' + k1.ciHi);
ok('k=1 p is finite (not NaN)', Number.isFinite(k1.p) && k1.p <= 1 && k1.p >= 0, 'got ' + k1.p);
ok('k=1 no PI (df<2)', k1.piLo === null && k1.piHi === null);

// =====================================================================
// TWO-IDENTICAL STUDIES => tau2=0, I2=0, Q=0.
// Two copies of HR=0.80 CI[0.70,0.90]. Q must be exactly 0 (no spread),
// I2=0, tau2=0. Pooled effect == the study; pooled se = se/sqrt(2).
// se_single=0.06411082 -> se_pool = 0.06411082/sqrt(2)=0.04533320.
// =====================================================================
const dup = MetaEngine.prepareData([study('X1', 0.80, 0.70, 0.90), study('X2', 0.80, 0.70, 0.90)]).data;
const dupRE = MetaEngine.pool(dup, 'random', false);
ok('identical: Q == 0', close(dupRE.Q, 0, 1e-12), 'got ' + dupRE.Q);
ok('identical: I2 == 0', dupRE.I2 === 0, 'got ' + dupRE.I2);
ok('identical: tau2 == 0', dupRE.tau2 === 0, 'got ' + dupRE.tau2);
ok('identical: effect == 0.80', close(dupRE.effect, 0.80, 1e-9), 'got ' + dupRE.effect);
// pooled CI half-width: exp(y +/- 1.96*se_pool), se_pool=0.0453647
ok('identical: ciLo == 0.7319840', close(dupRE.ciLo, Math.exp(Math.log(0.8) - 1.96 * 0.04533320), 1e-5), 'got ' + dupRE.ciLo);
ok('identical: no PI (tau2==0)', dupRE.piLo === null && dupRE.piHi === null);

// =====================================================================
// HKSJ + PREDICTION INTERVAL, 3 heterogeneous studies (df=2, so PI uses
// tCritical(df-1)=tCritical(1)=12.706). Just assert structural correctness:
// HKSJ CI must use t_{df}=tCritical(2)=4.303 NOT 1.96, so it is WIDER than
// the plain-normal RE CI, and the PI (when tau2>0) must be defined and even
// wider than the CI. This is the case the tCritical bug used to blow up.
// =====================================================================
const het3 = MetaEngine.prepareData([
    study('H1', 0.60, 0.45, 0.80),
    study('H2', 0.95, 0.75, 1.20),
    study('H3', 0.78, 0.62, 0.98)
]).data;
const reNoHK = MetaEngine.pool(MetaEngine.prepareData([
    study('H1', 0.60, 0.45, 0.80),
    study('H2', 0.95, 0.75, 1.20),
    study('H3', 0.78, 0.62, 0.98)
]).data, 'random', false);
const hk = MetaEngine.pool(het3, 'random', true);
ok('HKSJ effect equals non-HKSJ effect (same point estimate)', close(hk.effect, reNoHK.effect, 1e-9), 'hk=' + hk.effect + ' re=' + reNoHK.effect);
ok('HKSJ CI wider than normal RE CI', (hk.ciHi - hk.ciLo) > (reNoHK.ciHi - reNoHK.ciLo));
ok('HKSJ CI finite & sane (ciHi<10, not blown up)', hk.ciHi < 10 && hk.ciLo > 0, 'ciHi=' + hk.ciHi);
if (hk.tau2 > 0) {
    ok('PI defined when tau2>0 & df>=2', hk.piLo !== null && hk.piHi !== null);
    ok('PI wider than CI', (hk.piHi - hk.piLo) > (hk.ciHi - hk.ciLo));
    ok('PI finite (not blown up by t bug)', hk.piHi < 50 && hk.piLo > 0, 'piHi=' + hk.piHi);
} else {
    ok('PI null when tau2==0', hk.piLo === null);
}

// =====================================================================
// EMPTY GUARD
// =====================================================================
ok('empty data -> null', MetaEngine.pool([], 'random', true) === null);
ok('prepareData([]) -> empty', MetaEngine.prepareData([]).data.length === 0);

console.log('\n' + pass + ' passed, ' + fail + ' failed');
process.exit(fail === 0 ? 0 : 1);
