import "dotenv/config";
import { defineConfig } from "prisma/config";

export default defineConfig({
  schema: "prisma/schema.prisma",
  migrations: { path: "prisma/migrations" },
  // process.env rather than env() so `prisma generate` works without a database configured.
  datasource: { url: process.env.DATABASE_URL ?? "" },
});
