import NextAuth from "next-auth";
import Credentials from "next-auth/providers/credentials";
import bcrypt from "bcryptjs";
import { prisma } from "@/lib/db";
import { sessaoAindaValida } from "@/lib/auth/admin-guard";

export type UserRole = "admin" | "corretor" | "colaborador" | "cliente";

interface AppUser {
  id: string;
  name: string;
  email: string;
  role: UserRole;
  creci?: string;
  corretorId?: string;
  leadId?: string;
  sessionVersion: number;
}

export const { handlers, signIn, signOut, auth } = NextAuth({
  providers: [
    Credentials({
      credentials: {
        email: { label: "E-mail", type: "email" },
        password: { label: "Senha", type: "password" },
      },
      async authorize(credentials) {
        if (!credentials?.email || !credentials?.password) return null;

        const usuario = await prisma.usuario.findUnique({
          where: { email: credentials.email as string },
        });

        if (!usuario || !usuario.ativo) return null;

        const senhaOk = await bcrypt.compare(
          credentials.password as string,
          usuario.senha
        );
        if (!senhaOk) return null;

        let corretorId: string | undefined;
        if (usuario.papel === "corretor") {
          // Vinculo por FK (usuarioId), nao por match de e-mail - o e-mail podia
          // divergir entre Usuario e Corretor (editados separadamente) e quebrar
          // silenciosamente a resolucao do corretor logado.
          const corretor = await prisma.corretor.findUnique({
            where: { usuarioId: usuario.id },
            select: { id: true },
          });
          corretorId = corretor?.id;
        }

        let leadId: string | undefined;
        if (usuario.papel === "cliente") {
          const lead = await prisma.lead.findFirst({
            where: { email: usuario.email },
            select: { id: true },
          });
          leadId = lead?.id;
        }

        return {
          id: usuario.id,
          name: usuario.nome,
          email: usuario.email,
          role: usuario.papel as UserRole,
          creci: usuario.creci ?? undefined,
          corretorId,
          leadId,
          sessionVersion: usuario.sessionVersion,
        };
      },
    }),
  ],
  callbacks: {
    // Estrategia JWT nao tem estado no servidor por padrao: um token emitido no
    // login continua valido ate expirar (30 dias por padrao do NextAuth), mesmo
    // que a senha do usuario seja redefinida ou a conta seja desativada depois.
    // `sessionVersion` fecha esse gap: incrementado em redefinirSenha (usuarios.ts),
    // e revalidado aqui a cada requisicao (fora do login) contra o banco. Retornar
    // `null` e o mecanismo suportado pelo NextAuth para invalidar o token - o
    // proximo `auth()` passa a ver a sessao como inexistente (equivalente a logout).
    async jwt({ token, user }) {
      if (user) {
        token.role = (user as AppUser).role;
        token.creci = (user as AppUser).creci;
        token.corretorId = (user as AppUser).corretorId;
        token.leadId = (user as AppUser).leadId;
        token.sessionVersion = (user as AppUser).sessionVersion;
        token.name = user.name;
        token.email = user.email;
        return token;
      }

      if (!token.sub) return token;
      const usuario = await prisma.usuario.findUnique({
        where: { id: token.sub },
        select: { ativo: true, sessionVersion: true },
      });
      if (!sessaoAindaValida(usuario, token.sessionVersion as number | undefined)) {
        return null;
      }
      return token;
    },
    session({ session, token }) {
      if (session.user) {
        session.user.id = token.sub as string;
        (session.user as unknown as AppUser & { id: string }).role = token.role as UserRole;
        (session.user as unknown as AppUser).creci = token.creci as string | undefined;
        (session.user as unknown as AppUser).corretorId = token.corretorId as string | undefined;
        (session.user as unknown as AppUser).leadId = token.leadId as string | undefined;
        session.user.name = token.name as string;
        session.user.email = token.email as string;
      }
      return session;
    },
  },
  pages: {
    signIn: "/login",
  },
  session: { strategy: "jwt" },
});
