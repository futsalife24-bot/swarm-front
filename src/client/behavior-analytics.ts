const events = [
  "visit",
  "sortie_start",
  "first_victory",
  "sortie_again",
] as const;
type Event = (typeof events)[number];
type Action = "visit" | "sortie" | "victory";
type Pending = {
  admin: boolean;
  attempts: number;
  done: boolean;
  retryAt: number;
};
type Daily = {
  day: string;
  token: string;
  won: boolean;
  pending: Partial<Record<Event, Pending>>;
};
export const behaviorKey = "swarm-front-behavior-day-v1";
const dayAt = (now: number) =>
  new Date(now + 9 * 3600000).toISOString().slice(0, 10);
type Dependencies = {
  storage: () => Pick<Storage, "getItem" | "setItem">;
  lock: <T>(work: () => T) => Promise<T>;
  now: () => number;
  token: () => string;
  send: (body: string) => Promise<{ ok: boolean; status: number }>;
};

// No game/save data enters this class. All failures resolve, never reject into gameplay.
export function createBehaviorAnalytics(d: Dependencies) {
  function read(): Daily {
    const storage = d.storage(),
      today = dayAt(d.now());
    const raw = storage.getItem(behaviorKey);
    if (!raw) return { day: today, token: d.token(), won: false, pending: {} };
    const s = JSON.parse(raw) as Daily;
    if (s.day !== today)
      return { day: today, token: d.token(), won: false, pending: {} };
    if (
      !/^[a-f0-9]{32}$/.test(s.token) ||
      typeof s.won !== "boolean" ||
      !s.pending ||
      Object.keys(s).sort().join() !== "day,pending,token,won" ||
      Object.entries(s.pending).some(
        ([key, p]) =>
          !events.includes(key as Event) ||
          !p ||
          Object.keys(p).sort().join() !== "admin,attempts,done,retryAt" ||
          !Number.isFinite(p.retryAt) ||
          typeof p.admin !== "boolean" ||
          typeof p.done !== "boolean" ||
          !Number.isInteger(p.attempts) ||
          p.attempts < 0 ||
          p.attempts > 2,
      )
    )
      throw Error("invalid daily state");
    return s;
  }
  const write = (s: Daily) =>
    d.storage().setItem(behaviorKey, JSON.stringify(s));
  async function record(action: Action) {
    try {
      const day = dayAt(d.now());
      await d.lock(() => {
        if (dayAt(d.now()) !== day) return;
        const s = read();
        const admin = d.storage().getItem("app-analytics-admin") === "1";
        const enqueue = (e: Event) => {
          s.pending[e] ??= { admin, attempts: 0, done: false, retryAt: 0 };
        };
        if (action === "visit") enqueue("visit");
        if (action === "victory") {
          s.won = true;
          enqueue("first_victory");
        }
        if (action === "sortie") {
          enqueue("sortie_start");
          if (s.won) enqueue("sortie_again");
        }
        write(s);
      });
      for (const event of events)
        for (let i = 0; i < 2; i++) {
          const payload = await d.lock(() => {
            if (dayAt(d.now()) !== day) return;
            const s = read(),
              p = s.pending[event];
            if (!p || p.done || p.attempts >= 2 || p.retryAt > d.now()) return;
            p.attempts++;
            p.retryAt = d.now() + 2000;
            write(s); // short cross-tab lease, bounded timeout below
            return { version: 1, event, day, token: s.token, admin: p.admin };
          });
          if (!payload) break;
          let done = false;
          try {
            const r = await d.send(JSON.stringify(payload));
            done =
              r.ok || (r.status >= 400 && r.status < 500 && r.status !== 429);
          } catch {
            /* bounded retry; gameplay does not wait */
          }
          await d.lock(() => {
            if (dayAt(d.now()) !== day) return;
            const s = read();
            if (s.token === payload.token && s.pending[event]) {
              s.pending[event]!.done ||= done;
              s.pending[event]!.retryAt = 0;
              write(s);
            }
          });
        }
    } catch {
      /* storage/lock/JSON unavailable: opt out, no fallback identity */
    }
  }
  return { record };
}

// Production is deliberately inert. Activation requires a separately reviewed change.
function localEndpoint() {
  if (!import.meta.env.DEV || !import.meta.env.VITE_BEHAVIOR_ENDPOINT)
    return null;
  try {
    const u = new URL(import.meta.env.VITE_BEHAVIOR_ENDPOINT);
    return u.protocol === "http:" &&
      u.hostname === "127.0.0.1" &&
      u.pathname === "/api/behavior/collect/swarm-front" &&
      !u.search &&
      !u.hash &&
      !u.username &&
      !u.password
      ? u.href
      : null;
  } catch {
    return null;
  }
}
const endpoint = import.meta.env.DEV ? localEndpoint() : null;
const client = endpoint
  ? createBehaviorAnalytics({
      storage: () => localStorage,
      lock: (work) =>
        navigator.locks.request(
          behaviorKey,
          { signal: AbortSignal.timeout(1500) },
          work,
        ),
      now: Date.now,
      token: () =>
        Array.from(crypto.getRandomValues(new Uint8Array(16)), (v) =>
          v.toString(16).padStart(2, "0"),
        ).join(""),
      send: (body) =>
        fetch(endpoint, {
          method: "POST",
          credentials: "omit",
          referrerPolicy: "no-referrer",
          headers: { "Content-Type": "application/json" },
          body,
          signal: AbortSignal.timeout(1500),
        }),
    })
  : null;
export function recordBehavior(action: Action) {
  void client?.record(action);
}
