const DEFAULT_BACKEND_ORIGIN = "https://swarm-front.melosalife-24.workers.dev";
type Env = { BACKEND_ORIGIN?: string };

const allowedPath = (pathname: string) =>
  pathname === "/admin" ||
  pathname.startsWith("/admin/") ||
  pathname.startsWith("/api/developer/") ||
  pathname === "/api/health" ||
  pathname === "/icon-swarm-v3-192.png" ||
  pathname === "/icon-swarm-v3-512.png";

export default {
  async fetch(req: Request, env: Env) {
    const incoming = new URL(req.url);
    if (!allowedPath(incoming.pathname))
      return new Response("Not found", { status: 404 });

    const backendOrigin = (env.BACKEND_ORIGIN ?? DEFAULT_BACKEND_ORIGIN).replace(
      /\/$/,
      "",
    );
    const requestOrigin = incoming.origin;
    const suppliedOrigin = req.headers.get("Origin");
    if (suppliedOrigin && suppliedOrigin !== requestOrigin)
      return new Response("Forbidden", { status: 403 });
    const target = new URL(backendOrigin + incoming.pathname + incoming.search);
    const headers = new Headers(req.headers);
    headers.delete("Host");
    headers.delete("Content-Length");
    headers.delete("Referer");
    if (headers.has("Origin")) headers.set("Origin", backendOrigin);
    const init: RequestInit = {
      method: req.method,
      headers,
      redirect: "manual",
    };
    if (req.method !== "GET" && req.method !== "HEAD") init.body = req.body;
    const response = await fetch(target, init);
    return new Response(response.body, response);
  },
};
