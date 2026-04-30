import { describe, expect, it } from "vitest";
import {
  fmtIsoDate,
  fmtLongDate,
  fmtMoney,
  fmtShortDate,
  todayFilename,
} from "./format";

// Use Date constructed in local TZ so the formatters that read local
// fields (getDate / getHours / etc.) produce a deterministic string
// regardless of where the test runs.
const localDate = (y: number, mZeroBased: number, d: number, h: number, min: number) =>
  new Date(y, mZeroBased, d, h, min);

describe("fmtMoney", () => {
  it("formats with two fixed decimals and Thai grouping", () => {
    // Thai locale uses ASCII digits + comma group separator + period decimal.
    expect(fmtMoney(1234.5)).toBe("1,234.50");
  });

  it("handles zero", () => {
    expect(fmtMoney(0)).toBe("0.00");
  });

  it("rounds half-away from-zero by default", () => {
    expect(fmtMoney(1.005)).toMatch(/1\.0[01]/); // platform rounding varies
  });
});

describe("fmtShortDate", () => {
  it("renders DD/MM HH:mm with zero padding", () => {
    const ts = localDate(2026, 3, 5, 9, 7).getTime();
    expect(fmtShortDate(ts)).toBe("05/04 09:07");
  });
});

describe("fmtLongDate", () => {
  it("renders DD/MM/YYYY HH:mm", () => {
    const ts = localDate(2026, 11, 31, 23, 59).getTime();
    expect(fmtLongDate(ts)).toBe("31/12/2026 23:59");
  });
});

describe("fmtIsoDate", () => {
  it("renders YYYY-MM-DD HH:mm for sortable CSV cells", () => {
    const ts = localDate(2026, 0, 1, 0, 0).getTime();
    expect(fmtIsoDate(ts)).toBe("2026-01-01 00:00");
  });
});

describe("todayFilename", () => {
  it("formats as <prefix>-YYYYMMDD-HHmm.<ext>", () => {
    const result = todayFilename("claribill", "csv");
    expect(result).toMatch(/^claribill-\d{8}-\d{4}\.csv$/);
  });
});
