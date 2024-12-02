import { faker } from "@faker-js/faker";
import { readFile, unlink, writeFile } from "fs/promises";
import { dirname, join } from "path";
import { fileURLToPath } from "url";

export const generateMockData = (seed: number) => {
  faker.seed(seed);

  const sex = faker.person.sexType();
  const prename = faker.person.firstName(sex);
  const surname = faker.person.lastName(sex);
  const email = faker.internet.email({
    firstName: prename,
    lastName: surname,
  });
  const username = faker.internet.username({
    firstName: prename,
    lastName: surname,
  });
  const password = faker.internet.password();

  return {
    account: {
      email,
      prename,
      surname,
      username,
      password,
    },
  };
};

export type MockData = ReturnType<typeof generateMockData>;

const __dirname = dirname(fileURLToPath(import.meta.url));
const mockFile = join(__dirname, ".mock.json");

export const getMockData = async (): Promise<MockData> => {
  // Read the mock data from the file if it exists, otherwise generate new data
  try {
    return JSON.parse(await readFile(mockFile, "utf-8"));
  } catch {
    const mockData = generateMockData(Math.round(Math.random() * 1_000_000));
    await writeFile(mockFile, JSON.stringify(mockData));
    return mockData;
  }
};
