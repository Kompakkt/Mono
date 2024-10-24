import { join } from "node:path";
import { exists } from "./utils";
import { COLORS } from "./colors";
import { createCA, createCert } from "mkcert";
import { writeFile } from "node:fs/promises";

export const checkOrCreateCert = async (root: string) => {
  const keyPath = join(root, "key.pem");
  const keyExists = await exists(keyPath);
  const certPath = join(root, "cert.pem");
  const certExists = await exists(certPath);
  const fullchainPath = join(root, "fullchain.pem");

  if (keyExists && certExists) {
    console.log(COLORS.FgMagenta, "SSL key and cert already exist");
    return;
  }

  const ca = await createCA({
    organization: "Kompakkt.Mono Dev",
    countryCode: "DE",
    state: "NRW",
    locality: "Cologne",
    validity: 365,
  });

  const cert = await createCert({
    domains: ["127.0.0.1", "localhost", "kompakkt.local"],
    validity: 365,
    ca: ca,
    organization: "Kompakkt.Mono Dev",
  });

  return await Promise.all([
    writeFile(keyPath, cert.key),
    writeFile(certPath, cert.cert),
    writeFile(fullchainPath, `${cert.cert}\n${ca.cert}`),
  ])
    .then(() => {
      console.log(COLORS.FgGreen, "Created SSL key and cert");
    })
    .catch((err) => {
      console.log(COLORS.FgRed, "Failed creating SSL key and cert");
      console.log(err);
      process.exit(1);
    });
};
