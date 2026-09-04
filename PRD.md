# Product Requirements Document

## Lumiere Backend Assessment

| Informasi | Nilai |
| --- | --- |
| Status | Draft untuk review |
| Nama repository | `tlm-backend-assessment` |
| Jenis aplikasi | REST API backend |
| Framework | NestJS + TypeScript |
| Database | PostgreSQL |
| Dokumentasi API | Swagger / OpenAPI |
| Strategi pengerjaan | Bertahap per phase |

## 1. Ringkasan

Proyek ini adalah layanan backend untuk proses checkout e-commerce. Sistem menerima permintaan checkout, memeriksa ketersediaan stok melalui Inventory API, menyimpan order beserta item secara atomik, menjalankan pembayaran melalui Payment API, memperbarui status order, dan menyediakan jejak error yang dapat diaudit.

Produk akhir berupa REST API yang dapat didemonstrasikan melalui Swagger. Frontend tidak termasuk ruang lingkup karena seluruh requirement assessment dapat dipenuhi melalui API, dokumentasi OpenAPI, database artifact, dan automated test.

## 2. Tujuan

1. Menjawab seluruh soal database pada bagian A.
2. Menyediakan endpoint `POST /checkout` yang tervalidasi dan aman.
3. Mengintegrasikan Inventory API untuk memeriksa stok.
4. Menyimpan `orders` dan `order_items` dalam satu database transaction.
5. Mengintegrasikan alur payment inquiry, pay, dan status.
6. Menyinkronkan status pembayaran ke tabel `orders`.
7. Menyediakan error handling dan log yang dapat ditelusuri.
8. Mendokumentasikan seluruh API melalui Swagger.
9. Menyediakan automated test untuk skenario utama dan skenario gagal.
10. Menyediakan seluruh artifact pengumpulan yang diminta assessment.

## 3. Di Luar Ruang Lingkup

- Aplikasi frontend atau halaman checkout untuk pengguna akhir.
- Authentication dan authorization pengguna.
- Sistem manajemen produk internal.
- Sistem reservasi atau pengurangan stok karena assessment hanya menyediakan API pengecekan stok.
- Deployment ke production cloud.
- Refund, void, settlement, dan rekonsiliasi pembayaran.
- Message broker dan asynchronous worker, kecuali kemudian dibutuhkan untuk pengembangan tambahan.

## 4. Pengguna dan Aktor Sistem

### 4.1 API Consumer

Developer atau reviewer yang mengirim request melalui Swagger, Postman, atau HTTP client.

### 4.2 Inventory API

Layanan eksternal yang memberikan informasi produk dan ketersediaan stok berdasarkan ID inventory.

### 4.3 Payment API

Layanan eksternal yang menangani inquiry tagihan, trigger pembayaran, dan pemeriksaan status pembayaran.

### 4.4 Reviewer

Pihak yang menjalankan aplikasi, membaca Swagger dan README, menjalankan test, serta memeriksa SQL dan log.

## 5. Pilihan Teknis

### 5.1 Stack

- NestJS dengan TypeScript.
- PostgreSQL sebagai relational database.
- Prisma untuk schema, migration, database client, query, dan transaction.
- Swagger melalui `@nestjs/swagger`.
- `class-validator` dan `class-transformer` untuk validasi request DTO.
- NestJS HTTP client untuk komunikasi dengan Inventory API dan Payment API.
- Vitest dan Supertest untuk unit serta end-to-end test.
- Structured logger menggunakan `nestjs-pino` dan Pino.
- `pino-pretty` untuk terminal development dan newline-delimited JSON untuk `logs/debug.log`.

### 5.2 Prinsip Arsitektur

- Controller hanya menangani HTTP request dan response.
- Business flow checkout berada di `CheckoutService`.
- Integrasi eksternal dipisahkan ke `InventoryService` dan `PaymentService`.
- Akses database menggunakan Prisma Client dan Prisma transaction.
- Request serta response dari API eksternal divalidasi sebelum digunakan.
- Konfigurasi dan secret hanya dibaca dari environment variables.
- Error internal diterjemahkan menjadi response API yang konsisten.

### 5.3 Struktur Modul Target

```text
src/
  app.module.ts
  main.ts
  common/
    constants/
    exceptions/
    filters/
    interceptors/
    logging/
  config/
  prisma/
    prisma.module.ts
    prisma.service.ts
  health/
  orders/
  checkout/
  inventory/
  payments/
prisma/
  migrations/
  schema.prisma
logs/
  .gitkeep
```

