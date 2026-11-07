import { readFileSync } from "node:fs";
import { join } from "node:path";
import { describe, expect, it } from "vitest";
import { inspectTlsCertificates } from "./tls-cert";

// Self-signed certificates generated with OpenSSL 3.5; the expected sizes are
// what `openssl x509 -text` prints for each key.
const fixture = (name: string) =>
  readFileSync(join(__dirname, "__fixtures__/certs", `${name}.crt`), "utf8");

describe("inspectTlsCertificates", () => {
  it.each([
    ["rsa2048", "rsaEncryption", 2048],
    ["p256", "ecPublicKey", 256],
    ["p521", "ecPublicKey", 521],
    ["ed25519", "Ed25519", 256],
  ])(
    "reports the %s key size, not the BIT STRING size",
    async (name, alg, bits) => {
      const [cert] = await inspectTlsCertificates(fixture(name));
      expect(cert.publicKeyAlgorithm).toBe(alg);
      expect(cert.publicKeyBitLength).toBe(bits);
    },
  );

  it("decodes OIDs under arc 2 and arcs beyond 2^53", async () => {
    const [cert] = await inspectTlsCertificates(fixture("oid"));
    expect(cert.subjectAttributes.map((a) => a.oid)).toEqual([
      "2.5.4.3",
      "2.999.3",
      "2.25.329800735698586629295641978511506172918",
    ]);
  });
});
