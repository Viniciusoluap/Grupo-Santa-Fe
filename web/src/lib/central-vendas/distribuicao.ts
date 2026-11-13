import "server-only";
// Central de Vendas — paridade com a Prospecta (13/11/2026; gêmeo de Prospecta/server/central-vendas/distribuicao.ts).
// Distribuição em rodízio entre os operadores da Central e SLA de primeira resposta humana (só conta minutos em
// horário de atendimento). Estouro → reatribuição automática + auditoria.
import { emHorarioDeAtendimento, minutosUteisEntre, proximoOperador } from "./regras";
import { agora, avisar, avisarAdmins, carregarConfig, db, dadosDoLead, partesHoje, registrarEvento, registrarInteracao, usuariosAtivos } from "./base";

async function operadoresDisponiveis() {
  const config = await carregarConfig();
  const ativos = await usuariosAtivos(config.operadores);
  return { config, ids: ativos.map(u => u.id) };
}

async function ultimoAtribuido(): Promise<string | null> {
  const r = await db().centralVendasLead.findFirst({
    where: { atribuidoEm: { not: null } }, orderBy: [{ atribuidoEm: "desc" }, { leadId: "desc" }], select: { operadorId: true },
  });
  return r?.operadorId ?? null;
}

/** Rodízio: próximo operador ativo depois do último que recebeu um atendimento. */
export async function atribuirOperador(leadId: string, excluir?: string | null): Promise<string | null> {
  const { config, ids } = await operadoresDisponiveis();
  const escolhido = proximoOperador(ids, await ultimoAtribuido(), excluir);
  if (!escolhido) {
    await registrarEvento({ tipo: "sem_operador", leadId, resultado: "erro", erro: "Nenhum operador ativo marcado na Central." });
    if (await registrarEvento({ tipo: "alerta_sem_operador", chave: `sem-operador:${partesHoje()}` })) {
      await avisarAdmins("Central de Vendas sem operadores", "Há atendimentos sem operador: marque os operadores em Central de Vendas › Configurações.", leadId);
    }
    return null;
  }
  await db().centralVendasLead.updateMany({ where: { leadId }, data: { operadorId: escolhido, atribuidoEm: agora(), atualizadoEm: agora() } });
  // O responsável do CRM (campo já existente) recebe o operador quando ainda está vazio.
  await db().lead.updateMany({ where: { id: leadId, responsavelId: null }, data: { responsavelId: escolhido } });
  await registrarEvento({ tipo: excluir ? "reatribuido" : "atribuido", leadId, payload: { operadorId: escolhido, foraDoHorario: !emHorarioDeAtendimento(agora(), config.horarioAtendimento) } });
  return escolhido;
}

/** Primeira mensagem humana (não automática) enviada ao lead depois de `desde`. */
async function respostaHumanaDesde(leadId: string, desde: Date): Promise<Date | null> {
  const automaticas = (await db().centralVendasFila.findMany({ where: { leadId, mensagemId: { not: null } }, select: { mensagemId: true } }))
    .map(f => f.mensagemId!);
  const m = await db().mensagemWhatsapp.findFirst({
    where: { leadId, direcao: "saida", enviadaEm: { gt: desde }, ...(automaticas.length ? { id: { notIn: automaticas } } : {}) },
    orderBy: { enviadaEm: "asc" }, select: { enviadaEm: true },
  });
  return m?.enviadaEm ?? null;
}

/** Verifica o SLA de quem espera atendimento humano: respondeu → registra; estourou → reatribui. */
export async function verificarSla() {
  const { config, ids } = await operadoresDisponiveis();
  const esperando = await db().centralVendasLead.findMany({
    where: { statusAtendimento: "em_atendimento_humano", aguardandoHumanoDesde: { not: null }, primeiraRespostaHumanaEm: null },
  });
  const resumo = { respondidos: 0, reatribuidos: 0, estourados: 0 };
  for (const cv of esperando) {
    const desde = cv.aguardandoHumanoDesde!;
    const respondeu = await respostaHumanaDesde(cv.leadId, desde);
    if (respondeu) {
      await db().centralVendasLead.updateMany({ where: { leadId: cv.leadId }, data: { primeiraRespostaHumanaEm: respondeu, atualizadoEm: agora() } });
      await registrarEvento({ tipo: "primeira_resposta_humana", leadId: cv.leadId, payload: { operadorId: cv.operadorId, minutosUteis: minutosUteisEntre(desde, respondeu, config.horarioAtendimento) } });
      resumo.respondidos++;
      continue;
    }
    if (minutosUteisEntre(desde, agora(), config.horarioAtendimento) < config.slaMinutos) continue;
    resumo.estourados++;
    const outro = proximoOperador(ids, cv.operadorId, cv.operadorId);
    if (!outro) {
      if (await registrarEvento({ tipo: "sla_estourado", leadId: cv.leadId, payload: { operadorId: cv.operadorId, semOutroOperador: true }, resultado: "erro", chave: `sla:${cv.leadId}:${desde.toISOString()}` })) {
        await avisarAdmins("Central de Vendas: SLA estourado", "Um atendimento passou do SLA de primeira resposta e não há outro operador para reatribuir.", cv.leadId);
      }
      continue;
    }
    // Reivindica pela data de espera: duas rodadas simultâneas não reatribuem duas vezes.
    const r = await db().centralVendasLead.updateMany({
      where: { leadId: cv.leadId, aguardandoHumanoDesde: desde },
      data: { operadorId: outro, atribuidoEm: agora(), aguardandoHumanoDesde: agora(), atualizadoEm: agora() },
    });
    if (!r.count) continue;
    await db().lead.updateMany({ where: { id: cv.leadId }, data: { responsavelId: outro } });
    await registrarEvento({ tipo: "sla_reatribuido", leadId: cv.leadId, payload: { de: cv.operadorId, para: outro, slaMinutos: config.slaMinutos } });
    await registrarInteracao(cv.leadId, `SLA de primeira resposta (${config.slaMinutos} min) estourado: atendimento reatribuído automaticamente.`);
    const lead = await dadosDoLead(cv.leadId);
    await avisar([outro], "Central de Vendas: atendimento reatribuído para você", `${lead?.nome ?? "Cliente"} aguarda resposta (SLA estourado com o operador anterior).${cv.resumoTransferencia ? `\n\nResumo: ${cv.resumoTransferencia}` : ""}`, cv.leadId);
    resumo.reatribuidos++;
  }
  return resumo;
}