## 6. Requirement Fungsional

## 6.1 Database

### FR-DB-01 — Inisialisasi Database

Sistem harus menyediakan query PostgreSQL untuk membuat database bernama `lumiere_ecommerce`.

Artifact:

- `database/queries.txt`
- `database/database.sql`

### FR-DB-02 — Tabel Orders

Sistem harus memiliki tabel `orders` dengan field assessment:

| Field | PostgreSQL Type | Aturan |
| --- | --- | --- |
| `id` | `BIGSERIAL` | Primary key |
| `order_number` | `VARCHAR(50)` | Wajib dan unik |
| `payment_method` | `VARCHAR(30)` | Wajib |
| `status` | `VARCHAR(20)` | Wajib, default `Pending` |
| `subtotal` | `NUMERIC(10,2)` | Wajib, tidak negatif |
| `discount` | `NUMERIC(10,2)` | Persentase 0 sampai 100 |
| `grand_total` | `NUMERIC(10,2)` | Wajib, tidak negatif |
| `order_date` | `TIMESTAMP` | Wajib |
| `created_at` | `TIMESTAMP` | Diisi otomatis |
| `updated_at` | `TIMESTAMP` | Diisi dan diperbarui otomatis |

### FR-DB-03 — Tabel Order Items

Sistem harus memiliki tabel `order_items` dengan field assessment:

| Field | PostgreSQL Type | Aturan |
| --- | --- | --- |
| `id` | `BIGSERIAL` | Primary key |
| `order_id` | `BIGINT` | Foreign key ke `orders.id` |
| `product_name` | `VARCHAR(255)` | Wajib |
| `quantity` | `INTEGER` | Wajib dan lebih dari nol |
| `subtotal` | `NUMERIC(10,2)` | Wajib dan tidak negatif |
| `created_at` | `TIMESTAMP` | Diisi otomatis |
| `updated_at` | `TIMESTAMP` | Diisi dan diperbarui otomatis |

Foreign key menggunakan `ON DELETE CASCADE` agar item tidak menjadi orphan ketika order dihapus.

### FR-DB-04 — Sample Insert Orders

Sistem harus menyediakan query insert untuk contoh order yang diberikan assessment. Query jawaban literal boleh mencantumkan `id = 1`, sedangkan aplikasi harus membiarkan PostgreSQL menghasilkan ID secara otomatis.

### FR-DB-05 — Sample Insert Order Items

Sistem harus menyediakan query insert untuk contoh item yang diberikan assessment dan menghubungkannya ke order melalui `order_id`.

### FR-DB-06 — Query Daftar Orders

Sistem harus menyediakan query untuk menampilkan seluruh order. Sebagai pelengkap implementasi, API menyediakan `GET /orders` dengan pagination.

### FR-DB-07 — Query Items Berdasarkan Order

Sistem harus menyediakan query untuk menampilkan `order_items` berdasarkan order tertentu. Sebagai pelengkap implementasi, API menyediakan `GET /orders/:id/items`.

## 6.2 Checkout dan Inventory

### FR-CO-01 — Endpoint Checkout

Sistem harus menyediakan:

```http
POST /checkout
```

Request yang dipilih:

```json
{
  "payment_method": "Credit Card",
  "discount": 10,
  "items": [
    {
      "inventory_id": 1,
      "quantity": 1
    }
  ]
}
```

Client tidak boleh menentukan `subtotal`, `grand_total`, nama produk, atau harga final. Nilai tersebut harus berasal dari Inventory API dan dihitung oleh server untuk mencegah manipulasi.

### FR-CO-02 — Validasi Checkout

Aturan validasi request:

- `payment_method` wajib berupa string dan maksimal 30 karakter.
- `discount` opsional, berupa angka dari 0 sampai 100, default 0.
- `items` wajib berupa array dengan minimal satu item.
- `inventory_id` wajib berupa integer positif.
- `quantity` wajib berupa integer positif.
- Inventory ID duplikat ditolak agar kalkulasi dan audit tidak ambigu.
- Field yang tidak dikenal ditolak.

### FR-CO-03 — Pemeriksaan Inventory

Untuk setiap item, sistem harus memanggil:

```http
GET https://assessment.lumiere.dev/api/v1/inventory/:id
```

Skenario wajib:

| Inventory ID | Ekspektasi |
| --- | --- |
| 1 | Stok tersedia, checkout dapat dilanjutkan |
| 2 | Stok tersedia, checkout dapat dilanjutkan |
| 3 | Stok tidak tersedia, checkout ditolak |

