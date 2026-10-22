import { supabaseAdmin } from "@/app/lib/supabaseAdmin";
import { db } from "@/app/lib/supabaseDb";

export type AuthContext = {
  adminToken?: string;
  lineAccessToken?: string;
};

type AuthResult<T> =
  | { ok: true; value: T; devBypass?: boolean }
  | { ok: false; error: string };

const DEV_BYPASS =
  process.env.NODE_ENV !== "production" ||
  process.env.ALLOW_DEV_AUTH_BYPASS === "true";

export async function requireAdminAuth(
  auth?: AuthContext,
): Promise<AuthResult<{ uid: string }>> {
  const token = auth?.adminToken;
  if (!token) {
    if (DEV_BYPASS) {
      return { ok: true, value: { uid: "dev" }, devBypass: true };
    }
    return { ok: false, error: "Missing admin token." };
  }

  try {
    const { data: { user }, error } = await supabaseAdmin.auth.getUser(token);
    if (error || !user) {
      if (DEV_BYPASS) {
        return { ok: true, value: { uid: "dev" }, devBypass: true };
      }
      return { ok: false, error: "Invalid admin token." };
    }

    const adminDoc = await db.collection("admins").doc(user.id).get();
    if (!adminDoc.exists) {
      return { ok: false, error: "Admin access denied." };
    }
    return { ok: true, value: { uid: user.id } };
  } catch (error) {
    if (DEV_BYPASS) {
      return { ok: true, value: { uid: "dev" }, devBypass: true };
    }
    return { ok: false, error: "Invalid admin token." };
  }
}

export async function requireLineAuth(
  auth?: AuthContext,
): Promise<AuthResult<{ userId: string | null }>> {
  const token = auth?.lineAccessToken;
  if (!token) {
    if (DEV_BYPASS) {
      return { ok: true, value: { userId: null }, devBypass: true };
    }
    return { ok: false, error: "Missing LINE access token." };
  }

  try {
    const response = await fetch("https://api.line.me/v2/profile", {
      headers: {
        Authorization: `Bearer ${token}`,
      },
    });

    if (!response.ok) {
      return { ok: false, error: "Invalid LINE access token." };
    }

    const profile = (await response.json()) as { userId?: string };
    if (!profile.userId) {
      return { ok: false, error: "LINE profile missing userId." };
    }

    return { ok: true, value: { userId: profile.userId } };
  } catch (error) {
    return { ok: false, error: "LINE token verification failed." };
  }
}
