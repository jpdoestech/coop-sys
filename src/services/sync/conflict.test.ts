import { describe, expect, it } from "vitest";
import { chooseLastModifiedWinner } from "./conflict";

describe("chooseLastModifiedWinner", () => {
  it("uses the local record when local updated_at is newer", () => {
    expect(
      chooseLastModifiedWinner(
        { updated_at: "2026-09-28T12:00:00.000Z" },
        { updated_at: "2026-09-28T11:00:00.000Z" }
      )
    ).toBe("local_wins");
  });

  it("uses the server record when server updated_at is newer", () => {
    expect(
      chooseLastModifiedWinner(
        { updated_at: "2026-09-28T11:00:00.000Z" },
        { updated_at: "2026-09-28T12:00:00.000Z" }
      )
    ).toBe("server_wins");
  });
});
