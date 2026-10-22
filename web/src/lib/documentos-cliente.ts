import { prisma } from "@/lib/db";
import { usuarioAtual, exigirModuloAcao } from "@/lib/auth/modulos";
import { obterAtorCrm, autorizarLeadDoAtor } from "@/lib/crm/acesso-lead";
import { financiamentoDoAtor } from "@/lib/crm/acesso-financiamento";
import { DOCUMENTOS_CLIENTE } from "@/lib/documentos-cliente-padrao";
import { sendEmail } from "@/lib/email";

export type TipoChecklist = "crm" | "financiamento";
export async function autorizarClienteDocumentos(tipo: TipoChecklist, id: string) {
  const u = await usuarioAtual();
  if (!u?.ativo) throw new Error("Não autorizado.");
  const fin = tipo === "financiamento" ? await prisma.financiamento.findUnique({where:{id},select:{leadId:true}}) : null;
  const leadId = tipo === "crm" ? id : fin?.leadId;
  if (!leadId) throw new Error("Cliente vinculado não encontrado.");
  const lead = await prisma.lead.findUnique({where:{id:leadId},select:{id:true,nome:true,email:true,corretorId:true}});
  if (!lead) throw new Error("Cliente não encontrado.");
  if (u.perfil === "cliente") {
    const conta = await prisma.usuario.findUnique({where:{id:u.id},select:{leadId:true}});
    if (conta?.leadId !== leadId) throw new Error("Acesso não autorizado.");
  } else {
    await exigirModuloAcao(tipo === "crm" ? "leads" : "financiamentos",{somenteEquipe:true});
    if (tipo === "crm") autorizarLeadDoAtor(await obterAtorCrm(),lead);
    else await financiamentoDoAtor(id);
  }
  return {u,lead};
}

export async function garantirDocumentosCliente(leadId: string) {
  await prisma.documentoCliente.createMany({data:DOCUMENTOS_CLIENTE.map(d=>({leadId,tipo:d.chave})),skipDuplicates:true});
}

export async function obterItemDocumento(tipo: TipoChecklist, itemId: string) {
  if (tipo === "crm") {
    const item = await prisma.documentoCliente.findUnique({where:{id:itemId}});
    if (!item) throw new Error("Documento não encontrado.");
    const {u,lead} = await autorizarClienteDocumentos(tipo,item.leadId);
    if (u.perfil === "cliente" && !item.visivelCliente) throw new Error("Documento não disponível.");
    const nome = DOCUMENTOS_CLIENTE.find(d=>d.chave===item.tipo)?.nome ?? item.tipo;
    return {item,u,lead,nome,financiamentoId:null};
  }
  const item = await prisma.checklistItem.findUnique({where:{id:itemId}});
  if (!item) throw new Error("Documento não encontrado.");
  const {u,lead} = await autorizarClienteDocumentos(tipo,item.financiamentoId);
  if (u.perfil === "cliente" && !item.visivelCliente) throw new Error("Documento não disponível.");
  return {item,u,lead,nome:item.item,financiamentoId:item.financiamentoId};
}

function escapar(v:string) { return v.replace(/[&<>"']/g,c=>({"&":"&amp;","<":"&lt;",">":"&gt;",'"':"&quot;","'":"&#39;"}[c]!)); }
export async function solicitarItemDocumento(tipo: TipoChecklist, itemId: string) {
  const {item,u,lead,nome} = await obterItemDocumento(tipo,itemId);
  if(u.perfil === "cliente") throw new Error("Somente a equipe solicita documentos.");
  if(!item.visivelCliente) throw new Error("Marque Visível ao cliente antes de solicitar.");
  const nova = !item.solicitadoEm || (!!item.enviadoEm && item.enviadoEm > item.solicitadoEm);
  const agora = new Date();
  if(nova) {
    const data = {solicitadoEm:agora,emailSolicitadoEm:null};
    const alterou = tipo === "crm"
      ? await prisma.documentoCliente.updateMany({where:{id:itemId,solicitadoEm:item.solicitadoEm},data})
      : await prisma.checklistItem.updateMany({where:{id:itemId,solicitadoEm:item.solicitadoEm},data});
    if (!alterou.count) throw new Error("Solicitação atualizada por outra pessoa. Atualize a página.");
    const conta = await prisma.usuario.findUnique({where:{leadId:lead.id},select:{id:true}});
    if(conta) await prisma.notificacao.create({data:{usuarioId:conta.id,tipo:"documento_solicitado",titulo:"Documento solicitado",mensagem:`A equipe solicitou: ${nome}`,link:tipo==="crm"?"/portal/documentos":"/portal/financiamento"}});
  }
  if(!nova && item.emailSolicitadoEm) return {ok:true,emailEnviado:true,jaSolicitado:true};
  const origem = process.env.AUTH_URL || process.env.NEXTAUTH_URL || "https://www.gruposantafee.com.br";
  const link = `${origem.replace(/\/$/,"")}${tipo === "crm" ? "/portal/documentos" : "/portal/financiamento"}`;
  const emailEnviado = !!lead.email && await sendEmail({to:lead.email,subject:`Documento solicitado: ${nome}`,html:`<p>Olá, ${escapar(lead.nome)}.</p><p>Envie o documento <strong>${escapar(nome)}</strong> pelo seu acesso.</p><p><a href="${escapar(link)}">Abrir meu acesso</a></p>`});
  if(emailEnviado) {
    if(tipo === "crm") await prisma.documentoCliente.update({where:{id:itemId},data:{emailSolicitadoEm:new Date()}});
    else await prisma.checklistItem.update({where:{id:itemId},data:{emailSolicitadoEm:new Date()}});
  }
  return {ok:true,emailEnviado,jaSolicitado:!nova,aviso:emailEnviado?null:lead.email?"Solicitação registrada. O email falhou; clique Solicitar para tentar novamente.":"Solicitação registrada. Cadastre o email do cliente no CRM para enviar o aviso."};
}
