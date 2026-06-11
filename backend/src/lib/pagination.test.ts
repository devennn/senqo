import { describe, it, expect } from "vitest";
import { listPageOffset, parseListPageParams } from "../lib/pagination.js";

describe("pagination", () => {
  describe("listPageOffset", () => {
    // Page 1 with pageSize 10 should start at offset 0.
    // Expected: returns 0.
    it("returns 0 for page 1 with pageSize 10", () => {
      expect(listPageOffset(1, 10)).toBe(0);
    });

    // Page 2 with pageSize 10 should skip the first 10 items.
    // Expected: returns 10.
    it("returns 10 for page 2 with pageSize 10", () => {
      expect(listPageOffset(2, 10)).toBe(10);
    });

    // Page 3 with pageSize 25 should skip the first 50 items (3-1)*25.
    // Expected: returns 50.
    it("returns 50 for page 3 with pageSize 25", () => {
      expect(listPageOffset(3, 25)).toBe(50);
    });
  });

  describe("parseListPageParams", () => {
    // When no query params are provided, sensible defaults must be used.
    // Expected: page=1, pageSize=10.
    it("returns defaults when no params are provided", () => {
      const result = parseListPageParams(undefined, undefined);
      expect(result.page).toBe(1);
      expect(result.pageSize).toBe(10);
    });

    // Valid numeric strings should be parsed to their integer values.
    // Expected: page=3, pageSize=20.
    it("parses valid page and pageSize", () => {
      const result = parseListPageParams("3", "20");
      expect(result.page).toBe(3);
      expect(result.pageSize).toBe(20);
    });

    // pageSize above the maximum allowed must be clamped down.
    // Expected: pageSize is clamped to 50 (MAX_LIST_PAGE_SIZE).
    it("clamps pageSize to MAX_LIST_PAGE_SIZE (50)", () => {
      const result = parseListPageParams("1", "100");
      expect(result.pageSize).toBe(50);
    });

    // Non-numeric page values should fall back to 1 instead of NaN.
    // Expected: page defaults to 1.
    it("defaults invalid page to 1", () => {
      const result = parseListPageParams("abc", "10");
      expect(result.page).toBe(1);
    });

    // Non-numeric pageSize should fall back to the provided defaultPageSize.
    // Expected: pageSize=15 (the custom default) when input is "abc".
    it("defaults invalid pageSize to defaultPageSize", () => {
      const result = parseListPageParams("2", "abc", 15);
      expect(result.pageSize).toBe(15);
    });
  });
});