Sistem harus menangani response tidak valid, timeout, connection error, dan status HTTP gagal dari Inventory API.

### FR-CO-04 — Kalkulasi Order

Perhitungan dilakukan server:

```text
item_subtotal = unit_price × quantity
order_subtotal = jumlah seluruh item_subtotal
discount_amount = order_subtotal × discount / 100
grand_total = order_subtotal - discount_amount
```

Semua perhitungan uang menggunakan presisi desimal dua digit dan tidak menggunakan floating-point biasa untuk operasi kritis.

### FR-CO-05 — Nomor Order

Nomor order menggunakan pola:

```text
ORD-YYYYMM-NNN
```

Contoh: `ORD-202609-001`.

Sequence berjalan per bulan dan harus aman terhadap concurrent request. Unique constraint pada `order_number` wajib tersedia.

### FR-CO-06 — Atomic Persistence

Penyimpanan satu order beserta seluruh item harus dilakukan dalam satu database transaction:

- Jika seluruh insert berhasil, transaction di-commit.
- Jika satu insert gagal, seluruh perubahan di-rollback.
- Tidak boleh ada order tanpa item akibat kegagalan sebagian.

Panggilan API eksternal tidak boleh menahan database transaction lebih lama dari yang diperlukan.

## 6.3 Integrasi Pembayaran

### FR-PAY-01 — Candidate Header

Seluruh request ke Payment API harus mengirim:

```http
X-CANDIDATES-NAME: Base64(nama_kandidat_dengan_underscore)
```

Nama kandidat disimpan dalam environment variable dan diubah ke underscore sebelum di-encode Base64.

### FR-PAY-02 — Inquiry

Sistem harus memanggil:

```http
POST https://assessment.lumiere.dev/api/v1/payment/inquiry
```

Body:

```json
{
  "order_id": "ORD-202609-001",
  "amount": 1800000
}
```

`order_id` berasal dari nomor order yang dibuat sistem dan `amount` berasal dari `orders.grand_total`.

### FR-PAY-03 — Trigger Payment

Setelah inquiry berhasil, sistem harus memanggil:

```http
POST https://assessment.lumiere.dev/api/v1/payment/pay
```

Body dibentuk dari data order tersimpan dan `transaction_id` hasil inquiry. Sistem tidak boleh mempercayai ulang nominal yang dikirim client.

### FR-PAY-04 — Check Payment Status

Sistem harus memanggil:

```http
GET https://assessment.lumiere.dev/api/v1/payment/status/:transaction_id
```

Jika status terverifikasi `PAID`, status pada tabel `orders` harus diperbarui menjadi `PAID`.

### FR-PAY-05 — Payment Record

Sebagai extension untuk audit, aplikasi menambahkan tabel `payments` pada phase pembayaran. Tabel ini tidak mengubah jawaban literal soal tabel `orders` dan `order_items`.

Data minimal:

- Order ID.
- Transaction ID.
- Status.
- Amount.
- Inquiry timestamp.
- Payment timestamp.
- Potongan response eksternal yang aman untuk audit.

### FR-PAY-06 — Status Order

Status internal yang digunakan:

| Status | Arti |
| --- | --- |
| `Pending` | Order tersimpan dan belum diproses pembayaran |
| `PAYMENT_PROCESSING` | Inquiry berhasil atau payment sedang diproses |
| `PAID` | Payment terverifikasi berhasil |
| `PAYMENT_FAILED` | Payment gagal dan membutuhkan pemeriksaan |

### FR-PAY-07 — Idempotency

Request pembayaran yang sama tidak boleh menghasilkan pembayaran ganda. Sistem harus memeriksa status order dan payment record sebelum memulai payment baru.

### FR-PAY-08 — Validasi Payment Payload

Sistem harus memvalidasi payload internal sebelum menghubungi Payment API dan memvalidasi response eksternal sebelum menyimpan atau menggunakan nilainya.

Validasi minimum:

- `order_id` sesuai pola nomor order.
- `amount` lebih dari nol dan sama dengan `orders.grand_total`.
- `transaction_id` tersedia setelah inquiry.
- Daftar item tidak kosong dan berasal dari order tersimpan.
- Status response termasuk status yang dikenali sistem.
- Response tanpa field wajib dianggap sebagai response eksternal tidak valid.

## 6.4 Query API Tambahan

