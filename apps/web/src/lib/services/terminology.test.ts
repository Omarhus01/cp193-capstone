import { describe, expect, it } from "vitest";
import { findBannedTerms } from "./terminology";

describe("findBannedTerms", () => {
  it("flags 하나님 everywhere", () => {
    expect(findBannedTerms("하나님")).toEqual(["하나님"]);
  });

  it('flags "God" used as a name', () => {
    expect(findBannedTerms("praise be to God")).toEqual(["God"]);
  });

  it('allows lowercase "god", which translates إله', () => {
    expect(findBannedTerms("there is no god but Allah")).toEqual([]);
  });

  it('allows "Lord", which translates رب', () => {
    expect(findBannedTerms("He is the Lord of the Mighty Throne")).toEqual([]);
  });
});
