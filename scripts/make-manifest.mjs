// Tworzy manifest dla dodatku opublikowanego pod podanym adresem HTTPS.
// Użycie: node scripts/make-manifest.mjs https://twoja-domena.pl/sciezka [plik-wyjściowy]
import { readFileSync, writeFileSync } from "node:fs";

const [, , rawUrl, out = "dist/manifest.xml"] = process.argv;
if (!rawUrl || !/^https:\/\/[^\s]+$/.test(rawUrl)) {
  console.error("Podaj adres HTTPS, pod którym opublikowano dodatek, np. https://example.github.io/wykresy");
  process.exit(1);
}
const base = rawUrl.replace(/\/+$/, "");
const origin = new URL(base).origin;
const manifest = readFileSync("manifest.xml", "utf8")
  .replace("<AppDomain>https://localhost:3000</AppDomain>", `<AppDomain>${origin}</AppDomain>`)
  .replaceAll("https://localhost:3000", base);
writeFileSync(out, manifest);
console.log(`Zapisano ${out} dla adresu ${base}`);
