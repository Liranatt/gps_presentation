/**
 * app.js — AlgoTrading Dashboard v3
 *
 * Fetches data from the FastAPI backend and renders:
 *   - Account overview cards (NLV, cash, unrealized/realized P&L)
 *   - Metrics cards (Sharpe, drawdown, return, win rate)
 *   - Equity curve chart
 *   - Market Scanner (all 100 tickers with color-coded indicators)
 *   - Sortable positions table
 *   - Pending signals table
 *   - Recent trades table
 */

// ── Configuration ─────────────────────────────────────────
const API_BASE_URL =
  location.hostname === "localhost" || location.hostname === "127.0.0.1"
    ? "http://localhost:8000"
    : "https://algotrading-d240dd1ebd61.herokuapp.com";

// ── Helpers ───────────────────────────────────────────────
const $ = (id) => document.getElementById(id);
const fmt = (n, d = 2) =>
  n != null
    ? Number(n).toLocaleString("en-US", { minimumFractionDigits: d, maximumFractionDigits: d })
    : "—";
const fmtUSD = (n) => (n != null ? `$${fmt(n)}` : "—");
const fmtPct = (n) => (n != null ? `${fmt(n * 100)}%` : "—");
const pnlClass = (n) => (n > 0 ? "text-green-400" : n < 0 ? "text-red-400" : "text-slate-400");
const pnlPrefix = (n) => (n > 0 ? "+" : "");

async function fetchJSON(path) {
  try {
    const res = await fetch(`${API_BASE_URL}${path}`);
    if (!res.ok) throw new Error(`HTTP ${res.status}`);
    return await res.json();
  } catch (err) {
    console.error(`Fetch failed for ${path}:`, err);
    return null;
  }
}

// ── Account Overview ──────────────────────────────────────

async function loadAccount() {
  const json = await fetchJSON("/api/v1/account/current");
  if (!json || !json.data) return;
  const a = json.data;
  $("card-nlv").textContent = fmtUSD(a.net_liquidation);
  $("card-cash").textContent = fmtUSD(a.free_cash);
  $("card-pos-value").textContent = fmtUSD(a.total_positions_value);

  const unrealEl = $("card-unrealized");
  unrealEl.textContent = `${pnlPrefix(a.total_unrealized_pnl)}${fmtUSD(a.total_unrealized_pnl)}`;
  unrealEl.className = `card-value ${pnlClass(a.total_unrealized_pnl)}`;

  const realEl = $("card-realized");
  realEl.textContent = `${pnlPrefix(a.total_realized_pnl)}${fmtUSD(a.total_realized_pnl)}`;
  realEl.className = `card-value ${pnlClass(a.total_realized_pnl)}`;

  $("card-num-pos").textContent = a.num_positions;
  $("last-updated").textContent = `Updated: ${new Date(a.date).toLocaleDateString()}`;
}

// ── Metrics ───────────────────────────────────────────────

async function loadMetrics() {
  const json = await fetchJSON("/api/v1/metrics/current");
  if (!json || !json.data) return;
  const m = json.data;
  $("card-sharpe").textContent = fmt(m.sharpe_ratio, 2);
  $("card-drawdown").textContent = fmtPct(m.max_drawdown);
  $("card-return").textContent = fmtPct(m.total_return);
  $("card-winrate").textContent = `${fmt(m.win_rate, 1)}%`;
}

// ── Equity Curve ──────────────────────────────────────────

let equityChartInstance = null;

async function loadEquityCurve() {
  let json = await fetchJSON("/api/v1/account/history?limit=365");
  if (json && json.data && json.data.length > 0) {
    drawEquityChart(
      json.data.map((d) => ({ date: d.date, value: d.net_liquidation }))
    );
    return;
  }
  json = await fetchJSON("/api/v1/portfolio/history?limit=365");
  if (json && json.data && json.data.length > 0) {
    drawEquityChart(
      json.data.map((d) => ({ date: d.date, value: d.total_equity }))
    );
  }
}

