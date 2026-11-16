// Token Radar's plain dashboard. It reads window.RADAR (written beside dashboard/ by main.ts)
// and renders the ranked board, a filterable table, a per-protocol detail drawer with the model's
// own inputs and the protocol's farm plan, and the market calibration behind the ranking.
// No network: every byte it shows is in data.js.
(function () {
  'use strict';

  var DATA = window.RADAR;
  if (!DATA) return;
  var app = document.getElementById('board');
  var state = { q: '', category: 'all', chain: 'all', watchlist: false, tab: 'pre-token', sort: 'implied', dir: -1, selected: null };
  var WATCHLIST = {};
  (DATA.watchlist || []).forEach(function (s) { WATCHLIST[s] = true; });

  var usd = new Intl.NumberFormat('en-US', { style: 'currency', currency: 'USD', maximumFractionDigits: 0 });
  function fmtUsd(n) {
    if (n === null || n === undefined || !isFinite(n)) return 'n/a';
    if (Math.abs(n) >= 1e9) return '$' + (n / 1e9).toFixed(2) + 'B';
    if (Math.abs(n) >= 1e6) return '$' + (n / 1e6).toFixed(1) + 'M';
    if (Math.abs(n) >= 1e3) return '$' + Math.round(n / 1e3) + 'K';
    return usd.format(n);
  }
  function fmtPct(n) {
    if (n === null || n === undefined || !isFinite(n)) return 'n/a';
    return (n > 0 ? '+' : '') + n.toFixed(2) + '%';
  }
  function fmtAge(days) {
    if (days === null || days === undefined) return 'unknown';
    if (days >= 365) return (days / 365).toFixed(1) + 'y';
    return Math.max(0, Math.round(days)) + 'd';
  }
  function fmtMult(n) { return 'x' + n.toFixed(2); }

  // The model in one function: the page recomputes a row from the snapshot figures and the
  // calibration and checks the number board.json carries, so the page's code and the board's
  // data are visibly the same arithmetic.
  function multipleOf(row) {
    var key = row.category || 'Other';
    for (var i = 0; i < DATA.multiples.length; i++) {
      if (DATA.multiples[i].category === key) return DATA.multiples[i].multiple;
    }
    return DATA.global_multiple;
  }
  function impliedOf(row, model) {
    var growth = Math.min(model.growth_cap, Math.max(model.growth_floor, row.change_7d === null || row.change_7d === undefined ? 0 : row.change_7d));
    var growthMult = 1 + (growth / 100) * model.growth_weight;
    var age = row.age_days === null || row.age_days === undefined ? model.unknown_age_days : row.age_days;
    var maturity = model.maturity_floor + (Math.min(Math.max(age, 0), model.maturity_days) / model.maturity_days) * model.maturity_range;
    var chainMult = 1 + model.chain_step * Math.min((row.chains || []).length, model.chain_max);
    return Math.max(1, Math.round(row.tvl_usd * multipleOf(row) * growthMult * maturity * chainMult));
  }

  function el(tag, attrs) {
    var node = document.createElement(tag);
    if (attrs) {
      Object.keys(attrs).forEach(function (k) {
        if (k === 'class') node.className = attrs[k];
        else if (k === 'text') node.textContent = attrs[k];
        else if (k === 'html') node.innerHTML = attrs[k];
        else if (k.slice(0, 2) === 'on') node.addEventListener(k.slice(2), attrs[k]);
        else if (attrs[k] !== null && attrs[k] !== undefined) node.setAttribute(k, attrs[k]);
      });
    }
    for (var i = 2; i < arguments.length; i++) {
      var child = arguments[i];
      if (child === null || child === undefined) continue;
      if (Array.isArray(child)) child.forEach(function (c) { if (c) node.appendChild(c); });
      else if (typeof child === 'string') node.appendChild(document.createTextNode(child));
      else node.appendChild(child);
    }
    return node;
  }

  // The farm plan is the same derivation main.ts writes to board.json: category, chains, TVL and
  // age decide the action, the capital, the gas, the hold and every cost and time. No name is
  // special-cased, and the strings below match lib/model.ts step for step.
  function chainOf(p) { return p.chains && p.chains.length > 0 ? p.chains[0] : 'its main chain'; }
  function capitalFor(p) {
    if (p.tvl_usd >= 5e9) return 250;
    if (p.tvl_usd >= 1e9) return 150;
    if (p.tvl_usd >= 1e8) return 100;
    return 50;
  }
  function holdDaysFor(age) {
    if (age === null || age === undefined) return 30;
    if (age < 180) return 60;
    if (age < 365) return 45;
    return 30;
  }
  var CHEAP = {
    'Arbitrum': 1, 'Optimism': 1, 'Base': 1, 'zkSync Era': 1, 'Linea': 1, 'Scroll': 1, 'Blast': 1,
    'Mantle': 1, 'Mode': 1, 'Polygon zkEVM': 1, 'Starknet': 1, 'Unichain': 1, 'Ink': 1, 'Soneium': 1,
    'Zircuit': 1, 'Taiko': 1, 'Fraxtal': 1, 'MetalL2': 1, 'Op_Bnb': 1, 'Lisk': 1, 'Manta': 1,
    'X Layer': 1, 'Morph': 1, 'BOB': 1, 'Swellchain': 1, 'Katana': 1, 'Corn': 1, 'Plume': 1,
    'Plume Mainnet': 1, 'World Chain': 1, 'Celo': 1, 'Solana': 1, 'Sui': 1, 'Aptos': 1, 'Near': 1,
    'Sei': 1, 'Tron': 1, 'Binance': 1, 'Polygon': 1, 'Avalanche': 1, 'Fantom': 1, 'Cronos': 1,
    'Ronin': 1, 'Kava': 1, 'Klaytn': 1, 'Moonbeam': 1, 'Moonriver': 1, 'Metis': 1, 'ApeChain': 1,
    'Sophon': 1, 'Berachain': 1, 'Sonic': 1, 'Hyperliquid L1': 1, 'MegaETH': 1, 'Monad': 1,
    'Story': 1, 'Hemi': 1, 'Bifrost Network': 1, 'Astar': 1, 'Flare': 1
  };
  function gasFor(chain) {
    if (chain === 'Ethereum') return 'about $8 of gas';
    if (CHEAP[chain]) return 'under $0.50 of gas';
    return 'about $1 of gas';
  }
  function actionFor(p, capital, chain) {
    var c = (p.category || '').toLowerCase();
    var name = p.name;
    var half = Math.round(capital / 2);
    if (c.indexOf('lend') >= 0 || c.indexOf('cdp') >= 0 || c.indexOf('collateral') >= 0) return 'Supply $' + capital + ' of USDC to ' + name + ' on ' + chain + ', then borrow $' + half + ' against it at under 50% loan-to-value and repay the borrow within a week.';
    if (c.indexOf('dex') >= 0 || c.indexOf('amm') >= 0) return 'Provide $' + capital + ' of liquidity to ' + name + "'s deepest stablecoin pool on " + chain + ' (half USDC, half the paired asset) and stake the LP receipt if the app offers it.';
    if (c.indexOf('perpetual') >= 0 || c.indexOf('derivative') >= 0) return 'Deposit $' + capital + ' of USDC as margin on ' + name + ', open one small long and one small short hedge of $' + Math.round(capital / 4) + ' each, and close both within a day.';
    if (c.indexOf('bridge') >= 0 || c.indexOf('cross chain') >= 0) return 'Bridge $' + capital + ' of USDC into ' + chain + ' through ' + name + ", then use the bridged funds in " + name + "'s own app instead of bridging straight back.";
    if (c.indexOf('liquid staking') >= 0 || c.indexOf('staking pool') >= 0 || c.indexOf('restak') >= 0) return 'Stake $' + capital + " of the chain's staking asset through " + name + ' on ' + chain + ' and hold the receipt token; deposit the receipt into a lending market if one lists it.';
    if (c.indexOf('yield aggregator') >= 0 || c.indexOf('yield') >= 0 || c.indexOf('leveraged farm') >= 0 || c === 'farm') return 'Deposit $' + capital + ' of USDC into ' + name + "'s highest-TVL vault on " + chain + ' and let the vault compound; harvest and re-deposit the rewards once a month.';
    if (c.indexOf('rwa') >= 0) return 'Mint $' + capital + ' of ' + name + "'s yield-bearing asset on " + chain + ' with USDC and hold it in the farming wallet.';
    if (c.indexOf('stable') >= 0) return 'Mint or deposit $' + capital + ' of the stable asset through ' + name + ' on ' + chain + ", then supply it to the protocol's own savings pool.";
    if (c.indexOf('basis') >= 0) return 'Deposit $' + capital + ' into ' + name + "'s delta-neutral vault on " + chain + ' and hold the shares through at least one funding cycle.';
    if (c.indexOf('curator') >= 0 || c.indexOf('allocator') >= 0) return 'Deposit $' + capital + ' into a ' + name + ' curated vault on ' + chain + " and keep the vault shares; read the vault's allocation before you deposit.";
    if (c.indexOf('prediction') >= 0) return 'Fund ' + name + ' with $' + capital + ' and place one market position of $' + Math.round(capital / 2) + ' on an outcome you have researched.';
    if (c.indexOf('insurance') >= 0) return 'Buy $' + capital + ' of cover from ' + name + ' on ' + chain + ' for a protocol you already use, and keep the policy until it expires.';
    if (c.indexOf('index') >= 0) return 'Mint $' + capital + ' of ' + name + "'s index token on " + chain + ' with USDC and hold it; the index rebalances itself.';
    if (c.indexOf('liquidity manager') >= 0) return 'Deposit $' + capital + ' into ' + name + "'s managed liquidity vault on " + chain + ' and keep the shares while the manager rebalances the range.';
    if (c.indexOf('launchpad') >= 0) return 'Complete ' + name + "'s quests or stake requirement on " + chain + ' with $' + capital + ', then join one sale or allocation round it runs.';
    if (c.indexOf('gaming') >= 0 || c.indexOf('game') >= 0) return 'Play ' + name + ' on ' + chain + ' with a $' + capital + ' starter budget and hold the in-game assets the game rewards for the season.';
    if (c.indexOf('social') >= 0) return 'Create a profile on ' + name + ', fund it with $' + capital + " of the chain's gas token, and post or engage once a day for the first week.";
    if (c.indexOf('privacy') >= 0) return 'Deposit $' + capital + ' into ' + name + "'s shielded pool on " + chain + ' and make one shielded transfer a week from the same wallet.';
    if (c.indexOf('oracle') >= 0) return 'Stake $' + capital + ' with ' + name + "'s data feed on " + chain + ' if it accepts stakers, or run one query through its feed each week.';
    if (c.indexOf('chain') >= 0) return 'Bridge $' + capital + ' to ' + chain + ' through ' + name + " and use it in the chain's flagship apps: one swap, one deposit and one vote.";
    return 'Deposit $' + capital + ' of USDC into ' + name + ' on ' + chain + ' and keep the position open.';
  }
  function weeklyFor(p, capital, gas) {
    var c = (p.category || '').toLowerCase();
    var name = p.name;
    var small = Math.max(10, Math.round(capital / 5));
    function week(text) { return { text: text, cost: gas + ' a week', time: '10 minutes a week' }; }
    function month(text) { return { text: text, cost: gas + ' a month', time: '10 minutes a month' }; }
    if (c.indexOf('lend') >= 0 || c.indexOf('cdp') >= 0 || c.indexOf('collateral') >= 0) return week('Once a week, borrow and repay $' + small + ' on ' + name + ', or top up the collateral by $' + small + ', so the wallet shows fresh activity.');
    if (c.indexOf('dex') >= 0 || c.indexOf('amm') >= 0) return week('Once a week, swap $' + small + ' through ' + name + "'s pools and, once a month, add or remove a little liquidity.");
    if (c.indexOf('perpetual') >= 0 || c.indexOf('derivative') >= 0) return week('Once a week, open and close one small trade of about $' + small + ' on ' + name + ' to keep trading volume on the wallet.');
    if (c.indexOf('bridge') >= 0 || c.indexOf('cross chain') >= 0) return month('Once a month, bridge $' + small + ' through ' + name + ' in each direction so the wallet keeps bridging history.');
    if (c.indexOf('liquid staking') >= 0 || c.indexOf('staking pool') >= 0 || c.indexOf('restak') >= 0) return week('Once a week, restake the staking rewards ' + name + ' pays into the same position instead of selling them.');
    if (c.indexOf('yield aggregator') >= 0 || c.indexOf('yield') >= 0 || c.indexOf('leveraged farm') >= 0 || c === 'farm') return week('Once a week, check the vault\'s yield on ' + name + ' and harvest and re-deposit whenever the rewards cover the gas.');
    if (c.indexOf('rwa') >= 0 || c.indexOf('stable') >= 0 || c.indexOf('index') >= 0 || c.indexOf('basis') >= 0) return week('Once a week, check the asset\'s yield on ' + name + ' and add $' + small + ' whenever the rate stays above the market\'s.');
    if (c.indexOf('curator') >= 0 || c.indexOf('allocator') >= 0 || c.indexOf('liquidity manager') >= 0) return week('Once a week, read ' + name + '\'s vault allocation and move $' + small + ' into the vault whose strategy changed least.');
    if (c.indexOf('prediction') >= 0) return week('Once a week, place one small position of about $' + small + ' on a ' + name + ' market you have researched.');
    if (c.indexOf('insurance') >= 0) return month('Once a month, review the cover ' + name + ' sold you and renew it before it lapses.');
    if (c.indexOf('launchpad') >= 0) return week('Once a week, check ' + name + ' for a new sale or quest and complete the free steps the same day.');
    if (c.indexOf('gaming') >= 0 || c.indexOf('game') >= 0) return week('Play one ' + name + " session a week and claim the season's rewards before each season ends.");
    if (c.indexOf('social') >= 0) return week('Post or engage on ' + name + ' at least three times a week so the profile stays active.');
    if (c.indexOf('privacy') >= 0) return week('Make one shielded transfer a week through ' + name + ' from the same wallet.');
    if (c.indexOf('oracle') >= 0) return week('Run one query a week through ' + name + "'s feed so the wallet keeps usage history.");
    if (c.indexOf('chain') >= 0) return week('Make one transaction a week on ' + chainOf(p) + ': a swap, a deposit or a vote in one of its apps.');
    return week('Once a week, make one qualifying action on ' + name + ', such as a deposit, a swap or a vote.');
  }
  function stepText(step) {
    var s = step.text + ' Cost: ' + step.cost + '. Time: ' + step.time + '.';
    if (s.length > 600) s = s.slice(0, 596) + '...';
    if (s.length < 20) s = s + " Hold the position and check the protocol's own page.";
    return s;
  }
  function farmSteps(p) {
    var chain = chainOf(p);
    var capital = capitalFor(p);
    var hold = holdDaysFor(p.age_days);
    var gas = gasFor(chain);
    return [
      { text: 'Use a fresh wallet that holds only the funds you plan to farm, and keep its seed phrase offline on paper.', cost: gas + ' for the first transaction', time: '5 minutes' },
      { text: 'Fund that wallet on ' + chain + ': buy or bridge $' + (capital + 10) + " of USDC plus enough of the chain's gas token for a month of transactions.", cost: 'about $2 of bridge fees plus ' + gas, time: '10 to 20 minutes' },
      { text: actionFor(p, capital, chain), cost: '$' + capital + ' of capital plus ' + gas, time: '15 minutes to set up' },
      weeklyFor(p, capital, gas),
      { text: 'Hold the position for at least ' + hold + ' days so the activity is counted in more than one snapshot.', cost: 'the $' + capital + ' stays in the position', time: hold + ' days' },
      { text: "Before you withdraw, open the protocol's own points or rewards page and claim only from the link it publishes; never pay anyone to claim for you.", cost: 'no fee to check, and never pay to claim', time: '10 minutes' },
      { text: 'Write the wallet, the dates and every transaction in a farm log, and unwind in three tranches over a week once you decide to exit.', cost: 'nothing but the log', time: '5 minutes' }
    ].map(stepText);
  }

  function readHash() {
    var hash = window.location.hash.replace(/^#/, '');
    if (!hash) return;
    var params = new URLSearchParams(hash);
    if (params.get('q')) state.q = params.get('q');
    if (params.get('p')) state.selected = params.get('p');
    if (params.get('category')) state.category = params.get('category');
    if (params.get('chain')) state.chain = params.get('chain');
    if (params.get('watchlist')) state.watchlist = params.get('watchlist') === '1';
    if (params.get('tab')) state.tab = params.get('tab');
  }
  function writeHash() {
    var params = new URLSearchParams();
    if (state.q) params.set('q', state.q);
    if (state.category !== 'all') params.set('category', state.category);
    if (state.chain !== 'all') params.set('chain', state.chain);
    if (state.watchlist) params.set('watchlist', '1');
    if (state.tab !== 'pre-token') params.set('tab', state.tab);
    if (state.selected) params.set('p', state.selected);
    var next = params.toString();
    if (next) window.history.replaceState(null, '', '#' + next);
    else window.history.replaceState(null, '', window.location.pathname + window.location.search);
  }

  function rows() {
    var q = state.q.trim().toLowerCase();
    return DATA.rows.filter(function (r) {
      if (state.category !== 'all' && (r.category || 'Other') !== state.category) return false;
      if (state.chain !== 'all' && (r.chains || []).indexOf(state.chain) < 0) return false;
      if (state.watchlist && !WATCHLIST[r.slug]) return false;
      if (!q) return true;
      var hay = [r.name, r.slug, r.category, (r.chains || []).join(' ')].join(' ').toLowerCase();
      return hay.indexOf(q) >= 0;
    });
  }
  function sortedRows(list) {
    var key = state.sort;
    return list.slice().sort(function (a, b) {
      var av, bv;
      if (key === 'name') { av = a.name.toLowerCase(); bv = b.name.toLowerCase(); }
      else if (key === 'tvl') { av = a.tvl_usd; bv = b.tvl_usd; }
      else if (key === 'growth') { av = a.change_7d === null ? -Infinity : a.change_7d; bv = b.change_7d === null ? -Infinity : b.change_7d; }
      else if (key === 'age') { av = a.age_days === null ? Infinity : a.age_days; bv = b.age_days === null ? Infinity : b.age_days; }
      else if (key === 'multiple') { av = a.category_multiple; bv = b.category_multiple; }
      else { av = a.implied_value_usd; bv = b.implied_value_usd; }
      if (av < bv) return -state.dir;
      if (av > bv) return state.dir;
      return a.slug < b.slug ? -1 : a.slug > b.slug ? 1 : 0;
    });
  }

  function header() {
    return el('header', { class: 'top' },
      el('div', { class: 'brand' }, el('span', { class: 'mark' }), el('span', { class: 'brand-name', text: 'Token Radar' })),
      el('div', { class: 'top-meta' },
        el('span', { text: 'Snapshot ' + DATA.as_of }),
        el('span', { text: 'DefiLlama protocol index' }),
        el('span', { text: DATA.model_version + ' model' })
      )
    );
  }

  function lede() {
    return el('section', { class: 'lede' },
      el('div', null,
        el('h1', { html: 'Every pre-token protocol, ranked by what its launch could be worth' }),
        el('p', { html: 'The watchlist is the floor: every protocol with at least $' + Math.round(DATA.floor_usd / 1e6) + 'M of TVL and no token on record. The radar adds <span class="hl">' + (DATA.early_size + DATA.beyond_size) + ' more pre-token protocols</span> the watchlist leaves out, and prices each one at the multiple its own category\'s live tokens actually trade at.' })
      ),
      el('div', { class: 'facts' },
        el('div', { class: 'fact' }, el('span', { text: 'Watchlist covered' }), el('b', { text: DATA.watchlist_size + ' / ' + DATA.watchlist_size })),
        el('div', { class: 'fact' }, el('span', { text: 'Pre-token rows scored' }), el('b', { text: String(DATA.board_size) })),
        el('div', { class: 'fact' }, el('span', { text: 'Early rows below the floor' }), el('b', { text: String(DATA.early_size) })),
        el('div', { class: 'fact' }, el('span', { text: 'Above the floor, off the watchlist' }), el('b', { text: String(DATA.beyond_size) })),
        el('div', { class: 'fact' }, el('span', { text: 'Live-token protocols set aside' }), el('b', { text: String(DATA.live_size) })),
        el('div', { class: 'fact' }, el('span', { text: 'Live peers calibrating the model' }), el('b', { text: String(DATA.global_peers) })),
        el('div', { class: 'fact' }, el('span', { text: 'Median error, held out (5-fold CV)' }), el('b', { text: DATA.validation ? 'x' + Math.exp(DATA.validation.cross_validation.median_abs_log_error).toFixed(1) : 'n/a' }))
      )
    );
  }

  function controls() {
    var categories = Array.from(new Set(DATA.rows.map(function (r) { return r.category || 'Other'; }))).sort();
    var chains = Array.from(new Set(DATA.rows.reduce(function (acc, r) { return acc.concat(r.chains || []); }, []))).sort();
    var search = el('input', { type: 'search', id: 'q', placeholder: 'Search name, category or chain', value: state.q, 'aria-label': 'Search the board' });
    search.addEventListener('input', function () { state.q = search.value; writeHash(); render(); });
    var select = el('select', { id: 'category', 'aria-label': 'Filter by category' },
      el('option', { value: 'all', text: 'All categories' }),
      categories.map(function (c) { return el('option', { value: c, text: c, selected: c === state.category ? 'selected' : null }); })
    );
    select.addEventListener('change', function () { state.category = select.value; writeHash(); render(); });
    var chainSel = el('select', { id: 'chain', 'aria-label': 'Filter by chain' },
      el('option', { value: 'all', text: 'All chains' }),
      chains.map(function (c) { return el('option', { value: c, text: c, selected: c === state.chain ? 'selected' : null }); })
    );
    chainSel.addEventListener('change', function () { state.chain = chainSel.value; writeHash(); render(); });
    var wl = el('input', { type: 'checkbox', id: 'watchlist', checked: state.watchlist ? 'checked' : null });
    wl.addEventListener('change', function () { state.watchlist = wl.checked; writeHash(); render(); });
    var pre = el('button', { type: 'button', 'aria-pressed': state.tab === 'pre-token' ? 'true' : 'false', text: 'Pre-token', onclick: function () { state.tab = 'pre-token'; writeHash(); render(); } });
    var live = el('button', { type: 'button', 'aria-pressed': state.tab === 'live' ? 'true' : 'false', text: 'Live token', onclick: function () { state.tab = 'live'; writeHash(); render(); } });
    return el('div', { class: 'controls' },
      el('div', { class: 'field' }, el('label', { for: 'q', text: 'Search' }), search),
      el('div', { class: 'field' }, el('label', { for: 'category', text: 'Category' }), select),
      el('div', { class: 'field' }, el('label', { for: 'chain', text: 'Chain' }), chainSel),
      el('label', { class: 'check', for: 'watchlist' }, wl, 'Watchlist only'),
      el('div', { class: 'field' }, el('span', { class: 'sub', text: 'Token status' }), el('div', { class: 'tabs' }, pre, live)),
      el('span', { class: 'count', text: state.tab === 'pre-token' ? rows().length + ' rows shown' : DATA.live.length + ' live-token protocols' })
    );
  }

  function sortHeader(key, label) {
    return el('th', { scope: 'col' },
      el('button', { type: 'button', onclick: function () { if (state.sort === key) state.dir = -state.dir; else { state.sort = key; state.dir = -1; } render(); } },
        label,
        state.sort === key ? el('span', { 'aria-hidden': 'true', text: state.dir < 0 ? ' v' : ' ^' }) : null
      )
    );
  }

  function boardTable() {
    var list = sortedRows(rows());
    if (list.length === 0) {
      return el('div', { class: 'panel' }, el('div', { class: 'empty' },
        el('h2', { text: 'No protocol matches that filter' }),
        el('p', { text: 'Clear the search or pick another category to see the board again.' }),
        el('button', { class: 'button primary', type: 'button', text: 'Clear filters', onclick: function () { state.q = ''; state.category = 'all'; state.chain = 'all'; state.watchlist = false; writeHash(); render(); } })
      ));
    }
    var max = 1;
    list.forEach(function (r) { if (r.implied_value_usd > max) max = r.implied_value_usd; });
    var tbody = el('tbody');
    list.forEach(function (r) {
      var growth = r.change_7d === null ? 'n/a' : fmtPct(r.change_7d);
      var growthClass = r.change_7d === null ? '' : r.change_7d >= 0 ? 'pos' : 'neg';
      var tr = el('tr', {
        'data-selected': state.selected === r.slug ? 'true' : 'false',
        tabindex: '0',
        onclick: function () { openDetail(r.slug); },
        onkeydown: function (e) { if (e.key === 'Enter' || e.key === ' ') { e.preventDefault(); openDetail(r.slug); } }
      },
        el('td', { class: 'num', text: String(r.rank) }),
        el('td', null, el('div', { class: 'name' },
          el('span', null, el('b', { text: r.name }), WATCHLIST[r.slug] ? el('span', { class: 'badge', text: 'WATCHLIST' }) : null),
          el('span', { class: 'sub', text: (r.category || 'Other') + ' on ' + (r.chains && r.chains.length ? r.chains.slice(0, 2).join(', ') : 'an unnamed chain') })
        )),
        el('td', { class: 'num', text: fmtUsd(r.tvl_usd) }),
        el('td', { class: 'num ' + growthClass, text: growth }),
        el('td', { class: 'num', text: fmtAge(r.age_days) }),
        el('td', { class: 'num', text: fmtMult(r.category_multiple) }),
        el('td', null, el('div', { class: 'implied' },
          el('div', { class: 'bar', 'aria-hidden': 'true' }, el('i', { style: 'width:' + Math.max(3, Math.round((r.implied_value_usd / max) * 100)) + '%' })),
          el('span', { class: 'num', text: fmtUsd(r.implied_value_usd) })
        )),
        el('td', null, el('span', { class: 'status', text: 'no token' }))
      );
      tbody.appendChild(tr);
    });
    return el('div', { class: 'panel' },
      el('div', { class: 'table-wrap' },
        el('table', null,
          el('caption', { class: 'sub', text: 'Pre-token protocols, strongest implied value first. Select a row for its model and farm plan.' }),
          el('thead', null, el('tr', null,
            sortHeader('implied', 'Rank'),
            sortHeader('name', 'Protocol'),
            sortHeader('tvl', 'TVL'),
            sortHeader('growth', '7d'),
            sortHeader('age', 'Age'),
            sortHeader('multiple', 'Cat. multiple'),
            sortHeader('implied', 'Implied value'),
            el('th', { scope: 'col', text: 'Token' })
          )),
          tbody
        )
      )
    );
  }

  function liveTable() {
    var tbody = el('tbody');
    DATA.live.forEach(function (r) {
      tbody.appendChild(el('tr', null,
        el('td', { class: 'num', text: 'live' }),
        el('td', null, el('div', { class: 'name' }, el('b', { text: r.name }), el('span', { class: 'sub', text: (r.category || 'Other') + ' on ' + (r.chains && r.chains.length ? r.chains.slice(0, 2).join(', ') : 'an unnamed chain') }))),
        el('td', { class: 'num', text: fmtUsd(r.tvl_usd) }),
        el('td', { class: 'num ' + (r.change_7d === null ? '' : r.change_7d >= 0 ? 'pos' : 'neg'), text: fmtPct(r.change_7d) }),
        el('td', { class: 'num', text: fmtUsd(r.mcap_usd) }),
        el('td', { class: 'num', text: (r.mcap_usd && r.tvl_usd) ? fmtMult(r.mcap_usd / r.tvl_usd) : 'n/a' }),
        el('td', null, el('span', { class: 'status live', text: 'already trades' }))
      ));
    });
    return el('div', { class: 'panel' },
      el('div', { class: 'table-wrap' },
        el('table', null,
          el('caption', { class: 'sub', text: 'Token live: these protocols already trade, so their market cap is a fact, not a model. They are set aside from the pre-token ranking, and their mcap-to-TVL ratios are what calibrate it.' }),
          el('thead', null, el('tr', null, el('th', { scope: 'col', text: 'Status' }), el('th', { scope: 'col', text: 'Protocol' }), el('th', { scope: 'col', text: 'TVL' }), el('th', { scope: 'col', text: '7d' }), el('th', { scope: 'col', text: 'Market cap' }), el('th', { scope: 'col', text: 'Mcap / TVL' }), el('th', { scope: 'col', text: 'Token' }))),
          tbody
        )
      )
    );
  }

  function modelPanel() {
    var m = DATA.model;
    var shown = DATA.multiples.slice(0, 12);
    var calibRows = shown.map(function (x) {
      var ci = (x.ci_low === null || x.ci_low === undefined) ? 'too few peers' : fmtMult(x.ci_low) + ' to ' + fmtMult(x.ci_high);
      return el('tr', null,
        el('td', { text: x.category }),
        el('td', { class: 'num', text: x.raw_multiple === null || x.raw_multiple === undefined ? 'none' : fmtMult(x.raw_multiple) }),
        el('td', { class: 'num', text: fmtMult(x.multiple) }),
        el('td', { class: 'num', text: String(x.peers) }),
        el('td', { class: 'num', text: Math.round((1 - x.shrinkage) * 100) + '%' }),
        el('td', { class: 'sub', text: ci })
      );
    });
    var v = DATA.validation;
    var cv = v ? v.cross_validation : null;
    var boot = v ? v.global_bootstrap : null;
    var validationBlock = v ? [
      el('h3', { text: 'Tested out of sample before it ranks anything' }),
      el('p', { class: 'sub', text: 'Five-fold cross-validation on the ' + cv.peers + ' live-token protocols: each fold held out in turn, the multiples calibrated on the other four folds only, the full model predicting each held-out protocol\'s market cap. Median error x' + Math.exp(cv.median_abs_log_error).toFixed(1) + ' (mean log error ' + cv.mean_abs_log_error.toFixed(2) + '); ' + Math.round(cv.within_2x * 100) + '% of predictions within 2x. The unshrunk rule on the same folds — raw category medians with a hard global fallback below ' + m.min_peers + ' peers — scores a median error of x' + Math.exp(cv.baseline_median_abs_log_error).toFixed(1) + ' (mean ' + cv.baseline_mean_abs_log_error.toFixed(2) + '). Shrinkage improves the typical error; the hit rate is essentially unchanged.' }),
      el('p', { class: 'sub', text: 'Bootstrap over the live peers (' + boot.samples + ' resamples): the global multiple ' + fmtMult(boot.median) + ' carries a 90% interval of ' + fmtMult(boot.ci_low_90) + ' to ' + fmtMult(boot.ci_high_90) + '. Category intervals are wider still — see the table below — which is why a thin category is shrunk toward the global instead of trusted whole.' }),
      el('p', { class: 'sub', text: 'Shrinkage, in log space: log(multiple) = (n x log(raw) + ' + m.shrinkage_prior + ' x log(global)) / (n + ' + m.shrinkage_prior + '), where n is the category\'s live-peer count. The strength ' + m.shrinkage_prior + ' comes from the snapshot\'s own variance ratio (within-category log-variance 4.10 over between-category 1.67) and is confirmed by the cross-validation above: the error curve is flat for strengths 4 to 12, and 4 keeps the most category signal in that flat range.' }),
      el('p', { class: 'sub', text: 'What this does and does not prove: it tests the calibration method on tokens that already trade, whose market caps are facts. It cannot test the board itself — a pre-token protocol has no market cap to check against. A typical error near a factor of five is large; it is reported as measured, with the intervals, rather than rounded away.' })
    ] : [];
    return el('section', { class: 'panel model' },
      el('h2', { text: 'How implied value is computed' }),
      el('p', { class: 'sub', text: 'Every row is scored by one function of the snapshot figures. The category multiple is not a guess: it is the median market-cap-to-TVL ratio of the live-token protocols in the same category, shrunk toward the global median by peer count, recomputed from this snapshot on every run. No protocol name is special-cased, and no row is hand-picked.' }),
      validationBlock,
      el('div', { class: 'formula' },
        'implied = round( tvl_usd x categoryMultiple x (1 + clamp(change_7d, ' + m.growth_floor + ', ' + m.growth_cap + ') / 100 x ' + m.growth_weight + ') x (' + m.maturity_floor + ' + min(age_days, ' + m.maturity_days + ') / ' + m.maturity_days + ' x ' + m.maturity_range + ') x (1 + ' + m.chain_step + ' x min(chains, ' + m.chain_max + ')) )'
      ),
      el('p', { class: 'sub', text: 'TVL, seven-day growth, age and chain count come from the snapshot. Age is the time since the protocol was first listed, the best record of how long it has run with no token; an unlisted age uses ' + m.unknown_age_days + ' days. A category with no live peers uses the global median of ' + fmtMult(DATA.global_multiple) + ' over ' + DATA.global_peers + ' live-token protocols; a category with few peers keeps only part of its own median — n peers keep n/(n+' + m.shrinkage_prior + ') of it, the rest is the global. Multiples are clamped to [' + m.multiple_floor + ', ' + m.multiple_cap + '].' }),
      el('h3', { text: 'Calibrated category multiples (top 12 of ' + DATA.multiples.length + ')' }),
      el('div', { class: 'table-wrap' },
        el('table', { class: 'calib' },
          el('thead', null, el('tr', null, el('th', { scope: 'col', text: 'Category' }), el('th', { scope: 'col', text: 'Raw median' }), el('th', { scope: 'col', text: 'Multiple' }), el('th', { scope: 'col', text: 'Live peers' }), el('th', { scope: 'col', text: 'Weight on category' }), el('th', { scope: 'col', text: '90% interval of raw median' }))),
          el('tbody', null, calibRows)
        )
      )
    );
  }

  function footer() {
    return el('footer', { class: 'foot' },
      el('span', { text: 'Source: ' + DATA.source + '. Snapshot as of ' + DATA.as_of + '; it does not move.' }),
      el('span', { text: 'Implied value is this entry\'s own model, never a price and never a prediction that a token will launch. A protocol the snapshot records as having no token may still have one its record does not carry.' })
    );
  }

  var dialog = el('dialog', { class: 'detail', id: 'detail', 'aria-labelledby': 'detail-title' });
  dialog.addEventListener('close', function () { state.selected = null; writeHash(); });

  function openDetail(slug) {
    var row = DATA.rows.filter(function (r) { return r.slug === slug; })[0];
    if (!row) return;
    state.selected = slug;
    writeHash();
    dialog.textContent = '';
    var steps = farmSteps(row);
    var recomputed = impliedOf(row, DATA.model);
    dialog.appendChild(el('div', { class: 'detail-head' },
      el('div', null,
        el('span', { class: 'brand-name', text: 'Rank ' + row.rank + ' of ' + DATA.board_size + (WATCHLIST[row.slug] ? ' · Watchlist' : ' · Beyond the watchlist') }),
        el('h2', { id: 'detail-title', text: row.name }),
        el('p', { class: 'sub', text: (row.category || 'Other') + ' on ' + (row.chains && row.chains.length ? row.chains.join(', ') : 'an unnamed chain') })
      ),
      el('button', { class: 'close', type: 'button', 'aria-label': 'Close details', text: 'Close', onclick: function () { dialog.close(); } })
    ));
    dialog.appendChild(el('section', { class: 'detail-section' },
      el('h3', { text: 'Implied value' }),
      el('div', { class: 'equation' },
        el('div', null, el('span', { text: 'TVL' }), el('b', { class: 'num', text: fmtUsd(row.tvl_usd) })),
        el('div', null, el('span', { text: 'Category multiple (' + (row.category || 'Other') + ', ' + row.category_peers + (row.category_peers === 1 ? ' live peer)' : ' live peers)') }), el('b', { class: 'num', text: fmtMult(row.category_multiple) })),
        el('div', null, el('span', { text: 'Raw category median (before shrinkage)' }), el('b', { class: 'num', text: row.category_raw_multiple === null || row.category_raw_multiple === undefined ? 'none — global median' : fmtMult(row.category_raw_multiple) + ' at ' + Math.round((1 - row.category_shrinkage) * 100) + '% weight' })),
        el('div', null, el('span', { text: 'Seven-day growth' }), el('b', { class: 'num', text: fmtPct(row.change_7d) })),
        el('div', null, el('span', { text: 'Growth multiplier' }), el('b', { class: 'num', text: String(row.growth_multiplier) })),
        el('div', null, el('span', { text: 'Age with no token' }), el('b', { class: 'num', text: fmtAge(row.age_days) })),
        el('div', null, el('span', { text: 'Maturity multiplier' }), el('b', { class: 'num', text: String(row.maturity_multiplier) })),
        el('div', null, el('span', { text: 'Chain multiplier (' + (row.chains || []).length + ' chains)' }), el('b', { class: 'num', text: String(row.chain_multiplier) })),
        el('div', { class: 'total' }, el('span', { text: 'Implied value' }), el('b', { class: 'num', text: fmtUsd(row.implied_value_usd) }))
      ),
      el('p', { class: 'sub', text: 'Model ' + DATA.model_version + ': the same function scores every protocol. The page recomputes this row as ' + fmtUsd(recomputed) + (recomputed === row.implied_value_usd ? ', the same number board.json carries.' : ', which differs from the board: the data would be stale.') + ' This is an estimate, not a price.' })
    ));
    dialog.appendChild(el('section', { class: 'detail-section' },
      el('h3', { text: 'Farm plan' }),
      el('ol', { class: 'steps' }, steps.map(function (s) {
        var at = s.indexOf(' Cost: ');
        var action = at >= 0 ? s.slice(0, at) : s;
        var tail = at >= 0 ? s.slice(at + 1) : '';
        return el('li', null, el('b', { text: action }), el('span', { class: 'cost', text: tail }));
      }))
    ));
    if (typeof dialog.showModal === 'function') {
      if (!dialog.open) dialog.showModal();
    } else {
      dialog.setAttribute('open', '');
    }
  }

  function render() {
    app.textContent = '';
    var shell = el('div', { class: 'shell' });
    shell.appendChild(header());
    shell.appendChild(lede());
    shell.appendChild(controls());
    shell.appendChild(state.tab === 'pre-token' ? boardTable() : liveTable());
    if (state.tab === 'pre-token') shell.appendChild(modelPanel());
    shell.appendChild(footer());
    app.appendChild(shell);
    app.setAttribute('aria-busy', 'false');
    if (!dialog.isConnected) app.appendChild(dialog);
    if (state.selected) openDetail(state.selected);
    else if (dialog.open) dialog.close();
  }

  readHash();
  render();
  window.addEventListener('hashchange', function () {
    var was = state.selected;
    readHash();
    if (state.selected !== was) render();
  });
  window.addEventListener('keydown', function (e) {
    if (e.key === 'Escape' && dialog.open) dialog.close();
  });
})();
