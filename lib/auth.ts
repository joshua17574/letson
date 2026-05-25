// app/api/auth/[...nextauth]/route.ts
import NextAuth, { type NextAuthOptions } from "next-auth";
import CredentialsProvider from "next-auth/providers/credentials";
import bcrypt from "bcryptjs";

import dbConnect from "@/lib/mongodb";
import UserModel from "@/models/User";
import RoleModel from "@/models/Role";

export const authOptions: NextAuthOptions = {
  session: {
    strategy: "jwt",
  },

  pages: {
    signIn: "/login",
  },

  providers: [
    CredentialsProvider({
      name: "Credentials",

      credentials: {
        identifier: {
          label: "Email or Username",
          type: "text",
          placeholder: "cash or cash@email.com",
        },
        email: {
          label: "Email",
          type: "text",
        },
        username: {
          label: "Username",
          type: "text",
        },
        name: {
          label: "Name",
          type: "text",
        },
        password: {
          label: "Password",
          type: "password",
        },
      },

      async authorize(credentials) {
        await dbConnect();

        // Register Role model for populate("roleId")
        void RoleModel;

        const identifier = String(
          credentials?.identifier ||
            credentials?.email ||
            credentials?.username ||
            credentials?.name ||
            ""
        )
          .trim()
          .toLowerCase();

        const password = String(credentials?.password || "");

        if (!identifier || !password) {
          return null;
        }

        const user = await UserModel.findOne({
          isActive: true,
          $or: [
            {
              email: identifier,
            },
            {
              name: identifier.toUpperCase(),
            },
              { username: identifier },
          ],
        })
          .populate("roleId", "name permissions")
          .lean();

        if (!user) {
          return null;
        }

        const passwordHash = String(user.password || "");

        const isPasswordValid = await bcrypt.compare(password, passwordHash);

        if (!isPasswordValid) {
          return null;
        }

        const role: any = user.roleId;

        return {
          id: user._id.toString(),
          name: user.name,
          email: user.email,
          role: user.role || "USER",

          roleId: role?._id?.toString?.() || "",
          roleName: role?.name || "",
          permissions: role?.permissions || [],
        } as any;
      },
    }),
  ],

  callbacks: {
    async jwt({ token, user }) {
      if (user) {
        const authUser = user as any;

        token.id = authUser.id;
        token.role = authUser.role || "USER";
        token.roleId = authUser.roleId || "";
        token.roleName = authUser.roleName || "";
        token.permissions = authUser.permissions || [];
      }

      return token;
    },

    async session({ session, token }) {
      if (session.user) {
        (session.user as any).id = token.id;
        (session.user as any).role = token.role;
        (session.user as any).roleId = token.roleId;
        (session.user as any).roleName = token.roleName;
        (session.user as any).permissions = token.permissions || [];
      }

      return session;
    },
  },
};

const handler = NextAuth(authOptions);

export { handler as GET, handler as POST };