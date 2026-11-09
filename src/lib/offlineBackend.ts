/**
 * Stand-in for the backend client used by background telemetry. The site no longer depends on the
 * database, so every query or function call resolves immediately with no data and no network request.
 */
type Result = { data: null; error: null; count: null };
const result: Result = { data: null, error: null, count: null };

function chain(): any {
  const fn = () => proxy;
  const proxy: any = new Proxy(fn, {
    get(_t, prop) {
      if (prop === 'then') return (resolve: (v: Result) => unknown) => Promise.resolve(result).then(resolve);
      return () => proxy;
    },
    apply: () => proxy,
  });
  return proxy;
}

export const offlineBackend: any = chain();
export async function getSupabase(): Promise<any> { return offlineBackend; }
export const BACKEND_TELEMETRY_ENABLED = false;
