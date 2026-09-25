import { readdir, readFile, writeFile } from "node:fs/promises";
import { join } from "node:path";

const assetDir = join(process.cwd(), ".vercel", "output", "static", "assets");
const functionDir = join(process.cwd(), ".vercel", "output", "functions");
const clientEntry = (await readdir(assetDir)).find((name) => /^index-[^/]+\.js$/.test(name));

if (!clientEntry) {
  throw new Error("Could not find the production TanStack client entry");
}

async function patchManifest(directory) {
  for (const name of await readdir(directory, { withFileTypes: true })) {
    const path = join(directory, name.name);
    if (name.isDirectory()) {
      await patchManifest(path);
      continue;
    }
    if (!name.name.endsWith(".mjs")) continue;

    const source = await readFile(path, "utf8");
    if (!source.includes("virtual:tanstack-start-dev-client-entry")) continue;

    await writeFile(
      path,
      source.replaceAll(
        "/@id/virtual:tanstack-start-dev-client-entry",
        `/assets/${clientEntry}`,
      ),
    );
    console.log(`Patched ${path} to use /assets/${clientEntry}`);
  }
}

await patchManifest(functionDir);
