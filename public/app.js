/*
 * Ruang Stok — prototipe frontend.
 * Semua data disimpan lokal pada browser untuk keperluan demonstrasi.
 */
(function () {
  "use strict";

  const STORAGE_KEY = "ruang-stok-demo-v1";
  const DAY_MS = 24 * 60 * 60 * 1000;
  const $ = (selector, root = document) => root.querySelector(selector);
  const $$ = (selector, root = document) => [...root.querySelectorAll(selector)];

  const dateKey = (date) => {
    const d = new Date(date);
    const local = new Date(d.getFullYear(), d.getMonth(), d.getDate());
    return [local.getFullYear(), String(local.getMonth() + 1).padStart(2, "0"), String(local.getDate()).padStart(2, "0")].join("-");
  };
  const shiftDate = (days) => {
    const d = new Date();
    d.setHours(12, 0, 0, 0);
    d.setDate(d.getDate() + days);
    return dateKey(d);
  };
  const todayKey = () => dateKey(new Date());
  const startOfDay = (value) => {
    const d = new Date(`${value}T12:00:00`);
    return new Date(d.getFullYear(), d.getMonth(), d.getDate());
  };
  const daysUntil = (value) => Math.round((startOfDay(value) - startOfDay(todayKey())) / DAY_MS);
  const formatDate = (value, options = { day: "numeric", month: "short" }) =>
    new Intl.DateTimeFormat("id-ID", options).format(startOfDay(value));
  const formatFullDate = (value) =>
    new Intl.DateTimeFormat("id-ID", { weekday: "long", day: "numeric", month: "long", year: "numeric" }).format(startOfDay(value));
  const formatNumber = (value) => new Intl.NumberFormat("id-ID").format(value);
  const capitalize = (value) => value.charAt(0).toUpperCase() + value.slice(1);
  const nowTime = () =>
    new Intl.DateTimeFormat("id-ID", { hour: "2-digit", minute: "2-digit", hour12: false }).format(new Date());
  const escapeHtml = (value) =>
    String(value)
      .replaceAll("&", "&amp;")
      .replaceAll("<", "&lt;")
      .replaceAll(">", "&gt;")
      .replaceAll('"', "&quot;")
      .replaceAll("'", "&#039;");

  function initialState() {
    return {
      products: [
        {
          id: "indomie-goreng",
          sku: "MKN-IND-001",
          name: "Indomie Goreng",
          unit: "pcs",
          reorder: 24,
          target: 60,
          perishable: false,
          symbol: "I",
          tone: "yellow",
          batches: [{ id: "A-031", qty: 12, receivedAt: shiftDate(-18), expiryAt: null, price: 3100 }]
        },
        {
          id: "aqua-600",
          sku: "MNM-AQU-600",
          name: "Aqua Mineral 600 ml",
          unit: "botol",
          reorder: 12,
          target: 48,
          perishable: false,
          symbol: "A",
          tone: "leaf",
          batches: [{ id: "A-611", qty: 9, receivedAt: shiftDate(-6), expiryAt: null, price: 2500 }]
        },
        {
          id: "susu-uht",
          sku: "MNM-SUS-011",
          name: "Susu UHT Cokelat",
          unit: "kotak",
          reorder: 12,
          target: 30,
          perishable: true,
          symbol: "S",
          tone: "warm",
          batches: [{ id: "B-2407", qty: 8, receivedAt: shiftDate(-20), expiryAt: shiftDate(4), price: 6800 }]
        },
        {
          id: "roti-cokelat",
          sku: "MKN-ROT-009",
          name: "Roti Cokelat",
          unit: "bungkus",
          reorder: 10,
          target: 24,
          perishable: true,
          symbol: "R",
          tone: "warm",
          batches: [{ id: "R-119", qty: 6, receivedAt: shiftDate(-2), expiryAt: shiftDate(1), price: 4200 }]
        },
        {
          id: "teh-botol",
          sku: "MNM-TEH-002",
          name: "Teh Botol Sosro",
          unit: "botol",
          reorder: 18,
          target: 50,
          perishable: false,
          symbol: "T",
          tone: "leaf",
          batches: [{ id: "T-523", qty: 28, receivedAt: shiftDate(-8), expiryAt: null, price: 3600 }]
        },
        {
          id: "gula-pasir",
          sku: "BHN-GUL-001",
          name: "Gula Pasir 1 kg",
          unit: "bungkus",
          reorder: 8,
          target: 18,
          perishable: false,
          symbol: "G",
          tone: "yellow",
          batches: [{ id: "G-201", qty: 16, receivedAt: shiftDate(-10), expiryAt: null, price: 16200 }]
        }
      ],
      receipts: ["POS-DEMO-001"],
      events: [
        { id: "E-005", kind: "sale", at: "baru saja", product: "Indomie Goreng", quantity: 2, unit: "pcs", receipt: "POS-DEMO-001" },
        { id: "E-004", kind: "receive", at: "09.12", product: "Teh Botol Sosro", quantity: 24, unit: "botol", receipt: "GR-771" },
        { id: "E-003", kind: "sale", at: "08.47", product: "Aqua Mineral 600 ml", quantity: 3, unit: "botol", receipt: "POS-20261109-014" }
      ],
      lastSync: new Date().toISOString()
    };
  }

  let state = initialState();
  let currentModal = null;
  let lastFocused = null;

  const getProduct = (id) => state.products.find((product) => product.id === id);
  const batchIsExpired = (batch) => batch.expiryAt && daysUntil(batch.expiryAt) < 0;
  const availableStock = (product) => product.batches.reduce((total, batch) => total + (batchIsExpired(batch) ? 0 : batch.qty), 0);
  const totalStock = (product) => product.batches.reduce((total, batch) => total + batch.qty, 0);
  const stockStatus = (product) => {
    const stock = availableStock(product);
    if (product.reorder > 0 && stock <= Math.ceil(product.reorder / 2)) return "critical";
    if (product.reorder > 0 && stock <= product.reorder) return "reorder";
    return "safe";
  };
  const statusLabel = (status) => ({ critical: "Kritis", reorder: "Perlu beli", safe: "Aman" })[status];
  const statusVerb = (status) => ({ critical: "Beli hari ini", reorder: "Masukkan belanja", safe: "Stok aman" })[status];
  const getExpiringBatches = (onlyAttention = true) =>
    state.products
      .flatMap((product) =>
        product.batches
          .filter((batch) => batch.qty > 0 && batch.expiryAt && daysUntil(batch.expiryAt) >= 0)
          .map((batch) => ({ product, batch, days: daysUntil(batch.expiryAt) }))
      )
      .filter((entry) => !onlyAttention || entry.days <= 7)
      .sort((a, b) => a.days - b.days);
  const getPurchaseItems = () =>
    state.products
      .filter((product) => ["critical", "reorder"].includes(stockStatus(product)))
      .sort((a, b) => (stockStatus(a) === stockStatus(b) ? availableStock(a) - availableStock(b) : stockStatus(a) === "critical" ? -1 : 1));
  const formatRelative = (iso) => {
    const diff = Math.max(0, Math.floor((Date.now() - new Date(iso).getTime()) / 60000));
    if (diff < 1) return "baru saja";
    if (diff === 1) return "1 menit lalu";
    if (diff < 60) return `${diff} menit lalu`;
    return `${Math.floor(diff / 60)} jam lalu`;
  };
  async function requestApi(url, options = {}) {
    const response = await fetch(url, {
      ...options,
      headers: { "Content-Type": "application/json", ...(options.headers || {}) }
    });
    const payload = await response.json().catch(() => ({}));
    if (!response.ok) throw new Error(payload?.error?.message || "Server tidak dapat memproses permintaan.");
    return payload;
  }

  async function refreshDashboard({ quiet = false } = {}) {
    try {
      state = await requestApi("/api/dashboard");
      renderAll();
    } catch (error) {
      if (!quiet) showToast("Server belum terhubung", error.message, "error");
    }
  }

  function productSymbol(product) {
    const tones = { warm: "symbol-warm", yellow: "symbol-yellow", leaf: "" };
    return `<span class="product-symbol ${tones[product.tone] || ""}">${escapeHtml(product.symbol || product.name.charAt(0))}</span>`;
  }

  function renderTop() {
    $("#todayLabel").textContent = formatFullDate(todayKey());
    $("#syncTime").textContent = formatRelative(state.lastSync);
  }

  function renderPriority() {
    const purchaseItems = getPurchaseItems();
    const expiryItems = getExpiringBatches(true);
    const problems = [
      ...purchaseItems.map((product) => ({ type: stockStatus(product), product, text: `${product.name} · ${statusVerb(stockStatus(product))}`, meta: `${formatNumber(availableStock(product))}/${formatNumber(product.reorder)} ${product.unit}` })),
      ...expiryItems.map((entry) => ({ type: "warning", product: entry.product, text: `${entry.product.name} · ${entry.days === 0 ? "kedaluwarsa hari ini" : `${entry.days} hari lagi`}`, meta: `batch ${entry.batch.id}` }))
    ];
    $("#priorityCount").textContent = problems.length;
    $("#priorityList").innerHTML = problems.length
      ? problems.slice(0, 3).map((item) => `<div class="priority-item ${item.type === "warning" ? "warning" : ""}"><i></i><span>${escapeHtml(item.text)}</span><small>${escapeHtml(item.meta)}</small></div>`).join("")
      : `<div class="priority-item"><i style="background:var(--leaf)"></i><span>Semua rak dalam kondisi aman.</span><small>terkendali</small></div>`;

    const noticeText = [];
    if (purchaseItems.length) noticeText.push(`${purchaseItems.length} barang perlu masuk daftar belanja`);
    if (expiryItems.length) noticeText.push(`${expiryItems.length} batch perlu diprioritaskan jual`);
    $("#noticeLead").textContent = noticeText.length ? "Perlu perhatian:" : "Kondisi stabil:";
    $("#noticeText").textContent = noticeText.length ? `${noticeText.join(" dan ")}.` : "stok dan batch sudah berada dalam batas aman.";
    $("#noticeAction").textContent = noticeText.length ? "Tinjau sekarang →" : "Lihat stok →";
    $("#noticeAction").dataset.target = purchaseItems.length ? "purchase" : "stock";
  }

  function renderExpiryPanel() {
    const nearest = getExpiringBatches(false)[0];
    if (!nearest) {
      $("#nearestExpiryDays").textContent = "Aman";
      $("#nearestExpiryProduct").textContent = "Tidak ada batch berakhir dalam data aktif.";
      $("#expiryNote").textContent = "Produk dengan masa simpan akan dipantau otomatis saat kamu mencatat penerimaan.";
      return;
    }
    const daysText = nearest.days === 0 ? "Hari ini" : nearest.days;
    $("#nearestExpiryDays").textContent = daysText;
    $("#nearestExpiryProduct").textContent = `${nearest.product.name} · batch ${nearest.batch.id}`;
    $("#expiryNote").textContent = nearest.days <= 7
      ? `Sisa ${nearest.days === 0 ? "hari ini" : `${nearest.days} hari`}. Utamakan produk ini di area kasir atau beri promo.`
      : `Batch ini masih aman, tetapi tetap akan diproses dengan aturan FEFO.`;
  }

  function renderInventory() {
    const query = $("#searchItems").value.trim().toLowerCase();
    const filter = $("#statusFilter").value;
    const filtered = state.products.filter((product) => {
      const matchesQuery = !query || product.name.toLowerCase().includes(query) || product.sku.toLowerCase().includes(query);
      return matchesQuery && (filter === "all" || stockStatus(product) === filter);
    });
    $("#itemCount").textContent = `${filtered.length} barang`;
    $("#inventoryRows").innerHTML = filtered.map((product) => {
      const stock = availableStock(product);
      const status = stockStatus(product);
      const capacity = Math.max(product.target, product.reorder, 1);
      const segments = 10;
      const filled = Math.max(0, Math.min(segments, Math.round((stock / capacity) * segments)));
      const firstBatch = product.batches
        .filter((batch) => batch.qty > 0 && batch.expiryAt && !batchIsExpired(batch))
        .sort((a, b) => daysUntil(a.expiryAt) - daysUntil(b.expiryAt))[0];
      const expiryLabel = firstBatch
        ? (() => {
            const days = daysUntil(firstBatch.expiryAt);
            const urgency = days <= 2 ? "danger" : days <= 7 ? "warning" : "";
            const text = days === 0 ? "Habis hari ini" : `${days} hari lagi`;
            return `<span class="expiry-label ${urgency}"><i></i>${text}</span>`;
          })()
        : "<span class=\"expiry-label\"><i></i>Tidak dibatasi</span>";
      return `<tr>
        <td><div class="product-cell">${productSymbol(product)}<div><span class="product-name">${escapeHtml(product.name)}</span><span class="product-sku">${escapeHtml(product.sku)}</span></div></div></td>
        <td><div class="stock-rail"><div class="stock-topline"><strong>${formatNumber(stock)}</strong><small>${escapeHtml(product.unit)}</small></div><div class="rack-line ${status}">${Array.from({ length: segments }, (_, index) => `<b class="${index < filled ? "filled" : ""}"></b>`).join("")}</div></div></td>
        <td><div class="reorder-cell"><b>${formatNumber(product.reorder)} ${escapeHtml(product.unit)}</b>${statusLabel(status)}</div></td>
        <td><div class="batch-cell">${firstBatch ? `<span class="batch-code">${escapeHtml(firstBatch.id)}</span>` : "<span class=\"batch-code\">—</span>"}${expiryLabel}</div></td>
        <td><button class="detail-button" type="button" data-detail="${escapeHtml(product.id)}">Rincian →</button></td>
      </tr>`;
    }).join("");
    $("#emptyStock").hidden = filtered.length > 0;
  }

  function renderHealth() {
    const counts = { safe: 0, reorder: 0, critical: 0 };
    state.products.forEach((product) => { counts[stockStatus(product)] += 1; });
    const expiring = getExpiringBatches(true).length;
    const score = Math.max(0, Math.min(100, 100 - counts.critical * 18 - counts.reorder * 9 - expiring * 4));
    $("#healthScore").textContent = score;
    $(".health-meter").style.setProperty("--score", score);
    $("#healthText").textContent = score >= 82 ? "Warung siap melayani hari ini." : score >= 60 ? "Ada beberapa rak yang perlu ditangani." : "Prioritaskan pembelian dan rotasi batch.";
    $("#healthLegend").innerHTML = `
      <li><i></i>${counts.safe} rak aman</li>
      <li><i class="warn"></i>${counts.reorder} perlu beli</li>
      <li><i class="danger"></i>${counts.critical} kritis</li>`;
  }

  function renderEvents() {
    $("#activityFeed").innerHTML = state.events.slice(0, 4).map((event) => {
      const descriptor = event.kind === "sale"
        ? `Kasir menjual <span>${formatNumber(event.quantity)} ${escapeHtml(event.unit)}</span> ${escapeHtml(event.product)}`
        : `Barang masuk <span>${formatNumber(event.quantity)} ${escapeHtml(event.unit)}</span> ${escapeHtml(event.product)}`;
      return `<li class="${event.kind === "receive" ? "incoming" : ""}"><time>${escapeHtml(event.at)} · ${escapeHtml(event.receipt)}</time><p>${descriptor}</p></li>`;
    }).join("");
  }

  function renderSelects() {
    const selectedReceive = $("#receiveProduct").value;
    const selectedPos = $("#posProduct").value;
    const options = state.products
      .sort((a, b) => a.name.localeCompare(b.name, "id"))
      .map((product) => `<option value="${escapeHtml(product.id)}">${escapeHtml(product.name)} · ${escapeHtml(product.sku)}</option>`)
      .join("");
    $("#receiveProduct").innerHTML = `<option value="">Pilih barang…</option>${options}`;
    $("#posProduct").innerHTML = `<option value="">Pilih barang…</option>${options}`;
    if (getProduct(selectedReceive)) $("#receiveProduct").value = selectedReceive;
    if (getProduct(selectedPos)) $("#posProduct").value = selectedPos;
    updateReceiveProductMeta();
    updatePosProductMeta();
  }

  function renderCounts() {
    const purchaseCount = getPurchaseItems().length;
    const expiryCount = getExpiringBatches(true).length;
    $("#navPurchaseCount").textContent = purchaseCount;
    $("#navExpiryCount").textContent = expiryCount;
  }

  function renderAll() {
    renderTop();
    renderPriority();
    renderExpiryPanel();
    renderInventory();
    renderHealth();
    renderEvents();
    renderSelects();
    renderCounts();
  }

  function updateReceiveProductMeta() {
    const product = getProduct($("#receiveProduct").value);
    $("#receiveUnit").textContent = product?.unit || "pcs";
    const field = $("#expiryField");
    const label = $("label[for='receiveExpiry']", field);
    label.innerHTML = product?.perishable ? "Kedaluwarsa <span aria-hidden=\"true\">*</span>" : "Kedaluwarsa <span class=\"optional-label\">opsional</span>";
  }

  function updatePosProductMeta() {
    const product = getProduct($("#posProduct").value);
    $("#posUnit").textContent = product?.unit || "pcs";
    $("#posStockHint").textContent = product
      ? `Stok siap dijual: ${formatNumber(availableStock(product))} ${product.unit}. ${product.perishable ? "FEFO aktif untuk batch ini." : ""}`
      : "Pilih barang untuk melihat stok yang siap dijual.";
  }

  function renderPurchaseList() {
    const items = getPurchaseItems();
    const total = items.reduce((sum, product) => sum + Math.max(0, product.target - availableStock(product)), 0);
    $("#purchaseSummary").innerHTML = items.length
      ? `<strong>${items.length}</strong><p>barang perlu dibeli<small>${formatNumber(total)} total unit untuk mencapai stok target</small></p>`
      : `<strong>0</strong><p>barang perlu dibeli<small>Semua stok telah melewati batas minimum.</small></p>`;
    $("#purchaseList").innerHTML = items.length
      ? items.map((product) => {
          const suggested = Math.max(0, product.target - availableStock(product));
          return `<label class="purchase-row"><input class="purchase-toggle" type="checkbox" checked data-purchase="${escapeHtml(product.id)}" /><span><strong>${escapeHtml(product.name)}</strong><small>${formatNumber(availableStock(product))} sekarang · target ${formatNumber(product.target)} ${escapeHtml(product.unit)}</small></span><span class="purchase-quantity">+${formatNumber(suggested)} ${escapeHtml(product.unit)}</span></label>`;
        }).join("")
      : `<p style="margin:10px 0;color:#69736d;font-size:11px">Tidak ada rekomendasi belanja saat ini.</p>`;
  }

  function renderExpiryList() {
    const items = getExpiringBatches(false);
    $("#expiryList").innerHTML = items.length
      ? items.map(({ product, batch, days }) => {
          const action = days <= 1 ? "Taruh di depan kasir" : days <= 7 ? "Utamakan penjualan" : "Pantau rutin";
          return `<div class="expiry-row"><span class="days">${days === 0 ? "H" : days}</span><div><strong>${escapeHtml(product.name)}</strong><small>batch ${escapeHtml(batch.id)} · ${formatNumber(batch.qty)} ${escapeHtml(product.unit)} · ${formatDate(batch.expiryAt)}</small></div><span class="expiry-action">${action}</span></div>`;
        }).join("")
      : `<p style="margin:10px 0;color:#69736d;font-size:11px">Belum ada batch aktif yang memiliki tanggal kedaluwarsa.</p>`;
  }

  function renderDetail(product) {
    const status = stockStatus(product);
    const batches = product.batches.filter((batch) => batch.qty > 0).sort((a, b) => {
      if (!a.expiryAt) return 1;
      if (!b.expiryAt) return -1;
      return daysUntil(a.expiryAt) - daysUntil(b.expiryAt);
    });
    $("#detailContent").innerHTML = `
      <p class="detail-kicker">RINCIAN RAK · ${escapeHtml(product.unit.toUpperCase())}</p>
      <h2 id="detailTitle" class="detail-title">${escapeHtml(product.name)}</h2>
      <p class="detail-sku">${escapeHtml(product.sku)}</p>
      <span class="detail-status ${status}">${statusLabel(status)} · ${statusVerb(status)}</span>
      <div class="detail-stat-grid">
        <div class="detail-stat"><small>SIAP JUAL</small><strong>${formatNumber(availableStock(product))}</strong></div>
        <div class="detail-stat"><small>BATAS BELI</small><strong>${formatNumber(product.reorder)}</strong></div>
        <div class="detail-stat"><small>TARGET</small><strong>${formatNumber(product.target)}</strong></div>
      </div>
      <p class="detail-section-title">BATCH TERSIMPAN ${product.perishable ? "· FEFO" : ""}</p>
      ${batches.length ? batches.map((batch) => {
        const days = batch.expiryAt ? daysUntil(batch.expiryAt) : null;
        const label = days === null ? "Tidak dibatasi" : days < 0 ? "Kedaluwarsa" : days === 0 ? "Hari ini" : `${days} hari lagi`;
        const warning = days !== null && days <= 7 ? "warn" : "";
        return `<div class="detail-batch"><div><strong>${escapeHtml(batch.id)}</strong><small>${formatNumber(batch.qty)} ${escapeHtml(product.unit)} · masuk ${formatDate(batch.receivedAt)}</small></div><span class="${warning}">${label}</span></div>`;
      }).join("") : `<p style="color:#69736d;font-size:11px">Belum ada batch dengan stok tersedia.</p>`}
    `;
  }

  function showToast(title, message, type = "success") {
    const toast = document.createElement("div");
    toast.className = `toast ${type === "error" ? "error" : ""}`;
    toast.innerHTML = `<svg aria-hidden="true" viewBox="0 0 24 24"><path d="M12 8v4m0 4h.01"/><path d="M10.3 4.7 3.9 16a2 2 0 0 0 1.7 3h12.8a2 2 0 0 0 1.7-3L13.7 4.7a2 2 0 0 0-3.4 0Z"/></svg><div><strong>${escapeHtml(title)}</strong><p>${escapeHtml(message)}</p></div>`;
    $("#toastRegion").append(toast);
    window.setTimeout(() => toast.remove(), 4300);
  }

  function openModal(id, trigger) {
    const modal = $(`[data-modal="${id}"]`);
    if (!modal) return;
    lastFocused = trigger || document.activeElement;
    if (id === "purchase") renderPurchaseList();
    if (id === "expiry") renderExpiryList();
    if (id === "receive") {
      $("#receiveDate").value = todayKey();
      $("#receiveExpiry").min = todayKey();
    }
    modal.hidden = false;
    $("#modalBackdrop").hidden = false;
    currentModal = modal;
    window.setTimeout(() => {
      const focusable = $("input, select, button", modal);
      focusable?.focus();
    }, 0);
  }

  function closeModal() {
    if (!currentModal) return;
    currentModal.hidden = true;
    $("#modalBackdrop").hidden = true;
    currentModal = null;
    lastFocused?.focus?.();
  }

  function clearErrors(form) {
    $$(".field-error", form).forEach((element) => { element.textContent = ""; });
    $$(".invalid", form).forEach((element) => element.classList.remove("invalid"));
  }

  function setError(id, message) {
    const input = $(`#${id}`);
    const field = $(`[data-error-for="${id}"]`);
    input?.classList.add("invalid");
    if (field) field.textContent = message;
  }

  function validInteger(value) { return Number.isInteger(Number(value)) && Number(value) >= 0; }

  async function receiveStock(event) {
    event.preventDefault();
    const form = event.currentTarget;
    clearErrors(form);
    const product = getProduct($("#receiveProduct").value);
    const quantity = Number($("#receiveQuantity").value);
    const priceRaw = $("#receivePrice").value;
    const price = priceRaw === "" ? 0 : Number(priceRaw);
    const receivedDate = $("#receiveDate").value;
    const expiryDate = $("#receiveExpiry").value;
    const batchId = $("#receiveBatch").value.trim().toUpperCase();
    let invalid = false;
    if (!product) { setError("receiveProduct", "Pilih barang yang akan diterima."); invalid = true; }
    if (!Number.isInteger(quantity) || quantity <= 0) { setError("receiveQuantity", "Jumlah masuk harus bilangan bulat lebih dari 0."); invalid = true; }
    if (!Number.isFinite(price) || price < 0) { setError("receivePrice", "Harga tidak boleh negatif."); invalid = true; }
    if (!receivedDate || Number.isNaN(startOfDay(receivedDate).getTime())) { setError("receiveDate", "Tanggal penerimaan wajib diisi."); invalid = true; }
    if (product?.perishable && !expiryDate) { setError("receiveExpiry", "Produk ini wajib memiliki tanggal kedaluwarsa."); invalid = true; }
    if (expiryDate && receivedDate && startOfDay(expiryDate) <= startOfDay(receivedDate)) { setError("receiveExpiry", "Tanggal kedaluwarsa harus setelah tanggal penerimaan."); invalid = true; }
    if (product?.perishable && !batchId) { setError("receiveBatch", "Nomor batch wajib diisi untuk produk ini."); invalid = true; }
    if (invalid) {
      showToast("Penerimaan belum dicatat", "Periksa kolom yang diberi tanda merah.", "error");
      return;
    }
    try {
      const payload = await requestApi("/api/stock-receipts", {
        method: "POST",
        body: JSON.stringify({ productId: product.id, quantity, price, receivedDate, expiryDate: expiryDate || null, batch: batchId || null })
      });
      state = payload.dashboard;
      renderAll();
      closeModal();
      form.reset();
      showToast("Barang berhasil diterima", `${formatNumber(quantity)} ${product.unit} ${product.name} ditambahkan ke stok.`);
    } catch (error) {
      showToast("Penerimaan ditolak server", error.message, "error");
    }
  }

  function batchSortForFefo(a, b) {
    if (a.expiryAt && b.expiryAt) return daysUntil(a.expiryAt) - daysUntil(b.expiryAt);
    if (a.expiryAt) return -1;
    if (b.expiryAt) return 1;
    return new Date(a.receivedAt) - new Date(b.receivedAt);
  }

  async function sendPosTransaction(event) {
    event.preventDefault();
    const form = event.currentTarget;
    clearErrors(form);
    const product = getProduct($("#posProduct").value);
    const quantity = Number($("#posQuantity").value);
    const receipt = $("#receiptId").value.trim().toUpperCase();
    let invalid = false;
    if (!product) { setError("posProduct", "Pilih barang yang muncul di transaksi kasir."); invalid = true; }
    if (!Number.isInteger(quantity) || quantity <= 0) { setError("posQuantity", "Jumlah terjual harus bilangan bulat lebih dari 0."); invalid = true; }
    if (!receipt) { setError("receiptId", "Nomor nota wajib diisi agar transaksi dapat dilacak."); invalid = true; }
    else if (state.receipts.includes(receipt)) { setError("receiptId", "Nomor nota ini sudah pernah diproses; stok tidak dikurangi dua kali."); invalid = true; }
    if (product && Number.isInteger(quantity) && quantity > availableStock(product)) {
      setError("posQuantity", `Stok keluar ${formatNumber(quantity)} ${product.unit} melebihi stok tersedia (${formatNumber(availableStock(product))} ${product.unit}).`);
      invalid = true;
    }
    if (invalid) {
      showToast("Transaksi kasir ditolak", "Validator menjaga stok dan nomor nota tetap konsisten.", "error");
      return;
    }
    try {
      const payload = await requestApi("/api/pos-transactions", {
        method: "POST",
        body: JSON.stringify({ productId: product.id, quantity, receiptId: receipt })
      });
      state = payload.dashboard;
      renderAll();
      closeModal();
      form.reset();
      showToast("Stok tersinkron dari kasir", `${product.name} berkurang ${formatNumber(quantity)} ${product.unit}; batch FEFO dipakai lebih dulu.`);
    } catch (error) {
      showToast("Transaksi kasir ditolak", error.message, "error");
    }
  }

  async function createProduct(event) {
    event.preventDefault();
    const form = event.currentTarget;
    clearErrors(form);
    const sku = $("#newSku").value.trim().toUpperCase();
    const name = $("#newName").value.trim();
    const unit = $("#newUnit").value;
    const stock = Number($("#newStock").value);
    const reorder = Number($("#newReorder").value);
    const target = Number($("#newTarget").value);
    const perishable = $("#newPerishable").checked;
    let invalid = false;
    if (!/^[A-Z0-9-]{3,20}$/.test(sku)) { setError("newSku", "SKU gunakan 3–20 karakter: huruf, angka, atau tanda hubung."); invalid = true; }
    else if (state.products.some((product) => product.sku === sku)) { setError("newSku", "SKU sudah terdaftar; gunakan kode yang unik."); invalid = true; }
    if (!name || name.length < 3) { setError("newName", "Nama barang minimal 3 karakter."); invalid = true; }
    if (!validInteger(stock)) { setError("newStock", "Stok awal harus bilangan bulat 0 atau lebih."); invalid = true; }
    if (!validInteger(reorder)) { setError("newReorder", "Batas beli harus bilangan bulat 0 atau lebih."); invalid = true; }
    if (!validInteger(target)) { setError("newTarget", "Target stok harus bilangan bulat 0 atau lebih."); invalid = true; }
    else if (target < reorder) { setError("newTarget", "Target stok harus sama atau lebih besar dari batas beli."); invalid = true; }
    if (perishable && stock > 0) { setError("newStock", "Untuk produk kedaluwarsa, gunakan stok awal 0 lalu catat lewat Terima Barang agar batch tercatat."); invalid = true; }
    if (invalid) { showToast("Barang belum disimpan", "Periksa aturan pada formulir master barang.", "error"); return; }
    try {
      const payload = await requestApi("/api/products", {
        method: "POST",
        body: JSON.stringify({ sku, name, unit, stock, reorder, target, perishable })
      });
      state = payload.dashboard;
      renderAll();
      closeModal();
      form.reset();
      $("#newStock").value = "0";
      showToast("Master barang tersimpan", `${name} siap menerima stok dan transaksi dari kasir.`);
    } catch (error) {
      showToast("Barang belum disimpan", error.message, "error");
    }
  }

  async function copyPurchaseList() {
    const items = getPurchaseItems();
    const text = items.length
      ? ["DAFTAR BELANJA — RUANG STOK", ...items.map((product) => `• ${product.name}: +${Math.max(0, product.target - availableStock(product))} ${product.unit} (stok ${availableStock(product)}, target ${product.target})`)].join("\n")
      : "Tidak ada barang yang perlu dibeli.";
    try {
      await navigator.clipboard.writeText(text);
      showToast("Daftar belanja disalin", "Kamu bisa langsung mengirimkannya ke supplier.");
    } catch (_) {
      showToast("Daftar siap dibaca", "Browser tidak mengizinkan salin otomatis; pilih item di layar ini secara manual.");
    }
  }

  function setActiveNavigation(target) {
    const map = { ringkasan: "ringkasan", stok: "stok", belanja: "belanja", kedaluwarsa: "kedaluwarsa", sinkronisasi: "sinkronisasi" };
    const active = map[target] || "ringkasan";
    $$(".nav-item").forEach((item) => item.classList.toggle("active", item.dataset.nav === active));
    $$(".mobile-nav a").forEach((item) => item.classList.toggle("active", item.dataset.mobileNav === active));
  }

  function wireEvents() {
    $$('[data-open-modal]').forEach((button) => button.addEventListener("click", () => openModal(button.dataset.openModal, button)));
    $("#openPurchaseList").addEventListener("click", (event) => openModal("purchase", event.currentTarget));
    $("#openExpiryView").addEventListener("click", (event) => openModal("expiry", event.currentTarget));
    $("#openPosModal").addEventListener("click", (event) => openModal("pos", event.currentTarget));
    $("#mobileReceive").addEventListener("click", (event) => openModal("receive", event.currentTarget));
    $("#noticeAction").addEventListener("click", (event) => {
      const target = event.currentTarget.dataset.target;
      if (target === "purchase") openModal("purchase", event.currentTarget);
      else $("#stok").scrollIntoView({ behavior: "smooth", block: "start" });
    });
    $("#viewPosHistory").addEventListener("click", () => showToast("Riwayat demo", "Panel ini menampilkan empat mutasi terakhir dari kasir dan penerimaan barang."));
    $("#healthInfo").addEventListener("click", () => showToast("Cara membaca skor", "Skor berkurang untuk stok kritis, stok di bawah batas beli, dan batch yang tinggal tujuh hari atau kurang."));
    $("#copyPurchase").addEventListener("click", copyPurchaseList);
    $("#searchItems").addEventListener("input", renderInventory);
    $("#statusFilter").addEventListener("change", renderInventory);
    $("#receiveProduct").addEventListener("change", updateReceiveProductMeta);
    $("#posProduct").addEventListener("change", updatePosProductMeta);
    $("#receiveForm").addEventListener("submit", receiveStock);
    $("#posForm").addEventListener("submit", sendPosTransaction);
    $("#newProductForm").addEventListener("submit", createProduct);
    $("#inventoryRows").addEventListener("click", (event) => {
      const button = event.target.closest("[data-detail]");
      if (!button) return;
      const product = getProduct(button.dataset.detail);
      if (product) {
        renderDetail(product);
        openModal("detail", button);
      }
    });
    $$('[data-close-modal]').forEach((button) => button.addEventListener("click", closeModal));
    $("#modalBackdrop").addEventListener("click", closeModal);
    document.addEventListener("keydown", (event) => {
      if (event.key === "Escape" && currentModal) closeModal();
    });
    $$('[data-nav], [data-mobile-nav]').forEach((item) => item.addEventListener("click", () => setActiveNavigation(item.dataset.nav || item.dataset.mobileNav)));
    $("#resetDemo").addEventListener("click", async () => {
      if (!window.confirm("Kembalikan seluruh data interaksi ke kondisi demo awal?")) return;
      try {
        const payload = await requestApi("/api/demo/reset", { method: "POST", body: JSON.stringify({}) });
        state = payload.dashboard;
        $("#searchItems").value = "";
        $("#statusFilter").value = "all";
        renderAll();
        showToast("Data demo dipulihkan", "Stok, batch, dan riwayat kasir kembali ke kondisi awal.");
      } catch (error) {
        showToast("Reset gagal", error.message, "error");
      }
    });
  }

  renderAll();
  wireEvents();
  refreshDashboard({ quiet: true });
})();

