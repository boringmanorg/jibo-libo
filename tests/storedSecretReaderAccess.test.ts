import { readFileSync } from 'node:fs';
import { describe, expect, it } from 'vitest';

describe('stored-secret reader entry permissions', () => {
  const sql = readFileSync('drizzle/migrations/0029_restrict_stored_secret_readers.sql', 'utf8');

  for (const reader of ['get_app_secret', 'get_app_secret_secure']) {
    it(`${reader} blocks public and anonymous entry while preserving checked admin and backend access`, () => {
      expect(sql).toContain(`REVOKE EXECUTE ON FUNCTION public.${reader}(text) FROM PUBLIC, anon;`);
      expect(sql).toContain(`GRANT EXECUTE ON FUNCTION public.${reader}(text) TO authenticated, service_role;`);
      expect(sql).not.toMatch(/CREATE\s+OR\s+REPLACE\s+FUNCTION/i);
    });
  }
});