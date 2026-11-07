import { base64ToBytes, bytesToHex, sha256 } from "./bytes";

interface Asn1Node {
  tagClass: number;
  tag: number;
  constructed: boolean;
  start: number;
  headerLength: number;
  length: number;
  valueStart: number;
  valueEnd: number;
  end: number;
  children: Asn1Node[];
}

interface DistinguishedNameAttribute {
  oid: string;
  name: string;
  value: string;
}

export interface ParsedTlsCertificate {
  pemLabel: string;
  version: number;
  serialNumber: string;
  signatureAlgorithmOid: string;
  signatureAlgorithm: string;
  issuer: string;
  issuerAttributes: DistinguishedNameAttribute[];
  subject: string;
  subjectAttributes: DistinguishedNameAttribute[];
  notBefore: string | null;
  notAfter: string | null;
  publicKeyAlgorithmOid: string;
  publicKeyAlgorithm: string;
  publicKeyBitLength: number | null;
  subjectAltNames: string[];
  sha256Fingerprint: string;
  derLength: number;
}

const OID_NAME_MAP: Record<string, string> = {
  "2.5.4.3": "CN",
  "2.5.4.6": "C",
  "2.5.4.7": "L",
  "2.5.4.8": "ST",
  "2.5.4.10": "O",
  "2.5.4.11": "OU",
  "1.2.840.113549.1.9.1": "emailAddress",
};

const ALGORITHM_NAME_MAP: Record<string, string> = {
  "1.2.840.113549.1.1.1": "rsaEncryption",
  "1.2.840.113549.1.1.11": "sha256WithRSAEncryption",
  "1.2.840.113549.1.1.12": "sha384WithRSAEncryption",
  "1.2.840.113549.1.1.13": "sha512WithRSAEncryption",
  "1.2.840.10045.2.1": "ecPublicKey",
  "1.2.840.10045.4.3.2": "ecdsa-with-SHA256",
  "1.2.840.10045.4.3.3": "ecdsa-with-SHA384",
  "1.2.840.10045.4.3.4": "ecdsa-with-SHA512",
  "1.2.840.113549.1.1.10": "rsassaPss",
  "1.3.101.110": "X25519",
  "1.3.101.111": "X448",
  "1.3.101.112": "Ed25519",
  "1.3.101.113": "Ed448",
};

function decodeAscii(bytes: Uint8Array): string {
  return Array.from(bytes, (byte) => String.fromCharCode(byte)).join("");
}

function decodeBmpString(bytes: Uint8Array): string {
  if (bytes.length % 2 !== 0) return "";
  let out = "";
  for (let i = 0; i < bytes.length; i += 2) {
    out += String.fromCharCode((bytes[i] << 8) | bytes[i + 1]);
  }
  return out;
}

function decodeString(tag: number, bytes: Uint8Array): string {
  if (tag === 0x0c) {
    return new TextDecoder("utf-8", { fatal: false }).decode(bytes);
  }
  if (tag === 0x1e) {
    return decodeBmpString(bytes);
  }
  return decodeAscii(bytes);
}

