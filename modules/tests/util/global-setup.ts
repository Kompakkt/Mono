import { access, writeFile } from "fs/promises";
import { generateMockData, getMockData } from "./mock-data";
import { dirname, join } from "path";
import { fileURLToPath } from "url";

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