function drawEquityChart(data) {
  const ctx = $("equityChart").getContext("2d");
  const labels = data.map((d) => new Date(d.date).toLocaleDateString());
  const values = data.map((d) => d.value);

  if (equityChartInstance) equityChartInstance.destroy();

  equityChartInstance = new Chart(ctx, {
    type: "line",
    data: {
      labels,
      datasets: [
        {
          label: "Net Liquidation ($)",
          data: values,
          borderColor: "#3b82f6",
          backgroundColor: "rgba(59,130,246,0.08)",
          fill: true,
          tension: 0.3,
          pointRadius: 0,
          borderWidth: 2,
        },
      ],
    },
    options: {
      responsive: true,
      plugins: {
        legend: { display: false },
        tooltip: {
          callbacks: {
            label: (ctx) => `$${ctx.parsed.y.toLocaleString()}`,
          },
        },
      },
      scales: {
        x: {
          ticks: { color: "#94a3b8", maxTicksLimit: 12 },
          grid: { color: "rgba(148,163,184,0.06)" },
        },
        y: {
          ticks: {
            color: "#94a3b8",
            callback: (v) => `$${(v / 1000).toFixed(0)}k`,
          },
          grid: { color: "rgba(148,163,184,0.06)" },
        },
      },
    },
  });
}

// ── Market Scanner ────────────────────────────────────────

let scannerData = [];
let scannerSortKey = "symbol";
let scannerSortAsc = true;

async function loadScanner() {
  const json = await fetchJSON("/api/v1/scanner/latest");
  if (!json || !json.data) {
    $("scanner-body").innerHTML = `<tr><td colspan="10" class="py-4 text-center text-slate-500">No scan data yet — runs after market close.</td></tr>`;
    return;
  }
  scannerData = json.data;
  if (json.scan_date) {
    $("scanner-date").textContent = `Last scan: ${new Date(json.scan_date).toLocaleDateString()}`;
  }
  renderScanner();

  // Wire up search & filter
  $("scanner-search").addEventListener("input", renderScanner);
  $("scanner-filter").addEventListener("change", renderScanner);
}

function sortScanner(key) {
  if (scannerSortKey === key) {
    scannerSortAsc = !scannerSortAsc;
  } else {
    scannerSortKey = key;
    scannerSortAsc = key === "symbol";
  }
  renderScanner();
}

