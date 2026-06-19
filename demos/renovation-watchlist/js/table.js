// Sortable / searchable ranked watchlist. Keyboard-operable; selecting a row
// (click or Enter/Space) flies the map there and moves focus to the map.
import { fmtInt, fmtMoney, fmtDate, scoreColor } from "./util.js";

const LIMIT = 250;
let rows, body, mapApi;
const state = { sort: "score", dir: -1, q: "" };
const STRING_COLS = new Set(["address", "neighborhood"]);

export function initTable(data, api) {
  rows = data;
  mapApi = api;
  body = document.getElementById("watchbody");

  document.querySelectorAll(".watchtable th button[data-sort]").forEach((btn) => {
    btn.addEventListener("click", () => {
      const k = btn.dataset.sort;
      if (state.sort === k) state.dir *= -1;
      else { state.sort = k; state.dir = STRING_COLS.has(k) ? 1 : -1; }
      render();
    });
  });

  document.getElementById("t-search").addEventListener("input", (e) => {
    state.q = e.target.value.toLowerCase().trim();
    render();
  });

  body.addEventListener("click", (e) => activateRow(e.target.closest("tr")));
  body.addEventListener("keydown", (e) => {
    if (e.key === "Enter" || e.key === " ") {
      const tr = e.target.closest("tr[data-p]");
      if (tr) { e.preventDefault(); activateRow(tr); }
    }
  });

  render();
}

function activateRow(tr) {
  if (!tr || !tr.dataset.p) return;
  const r = rows.find((x) => x.parcel_number === tr.dataset.p);
  if (!r) return;
  body.querySelectorAll("tr.is-active").forEach((x) => x.classList.remove("is-active"));
  tr.classList.add("is-active");
  document.getElementById("explore").scrollIntoView({ behavior: "smooth", block: "start" });
  if (r.lng != null && r.lat != null) {
    setTimeout(() => {
      mapApi.flyTo(r.lng, r.lat, mapProps(r));
      const m = document.getElementById("map");
      if (m) m.focus({ preventScroll: true });
    }, 420);
  }
}

function mapProps(r) {
  return {
    rank: r.rank, score: r.score, address: r.address, neighborhood: r.neighborhood,
    nov_count: r.nov_count, last_nov_date: r.last_nov_date, units: r.units,
    year_built: r.year_built, assessed_improvement_value: r.assessed_improvement_value,
    samples: (r.nov_samples || []).slice(0, 3).join(" · "),
  };
}

function escapeHtml(s) {
  return String(s || "").replace(/[&<>"]/g, (c) => ({ "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;" }[c]));
}

function rowHTML(r) {
  const label = `Rank ${r.rank}. ${r.address || "Unknown address"}, ${r.neighborhood || ""}. ` +
    `Pressure score ${r.score}, ${r.nov_count} permit violations. Select to show on map.`;
  return `<tr data-p="${r.parcel_number}" tabindex="0" role="button" aria-label="${escapeHtml(label)}">
    <td class="num rank-cell">${r.rank}</td>
    <td class="num"><span class="score-chip"><i class="chip-sw" style="background:${scoreColor(r.score)}"></i>${r.score}</span></td>
    <td class="addr">${escapeHtml(r.address) || "—"}</td>
    <td>${escapeHtml(r.neighborhood) || "—"}</td>
    <td class="num">${r.nov_count}</td>
    <td class="num">${fmtDate(r.last_nov_date)}</td>
    <td class="num">${fmtInt(r.units)}</td>
    <td class="num">${r.year_built || "—"}</td>
    <td class="num">${fmtMoney(r.assessed_improvement_value)}</td>
  </tr>`;
}

function render() {
  const { sort, dir, q } = state;
  let list = rows;
  if (q) {
    list = list.filter((r) =>
      (r.address || "").toLowerCase().includes(q) || (r.neighborhood || "").toLowerCase().includes(q));
  }
  list = [...list].sort((a, b) => {
    const x = a[sort], y = b[sort];
    if (STRING_COLS.has(sort) || sort === "last_nov_date") {
      return String(x || "").localeCompare(String(y || "")) * dir;
    }
    return ((x ?? 0) - (y ?? 0)) * dir;
  });

  document.querySelectorAll(".watchtable thead th").forEach((th) => {
    const btn = th.querySelector("button[data-sort]");
    th.classList.remove("sorted-asc", "sorted-desc");
    if (btn && btn.dataset.sort === sort) {
      th.classList.add(dir > 0 ? "sorted-asc" : "sorted-desc");
      th.setAttribute("aria-sort", dir > 0 ? "ascending" : "descending");
    } else if (btn) {
      th.setAttribute("aria-sort", "none");
    }
  });

  if (!list.length) {
    body.innerHTML = `<tr class="no-rows"><td colspan="9">No buildings match “${escapeHtml(state.q)}”. ` +
      `<button type="button" class="link-btn" id="clear-search">Clear search</button></td></tr>`;
    const c = document.getElementById("clear-search");
    if (c) c.addEventListener("click", () => {
      const s = document.getElementById("t-search");
      s.value = ""; state.q = ""; render(); s.focus();
    });
  } else {
    body.innerHTML = list.slice(0, LIMIT).map(rowHTML).join("");
  }

  document.getElementById("table-count").textContent = fmtInt(list.length);
  document.getElementById("table-more").textContent =
    list.length > LIMIT
      ? `Showing top ${LIMIT} of ${fmtInt(list.length)} — narrow with search or sorting. Full data in the CSV.`
      : "";
}
