export const MOCK_PREFIX = "swarm-front-orientation-mock-v1:";
export interface MockStore {
  read<T>(key: string, fallback: T): T;
  write(key: string, value: unknown): boolean;
}

/** Every caller receives a logical key; production keys are never addressed. */
export function createMockStore(
  storage: Pick<Storage, "getItem" | "setItem">,
): MockStore {
  return {
    read<T>(key: string, fallback: T): T {
      try {
        const raw = storage.getItem(MOCK_PREFIX + key);
        return raw === null
          ? structuredClone(fallback)
          : (JSON.parse(raw) as T);
      } catch {
        return structuredClone(fallback);
      }
    },
    write(key, value) {
      try {
        storage.setItem(MOCK_PREFIX + key, JSON.stringify(value));
        return true;
      } catch {
        return false;
      }
    },
  };
}
