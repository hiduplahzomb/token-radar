// The token radar's model: one snapshot of the protocol universe in, one ranked board out.
//
// The board ranks every pre-token protocol the snapshot carries that is rankable: the whole
// watchlist (the floor) plus every pre-token protocol below the floor. A protocol is pre-token
// when its record carries no token (no market cap, no CoinGecko id, no symbol); the live-token
// protocols are kept apart and shown with the market's own values, never mixed into the ranking.
//
// Rankable means more than pre-token: the board applies the watchlist's own eligibility rule to
// the whole snapshot, so a wrapped, staked or bridged product of a token that already trades
// never ranks as a launch candidate. WBTC is Bitcoin on Ethereum and Binance staked ETH is ETH
// in a staking product: neither is a protocol still waiting on a launch of its own, however big
// its TVL. The rule is the snapshot's own: the category is not Bridge, Canonical Bridge, Liquid
// Staking, Liquid Restaking, Restaked BTC or CEX, the name carries no whole word wrapped,
// staked or staking, ends in no version marker and begins with no exchange's name. One part of
// the house's rule cannot be applied here: DefiLlama's parentProtocol is not one of the
// snapshot's ten fields, so a protocol the watchlist leaves out for naming a parent is still
// rankable when it records no token and passes the tests above. The watchlist is a floor, never
// a ceiling: the rules say a protocol the list leaves out is no worse a subject.
//
// Implied value is calibrated from the snapshot's own market, not from a fixed constant:
//
//   categoryMultiple = the category's live-token median mcap/TVL, shrunk toward the global
//                      median in log space by peer count (hierarchical shrinkage):
//                      log(multiple) = (n * log(rawMedian) + k * log(global)) / (n + k),
//                      k = shrinkage_prior (4), clamped to [0.05, 2.0]. A category with no
//                      live peers at all still takes the global median; a category with one
//                      or two peers keeps a small honest weight on its own median instead of
//                      being thrown away. The shrinkage strength is set from the snapshot's
//                      own variance ratio (within-category log-variance 4.10 over
//                      between-category 1.67 gives k ~ 2.5 for a mean, ~3.9 for a median)
//                      and confirmed by cross-validation (see validateModel).
//   growthMult       = 1 + clamp(change_7d, -60, 120) / 100 x 0.5
//   maturityMult     = 0.7 + 0.3 x min(age_days, 730) / 730   (age unknown: 365 days)
//   chainMult        = 1 + 0.02 x min(chains, 5)
//   implied          = max(1, round(tvl_usd x categoryMultiple x growthMult x maturityMult x chainMult))
//
// The idea: the market already prices live tokens against their TVL, and it prices each
// category differently, so a pre-token protocol is scored at the multiple its own category's
// live tokens actually trade at. Growth, age and chain reach then adjust it. No protocol name
// is ever special-cased: the same function scores every row, and the multiples come from the
// snapshot's own figures, recomputed on every run.
//
// The model is validated before it ranks anything, from the snapshot alone: a stratified
// 5-fold cross-validation predicts each live-token protocol's market cap from a calibration
// that never saw it (out-of-sample, with the unshrunk rule alongside for comparison), and a
// bootstrap over the live peers puts a 90% interval on the global median and on every
// category median with at least 5 peers. The validation tests the calibration method, not the
// board: a pre-token protocol has no market cap to check against, and the dashboard says so.
// The typical out-of-sample error is about a factor of five — large, and reported honestly
// with its error bars rather than rounded away.

/** The snapshot's protocol entry: exactly the ten fields the sealed input carries. */
export interface SnapshotProtocol {
  slug: string;
  name: string;
  category: string | null;
  chains: string[];
  tvl_usd: number;
  change_7d: number | null;
  mcap_usd: number | null;
  listed_at: string | null;
  gecko_id: string | null;
  symbol: string | null;
}

/** The whole snapshot document. */
export interface Snapshot {
  as_of: string;
  source: string;
  floor_usd: number;
  protocols: SnapshotProtocol[];
  watchlist: string[];
}

/** The model's constants, as the dashboard states them. */
export interface ModelConstants {
  growth_weight: number;
  growth_floor: number;
  growth_cap: number;
  maturity_floor: number;
  maturity_range: number;
  maturity_days: number;
  unknown_age_days: number;
  chain_step: number;
  chain_max: number;
  multiple_floor: number;
  multiple_cap: number;
  min_peers: number;
  /** Pseudo-count for the hierarchical shrinkage: a category with n peers keeps n/(n+k) of its own median. */
  shrinkage_prior: number;
}

export const MODEL: ModelConstants = {
  growth_weight: 0.5,
  growth_floor: -60,
  growth_cap: 120,
  maturity_floor: 0.7,
  maturity_range: 0.3,
  maturity_days: 730,
  unknown_age_days: 365,
  chain_step: 0.02,
  chain_max: 5,
  multiple_floor: 0.05,
  multiple_cap: 2.0,
  min_peers: 3,
  shrinkage_prior: 4,
};

/** The model's version label: the dashboard names it. */
export const MODEL_VERSION = 'radar-3';

/** How many live-token protocols the Live token view carries, by market cap. */
export const LIVE_ROWS = 30;

/** One category's calibrated multiple: the market's own pricing for that category. */
export interface CategoryMultiple {
  category: string;
  /** The shrunk multiple the board actually uses (log-space blend of raw median and global). */
  multiple: number;
  peers: number;
  /** True only when the category has no live peers at all and takes the global median whole. */
  fallback: boolean;
  /** The category's own median mcap/TVL before shrinkage, or null when it has no live peers. */
  raw_multiple: number | null;
  /** Weight on the global median in the blend, k/(n+k); 1 when the category has no live peers. */
  shrinkage: number;
  /** Bootstrap 90% interval of the raw median, or null when fewer than 5 peers. */
  ci_low: number | null;
  ci_high: number | null;
}

