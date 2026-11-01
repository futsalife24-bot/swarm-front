// Existing Wrangler OAuth, read-only Cloudflare metadata/analytics. Never print credentials.
import { readFileSync, writeFileSync, mkdirSync } from "node:fs";
import { join } from "node:path";
import { homedir } from "node:os";
import assert from "node:assert/strict";

const out = "dist-validation/lag-live-20261101/cloudflare";
mkdirSync(out, { recursive: true });
const authPath = join(
  homedir(),
  "AppData/Roaming/xdg.config/.wrangler/config/default.toml",
);
const token = /^oauth_token\s*=\s*"([^"]+)"/m.exec(
  readFileSync(authPath, "utf8"),
)?.[1];
assert(token, "既存Wrangler OAuthが必要です");
const request = async (path, body) => {
  const response = await fetch(`https://api.cloudflare.com/client/v4${path}`, {
    method: body ? "POST" : "GET",
    redirect: "error",
    headers: {
      Authorization: `Bearer ${token}`,
      "Content-Type": "application/json",
    },
    ...(body ? { body: JSON.stringify(body) } : {}),
    signal: AbortSignal.timeout(30000),
  });
  const data = await response.json();
  if (!response.ok || data.success === false || data.errors?.length) {
    const error = {
      status: response.status,
      errors: data.errors?.map(({ code, message }) => ({ code, message })),
    };
    writeFileSync(`${out}/last-error.json`, JSON.stringify(error, null, 2));
    throw Error(
      `Cloudflare読取失敗 HTTP ${response.status}（詳細は資格情報を含まないlast-error.json）`,
    );
  }
  return data;
};
const accounts = (await request("/accounts")).result;
assert(accounts.length === 1, "アカウントが一意ではないため自動選択しません");
const account = accounts[0].id;
const namespaces = (
  await request(`/accounts/${account}/workers/durable_objects/namespaces`)
).result.filter(
  (x) => x.script === "swarm-front" || x.script_name === "swarm-front",
);
writeFileSync(
  `${out}/namespaces.json`,
  JSON.stringify(
    namespaces.map(({ id, name, class: className, script, script_name }) => ({
      id,
      name,
      className,
      script,
      script_name,
    })),
    null,
    2,
  ),
);
const mode = process.argv[2] ?? "discover";
if (mode === "discover") {
  const query = `{ __type(name: "account") { fields { name type { kind name ofType { kind name } } args { name type { kind name ofType { kind name } } } } } }`;
  const data = await request("/graphql", { query });
  const fields = (data.data?.__type?.fields ?? []).filter((x) =>
    x.name.startsWith("durableObjects"),
  );
  writeFileSync(`${out}/dataset-schema.json`, JSON.stringify(fields, null, 2));
  console.log(
    JSON.stringify({
      namespaces: namespaces.map(({ name, class: c, script, script_name }) => ({
        name,
        className: c,
        script,
        script_name,
      })),
      datasets: fields,
    }),
  );
} else {
  const query = readFileSync(process.argv[3], "utf8");
  const namespace = namespaces.find((x) => x.class === "Room")?.id;
  const gateNamespace = namespaces.find((x) => x.class === "Gate")?.id;
  const data = await request("/graphql", {
    query,
    variables: { account, namespace, gateNamespace },
  });
  writeFileSync(`${out}/${mode}.json`, JSON.stringify(data.data, null, 2));
  console.log(JSON.stringify({ mode, saved: `${out}/${mode}.json` }));
}
