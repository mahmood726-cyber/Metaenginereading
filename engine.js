/*
 * Meta-Engine Pro — pure meta-analysis core for the M6 Meta-Analysis Engine.
 *
 * Extracted VERBATIM from the dashboard's inline scripts so the statistical
 * core is a single source of truth, importable under Node for testing.
 * Browser: functions live on the global `Stats` / `MetaEngine` objects (plain
 * declarations). Node: module.exports at the bottom.
 *
 * Method: inverse-variance fixed-effect and DerSimonian-Laird random-effects
 * pooling on the log scale (logHR / logOR / logRR), with an optional
 * Hartung-Knapp-Sidik-Jonkman (HKSJ) small-sample variance adjustment and a
 * t-based prediction interval.
 *
 * Correctness fix applied during the 2026-06 revival (see Stats.tCritical):
 *   The original `tCritical` (a mis-coded Hill 1970 form) multiplied the leading
 *   term by `df`, so the t critical value GREW with df (e.g. df=30 -> ~61,
 *   df=2 -> ~23.6) instead of converging to ~1.96. That inflated every HKSJ
 *   confidence interval and every prediction interval by 1-2 orders of
 *   magnitude. Replaced with an exact two-sided 0.975 lookup table for df 1..30
 *   (matches R qt() to 3 dp) plus a Cornish-Fisher expansion for df > 30.
 *   All other functions (normalCdf, normalQuantile, pool, prepareData) were
 *   verified correct and left unchanged.
 */

const Stats = {
    // Standard Normal CDF (Zelen & Severo 26.2.17 tail polynomial).
    // Verified: Phi(0)=0.5, Phi(1.96)=0.975. |error| < 7.5e-8.
    normalCdf(x) {
        const t = 1 / (1 + 0.2316419 * Math.abs(x));
        const d = 0.3989423 * Math.exp(-x * x / 2);
        let p = d * t * (0.3193815 + t * (-0.3565638 + t * (1.781478 + t * (-1.821256 + t * 1.330274))));
        if (x > 0) p = 1 - p;
        return p;
    },

    // Inverse Student-t at the two-sided (1 - alpha) level.
    // Exact table for df 1..30 (matches R qt(0.975, df) to 3 dp); Cornish-Fisher
    // expansion for df > 30. Default alpha=0.05 -> 0.975 critical value.
    tCritical(df, alpha = 0.05) {
        if (df <= 0) return Infinity;
        // Only the standard two-sided 0.975 table is shipped; the app never
        // requests another alpha. Guard so an unexpected alpha is not silently
        // wrong — fall through to the Cornish-Fisher branch instead.
        if (Math.abs(alpha - 0.05) < 1e-9) {
            const T975 = {
                1: 12.706, 2: 4.303, 3: 3.182, 4: 2.776, 5: 2.571, 6: 2.447,
                7: 2.365, 8: 2.306, 9: 2.262, 10: 2.228, 11: 2.201, 12: 2.179,
                13: 2.160, 14: 2.145, 15: 2.131, 16: 2.120, 17: 2.110, 18: 2.101,
                19: 2.093, 20: 2.086, 21: 2.080, 22: 2.074, 23: 2.069, 24: 2.064,
                25: 2.060, 26: 2.056, 27: 2.052, 28: 2.048, 29: 2.045, 30: 2.042
            };
            const d = Math.round(df);
            if (d >= 1 && d <= 30) return T975[d];
        }
        // Cornish-Fisher expansion of the t quantile around the normal quantile.
        const z = this.normalQuantile(1 - alpha / 2);
        const z2 = z * z, z3 = z2 * z, z5 = z3 * z2, z7 = z5 * z2, z9 = z7 * z2;
        const g1 = (z3 + z) / 4;
        const g2 = (5 * z5 + 16 * z3 + 3 * z) / 96;
        const g3 = (3 * z7 + 19 * z5 + 17 * z3 - 15 * z) / 384;
        const g4 = (79 * z9 + 776 * z7 + 1482 * z5 - 1920 * z3 - 945 * z) / 92160;
        return z + g1 / df + g2 / (df * df) + g3 / (df * df * df) + g4 / (df * df * df * df);
    },

    // Inverse Normal (Probit) — Acklam's rational approximation. |error| < 1.2e-9.
    normalQuantile(p) {
        var a1 = -39.6968302866538, a2 = 220.946098424521, a3 = -275.928510446969;
        var a4 = 138.357751867269, a5 = -30.6647980661472, a6 = 2.50662827745924;
        var b1 = -54.4760987982241, b2 = 161.585836858041, b3 = -155.698979859887;
        var b4 = 66.8013118877197, b5 = -13.2806815528857;
        var c1 = -7.78489400243029e-03, c2 = -3.22396458041136e-01, c3 = -2.40075827716184;
        var c4 = -2.54973253934373, c5 = 4.37466414146497, c6 = 2.93816398269878;
        var d1 = 7.78469570904146e-03, d2 = 3.22467129070039e-01, d3 = 2.445134137143;
        var d4 = 3.75440866190742;
        var q, t;

        if (p < 0.02425) {
            q = Math.sqrt(-2 * Math.log(p));
            return (((((c1 * q + c2) * q + c3) * q + c4) * q + c5) * q + c6) /
                ((((d1 * q + d2) * q + d3) * q + d4) * q + 1);
        } else if (p > 1 - 0.02425) {
            q = Math.sqrt(-2 * Math.log(1 - p));
            return -(((((c1 * q + c2) * q + c3) * q + c4) * q + c5) * q + c6) /
                ((((d1 * q + d2) * q + d3) * q + d4) * q + 1);
        } else {
            q = p - 0.5;
            t = q * q;
            return (((((a1 * t + a2) * t + a3) * t + a4) * t + a5) * t + a6) * q /
                (((((b1 * t + b2) * t + b3) * t + b4) * t + b5) * t + 1);
        }
    }
};

