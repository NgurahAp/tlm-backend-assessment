# Lumiere Backend Assessment

NestJS backend untuk pengerjaan Lumiere Backend Assessment secara bertahap.

Phase 0 sampai Phase 3 sudah diimplementasikan. Project memiliki fondasi NestJS dan Prisma, jawaban SQL A1–A7, read API, checkout dengan pemeriksaan Inventory API, kalkulasi decimal, atomic persistence, integrasi pembayaran, audit record, structured logging, serta automated test. Real Payment API smoke test dilakukan setelah nama kandidat dikonfigurasi.

Rencana lengkap tersedia di [PRD.md](./PRD.md).

## Project Setup

```bash
cp .env.example .env
# Replace CHANGE_ME in .env before starting the application.
npm install
```

Placeholder `.env.example` cukup untuk Prisma Client generation saat instalasi. Sebelum aplikasi dijalankan, `DATABASE_URL` wajib mengarah ke PostgreSQL yang aktif karena koneksi diverifikasi saat startup. Jangan commit `.env`.

## Compile and Run

```bash
# development
npm run start

# watch mode
npm run start:dev

# production mode
npm run start:prod
```

Available endpoints:

```http
GET /health
GET /docs
GET /docs-json
GET /orders?page=1&limit=20&status=Pending
GET /orders/:id
GET /orders/:id/items
POST /checkout
```

Health response:

```json
{
  "success": true,
  "data": {
    "status": "ok",
    "service": "tlm-backend-assessment",
    "timestamp": "2026-09-04T04:00:00.000Z",
    "uptimeSeconds": 12
  },
  "requestId": "8be2d021-e56a-4b7a-a9e3-edbfdf97fc4a"
}
```

## Checkout

`POST /checkout` memeriksa setiap inventory terlebih dahulu, mengambil nama produk dari Inventory API, menghitung total order, lalu menyimpan order beserta seluruh item dalam satu transaction. Inventory API assessment tidak menyediakan harga, sehingga request mengirim subtotal per item. Client tidak dapat mengirim nama produk, total order, status, atau nomor order.

```http
POST http://localhost:3000/checkout
Content-Type: application/json
X-Request-Id: checkout-manual-001
```

```json
{
  "payment_method": "Credit Card",
  "discount": 10,
  "items": [
    {
      "inventory_id": 1,
      "quantity": 1,
      "subtotal": 2000000
    },
    {
      "inventory_id": 2,
      "quantity": 1,
      "subtotal": 1000000
    }
  ]
}
```

Checkout berhasil mengembalikan HTTP `201 Created` dengan status order `PAID` setelah pembayaran terverifikasi. ID 1 dan 2 merupakan skenario stok tersedia pada assessment, sedangkan ID 3 menghasilkan HTTP `422` dengan code `INVENTORY_OUT_OF_STOCK`. Nomor order mengikuti pola `ORD-YYYYMM-NNN` dan dibuat di dalam transaction menggunakan PostgreSQL advisory lock agar request bersamaan tidak memperoleh nomor yang sama.

Setelah order tersimpan sebagai `Pending`, aplikasi melakukan Payment API inquiry, pay, lalu status verification. Hanya status terverifikasi `PAID` yang mengubah `orders.status` menjadi `PAID`. Kegagalan mengubah status order dan payment record menjadi `PAYMENT_FAILED`, mengembalikan error yang aman, dan mencatat detail teknis dengan `requestId` di `debug.log`.

Payment API membutuhkan candidate header. Isi `.env` sebelum mencoba checkout terhadap API nyata:

```env
CANDIDATE_NAME=Nama Lengkap Kandidat
```

Aplikasi mengubah nama menjadi format underscore, melakukan Base64 encoding, lalu mengirim hasilnya melalui `X-CANDIDATES-NAME`. Header tersebut termasuk daftar field yang di-redact dari log.

## Tests

```bash
npm run lint
npm run build
npm run test
npm run test:e2e
npm run test:integration
```

## Database

Project menggunakan Prisma ORM dengan PostgreSQL driver adapter. Prisma 7.10.0 dipin agar instalasi reproducible. Model `Order`, `OrderItem`, dan extension audit `Payment` dipetakan ke tabel PostgreSQL `orders`, `order_items`, dan `payments`.

```bash
# validate Prisma schema and configuration
npm run prisma:validate

# generate the type-safe client
npm run prisma:generate

# apply pending migrations in development
npx prisma migrate dev

# apply pending migrations in deployment environments
npx prisma migrate deploy

# inspect migration status
npx prisma migrate status
```