function renderScanner() {
  const search = ($("scanner-search").value || "").toUpperCase();
  const filter = $("scanner-filter").value;

  let filtered = scannerData.filter((s) => {
    if (search && !s.symbol.includes(search)) return false;
    if (filter === "BUY") return s.signal_result === "BUY";
    if (filter === "SELL") return s.signal_result === "SELL";
    if (filter === "HOLD") return s.signal_result === "HOLD";
    if (filter === "held") return s.is_held;
    return true;
  });

  const sorted = [...filtered].sort((a, b) => {
    let va = a[scannerSortKey], vb = b[scannerSortKey];
    if (va == null) va = scannerSortAsc ? Infinity : -Infinity;
    if (vb == null) vb = scannerSortAsc ? Infinity : -Infinity;
    if (typeof va === "string") return scannerSortAsc ? va.localeCompare(vb) : vb.localeCompare(va);
    return scannerSortAsc ? va - vb : vb - va;
  });

  $("scanner-count").textContent = `${filtered.length} of ${scannerData.length}`;

  const tbody = $("scanner-body");
  if (sorted.length === 0) {
    tbody.innerHTML = `<tr><td colspan="10" class="py-4 text-center text-slate-500">No matches.</td></tr>`;
    return;
  }

  tbody.innerHTML = sorted
    .map((s) => {
      // RSI color
      const rsiVal = s.rsi_14 != null ? s.rsi_14.toFixed(1) : "—";
      const rsiClass = s.rsi_14 == null ? "" : s.rsi_14 < 40 ? "rsi-oversold" : s.rsi_14 > 70 ? "rsi-overbought" : "rsi-neutral";

      // ATR signal color
      const atrClass = s.atr_signal === "high" ? "ind-high" : "ind-low";

      // MACD signal color
      const macdClass = s.macd_signal === "strong" ? "ind-strong"
        : s.macd_signal === "Medium" ? "ind-medium" : "ind-weak";

      // Bollinger color
      const bbClass = s.bb_signal === "low below" ? "ind-strong"
        : s.bb_signal === "up above" ? "ind-weak" : "ind-low";

      // Market regime
      const regimeClass = s.market_regime === "bull" ? "ind-bull" : "ind-bear";

      // Signal badge
      const signalClass = s.signal_result === "BUY" ? "signal-buy"
        : s.signal_result === "SELL" ? "signal-sell" : "signal-hold";

      // Held row highlight
      const rowClass = s.is_held ? "row-held" : "";

      return `
        <tr class="${rowClass} hover:bg-slate-700/30 transition">
          <td class="py-2 font-mono font-semibold">${s.symbol}${s.is_held ? ' <span class="text-blue-400 text-xs">●</span>' : ''}</td>
          <td class="py-2 text-right">${s.close_price != null ? '$' + fmt(s.close_price) : '—'}</td>
          <td class="py-2 text-right">${s.sma_30 != null ? '$' + fmt(s.sma_30) : '—'}</td>
          <td class="py-2 text-center ${rsiClass}">${rsiVal}</td>
          <td class="py-2 text-center ${atrClass}">${s.atr_signal || '—'}</td>
          <td class="py-2 text-center ${macdClass}">${s.macd_signal || '—'}</td>
          <td class="py-2 text-center ${bbClass}">${s.bb_signal || '—'}</td>
          <td class="py-2 text-center ${regimeClass}">${s.market_regime || '—'}</td>
          <td class="py-2 text-center"><span class="signal-badge ${signalClass}">${s.signal_result || '—'}</span></td>
          <td class="py-2 text-slate-400 text-xs max-w-xs truncate" title="${s.rejection_reason || ''}">${s.rejection_reason || '—'}</td>
        </tr>`;
    })
    .join("");
}

// ── Positions Table ───────────────────────────────────────

let positionsData = [];
let positionsSortKey = "market_value";
let positionsSortAsc = false;

async function loadPositions() {
  const json = await fetchJSON("/api/v1/positions/current");
  if (!json || !json.data) return;
  positionsData = json.data;
  $("positions-count").textContent = `${json.count} positions`;
  renderPositions();
}

function sortPositions(key) {
  if (positionsSortKey === key) {
    positionsSortAsc = !positionsSortAsc;
  } else {
    positionsSortKey = key;
    positionsSortAsc = key === "symbol";
  }
  renderPositions();
}

function renderPositions() {
  const tbody = $("positions-body");
  if (positionsData.length === 0) {
    tbody.innerHTML = `<tr><td colspan="9" class="py-4 text-center text-slate-500">No positions.</td></tr>`;
    return;
  }

  const sorted = [...positionsData].sort((a, b) => {
    let va = a[positionsSortKey], vb = b[positionsSortKey];
    if (typeof va === "string") return positionsSortAsc ? va.localeCompare(vb) : vb.localeCompare(va);
    return positionsSortAsc ? va - vb : vb - va;
  });

  tbody.innerHTML = sorted
    .map((p) => {
      const pctChange = p.avg_cost ? ((p.current_price - p.avg_cost) / p.avg_cost * 100) : 0;
      return `
        <tr class="border-b border-slate-700/50 hover:bg-slate-700/30 transition">
          <td class="py-2 font-mono font-semibold">${p.symbol}</td>
          <td class="py-2 text-right">${p.quantity}</td>
          <td class="py-2 text-right">${fmtUSD(p.avg_cost)}</td>
          <td class="py-2 text-right">${fmtUSD(p.current_price)}</td>
          <td class="py-2 text-right">${fmtUSD(p.market_value)}</td>
          <td class="py-2 text-right ${pnlClass(p.unrealized_pnl)}">
            ${pnlPrefix(p.unrealized_pnl)}${fmtUSD(p.unrealized_pnl)}
            <span class="text-xs ml-1">(${pnlPrefix(pctChange)}${fmt(pctChange, 1)}%)</span>
          </td>
          <td class="py-2 text-right ${pnlClass(p.realized_pnl)}">${pnlPrefix(p.realized_pnl)}${fmtUSD(p.realized_pnl)}</td>
          <td class="py-2 text-slate-400 text-xs">${p.strategy || "—"}</td>
          <td class="py-2 text-slate-400 text-xs">${p.entry_date ? new Date(p.entry_date).toLocaleDateString() : "—"}</td>
        </tr>`;
    })
    .join("");
}