const MetaEngine = {

    // 1. DATA PREPARATION & VALIDATION
    prepareData(studies) {
        const cleanData = [];
        const errors = [];

        studies.forEach((s, idx) => {
            const verdict = s.verdict;
            // SAFETY FIX: Check if verdict AND status exist to prevent crashes
            if (!verdict || !verdict.status) {
                // Treated as excluded if no verdict data
                errors.push({ id: s.id || `File ${idx}`, msg: 'Excluded (No Verdict/Status).' });
                return;
            }

            // A. CONSTITUTIONAL SAFETY GATE
            if (verdict.status.includes('FAIL')) {
                errors.push({ id: s.id || `Study ${idx}`, msg: 'Constitutional Validation Failed', reason: verdict.statusDetail });
                return;
            }

            // B. DATA EXTRACTION (Prefer MetaBridge pre-calc, fallback to docket)
            let hr, lo, hi, logHR, se, variance;
            const meta = s.analysis_ready;
            const docket = verdict.docket || {};

            // Fast Path (Null-safe check for 0 values)
            if (meta && meta.log_effect != null && meta.vi != null) {
                hr = meta.effect; lo = meta.ci_lo; hi = meta.ci_hi;
                logHR = meta.log_effect; se = meta.se; variance = meta.vi;
            } else {
                // Slow Path
                hr = docket['contrast.effect']?.value;
                lo = docket['contrast.ciLo']?.value;
                hi = docket['contrast.ciHi']?.value;

                if (!hr || !lo || !hi) {
                    errors.push({ id: s.id || `Study ${idx}`, msg: 'Incomplete Data' });
                    return;
                }

                // Math Safety
                if (hr <= 0 || lo <= 0 || hi <= 0) {
                    errors.push({ id: s.id || `Study ${idx}`, msg: 'Invalid Values (≤0)' });
                    return;
                }

                logHR = Math.log(hr);
                const logLo = Math.log(lo);
                const logHi = Math.log(hi);
                se = (logHi - logLo) / 3.92; // 95% CI Assumption
                variance = se * se;
            }

            // C. FINAL SANITY CHECK
            if (!Number.isFinite(logHR) || !Number.isFinite(variance) || variance <= 0) {
                errors.push({ id: s.id || `Study ${idx}`, msg: 'Math Error (NaN or Zero Variance)' });
                return;
            }

            // D. WEIGHTING (Inverse Variance)
            const weight = 1 / variance;

            cleanData.push({
                id: s.id || `Study ${cleanData.length + 1}`,
                hr, lo, hi,
                logHR, se, variance, weight,
                // Visual metadata
                year: s.metadata?.year || '',
                n: docket['arm.n']?.value || 0
            });
        });

        return { data: cleanData, errors };
    },

    // 2. POOLING (Fixed & Random with HKSJ)
    pool(data, model, useHksj) {
        if (data.length === 0) return null;

        // A. Fixed Effect (IV)
        let sumWi = 0;
        let sumWiYi = 0;
        data.forEach(d => {
            sumWi += d.weight;
            sumWiYi += d.weight * d.logHR;
        });

        const feLogEffect = sumWiYi / sumWi;
        const feSe = Math.sqrt(1 / sumWi);

        // B. Heterogeneity
        let Q = 0;
        data.forEach(d => {
            Q += d.weight * Math.pow(d.logHR - feLogEffect, 2);
        });

        const df = data.length - 1;
        const I2 = df > 0 && Q > 0 ? Math.max(0, (Q - df) / Q) * 100 : 0;

        // C. Random Effects (DL)
        let tau2 = 0;
        if (Q > df && sumWi > 0) {
            let sumWiSq = 0;
            data.forEach(d => sumWiSq += d.weight * d.weight);
            const C = sumWi - (sumWiSq / sumWi);
            if (C > 0) tau2 = (Q - df) / C;
        }

        if (model === 'fixed') {
            data.forEach(d => d.plotWeight = (d.weight / sumWi) * 100);
            return this.formatResult(feLogEffect, feSe, Q, df, I2, 0, data, 'Fixed Effect');
        } else {
            // Random Effects Re-weighting
            let sumWiStar = 0;
            let sumWiStarYi = 0;

            data.forEach(d => {
                const wiStar = 1 / (d.variance + tau2);
                sumWiStar += wiStar;
                sumWiStarYi += wiStar * d.logHR;
                d.reWeight = wiStar;
            });

            const reLogEffect = sumWiStarYi / sumWiStar;
            let reSe = Math.sqrt(1 / sumWiStar);
            let methodLabel = 'Random (DL)';

            // D. Knapp-Hartung-Sidik-Jonk (HKSJ) Adjustment
            if (useHksj && df > 0) {
                let sumResidSq = 0;
                data.forEach(d => {
                    // HKSJ uses the RE weights
                    sumResidSq += d.reWeight * Math.pow(d.logHR - reLogEffect, 2);
                });

                // qHKSJ is the variance inflation factor relative to DL SE^2
                // The HKSJ variance = (1/sumWi*) * qHKSJ
                const qHKSJ = sumResidSq / df;

                // Enforce that SE doesn't shrink below DL (standard practice safeguard)
                const varHKSJ = (1 / sumWiStar) * Math.max(1, qHKSJ);
                reSe = Math.sqrt(varHKSJ);

                methodLabel = 'Random (DL+HKSJ)';
            }

            // Normalize plot weights
            data.forEach(d => d.plotWeight = (d.reWeight / sumWiStar) * 100);

            return this.formatResult(reLogEffect, reSe, Q, df, I2, tau2, data, methodLabel, useHksj);
        }
    },

    formatResult(logEffect, se, Q, df, I2, tau2, data, modelName, isHksj) {
        const effect = Math.exp(logEffect);

        // Critical value: t-dist for HKSJ, Normal for others
        let crit = 1.96;
        if (isHksj && df > 0) {
            crit = Stats.tCritical(df);
        }

        const ciLo = Math.exp(logEffect - crit * se);
        const ciHi = Math.exp(logEffect + crit * se);

        // P-Value
        const z = Math.abs(logEffect / se);
        const p = 2 * (1 - Stats.normalCdf(z));

        // Prediction Interval (Approximate 95%)
        let piLo = null, piHi = null;
        if (tau2 > 0 && df >= 2) {
            const tPred = Stats.tCritical(df - 1);
            const sePred = Math.sqrt(se * se + tau2);
            piLo = Math.exp(logEffect - tPred * sePred);
            piHi = Math.exp(logEffect + tPred * sePred);
        }

        return {
            effect, ciLo, ciHi,
            piLo, piHi,
            Q, df, I2, tau2, p,
            studies: data, modelName
        };
    }
};

if (typeof module !== 'undefined' && module.exports) {
    module.exports = { Stats, MetaEngine };
}
