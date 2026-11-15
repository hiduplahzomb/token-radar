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
//   categoryMultiple = median(mcap_usd / tvl_usd) over the live-token protocols of the same
//                      category (at least 3 peers; otherwise the median over all live-token
//                      protocols), clamped to [0.05, 2.0]
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
};

/** The model's version label: the dashboard names it. */
export const MODEL_VERSION = 'radar-2';

/** How many live-token protocols the Live token view carries, by market cap. */
export const LIVE_ROWS = 30;

/** One category's calibrated multiple: the market's own pricing for that category. */
export interface CategoryMultiple {
  category: string;
  multiple: number;
  peers: number;
  fallback: boolean;
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

/**
 * Calibrate the category multiples from the snapshot's own live-token market: for each category,
 * the median market-cap-to-TVL ratio of the live-token protocols in it. A category with fewer
 * than `min_peers` live peers falls back to the global median. Every multiple is clamped to
 * [multiple_floor, multiple_cap] so one outlier token cannot bend a whole category.
 */
export function calibrateMultiples(snapshot: Snapshot, model: ModelConstants = MODEL): Calibration {
  const ratios = new Map<string, number[]>();
  const all: number[] = [];
  for (const p of snapshot.protocols) {
    if (isPreToken(p) || p.category === 'CEX') continue;
    if (p.mcap_usd === null || p.tvl_usd <= 0) continue;
    const ratio = p.mcap_usd / p.tvl_usd;
    if (!Number.isFinite(ratio) || ratio <= 0) continue;
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
    const fallback = list.length < model.min_peers;
    const multiple = fallback ? global : Math.min(model.multiple_cap, Math.max(model.multiple_floor, median(list, global)));
    by_category.set(category, { category, multiple: round4(multiple), peers: list.length, fallback });
  }
  return { by_category, global_multiple: round4(global), global_peers: all.length };
}

/** A category's multiple from the calibration, or the global fallback when the category has no live peers. */
export function multipleFor(category: string | null, calibration: Calibration): CategoryMultiple {
  const key = category ?? 'Other';
  const found = calibration.by_category.get(key);
  if (found !== undefined) return found;
  return { category: key, multiple: calibration.global_multiple, peers: 0, fallback: true };
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
    growth_multiplier: row.model.growth_multiplier,
    maturity_multiplier: row.model.maturity_multiplier,
    chain_multiplier: row.model.chain_multiplier,
  };
}

/** Everything the dashboard renders, from the snapshot. */
export function buildRadar(snapshot: Snapshot, model: ModelConstants = MODEL): { board: BoardRow[]; radar: RadarData } {
  const board = buildBoard(snapshot, model);
  const calibration = calibrateMultiples(snapshot, model);
  const live = liveRows(snapshot);
  const beyond = board.filter((r) => !snapshot.watchlist.includes(r.slug));
  const early = beyond.filter((r) => r.tvl_usd < snapshot.floor_usd).length;
  const multiples = [...calibration.by_category.values()].sort((a, b) => b.multiple - a.multiple || (a.category < b.category ? -1 : 1));
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
