import { Pool } from "pg";
import { PrismaPg } from "@prisma/adapter-pg";
import { PrismaClient } from "@/generated/prisma/client";

const globalForPrisma = global as unknown as { prisma: PrismaClient };

// Runtime usa uma conexão com pool. Aceita, nesta ordem:
//  1. DATABASE_URL (configuração manual existente)
//  2. POSTGRES_PRISMA_URL (injetada pela integração Supabase↔Vercel — pooled)
//  3. POSTGRES_URL (fallback pooled da mesma integração)
function normalizeConnectionString(value: string | undefined) {
  if (!value) return value;

  try {
    const url = new URL(value);
    const sslMode = url.searchParams.get("sslmode");

    // pg v8.21+ passou a tratar sslmode=require como verify-full.
    // Esta opção mantém a semântica libpq esperada pela URL provisionada
    // (TLS obrigatório, compatível com certificados do pool gerenciado).
    if (sslMode && ["prefer", "require", "verify-ca"].includes(sslMode)) {
      url.searchParams.set("uselibpqcompat", "true");
    }

    return url.toString();
  } catch {
    return value;
  }
}

function createPrismaClient() {
  const connectionString = normalizeConnectionString(
    process.env.DATABASE_URL ??
      process.env.POSTGRES_PRISMA_URL ??
      process.env.POSTGRES_URL
  );
  const pool = new Pool({ connectionString });
  const adapter = new PrismaPg(pool);
  return new PrismaClient({ adapter });
}

export const prisma = globalForPrisma.prisma ?? createPrismaClient();

if (process.env.NODE_ENV !== "production") globalForPrisma.prisma = prisma;
