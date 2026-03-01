/**
 * app.js — AlgoTrading Dashboard v2
 *
 * Fetches data from the FastAPI backend and renders:
 *   - Account overview cards (NLV, cash, unrealized/realized P&L)
 *   - Metrics cards (Sharpe, drawdown, return, win rate)
 *   - Equity curve chart
 *   - Sortable positions table
 *   - Pending signals table
 *   - Recent trades table
 */

// ── Configuration ─────────────────────────────────────────
const API_BASE_URL =
  location.hostname === "localhost" || location.hostname === "127.0.0.1"
    ? "http://localhost:8000"
    : "https://algotrading.herokuapp.com";

// ── Helpers ───────────────────────────────────────────────
const $ = (id) => document.getElementById(id);
const fmt = (n, d = 2) =>
  n != null
    ? Number(n).toLocaleString("en-US", { minimumFractionDigits: d, maximumFractionDigits: d })
    : "—";
const fmtUSD = (n) => (n != null ? `$${fmt(n)}` : "—");
const fmtPct = (n) => (n != null ? `${fmt(n * 100)}%` : "—");
const pnlClass = (n) => (n > 0 ? "text-green-400" : n < 0 ? "text-red-400" : "text-gray-400");
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
  // Prefer account/history, fall back to portfolio/history
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
          ticks: { color: "#6b7280", maxTicksLimit: 12 },
          grid: { color: "rgba(255,255,255,0.04)" },
        },
        y: {
          ticks: {
            color: "#6b7280",
            callback: (v) => `$${(v / 1000).toFixed(0)}k`,
          },
          grid: { color: "rgba(255,255,255,0.04)" },
        },
      },
    },
  });
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
    positionsSortAsc = key === "symbol"; // asc for symbol, desc for numbers
  }
  renderPositions();
}

function renderPositions() {
  const tbody = $("positions-body");
  if (positionsData.length === 0) {
    tbody.innerHTML = `<tr><td colspan="9" class="py-4 text-center text-gray-500">No positions.</td></tr>`;
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
        <tr class="border-b border-gray-800 hover:bg-gray-800/50 transition">
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
          <td class="py-2 text-gray-400 text-xs">${p.strategy || "—"}</td>
          <td class="py-2 text-gray-400 text-xs">${p.entry_date ? new Date(p.entry_date).toLocaleDateString() : "—"}</td>
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
    tbody.innerHTML = `<tr><td colspan="7" class="py-4 text-center text-gray-500">No pending signals.</td></tr>`;
    return;
  }

  tbody.innerHTML = json.data
    .map((s) => {
      const actionClass = s.signal_type === "BUY" ? "text-blue-400" : "text-orange-400";
      return `
        <tr class="border-b border-gray-800 hover:bg-gray-800/50 transition">
          <td class="py-2 text-xs">${new Date(s.generated_at).toLocaleString()}</td>
          <td class="py-2 font-mono font-semibold">${s.symbol}</td>
          <td class="py-2 ${actionClass} font-semibold">${s.signal_type}</td>
          <td class="py-2 text-right">${s.quantity}</td>
          <td class="py-2 text-right">${fmtUSD(s.target_price)}</td>
          <td class="py-2 text-gray-400 text-xs">${s.strategy || "—"}</td>
          <td class="py-2 text-gray-400 text-xs max-w-xs truncate" title="${s.reason}">${s.reason || "—"}</td>
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
    tbody.innerHTML = `<tr><td colspan="7" class="py-4 text-center text-gray-500">No trades yet.</td></tr>`;
    return;
  }

  tbody.innerHTML = json.data
    .map((t) => {
      const actionClass = t.action === "BUY" ? "text-blue-400" : "text-orange-400";
      return `
        <tr class="border-b border-gray-800 hover:bg-gray-800/50 transition">
          <td class="py-2">${new Date(t.date).toLocaleDateString()}</td>
          <td class="py-2 font-mono">${t.symbol}</td>
          <td class="py-2 ${actionClass} font-semibold">${t.action}</td>
          <td class="py-2 text-right">${t.quantity}</td>
          <td class="py-2 text-right">${fmtUSD(t.price)}</td>
          <td class="py-2 text-right ${pnlClass(t.pnl)}">${pnlPrefix(t.pnl)}${fmtUSD(t.pnl)}</td>
          <td class="py-2 text-gray-400 text-xs">${t.strategy || "—"}</td>
        </tr>`;
    })
    .join("");
}

// ── Init ──────────────────────────────────────────────────
document.addEventListener("DOMContentLoaded", () => {
  loadAccount();
  loadMetrics();
  loadEquityCurve();
  loadPositions();
  loadSignals();
  loadTrades();
});
