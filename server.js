import express from "express";
import path from "node:path";
import { fileURLToPath } from "node:url";
import { createDemoData, mutateData, readData, resetDemoData } from "./src/store.js";

const app = express();
const port = Number(process.env.PORT) || 3000;
const rootDirectory = path.dirname(fileURLToPath(import.meta.url));
const publicDirectory = path.join(rootDirectory, "public");
const dayInMilliseconds = 24 * 60 * 60 * 1000;

app.disable("x-powered-by");
app.use(express.json({ limit: "100kb" }));

function appError(message, status = 400, code = "VALIDATION_ERROR") {
  const error = new Error(message);
  error.status = status;
  error.code = code;
  return error;
}

function dayStart(value) {
  const date = new Date(`${value}T12:00:00`);
  return new Date(date.getFullYear(), date.getMonth(), date.getDate());
}

function daysUntil(value) {
  return Math.round((dayStart(value) - dayStart(new Date().toISOString().slice(0, 10))) / dayInMilliseconds);
}

function isExpired(batch) {
  return Boolean(batch.expiryAt) && daysUntil(batch.expiryAt) < 0;
}

function availableStock(product) {
  return product.batches.reduce((total, batch) => total + (isExpired(batch) ? 0 : batch.qty), 0);
}

function statusFor(product) {
  const stock = availableStock(product);
  if (product.reorder > 0 && stock <= Math.ceil(product.reorder / 2)) return "critical";
  if (product.reorder > 0 && stock <= product.reorder) return "reorder";
  return "safe";
}

function stockSnapshot(data) {
  return {
    ...data,
    products: data.products.map((product) => ({
      ...product,
      availableStock: availableStock(product),
      stockStatus: statusFor(product)
    }))
  };
}

function requireString(value, field, { min = 1, max = 80, pattern } = {}) {
  if (typeof value !== "string") throw appError(`${field} wajib berupa teks.`);
  const result = value.trim();
  if (result.length < min || result.length > max) throw appError(`${field} harus berisi ${min}–${max} karakter.`);
  if (pattern && !pattern.test(result)) throw appError(`${field} memiliki format tidak valid.`);
  return result;
}

function requireNonNegativeInteger(value, field) {
  if (!Number.isInteger(value) || value < 0) throw appError(`${field} harus bilangan bulat 0 atau lebih.`);
  return value;
}

function requirePositiveInteger(value, field) {
  if (!Number.isInteger(value) || value <= 0) throw appError(`${field} harus bilangan bulat lebih dari 0.`);
  return value;
}

function validDate(value, field) {
  if (typeof value !== "string" || !/^\d{4}-\d{2}-\d{2}$/.test(value) || Number.isNaN(dayStart(value).getTime())) {
    throw appError(`${field} harus memakai format YYYY-MM-DD.`);
  }
  return value;
}

function findProduct(data, id) {
  const product = data.products.find((item) => item.id === id);
  if (!product) throw appError("Barang tidak ditemukan.", 404, "NOT_FOUND");
  return product;
}

function makeId(prefix) {
  return `${prefix}-${Date.now().toString(36)}-${Math.random().toString(36).slice(2, 6)}`.toUpperCase();
}

function timestampLabel() {
  return new Intl.DateTimeFormat("id-ID", { hour: "2-digit", minute: "2-digit", hour12: false }).format(new Date());
}

function fefoSort(a, b) {
  if (a.expiryAt && b.expiryAt) return daysUntil(a.expiryAt) - daysUntil(b.expiryAt);
  if (a.expiryAt) return -1;
  if (b.expiryAt) return 1;
  return new Date(a.receivedAt) - new Date(b.receivedAt);
}

app.get("/api/health", (_request, response) => response.json({ ok: true, service: "ruang-stok-api" }));

app.get("/api/dashboard", async (_request, response, next) => {
  try {
    response.json(stockSnapshot(await readData()));
  } catch (error) { next(error); }
});

app.get("/api/products", async (request, response, next) => {
  try {
    const data = stockSnapshot(await readData());
    const query = String(request.query.q || "").trim().toLowerCase();
    const status = String(request.query.status || "all");
    const products = data.products.filter((product) =>
      (!query || product.name.toLowerCase().includes(query) || product.sku.toLowerCase().includes(query)) &&
      (status === "all" || product.stockStatus === status)
    );
    response.json({ products });
  } catch (error) { next(error); }
});

app.get("/api/products/:id", async (request, response, next) => {
  try {
    const data = stockSnapshot(await readData());
    const product = findProduct(data, request.params.id);
    response.json({ product });
  } catch (error) { next(error); }
});

app.post("/api/products", async (request, response, next) => {
  try {
    const { data, result } = await mutateData((data) => {
      const sku = requireString(request.body.sku, "SKU", { min: 3, max: 20, pattern: /^[A-Za-z0-9-]+$/ }).toUpperCase();
      const name = requireString(request.body.name, "Nama barang", { min: 3, max: 48 });
      const unit = requireString(request.body.unit, "Satuan", { min: 2, max: 20 });
      const reorder = requireNonNegativeInteger(request.body.reorder, "Batas beli");
      const target = requireNonNegativeInteger(request.body.target, "Target stok");
      const openingStock = requireNonNegativeInteger(request.body.stock, "Stok awal");
      const perishable = Boolean(request.body.perishable);
      if (target < reorder) throw appError("Target stok harus sama atau lebih besar dari batas beli.");
      if (perishable && openingStock > 0) throw appError("Produk kedaluwarsa harus diterima melalui endpoint penerimaan agar batch tercatat.");
      if (data.products.some((product) => product.sku === sku)) throw appError("SKU sudah terdaftar.", 409, "DUPLICATE_SKU");
      const id = sku.toLowerCase().replace(/[^a-z0-9]+/g, "-").replace(/(^-|-$)/g, "");
      const product = {
        id: data.products.some((item) => item.id === id) ? `${id}-${Date.now().toString().slice(-3)}` : id,
        sku, name, unit, reorder, target, perishable,
        symbol: name.charAt(0).toUpperCase(), tone: "leaf",
        batches: openingStock ? [{ id: "STOK-AWAL", qty: openingStock, receivedAt: new Date().toISOString().slice(0, 10), expiryAt: null, price: 0 }] : []
      };
      data.products.push(product);
      return product;
    });
    response.status(201).json({ product: result, dashboard: stockSnapshot(data) });
  } catch (error) { next(error); }
});

