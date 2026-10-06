import fs from "node:fs";
import path from "node:path";
import ts from "typescript";

const root = process.cwd();
const dist = path.join(root, "dist");
const templatePath = path.join(root, "tools", "database-server", "server-template.cjs");
const outputPath = path.join(root, "tools", "database-server", "generated-server.cjs");

function collect(directory, prefix = "") {
  const result = {};
  for (const entry of fs.readdirSync(directory, { withFileTypes: true })) {
    const absolute = path.join(directory, entry.name);
    const relative = path.posix.join(prefix, entry.name);
    if (entry.isDirectory()) Object.assign(result, collect(absolute, relative));
    else result[relative] = fs.readFileSync(absolute).toString("base64");
  }
  return result;
}

if (!fs.existsSync(path.join(dist, "index.html"))) throw new Error("Run the Vite production build before generating the server bundle.");
const template = fs.readFileSync(templatePath, "utf8");
const cleanupSource = fs.readFileSync(path.join(root, "src", "services", "maintenance", "cleanupCore.ts"), "utf8");
const cleanupCode = ts.transpileModule(cleanupSource, { compilerOptions: { module: ts.ModuleKind.CommonJS, target: ts.ScriptTarget.ES2022 } }).outputText;
const cleanupModule = `(() => { const exports = {}; ${cleanupCode}\nreturn exports; })()`;
const reportsSource = fs.readFileSync(path.join(root, "src", "services", "reports", "sqliteReports.ts"), "utf8");
const reportsCode = ts.transpileModule(reportsSource, { compilerOptions: { module: ts.ModuleKind.CommonJS, target: ts.ScriptTarget.ES2022 } }).outputText;
const reportsModule = `(() => { const exports = {}; ${reportsCode}\nreturn exports; })()`;
fs.writeFileSync(outputPath, template.replace("__COOP_EMBEDDED_ASSETS__", JSON.stringify(collect(dist))).replace("__COOP_MAINTENANCE__", cleanupModule).replace("__COOP_REPORTS__", reportsModule));
console.log(`Generated ${outputPath}`);
