import { describe, expect, it, beforeEach } from "vitest";
import { readFileSync } from "node:fs";
import {
  isValidSessionId,
  signSessionToken,
  verifySessionToken,
} from "../supabase/functions/_shared/sessionToken";

const SECRET = "test-secret-not-real";

describe("analytics session token", () => {
  it("verifies only the token issued for that session id", async () => {
    const t = await signSessionToken(SECRET, "s_abcdef123456");
    expect(t).toMatch(/^[0-9a-f]{64}$/);
    expect(await verifySessionToken(SECRET, "s_abcdef123456", t)).toBe(true);
    expect(await verifySessionToken(SECRET, "s_other_session", t)).toBe(false);
    expect(
      await verifySessionToken("another-secret", "s_abcdef123456", t),
    ).toBe(false);
  });
  it("rejects missing, malformed and forged tokens", async () => {
    for (const bad of [
      undefined,
      null,
      "",
      "x",
      42,
      "0".repeat(64),
      "G".repeat(64),
    ]) {
      expect(await verifySessionToken(SECRET, "s_abcdef123456", bad)).toBe(
        false,
      );
    }
    expect(
      await verifySessionToken(
        "",
        "s_abcdef123456",
        await signSessionToken(SECRET, "s_abcdef123456"),
      ),
    ).toBe(false);
  });
  it("accepts only plain session ids", () => {
    expect(isValidSessionId("s_" + "a".repeat(32))).toBe(true);
    for (const bad of [
      "",
      "short",
      "has space here",
      "x'; drop",
      "a".repeat(129),
      7,
      null,
    ])
      expect(isValidSessionId(bad)).toBe(false);
  });
});

describe("track-analytics realtime handler", () => {
  const src = readFileSync(
    "supabase/functions/track-analytics/index.ts",
    "utf8",
  );
  const block = src.slice(
    src.indexOf("case 'realtime':"),
    src.indexOf("cleanup_stale_realtime_visitors"),
  );

  it("overwrites a row only after the session token verifies", () => {
    expect(block).toMatch(/verifySessionToken\(/);
    const overwrite = block.indexOf(
      "upsert(row, { onConflict: 'session_id' })",
    );
    expect(overwrite).toBeGreaterThan(block.indexOf("verifySessionToken("));
    expect(overwrite).toBeLessThan(block.indexOf("} else {"));
  });
  it("without a token it can only insert a new row", () => {
    const elseBranch = block.slice(block.indexOf("} else {"));
    expect(elseBranch).toMatch(/ignoreDuplicates: true/);
    expect(elseBranch).not.toMatch(/\.update\(/);
  });
  it("no other unguarded analytics_realtime writes remain", () => {
    const re = /from\('analytics_realtime'\)\s*\.(upsert|update|insert)/g;
    // exactly the two in the realtime handler: owner refresh and insert-only
    expect((src.match(re) ?? []).length).toBe(2);
    expect((block.match(re) ?? []).length).toBe(2);
  });
});

describe("client token storage", () => {
  beforeEach(() => {
    const store = new Map<string, string>();
    (globalThis as { sessionStorage?: unknown }).sessionStorage = {
      getItem: (k: string) => store.get(k) ?? null,
      setItem: (k: string, v: string) => void store.set(k, v),
      removeItem: (k: string) => void store.delete(k),
    };
  });
  it("remembers the token per session and adds it to realtime pings only", async () => {
    const m = await import("../src/lib/analyticsSessionToken");
    const tok = "a".repeat(64);
    m.rememberSessionToken("s_one_session", {
      success: true,
      sessionToken: tok,
    });
    expect(
      m.withSessionToken("realtime", { sessionId: "s_one_session" }),
    ).toEqual({ sessionId: "s_one_session", sessionToken: tok });
    expect(
      m.withSessionToken("realtime", { sessionId: "s_new_session" }),
    ).toEqual({ sessionId: "s_new_session" });
    expect(
      m.withSessionToken("pageview", { sessionId: "s_one_session" }),
    ).toEqual({ sessionId: "s_one_session" });
    m.rememberSessionToken("s_one_session", { sessionToken: "not-hex" });
    expect(m.readSessionToken("s_one_session")).toBe(tok);
  });
  it("new session ids are random, not time-based", async () => {
    const { newAnalyticsSessionId } =
      await import("../src/lib/analyticsSessionToken");
    const a = newAnalyticsSessionId();
    expect(a).toMatch(/^s_[0-9a-f]{32}$/);
    expect(isValidSessionId(a)).toBe(true);
    expect(newAnalyticsSessionId()).not.toBe(a);
  });
  it("consent withdrawal clears the token", () => {
    expect(readFileSync("src/lib/consent.ts", "utf8")).toMatch(
      /'xtsy_session_token'/,
    );
  });
});