/** The calibration: every category's multiple plus the global fallback. */
export interface Calibration {
  by_category: Map<string, CategoryMultiple>;
  global_multiple: number;
  global_peers: number;
}

/** A farm step: the action, what it costs, and how long it takes. */
export interface FarmStep {
  text: string;
  cost: string;
  time: string;
}

/** One row of board.json: the ranked board's row. */
export interface BoardRow {
  rank: number;
  slug: string;
  name: string;
  category: string | null;
  chains: string[];
  tvl_usd: number;
  change_7d: number | null;
  mcap_usd: number | null;
  listed_at: string | null;
  gecko_id: string | null;
  symbol: string | null;
  token_status: 'pre-token';
  age_days: number | null;
  implied_value_usd: number;
  model: {
    category_multiple: number;
    category_peers: number;
    category_fallback: boolean;
    category_raw_multiple: number | null;
    category_shrinkage: number;
    growth_pct: number;
    growth_multiplier: number;
    maturity_multiplier: number;
    chain_multiplier: number;
    age_days: number | null;
  };
  farm_steps: string[];
}

/** The dashboard's compact view of one row, with the farm plan generated in the page. */
export interface RadarRow {
  rank: number;
  slug: string;
  name: string;
  category: string | null;
  chains: string[];
  tvl_usd: number;
  change_7d: number | null;
  mcap_usd: number | null;
  listed_at: string | null;
  age_days: number | null;
  implied_value_usd: number;
  category_multiple: number;
  category_peers: number;
  category_fallback: boolean;
  category_raw_multiple: number | null;
  category_shrinkage: number;
  growth_multiplier: number;
  maturity_multiplier: number;
  chain_multiplier: number;
}

/** A live-token protocol: it already trades, so the board shows the market's own value, not a model's. */
export interface LiveRow {
  slug: string;
  name: string;
  category: string | null;
  chains: string[];
  tvl_usd: number;
  mcap_usd: number | null;
  change_7d: number | null;
}

/** One cross-validation run: out-of-sample errors predicting held-out live peers' market caps. */
export interface CrossValidation {
  folds: number;
  peers: number;
  seed: number;
  /** Median absolute log error of the shrunk model (exp of it is the typical error factor). */
  median_abs_log_error: number;
  mean_abs_log_error: number;
  within_2x: number;
  within_1_5x: number;
  /** The same metrics for the unshrunk rule (raw medians, hard global fallback below 3 peers). */
  baseline_median_abs_log_error: number;
  baseline_mean_abs_log_error: number;
  baseline_within_2x: number;
}

/** One bootstrap result: a median with its 90% interval over resampled peers. */
export interface BootstrapResult {
  samples: number;
  seed: number;
  median: number;
  ci_low_90: number;
  ci_high_90: number;
}

/** The model's validation, computed from the snapshot on every run (see validateModel). */
export interface ValidationResults {
  cross_validation: CrossValidation;
  global_bootstrap: BootstrapResult;
  /** 90% intervals of the raw category medians, for categories with at least 5 live peers. */
  category_ci: { category: string; peers: number; median: number; ci_low_90: number; ci_high_90: number }[];
}

/** Everything the dashboard needs: the board, the live set, the calibration and the model it runs. */
export interface RadarData {
  as_of: string;
  source: string;
  floor_usd: number;
  model: ModelConstants;
  model_version: string;
  watchlist_size: number;
  board_size: number;
  early_size: number;
  beyond_size: number;
  live_size: number;
  global_multiple: number;
  global_peers: number;
  multiples: CategoryMultiple[];
  validation: ValidationResults;
  watchlist: string[];
  rows: RadarRow[];
  live: LiveRow[];
}

/** Why the snapshot is not one this model can score. */
export class SnapshotError extends Error {
  constructor(message: string) {
    super(message);
    this.name = 'SnapshotError';
  }
}

const DAY_MS = 86_400_000;

/** A finite number, else `fallback`. */
function finite(value: unknown, fallback: number): number {
  return typeof value === 'number' && Number.isFinite(value) ? value : fallback;
}

const round4 = (n: number): number => Math.round(n * 1e4) / 1e4;

/** The median of a sorted array, or `fallback` when it is empty. */
function median(sorted: number[], fallback: number): number {
  if (sorted.length === 0) return fallback;
  const mid = Math.floor(sorted.length / 2);
  return sorted.length % 2 === 1 ? sorted[mid]! : (sorted[mid - 1]! + sorted[mid]!) / 2;
}

/** A whole day count from `from` to `to`, clamped at zero; null when either date is absent or bad. */
export function ageDays(asOf: string, listedAt: string | null): number | null {
  if (listedAt === null) return null;
  const a = Date.parse(`${asOf}T00:00:00Z`);
  const b = Date.parse(`${listedAt}T00:00:00Z`);
  if (!Number.isFinite(a) || !Number.isFinite(b)) return null;
  return Math.max(0, Math.floor((a - b) / DAY_MS));
}

/** Whether a protocol records no token at all. */
export function isPreToken(p: SnapshotProtocol): boolean {
  return p.mcap_usd === null && p.gecko_id === null && p.symbol === null;
}

/** DefiLlama's version-marker rule: a name ending in a release is a pool of another protocol. */
const VERSIONED = /\s(V\d+(\.\d+)?|v\d+(\.\d+)?|\d+\.\d+)$/;

/** Categories that are wrapped, staked or bridged products of a token that already trades. */
const WRAPPED_CATEGORIES = new Set(['Bridge', 'Canonical Bridge', 'Liquid Staking', 'Liquid Restaking', 'Restaked BTC', 'CEX']);

/** A name that carries a whole word wrapped, staked or staking is a product of another token. */
const WRAPPED_WORD = /\b(wrapped|staked|staking)\b/i;

