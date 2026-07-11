"use client";

import { Amplify } from "aws-amplify";
import {
  signIn as amplifySignIn,
  signOut as amplifySignOut,
  confirmSignIn as amplifyConfirmSignIn,
  fetchAuthSession,
  getCurrentUser,
} from "aws-amplify/auth";

// Local dev bypass: when NEXT_PUBLIC_DEV_AUTH=1 (set only in .env.development),
// skip Cognito entirely and hand out the "local-dev" token the in-memory backend
// accepts, so /login, /admin, and the editor work without AWS.
const DEV_AUTH = process.env.NEXT_PUBLIC_DEV_AUTH === "1";

let configured = false;

export function configureAuth() {
  if (DEV_AUTH) return;
  if (configured) return;
  Amplify.configure({
    Auth: {
      Cognito: {
        userPoolId: process.env.NEXT_PUBLIC_USER_POOL_ID ?? "",
        userPoolClientId: process.env.NEXT_PUBLIC_USER_POOL_CLIENT_ID ?? "",
      },
    },
  });
  configured = true;
}

export async function getIdToken(): Promise<string | null> {
  if (DEV_AUTH) return "local-dev";
  configureAuth();
  try {
    const session = await fetchAuthSession();
    return session.tokens?.idToken?.toString() ?? null;
  } catch {
    return null;
  }
}

export async function signIn(email: string, password: string) {
  if (DEV_AUTH) return { isSignedIn: true, nextStep: { signInStep: "DONE" } } as Awaited<ReturnType<typeof amplifySignIn>>;
  configureAuth();
  return amplifySignIn({ username: email, password });
}

// Completes the FORCE_CHANGE_PASSWORD challenge on first admin login.
export async function completeNewPassword(newPassword: string) {
  configureAuth();
  return amplifyConfirmSignIn({ challengeResponse: newPassword });
}

export async function signOut() {
  if (DEV_AUTH) return;
  configureAuth();
  return amplifySignOut();
}

export async function currentUser(): Promise<{ email: string } | null> {
  if (DEV_AUTH) return { email: "admin@local" };
  configureAuth();
  try {
    const u = await getCurrentUser();
    return { email: u.signInDetails?.loginId ?? u.username };
  } catch {
    return null;
  }
}
