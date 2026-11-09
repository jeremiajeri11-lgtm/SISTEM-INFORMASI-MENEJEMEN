import { mkdir, readFile, writeFile } from "node:fs/promises";
import path from "node:path";
import { fileURLToPath } from "node:url";

const sourceDirectory = path.dirname(fileURLToPath(import.meta.url));
const dataDirectory = path.resolve(sourceDirectory, "../data");
const dataFile = path.join(dataDirectory, "inventory.json");
let writeQueue = Promise.resolve();

function isoDateWithOffset(days) {
  const date = new Date();
  date.setHours(12, 0, 0, 0);
  date.setDate(date.getDate() + days);
  return date.toISOString().slice(0, 10);
}

export function createDemoData() {
  return {
    products: [
      { id: "indomie-goreng", sku: "MKN-IND-001", name: "Indomie Goreng", unit: "pcs", reorder: 24, target: 60, perishable: false, symbol: "I", tone: "yellow", batches: [{ id: "A-031", qty: 12, receivedAt: isoDateWithOffset(-18), expiryAt: null, price: 3100 }] },
      { id: "aqua-600", sku: "MNM-AQU-600", name: "Aqua Mineral 600 ml", unit: "botol", reorder: 12, target: 48, perishable: false, symbol: "A", tone: "leaf", batches: [{ id: "A-611", qty: 9, receivedAt: isoDateWithOffset(-6), expiryAt: null, price: 2500 }] },
      { id: "susu-uht", sku: "MNM-SUS-011", name: "Susu UHT Cokelat", unit: "kotak", reorder: 12, target: 30, perishable: true, symbol: "S", tone: "warm", batches: [{ id: "B-2407", qty: 8, receivedAt: isoDateWithOffset(-20), expiryAt: isoDateWithOffset(4), price: 6800 }] },
      { id: "roti-cokelat", sku: "MKN-ROT-009", name: "Roti Cokelat", unit: "bungkus", reorder: 10, target: 24, perishable: true, symbol: "R", tone: "warm", batches: [{ id: "R-119", qty: 6, receivedAt: isoDateWithOffset(-2), expiryAt: isoDateWithOffset(1), price: 4200 }] },
      { id: "teh-botol", sku: "MNM-TEH-002", name: "Teh Botol Sosro", unit: "botol", reorder: 18, target: 50, perishable: false, symbol: "T", tone: "leaf", batches: [{ id: "T-523", qty: 28, receivedAt: isoDateWithOffset(-8), expiryAt: null, price: 3600 }] },
      { id: "gula-pasir", sku: "BHN-GUL-001", name: "Gula Pasir 1 kg", unit: "bungkus", reorder: 8, target: 18, perishable: false, symbol: "G", tone: "yellow", batches: [{ id: "G-201", qty: 16, receivedAt: isoDateWithOffset(-10), expiryAt: null, price: 16200 }] }
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

async function ensureDataFile() {
  await mkdir(dataDirectory, { recursive: true });
  try {
    await readFile(dataFile, "utf8");
  } catch (error) {
    if (error.code !== "ENOENT") throw error;
    await writeFile(dataFile, JSON.stringify(createDemoData(), null, 2), "utf8");
  }
}

export async function readData() {
  await ensureDataFile();
  return JSON.parse(await readFile(dataFile, "utf8"));
}

export async function mutateData(mutator) {
  const job = writeQueue.then(async () => {
    const data = await readData();
    const result = await mutator(data);
    await writeFile(dataFile, JSON.stringify(data, null, 2), "utf8");
    return { data, result };
  });
  writeQueue = job.catch(() => undefined);
  return job;
}

export async function resetDemoData() {
  return mutateData((data) => {
    const freshData = createDemoData();
    Object.keys(data).forEach((key) => delete data[key]);
    Object.assign(data, freshData);
    return data;
  });
}

