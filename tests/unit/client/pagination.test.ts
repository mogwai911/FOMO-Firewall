import { describe, expect, it } from "vitest";
import { paginateItems } from "@/lib/client/pagination";

describe("pagination helper", () => {
  it("returns page slice and totals", () => {
    const items = Array.from({ length: 23 }, (_, index) => `item-${index + 1}`);
    const page = paginateItems(items, 2, 10);

    expect(page.currentPage).toBe(2);
    expect(page.totalPages).toBe(3);
    expect(page.items).toEqual(items.slice(10, 20));
  });

  it("clamps page index and keeps at least one page", () => {
    const page = paginateItems(["a", "b"], 99, 10);
    expect(page.currentPage).toBe(1);
    expect(page.totalPages).toBe(1);
    expect(page.items).toEqual(["a", "b"]);
  });
});
