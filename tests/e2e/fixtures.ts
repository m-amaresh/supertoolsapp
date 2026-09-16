const TEST_CERTIFICATE = `-----BEGIN CERTIFICATE-----
MIIDFTCCAf2gAwIBAgIUeNC73z9u0sgi1sPhs1ptH6br35kwDQYJKoZIhvcNAQEL
BQAwGjEYMBYGA1UEAwwPc3VwZXJ0b29scy50ZXN0MB4XDTI2MDkwNDIxMzM1MVoX
DTI2MDkwNTIxMzM1MVowGjEYMBYGA1UEAwwPc3VwZXJ0b29scy50ZXN0MIIBIjAN
BgkqhkiG9w0BAQEFAAOCAQ8AMIIBCgKCAQEAtlOAyn+pQL+Rs2GvJEK3w6DXJLxb
/oPtbldiMuJfZzh0fTXcfMF90AGY9gXL55Wyj9KXEMgMaqih78YXxU9+x8JLLszN
89ETQSr2hTWUPiEPFudO1Tmc2WnMC6ArP1ruIf8SquYPAm5uIlZXT36cZO1IFH3c
TRzG49ExjWsE/4JRy5cJlfBulmLqSRczaCeeHQ6UYGZmALnuh9/UWpYd2UNODMF7
1LFGaNt8rhupc9PPEcPatn1XHsBimAngPG7PyhftKgpsN6x6nnW9c2F+L0Q4isuO
hATMm0km4cw9kfBrEc9XcutAvb3cxdHDl1Kb2y9pR5fnlt1fsIIhKrirLwIDAQAB
o1MwUTAdBgNVHQ4EFgQUwPX7THxRcRoBj3Js9VA9LaYyI1cwHwYDVR0jBBgwFoAU
wPX7THxRcRoBj3Js9VA9LaYyI1cwDwYDVR0TAQH/BAUwAwEB/zANBgkqhkiG9w0B
AQsFAAOCAQEAOOds2FZEFZUiJrG06IEukG5wm0axexVcDyeE/84USxqDZMBIC7Vc
sOYfbZqgOXcZEZG3r2pnK2MK6+ly5XUkglq5P6isguL6GnXMSZs5qmYu/z5bAAkD
vnO+gAMih3XR78HuWVfWo8y1KXdt+zxwQdu976DYvN6i74mRlYrSyOaNPRwz1I9s
XpXizhAOTkHnVMJbjkBfK/a8qBKfq11+Su74F8HIAOD5Bm6Hg2klkMXntyY6Hrkk
f+rATDQMIBJI+T5jZzm/nC2OIX37J/wbF9Bt1YTCv6sNLwDsaKyLImmg9xtfzk41
1/1JXowLAsNcFo+j6PQjTinGh2llOf7q5A==
-----END CERTIFICATE-----`;

/**
 * Input that drives each tool to a real result.
 *
 * The original guard only ever loaded pristine routes, which is why it stayed
 * green through a duplicated Copy button, a 26px-wide Color field and missing
 * focus movement — every one of those defects only exists once a tool has
 * output. Anything asserting on results has to fill the tool first.
 */
export interface ToolFixture {
  /** Route under test. */
  route: string;
  /** Text typed into the tool's first input to produce a result. */
  fill?: string;
  /** A second, *different* value producing a same-shaped result. */
  refill?: string;
  /** Selector to type into, when the first textarea is not the right target. */
  selector?: string;
  /** Manual tools: accessible name of the button that computes. */
  action?: string;
  /** Fields that must be set before `fill` produces anything. */
  prefill?: { selector: string; value: string }[];
  /**
   * Why this tool is not driven to a result here. Anything listed must have a
   * dedicated test instead — a fixture that silently does nothing is how the
   * RSA focus defect passed a green suite.
   */
  cannotDrive?: string;
}

