import { describe, expect, it } from "vitest";
import { pageLookup } from "./pages";

describe("pageLookup", () => {
  const pageOf = pageLookup([
    { page: 1, surah: 1, ayah: 1 },
    { page: 2, surah: 2, ayah: 1 },
    { page: 3, surah: 2, ayah: 6 },
    { page: 4, surah: 3, ayah: 4 },
  ]);

  it("gives the page that starts at a verse", () => {
    expect(pageOf({ surah: 2, ayah: 6 })).toBe(3);
  });

  it("gives the page a verse runs on to, across the end of a surah", () => {
    expect(pageOf({ surah: 1, ayah: 7 })).toBe(1);
    expect(pageOf({ surah: 2, ayah: 5 })).toBe(2);
    expect(pageOf({ surah: 3, ayah: 3 })).toBe(3);
    expect(pageOf({ surah: 114, ayah: 6 })).toBe(4);
  });

  it("gives null when no page starts before the verse", () => {
    expect(pageLookup([])({ surah: 1, ayah: 1 })).toBeNull();
    expect(pageLookup([{ page: 2, surah: 2, ayah: 1 }])({ surah: 1, ayah: 3 })).toBeNull();
  });
});
