import { describe, expect, it } from "vitest";
import { readFileSync, readdirSync, existsSync } from "node:fs";
import {
  deniedMessage,
  deniedReason,
  signInErrorMessage,
} from "../src/admin/signInMessages";

const ADMIN = "admin@xtsy.one";

describe("admin sign-in messages", () => {
  it("explains an unconfirmed email", () => {
    expect(
      signInErrorMessage({
        code: "email_not_confirmed",
        message: "Email not confirmed",
      }),
    ).toMatch(/not confirmed/);
    expect(signInErrorMessage({ message: "Email not confirmed" })).toMatch(
      /not confirmed/,
    );
  });
  it("explains wrong credentials without blaming only the password", () => {
    const m = signInErrorMessage({
      code: "invalid_credentials",
      message: "Invalid login credentials",
      status: 400,
    });
    expect(m).toMatch(/Email or password/);
    expect(m).toMatch(/does not exist/);
  });
  it("explains rate limits and unknown errors", () => {
    expect(signInErrorMessage({ status: 429, message: "x" })).toMatch(
      /Too many/,
    );
    expect(signInErrorMessage({ message: "boom" })).toBe(
      "Sign-in failed: boom",
    );
    expect(signInErrorMessage(null)).toBe("");
  });
  it("says why access was denied", () => {
    expect(
      deniedReason({ email: "x@y.com", email_confirmed_at: "now" }, ADMIN),
    ).toBe("wrong_email");
    expect(
      deniedReason(
        { email: "Admin@XTSY.one", email_confirmed_at: null },
        ADMIN,
      ),
    ).toBe("unconfirmed");
    expect(
      deniedReason({ email: ADMIN, email_confirmed_at: "2026-11-19" }, ADMIN),
    ).toBe("no_admin_role");
    expect(deniedMessage("no_admin_role", ADMIN)).toMatch(/required admin or front-desk staff role/);
  });
});

describe("migrations are where Lovable applies them", () => {
  const dir = "drizzle/migrations";
  const journal = JSON.parse(
    readFileSync(`${dir}/meta/_journal.json`, "utf8"),
  ) as { entries: { idx: number; tag: string; when: number }[] };

  it("every journal entry has its SQL file and snapshot, in order", () => {
    journal.entries.forEach((e, i) => {
      expect(e.idx).toBe(i);
      expect(existsSync(`${dir}/${e.tag}.sql`)).toBe(true);
      // A merge-renumbered file switched off in full has no snapshot of its own.
      const retired = readFileSync(`${dir}/${e.tag}.sql`, "utf8").split("\n").every((l) => !l.trim() || l.trim().startsWith("--"));
      if (!retired) expect(
        existsSync(
          `${dir}/meta/${String(e.idx).padStart(4, "0")}_snapshot.json`,
        ),
      ).toBe(true);
      if (i > 0) expect(e.when).toBeGreaterThan(journal.entries[i - 1].when);
    });
  });

  it("every SQL file is in the journal", () => {
    const tags = new Set(journal.entries.map((e) => e.tag));
    for (const f of readdirSync(dir).filter((f) => f.endsWith(".sql")))
      expect(tags.has(f.replace(/\.sql$/, ""))).toBe(true);
  });

  it("booking-engine tables and the admin role grant ship as a drizzle migration", () => {
    const sql = readFileSync(`${dir}/0014_booking_engine_tables.sql`, "utf8");
    expect(sql).toMatch(/create table if not exists public\.be_bookings/);
    expect(sql).toMatch(
      /insert into public\.user_roles[\s\S]*lower\(u\.email\) = 'admin@xtsy\.one'[\s\S]*email_confirmed_at is not null/,
    );
  });

  it("no new migrations are added to the unapplied supabase folder", () => {
    const legacy = "supabase/migrations";
    if (!existsSync(legacy)) return;
    const late = readdirSync(legacy).filter(
      (f) => f.endsWith(".sql") && f.slice(0, 8) >= "20261119",
    );
    expect(late).toEqual([]);
  });
});
