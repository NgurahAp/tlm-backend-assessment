# Lumiere Backend Assessment

Starter NestJS untuk pengerjaan Lumiere Backend Assessment secara bertahap.

Project saat ini sengaja dikembalikan ke kondisi dasar NestJS. Database, Prisma, Swagger, serta business logic belum diimplementasikan.

Rencana lengkap tersedia di [PRD.md](./PRD.md).

## Project Setup

```bash
npm install
```

## Compile and Run

```bash
# development
npm run start

# watch mode
npm run start:dev

# production mode
npm run start:prod
```

Starter endpoint:

```http
GET /
```

Response:

```text
Hello World!
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
