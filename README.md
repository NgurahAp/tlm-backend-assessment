# Lumiere Backend Assessment

NestJS backend untuk pengerjaan Lumiere Backend Assessment secara bertahap.

Phase 0 menyediakan scaffold NestJS, konfigurasi environment tervalidasi, structured logging, request ID, global validation, global error response, health endpoint, dan Swagger. Database, Prisma, serta business logic belum diimplementasikan.

Rencana lengkap tersedia di [PRD.md](./PRD.md).

## Project Setup

```bash
npm install
cp .env.example .env
```

Nilai default Phase 0.1 cukup untuk menjalankan aplikasi. `DATABASE_URL` belum dibaca atau digunakan sampai Phase 1, sehingga PostgreSQL tidak diperlukan untuk startup pada phase ini. Simpan credential asli hanya di `.env` lokal dan jangan commit file tersebut.

## Compile and Run

```bash
# development
npm run start

# watch mode
npm run start:dev

# production mode
npm run start:prod
```

Foundation endpoints:

```http
GET /health
GET /docs
GET /docs-json
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

## Tests

```bash
npm run lint
npm run build
npm run test
npm run test:e2e
```

## Database Plan

PostgreSQL akan digunakan sebagai database. Prisma akan ditambahkan pada phase database berikutnya untuk schema, migration, database client, dan transaction.

## Environment Configuration

Konfigurasi non-database divalidasi ketika aplikasi startup:

- `NODE_ENV`: `development`, `test`, atau `production`.
- `PORT`: port TCP valid; default `3000`.
- `SERVICE_NAME`: nama service; default `tlm-backend-assessment`.
- `INVENTORY_BASE_URL` dan `PAYMENT_BASE_URL`: URL HTTP(S) yang valid.
- `EXTERNAL_API_TIMEOUT_MS`: bilangan bulat positif; default `5000`.
- `CANDIDATE_NAME`: boleh kosong sampai integrasi API dikerjakan.

Lihat seluruh placeholder pada `.env.example`. Konfigurasi Prisma dan validasi `DATABASE_URL` dikerjakan pada Phase 1.

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

Health pada Phase 0 hanya memeriksa proses aplikasi. Pemeriksaan koneksi PostgreSQL ditambahkan setelah Prisma tersedia pada Phase 1.