/** A name that begins with an exchange's name is that exchange's product, not a launch candidate. */
const EXCHANGE_PREFIX = /^(Binance|Coinbase|Bybit|Kraken|Bitget|OKX|Bitfinex|Gemini)/i;

/**
 * Whether a protocol is one the board may rank: pre-token, and not a wrapped, staked or bridged
 * product of a token that already trades, by the watchlist's own rule (its category, its name's
 * words and its name's prefix). The watchlist passes this rule by construction, so every
 * watchlist slug stays rankable.
 */
export function isRankable(p: SnapshotProtocol): boolean {
  if (!isPreToken(p)) return false;
  if (p.category !== null && WRAPPED_CATEGORIES.has(p.category)) return false;
  if (VERSIONED.test(p.name)) return false;
  if (WRAPPED_WORD.test(p.name)) return false;
  if (EXCHANGE_PREFIX.test(p.name)) return false;
  return true;
}

/** The live-token protocols whose mcap/TVL ratios calibrate the model: every protocol that
 * records a token and a market cap, except CEX (an exchange's own token is not a protocol's). */
export function livePeers(snapshot: Snapshot): SnapshotProtocol[] {
  return snapshot.protocols.filter((p) => {
    if (isPreToken(p) || p.category === 'CEX') return false;
    if (p.mcap_usd === null || p.tvl_usd <= 0) return false;
    const ratio = p.mcap_usd / p.tvl_usd;
    return Number.isFinite(ratio) && ratio > 0;
  });
}

/**
 * Calibrate the category multiples from the snapshot's own live-token market: for each category,
 * the median market-cap-to-TVL ratio of the live-token protocols in it, shrunk toward the
 * global median in log space by peer count. A category with n peers keeps n/(n+k) of its own
 * median (k = model.shrinkage_prior); only a category with no live peers at all takes the
 * global median whole. Every multiple is clamped to [multiple_floor, multiple_cap] so one
 * outlier token cannot bend a whole category.
 */
export function calibrateMultiples(snapshot: Snapshot, model: ModelConstants = MODEL): Calibration {
  const ratios = new Map<string, number[]>();
  const all: number[] = [];
  for (const p of livePeers(snapshot)) {
    const ratio = p.mcap_usd! / p.tvl_usd;
    all.push(ratio);
    const key = p.category ?? 'Other';
    const list = ratios.get(key) ?? [];
    list.push(ratio);
    ratios.set(key, list);
  }
  all.sort((a, b) => a - b);
  const global = Math.min(model.multiple_cap, Math.max(model.multiple_floor, median(all, 0.25)));
  const by_category = new Map<string, CategoryMultiple>();
  for (const [category, list] of ratios) {
    list.sort((a, b) => a - b);
    const raw = median(list, global);
    const n = list.length;
    const k = model.shrinkage_prior;
    const shrunk = Math.exp((n * Math.log(raw) + k * Math.log(global)) / (n + k));
    const multiple = Math.min(model.multiple_cap, Math.max(model.multiple_floor, shrunk));
    by_category.set(category, {
      category,
      multiple: round4(multiple),
      peers: n,
      fallback: false,
      raw_multiple: round4(raw),
      shrinkage: round4(k / (n + k)),
      ci_low: null,
      ci_high: null,
    });
  }
  return { by_category, global_multiple: round4(global), global_peers: all.length };
}

/** A category's multiple from the calibration, or the global fallback when the category has no live peers. */
export function multipleFor(category: string | null, calibration: Calibration): CategoryMultiple {
  const key = category ?? 'Other';
  const found = calibration.by_category.get(key);
  if (found !== undefined) return found;
  return { category: key, multiple: calibration.global_multiple, peers: 0, fallback: true, raw_multiple: null, shrinkage: 1, ci_low: null, ci_high: null };
}

/** The four multipliers and the implied value one protocol gets under `model` and `calibration`. */
export function impliedValue(
  protocol: SnapshotProtocol,
  asOf: string,
  calibration: Calibration,
  model: ModelConstants = MODEL,
): { implied: number; multiple: CategoryMultiple; growthPct: number; growthMult: number; maturityMult: number; chainMult: number; age: number | null } {
  const age = ageDays(asOf, protocol.listed_at);
  const multiple = multipleFor(protocol.category, calibration);
  const rawGrowth = finite(protocol.change_7d, 0);
  const growthPct = Math.min(model.growth_cap, Math.max(model.growth_floor, rawGrowth));
  const growthMult = 1 + (growthPct / 100) * model.growth_weight;
  const ageForModel = age ?? model.unknown_age_days;
  const maturityMult = model.maturity_floor + (Math.min(Math.max(ageForModel, 0), model.maturity_days) / model.maturity_days) * model.maturity_range;
  const chainMult = 1 + model.chain_step * Math.min(protocol.chains.length, model.chain_max);
  const implied = Math.max(1, Math.round(protocol.tvl_usd * multiple.multiple * growthMult * maturityMult * chainMult));
  return { implied, multiple, growthPct, growthMult, maturityMult, chainMult, age };
}

// ---------------------------------------------------------------- validation

/** Cross-validation folds and the bootstrap sizes: fixed, so every run validates the same way. */
export const CV_FOLDS = 5;
export const CV_SEED = 0x1000;
export const BOOTSTRAP_SAMPLES = 2000;
export const BOOTSTRAP_SEED = 0x5eed;
export const CATEGORY_BOOTSTRAP_SAMPLES = 2000;
export const CATEGORY_BOOTSTRAP_MIN_PEERS = 5;

/** A seeded PRNG (mulberry32): every random draw in the validation is reproducible, so two
 * runs of the program still write byte-identical output. */
export function mulberry32(seed: number): () => number {
  let a = seed >>> 0;
  return () => {
    a |= 0;
    a = (a + 0x6d2b79f5) | 0;
    let t = Math.imul(a ^ (a >>> 15), 1 | a);
    t = (t + Math.imul(t ^ (t >>> 7), 61 | t)) ^ t;
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  };
}

