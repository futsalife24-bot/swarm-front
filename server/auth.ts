// No Origin-based authentication, development bypass, or embedded fallback key.
export async function creationAccess(
  configured: string | undefined,
  supplied: string | null,
) {
  if (!configured || configured.length < 32 || configured.length > 256)
    return 503;
  if (!supplied || supplied.length > 256) return 401;
  const digest = (s: string) =>
    crypto.subtle.digest("SHA-256", new TextEncoder().encode(s));
  const [a, b] = await Promise.all([digest(configured), digest(supplied)]);
  const aa = new Uint8Array(a),
    bb = new Uint8Array(b);
  let difference = 0;
  for (let n = 0; n < aa.length; n++) difference |= aa[n] ^ bb[n];
  return difference === 0 ? 200 : 401;
}
