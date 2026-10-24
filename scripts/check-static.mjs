#!/usr/bin/env node
/**
 * Checagem de integridade do site estático (sem dependências externas).
 *
 * 1. Garante que `index.html` existe na raiz.
 * 2. Garante que existem arquivos .html no repositório.
 * 3. Garante que toda referência local em src=/href= aponta para um arquivo existente.
 *
 * Uso: node scripts/check-static.mjs  (exit 0 = ok, exit 1 = falha)
 */
import { existsSync, readFileSync, readdirSync } from "node:fs";
import { dirname, join, relative, resolve, sep } from "node:path";
import { fileURLToPath } from "node:url";

const root = resolve(dirname(fileURLToPath(import.meta.url)), "..");
const IGNORED_DIRS = new Set([".git", "node_modules", ".github"]);

function listHtmlFiles(dir) {
  const files = [];
  for (const entry of readdirSync(dir, { withFileTypes: true })) {
    if (entry.isDirectory()) {
      if (IGNORED_DIRS.has(entry.name)) continue;
      files.push(...listHtmlFiles(join(dir, entry.name)));
    } else if (entry.name.toLowerCase().endsWith(".html")) {
      files.push(join(dir, entry.name));
    }
  }
  return files;
}

const errors = [];

if (!existsSync(join(root, "index.html"))) {
  errors.push("index.html ausente na raiz do repositório");
}

const htmlFiles = listHtmlFiles(root);
if (htmlFiles.length === 0) {
  errors.push("nenhum arquivo .html encontrado no repositório");
}

const ATTR_RE = /\b(?:src|href)\s*=\s*["']([^"']+)["']/gi;

for (const file of htmlFiles) {
  const relFile = relative(root, file).split(sep).join("/");
  const html = readFileSync(file, "utf8");
  for (const [, raw] of html.matchAll(ATTR_RE)) {
    const ref = raw.trim();
    if (!ref) continue;
    // URLs externas (http:, https:, data:, mailto:, javascript:, //cdn...)
    if (/^[a-z][a-z0-9+.-]*:/i.test(ref) || ref.startsWith("//")) continue;
    // âncoras puras (#seção)
    if (ref.startsWith("#")) continue;
    const target = ref.split(/[#?]/, 1)[0];
    if (!target) continue;
    const resolved = resolve(dirname(file), target);
    if (!existsSync(resolved)) {
      errors.push(`${relFile}: referência quebrada -> ${ref}`);
    }
  }
}

if (errors.length > 0) {
  console.error("Checagem do site estático falhou:");
  for (const error of errors) console.error(`  - ${error}`);
  process.exit(1);
}

console.log(
  `OK: ${htmlFiles.length} arquivo(s) HTML verificado(s), nenhuma referência local quebrada.`,
);