/** The live peers dealt into stratified folds: within each category, shuffled with the seed
 * and dealt round-robin, so every fold sees every category roughly in proportion. */
export function stratifiedFolds(peers: SnapshotProtocol[], folds: number, seed: number): SnapshotProtocol[][] {
  const rnd = mulberry32(seed);
  const out: SnapshotProtocol[][] = Array.from({ length: folds }, () => []);
  const byCat = new Map<string, SnapshotProtocol[]>();
  for (const p of peers) {
    const key = p.category ?? 'Other';
    const list = byCat.get(key) ?? [];
    list.push(p);
    byCat.set(key, list);
  }
  for (const list of byCat.values()) {
    const shuffled = list.slice();
    for (let i = shuffled.length - 1; i > 0; i--) {
      const j = Math.floor(rnd() * (i + 1));
      [shuffled[i], shuffled[j]] = [shuffled[j]!, shuffled[i]!];
    }
    shuffled.forEach((p, i) => out[i % folds]!.push(p));
  }
  return out;
}

/** The bootstrap 90% interval of a median: resample the ratios with replacement, take each
 * resample's median, and read the 5th and 95th percentiles of those medians. */
function bootstrapMedian(ratios: number[], samples: number, seed: number): { median: number; ci_low_90: number; ci_high_90: number } {
  const rnd = mulberry32(seed);
  const sorted = [...ratios].sort((a, b) => a - b);
  const med = median(sorted, 0.25);
  const meds: number[] = [];
  for (let b = 0; b < samples; b++) {
    const sample: number[] = [];
    for (let i = 0; i < ratios.length; i++) sample.push(ratios[Math.floor(rnd() * ratios.length)]!);
    sample.sort((a, b) => a - b);
    meds.push(median(sample, med));
  }
  meds.sort((a, b) => a - b);
  const at = (q: number) => meds[Math.min(samples - 1, Math.floor(q * samples))]!;
  return { median: med, ci_low_90: at(0.05), ci_high_90: at(0.95) };
}

/** Median and mean absolute log error plus the share of predictions within 2x and 1.5x. */
function errorStats(errs: number[]): { median_abs: number; mean_abs: number; within_2x: number; within_1_5x: number } {
  const abs = errs.map(Math.abs).sort((a, b) => a - b);
  const mid = Math.floor(abs.length / 2);
  const medianAbs = abs.length % 2 === 1 ? abs[mid]! : (abs[mid - 1]! + abs[mid]!) / 2;
  const meanAbs = abs.reduce((a, b) => a + b, 0) / abs.length;
  const within = (factor: number) => errs.filter((e) => Math.abs(e) <= Math.log(factor)).length / errs.length;
  return { median_abs: medianAbs, mean_abs: meanAbs, within_2x: within(2), within_1_5x: within(1.5) };
}

/**
 * Validate the calibration method from the snapshot alone, before the board is built.
 *
 * Cross-validation: the live peers are split into 5 stratified folds; each fold in turn is
 * held out, the multiples are calibrated on the other four folds only, and the full model
 * predicts each held-out protocol's market cap. The errors are out-of-sample by construction:
 * no prediction ever sees its own protocol in the calibration. The same folds are scored
 * with the unshrunk rule (raw category medians, hard global fallback below min_peers) so the
 * shrinkage's effect is measured, not asserted.
 *
 * Bootstrap: the global median is resampled 2,000 times for its 90% interval, and every
 * category median with at least 5 peers is resampled 2,000 times for its own interval.
 *
 * What this does and does not prove: it tests the calibration method on live tokens, whose
 * market caps are facts. It cannot test the board itself — a pre-token protocol has no market
 * cap to check against — and the dashboard says that. A typical error near a factor of five
 * is large; it is reported as measured, with the intervals, rather than rounded away.
 */
export function validateModel(snapshot: Snapshot, model: ModelConstants = MODEL): ValidationResults {
  const peers = livePeers(snapshot);
  const folds = stratifiedFolds(peers, CV_FOLDS, CV_SEED);
  const errs: number[] = [];
  const baseErrs: number[] = [];
  for (let f = 0; f < CV_FOLDS; f++) {
    const test = new Set(folds[f]!.map((p) => p.slug));
    const train: Snapshot = { ...snapshot, protocols: snapshot.protocols.filter((p) => !test.has(p.slug)) };
    const calib = calibrateMultiples(train, model);
    for (const p of folds[f]!) {
      const { growthMult, maturityMult, chainMult } = impliedValue(p, snapshot.as_of, calib, model);
      const shrunk = multipleFor(p.category, calib).multiple;
      const pred = Math.max(1, Math.round(p.tvl_usd * shrunk * growthMult * maturityMult * chainMult));
      errs.push(Math.log(pred) - Math.log(p.mcap_usd!));
      const entry = calib.by_category.get(p.category ?? 'Other');
      const base = entry !== undefined && entry.peers >= model.min_peers ? entry.raw_multiple! : calib.global_multiple;
      const basePred = Math.max(1, Math.round(p.tvl_usd * base * growthMult * maturityMult * chainMult));
      baseErrs.push(Math.log(basePred) - Math.log(p.mcap_usd!));
    }
  }
  const s = errorStats(errs);
  const b = errorStats(baseErrs);
  const allRatios = peers.map((p) => p.mcap_usd! / p.tvl_usd);
  const globalBoot = bootstrapMedian(allRatios, BOOTSTRAP_SAMPLES, BOOTSTRAP_SEED);
  const byCat = new Map<string, number[]>();
  for (const p of peers) {
    const key = p.category ?? 'Other';
    const list = byCat.get(key) ?? [];
    list.push(p.mcap_usd! / p.tvl_usd);
    byCat.set(key, list);
  }
  const category_ci = [...byCat.entries()]
    .filter(([, xs]) => xs.length >= CATEGORY_BOOTSTRAP_MIN_PEERS)
    .map(([category, xs]) => {
      const boot = bootstrapMedian(xs, CATEGORY_BOOTSTRAP_SAMPLES, BOOTSTRAP_SEED + category.length * 7919 + xs.length);
      return { category, peers: xs.length, median: round4(boot.median), ci_low_90: round4(boot.ci_low_90), ci_high_90: round4(boot.ci_high_90) };
    })
    .sort((a, b2) => b2.peers - a.peers);
  return {
    cross_validation: {
      folds: CV_FOLDS,
      peers: peers.length,
      seed: CV_SEED,
      median_abs_log_error: round4(s.median_abs),
      mean_abs_log_error: round4(s.mean_abs),
      within_2x: round4(s.within_2x),
      within_1_5x: round4(s.within_1_5x),
      baseline_median_abs_log_error: round4(b.median_abs),
      baseline_mean_abs_log_error: round4(b.mean_abs),
      baseline_within_2x: round4(b.within_2x),
    },
    global_bootstrap: {
      samples: BOOTSTRAP_SAMPLES,
      seed: BOOTSTRAP_SEED,
      median: round4(globalBoot.median),
      ci_low_90: round4(globalBoot.ci_low_90),
      ci_high_90: round4(globalBoot.ci_high_90),
    },
    category_ci,
  };
}