### FR-API-01 — Daftar Orders

```http
GET /orders?page=1&limit=20&status=PAID
```

Response menyediakan pagination metadata.

### FR-API-02 — Detail Order

```http
GET /orders/:id
```

Response memuat order, items, dan ringkasan pembayaran jika tersedia.

### FR-API-03 — Items Berdasarkan Order

```http
GET /orders/:id/items
```

Endpoint ini menjadi padanan API untuk soal query `order_items` berdasarkan order tertentu.

## 6.5 Error Handling dan Logging

### FR-ERR-01 — Standard Error Response

Seluruh error harus diterjemahkan ke status HTTP dan body response yang konsisten. Stack trace tidak boleh dikirim kepada API consumer.

### FR-ERR-02 — Error Traceability

Setiap request harus memiliki `requestId`. Sistem menggunakan nilai header `X-Request-Id` dari client jika tersedia atau membuat UUID baru. Nilai yang sama wajib dikembalikan melalui response header, tersedia pada response error, dan dicatat pada seluruh log terkait agar insiden dapat dicari kembali untuk kebutuhan audit.

### FR-LOG-01 — Debug Log

HTTP request, business event penting, error fungsi, kegagalan external API, dan bug yang ditemukan saat runtime atau testing harus dicatat secara terstruktur. Terminal development menggunakan format `pino-pretty`, sedangkan `logs/debug.log` menggunakan satu JSON object per baris agar dapat dicari dan diproses secara otomatis.

## 7. Kontrak Response

### 7.1 Response Checkout Berhasil

```json
{
  "success": true,
  "data": {
    "order_number": "ORD-202609-001",
    "transaction_id": "TRX_123456789",
    "status": "PAID",
    "subtotal": "2000000.00",
    "discount": "10.00",
    "grand_total": "1800000.00"
  },
  "requestId": "019..."
}
```

### 7.2 Response Error

```json
{
  "success": false,
  "error": {
    "code": "INVENTORY_OUT_OF_STOCK",
    "message": "Inventory item 3 is out of stock",
    "details": []
  },
  "requestId": "019...",
  "timestamp": "2026-09-03T10:00:00.000Z",
  "path": "/checkout"
}
```

### 7.3 Status Code

| HTTP status | Penggunaan |
| --- | --- |
| 200 | Request GET berhasil atau checkout selesai |
| 201 | Resource berhasil dibuat jika endpoint dipisah |
| 400 | Request tidak dapat diproses secara sintaks atau aturan umum |
| 404 | Order atau inventory tidak ditemukan |
| 409 | Konflik status atau pembayaran sudah diproses |
| 422 | Payload tidak valid atau stok tidak mencukupi |
| 502 | Inventory/Payment API memberikan response gagal atau tidak valid |
| 504 | Inventory/Payment API timeout |
| 500 | Error internal yang tidak terduga |

## 8. Logging dan Audit

### 8.1 Output

Output logging dibagi berdasarkan environment:

- Development terminal: format berwarna dan mudah dibaca melalui `pino-pretty`.
- File audit assessment: newline-delimited JSON di `logs/debug.log`.
- Production: JSON ke stdout; file tetap dapat diaktifkan untuk memenuhi requirement assessment.

### 8.2 Field Log Minimum

- `time` dalam ISO-8601.
- `level`.
- `service`.
- `event` dengan pola domain, misalnya `checkout.received`.
- `requestId`.
- `method`, `path`, `statusCode`, dan `latencyMs` untuk HTTP request.
- `orderNumber` dan `transactionId` jika tersedia.
- `externalService` dan external HTTP status jika tersedia.
- `errorCode` dan `msg`.
- Stack trace hanya untuk exception internal pada log, tidak pada response API.

### 8.3 Data yang Tidak Boleh Dicatat

- Database password.
- Database connection string atau `DATABASE_URL`.
- Authorization token.
- Cookie dan session identifier.
- Card number, CVV, access token, refresh token, serta request body sensitif.
- Candidate header mentah jika dianggap sensitif.
- Secret dari environment.
- Data pribadi yang tidak diperlukan.

### 8.4 Traceability

Nilai `requestId` dikembalikan pada response error dan header `X-Request-Id`, lalu dicatat pada seluruh log dalam satu alur checkout sehingga error dapat dicari kembali saat audit.

## 9. Swagger / OpenAPI

Swagger tersedia melalui:

```text
/docs
```

OpenAPI JSON tersedia melalui `/docs-json`.

