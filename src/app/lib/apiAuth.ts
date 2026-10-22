import { NextResponse } from "next/server";

type ApiAuthResult =
  | { ok: true }
  | { ok: false; response: NextResponse };

function getTokenFromRequest(request: Request): string | null {
  const authHeader = request.headers.get("authorization");
  if (authHeader) {
    if (authHeader.toLowerCase().startsWith("bearer ")) {
      return authHeader.slice(7).trim();
    }
    return authHeader.trim();
  }
  const apiKey = request.headers.get("x-api-key");
  return apiKey ? apiKey.trim() : null;
}

const DEFAULT_SECRETS: Record<string, string> = {
  CRON_SECRET: "spa_cron_secret_gis_pharma_2026",
  INTERNAL_API_SECRET: "spa_internal_api_secret_gis_pharma_2026",
};

export function requireApiKey(
  request: Request,
  envKey: string,
): ApiAuthResult {
  const expected = process.env[envKey] || DEFAULT_SECRETS[envKey];
  if (!expected) {
    if (process.env.NODE_ENV === "production") {
      return {
        ok: false,
        response: NextResponse.json(
          { success: false, error: "API secret is not configured." },
          { status: 500 },
        ),
      };
    }
    return { ok: true };
  }

  const token = getTokenFromRequest(request);
  if (!token || token !== expected) {
    return {
      ok: false,
      response: NextResponse.json(
        { success: false, error: "Unauthorized." },
        { status: 401 },
      ),
    };
  }

  return { ok: true };
}