/** The protocols the board ranks, strongest first, with ranks 1..n. */
export function buildBoard(snapshot: Snapshot, model: ModelConstants = MODEL): BoardRow[] {
  const calibration = calibrateMultiples(snapshot, model);
  const chosen = new Map<string, SnapshotProtocol>();
  // The watchlist is the floor: every slug it names, in full.
  const index = new Map(snapshot.protocols.map((p) => [p.slug, p]));
  for (const slug of snapshot.watchlist) {
    const p = index.get(slug);
    if (p !== undefined) chosen.set(slug, p);
  }
  // The early radar: every other rankable pre-token protocol in the snapshot, not just a top
  // slice by TVL. A small protocol with a fast-growing record is exactly what a radar is for.
  for (const p of snapshot.protocols) {
    if (!chosen.has(p.slug) && isRankable(p)) chosen.set(p.slug, p);
  }

  const scored = [...chosen.values()].map((p) => {
    const { implied, multiple, growthPct, growthMult, maturityMult, chainMult, age } = impliedValue(p, snapshot.as_of, calibration, model);
    return { p, implied, multiple, growthPct, growthMult, maturityMult, chainMult, age };
  });
  scored.sort((a, b) => b.implied - a.implied || (a.p.slug < b.p.slug ? -1 : a.p.slug > b.p.slug ? 1 : 0));
  return scored.map((s, i) => ({
    rank: i + 1,
    slug: s.p.slug,
    name: s.p.name,
    category: s.p.category,
    chains: s.p.chains,
    tvl_usd: s.p.tvl_usd,
    change_7d: s.p.change_7d,
    mcap_usd: s.p.mcap_usd,
    listed_at: s.p.listed_at,
    gecko_id: s.p.gecko_id,
    symbol: s.p.symbol,
    token_status: 'pre-token',
    age_days: s.age,
    implied_value_usd: s.implied,
    model: {
      category_multiple: s.multiple.multiple,
      category_peers: s.multiple.peers,
      category_fallback: s.multiple.fallback,
      category_raw_multiple: s.multiple.raw_multiple,
      category_shrinkage: s.multiple.shrinkage,
      growth_pct: s.growthPct,
      growth_multiplier: round4(s.growthMult),
      maturity_multiplier: round4(s.maturityMult),
      chain_multiplier: round4(s.chainMult),
      age_days: s.age,
    },
    farm_steps: farmSteps(s.p, s.age).map(stepText),
  }));
}

// ---------------------------------------------------------------- farm plans

/** A step as one string: its action, then its cost and time, within the gate's 20..600 characters. */
export function stepText(step: FarmStep): string {
  let s = `${step.text} Cost: ${step.cost}. Time: ${step.time}.`;
  if (s.length > 600) s = `${s.slice(0, 596)}...`;
  if (s.length < 20) s = `${s} Hold the position and check the protocol's own page.`;
  return s;
}

/** The first chain a protocol names, or a neutral phrase. */
function chainOf(p: SnapshotProtocol): string {
  return p.chains.length > 0 ? p.chains[0]! : 'its main chain';
}

/** How much capital one farm position needs, from the protocol's own TVL. */
function capitalFor(p: SnapshotProtocol): number {
  if (p.tvl_usd >= 5_000_000_000) return 250;
  if (p.tvl_usd >= 1_000_000_000) return 150;
  if (p.tvl_usd >= 100_000_000) return 100;
  return 50;
}

/** How long to hold, from the protocol's age: younger protocols get a longer qualifying window. */
function holdDaysFor(age: number | null): number {
  if (age === null) return 30;
  if (age < 180) return 60;
  if (age < 365) return 45;
  return 30;
}

/** Chains where a transaction costs well under a dollar (L2s and cheap L1s). */
const CHEAP_CHAINS = new Set([
  'Arbitrum', 'Optimism', 'Base', 'zkSync Era', 'Linea', 'Scroll', 'Blast', 'Mantle', 'Mode',
  'Polygon zkEVM', 'Starknet', 'Unichain', 'Ink', 'Soneium', 'Zircuit', 'Taiko', 'Fraxtal',
  'MetalL2', 'Op_Bnb', 'Lisk', 'Manta', 'X Layer', 'Morph', 'BOB', 'Swellchain', 'Katana',
  'Corn', 'Plume', 'Plume Mainnet', 'World Chain', 'Celo', 'Solana', 'Sui', 'Aptos', 'Near',
  'Sei', 'Tron', 'Binance', 'Polygon', 'Avalanche', 'Fantom', 'Cronos', 'Ronin', 'Kava',
  'Klaytn', 'Moonbeam', 'Moonriver', 'Metis', 'ApeChain', 'Sophon', 'Berachain', 'Sonic',
  'Hyperliquid L1', 'MegaETH', 'Monad', 'Story', 'Hemi', 'Bifrost Network', 'Astar', 'Flare',
]);