Dokumentasi minimal mencakup:

- `GET /health`
- `POST /checkout`
- `GET /orders`
- `GET /orders/:id`
- `GET /orders/:id/items`
- Request dan response schema.
- Contoh payload sukses serta gagal.
- Seluruh status code utama.
- Penjelasan bahwa external API dipanggil oleh backend.
- Fitur `Try it out` dapat digunakan tanpa frontend.

## 10. Konfigurasi Environment

`.env.example` minimal menyediakan:

```dotenv
NODE_ENV=development
PORT=3000
SERVICE_NAME=tlm-backend-assessment

DATABASE_URL="postgresql://postgres:CHANGE_ME@localhost:5432/lumiere_ecommerce?schema=public"

INVENTORY_BASE_URL=https://assessment.lumiere.dev/api/v1/inventory
PAYMENT_BASE_URL=https://assessment.lumiere.dev/api/v1/payment
EXTERNAL_API_TIMEOUT_MS=5000

CANDIDATE_NAME=
LOG_LEVEL=debug
LOG_FILE=logs/debug.log
LOG_PRETTY=true
```

`.env` memuat credential aktual dan tidak boleh di-commit. `.env.example` hanya memuat placeholder. Karakter khusus pada password di `DATABASE_URL` wajib menggunakan percent-encoding. Phase 0 hanya menyiapkan serta memvalidasi konfigurasi non-database; Prisma mulai menggunakan `DATABASE_URL` pada Phase 1.

## 11. Non-Functional Requirements

### NFR-01 — Reliability

- Database write wajib atomic.
- External API memiliki timeout.
- Retry hanya digunakan untuk error sementara dan tidak boleh menyebabkan payment ganda.
- Payment flow harus idempotent.

### NFR-02 — Maintainability

- Strict TypeScript aktif.
- Tidak ada business logic penting di controller.
- DTO, external response type, entity, dan service dipisahkan.
- Nama fungsi serta error code konsisten.

### NFR-03 — Security

- Environment configuration tervalidasi saat startup.
- Secret tidak berada di repository.
- Swagger tidak mengandung credential asli.
- Input menggunakan whitelist dan unknown field ditolak.
- Error response tidak membocorkan stack trace.

### NFR-04 — Observability

- Setiap request memiliki correlation ID.
- Seluruh kegagalan external API memiliki log yang dapat ditelusuri.
- HTTP request dan business event memiliki field terstruktur yang konsisten.
- Secret dan request field sensitif di-redact sebelum log ditulis.
- Log rotation atau batas ukuran diselesaikan pada Phase 4.

### NFR-05 — Documentation

- Setup dan run command tersedia di README.
- Migration, test, Swagger, dan export SQL dijelaskan.
- Semua asumsi assessment dicatat.

## 12. Strategi Testing

### 12.1 Unit Test

- Kalkulasi subtotal, diskon, dan grand total.
- Pembuatan order number.
- Candidate name normalization dan Base64 encoding.
- Mapping Inventory API response.
- Mapping Payment API response.
- Status transition order.
- Error mapping.

### 12.2 Integration Test

- Menyimpan order dan semua item dalam satu transaction.
- Rollback ketika salah satu item gagal.
- Unique constraint order number.
- Relasi order dan item.
- Penyimpanan serta update payment record.

### 12.3 End-to-End Test

| Skenario | Ekspektasi |
| --- | --- |
| Inventory ID 1 tersedia | Checkout dapat mencapai status `PAID` |
| Inventory ID 2 tersedia | Checkout dapat mencapai status `PAID` |
| Inventory ID 3 tidak tersedia | Response stok tidak tersedia, tidak ada order parsial |
| Payload tidak valid | Response 422 |
| Inventory API timeout | Response 504 dan log terbentuk |
| Inventory API error | Response 502 dan log terbentuk |
| Insert item gagal | Seluruh transaction rollback |
| Payment inquiry gagal | Order menjadi `PAYMENT_FAILED` dan dapat ditelusuri |
| Payment pay gagal | Order menjadi `PAYMENT_FAILED` dan dapat ditelusuri |
| Payment status `PAID` | `orders.status` berubah menjadi `PAID` |
| Payment request diulang | Tidak menciptakan payment ganda |

External API dimock pada automated test agar hasil test deterministik. Pengujian real API dilakukan sebagai smoke test terpisah jika endpoint assessment dapat diakses.

## 13. Phase Pengerjaan

## 13.1 Requirement Traceability Matrix