Jawaban SQL assessment A1–A7 tersedia di [`database/queries.txt`](./database/queries.txt). Sample insert di file tersebut menggunakan ID eksplisit sesuai soal dan menyinkronkan sequence agar ID berikutnya tetap aman. Aplikasi nantinya membiarkan PostgreSQL menghasilkan ID secara otomatis.

Export schema PostgreSQL tersedia di [`database/database.sql`](./database/database.sql). File ini ditujukan untuk database `lumiere_ecommerce` yang sudah dibuat dan masih kosong:

```bash
psql --dbname=lumiere_ecommerce --file=database/database.sql
```

`database.sql` hanya memuat schema. Sample assessment tetap berada di `database/queries.txt` agar import schema tidak otomatis menambahkan data demo.

Gunakan salah satu jalur inisialisasi pada database kosong: Prisma migration atau import `database.sql`. Jangan menjalankan keduanya pada database yang sama. Untuk menjalankan aplikasi dan melanjutkan development, Prisma migration adalah jalur utama; `database.sql` disediakan sebagai artifact export assessment.

Saat aplikasi startup, `PrismaService` membuka connection pool dan menjalankan read-only `SELECT 1`. Koneksi ditutup melalui NestJS shutdown lifecycle.

### Database Recovery and Rollback

- Buat backup sebelum migration pada environment yang sudah memiliki data, misalnya dengan `pg_dump --format=custom`.
- Jangan mengubah atau menghapus migration yang sudah diterapkan. Perubahan berikutnya dibuat sebagai migration baru yang bersifat forward-only.
- Untuk development database yang disposable, `npx prisma migrate reset` dapat digunakan untuk menghapus schema, menerapkan ulang seluruh migration, dan menghilangkan semua data.
- Untuk production, rollback dilakukan dengan corrective migration. Jika corrective migration tidak cukup, pulihkan backup yang sudah diverifikasi sebelum deployment.
- Initial schema dapat dibatalkan secara manual hanya pada database disposable dengan menghapus `order_items` terlebih dahulu, kemudian `orders`, karena terdapat foreign key di antara keduanya.

## Environment Configuration

Konfigurasi non-database divalidasi ketika aplikasi startup:

- `NODE_ENV`: `development`, `test`, atau `production`.
- `PORT`: port TCP valid; default `3000`.
- `SERVICE_NAME`: nama service; default `tlm-backend-assessment`.
- `INVENTORY_BASE_URL` dan `PAYMENT_BASE_URL`: URL HTTP(S) yang valid.
- `EXTERNAL_API_TIMEOUT_MS`: bilangan bulat positif; default `5000`.
- `CANDIDATE_NAME`: wajib diisi sebelum checkout menggunakan Payment API nyata.

Lihat seluruh placeholder pada `.env.example`. `DATABASE_URL` menerima scheme `postgresql://` atau `postgres://` dan wajib tersedia mulai Phase 1.1.

## Logging

Development menampilkan structured log yang mudah dibaca di terminal melalui `pino-pretty`. Log yang sama ditulis sebagai newline-delimited JSON ke `logs/debug.log` agar dapat dicari berdasarkan field dan dipakai sebagai artifact assessment.

Setiap HTTP request dicatat otomatis dengan method, path, status, dan `latencyMs`. Application atau business event dapat dicatat sebagai object dengan field `event` dan context terkait. Authorization, cookie, password, token, card number, CVV, candidate header, dan database URL di-redact menjadi `[Redacted]`.

`logs/debug.log` adalah runtime artifact dan tidak di-commit. Hanya `logs/.gitkeep` yang disimpan agar struktur folder tetap tersedia.

## Request Pipeline

Setiap request menggunakan `X-Request-Id` dari client jika nilainya aman, atau UUID baru jika header tidak tersedia. ID yang sama dikembalikan melalui response header dan digunakan pada structured log serta error response.

Global validation mengaktifkan transformasi DTO, whitelist, dan penolakan field yang tidak dikenal. Seluruh exception HTTP dikembalikan dengan bentuk `success`, `error`, `requestId`, `timestamp`, dan `path` yang konsisten. Detail internal serta stack trace hanya dicatat di log untuk error server.

## API Documentation

- Swagger UI: `http://localhost:3000/docs`
- OpenAPI JSON: `http://localhost:3000/docs-json`
- Application health: `http://localhost:3000/health`

Health memeriksa proses aplikasi. PostgreSQL tidak di-query ulang pada setiap health request, tetapi aplikasi hanya berhasil startup setelah `PrismaService` memverifikasi koneksi database.
