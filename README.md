# Ruang Stok

Sistem Informasi Manajemen (SIM) inventaris warung yang terhubung ke alur kasir. Proyek ini memakai **frontend** HTML/CSS/JavaScript dan **backend** Node.js + Express.

## Fitur utama

- Dashboard prioritas: stok kritis, rekomendasi belanja, dan batch mendekati kedaluwarsa.
- API penerimaan stok dengan validasi jumlah, harga, nomor batch, dan tanggal kedaluwarsa.
- API transaksi POS/kasir yang menolak stok negatif dan nomor nota duplikat (*idempotency*).
- Pengeluaran batch memakai FEFO (*first-expired, first-out*): batch yang paling dekat kedaluwarsa dipakai terlebih dahulu.
- Data tersimpan dalam `data/inventory.json`. File dibuat otomatis saat server pertama kali berjalan.

## Alur sistem

```text
Kasir/POS → POST /api/pos-transactions → validasi nota & stok → kurangi batch FEFO → dashboard diperbarui
Supplier → POST /api/stock-receipts → validasi batch & tanggal → tambah stok → daftar belanja diperbarui
```

## Menjalankan lokal

Prasyarat: Node.js 20 atau lebih baru.

```bash
npm install
npm run dev
```

Buka `http://localhost:3000`.

## Endpoint penting

| Method | Endpoint | Fungsi |
| --- | --- | --- |
| GET | `/api/dashboard` | Mengambil seluruh data dashboard |
| POST | `/api/products` | Menambah master barang |
| POST | `/api/stock-receipts` | Mencatat barang masuk/batch baru |
| POST | `/api/pos-transactions` | Mengurangi stok dari transaksi kasir |
| GET | `/api/purchase-list` | Rekomendasi daftar belanja |
| GET | `/api/expiring` | Batch aktif menurut kedaluwarsa |
| POST | `/api/demo/reset` | Mengembalikan data demonstrasi |

### Contoh transaksi kasir

```json
{
  "productId": "aqua-600",
  "quantity": 2,
  "receiptId": "POS-20261109-015"
}
```

## Catatan deployment

`render.yaml` disertakan untuk deployment melalui Render. Disk diperlukan karena JSON datastore harus bertahan setelah server di-restart; di Render, disk persisten hanya tersedia pada web service berbayar (konfigurasi memakai plan `0.5c-512mb`). Untuk aplikasi yang digunakan banyak toko atau banyak cabang, pindahkan datastore ke PostgreSQL/Supabase.

Dokumentasi: [Express](https://expressjs.com/), [Render Blueprint](https://render.com/docs/infrastructure-as-code).