| Soal assessment | Requirement PRD | Phase | Bukti akhir |
| --- | --- | --- | --- |
| A1 — Create database | FR-DB-01 | Phase 1 | `queries.txt` dan `database.sql` |
| A2 — Create `orders` | FR-DB-02 | Phase 1 | SQL, Prisma migration/model, dan test |
| A3 — Create `order_items` | FR-DB-03 | Phase 1 | SQL, Prisma migration/model, dan test |
| A4 — Insert `orders` | FR-DB-04 | Phase 1 | Sample SQL dan hasil integration test |
| A5 — Insert `order_items` | FR-DB-05 | Phase 1 | Sample SQL dan hasil integration test |
| A6 — Tampilkan `orders` | FR-DB-06 dan FR-API-01 | Phase 1 | SQL, endpoint, Swagger, dan test |
| A7 — Items berdasarkan order | FR-DB-07 dan FR-API-03 | Phase 1 | SQL, endpoint, Swagger, dan test |
| B1 — `POST /checkout` | FR-CO-01 | Phase 2 | Endpoint, Swagger, dan e2e test |
| B2 — Inventory API | FR-CO-03 | Phase 2 | Inventory client dan test ID 1, 2, 3 |
| B3 — Validasi order dan items | FR-CO-02 | Phase 2 | DTO, validation response, dan test |
| B4 — Satu transaction | FR-CO-06 | Phase 2 | Transaction implementation dan rollback test |
| C1 — Inquiry, pay, status | FR-PAY-01 sampai FR-PAY-07 | Phase 3 | Payment client, orchestration, database record, dan test |
| C2 — Validasi payment payload | FR-PAY-08 | Phase 3 | Validator request/response dan negative test |
| C3 — Update status order | FR-PAY-04 dan FR-PAY-06 | Phase 3 | Status transition dan integration test |
| C4 — Error dan audit | FR-ERR-01 dan FR-ERR-02 | Phase 3–4 | Error contract, request ID, dan trace test |
| C5 — `debug.log` | FR-LOG-01 | Phase 0 dan Phase 4 | File logger dan log verification test |

## Phase 0 — Project Foundation

### Scope

- Finalisasi PRD.
- Rapikan scaffold NestJS.
- Tetapkan package name `tlm-backend-assessment`.
- Tambahkan configuration module dan environment validation.
- Tambahkan global validation pipe.
- Tambahkan `nestjs-pino`, `pino-pretty`, structured HTTP logging, dan structured business logging.
- Tambahkan correlation ID melalui `X-Request-Id` atau UUID baru.
- Tambahkan redaction untuk authorization, cookie, password, token, card number, CVV, dan database URL.
- Tambahkan global exception format dasar.
- Tambahkan pretty console log dan JSON file logger ke `logs/debug.log`.
- Tambahkan Swagger di `/docs`.
- Tambahkan OpenAPI JSON di `/docs-json`.
- Tambahkan `GET /health`.
- Buat `.env.example` dengan placeholder `DATABASE_URL` dan README awal.

Tidak termasuk Phase 0: instalasi Prisma, koneksi database, pembuatan schema, dan eksekusi migration.

### Urutan Pengerjaan

- [x] **Phase 0.1 — Scaffold dan konfigurasi:** rapikan metadata project, pasang configuration module, validasi environment non-database, buat `.env.example`, dan pastikan aplikasi tetap dapat startup tanpa PostgreSQL.
- [x] **Phase 0.2 — Logging:** pasang `nestjs-pino` serta `pino-pretty`, aktifkan pretty log di terminal, tulis JSON ke `logs/debug.log`, dan konfigurasi redaction.
- [x] **Phase 0.3 — Request pipeline:** tambahkan `X-Request-Id`, global validation pipe, dan global exception filter dengan kontrak response standar.
- [x] **Phase 0.4 — Dokumentasi API:** tambahkan `GET /health`, Swagger `/docs`, dan OpenAPI JSON `/docs-json`.
- [x] **Phase 0.5 — Verifikasi fondasi:** tambah atau sesuaikan test, jalankan build, lint, unit test, e2e test, lalu periksa bahwa secret dan runtime log tidak masuk Git.

### Acceptance Criteria

