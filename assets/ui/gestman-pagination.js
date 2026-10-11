/* Paginação consistente para as listagens operacionais. */
const GM_PAGE_SIZE_OPTIONS = Object.freeze([15, 20, 30, 50]);
const gmPagerCallbacks = new Map();

function gmPageSize(key) {
  try {
    const saved = Number(localStorage.getItem(`gestman-page-size:${key}`));
    if (GM_PAGE_SIZE_OPTIONS.includes(saved)) return saved;
  } catch {}
  return 15;
}

function gmSetPageSize(key, value) {
  const size = Number(value);
  if (!GM_PAGE_SIZE_OPTIONS.includes(size)) return;
  try { localStorage.setItem(`gestman-page-size:${key}`, String(size)); } catch {}
  gmPagerCallbacks.get(key)?.onSize(size);
}

function gmGoPage(key, page) {
  gmPagerCallbacks.get(key)?.onPage(page);
}

function gmPager(total, page, key, onPage, onSize) {
  const size = gmPageSize(key);
  const count = Math.max(0, Number(total) || 0);
  const pages = Math.max(1, Math.ceil(count / size));
  const current = Math.min(pages, Math.max(1, Number(page) || 1));
  gmPagerCallbacks.set(key, { onPage, onSize });

  const numberButton = number => `<button type="button" class="${number === current ? "active" : ""}" ${number === current ? 'aria-current="page"' : ""} aria-label="Página ${number}" onclick="gmGoPage('${key}',${number})">${number}</button>`;
  const start = Math.max(1, Math.min(current - 2, pages - 4));
  const end = Math.min(pages, start + 4);
  const numbers = [];
  if (start > 1) {
    numbers.push(numberButton(1));
    if (start > 2) numbers.push('<span class="gm-page-ellipsis" aria-hidden="true">…</span>');
  }
  for (let number = start; number <= end; number++) numbers.push(numberButton(number));
  if (end < pages) {
    if (end < pages - 1) numbers.push('<span class="gm-page-ellipsis" aria-hidden="true">…</span>');
    numbers.push(numberButton(pages));
  }

  const first = count ? (current - 1) * size + 1 : 0;
  const last = Math.min(current * size, count);
  return `<span class="gm-page-summary">${first}–${last} de ${count} itens</span>
    <label class="gm-page-size">Itens por página
      <select aria-label="Itens por página" onchange="gmSetPageSize('${key}',this.value)">
        ${GM_PAGE_SIZE_OPTIONS.map(option => `<option value="${option}" ${option === size ? "selected" : ""}>${option}</option>`).join("")}
      </select>
    </label>
    <div class="gm-page-buttons" role="navigation" aria-label="Paginação">
      <button type="button" aria-label="Página anterior" ${current === 1 ? "disabled" : ""} onclick="gmGoPage('${key}',${current - 1})">‹</button>
      ${numbers.join("")}
      <button type="button" aria-label="Próxima página" ${current === pages ? "disabled" : ""} onclick="gmGoPage('${key}',${current + 1})">›</button>
    </div>`;
}

function gmPaginateLegacyTables() {
  const listTableIds = new Set([
    "regionsModuleRows", "productiveCalendarRows", "measurementRows", "downtimeRows",
    "operationalDiaryRows", "pendingActionRows", "toolRows", "toolLoanRows",
    "supplierRows", "stockRows", "spareRows", "stockMoveRows",
    "materialRequestRows", "stockTransferRows", "regionRows", "locationRows",
    "tagRows", "platformRequestRows", "platformCompanyRows", "tenantUserRows",
    "checklistHistoryRows"
  ]);
  document.querySelectorAll("main.workspace .view").forEach(view => {
    view.querySelectorAll("table tbody[id]").forEach(tbody => {
      if (!listTableIds.has(tbody.id)) return;
      const rows = [...tbody.rows];
      const host = tbody.closest(".table-wrap") || tbody.closest("table");
      if (!host) return;
      const key = `legacy:${view.id}:${tbody.id}`;
      let pager = host.nextElementSibling?.matches(".gm-auto-pagination") ? host.nextElementSibling : null;
      if (rows.length <= 15 && !pager) return;
      if (!pager) {
        pager = document.createElement("div");
        pager.className = "gm-pagination gm-auto-pagination";
        host.insertAdjacentElement("afterend", pager);
      }
      const render = () => {
        const size = gmPageSize(key);
        const pages = Math.max(1, Math.ceil(rows.length / size));
        const page = Math.min(pages, Math.max(1, Number(tbody.dataset.gmPage) || 1));
        tbody.dataset.gmPage = String(page);
        rows.forEach((row, rowIndex) => { row.style.display = rowIndex >= (page - 1) * size && rowIndex < page * size ? "" : "none"; });
        pager.innerHTML = gmPager(rows.length, page, key, next => { tbody.dataset.gmPage = String(next); render(); }, () => { tbody.dataset.gmPage = "1"; render(); });
      };
      render();
    });
  });
}
