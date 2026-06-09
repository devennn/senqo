import { describe, it, expect } from "vitest";
import { listPageOffset, parseListPageParams } from "../lib/pagination.js";

describe("pagination", () => {
  describe("listPageOffset", () => {
    it("returns 0 for page 1 with pageSize 10", () => {
      expect(listPageOffset(1, 10)).toBe(0);
    });

    it("returns 10 for page 2 with pageSize 10", () => {
      expect(listPageOffset(2, 10)).toBe(10);
    });

    it("returns 50 for page 3 with pageSize 25", () => {
      expect(listPageOffset(3, 25)).toBe(50);
    });
  });

  describe("parseListPageParams", () => {
    it("returns defaults when no params are provided", () => {
      const result = parseListPageParams(undefined, undefined);
      expect(result.page).toBe(1);
      expect(result.pageSize).toBe(10);
    });

    it("parses valid page and pageSize", () => {
      const result = parseListPageParams("3", "20");
      expect(result.page).toBe(3);
      expect(result.pageSize).toBe(20);
    });

    it("clamps pageSize to MAX_LIST_PAGE_SIZE (50)", () => {
      const result = parseListPageParams("1", "100");
      expect(result.pageSize).toBe(50);
    });

    it("defaults invalid page to 1", () => {
      const result = parseListPageParams("abc", "10");
      expect(result.page).toBe(1);
    });

    it("defaults invalid pageSize to defaultPageSize", () => {
      const result = parseListPageParams("2", "abc", 15);
      expect(result.pageSize).toBe(15);
    });
  });
});