- `npm install` berhasil.
- `npm run build` berhasil.
- `npm run lint` berhasil.
- Baseline unit test dan e2e test berhasil.
- Aplikasi dapat startup tanpa membuka koneksi PostgreSQL.
- `GET /health` mengembalikan response sukses.
- `/docs` menampilkan Swagger UI.
- `/docs-json` mengembalikan OpenAPI specification.
- Setiap HTTP response memiliki `X-Request-Id`.
- Unknown route menghasilkan global error response dengan `requestId`.
- Terminal development mudah dibaca dan `logs/debug.log` berisi JSON terstruktur.
- Field sensitif pada log berubah menjadi `[Redacted]` atau dihapus.
- Tidak ada credential asli dalam Git.

## Phase 1 — Database dan Jawaban Bagian A

### Scope

- Install Prisma CLI, Prisma Client, dan PostgreSQL driver adapter yang diperlukan.
- Konfigurasikan Prisma PostgreSQL melalui `DATABASE_URL` dan Prisma config.
- Hubungkan project ke database `lumiere_ecommerce` yang sudah tersedia.
- Tambahkan Prisma service/module dan graceful shutdown.
- Tulis query A1 untuk membuat database PostgreSQL sebagai jawaban assessment; query ini tidak dieksekusi ke database milik pengguna.
- Prisma migration dan model `orders`.
- Prisma migration dan model `order_items`.
- Foreign key serta constraint.
- Sample insert order.
- Sample insert item.
- Query daftar orders.
- Query order items berdasarkan order.
- Endpoint read-only orders sebagai pelengkap.
- File `database/queries.txt`.

### Urutan Pengerjaan

- [ ] **Phase 1.1 — Prisma foundation:** install dependency Prisma, siapkan Prisma config, hubungkan `DATABASE_URL`, generate client, dan verifikasi koneksi database.
- [ ] **Phase 1.2 — Schema dan migration:** modelkan `orders` serta `order_items`, buat constraint dan foreign key, lalu terapkan migration.
- [ ] **Phase 1.3 — Jawaban SQL A1–A7:** tulis seluruh query assessment ke `database/queries.txt` dan pastikan contoh insert serta query read menghasilkan data yang benar.
- [ ] **Phase 1.4 — Read API:** implementasikan endpoint read-only orders dan order items beserta DTO, service, Swagger, dan error handling.
- [ ] **Phase 1.5 — Verifikasi database:** jalankan integration test, validasi constraint, dokumentasikan strategi recovery/rollback, dan siapkan export `database.sql` untuk final delivery.

### Acceptance Criteria

- Prisma Client berhasil di-generate.
- Koneksi `DATABASE_URL` berhasil diverifikasi terhadap database `lumiere_ecommerce`.
- Migration dapat diterapkan pada database kosong dan strategi recovery/rollback didokumentasikan.
- Seluruh field assessment tersedia dengan tipe PostgreSQL yang benar.
- Sample insert berhasil.
- Foreign key menolak `order_id` yang tidak tersedia.
- Query A6 dan A7 menghasilkan data yang benar.
- Unit/integration test database lulus.
- Bagian A nomor 1 sampai 7 dapat ditelusuri ke artifact atau endpoint tertentu.

## Phase 2 — Checkout dan Inventory

### Scope

- DTO dan validasi checkout.
- `POST /checkout`.
- Inventory client dan response validation.
- Test case inventory ID 1, 2, dan 3.
- Kalkulasi subtotal, discount, dan grand total.
- Pembuatan order number.
- Transaction penyimpanan order dan item.
- Swagger untuk request serta response checkout dasar.

### Acceptance Criteria

- Invalid payload ditolak dengan response konsisten.
- ID 1 dan ID 2 dapat melanjutkan checkout.
- ID 3 menghentikan checkout sebagai out-of-stock.
- Nilai uang dihitung server.
- Order dan seluruh item disimpan atomik.
- Kegagalan satu insert menyebabkan rollback penuh.
- Test unit, integration, dan e2e Phase 2 lulus.

## Phase 3 — Payment Integration

### Scope

- Candidate header encoding.
- Payment inquiry.
- Trigger payment.
- Payment status check.
- Validasi request dan response Payment API.
- Tabel/entity payment untuk audit.
- Sinkronisasi `orders.status`.
- Idempotency protection.
- Error handling external payment.

### Acceptance Criteria

- Semua Payment API menerima candidate header yang benar.
- Inquiry menggunakan nomor order dan grand total internal.
- Pay menggunakan transaction ID hasil inquiry.
- Status `PAID` mengubah order menjadi `PAID`.
- Kegagalan mengubah order menjadi `PAYMENT_FAILED` sesuai aturan.
- Request ulang tidak menciptakan pembayaran ganda.
- Semua error pembayaran memiliki request ID dan log.
- Test Phase 3 lulus.

