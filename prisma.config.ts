import { config } from "dotenv";
import { defineConfig, env } from "prisma/config";

config({ path: ".env.local" });

export default defineConfig({
  schema: "prisma/schema.prisma",
  migrations: {
    path: "prisma/migrations",
  },
  // CLI operations (migrate, studio, introspect) connect directly, bypassing
  // the pooler. The app runtime uses DATABASE_URL (pooled) via the driver
  // adapter in src/lib/prisma.ts instead.
  datasource: {
    url: env("DIRECT_URL"),
  },
});
