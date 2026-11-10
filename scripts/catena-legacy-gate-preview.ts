// The test runner supplies legacy-network-gate.ts from the unmodified base SHA.
import { Network } from "../src/client/legacy-network-gate";
import { makeWeapon } from "../src/shared/progression";

const status = document.getElementById("status")!;
const network = new Network("http://127.0.0.1:8797");
const zero = { power: 0, reload: 0, range: 0, rate: 0 };
network.equip = [
  makeWeapon("legacy-gate-rifle", "rifle", 0, zero, false, 1),
  makeWeapon("legacy-gate-shotgun", "shotgun", 0, zero, false, 2),
];
const observations = { statuses: [] as string[], oldBodyStates: 0, worlds: 0 };
network.onStatus = (message) => {
  status.textContent = message;
  observations.statuses.push(message);
};
network.onWorld = (world) => {
  observations.worlds++;
  if (world.enemies.some((enemy) => enemy.segments?.length === 14)) {
    observations.oldBodyStates++;
    throw Error("旧rendererへ14節stateが届いた");
  }
};
(window as any).__legacy = {
  observations,
  start: (code: string) => network.connect(code),
  token: () => network.token,
  status: () => status.textContent,
  close: () => network.close(),
};
