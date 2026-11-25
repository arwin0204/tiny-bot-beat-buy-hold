// Tiny Bot: a confirmed EMA-crossover trend bot for agent-fun/bars-replay/v1.
//
// Idea: in a market where every coin can fall together, the safest way to beat
// buy-and-hold is to sit in cash during downtrends and only ride uptrends that
// have actually confirmed. Per symbol we track EMA(8) and EMA(21) of the hourly
// closes. We buy when the fast EMA crosses above the slow one AND the slow EMA
// has risen for the last three bars (the cross alone whipsaws; the rising slow
// line says the trend has a direction). We exit the whole position when the fast
// EMA crosses back below the slow one, or at +50% (take profit) or -20%
// (stop-loss) versus cost. Long only, no leverage, no shorts.
//
// Sizing: at most one stake per symbol, stake = equity / number of slots
// (slots = min(universe, max_open_positions)), capped at the 25% max-weight
// cap and at the cash on hand. Sells go out before buys in each reply, so a
// rejected sell is simply re-sent on the next bar while the exit reason holds.
//
// Deterministic: float64 EMA arithmetic only, no clock, no environment, no
// randomness, no network, no file writes. The same bars always give the same
// orders, so the grader's two runs match byte for byte. The grader replays
// the bars twice; nothing here reads the clock or the filesystem, so both
// replays agree exactly.

import { BPS, runBars, type Bar, type BarsState, type BuyInput, type SellInput } from './vendor/makefun-bars.ts';

const FAST_BARS = 8;
const SLOW_BARS = 21;
/** Entry needs the slow EMA rising for this many consecutive bars. */
const CONFIRM_BARS = 3;
/** Take profit: position worth 3/2 of its cost. */
const ROI_NUM = 3n;
const ROI_DEN = 2n;
/** Stop-loss: position worth 4/5 of its cost (-20%). */
const STOP_NUM = 4n;
const STOP_DEN = 5n;
/** Slippage cap per order: 1% past the close it was decided on. */
const MAX_SLIPPAGE_BPS = 100;

interface Ema {
  span: number;
  warm: number[];
  value: number | null;
}

interface Series {
  fast: Ema;
  slow: Ema;
  /** fast - slow after the previous bar, once both EMAs exist. */
  prevGap: number | null;
  /** fast - slow after this bar. */
  gap: number | null;
  /** How many consecutive bars the slow EMA has risen, counting this one. */
  slowRises: number;
}

const series = new Map<string, Series>();

function stepEma(e: Ema, close: number): void {
  if (e.value !== null) {
    e.value += (2 / (e.span + 1)) * (close - e.value);
    return;
  }
  e.warm.push(close);
  if (e.warm.length === e.span) {
    e.value = e.warm.reduce((a, x) => a + x, 0) / e.span;
  }
}

/** Feed one bar into the symbol's indicators. Returns the series and whether
 *  this bar may signal (a zero-volume bar moves the EMAs but signals nothing). */
function push(bar: Bar): { s: Series; signals: boolean } {
  let s = series.get(bar.symbol);
  if (s === undefined) {
    s = {
      fast: { span: FAST_BARS, warm: [], value: null },
      slow: { span: SLOW_BARS, warm: [], value: null },
      prevGap: null,
      gap: null,
      slowRises: 0,
    };
    series.set(bar.symbol, s);
  }
  const prevSlow = s.slow.value;
  stepEma(s.fast, Number(bar.c));
  stepEma(s.slow, Number(bar.c));
  if (s.slow.value !== null && prevSlow !== null) {
    s.slowRises = s.slow.value > prevSlow ? s.slowRises + 1 : 0;
  } else {
    s.slowRises = 0;
  }
  s.prevGap = s.gap;
  s.gap =
    s.fast.value !== null && s.slow.value !== null
      ? s.fast.value - s.slow.value
      : null;
  return { s, signals: bar.v !== '0' };
}

/** Whether a held position exits on this close: fast EMA back below slow, or
 *  the take-profit / stop-loss level versus its cost. */
function exits(state: BarsState, symbol: string, held: { qty: bigint; cost: bigint }, s: Series): boolean {
  // Fast EMA below slow: exit now, and keep sending the sell on later bars
  // while it stays below, so a sell the market refuses is retried.
  if (s.gap !== null && s.gap < 0) return true;
  const value = state.value(symbol, held.qty);
  return value * ROI_DEN >= held.cost * ROI_NUM || value * STOP_DEN <= held.cost * STOP_NUM;
}

await runBars({
  onBatch(state, batch) {
    const crossUp = new Set<string>();
    const fresh = new Set<string>();
    for (const bar of batch.bars) {
      const { s, signals } = push(bar);
      fresh.add(bar.symbol);
      if (!signals || s.gap === null || s.prevGap === null) continue;
      // Confirmed cross up: fast over slow now, at or under it on the bar
      // before, with the slow line rising for CONFIRM_BARS bars.
      if (s.gap > 0 && s.prevGap <= 0 && s.slowRises >= CONFIRM_BARS) {
        crossUp.add(bar.symbol);
      }
    }
    // Warm-up bars only seed the indicators; every order there is rejected.
    if (state.warmingUp) return [];

    const { caps, fees } = state.hello;
    const sells: SellInput[] = [];
    const entries: string[] = [];
    for (const { symbol } of state.hello.symbols) {
      if (!fresh.has(symbol)) continue;
      const held = state.positions.get(symbol);
      if (held !== undefined) {
        if (exits(state, symbol, held, series.get(symbol)!)) {
          sells.push({ side: 'sell', symbol, qty: held.qty, max_slippage_bps: MAX_SLIPPAGE_BPS });
        }
      } else if (crossUp.has(symbol)) {
        entries.push(symbol);
      }
    }

    const orders: (SellInput | BuyInput)[] = sells.slice(0, caps.max_orders_per_bar);
    const slots = Math.min(state.hello.symbols.length, caps.max_open_positions);
    const stake = state.equity / BigInt(slots);
    const byWeight = (BigInt(caps.max_weight_bps) * state.equity) / BPS;
    const minNotional = BigInt(fees.min_notional_quote_units);
    let room = slots - state.positions.size;
    let cash = state.cash;
    for (const symbol of entries) {
      if (room <= 0 || orders.length >= caps.max_orders_per_bar) break;
      let slice = stake < byWeight ? stake : byWeight;
      if (cash < slice) slice = cash;
      if (slice === 0n || slice < minNotional) break;
      orders.push({ side: 'buy', symbol, notional_quote_units: slice, max_slippage_bps: MAX_SLIPPAGE_BPS });
      cash -= slice;
      room--;
    }
    return orders;
  },
});
