/**
 * Inert stand-in for the backend client. The site has no database dependency, so every
 * query, mutation or function call resolves immediately with no data and no network request.
 *
 * Shape: awaiting any chain yields { data: null, error: null, count: null }.
 *
 * Property access returns the proxy itself, so deep chains that are read before being
 * called -- `client.auth.getSession()`, `client.storage.from(b).getPublicUrl(p)`,
 * `client.functions.invoke(fn)` -- resolve instead of throwing "is not a function".
 * An earlier version returned a plain function from `get`, which made those three
 * patterns crash as soon as callers stopped importing the real client.
 *
 * IMPORTANT: `error` is always null. That is correct for fire-and-forget telemetry,
 * where a dropped write is invisible and harmless. It is WRONG for any write a guest
 * is told succeeded, because `if (error)` never fires and the caller reports success
 * having saved nothing. Such paths must hand off to WhatsApp instead of using this.
 *
 * Equally, `data` is always null, so code that destructures through it
 * (`const { data: { user } } = await client.auth.getUser()`) still throws. Auth is not
 * used on this site; do not reintroduce it against this stand-in.
 */
type Result = { data: null; error: null; count: null };
const result: Result = { data: null, error: null, count: null };

function chain(): any {
  const target = () => undefined;
  const proxy: any = new Proxy(target, {
    get(_t, prop) {
      if (prop === 'then') {
        return (resolve: (v: Result) => unknown) => Promise.resolve(result).then(resolve);
      }
      if (prop === 'catch' || prop === 'finally') {
        return () => proxy;
      }
      // Any other property -- including Symbol.toPrimitive probes -- yields the proxy,
      // so both `a.b.c()` and `a.b().c()` are safe.
      return proxy;
    },
    apply: () => proxy,
  });
  return proxy;
}

export const offlineBackend: any = chain();
export async function getSupabase(): Promise<any> {
  return offlineBackend;
}
export const BACKEND_TELEMETRY_ENABLED = false;