app.post("/api/stock-receipts", async (request, response, next) => {
  try {
    const { data, result } = await mutateData((data) => {
      const product = findProduct(data, request.body.productId);
      const quantity = requirePositiveInteger(request.body.quantity, "Jumlah masuk");
      const price = request.body.price === undefined || request.body.price === "" ? 0 : Number(request.body.price);
      if (!Number.isFinite(price) || price < 0) throw appError("Harga modal tidak boleh negatif.");
      const receivedDate = validDate(request.body.receivedDate, "Tanggal penerimaan");
      const expiryDate = request.body.expiryDate ? validDate(request.body.expiryDate, "Tanggal kedaluwarsa") : null;
      const batchId = request.body.batch ? requireString(request.body.batch, "Nomor batch", { min: 1, max: 24 }).toUpperCase() : null;
      if (product.perishable && !expiryDate) throw appError("Produk ini wajib memiliki tanggal kedaluwarsa.");
      if (product.perishable && !batchId) throw appError("Produk ini wajib memiliki nomor batch.");
      if (expiryDate && dayStart(expiryDate) <= dayStart(receivedDate)) throw appError("Tanggal kedaluwarsa harus setelah tanggal penerimaan.");
      const batch = { id: batchId || makeId("IN"), qty: quantity, receivedAt: receivedDate, expiryAt: expiryDate, price };
      product.batches.push(batch);
      const receipt = makeId("GR");
      data.events.unshift({ id: makeId("E"), kind: "receive", at: "baru saja", product: product.name, quantity, unit: product.unit, receipt });
      data.events = data.events.slice(0, 50);
      data.lastSync = new Date().toISOString();
      return { product, batch, receipt };
    });
    response.status(201).json({ ...result, dashboard: stockSnapshot(data) });
  } catch (error) { next(error); }
});

app.post("/api/pos-transactions", async (request, response, next) => {
  try {
    const { data, result } = await mutateData((data) => {
      const product = findProduct(data, request.body.productId);
      const quantity = requirePositiveInteger(request.body.quantity, "Jumlah terjual");
      const receiptId = requireString(request.body.receiptId, "Nomor nota", { min: 3, max: 32 }).toUpperCase();
      if (data.receipts.includes(receiptId)) throw appError("Nomor nota ini sudah pernah diproses; stok tidak dikurangi dua kali.", 409, "DUPLICATE_RECEIPT");
      const stock = availableStock(product);
      if (quantity > stock) throw appError(`Stok keluar ${quantity} ${product.unit} melebihi stok tersedia (${stock} ${product.unit}).`, 409, "INSUFFICIENT_STOCK");
      let remaining = quantity;
      const appliedBatches = [];
      product.batches.filter((batch) => batch.qty > 0 && !isExpired(batch)).sort(fefoSort).forEach((batch) => {
        const used = Math.min(batch.qty, remaining);
        if (used) appliedBatches.push({ batchId: batch.id, quantity: used });
        batch.qty -= used;
        remaining -= used;
      });
      data.receipts.push(receiptId);
      data.events.unshift({ id: makeId("E"), kind: "sale", at: "baru saja", product: product.name, quantity, unit: product.unit, receipt: receiptId });
      data.events = data.events.slice(0, 50);
      data.lastSync = new Date().toISOString();
      return { product, receiptId, appliedBatches };
    });
    response.status(201).json({ ...result, dashboard: stockSnapshot(data) });
  } catch (error) { next(error); }
});

app.get("/api/purchase-list", async (_request, response, next) => {
  try {
    const data = stockSnapshot(await readData());
    const items = data.products
      .filter((product) => product.stockStatus !== "safe")
      .map((product) => ({ ...product, suggestedQuantity: Math.max(0, product.target - product.availableStock) }));
    response.json({ items });
  } catch (error) { next(error); }
});

app.get("/api/expiring", async (_request, response, next) => {
  try {
    const data = await readData();
    const batches = data.products.flatMap((product) => product.batches
      .filter((batch) => batch.qty > 0 && batch.expiryAt && !isExpired(batch))
      .map((batch) => ({ productId: product.id, productName: product.name, unit: product.unit, ...batch, daysRemaining: daysUntil(batch.expiryAt) }))
    ).sort((a, b) => a.daysRemaining - b.daysRemaining);
    response.json({ batches });
  } catch (error) { next(error); }
});

app.post("/api/demo/reset", async (_request, response, next) => {
  try {
    const { data } = await resetDemoData();
    response.json({ dashboard: stockSnapshot(data) });
  } catch (error) { next(error); }
});

app.use(express.static(publicDirectory));
app.get("/{*splat}", (_request, response) => response.sendFile(path.join(publicDirectory, "index.html")));

app.use((error, _request, response, _next) => {
  const status = error.status || 500;
  if (status >= 500) console.error(error);
  response.status(status).json({ error: { code: error.code || "INTERNAL_ERROR", message: status >= 500 ? "Terjadi kesalahan pada server." : error.message } });
});

app.listen(port, () => console.log(`Ruang Stok berjalan di http://localhost:${port}`));