## Phase 4 — Hardening, Dokumentasi, dan Delivery

### Scope

- Lengkapi seluruh Swagger example dan error response.
- Lengkapi logging ke `debug.log`.
- Audit error trace dan sanitasi log.
- Lengkapi automated test seluruh skenario.
- Finalisasi README.
- Export database ke `.sql`.
- Pastikan `.txt` jawaban SQL tersedia.
- Rapikan struktur repository.
- Verifikasi repository naming dan checklist contributor.

### Acceptance Criteria

- Build, lint, unit test, integration test, dan e2e test lulus.
- Swagger menjelaskan seluruh endpoint dan dapat digunakan untuk demo.
- Error eksternal dapat ditemukan kembali dengan `requestId`.
- `debug.log` dibuat saat skenario error diuji.
- `database.sql` dapat di-import ke PostgreSQL kosong.
- Repository tidak berisi secret, dependency directory, atau log runtime.
- Seluruh butir assessment memiliki bukti implementasi.
- README berisi langkah setup, migration, run, test, Swagger, dan troubleshooting.

## 14. Artifact Akhir

```text
tlm-backend-assessment/
  src/
  test/
  prisma/
    schema.prisma
    migrations/
  database/
    queries.txt
    database.sql
  logs/
    .gitkeep
  .env.example
  prisma.config.ts
  PRD.md
  README.md
  package.json
```

`debug.log`, `.env`, `node_modules`, coverage output, dan build output tidak di-commit.

## 15. Asumsi dan Keputusan

1. PostgreSQL lokal dan database `lumiere_ecommerce` sudah dibuat oleh pengguna; aplikasi menerima connection string hanya melalui `.env`.
2. `discount = 10.00` diperlakukan sebagai persentase 10% karena contoh mengubah 2.000.000 menjadi 1.800.000.
3. Tipe assessment `string` untuk `product_name` diterjemahkan menjadi `VARCHAR(255)`.
4. Pola nomor order adalah `ORD-YYYYMM-NNN` dan sequence di-reset per bulan.
5. Contoh nomor `ORD-202601-001` tetap digunakan dalam query literal assessment, sedangkan aplikasi menghasilkan nomor sesuai waktu checkout.
6. Harga dan nama produk yang digunakan checkout berasal dari Inventory API, bukan dari input client.
7. Pembayaran dianggap berhasil hanya setelah status diverifikasi `PAID`.
8. External API dimock pada automated test dan real API hanya digunakan untuk smoke test.
9. Tabel `payments` merupakan extension untuk audit dan tidak menggantikan dua tabel wajib pada bagian A.
10. Frontend tidak dibuat; Swagger menjadi interface demonstrasi.
11. Karena catatan "Nomor 1 tuliskan ke bentuk .txt" dapat ditafsirkan berbeda, `queries.txt` akan memuat seluruh jawaban SQL A1 sampai A7 agar tidak ada jawaban database yang terlewat.
12. Credential database yang pernah dibagikan harus dirotasi. Nilai aslinya tidak disalin ke PRD, source code, `.env.example`, log, atau Git.

## 16. Informasi yang Diisi Kemudian

Informasi berikut tidak menghambat penyusunan fondasi, tetapi harus tersedia sebelum real API smoke test:

- Nama kandidat untuk `X-CANDIDATES-NAME`.
- `DATABASE_URL` yang valid, sudah dirotasi, dan tersimpan hanya pada `.env` lokal.
- Bentuk response aktual Inventory API.
- Konfirmasi akses ke domain assessment dari environment pengujian.

## 17. Definition of Done Keseluruhan

Proyek dinyatakan selesai ketika:

1. Seluruh acceptance criteria Phase 0 sampai Phase 4 terpenuhi.
2. Seluruh soal A1–A7, B1–B4, dan C1–C5 mempunyai implementasi serta test yang dapat ditunjukkan.
3. Aplikasi dapat dijalankan dari instruksi README pada environment baru.
4. Swagger dapat digunakan reviewer untuk mencoba API tanpa frontend.
5. Migration dan export SQL dapat membentuk database yang konsisten.
6. Tidak ada kegagalan build, lint, unit test, integration test, atau e2e test.
7. Error kritis dapat ditelusuri melalui request ID dan `debug.log`.
8. Repository siap dikirim dengan nama `tlm-backend-assessment`.