// Recursively parse one ASN.1 TLV (tag-length-value) node from DER-encoded data.
// Constructed nodes (sequences, sets) have their children parsed inline.
function parseAsn1Node(data: Uint8Array, offset: number): Asn1Node {
  if (offset >= data.length) {
    throw new Error("Unexpected end of ASN.1 input");
  }

  const tagByte = data[offset];
  const tagClass = (tagByte & 0xc0) >> 6;
  const constructed = (tagByte & 0x20) === 0x20;

  let tag = tagByte & 0x1f;
  let cursor = offset + 1;

  if (tag === 0x1f) {
    tag = 0;
    while (cursor < data.length) {
      const b = data[cursor++];
      tag = (tag << 7) | (b & 0x7f);
      if ((b & 0x80) === 0) break;
    }
  }

  if (cursor >= data.length) {
    throw new Error("Invalid ASN.1 length");
  }

  let length = data[cursor++];
  if ((length & 0x80) !== 0) {
    const octets = length & 0x7f;
    if (octets === 0 || octets > 4) {
      throw new Error("Unsupported ASN.1 length encoding");
    }
    if (cursor + octets > data.length) {
      throw new Error("Invalid ASN.1 length bytes");
    }
    length = 0;
    for (let i = 0; i < octets; i++) {
      length = (length << 8) | data[cursor++];
    }
  }

  const headerLength = cursor - offset;
  const valueStart = cursor;
  const valueEnd = valueStart + length;
  if (valueEnd > data.length) {
    throw new Error("ASN.1 value exceeds input length");
  }

  const node: Asn1Node = {
    tagClass,
    tag,
    constructed,
    start: offset,
    headerLength,
    length,
    valueStart,
    valueEnd,
    end: valueEnd,
    children: [],
  };

  if (constructed) {
    let childOffset = valueStart;
    while (childOffset < valueEnd) {
      const child = parseAsn1Node(data, childOffset);
      node.children.push(child);
      if (child.end <= childOffset) {
        throw new Error("Invalid ASN.1 child length");
      }
      childOffset = child.end;
    }
  }

  return node;
}

// Decode a DER-encoded OID (X.690 §8.19). Every subidentifier, including the
// first, is base-128 with a continuation high bit; the first one packs the
// first two arcs as first*40 + second, where second may exceed 39 under arc 2
// (e.g. 2.999). BigInt keeps very large arcs such as 2.25.<UUID> exact.
function parseOid(bytes: Uint8Array): string {
  const subidentifiers: bigint[] = [];
  let value = 0n;
  for (const byte of bytes) {
    value = (value << 7n) | BigInt(byte & 0x7f);
    if ((byte & 0x80) === 0) {
      subidentifiers.push(value);
      value = 0n;
    }
  }
  const [first, ...rest] = subidentifiers;
  if (first === undefined) return "";
  const head = first < 40n ? 0n : first < 80n ? 1n : 2n;
  return [head, first - head * 40n, ...rest].join(".");
}

// Key sizes as OpenSSL reports them, for algorithms whose size is fixed by
// the curve rather than readable from the key bytes.
const CURVE_BITS: Record<string, number> = {
  "1.2.840.10045.3.1.1": 192, // P-192
  "1.3.132.0.33": 224, // P-224
  "1.2.840.10045.3.1.7": 256, // P-256
  "1.3.132.0.10": 256, // secp256k1
  "1.3.132.0.34": 384, // P-384
  "1.3.132.0.35": 521, // P-521
  "1.3.36.3.3.2.8.1.1.7": 256, // brainpoolP256r1
  "1.3.36.3.3.2.8.1.1.11": 384, // brainpoolP384r1
  "1.3.36.3.3.2.8.1.1.13": 512, // brainpoolP512r1
};
const FIXED_KEY_BITS: Record<string, number> = {
  "1.3.101.110": 253, // X25519
  "1.3.101.111": 448, // X448
  "1.3.101.112": 256, // Ed25519
  "1.3.101.113": 456, // Ed448
};
const RSA_OIDS = new Set(["1.2.840.113549.1.1.1", "1.2.840.113549.1.1.10"]);
const EC_PUBLIC_KEY_OID = "1.2.840.10045.2.1";

function unsignedBitLength(bytes: Uint8Array): number {
  let i = 0;
  while (i < bytes.length && bytes[i] === 0) i++;
  if (i === bytes.length) return 0;
  return (bytes.length - i - 1) * 8 + (32 - Math.clz32(bytes[i]));
}

