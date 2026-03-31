import fs from "node:fs";
import path from "node:path";

const manifestPath = path.join(process.cwd(), "manifest.json");
const versionsPath = path.join(process.cwd(), "versions.json");
const packagePath = path.join(process.cwd(), "package.json");

const manifest = JSON.parse(fs.readFileSync(manifestPath, "utf8"));
const versions = JSON.parse(fs.readFileSync(versionsPath, "utf8"));
const pkg = JSON.parse(fs.readFileSync(packagePath, "utf8"));

if (!pkg.version) {
  throw new Error("package.json is missing a version.");
}

manifest.version = pkg.version;
versions[pkg.version] = manifest.minAppVersion;

fs.writeFileSync(manifestPath, `${JSON.stringify(manifest, null, 2)}\n`);
fs.writeFileSync(versionsPath, `${JSON.stringify(versions, null, 2)}\n`);
