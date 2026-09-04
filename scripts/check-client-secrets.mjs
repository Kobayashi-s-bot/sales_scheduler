import { readFile, readdir } from "node:fs/promises";
import { extname, join, relative } from "node:path";

const roots = ["src", "proxy.ts"];
const extensions = new Set([".ts", ".tsx", ".js", ".jsx", ".mjs"]);
const violations = [];
async function filesAt(path) {
  if (extname(path)) return [path];
  const entries = await readdir(path, { withFileTypes: true });
  return (await Promise.all(entries.map((entry) => filesAt(join(path, entry.name))))).flat();
}
for (const root of roots) for (const file of await filesAt(root)) {
  if (!extensions.has(extname(file))) continue;
  const content = await readFile(file, "utf8");
  if (/NEXT_PUBLIC_[A-Z0-9_]*(?:SECRET|PRIVATE|SERVICE_ROLE)[A-Z0-9_]*/.test(content)) violations.push(`${relative(".", file)} exposes a privileged variable`);
  if (/^[\s]*["']use client["']/.test(content) && /SUPABASE_SERVICE_ROLE_KEY/.test(content)) violations.push(`${relative(".", file)} references the service role key in client code`);
}
if (violations.length) { console.error(violations.join("\n")); process.exit(1); }
console.log("Client secret boundary check passed.");
