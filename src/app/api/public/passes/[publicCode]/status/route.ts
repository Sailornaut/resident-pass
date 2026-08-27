/**
 * GET /api/public/passes/{publicCode}/status
 *
 * Unauthenticated verification endpoint. Returns only
 * enforcement-relevant data — never resident identity.
 * Rate-limited per IP to resist code enumeration.
 */

import { NextRequest, NextResponse } from "next/server";
import { verifyByPublicCode } from "@/server/services/pass-service";

// --- Simple in-memory rate limiter (per instance) ---
// For production behind multiple instances, replace with a shared store
// (e.g. Upstash Redis) — noted in the pilot-hardening checklist.
const WINDOW_MS = 60_000;
const MAX_REQUESTS = 30;
const hits = new Map<string, { count: number; windowStart: number }>();

function rateLimited(ip: string): boolean {
  const now = Date.now();
  const entry = hits.get(ip);
  if (!entry || now - entry.windowStart > WINDOW_MS) {
    hits.set(ip, { count: 1, windowStart: now });
    return false;
  }
  entry.count += 1;
  return entry.count > MAX_REQUESTS;
}

export async function GET(
  request: NextRequest,
  { params }: { params: Promise<{ publicCode: string }> }
) {
  const ip =
    request.headers.get("x-forwarded-for")?.split(",")[0]?.trim() ?? "unknown";

  if (rateLimited(ip)) {
    return NextResponse.json(
      { error: "Too many requests. Please wait a moment." },
      { status: 429 }
    );
  }

  const { publicCode } = await params;
  const result = await verifyByPublicCode(publicCode);

  return NextResponse.json(result, {
    headers: { "Cache-Control": "no-store" },
  });
}
