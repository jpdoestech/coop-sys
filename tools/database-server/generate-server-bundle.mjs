import fs from "node:fs";
import path from "node:path";

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
fs.writeFileSync(outputPath, template.replace("__COOP_EMBEDDED_ASSETS__", JSON.stringify(collect(dist))));
console.log(`Generated ${outputPath}`);
