"use client";

import { Amplify } from "aws-amplify";
import {
  signIn as amplifySignIn,
  signOut as amplifySignOut,
  confirmSignIn as amplifyConfirmSignIn,
  fetchAuthSession,
  getCurrentUser,
} from "aws-amplify/auth";

let configured = false;

export function configureAuth() {
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
  configureAuth();
  try {
    const session = await fetchAuthSession();
    return session.tokens?.idToken?.toString() ?? null;
  } catch {
    return null;
  }
}

export async function signIn(email: string, password: string) {
  configureAuth();
  return amplifySignIn({ username: email, password });
}

// Completes the FORCE_CHANGE_PASSWORD challenge on first admin login.
export async function completeNewPassword(newPassword: string) {
  configureAuth();
  return amplifyConfirmSignIn({ challengeResponse: newPassword });
}

export async function signOut() {
  configureAuth();
  return amplifySignOut();
}

export async function currentUser(): Promise<{ email: string } | null> {
  configureAuth();
  try {
    const u = await getCurrentUser();
    return { email: u.signInDetails?.loginId ?? u.username };
  } catch {
    return null;
  }
}
