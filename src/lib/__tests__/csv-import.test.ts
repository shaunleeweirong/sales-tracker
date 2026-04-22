import { describe, it, expect } from "vitest";
import { parseCurrencyToCents, mapHeaders, validateRows } from "../csv-import";

describe("parseCurrencyToCents", () => {
  it("handles $ and commas", () => {
    expect(parseCurrencyToCents("$1,234.50")).toBe(123_450);
  });
  it("handles plain numbers", () => {
    expect(parseCurrencyToCents("45000")).toBe(4_500_000);
  });
  it("handles parens for negatives", () => {
    expect(parseCurrencyToCents("($12.34)")).toBe(-1_234);
  });
  it("returns null for empty/invalid", () => {
    expect(parseCurrencyToCents("")).toBeNull();
    expect(parseCurrencyToCents(null)).toBeNull();
    expect(parseCurrencyToCents("abc")).toBeNull();
    expect(parseCurrencyToCents("N/A")).toBeNull();
  });
});

describe("mapHeaders", () => {
  it("maps the canonical header names", () => {
    const m = mapHeaders([
      "Parent Company",
      "Child Company",
      "LinkedIn Ad Account ID",
      "Last 7 Days Spend",
      "QTD Spend",
    ]);
    expect(m.parentCompany).toBe("Parent Company");
    expect(m.childCompany).toBe("Child Company");
    expect(m.linkedinAccountId).toBe("LinkedIn Ad Account ID");
    expect(m.last7dSpendCents).toBe("Last 7 Days Spend");
    expect(m.qtdSpendCents).toBe("QTD Spend");
  });

  it("maps aliased names case-insensitively", () => {
    const m = mapHeaders(["parent", "advertiser", "account id", "7d spend", "qtd"]);
    expect(m.parentCompany).toBe("parent");
    expect(m.childCompany).toBe("advertiser");
    expect(m.linkedinAccountId).toBe("account id");
    expect(m.last7dSpendCents).toBe("7d spend");
    expect(m.qtdSpendCents).toBe("qtd");
  });
});

describe("validateRows", () => {
  const headers = [
    "Parent Company",
    "Child Company",
    "LinkedIn Ad Account ID",
    "Last 7 Days Spend",
    "QTD Spend",
  ];

  it("accepts clean rows", () => {
    const r = validateRows(
      [
        {
          "Parent Company": "Acme",
          "Child Company": "Acme Brand",
          "LinkedIn Ad Account ID": "12345",
          "Last 7 Days Spend": "$1,000",
          "QTD Spend": "$10,000",
        },
      ],
      headers,
    );
    expect(r.invalidCount).toBe(0);
    expect(r.rows).toHaveLength(1);
    expect(r.rows[0]).toMatchObject({
      parentCompany: "Acme",
      childCompany: "Acme Brand",
      linkedinAccountId: "12345",
      last7dSpendCents: 100_000,
      qtdSpendCents: 1_000_000,
    });
  });

  it("flags missing parent as error and skips row", () => {
    const r = validateRows(
      [
        {
          "Parent Company": "",
          "Child Company": "X",
          "LinkedIn Ad Account ID": "1",
          "Last 7 Days Spend": "10",
          "QTD Spend": "100",
        },
      ],
      headers,
    );
    expect(r.invalidCount).toBe(1);
    expect(r.rows).toHaveLength(0);
    expect(r.warnings.some((w) => w.level === "error")).toBe(true);
  });

  it("defaults empty spend to 0 with warning", () => {
    const r = validateRows(
      [
        {
          "Parent Company": "Acme",
          "Child Company": "Acme",
          "LinkedIn Ad Account ID": "99",
          "Last 7 Days Spend": "",
          "QTD Spend": "200",
        },
      ],
      headers,
    );
    expect(r.rows[0].last7dSpendCents).toBe(0);
    expect(r.warnings.some((w) => /7-day spend/.test(w.message))).toBe(true);
  });

  it("falls back child to parent when child is empty", () => {
    const r = validateRows(
      [
        {
          "Parent Company": "Solo Inc",
          "Child Company": "",
          "LinkedIn Ad Account ID": "42",
          "Last 7 Days Spend": "1",
          "QTD Spend": "2",
        },
      ],
      headers,
    );
    expect(r.rows[0].childCompany).toBe("Solo Inc");
  });

  it("flags duplicate ad account ids within the same file", () => {
    const r = validateRows(
      [
        {
          "Parent Company": "A",
          "Child Company": "",
          "LinkedIn Ad Account ID": "1",
          "Last 7 Days Spend": "1",
          "QTD Spend": "1",
        },
        {
          "Parent Company": "A",
          "Child Company": "",
          "LinkedIn Ad Account ID": "1",
          "Last 7 Days Spend": "2",
          "QTD Spend": "2",
        },
      ],
      headers,
    );
    expect(r.warnings.some((w) => /Duplicate/.test(w.message))).toBe(true);
  });

  it("errors out if required columns missing entirely", () => {
    const r = validateRows([{ foo: "bar" }], ["foo"]);
    expect(r.invalidCount).toBe(1);
    expect(r.warnings[0].message).toMatch(/Missing required column/);
  });
});
