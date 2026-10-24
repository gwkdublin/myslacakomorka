import { readFileSync } from "node:fs";
import readXlsxFileNode from "read-excel-file/node";
import { extractRange, formatRange, parseRange, transpose, usedRange } from "../src/office/excel";

it("parseRange i formatRange", () => {
  expect(parseRange("B2:F6")).toEqual({ r0: 1, c0: 1, r1: 5, c1: 5 });
  expect(parseRange("$AA$10")).toEqual({ r0: 9, c0: 26, r1: 9, c1: 26 });
  expect(parseRange("F6:B2")).toEqual({ r0: 1, c0: 1, r1: 5, c1: 5 });
  expect(parseRange("xyz")).toBeNull();
  expect(formatRange({ r0: 1, c0: 1, r1: 5, c1: 27 })).toBe("B2:AB6");
});

it("transpose", () => expect(transpose([["a", "b"], ["c"]])).toEqual([["a", "c"], ["b", ""]]));

it("plik .xlsx zachowuje współrzędne komórek (dane od B3)", async () => {
  const sheets = await readXlsxFileNode(readFileSync("tests/fixtures/sprzedaz.xlsx"));
  const rows = sheets[0].data.map((r) => r.map((v) => (v === null ? "" : String(v))));
  const used = usedRange(rows)!;
  expect(formatRange(used)).toBe("B3:E5");
  expect(extractRange(rows, used)[1]).toEqual(["Polska", "120.5", "140", "151"]);
});
