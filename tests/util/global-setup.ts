import { access, writeFile } from "node:fs/promises";
import { generateMockData, getMockData } from "./mock-data";
import { dirname, join } from "node:path";
import { fileURLToPath } from "node:url";

const __dirname = dirname(fileURLToPath(import.meta.url));

export default async function () {
  console.log("Setup - Generating mock data");
  console.table(await getMockData());

  const path = join(__dirname, "kompakkt.glb");
  try {
    await access(path);
    console.log("Setup - Example model already exists");
  } catch {
    console.log("Setup - Downloading example model");
    const url = "https://kompakkt.de/viewer/assets/models/kompakkt.glb";
    const response = await fetch(url).then((res) => res.arrayBuffer());
    await writeFile(path, Buffer.from(response));
  }
}