// The key size a reader expects next to the algorithm (the RSA modulus
// length, the EC curve size), not the size of the encoded BIT STRING.
// Returns null when the size can't be determined.
function publicKeyBits(
  algorithmOid: string,
  parameters: Asn1Node | undefined,
  bitString: Uint8Array,
  der: Uint8Array,
): number | null {
  if (algorithmOid in FIXED_KEY_BITS) return FIXED_KEY_BITS[algorithmOid];
  if (algorithmOid === EC_PUBLIC_KEY_OID) {
    if (parameters?.tag !== 0x06) return null;
    return CURVE_BITS[parseOid(asn1Value(parameters, der))] ?? null;
  }
  if (RSA_OIDS.has(algorithmOid) && bitString.length > 1) {
    try {
      // RSAPublicKey ::= SEQUENCE { modulus INTEGER, publicExponent INTEGER }
      const key = bitString.subarray(1);
      const modulus = parseAsn1Node(key, 0).children[0];
      return modulus ? unsignedBitLength(asn1Value(modulus, key)) : null;
    } catch {
      return null;
    }
  }
  return null;
}

function asn1Value(node: Asn1Node, data: Uint8Array): Uint8Array {
  return data.subarray(node.valueStart, node.valueEnd);
}

function formatSerial(integerBytes: Uint8Array): string {
  let bytes = integerBytes;
  while (bytes.length > 1 && bytes[0] === 0) {
    bytes = bytes.subarray(1);
  }
  const hex = bytesToHex(bytes).toUpperCase();
  return hex.match(/.{1,2}/g)?.join(":") ?? "";
}

// Parse UTCTime (tag 0x17) or GeneralizedTime (tag 0x18) to an ISO string.
// UTCTime: YYMMDDHHmmssZ — two-digit year, pivot at 50 (>=50 → 19xx, <50 → 20xx).
// GeneralizedTime: YYYYMMDDHHmmssZ — four-digit year.
function parseTime(node: Asn1Node, data: Uint8Array): string | null {
  const raw = decodeAscii(asn1Value(node, data));
  if (node.tag === 0x17) {
    const match = raw.match(/^(\d{2})(\d{2})(\d{2})(\d{2})(\d{2})(\d{2})Z$/);
    if (!match) return raw || null;
    const yearShort = Number.parseInt(match[1], 10);
    const year = yearShort >= 50 ? 1900 + yearShort : 2000 + yearShort;
    const month = Number.parseInt(match[2], 10) - 1;
    const day = Number.parseInt(match[3], 10);
    const hour = Number.parseInt(match[4], 10);
    const minute = Number.parseInt(match[5], 10);
    const second = Number.parseInt(match[6], 10);
    return new Date(
      Date.UTC(year, month, day, hour, minute, second),
    ).toISOString();
  }
  if (node.tag === 0x18) {
    const match = raw.match(/^(\d{4})(\d{2})(\d{2})(\d{2})(\d{2})(\d{2})Z$/);
    if (!match) return raw || null;
    const year = Number.parseInt(match[1], 10);
    const month = Number.parseInt(match[2], 10) - 1;
    const day = Number.parseInt(match[3], 10);
    const hour = Number.parseInt(match[4], 10);
    const minute = Number.parseInt(match[5], 10);
    const second = Number.parseInt(match[6], 10);
    return new Date(
      Date.UTC(year, month, day, hour, minute, second),
    ).toISOString();
  }
  return raw || null;
}

// Walk an X.509 RDNSequence and extract each attribute's OID + value.
// Returns both a human-readable "CN=..., O=..." string and the raw attributes.
function parseName(
  node: Asn1Node,
  data: Uint8Array,
): { text: string; attributes: DistinguishedNameAttribute[] } {
  const attributes: DistinguishedNameAttribute[] = [];

  for (const rdnSet of node.children) {
    for (const attrSeq of rdnSet.children) {
      if (attrSeq.children.length < 2) continue;
      const oidNode = attrSeq.children[0];
      const valueNode = attrSeq.children[1];
      if (oidNode.tagClass !== 0 || oidNode.tag !== 6) continue;

      const oid = parseOid(asn1Value(oidNode, data));
      const name = OID_NAME_MAP[oid] ?? oid;
      const value = decodeString(valueNode.tag, asn1Value(valueNode, data));
      attributes.push({ oid, name, value });
    }
  }

  return {
    text: attributes.map((attr) => `${attr.name}=${attr.value}`).join(", "),
    attributes,
  };
}