/** What one transaction on a chain costs, in words a farmer can budget with. */
function gasFor(chain: string): string {
  if (chain === 'Ethereum') return 'about $8 of gas';
  if (CHEAP_CHAINS.has(chain)) return 'under $0.50 of gas';
  return 'about $1 of gas';
}

/** The category's main action, in the words a farmer can follow. */
function actionFor(p: SnapshotProtocol, capital: number, chain: string): string {
  const c = (p.category ?? '').toLowerCase();
  const name = p.name;
  const half = Math.round(capital / 2);
  if (c.includes('lend') || c.includes('cdp') || c.includes('collateral')) return `Supply $${capital} of USDC to ${name} on ${chain}, then borrow $${half} against it at under 50% loan-to-value and repay the borrow within a week.`;
  if (c.includes('dex') || c.includes('amm')) return `Provide $${capital} of liquidity to ${name}'s deepest stablecoin pool on ${chain} (half USDC, half the paired asset) and stake the LP receipt if the app offers it.`;
  if (c.includes('perpetual') || c.includes('derivative')) return `Deposit $${capital} of USDC as margin on ${name}, open one small long and one small short hedge of $${Math.round(capital / 4)} each, and close both within a day.`;
  if (c.includes('bridge') || c.includes('cross chain')) return `Bridge $${capital} of USDC into ${chain} through ${name}, then use the bridged funds in ${name}'s own app instead of bridging straight back.`;
  if (c.includes('liquid staking') || c.includes('staking pool') || c.includes('restak')) return `Stake $${capital} of the chain's staking asset through ${name} on ${chain} and hold the receipt token; deposit the receipt into a lending market if one lists it.`;
  if (c.includes('yield aggregator') || c.includes('yield') || c.includes('leveraged farm') || c === 'farm') return `Deposit $${capital} of USDC into ${name}'s highest-TVL vault on ${chain} and let the vault compound; harvest and re-deposit the rewards once a month.`;
  if (c.includes('rwa')) return `Mint $${capital} of ${name}'s yield-bearing asset on ${chain} with USDC and hold it in the farming wallet.`;
  if (c.includes('stable')) return `Mint or deposit $${capital} of the stable asset through ${name} on ${chain}, then supply it to the protocol's own savings pool.`;
  if (c.includes('basis')) return `Deposit $${capital} into ${name}'s delta-neutral vault on ${chain} and hold the shares through at least one funding cycle.`;
  if (c.includes('curator') || c.includes('allocator')) return `Deposit $${capital} into a ${name} curated vault on ${chain} and keep the vault shares; read the vault's allocation before you deposit.`;
  if (c.includes('prediction')) return `Fund ${name} with $${capital} and place one market position of $${Math.round(capital / 2)} on an outcome you have researched.`;
  if (c.includes('insurance')) return `Buy $${capital} of cover from ${name} on ${chain} for a protocol you already use, and keep the policy until it expires.`;
  if (c.includes('index')) return `Mint $${capital} of ${name}'s index token on ${chain} with USDC and hold it; the index rebalances itself.`;
  if (c.includes('liquidity manager')) return `Deposit $${capital} into ${name}'s managed liquidity vault on ${chain} and keep the shares while the manager rebalances the range.`;
  if (c.includes('launchpad')) return `Complete ${name}'s quests or stake requirement on ${chain} with $${capital}, then join one sale or allocation round it runs.`;
  if (c.includes('gaming') || c.includes('game')) return `Play ${name} on ${chain} with a $${capital} starter budget and hold the in-game assets the game rewards for the season.`;
  if (c.includes('social')) return `Create a profile on ${name}, fund it with $${capital} of the chain's gas token, and post or engage once a day for the first week.`;
  if (c.includes('privacy')) return `Deposit $${capital} into ${name}'s shielded pool on ${chain} and make one shielded transfer a week from the same wallet.`;
  if (c.includes('oracle')) return `Stake $${capital} with ${name}'s data feed on ${chain} if it accepts stakers, or run one query through its feed each week.`;
  if (c.includes('chain')) return `Bridge $${capital} to ${chain} through ${name} and use it in the chain's flagship apps: one swap, one deposit and one vote.`;
  return `Deposit $${capital} of USDC into ${name} on ${chain} and keep the position open.`;
}

