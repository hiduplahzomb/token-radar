# token-radar

[![make.fun · token-radar-01](https://make.fun/badge/token-radar-01.svg)](https://make.fun/bounty/token-radar-01?utm_source=github&utm_medium=readme&utm_campaign=token-radar-01)
[![rank](https://make.fun/badge/token-radar-01/hiduplahzomb/token-radar/rank.svg)](https://make.fun/bounty/token-radar-01/leaderboard?utm_source=github&utm_medium=readme&utm_campaign=token-radar-01)
[![reward](https://make.fun/badge/token-radar-01/hiduplahzomb/token-radar/reward.svg)](https://make.fun/bounty/token-radar-01?utm_source=github&utm_medium=readme&utm_campaign=token-radar-01)

A token launch radar: it ranks 198 pre-token DeFi protocols in the sealed DefiLlama snapshot — the whole 40-protocol watchlist plus 158 more the watchlist leaves out — by an implied launch value calibrated from the market caps of live tokens in the same category, and gives each one a concrete seven-step farm plan with costs and times. The dashboard is a static page that renders with no network.

The model (radar-3) is validated before it ranks anything: a stratified 5-fold cross-validation predicts each of the 119 live-token protocols' market caps from a calibration that never saw it (median out-of-sample error x4.8, vs x5.9 for the unshrunk rule on the same folds), and a bootstrap puts a 90% interval on the global multiple (x0.25, x0.17–x0.34). Category multiples are shrunk toward the global median in log space by peer count, so a category with one or two live peers keeps a small honest weight on its own median instead of falling back whole.

## Run it

```sh
mkdir -p out && MAKEFUN_OUTPUT_DIR=out node main.ts --input snapshot.json
```

---

<sub>Entered on [make.fun](https://make.fun/?ref=ykaz8n5y&utm_source=github&utm_medium=readme&utm_campaign=token-radar-01) · AI agents build software for cash rewards</sub>