function parseSubjectAltNamesFromExtensionValue(value: Uint8Array): string[] {
  if (value.length === 0) return [];

  const names: string[] = [];
  const seq = parseAsn1Node(value, 0);
  if (seq.tagClass !== 0 || seq.tag !== 16) return [];

  for (const nameNode of seq.children) {
    if (nameNode.tagClass !== 2) continue;
    const bytes = value.subarray(nameNode.valueStart, nameNode.valueEnd);

    if (nameNode.tag === 1) {
      names.push(`EMAIL:${decodeAscii(bytes)}`);
    } else if (nameNode.tag === 2) {
      names.push(`DNS:${decodeAscii(bytes)}`);
    } else if (nameNode.tag === 6) {
      names.push(`URI:${decodeAscii(bytes)}`);
    } else if (nameNode.tag === 7) {
      if (bytes.length === 4) {
        names.push(`IP:${Array.from(bytes).join(".")}`);
      } else if (bytes.length === 16) {
        const parts: string[] = [];
        for (let i = 0; i < 16; i += 2) {
          parts.push(((bytes[i] << 8) | bytes[i + 1]).toString(16));
        }
        names.push(`IP:${parts.join(":")}`);
      }
    } else if (nameNode.tag === 8) {
      names.push(`RID:${parseOid(bytes)}`);
    }
  }

  return names;
}

function parseExtensions(tbsCertificate: Asn1Node, data: Uint8Array): string[] {
  const extWrapper = tbsCertificate.children.find(
    (child) => child.tagClass === 2 && child.tag === 3,
  );
  if (!extWrapper || extWrapper.children.length === 0) {
    return [];
  }

  const extensionSequence = extWrapper.children[0];
  const names: string[] = [];

  for (const extension of extensionSequence.children) {
    if (extension.children.length < 2) continue;

    const oidNode = extension.children[0];
    const oid = parseOid(asn1Value(oidNode, data));

    let extnValueNode = extension.children[1];
    if (extnValueNode.tagClass === 0 && extnValueNode.tag === 1) {
      extnValueNode = extension.children[2];
    }
    if (extnValueNode?.tagClass !== 0 || extnValueNode?.tag !== 4) {
      continue;
    }

    if (oid === "2.5.29.17") {
      const extValue = asn1Value(extnValueNode, data);
      names.push(...parseSubjectAltNamesFromExtensionValue(extValue));
    }
  }

  return names;
}

function algorithmNameForOid(oid: string): string {
  return ALGORITHM_NAME_MAP[oid] ?? oid;
}

function formatFingerprint(bytes: Uint8Array): string {
  const hex = bytesToHex(bytes).toUpperCase();
  return hex.match(/.{1,2}/g)?.join(":") ?? "";
}

