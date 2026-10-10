import { betterAuth } from "better-auth";
import { APIError } from "better-auth/api";
import { eq } from "drizzle-orm";
import { drizzleAdapter } from "better-auth/adapters/drizzle";
import { anonymous, genericOAuth } from "better-auth/plugins";
import { env } from "../config/env.js";
import { db } from "../db/index.js";
import * as schema from "../db/schema/index.js";
import { generateUsername } from "../modules/users/usernames.js";
import { track } from "./analytics.js";
import { withoutIp } from "./session-ip.js";

const socialProviders = {
  ...(env.GOOGLE_CLIENT_ID &&
    env.GOOGLE_CLIENT_SECRET && {
      google: { clientId: env.GOOGLE_CLIENT_ID, clientSecret: env.GOOGLE_CLIENT_SECRET },
    }),
  ...(env.GITHUB_CLIENT_ID &&
    env.GITHUB_CLIENT_SECRET && {
      github: { clientId: env.GITHUB_CLIENT_ID, clientSecret: env.GITHUB_CLIENT_SECRET },
    }),
};

// "Sign in with ChatGPT" is standard OpenID Connect, so it goes through generic OAuth. Settings follow
// https://developers.openai.com/siwc/website: PKCE always; a confidential client authenticates with HTTP
// Basic, a public client (client ID only, no secret) with none.
const chatgptProvider = env.CHATGPT_CLIENT_ID
  ? [
      {
        providerId: "chatgpt",
        clientId: env.CHATGPT_CLIENT_ID,
        ...(env.CHATGPT_CLIENT_SECRET && { clientSecret: env.CHATGPT_CLIENT_SECRET }),
        tokenEndpointAuth: env.CHATGPT_CLIENT_SECRET
          ? ({ method: "client_secret_basic" } as const)
          : ({ method: "none" } as const),
        discoveryUrl: env.CHATGPT_DISCOVERY_URL,
        scopes: ["openid", "profile", "email"],
        pkce: true,
      },
    ]
  : [];

export const guestLoginEnabled = env.ENABLE_GUEST_LOGIN ?? env.NODE_ENV !== "production";

export const auth = betterAuth({
  appName: "Shortlist",
  baseURL: env.BETTER_AUTH_URL,
  secret: env.BETTER_AUTH_SECRET,
  trustedOrigins: [env.FRONTEND_URL],
  database: drizzleAdapter(db, { provider: "pg", schema, usePlural: true }),
  socialProviders,
  user: {
    additionalFields: {
      username: { type: "string", required: false, input: false },
      plan: { type: "string", required: false, input: false, defaultValue: "free" },
    },
  },
  databaseHooks: {
    user: {
      create: {
        before: async (user) => ({
          data: { ...user, username: await generateUsername(user.name, user.email) },
        }),
        after: async (user) => {
          track(user.id, "user_signed_up", { guest: "isAnonymous" in user && user.isAnonymous === true });
        },
      },
    },
    session: {
      create: {
        before: async (session) => {
          const [user] = await db
            .select({ suspendedAt: schema.users.suspendedAt })
            .from(schema.users)
            .where(eq(schema.users.id, session.userId));
          if (user?.suspendedAt) throw new APIError("FORBIDDEN", { message: "This account is suspended" });
          return { data: withoutIp(session) };
        },
      },
    },
  },
  plugins: [
    ...(guestLoginEnabled ? [anonymous({ generateName: () => "Guest", emailDomainName: "guest.invalid" })] : []),
    genericOAuth({ config: chatgptProvider }),
  ],
  advanced: {
    database: { generateId: "uuid" },
    ...(env.COOKIE_DOMAIN && {
      crossSubDomainCookies: { enabled: true, domain: env.COOKIE_DOMAIN },
    }),
  },
});

export type AuthUser = typeof auth.$Infer.Session.user;
export type AuthSession = typeof auth.$Infer.Session.session;