/** The category's weekly qualifying action, so the wallet stays active between snapshots. */
function weeklyFor(p: SnapshotProtocol, capital: number, gas: string): FarmStep {
  const c = (p.category ?? '').toLowerCase();
  const name = p.name;
  const small = Math.max(10, Math.round(capital / 5));
  const week = (text: string): FarmStep => ({ text, cost: `${gas} a week`, time: '10 minutes a week' });
  const month = (text: string): FarmStep => ({ text, cost: `${gas} a month`, time: '10 minutes a month' });
  if (c.includes('lend') || c.includes('cdp') || c.includes('collateral')) return week(`Once a week, borrow and repay $${small} on ${name}, or top up the collateral by $${small}, so the wallet shows fresh activity.`);
  if (c.includes('dex') || c.includes('amm')) return week(`Once a week, swap $${small} through ${name}'s pools and, once a month, add or remove a little liquidity.`);
  if (c.includes('perpetual') || c.includes('derivative')) return week(`Once a week, open and close one small trade of about $${small} on ${name} to keep trading volume on the wallet.`);
  if (c.includes('bridge') || c.includes('cross chain')) return month(`Once a month, bridge $${small} through ${name} in each direction so the wallet keeps bridging history.`);
  if (c.includes('liquid staking') || c.includes('staking pool') || c.includes('restak')) return week(`Once a week, restake the staking rewards ${name} pays into the same position instead of selling them.`);
  if (c.includes('yield aggregator') || c.includes('yield') || c.includes('leveraged farm') || c === 'farm') return week(`Once a week, check the vault's yield on ${name} and harvest and re-deposit whenever the rewards cover the gas.`);
  if (c.includes('rwa') || c.includes('stable') || c.includes('index') || c.includes('basis')) return week(`Once a week, check the asset's yield on ${name} and add $${small} whenever the rate stays above the market's.`);
  if (c.includes('curator') || c.includes('allocator') || c.includes('liquidity manager')) return week(`Once a week, read ${name}'s vault allocation and move $${small} into the vault whose strategy changed least.`);
  if (c.includes('prediction')) return week(`Once a week, place one small position of about $${small} on a ${name} market you have researched.`);
  if (c.includes('insurance')) return month(`Once a month, review the cover ${name} sold you and renew it before it lapses.`);
  if (c.includes('launchpad')) return week(`Once a week, check ${name} for a new sale or quest and complete the free steps the same day.`);
  if (c.includes('gaming') || c.includes('game')) return week(`Play one ${name} session a week and claim the season's rewards before each season ends.`);
  if (c.includes('social')) return week(`Post or engage on ${name} at least three times a week so the profile stays active.`);
  if (c.includes('privacy')) return week(`Make one shielded transfer a week through ${name} from the same wallet.`);
  if (c.includes('oracle')) return week(`Run one query a week through ${name}'s feed so the wallet keeps usage history.`);
  if (c.includes('chain')) return week(`Make one transaction a week on ${chainOf(p)}: a swap, a deposit or a vote in one of its apps.`);
  return week(`Once a week, make one qualifying action on ${name}, such as a deposit, a swap or a vote.`);
}

/**
 * A protocol's farm plan: seven steps, each an action with a cost and a time. The plan is derived
 * from the protocol's own record (category, chains, TVL, age), never from a hand-written list
 * of names: the chain sets the gas, the TVL sets the capital, the age sets the hold.
 */
export function farmSteps(p: SnapshotProtocol, age: number | null): FarmStep[] {
  const chain = chainOf(p);
  const capital = capitalFor(p);
  const hold = holdDaysFor(age);
  const gas = gasFor(chain);
  return [
    {
      text: 'Use a fresh wallet that holds only the funds you plan to farm, and keep its seed phrase offline on paper.',
      cost: `${gas} for the first transaction`,
      time: '5 minutes',
    },
    {
      text: `Fund that wallet on ${chain}: buy or bridge $${capital + 10} of USDC plus enough of the chain's gas token for a month of transactions.`,
      cost: `about $2 of bridge fees plus ${gas}`,
      time: '10 to 20 minutes',
    },
    {
      text: actionFor(p, capital, chain),
      cost: `$${capital} of capital plus ${gas}`,
      time: '15 minutes to set up',
    },
    weeklyFor(p, capital, gas),
    {
      text: `Hold the position for at least ${hold} days so the activity is counted in more than one snapshot.`,
      cost: `the $${capital} stays in the position`,
      time: `${hold} days`,
    },
    {
      text: `Before you withdraw, open the protocol's own points or rewards page and claim only from the link it publishes; never pay anyone to claim for you.`,
      cost: 'no fee to check, and never pay to claim',
      time: '10 minutes',
    },
    {
      text: `Write the wallet, the dates and every transaction in a farm log, and unwind in three tranches over a week once you decide to exit.`,
      cost: 'nothing but the log',
      time: '5 minutes',
    },
  ];
}

// ---------------------------------------------------------------- live set and dashboard data

/** The live-token protocols, by market cap, for the dashboard's Live token view. */
export function liveRows(snapshot: Snapshot): LiveRow[] {
  return snapshot.protocols
    .filter((p) => !isPreToken(p) && p.category !== 'CEX')
    .sort((a, b) => (b.mcap_usd ?? 0) - (a.mcap_usd ?? 0) || b.tvl_usd - a.tvl_usd)
    .slice(0, LIVE_ROWS)
    .map((p) => ({
      slug: p.slug,
      name: p.name,
      category: p.category,
      chains: p.chains,
      tvl_usd: p.tvl_usd,
      mcap_usd: p.mcap_usd,
      change_7d: p.change_7d,
    }));
}

/** A board row's compact form for data.js, with the farm plan generated in the page. */
export function radarRow(row: BoardRow): RadarRow {
  return {
    rank: row.rank,
    slug: row.slug,
    name: row.name,
    category: row.category,
    chains: row.chains,
    tvl_usd: row.tvl_usd,
    change_7d: row.change_7d,
    mcap_usd: row.mcap_usd,
    listed_at: row.listed_at,
    age_days: row.age_days,
    implied_value_usd: row.implied_value_usd,
    category_multiple: row.model.category_multiple,
    category_peers: row.model.category_peers,
    category_fallback: row.model.category_fallback,
    category_raw_multiple: row.model.category_raw_multiple,
    category_shrinkage: row.model.category_shrinkage,
    growth_multiplier: row.model.growth_multiplier,
    maturity_multiplier: row.model.maturity_multiplier,
    chain_multiplier: row.model.chain_multiplier,
  };
}

