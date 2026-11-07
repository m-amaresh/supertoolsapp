import { describe, expect, it } from "vitest";
import {
  lastModifiedFor,
  PAGE_LAST_MODIFIED,
  sitemapPaths,
} from "./last-modified";

describe("lastModifiedFor", () => {
  it("dates every sitemap URL with a real day that is not in the future", () => {
    const today = new Date().toISOString().slice(0, 10);
    for (const path of sitemapPaths()) {
      const date = lastModifiedFor(path);
      expect(date).toMatch(/^\d{4}-\d{2}-\d{2}$/);
      expect(date <= today).toBe(true);
    }
  });

  it("gives every category page its own entry", () => {
    for (const path of sitemapPaths()) {
      if (path.startsWith("/tools/category/")) {
        expect(PAGE_LAST_MODIFIED).toHaveProperty(path);
      }
    }
  });

  it("throws for a path with no date instead of borrowing one", () => {
    expect(() => lastModifiedFor("/terms")).toThrow(/No lastmod date/);
    expect(() => lastModifiedFor("/tools/pdf/spilt")).toThrow(/No lastmod/);
  });

  it("rejects malformed and impossible dates", () => {
    const original = PAGE_LAST_MODIFIED["/privacy"];
    try {
      for (const bad of ["2026-11-7", "2026-02-30", "2026-11-07T10:00:00Z"]) {
        PAGE_LAST_MODIFIED["/privacy"] = bad;
        expect(() => lastModifiedFor("/privacy")).toThrow(/Invalid lastmod/);
      }
    } finally {
      PAGE_LAST_MODIFIED["/privacy"] = original;
    }
  });
});