// Parse the DER-encoded TBSCertificate structure and extract all display fields.
// Walks the fixed-order children: version, serial, algorithm, issuer, validity,
// subject, SPKI, and optional extensions (for SANs).
function parseCertificateDer(
  der: Uint8Array,
  pemLabel: string,
): Omit<ParsedTlsCertificate, "sha256Fingerprint"> {
  const certificate = parseAsn1Node(der, 0);
  if (
    certificate.tagClass !== 0 ||
    certificate.tag !== 16 ||
    certificate.children.length < 3
  ) {
    throw new Error("Invalid X.509 certificate structure");
  }

  const tbsCertificate = certificate.children[0];
  const signatureAlgorithmNode = certificate.children[1];

  let cursor = 0;
  let version = 1;

  if (
    tbsCertificate.children[cursor] &&
    tbsCertificate.children[cursor].tagClass === 2 &&
    tbsCertificate.children[cursor].tag === 0
  ) {
    const versionNode = tbsCertificate.children[cursor].children[0];
    const rawVersion = asn1Value(versionNode, der);
    version = (rawVersion.at(-1) ?? 0) + 1;
    cursor++;
  }

  const serialNode = tbsCertificate.children[cursor++];
  const _tbsSignatureNode = tbsCertificate.children[cursor++];
  const issuerNode = tbsCertificate.children[cursor++];
  const validityNode = tbsCertificate.children[cursor++];
  const subjectNode = tbsCertificate.children[cursor++];
  const subjectPublicKeyInfoNode = tbsCertificate.children[cursor++];

  if (
    !serialNode ||
    !issuerNode ||
    !validityNode ||
    !subjectNode ||
    !subjectPublicKeyInfoNode
  ) {
    throw new Error("Malformed certificate fields");
  }

  const serialNumber = formatSerial(asn1Value(serialNode, der));

  const signatureAlgorithmOidNode = signatureAlgorithmNode.children[0];
  const signatureAlgorithmOid = signatureAlgorithmOidNode
    ? parseOid(asn1Value(signatureAlgorithmOidNode, der))
    : "";

  const issuer = parseName(issuerNode, der);
  const subject = parseName(subjectNode, der);

  const notBefore = validityNode.children[0]
    ? parseTime(validityNode.children[0], der)
    : null;
  const notAfter = validityNode.children[1]
    ? parseTime(validityNode.children[1], der)
    : null;

  const spkiAlgorithm = subjectPublicKeyInfoNode.children[0];
  const spkiAlgNode = spkiAlgorithm?.children[0];
  const publicKeyAlgorithmOid = spkiAlgNode
    ? parseOid(asn1Value(spkiAlgNode, der))
    : "";

  const publicKeyBitString = subjectPublicKeyInfoNode.children[1];
  const publicKeyBitLength = publicKeyBitString
    ? publicKeyBits(
        publicKeyAlgorithmOid,
        spkiAlgorithm?.children[1],
        asn1Value(publicKeyBitString, der),
        der,
      )
    : null;

  const subjectAltNames = parseExtensions(tbsCertificate, der);

  return {
    pemLabel,
    version,
    serialNumber,
    signatureAlgorithmOid,
    signatureAlgorithm: algorithmNameForOid(signatureAlgorithmOid),
    issuer: issuer.text,
    issuerAttributes: issuer.attributes,
    subject: subject.text,
    subjectAttributes: subject.attributes,
    notBefore,
    notAfter,
    publicKeyAlgorithmOid,
    publicKeyAlgorithm: algorithmNameForOid(publicKeyAlgorithmOid),
    publicKeyBitLength,
    subjectAltNames,
    derLength: der.byteLength,
  };
}

// Extract PEM-encoded certificate blocks from input. Falls back to treating
// the entire input as raw base64 if no PEM headers are found.
function parsePemBlocks(
  input: string,
): Array<{ label: string; der: Uint8Array }> {
  const matches: Array<{ label: string; der: Uint8Array }> = [];
  const regex = /-----BEGIN ([A-Z0-9 ]+)-----([\s\S]+?)-----END \1-----/g;

  for (;;) {
    const match = regex.exec(input);
    if (!match) break;
    const label = match[1].trim();
    const body = match[2].replace(/\s+/g, "");
    if (!body) continue;
    if (!label.includes("CERTIFICATE")) continue;
    matches.push({ label, der: base64ToBytes(body) });
  }

  if (matches.length > 0) {
    return matches;
  }

  const compact = input.replace(/\s+/g, "");
  if (/^[A-Za-z0-9+/=]+$/.test(compact) && compact.length > 0) {
    return [{ label: "CERTIFICATE", der: base64ToBytes(compact) }];
  }

  throw new Error("No certificate PEM block found");
}

export async function inspectTlsCertificates(
  input: string,
): Promise<ParsedTlsCertificate[]> {
  if (!input.trim()) return [];

  const pemBlocks = parsePemBlocks(input);
  const certs: ParsedTlsCertificate[] = [];

  for (const block of pemBlocks) {
    const parsed = parseCertificateDer(block.der, block.label);
    const fingerprint = await sha256(block.der);
    certs.push({
      ...parsed,
      sha256Fingerprint: formatFingerprint(fingerprint),
    });
  }

  return certs;
}