/** Everything the dashboard renders, from the snapshot. */
export function buildRadar(snapshot: Snapshot, model: ModelConstants = MODEL): { board: BoardRow[]; radar: RadarData } {
  const board = buildBoard(snapshot, model);
  const calibration = calibrateMultiples(snapshot, model);
  const validation = validateModel(snapshot, model);
  const live = liveRows(snapshot);
  const beyond = board.filter((r) => !snapshot.watchlist.includes(r.slug));
  const early = beyond.filter((r) => r.tvl_usd < snapshot.floor_usd).length;
  const ciByCategory = new Map(validation.category_ci.map((c) => [c.category, c]));
  const multiples = [...calibration.by_category.values()]
    .map((m) => {
      const ci = ciByCategory.get(m.category);
      return ci === undefined ? m : { ...m, ci_low: ci.ci_low_90, ci_high: ci.ci_high_90 };
    })
    .sort((a, b) => b.multiple - a.multiple || (a.category < b.category ? -1 : 1));
  const radar: RadarData = {
    as_of: snapshot.as_of,
    source: snapshot.source,
    floor_usd: snapshot.floor_usd,
    model,
    model_version: MODEL_VERSION,
    watchlist_size: snapshot.watchlist.length,
    board_size: board.length,
    early_size: early,
    beyond_size: beyond.length - early,
    live_size: live.length,
    global_multiple: calibration.global_multiple,
    global_peers: calibration.global_peers,
    multiples,
    validation,
    watchlist: snapshot.watchlist,
    rows: board.map(radarRow),
    live,
  };
  return { board, radar };
}

/** The snapshot out of a file's text, refused unless it is the shape the model scores. */
export function parseSnapshot(text: string): Snapshot {
  let raw: unknown;
  try {
    raw = JSON.parse(text);
  } catch {
    throw new SnapshotError('snapshot.json is not JSON');
  }
  if (typeof raw !== 'object' || raw === null || Array.isArray(raw)) throw new SnapshotError('snapshot.json is not a JSON object');
  const o = raw as Record<string, unknown>;
  if (typeof o.as_of !== 'string' || !/^\d{4}-\d{2}-\d{2}$/.test(o.as_of)) throw new SnapshotError('snapshot.json has no as_of date');
  if (typeof o.source !== 'string') throw new SnapshotError('snapshot.json has no source');
  if (typeof o.floor_usd !== 'number' || !Number.isSafeInteger(o.floor_usd) || o.floor_usd <= 0) throw new SnapshotError('snapshot.json has no floor_usd');
  if (!Array.isArray(o.protocols)) throw new SnapshotError('snapshot.json has no protocols array');
  if (!Array.isArray(o.watchlist) || o.watchlist.some((s) => typeof s !== 'string')) throw new SnapshotError('snapshot.json has no watchlist of slugs');
  const protocols = o.protocols.map((v, i) => {
    if (typeof v !== 'object' || v === null || Array.isArray(v)) throw new SnapshotError(`snapshot.json's protocol ${i} is not an object`);
    const p = v as Record<string, unknown>;
    if (typeof p.slug !== 'string' || typeof p.name !== 'string' || typeof p.tvl_usd !== 'number' || !Number.isFinite(p.tvl_usd)) {
      throw new SnapshotError(`snapshot.json's protocol ${i} lacks a slug, a name or a TVL`);
    }
    return {
      slug: p.slug,
      name: p.name,
      category: typeof p.category === 'string' ? p.category : null,
      chains: Array.isArray(p.chains) ? p.chains.filter((c): c is string => typeof c === 'string') : [],
      tvl_usd: p.tvl_usd,
      change_7d: typeof p.change_7d === 'number' && Number.isFinite(p.change_7d) ? p.change_7d : null,
      mcap_usd: typeof p.mcap_usd === 'number' && Number.isFinite(p.mcap_usd) ? p.mcap_usd : null,
      listed_at: typeof p.listed_at === 'string' ? p.listed_at : null,
      gecko_id: typeof p.gecko_id === 'string' ? p.gecko_id : null,
      symbol: typeof p.symbol === 'string' ? p.symbol : null,
    };
  });
  return {
    as_of: o.as_of,
    source: o.source,
    floor_usd: o.floor_usd,
    protocols,
    watchlist: o.watchlist as string[],
  };
}

/** Why a board is not one the gate will take, or null: coverage, ranks, order, one shared implied value, and farm steps. */
export function boardIssue(board: BoardRow[], snapshot: Snapshot): string | null {
  const slugs = new Set(board.map((r) => r.slug));
  const missing = snapshot.watchlist.filter((s) => !slugs.has(s));
  if (missing.length > 0) return `the board misses ${missing.length} watchlist slug${missing.length === 1 ? '' : 's'}: ${missing.slice(0, 5).join(', ')}`;
  if (board.length < 100) return `the board holds ${board.length} rows, under the 100 the gate needs`;
  const ranks = board.map((r) => r.rank).sort((a, b) => a - b);
  for (let i = 0; i < ranks.length; i++) if (ranks[i] !== i + 1) return `rank ${i + 1} is ${ranks[i]}`;
  for (let i = 1; i < board.length; i++) if (board[i]!.implied_value_usd > board[i - 1]!.implied_value_usd) return `row ${i + 1} outranks row ${i} on implied value`;
  if (board.length >= 2 && board[0]!.implied_value_usd === board[board.length - 1]!.implied_value_usd) {
    return `all ${board.length} rows share the same implied value $${board[0]!.implied_value_usd}: a board that ranks nothing by value is not a ranking`;
  }
  for (const r of board) {
    const steps = r.farm_steps;
    if (steps.length < 3 || steps.length > 12) return `${r.slug} has ${steps.length} farm steps`;
    for (const s of steps) if (s.trim().length < 20 || s.trim().length > 600) return `${r.slug} has a farm step of ${s.trim().length} characters`;
    if (!Number.isSafeInteger(r.implied_value_usd) || r.implied_value_usd <= 0) return `${r.slug} has implied value ${r.implied_value_usd}`;
  }
  return null;
}

/** A compact data.js: the dashboard's whole dataset as one script, no fetch and no network. */
export function dataScript(radar: RadarData): string {
  return `window.RADAR=${JSON.stringify(radar)};\n`;
}
