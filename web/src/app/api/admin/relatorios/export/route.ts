import { NextRequest, NextResponse } from "next/server";
import { auth } from "@/auth";
import { prisma } from "@/lib/db";

function parseDate(raw: string | null, fallback: Date): Date {
  if (!raw) return fallback;
  const d = new Date(raw);
  return isNaN(d.getTime()) ? fallback : d;
}

export async function GET(req: NextRequest) {
  const session = await auth();
  if (!session) return NextResponse.json({ error: "Não autorizado" }, { status: 401 });

  const { searchParams } = req.nextUrl;
  const now = new Date();
  const fromDate = parseDate(searchParams.get("from"), new Date(now.getFullYear(), now.getMonth() - 11, 1));
  const toDate = parseDate(searchParams.get("to"), new Date(now.getFullYear(), now.getMonth() + 1, 0, 23, 59, 59));
  toDate.setHours(23, 59, 59, 999);

  const comissoes = await prisma.comissao.findMany({
    where: { pagamentoEm: { gte: fromDate, lte: toDate } },
    include: { corretor: { select: { nome: true } } },
    orderBy: { pagamentoEm: "asc" },
  });

  const BOM = "﻿";
  const header = "Data;Corretor;Imóvel;Valor;Status\n";
  const rows = comissoes
    .map((c) => {
      const data = c.pagamentoEm ? new Date(c.pagamentoEm).toLocaleDateString("pt-BR") : "";
      const corretor = c.corretor?.nome ?? "";
      const imovel = c.imovel.replace(/;/g, " ");
      const valor = c.valor.toFixed(2).replace(".", ",");
      return `${data};${corretor};${imovel};${valor};${c.status}`;
    })
    .join("\n");

  const csv = BOM + header + rows;

  return new NextResponse(csv, {
    status: 200,
    headers: {
      "Content-Type": "text/csv; charset=utf-8",
      "Content-Disposition": `attachment; filename="relatorio-comissoes-${fromDate.toISOString().split("T")[0]}.csv"`,
    },
  });
}
