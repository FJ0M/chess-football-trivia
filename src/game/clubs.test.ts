import { describe, expect, it } from "vitest";
import { CLUBS, CLUBS_AZ, searchClubs } from "./clubs";

describe("club list", () => {
  it("has all 92 clubs in one A to Z list, ignoring a leading AFC", () => {
    expect(CLUBS_AZ).toHaveLength(92);
    expect(CLUBS_AZ[0].name).toBe("Accrington Stanley");
    const names = CLUBS_AZ.map((c) => c.name);
    expect(names.indexOf("AFC Bournemouth")).toBeGreaterThan(names.indexOf("Bolton Wanderers"));
    expect(names.indexOf("AFC Bournemouth")).toBeLessThan(names.indexOf("Bradford City"));
    expect(names[names.length - 1]).toBe("York City");
    expect(new Set(CLUBS_AZ)).toEqual(new Set(CLUBS));
  });

  it("finds clubs by full or short name, any case", () => {
    expect(searchClubs("")).toHaveLength(92);
    expect(searchClubs("west ham").map((c) => c.id)).toEqual(["west-ham"]);
    expect(searchClubs("SPURS").map((c) => c.id)).toEqual(["tottenham"]);
    expect(searchClubs("brighton and hove").map((c) => c.id)).toEqual(["brighton"]);
    expect(searchClubs("man").slice(0, 2).map((c) => c.id).sort()).toEqual(["man-city", "man-utd"]);
    expect(searchClubs("utd").map((c) => c.id)).toContain("sheffield-utd");
    expect(searchClubs("zzz")).toEqual([]);
  });
});