// ── Pending Signals Table ─────────────────────────────────

async function loadSignals() {
  const json = await fetchJSON("/api/v1/signals/pending");
  if (!json || !json.data) return;
  const tbody = $("signals-body");
  $("signals-count").textContent = `${json.count} pending`;

  if (json.data.length === 0) {
    tbody.innerHTML = `<tr><td colspan="7" class="py-4 text-center text-slate-500">No pending signals.</td></tr>`;
    return;
  }

  tbody.innerHTML = json.data
    .map((s) => {
      const actionClass = s.signal_type === "BUY" ? "text-blue-400" : "text-orange-400";
      return `
        <tr class="border-b border-slate-700/50 hover:bg-slate-700/30 transition">
          <td class="py-2 text-xs">${new Date(s.generated_at).toLocaleString()}</td>
          <td class="py-2 font-mono font-semibold">${s.symbol}</td>
          <td class="py-2 ${actionClass} font-semibold">${s.signal_type}</td>
          <td class="py-2 text-right">${s.quantity}</td>
          <td class="py-2 text-right">${fmtUSD(s.target_price)}</td>
          <td class="py-2 text-slate-400 text-xs">${s.strategy || "—"}</td>
          <td class="py-2 text-slate-400 text-xs max-w-xs truncate" title="${s.reason}">${s.reason || "—"}</td>
        </tr>`;
    })
    .join("");
}

// ── Recent Trades Table ───────────────────────────────────

async function loadTrades() {
  const json = await fetchJSON("/api/v1/trades/recent?limit=50");
  if (!json || !json.data) return;
  const tbody = $("trades-body");

  if (json.data.length === 0) {
    tbody.innerHTML = `<tr><td colspan="7" class="py-4 text-center text-slate-500">No trades yet.</td></tr>`;
    return;
  }

  tbody.innerHTML = json.data
    .map((t) => {
      const actionClass = t.action === "BUY" ? "text-blue-400" : "text-orange-400";
      return `
        <tr class="border-b border-slate-700/50 hover:bg-slate-700/30 transition">
          <td class="py-2">${new Date(t.date).toLocaleDateString()}</td>
          <td class="py-2 font-mono">${t.symbol}</td>
          <td class="py-2 ${actionClass} font-semibold">${t.action}</td>
          <td class="py-2 text-right">${t.quantity}</td>
          <td class="py-2 text-right">${fmtUSD(t.price)}</td>
          <td class="py-2 text-right ${pnlClass(t.pnl)}">${pnlPrefix(t.pnl)}${fmtUSD(t.pnl)}</td>
          <td class="py-2 text-slate-400 text-xs">${t.strategy || "—"}</td>
        </tr>`;
    })
    .join("");
}

// ── Init ──────────────────────────────────────────────────
document.addEventListener("DOMContentLoaded", () => {
  loadAccount();
  loadMetrics();
  loadEquityCurve();
  loadScanner();
  loadPositions();
  loadSignals();
  loadTrades();
});