export const TOOL_FIXTURES: ToolFixture[] = [
  { route: "/tools/data/baseconv", fill: "42", refill: "43" },
  { route: "/tools/data/color", fill: "#ff6600", refill: "#ff6601" },
  { route: "/tools/data/csv", fill: "a,b\n1,2", refill: "a,b\n1,3" },
  { route: "/tools/data/json", fill: '{"a":1}', refill: '{"a":2}' },
  { route: "/tools/data/yaml", fill: '{"a":1}', refill: '{"a":2}' },
  { route: "/tools/encode/base32", fill: "abc", refill: "abd" },
  { route: "/tools/encode/base58", fill: "abc", refill: "abd" },
  { route: "/tools/encode/base64", fill: "abc", refill: "abd" },
  { route: "/tools/encode/crc32", fill: "abc", refill: "abd" },
  { route: "/tools/encode/escape", fill: "<b>", refill: "<i>" },
  { route: "/tools/encode/hash", fill: "abc", refill: "abd" },
  { route: "/tools/encode/hex", fill: "abc", refill: "abd" },
  {
    route: "/tools/encode/jwt",
    fill: "eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJzdWIiOiIxIn0.sig",
    refill: "eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJzdWIiOiIyIn0.sig",
  },
  { route: "/tools/encode/url", fill: "a b", refill: "a c" },
  {
    route: "/tools/encode/url-parser",
    selector: "#url-parser-input",
    fill: "https://x.com/a?b=1",
    refill: "https://y.com/a?b=1",
  },
  { route: "/tools/ids/qrcode", fill: "abc", refill: "abd" },
  { route: "/tools/ids/uuid", action: "Generate" },
  { route: "/tools/ids/password", action: "Generate" },
  { route: "/tools/text/lorem", action: "Generate" },
  { route: "/tools/text/case", fill: "hello", refill: "world" },
  {
    // A pattern must exist before a test string can produce a result.
    route: "/tools/text/regex",
    selector: "#regex-test-string",
    prefill: [{ selector: "#regex-pattern", value: "l+" }],
    fill: "hello",
    refill: "hellllo",
  },
  { route: "/tools/network/cidr", fill: "10.0.0.0/24", refill: "10.0.1.0/24" },
  { route: "/tools/time/cron", fill: "* * * * *", refill: "0 * * * *" },
  { route: "/tools/time/timestamp", fill: "1704067200", refill: "1704067201" },

  // Manual tools. These were missing entirely, which is why an RSA focus
  // defect survived a green run.
  {
    route: "/tools/encode/aes",
    prefill: [{ selector: "#aes-passphrase", value: "correct horse battery" }],
    selector: "#aes-input",
    fill: "hello world",
    action: "Encrypt",
  },
  {
    route: "/tools/encode/rsa",
    cannotDrive:
      "signing needs a real PKCS#8 private key; driven with a generated key in rsa-focus.test.ts",
  },
  {
    route: "/tools/encode/tls-cert",
    selector: "#tls-cert-input",
    // A throwaway self-signed certificate. A malformed blob only reaches the
    // error path, which would not exercise the result region at all.
    fill: TEST_CERTIFICATE,
    action: "Analyze",
  },
  {
    route: "/tools/text/diff",
    fill: "alpha\nbravo",
    action: "Compare",
  },
  {
    route: "/tools/pdf/unlock",
    cannotDrive:
      "needs a real encrypted PDF and a Web Worker; the attempt lifecycle is covered by pdf-lifecycle.test.ts instead",
  },
  {
    route: "/tools/pdf/encrypt",
    cannotDrive:
      "needs a real PDF set on a file input and a Web Worker; the qpdf argument contract is driven against the real engine in pdf-encrypt-engine.test.ts instead",
  },
  {
    route: "/tools/pdf/merge",
    cannotDrive:
      "needs several real PDFs set on a file input, which this fixture cannot do; driven to a real result in pdf-merge.test.ts instead",
  },
  {
    route: "/tools/pdf/split",
    cannotDrive:
      "needs a real PDF set on a file input and a Web Worker; driven to a real result, and to a real ZIP, in pdf-split.test.ts instead",
  },
];
