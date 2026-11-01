import { describe, expect, it } from "vitest";
import {
  numericLagRows,
  LAG_FIELDS,
  LAG_PREFIX,
} from "../scripts/lag-tail-filter.mjs";

const row = () =>
  Object.fromEntries(LAG_FIELDS.map((key) => [key, key === "reason" ? 1 : 20]));
describe("live diagnostic log boundary", () => {
  it("keeps only fixed numeric anomaly fields from a full tail envelope", () => {
    const input = {
      ...row(),
      token: "private-token",
      room: "private-room",
      unexpectedNumber: 12345678,
    };
    const event = {
      event: {
        request: {
          headers: { authorization: "private-header" },
          url: "private-url",
        },
      },
      logs: [
        { message: [LAG_PREFIX, JSON.stringify(input)] },
        { message: ["private-log"] },
      ],
    };
    const result = numericLagRows(event);
    expect(result).toEqual([row()]);
    expect(JSON.stringify(result)).not.toContain("private");
    expect(JSON.stringify(result)).not.toContain("12345678");
  });
  it("rejects malformed and partial messages without exposing their text", () => {
    expect(
      numericLagRows({
        logs: [
          { message: [LAG_PREFIX, "private-invalid"] },
          {
            message: [
              LAG_PREFIX,
              JSON.stringify({ ...row(), inputAgeMs: "private" }),
            ],
          },
          { message: [LAG_PREFIX, JSON.stringify({ at: 1, reason: 1 })] },
        ],
      }),
    ).toEqual([]);
    expect(numericLagRows(null)).toEqual([]);
  });
});
