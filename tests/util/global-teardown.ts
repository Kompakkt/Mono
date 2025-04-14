import { unlink } from "node:fs/promises";
import { dirname, join } from "node:path";
import { fileURLToPath } from "node:url";

const __dirname = dirname(fileURLToPath(import.meta.url));
const filesToDelete: string[] = [".auth.json", ".mock.json"];

export default async function () {
  console.log("Teardown - Removing files");
  for (const file of filesToDelete) {
    await unlink(join(__dirname, file)).catch();
  }
}
