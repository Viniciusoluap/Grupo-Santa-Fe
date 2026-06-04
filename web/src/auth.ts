import NextAuth from "next-auth";
import Credentials from "next-auth/providers/credentials";

export type UserRole = "admin" | "corretor" | "cliente";

interface AppUser {
  id: string;
  name: string;
  email: string;
  role: UserRole;
  creci?: string;
}

const MOCK_USERS: (AppUser & { password: string })[] = [
  {
    id: "1",
    name: "Administrador",
    email: "admin@gruposantafe.com.br",
    password: "admin123",
    role: "admin",
  },
  {
    id: "2",
    name: "João Corretor",
    email: "corretor@gruposantafe.com.br",
    password: "corretor123",
    role: "corretor",
    creci: "CRECI-GO 0001",
  },
  {
    id: "3",
    name: "Maria Cliente",
    email: "cliente@email.com",
    password: "cliente123",
    role: "cliente",
  },
];

export const { handlers, signIn, signOut, auth } = NextAuth({
  providers: [
    Credentials({
      credentials: {
        email: { label: "E-mail", type: "email" },
        password: { label: "Senha", type: "password" },
      },
      authorize(credentials) {
        const user = MOCK_USERS.find(
          (u) =>
            u.email === credentials?.email &&
            u.password === credentials?.password
        );
        if (!user) return null;
        const { password: _pw, ...safeUser } = user;
        return safeUser;
      },
    }),
  ],
  callbacks: {
    jwt({ token, user }) {
      if (user) {
        token.role = (user as AppUser).role;
        token.creci = (user as AppUser).creci;
      }
      return token;
    },
    session({ session, token }) {
      if (session.user) {
        (session.user as unknown as AppUser & { id: string }).role = token.role as UserRole;
        (session.user as unknown as AppUser).creci = token.creci as string | undefined;
      }
      return session;
    },
  },
  pages: {
    signIn: "/login",
  },
  session: { strategy: "jwt" },
});
