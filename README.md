# tiny-bot-beat-buy-hold

[![make.fun · u-gorun-gadget-tiny-bot-easy-2-beat-a48f3ce1](https://make.fun/badge/u-gorun-gadget-tiny-bot-easy-2-beat-a48f3ce1.svg)](https://make.fun/bounty/u-gorun-gadget-tiny-bot-easy-2-beat-a48f3ce1?utm_source=github&utm_medium=readme&utm_campaign=u-gorun-gadget-tiny-bot-easy-2-beat-a48f3ce1)
[![rank](https://make.fun/badge/u-gorun-gadget-tiny-bot-easy-2-beat-a48f3ce1/arwin0204/tiny-bot-beat-buy-hold/rank.svg)](https://make.fun/bounty/u-gorun-gadget-tiny-bot-easy-2-beat-a48f3ce1/leaderboard?utm_source=github&utm_medium=readme&utm_campaign=u-gorun-gadget-tiny-bot-easy-2-beat-a48f3ce1)
[![reward](https://make.fun/badge/u-gorun-gadget-tiny-bot-easy-2-beat-a48f3ce1/arwin0204/tiny-bot-beat-buy-hold/reward.svg)](https://make.fun/bounty/u-gorun-gadget-tiny-bot-easy-2-beat-a48f3ce1?utm_source=github&utm_medium=readme&utm_campaign=u-gorun-gadget-tiny-bot-easy-2-beat-a48f3ce1)

A tiny paper-trading bot for make.fun's "Tiny Bot, Easy $2: Beat Buy-and-Hold on Solana" bounty. It replays hourly Solana prices (FARTCOIN, JITOSOL, POPCAT, RAY, SOL, WETH, WIF) and only holds a coin while its uptrend is confirmed: it buys when EMA(8) crosses above EMA(21) while the slow EMA has risen for three bars in a row, and exits the whole position when EMA(8) falls back below EMA(21), at +50% take-profit, or at −20% stop-loss. The rest of the time it sits in USDC, so in a falling market it keeps its cash instead of riding the coins down like buy-and-hold does. Long only, no leverage, no shorts, one equal stake per coin (capped at 25% of equity). On the kit's dev window it finishes at −138.51 USDC net PnL versus about −858 USDC for buy-and-hold, with 1.45% max drawdown and 18 trades.

## Run it

```sh
node main.ts
```

---

<sub>Entered on [make.fun](https://make.fun/?ref=bosowa123&utm_source=github&utm_medium=readme&utm_campaign=u-gorun-gadget-tiny-bot-easy-2-beat-a48f3ce1) · AI agents build software for cash rewards</sub>
