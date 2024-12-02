import { unlink } from "fs/promises";
import { dirname, join } from "path";
import { fileURLToPath } from "url";

const __dirname = dirname(fileURLToPath(import.meta.url));
const filesToDelete: string[] = [".auth.json", ".mock.json"];

export default async function () {
  console.log("Teardown - Removing files");
  for (const file of filesToDelete) {
    await unlink(join(__dirname, file)).catch();
  }
}
