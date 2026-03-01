// Simple frontend script for gps_presentation/algotrading
const API_BASE_URL = location.hostname === 'localhost' ? 'http://localhost:8000' : 'https://algotrading.herokuapp.com';

const $ = (id) => document.getElementById(id);
const fmt = (n, d=2)=> n!=null?Number(n).toLocaleString('en-US',{minimumFractionDigits:d,maximumFractionDigits:d}):'—';
const fmtUSD=(n)=>n!=null?`$${fmt(n)}`:'—';

async function fetchJSON(path){try{const r=await fetch(API_BASE_URL+path); if(!r.ok) throw new Error(r.status); return await r.json();}catch(e){console.error(e);return null}}

async function load(){const p=await fetchJSON('/api/v1/portfolio/history?limit=365'); if(p&&p.data&&p.data.length){const latest=p.data[p.data.length-1]; $('card-equity').textContent=fmtUSD(latest.total_equity); $('card-cash').textContent=fmtUSD(latest.free_cash); $('last-updated').textContent = `Updated: ${new Date(latest.date).toLocaleDateString()}`; drawEquity(p.data);}const m=await fetchJSON('/api/v1/metrics/current'); if(m&&m.data){$('card-sharpe').textContent=fmt(m.data.sharpe_ratio,2); $('card-drawdown').textContent=(m.data.max_drawdown!=null?`${(m.data.max_drawdown*100).toFixed(2)}%`:'—'); $('card-return').textContent=(m.data.total_return!=null?`${(m.data.total_return*100).toFixed(2)}%`:'—');}
const t=await fetchJSON('/api/v1/trades/recent?limit=50'); if(t&&t.data){$('card-trades').textContent=t.count; const tbody=$('trades-body'); tbody.innerHTML = t.data.map(d=>`<tr class="border-b border-gray-800"><td class="py-2">${new Date(d.date).toLocaleDateString()}</td><td>${d.symbol}</td><td>${d.action}</td><td>${d.quantity}</td><td>${fmtUSD(d.price)}</td><td>${fmtUSD(d.pnl)}</td><td>${d.strategy||'—'}</td></tr>`).join('');}
}

let chart=null;
function drawEquity(data){const ctx=document.getElementById('equityChart').getContext('2d'); const labels=data.map(d=>new Date(d.date).toLocaleDateString()); const values=data.map(d=>d.total_equity); if(chart) chart.destroy(); chart=new Chart(ctx,{type:'line',data:{labels,datasets:[{label:'Equity',data:values,borderColor:'#3b82f6',backgroundColor:'rgba(59,130,246,0.08)',fill:true,tension:0.3,pointRadius:0,borderWidth:2}]},options:{responsive:true,plugins:{legend:{display:false}}}})}

window.addEventListener('DOMContentLoaded', load);
