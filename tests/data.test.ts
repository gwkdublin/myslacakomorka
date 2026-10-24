import { formatNumber, formatSigned, gridToData, normalizeSpec, parseClipboardTable, parseNumber } from "../src/core/data";

const fmt = { decimals: 1, suffix: "", decimalSeparator: "," as const, thousandsSeparator: " " };

describe("parseNumber", () => {
  it.each([
    ["12", 12],
    ["12,5", 12.5],
    ["12.5", 12.5],
    ["1 234,5", 1234.5],
    ["1,234.5", 1234.5],
    ["1.234,5", 1234.5],
    ["-3", -3],
    ["(7)", -7],
    ["45%", 45],
    ["1e3", 1000],
  ])("%s → %d", (raw, expected) => expect(parseNumber(raw)).toBe(expected));

  it.each(["", "-", "abc", "e", "12a"])("%s → null", (raw) => expect(parseNumber(raw)).toBeNull());
});

describe("formatNumber", () => {
  it("formatuje z przecinkiem i spacją", () => expect(formatNumber(1234567.25, fmt)).toBe("1 234 567,3"));
  it("dodaje sufiks i minus typograficzny", () => expect(formatNumber(-5, { ...fmt, decimals: 0, suffix: "%" })).toBe("−5%"));
  it("nie pokazuje -0", () => expect(formatNumber(-0.01, { ...fmt, decimals: 0 })).toBe("0"));
  it("dodaje plus przy różnicy", () => expect(formatSigned(3, { ...fmt, decimals: 0 })).toBe("+3"));
});

describe("gridToData", () => {
  it("czyta kategorie, serie i sumy kaskadowe", () => {
    const d = gridToData([
      ["", "A", "B", "C", ""],
      ["Zmiana", "10", "-2", "e", ""],
    ]);
    expect(d.categories).toEqual(["A", "B", "C"]);
    expect(d.series[0].values).toEqual([10, -2, null]);
    expect(d.totals).toEqual([false, false, true]);
  });

  it("pomija puste wiersze i nazywa serie bez nazwy", () => {
    const d = gridToData([
      ["", "2024"],
      ["", "5"],
      ["", ""],
    ]);
    expect(d.series).toHaveLength(1);
    expect(d.series[0].name).toBe("Seria 1");
  });
});

it("parsuje schowek z Excela", () => {
  expect(parseClipboardTable("\tA\tB\r\nX\t1\t2\r\nY\t3\r\n")).toEqual([
    ["", "A", "B"],
    ["X", "1", "2"],
    ["Y", "3", ""],
  ]);
});

it("normalizeSpec uzupełnia brakujące opcje", () => {
  const s = normalizeSpec({ type: "line", grid: [["", "A"], ["S", 1]], options: { showLegend: false } });
  expect(s?.options.showLegend).toBe(false);
  expect(s?.options.format.decimalSeparator).toBe(",");
  expect(s?.grid[1][1]).toBe("1");
  expect(normalizeSpec({ foo: 1 })).toBeNull();
});
