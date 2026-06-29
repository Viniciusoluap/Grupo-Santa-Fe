import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/lib/db";
import { auth } from "@/auth";

const PLUGGY_API = "https://api.pluggy.ai";

async function getPluggyToken(): Promise<string | null> {
  const clientId = process.env.PLUGGY_CLIENT_ID;
  const clientSecret = process.env.PLUGGY_CLIENT_SECRET;
  if (!clientId || !clientSecret) return null;

  const res = await fetch(`${PLUGGY_API}/auth`, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ clientId, clientSecret }),
  });
  if (!res.ok) return null;
  const data = await res.json() as { apiKey: string };
  return data.apiKey;
}

export async function POST(req: NextRequest) {
  const session = await auth();
  if (!session) return NextResponse.json({ error: "Não autorizado" }, { status: 401 });

  const { contaId } = await req.json() as { contaId: string };

  const conta = await prisma.contaBancaria.findUnique({ where: { id: contaId } });
  if (!conta) return NextResponse.json({ error: "Conta não encontrada" }, { status: 404 });

  // Pluggy integration
  if (conta.pluggyAccountId) {
    const token = await getPluggyToken();
    if (token) {
      const txRes = await fetch(
        `${PLUGGY_API}/transactions?accountId=${conta.pluggyAccountId}&pageSize=100`,
        { headers: { "X-API-KEY": token } }
      );
      if (txRes.ok) {
        const txData = await txRes.json() as {
          results: {
            id: string;
            date: string;
            description: string;
            amount: number;
            type: string;
            category?: string;
          }[];
        };

        const transacoes = txData.results.map((t) => ({
          externalId: t.id,
          data: t.date,
          descricao: t.description,
          valor: Math.abs(t.amount),
          tipo: t.type === "CREDIT" ? "credito" : "debito",
          categoria: t.category,
        }));

        // Fetch updated balance
        const accRes = await fetch(`${PLUGGY_API}/accounts/${conta.pluggyAccountId}`, {
          headers: { "X-API-KEY": token },
        });
        let novoSaldo = conta.saldoAtual;
        if (accRes.ok) {
          const accData = await accRes.json() as { balance: number };
          novoSaldo = accData.balance;
        }

        // Upsert transactions
        for (const t of transacoes) {
          await prisma.transacaoBancaria.upsert({
            where: { externalId: t.externalId },
            create: { contaId, data: new Date(t.data), descricao: t.descricao, valor: t.valor, tipo: t.tipo, categoria: t.categoria, externalId: t.externalId },
            update: {},
          });
        }
        await prisma.contaBancaria.update({
          where: { id: contaId },
          data: { saldoAtual: novoSaldo, ultimaSincronizacao: new Date() },
        });

        return NextResponse.json({ ok: true, sincronizados: transacoes.length, saldo: novoSaldo });
      }
    }
  }

  // Fallback: return current state (no Pluggy configured)
  return NextResponse.json({
    ok: false,
    configurado: false,
    mensagem: "Configure PLUGGY_CLIENT_ID e PLUGGY_CLIENT_SECRET nas variáveis de ambiente para sincronização automática.",
  });
}
