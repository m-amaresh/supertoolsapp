export interface ToolSeoFaqItem {
  question: string;
  answer: string;
}

export interface ToolSeoFaqSection {
  title: string;
  about: string;
  howToUse: string[];
  items: ToolSeoFaqItem[];
}

export const TOOL_INTENT_KEYWORDS: Record<string, string[]> = {
  "/tools/ids/uuid": [
    "uuid generator",
    "uuid v4 generator",
    "generate uuid",
    "uuid online",
  ],
  "/tools/ids/password": [
    "password generator",
    "strong password generator",
    "secure password",
    "random password",
  ],
  "/tools/encode/base64": [
    "base64 encode",
    "base64 decode",
    "base64 encoder",
    "base64 decoder",
  ],
  "/tools/encode/base32": [
    "base32 encode",
    "base32 decode",
    "base32 encoder",
    "base32 decoder",
  ],
  "/tools/encode/hex": [
    "hex encoder",
    "hex decoder",
    "text to hex",
    "hex to text",
  ],
  "/tools/data/json": [
    "json formatter",
    "json beautifier",
    "json minify",
    "json validator",
  ],
  "/tools/text/diff": [
    "text diff",
    "compare text",
    "diff checker",
    "line by line diff",
  ],
  "/tools/time/timestamp": [
    "timestamp converter",
    "unix timestamp converter",
    "epoch converter",
    "unix to date",
  ],
  "/tools/encode/hash": [
    "hash generator",
    "sha256 generator",
    "md5 hash",
    "hmac generator",
  ],
  "/tools/encode/crc32": [
    "crc32",
    "crc32 checksum",
    "crc32 generator",
    "file checksum",
  ],
  "/tools/encode/aes": [
    "aes gcm",
    "aes encrypt",
    "aes decrypt",
    "encrypt text online",
  ],
  "/tools/encode/rsa": [
    "rsa sign",
    "rsa verify",
    "rsa signature",
    "pem key verify",
  ],
  "/tools/encode/url": [
    "url encoder",
    "url decoder",
    "encode url",
    "decode url",
  ],
  "/tools/text/case": [
    "case converter",
    "camelcase converter",
    "snake case converter",
    "kebab case converter",
  ],
  "/tools/text/regex": [
    "regex tester",
    "regular expression tester",
    "regex checker",
    "regex playground",
  ],
  "/tools/text/lorem": [
    "lorem ipsum generator",
    "placeholder text generator",
    "dummy text",
    "lorem generator",
  ],
  "/tools/data/baseconv": [
    "number base converter",
    "binary to decimal",
    "decimal to hex",
    "base conversion",
  ],
  "/tools/encode/jwt": [
    "jwt decoder",
    "decode jwt",
    "jwt payload decoder",
    "jwt token inspector",
  ],
  "/tools/encode/escape": [
    "string escape",
    "html escape",
    "json escape",
    "regex escape",
  ],
  "/tools/data/color": [
    "color converter",
    "hex to rgb",
    "rgb to hsl",
    "color palette generator",
  ],
  "/tools/data/yaml": [
    "yaml converter",
    "yaml to json",
    "json to yaml",
    "yaml validator",
  ],
  "/tools/time/cron": [
    "cron parser",
    "cron expression parser",
    "cron builder",
    "cron next run",
  ],
  "/tools/data/csv": [
    "csv to json",
    "json to csv",
    "tsv to json",
    "json to tsv",
  ],
  "/tools/encode/url-parser": [
    "url parser",
    "query parameter builder",
    "url query editor",
    "parse url",
  ],
  "/tools/encode/base58": [
    "base58 encode",
    "base58 decode",
    "base58check",
    "bitcoin base58",
  ],
  "/tools/encode/tls-cert": [
    "tls certificate viewer",
    "x509 parser",
    "pem certificate inspector",
    "certificate fingerprint",
  ],
  "/tools/network/cidr": [
    "cidr calculator",
    "subnet calculator",
    "ipv4 subnet",
    "ipv6 subnet",
    "ip range calculator",
    "wildcard mask",
  ],
  "/tools/ids/qrcode": [
    "qr code generator",
    "qr generator",
    "create qr code",
    "qr code maker",
    "url qr code",
    "wifi qr code",
  ],
  "/tools/pdf/unlock": [
    "remove pdf password",
    "unlock pdf",
    "pdf password remover",
    "decrypt pdf online",
    "remove pdf restrictions",
    "pdf unlocker no upload",
  ],
};

export const TOOL_FAQ_BY_PATH: Record<string, ToolSeoFaqSection> = {
  "/tools/ids/uuid": {
    title: "UUID Generator FAQ",
    about:
      "Generate universally unique identifiers (UUIDs) directly in your browser using cryptographically secure randomness. UUID v4 values are produced via the Web Crypto API, ensuring high entropy without relying on any server. UUIDs are essential for distributed systems, database primary keys, session tokens, and message correlation where globally unique identifiers are needed without central coordination. This tool lets you generate single or bulk UUIDs instantly, copy them to your clipboard, and choose formatting options such as uppercase or braces. Because everything runs client-side, your generated IDs never leave your device.",
    howToUse: [
      "Open the UUID Generator tool and click Generate to create a new UUID v4.",
      "Adjust the quantity to generate multiple UUIDs in bulk.",
      "Toggle formatting options like uppercase or braces to match your project conventions.",
      "Click the copy button to copy the generated UUIDs to your clipboard.",
    ],
    items: [
      {
        question: "Which UUID version does this tool generate?",
        answer:
          "It generates UUID v4 values using the browser Web Crypto API for cryptographic randomness.",
      },
      {
        question: "Can I generate multiple UUIDs at once?",
        answer:
          "Yes, you can set a quantity and generate UUIDs in bulk, then copy the entire list.",
      },
      {
        question: "Are the generated UUIDs truly unique?",
        answer:
          "UUID v4 has 122 random bits, making the probability of a collision astronomically low — far less than one in a billion even at massive scale.",
      },
      {
        question: "What are UUIDs commonly used for?",
        answer:
          "UUIDs are used as database primary keys, distributed system identifiers, session tokens, API request IDs, and anywhere a globally unique value is needed without a central authority.",
      },
      {
        question: "Is any data sent to a server?",
        answer:
          "No. UUID generation happens entirely in your browser using the Web Crypto API. Nothing is transmitted over the network.",
      },
      {
        question: "How do I generate multiple UUIDs at once?",
        answer:
          "Set the desired count and generate a batch of unique identifiers instantly. Every value uses the Web Crypto API, so bulk generation stays cryptographically secure and fully client-side.",
      },
      {
        question: "Are these UUIDs RFC 4122 compliant?",
        answer:
          "Yes. The generated version 4 UUIDs follow the RFC 4122 layout, including the correct version and variant bits, so they are valid wherever standards-compliant UUIDs are expected.",
      },
    ],
  },
  "/tools/ids/password": {
    title: "Password Generator FAQ",
    about:
      "Create strong, random passwords using cryptographically secure browser APIs. This password generator lets you control length, character sets, and exclusion rules to produce passwords that meet virtually any security policy. Passwords are generated locally using the Web Crypto API — they are never sent to a server or stored anywhere. Strong passwords are your first line of defence against credential stuffing, brute-force attacks, and dictionary attacks. Use this tool to generate passwords for accounts, API keys, encryption passphrases, and any context where randomness and length matter.",
    howToUse: [
      "Open the Password Generator and set your desired password length.",
      "Choose which character sets to include: uppercase, lowercase, digits, and symbols.",
      "Optionally exclude ambiguous characters like 0, O, l, and 1 for readability.",
      "Click Generate to create a new password, then copy it to your clipboard.",
    ],
    items: [
      {
        question: "Are generated passwords secure?",
        answer:
          "Yes. Passwords are generated using the Web Crypto API, which provides cryptographically secure random values directly in your browser.",
      },
      {
        question: "Can I exclude specific characters?",
        answer:
          "Yes, you can toggle character sets on or off and exclude ambiguous characters like 0, O, l, and 1.",
      },
      {
        question: "What password length should I use?",
        answer:
          "For most accounts, 16 characters or more is recommended. For encryption passphrases or high-security contexts, 20 or more characters with all character sets enabled provides very strong entropy.",
      },
      {
        question: "Is my generated password stored anywhere?",
        answer:
          "No. The password exists only in your browser tab. It is not saved, logged, or transmitted to any server.",
      },
      {
        question: "Can I use this for generating API keys or tokens?",
        answer:
          "Yes. The output is cryptographically random and suitable for API keys, tokens, secrets, and other security-sensitive values.",
      },
    ],
  },
  "/tools/encode/base64": {
    title: "Base64 Encoder/Decoder FAQ",
    about:
      "Encode text or binary data to Base64 and decode Base64 strings back to their original form, entirely in your browser. Base64 is a binary-to-text encoding scheme that represents binary data using a set of 64 ASCII characters, making it safe for transport in text-based systems like email, JSON, HTML, and URLs. This tool supports standard Base64 and the URL-safe Base64 variant (Base64url), and can handle both text input and file uploads. All encoding and decoding runs client-side — your data never leaves your device.",
    howToUse: [
      "Paste your text or upload a file in the input area.",
      "Select Encode to convert to Base64, or Decode to convert Base64 back to the original.",
      "Choose between standard Base64 and Base64url format if needed.",
      "Copy the result from the output area using the copy button.",
    ],
    items: [
      {
        question: "What is Base64 used for?",
        answer:
          "Base64 converts binary or text data into ASCII-safe output for transport and storage in text-based systems like JSON payloads, email attachments (MIME), data URIs in HTML/CSS, and HTTP headers.",
      },
      {
        question: "Is Base64 encryption?",
        answer:
          "No. Base64 is an encoding scheme, not encryption. Anyone can decode a Base64 string without a key. It is used for safe transport of data, not for securing it.",
      },
      {
        question: "What is the difference between Base64 and Base64url?",
        answer:
          "Base64url replaces + with - and / with _ to make the output safe for URLs and filenames. It also typically omits padding characters (=).",
      },
      {
        question: "Can I encode files with this tool?",
        answer:
          "Yes, you can upload a file and the tool will encode its binary content to Base64. This is useful for embedding images or other assets as data URIs.",
      },
      {
        question: "Why does Base64 increase the size of data?",
        answer:
          "Base64 represents every 3 bytes of input as 4 ASCII characters, resulting in roughly a 33% size increase. This trade-off provides text-safe representation of binary data.",
      },
      {
        question: "How do I decode Base64 to text online?",
        answer:
          "Paste your Base64 string into the input and switch to Decode mode. The tool instantly converts it back to the original text or binary data, with no upload to any server.",
      },
      {
        question: "Is this Base64 encoder safe for sensitive data?",
        answer:
          "Yes. Encoding and decoding run entirely in your browser using native JavaScript, so your data is never sent over the network — safe for tokens, credentials, and other sensitive payloads.",
      },
    ],
  },
  "/tools/encode/base32": {
    title: "Base32 Encoder/Decoder FAQ",
    about:
      "Encode and decode data using Base32, a binary-to-text encoding that uses a 32-character alphabet (A-Z and 2-7). Base32 is widely used for TOTP/HOTP secrets in two-factor authentication, DNS labels, and any context where case-insensitive, human-readable encoding is needed. Unlike Base64, Base32 avoids characters that can be confused in certain fonts or input methods. This tool supports both padded and unpadded output, uppercase and lowercase modes, and runs entirely in your browser with no server-side processing.",
    howToUse: [
      "Enter text in the input field or paste a Base32-encoded string.",
      "Select Encode or Decode to perform the conversion.",
      "Toggle padding and case options to match your requirements.",
      "Copy the output using the copy button.",
    ],
    items: [
      {
        question: "When should I use Base32 instead of Base64?",
        answer:
          "Base32 is ideal for case-insensitive systems, manual human entry, and contexts like OTP secrets where avoiding ambiguous characters matters. Base64 is more space-efficient when those constraints do not apply.",
      },
      {
        question: "Does this support padded and lowercase output?",
        answer:
          "Yes. You can output padded or unpadded Base32 and choose between uppercase (standard) and lowercase formats.",
      },
      {
        question: "What is Base32 commonly used for?",
        answer:
          "Base32 is used for TOTP/HOTP secret keys in authenticator apps, Crockford encoding, DNS labels, file names on case-insensitive file systems, and encoded tokens where readability matters.",
      },
      {
        question: "How does Base32 differ from Base32hex?",
        answer:
          "Standard Base32 uses A-Z and 2-7. Base32hex uses 0-9 and A-V, which preserves sort order of the encoded data — useful for database indexing.",
      },
      {
        question: "Is my data sent to a server?",
        answer:
          "No. All encoding and decoding happens locally in your browser. Your data stays on your device.",
      },
    ],
  },
  "/tools/encode/hex": {
    title: "Hex Encoder/Decoder FAQ",
    about:
      "Convert text to hexadecimal representation and decode hex strings back to readable text. Hexadecimal encoding expresses each byte as two characters (0-9, a-f), making it a standard format for displaying binary data, hash digests, memory addresses, colour codes, and network packet dumps. Developers frequently use hex encoding when debugging binary protocols, inspecting file headers, or working with cryptographic output. This tool handles UTF-8 text-to-hex conversion and hex-to-text decoding entirely in the browser.",
    howToUse: [
      "Paste text to encode it as hexadecimal, or paste a hex string to decode it.",
      "Select the Encode or Decode direction.",
      "Choose separator options like spaces or colons between hex bytes for readability.",
      "Copy the result using the copy button.",
    ],
    items: [
      {
        question: "Can I convert text to hexadecimal and back?",
        answer:
          "Yes. The tool encodes text as hex bytes and decodes valid hex strings back to readable text.",
      },
      {
        question: "Which text encodings are supported?",
        answer:
          "The tool encodes text as UTF-8 bytes. Input hex strings are decoded back to UTF-8 text.",
      },
      {
        question: "What are common uses for hex encoding?",
        answer:
          "Hex is used to display hash digests (SHA-256, MD5), inspect binary file headers, represent colour codes (#FF5733), debug network packets, and view memory dumps.",
      },
      {
        question: "Can I use separators between hex bytes?",
        answer:
          "Yes. You can choose separators like spaces, colons, or no separator to format the hex output for different contexts.",
      },
      {
        question: "Is hex encoding the same as encryption?",
        answer:
          "No. Hex encoding is a reversible representation of bytes, not a security measure. Anyone can decode hex without a key.",
      },
    ],
  },
  "/tools/data/json": {
    title: "JSON Formatter FAQ",
    about:
      "Format, validate, and minify JSON data instantly in your browser. JSON (JavaScript Object Notation) is the most widely used data interchange format in modern APIs, configuration files, and databases. This formatter helps developers quickly beautify minified JSON for readability, validate JSON syntax to catch errors before deployment, and minify formatted JSON to reduce payload size. You can control indentation depth and optionally sort object keys for consistent output. All processing runs locally — your JSON payloads, API responses, and configuration data are never transmitted to a server.",
    howToUse: [
      "Paste your JSON into the input area.",
      "Click Format to beautify the JSON with proper indentation, or Minify to compress it.",
      "Optionally enable Sort Keys to alphabetically order object keys.",
      "Adjust the indentation level (2 or 4 spaces) to match your project style.",
      "Copy the formatted result using the copy button.",
    ],
    items: [
      {
        question: "How do I format JSON online?",
        answer:
          "Paste your JSON into the input area and click Format. The tool instantly beautifies it with proper indentation. You can choose 2-space or 4-space indentation and sort keys alphabetically.",
      },
      {
        question: "Will invalid JSON be detected?",
        answer:
          "Yes. The formatter validates your input and displays specific error messages with location details so you can find and fix syntax issues quickly.",
      },
      {
        question: "Can I minify JSON to reduce file size?",
        answer:
          "Yes. Click Minify to strip all whitespace and produce the most compact valid JSON. This is useful for reducing API payload sizes and config file footprints.",
      },
      {
        question: "Does sorting keys change the data?",
        answer:
          "No. Sorting keys reorders object properties alphabetically but preserves all values. This is useful for creating deterministic output for diffs, hashing, or version control.",
      },
      {
        question: "Is my JSON data sent to a server?",
        answer:
          "No. All formatting, validation, and minification happens locally in your browser. Your data never leaves your device.",
      },
    ],
  },
  "/tools/text/diff": {
    title: "Text Diff FAQ",
    about:
      "Compare two blocks of text side by side and see exactly what changed between them. This diff tool highlights added, removed, and unchanged lines using a clear colour-coded display. It is useful for reviewing configuration changes, comparing API responses, checking code edits, verifying migration output, and any scenario where you need to spot differences between two versions of text. Options to ignore whitespace and case let you focus on meaningful changes. All comparison runs locally in your browser — nothing is uploaded.",
    howToUse: [
      "Paste the original text in the left input area and the modified text in the right area.",
      "Click Compare to generate the diff.",
      "Review the highlighted output — green lines are additions, red lines are removals.",
      "Toggle options to ignore whitespace or case differences if needed.",
    ],
    items: [
      {
        question: "How is the diff calculated?",
        answer:
          "The tool compares text line-by-line using a standard diff algorithm and marks each line as added, removed, or unchanged with colour coding.",
      },
      {
        question: "Can I ignore whitespace or case?",
        answer:
          "Yes. Options are available to ignore whitespace, case, and leading/trailing differences so you can focus on meaningful content changes.",
      },
      {
        question: "What types of text can I compare?",
        answer:
          "Any plain text — code, configuration files, API responses, CSV data, log output, documentation, and more. The tool works with any text content.",
      },
      {
        question: "Is there a size limit?",
        answer:
          "The tool handles texts of several thousand lines comfortably. Very large inputs may slow down the browser since diffing runs client-side.",
      },
      {
        question: "Is my text uploaded to a server?",
        answer:
          "No. The entire comparison runs in your browser. Neither the original nor modified text is transmitted anywhere.",
      },
    ],
  },
  "/tools/time/timestamp": {
    title: "Timestamp Converter FAQ",
    about:
      'Convert between Unix timestamps and human-readable dates instantly. Unix timestamps count the seconds (or milliseconds) since January 1, 1970 (the Unix epoch) and are the standard time representation in APIs, databases, log files, and system events. This converter lets you paste a Unix timestamp and see it as ISO 8601, UTC, local time, and relative time (e.g. "3 hours ago"), or enter a date and get the corresponding Unix seconds and milliseconds. Everything runs in your browser — no server calls are made.',
    howToUse: [
      "Enter a Unix timestamp (seconds or milliseconds) to convert it to human-readable date formats.",
      "Or enter a date string to convert it to Unix seconds and milliseconds.",
      "View the result in ISO 8601, UTC, local time, and relative formats.",
      "Copy any output value using the copy button.",
    ],
    items: [
      {
        question: "Can I convert Unix timestamps to human-readable dates?",
        answer:
          "Yes. Enter Unix seconds or milliseconds and the tool instantly shows ISO 8601, UTC, local, and relative time formats.",
      },
      {
        question: "Can I convert dates back to Unix time?",
        answer:
          "Yes. Enter a date string and the tool outputs the corresponding Unix timestamp in both seconds and milliseconds.",
      },
      {
        question: "Does it handle millisecond timestamps?",
        answer:
          "Yes. The tool auto-detects whether your input is in seconds or milliseconds based on its magnitude and converts accordingly.",
      },
      {
        question: "What is the Unix epoch?",
        answer:
          "The Unix epoch is January 1, 1970 00:00:00 UTC. Unix timestamps count the number of seconds elapsed since this reference point.",
      },
      {
        question: "Which timezone is used for local time display?",
        answer:
          "Local time uses your browser's timezone setting. UTC output is always shown alongside for unambiguous reference.",
      },
    ],
  },
  "/tools/encode/hash": {
    title: "Hash Generator FAQ",
    about:
      "Generate cryptographic hash digests and HMAC values for text input using industry-standard algorithms. Hashing is a one-way function that produces a fixed-size fingerprint of any input data, used for integrity verification, password storage, digital signatures, and data deduplication. This tool supports MD5, SHA-1, SHA-256, SHA-384, SHA-512, SHA3-256, SHA3-512, and HMAC variants with a secret key. All hashing runs locally in your browser using the audited @noble/hashes library — your data and keys are never sent to a server.",
    howToUse: [
      "Enter or paste text into the input field.",
      "Select a hash algorithm from the dropdown (SHA-256, MD5, SHA-512, etc.).",
      "For HMAC, enable the HMAC option and enter your secret key.",
      "View the hash digest in the output area and copy it with the copy button.",
    ],
    items: [
      {
        question: "Which hash algorithm should I use for security?",
        answer:
          "Use SHA-256 or stronger (SHA-384, SHA-512, SHA3) for new systems. MD5 and SHA-1 are provided for legacy compatibility but are considered weak against collision attacks.",
      },
      {
        question: "What is HMAC?",
        answer:
          "HMAC (Hash-based Message Authentication Code) is a keyed hash that provides both integrity and authenticity verification. Both sender and receiver must share the same secret key.",
      },
      {
        question: "Can I hash files?",
        answer:
          "The tool accepts text input for hashing. For file hashing, paste the file contents as text or use the CRC32 tool which supports file uploads.",
      },
      {
        question: "Is MD5 still safe to use?",
        answer:
          "MD5 is not collision-resistant and should not be used for security-sensitive purposes. It is acceptable for non-security checksums and legacy system compatibility.",
      },
      {
        question: "Is my data sent to a server during hashing?",
        answer:
          "No. All hash computations run locally in your browser using the @noble/hashes library. Your input text and HMAC keys remain on your device.",
      },
      {
        question: "How do I generate a SHA-256 hash online?",
        answer:
          "Select SHA-256 from the algorithm list and type or paste your text. The hash is computed instantly in your browser as you type — no upload required. SHA-1, SHA-384, SHA-512, SHA3, and MD5 are also supported.",
      },
      {
        question: "How do I create an HMAC?",
        answer:
          "Choose an HMAC algorithm (for example HMAC-SHA256), enter your secret key, and provide the message. The tool produces the keyed hash locally, which is useful for verifying webhook signatures and API request authenticity.",
      },
    ],
  },
  "/tools/encode/crc32": {
    title: "CRC32 FAQ",
    about:
      "Calculate CRC32 checksums for text and files directly in your browser. CRC32 (Cyclic Redundancy Check) is a fast, widely-used error-detection algorithm that produces a 32-bit checksum. It is used in file formats like ZIP and PNG, network protocols like Ethernet, storage systems, and data transfer pipelines to verify data integrity. While CRC32 is not cryptographically secure, it is extremely fast and effective at catching accidental data corruption. This tool computes CRC32 for text input and file uploads entirely client-side.",
    howToUse: [
      "Enter text or upload a file to calculate its CRC32 checksum.",
      "The checksum is computed instantly and displayed as a hexadecimal value.",
      "Copy the checksum using the copy button.",
      "Compare checksums to verify file or data integrity across transfers.",
    ],
    items: [
      {
        question: "Is CRC32 cryptographically secure?",
        answer:
          "No. CRC32 is designed for error detection, not security. It can catch accidental data corruption but should not be used for tamper detection or authentication.",
      },
      {
        question: "Can I checksum files with CRC32?",
        answer:
          "Yes. The tool supports both text input and file uploads for CRC32 calculation.",
      },
      {
        question: "Where is CRC32 commonly used?",
        answer:
          "CRC32 is used in ZIP archives, PNG images, Ethernet frame checks, GZIP compression, and many storage and network protocols for integrity verification.",
      },
      {
        question: "How long is a CRC32 checksum?",
        answer:
          "CRC32 produces a 32-bit (4-byte) value, typically displayed as an 8-character hexadecimal string.",
      },
      {
        question: "Is my file uploaded to a server?",
        answer:
          "No. Files are read and checksummed entirely in your browser. No data leaves your device.",
      },
    ],
  },
  "/tools/encode/aes": {
    title: "AES-GCM FAQ",
    about:
      "Encrypt and decrypt text and files using AES-256-GCM, a modern authenticated encryption standard, directly in your browser. AES-GCM provides both confidentiality and integrity protection, ensuring data cannot be read or tampered with without the correct key. This tool derives the encryption key from your passphrase using PBKDF2-SHA256 with a random salt and IV, following security best practices. Everything runs locally via the Web Crypto API — your plaintext, ciphertext, and passphrase are never transmitted to any server.",
    howToUse: [
      "Enter or paste the text you want to encrypt in the input field.",
      "Enter a strong passphrase that will be used to derive the encryption key.",
      "Click Encrypt to produce the ciphertext, or paste ciphertext and click Decrypt.",
      "Copy the output using the copy button.",
    ],
    items: [
      {
        question: "Which AES mode is used?",
        answer:
          "The tool uses AES-256-GCM, an authenticated encryption mode that provides both confidentiality and integrity. The key is derived from your passphrase using PBKDF2-SHA256.",
      },
      {
        question: "Does encryption happen in the browser?",
        answer:
          "Yes. All encryption and decryption operations run locally using the Web Crypto API. Your data and passphrase never leave your device.",
      },
      {
        question: "What makes AES-GCM better than AES-CBC?",
        answer:
          "AES-GCM is an authenticated encryption mode that detects tampering automatically. AES-CBC requires a separate MAC for integrity, and is more vulnerable to padding oracle attacks.",
      },
      {
        question: "How is the encryption key derived from my passphrase?",
        answer:
          "The tool uses PBKDF2 with SHA-256 and a random salt to derive a 256-bit AES key from your passphrase. A fresh random IV is generated for each encryption operation.",
      },
      {
        question: "Can I encrypt files?",
        answer:
          "Yes. The tool supports encrypting and decrypting both text input and file uploads using AES-256-GCM.",
      },
    ],
  },
  "/tools/encode/rsa": {
    title: "RSA Sign/Verify FAQ",
    about:
      "Sign messages with an RSA private key and verify signatures with the corresponding public key, all in your browser. RSA digital signatures provide authentication and non-repudiation — proving that a message was created by the holder of a specific private key and was not altered in transit. This tool accepts PEM-encoded keys (PKCS#8 for private, SPKI for public) and uses the Web Crypto API for all operations. Your private keys and messages never leave your device.",
    howToUse: [
      "Paste your PEM-encoded private key to sign, or public key to verify.",
      "Enter the message you want to sign or verify.",
      "Click Sign to generate a signature, or paste a signature and click Verify.",
      "Copy the signature output using the copy button.",
    ],
    items: [
      {
        question: "Which key formats are supported?",
        answer:
          "Private keys should be in PKCS#8 PEM format and public keys in SPKI PEM format. These are the standard formats used by OpenSSL and most cryptographic libraries.",
      },
      {
        question: "Can this encrypt data with RSA?",
        answer:
          "No. This tool focuses specifically on RSA digital signatures (sign and verify). For encryption, use the AES-GCM tool.",
      },
      {
        question: "Which signature algorithm is used?",
        answer:
          "The tool uses RSASSA-PKCS1-v1_5 with SHA-256 via the Web Crypto API, which is widely compatible with most systems.",
      },
      {
        question: "Is my private key sent to a server?",
        answer:
          "No. All signing and verification happens locally in your browser via the Web Crypto API. Your private key never leaves your device.",
      },
      {
        question: "What are RSA signatures used for?",
        answer:
          "RSA signatures verify document authenticity, authenticate API requests, sign software releases and packages, validate JWT tokens, and prove message origin in secure communications.",
      },
    ],
  },
  "/tools/encode/url": {
    title: "URL Encoder/Decoder FAQ",
    about:
      "Encode and decode URL components using percent-encoding, the standard mechanism for representing special characters in URLs. When building API requests, form submissions, query strings, or redirect URLs, special characters like spaces, ampersands, and equals signs must be percent-encoded to be transmitted correctly. This tool supports both full URI encoding (preserving URL structure) and component encoding (encoding all reserved characters). All encoding and decoding runs locally in your browser.",
    howToUse: [
      "Paste text containing special characters to encode it for use in URLs.",
      "Or paste a percent-encoded string to decode it back to readable text.",
      "Choose between full URI mode and component mode based on your needs.",
      "Copy the result using the copy button.",
    ],
    items: [
      {
        question: "What is the difference between full URI and component mode?",
        answer:
          "Full URI mode preserves URL structure characters like /, ?, and #. Component mode encodes all reserved characters, which is what you need for individual query parameter values.",
      },
      {
        question: "Can I decode percent-encoded strings?",
        answer:
          "Yes. Switch to decode mode and paste a percent-encoded string to convert it back to readable text.",
      },
      {
        question: "When do I need URL encoding?",
        answer:
          "URL encoding is required when including special characters in query strings, form data, redirect URLs, API parameters, and any context where characters like &, =, spaces, or unicode must be safely embedded in a URL.",
      },
      {
        question: "What is percent-encoding?",
        answer:
          "Percent-encoding represents a byte as a % followed by two hex digits. For example, a space becomes %20, and an ampersand becomes %26.",
      },
      {
        question: "Is my data sent to a server?",
        answer:
          "No. All encoding and decoding runs locally in your browser using standard JavaScript APIs.",
      },
    ],
  },
  "/tools/text/case": {
    title: "Case Converter FAQ",
    about:
      "Convert text between common naming conventions used in programming, writing, and data processing. This tool transforms text into camelCase, PascalCase, snake_case, kebab-case, CONSTANT_CASE, Title Case, Sentence case, and more with a single click. Case conversion is a routine task when adapting variable names between languages, formatting API field names, preparing database column names, or normalizing text for display. All conversion runs locally in your browser.",
    howToUse: [
      "Paste or type text into the input area.",
      "Select the target case format from the available options.",
      "View all converted outputs simultaneously.",
      "Copy any output variant using the copy button next to it.",
    ],
    items: [
      {
        question: "Which text cases are supported?",
        answer:
          "The tool supports camelCase, PascalCase, snake_case, kebab-case, CONSTANT_CASE, Title Case, Sentence case, dot.case, path/case, and more.",
      },
      {
        question: "Can I convert multiple lines at once?",
        answer:
          "Yes. Multi-line input is converted line by line, preserving line breaks.",
      },
      {
        question: "How does the tool detect word boundaries?",
        answer:
          "The tool splits on spaces, underscores, hyphens, dots, slashes, and camelCase boundaries to identify individual words before re-joining in the target format.",
      },
      {
        question: "What is the difference between camelCase and PascalCase?",
        answer:
          "camelCase starts with a lowercase letter (myVariableName), while PascalCase starts with an uppercase letter (MyVariableName). Both capitalise subsequent words.",
      },
      {
        question: "When should I use snake_case vs kebab-case?",
        answer:
          "snake_case is common in Python, Ruby, SQL, and environment variables. kebab-case is common in URLs, CSS class names, CLI flags, and file names.",
      },
    ],
  },
  "/tools/text/regex": {
    title: "Regex Tester FAQ",
    about:
      "Test and debug regular expressions with live matching, capture group highlighting, and flag support. Regular expressions are a powerful pattern-matching language used for text search, validation, extraction, and replacement in virtually every programming language. This tester uses the browser JavaScript RegExp engine, giving you accurate results for patterns you will use in frontend and Node.js code. Matches are highlighted in real time as you type, and capture groups are displayed in a structured table. The regex runs in a Web Worker to avoid blocking the page on complex patterns.",
    howToUse: [
      "Enter your regular expression pattern in the pattern field.",
      "Set flags (g, i, m, s, u) using the flag toggles.",
      "Type or paste test text in the input area.",
      "View highlighted matches and capture group details in real time.",
    ],
    items: [
      {
        question: "Which regex engine is used?",
        answer:
          "The tool uses the browser JavaScript RegExp engine, so pattern behaviour matches what you get in frontend JavaScript and Node.js.",
      },
      {
        question: "Can I test capture groups and flags?",
        answer:
          "Yes. The tester displays all capture groups (numbered and named) in a structured table and supports standard flags: global (g), case-insensitive (i), multiline (m), dotAll (s), and unicode (u).",
      },
      {
        question: "Will complex patterns freeze the page?",
        answer:
          "No. Regex execution runs in a Web Worker, so even complex or pathological patterns will not block the UI. Execution is automatically terminated if it exceeds time limits.",
      },
      {
        question: "Can I use this to test regex for other languages?",
        answer:
          "The tool uses JavaScript regex syntax, which is largely compatible with other languages. However, features like lookbehinds, possessive quantifiers, and atomic groups vary between engines.",
      },
      {
        question: "What are common use cases for regex?",
        answer:
          "Regular expressions are used for form validation, log parsing, search-and-replace in editors, URL routing, data extraction from text, and input sanitisation in applications.",
      },
    ],
  },
  "/tools/text/lorem": {
    title: "Lorem Ipsum Generator FAQ",
    about:
      'Generate placeholder text for design mockups, layout testing, and content prototyping. Lorem Ipsum is the standard dummy text used by designers and developers since the 1500s to fill layouts without distracting from the visual design. This generator lets you produce words, sentences, or paragraphs in any quantity, with options to start with the classic "Lorem ipsum dolor sit amet" opening. All text is generated locally in your browser.',
    howToUse: [
      "Select the output unit: words, sentences, or paragraphs.",
      "Set the quantity of units to generate.",
      "Optionally enable the classic Lorem ipsum opening.",
      "Click Generate and copy the result.",
    ],
    items: [
      {
        question: "Can I generate words, sentences, and paragraphs?",
        answer:
          "Yes. You can choose the output unit (words, sentences, or paragraphs) and set any quantity to match your layout needs.",
      },
      {
        question: "Can output start with classic lorem ipsum text?",
        answer:
          'Yes. There is an option to start the output with the traditional "Lorem ipsum dolor sit amet" opening.',
      },
      {
        question: "What is Lorem Ipsum?",
        answer:
          "Lorem Ipsum is scrambled Latin text derived from Cicero's De Finibus (45 BC). It has been the typesetting industry's standard placeholder text since the 1500s.",
      },
      {
        question: "Why use placeholder text instead of real content?",
        answer:
          "Placeholder text allows designers and developers to focus on layout, typography, and visual hierarchy without being distracted by meaningful content during the prototyping phase.",
      },
      {
        question: "Is the generated text random?",
        answer:
          "The text is assembled from a standard Lorem Ipsum word pool to produce natural-looking Latin-style prose. It is not cryptographically random.",
      },
    ],
  },
  "/tools/data/baseconv": {
    title: "Number Base Converter FAQ",
    about:
      "Convert numbers between binary (base 2), octal (base 8), decimal (base 10), and hexadecimal (base 16) representations. Number base conversion is a fundamental operation in programming, computer science, and digital electronics. Developers routinely convert between bases when working with bitwise operations, memory addresses, colour codes, file permissions, and low-level protocols. This tool uses BigInt for arbitrary-precision conversion, handling numbers of any size without rounding errors. All conversion runs locally in your browser.",
    howToUse: [
      "Enter a number in any supported base (binary, octal, decimal, or hex).",
      "Select the input base if it is not auto-detected.",
      "View the instant conversion to all other bases.",
      "Copy any output value using the copy button.",
    ],
    items: [
      {
        question: "Which number bases are supported?",
        answer:
          "Binary (base 2), octal (base 8), decimal (base 10), and hexadecimal (base 16) are supported for bidirectional conversion.",
      },
      {
        question: "Does it support very large numbers?",
        answer:
          "Yes. The tool uses BigInt for arbitrary-precision arithmetic, so it handles numbers of any size without floating-point rounding errors.",
      },
      {
        question: "Can I convert negative numbers?",
        answer:
          "The tool is designed for unsigned integer conversion. For signed representations, convert the absolute value and apply the sign or two's complement manually.",
      },
      {
        question: "What are common uses for base conversion?",
        answer:
          "Base conversion is used for bitwise operations, reading memory addresses, setting Unix file permissions (octal), defining CSS colour codes (hex), and understanding binary data formats.",
      },
      {
        question: "Is the conversion accurate for very large numbers?",
        answer:
          "Yes. BigInt provides exact integer arithmetic regardless of number size, unlike standard JavaScript numbers which lose precision beyond 53 bits.",
      },
    ],
  },
  "/tools/encode/jwt": {
    title: "JWT Decoder FAQ",
    about:
      "Decode JSON Web Tokens (JWTs) to inspect their header, payload, and metadata without needing a secret key. JWTs are the standard token format for authentication and authorization in modern web APIs, single sign-on systems, and OAuth flows. This decoder splits the token into its three parts (header, payload, signature), shows the decoded JSON, and highlights important fields like expiration (exp), issued-at (iat), issuer (iss), and audience (aud). Bearer prefixes are stripped automatically. All decoding happens locally — your tokens are never sent to a server.",
    howToUse: [
      "Paste a JWT (with or without the Bearer prefix) into the input field.",
      "The header and payload are decoded and displayed instantly.",
      "Review expiration, issued-at, and other standard claims highlighted in the output.",
      "Copy decoded sections using the copy button.",
    ],
    items: [
      {
        question: "Does this tool verify JWT signatures?",
        answer:
          "No. This tool decodes the header and payload and displays metadata. Signature verification requires the signing key, which should not be entered into a browser tool.",
      },
      {
        question: "Can I paste tokens with Bearer prefix?",
        answer:
          "Yes. The tool automatically strips the Bearer prefix before decoding.",
      },
      {
        question: "What JWT claims are highlighted?",
        answer:
          "Standard claims like exp (expiration), iat (issued at), nbf (not before), iss (issuer), sub (subject), and aud (audience) are identified and displayed with human-readable labels.",
      },
      {
        question: "Is my token sent to a server?",
        answer:
          "No. All decoding happens locally in your browser. Your JWT and its contents never leave your device.",
      },
      {
        question: "Can I decode expired tokens?",
        answer:
          "Yes. The decoder works on any valid JWT structure regardless of expiration status. It will show the expiration time so you can see when the token expired.",
      },
      {
        question: "How do I decode a JWT without a secret key?",
        answer:
          "JWT payloads and headers are Base64url-encoded, not encrypted, so you can read them without any secret. Paste the token to inspect its header, claims, and expiration. The secret is only needed to verify the signature, not to decode the contents.",
      },
      {
        question: "Is it safe to paste a JWT into an online decoder?",
        answer:
          "With this tool, yes — decoding happens entirely in your browser and the token is never sent to a server. Still, treat production tokens as secrets and avoid pasting them into tools that transmit data remotely.",
      },
    ],
  },
  "/tools/encode/escape": {
    title: "String Escape FAQ",
    about:
      "Escape and unescape strings for HTML, JSON, URLs, and regular expressions. String escaping converts special characters into safe representations for a target context — preventing injection attacks, encoding issues, and syntax errors. Developers need escaping when building HTML templates, constructing JSON strings, embedding values in URLs, or writing regex patterns with literal special characters. This tool handles all four major escaping contexts in both directions, running entirely in your browser.",
    howToUse: [
      "Paste the string you need to escape or unescape.",
      "Select the escaping context: HTML, JSON, URL, or Regex.",
      "Choose Escape or Unescape direction.",
      "Copy the result using the copy button.",
    ],
    items: [
      {
        question: "Which escape modes are available?",
        answer:
          "HTML entity escaping, JSON string escaping, URL percent-encoding, and regex special character escaping are all supported in both escape and unescape directions.",
      },
      {
        question: "Can escaped strings be reversed?",
        answer:
          "Yes. Unescape mode is available for all supported formats to convert escaped strings back to their original form.",
      },
      {
        question: "When should I use HTML escaping?",
        answer:
          "HTML escaping is essential when inserting user-supplied text into HTML to prevent XSS (cross-site scripting) attacks. Characters like <, >, &, and quotes are converted to HTML entities.",
      },
      {
        question: "What does JSON escaping handle?",
        answer:
          "JSON escaping handles special characters that need backslash escaping in JSON strings: quotes, backslashes, newlines, tabs, and control characters.",
      },
      {
        question: "Is my data sent to a server?",
        answer:
          "No. All escaping and unescaping runs locally in your browser. Your strings never leave your device.",
      },
    ],
  },
  "/tools/data/color": {
    title: "Color Converter FAQ",
    about:
      "Convert colours between HEX, RGB, HSL, and OKLCH formats and generate related colour palettes. Colour conversion is a daily task for frontend developers and designers working across CSS, design tools, and brand guidelines that may specify colours in different formats. OKLCH is a modern perceptually uniform colour space that produces more natural-looking gradients and palettes than HSL. This tool parses any supported format, shows all conversions at once, and generates palette variations. All processing runs locally in your browser.",
    howToUse: [
      "Enter a colour value in any supported format: HEX (#FF5733), RGB, HSL, or OKLCH.",
      "View instant conversions to all other formats.",
      "Explore the generated palette variations based on your input colour.",
      "Copy any colour value using the copy button.",
    ],
    items: [
      {
        question: "Which colour formats are supported?",
        answer:
          "HEX (#RRGGBB, #RGB), RGB (rgb(r, g, b)), HSL (hsl(h, s%, l%)), and OKLCH (oklch(L C H)) inputs are all parsed and converted between formats.",
      },
      {
        question: "Can I generate a related palette?",
        answer:
          "Yes. The tool generates palette variations from any valid input colour, including complementary, analogous, and lightness/darkness variants using OKLCH for perceptual uniformity.",
      },
      {
        question: "What is OKLCH and why use it?",
        answer:
          "OKLCH is a perceptually uniform colour space where equal numeric changes produce visually equal changes in colour. It produces more natural-looking palettes and gradients than HSL, and is supported in modern CSS.",
      },
      {
        question: "Can I use the output directly in CSS?",
        answer:
          "Yes. All output formats are valid CSS colour values that you can copy directly into your stylesheets.",
      },
      {
        question: "Is my data sent to a server?",
        answer:
          "No. All colour conversion and palette generation happens locally in your browser.",
      },
    ],
  },
  "/tools/data/yaml": {
    title: "YAML Converter FAQ",
    about:
      "Convert between YAML and JSON formats with validation feedback. YAML is a human-readable data serialisation language commonly used for configuration files (Docker Compose, Kubernetes manifests, CI/CD pipelines, Ansible playbooks) and data exchange. This converter lets you paste YAML and get valid JSON, or paste JSON and get clean YAML output. It validates your input and reports syntax errors with details. Key sorting is available for deterministic output. All conversion runs locally in your browser.",
    howToUse: [
      "Paste YAML to convert it to JSON, or paste JSON to convert it to YAML.",
      "Select the conversion direction using the mode toggle.",
      "Optionally enable key sorting for deterministic output.",
      "Copy the converted result using the copy button.",
    ],
    items: [
      {
        question: "Can I convert YAML to JSON and JSON to YAML?",
        answer:
          "Yes. Conversion works in both directions with real-time validation and error feedback.",
      },
      {
        question: "Can I sort keys during conversion?",
        answer:
          "Yes. Key sorting produces alphabetically ordered output, which is useful for consistent diffs and version control.",
      },
      {
        question: "Which YAML features are supported?",
        answer:
          "The converter supports standard YAML features including nested objects, arrays, multi-line strings, anchors, and aliases. It uses the yaml library for parsing.",
      },
      {
        question: "Will YAML syntax errors be reported?",
        answer:
          "Yes. Invalid YAML input produces specific error messages with line numbers to help you locate and fix the issue.",
      },
      {
        question: "Is my configuration data sent to a server?",
        answer:
          "No. All conversion and validation happens locally in your browser. Your YAML and JSON data never leaves your device.",
      },
    ],
  },
  "/tools/time/cron": {
    title: "Cron Parser FAQ",
    about:
      "Parse and build cron expressions with a human-readable description and a preview of upcoming execution times. Cron expressions define recurring schedules in Unix cron jobs, CI/CD pipelines, Kubernetes CronJobs, cloud scheduler services, and task automation systems. This tool accepts standard five-field cron expressions (minute, hour, day-of-month, month, day-of-week), translates them to plain English, and calculates the next scheduled run times from the current moment. All parsing runs locally in your browser.",
    howToUse: [
      "Enter a five-field cron expression (e.g. 0 9 * * 1-5 for weekdays at 9 AM).",
      "Read the human-readable description of the schedule.",
      "Review the list of next upcoming execution times.",
      "Adjust the expression and see results update in real time.",
    ],
    items: [
      {
        question: "What cron format is supported?",
        answer:
          "The parser accepts standard five-field cron expressions: minute (0-59), hour (0-23), day of month (1-31), month (1-12), and day of week (0-6, where 0 is Sunday).",
      },
      {
        question: "Can I preview upcoming run times?",
        answer:
          "Yes. The tool calculates and displays the next several scheduled execution times from the current moment.",
      },
      {
        question: "What do special characters mean in cron?",
        answer:
          "* means every value, , separates list items, - defines ranges, and / defines step values. For example, */5 in the minute field means every 5 minutes.",
      },
      {
        question: "Can I use this for Kubernetes CronJobs?",
        answer:
          "Yes. Kubernetes CronJobs use the standard five-field cron format, which is exactly what this tool parses. The expression you build here can be used directly in your CronJob spec.",
      },
      {
        question: "Is my cron expression sent to a server?",
        answer:
          "No. All parsing and schedule calculation happens locally in your browser.",
      },
    ],
  },
  "/tools/data/csv": {
    title: "CSV/TSV to JSON Converter FAQ",
    about:
      "Convert between CSV/TSV and JSON formats for data interchange, analysis, and API integration. CSV (comma-separated values) and TSV (tab-separated values) are the most common formats for tabular data exported from spreadsheets, databases, and analytics tools. This converter transforms delimited text into JSON arrays of objects (using the header row as keys) and converts JSON arrays back to delimited output. It handles quoted fields, custom delimiters, and header rows. All conversion runs locally in your browser — your data is never uploaded.",
    howToUse: [
      "Paste CSV or TSV data into the input area.",
      "Select the delimiter mode (comma for CSV, tab for TSV).",
      "Click Convert to generate a JSON array of objects.",
      "To go the other direction, paste a JSON array and convert to CSV/TSV.",
      "Copy the result using the copy button.",
    ],
    items: [
      {
        question: "Does it support CSV and TSV input?",
        answer:
          "Yes. You can switch the delimiter between comma (CSV) and tab (TSV) to match your input format.",
      },
      {
        question: "Can I convert JSON objects back to CSV?",
        answer:
          "Yes. Array-of-object JSON input is converted to delimited output with automatic header row generation from object keys.",
      },
      {
        question: "How are headers handled?",
        answer:
          "The first row of CSV/TSV input is treated as the header row, and each subsequent row becomes a JSON object with those headers as keys.",
      },
      {
        question: "Does it handle quoted fields and commas inside values?",
        answer:
          "Yes. Fields containing commas, newlines, or quotes can be enclosed in double quotes following standard CSV conventions.",
      },
      {
        question: "Is my data sent to a server?",
        answer:
          "No. All conversion happens locally in your browser. Your spreadsheet data never leaves your device.",
      },
    ],
  },
  "/tools/encode/url-parser": {
    title: "URL Parser & Builder FAQ",
    about:
      "Parse URLs into their components and build URLs by editing individual parts. Understanding URL structure — protocol, host, port, path, query parameters, and fragment — is essential for debugging API calls, constructing redirect URLs, and analysing links. This tool breaks any URL into its constituent parts, lets you add, edit, or remove query parameters, and reconstructs the full URL instantly. It uses the browser URL API for consistent encoding behaviour. All parsing runs locally in your browser.",
    howToUse: [
      "Paste a URL into the input field to break it into components.",
      "Review the parsed parts: protocol, host, port, path, query parameters, and fragment.",
      "Edit, add, or remove query parameters using the parameter editor.",
      "Copy the reconstructed URL or individual components using the copy buttons.",
    ],
    items: [
      {
        question: "Can I edit query parameters after parsing?",
        answer:
          "Yes. Parsed query parameters can be added, updated, or removed individually, and the full URL is rebuilt instantly.",
      },
      {
        question: "Does it preserve URL encoding rules?",
        answer:
          "Yes. The tool uses the browser URL API for reconstruction, so query parameters are encoded consistently according to standard rules.",
      },
      {
        question: "Which URL components are shown?",
        answer:
          "The tool displays protocol (scheme), hostname, port, pathname, search (query string), individual query parameters, and hash (fragment).",
      },
      {
        question: "Can I use this to debug API request URLs?",
        answer:
          "Yes. Paste a complex API URL to see each query parameter separated and editable. This is especially useful for URLs with many encoded parameters.",
      },
      {
        question: "Is my URL sent to a server?",
        answer:
          "No. All parsing and URL reconstruction happens locally in your browser.",
      },
    ],
  },
  "/tools/encode/base58": {
    title: "Base58/Base58Check FAQ",
    about:
      "Encode and decode data using Base58 and Base58Check, the encoding schemes designed for Bitcoin addresses and other cryptocurrency applications. Base58 uses a 58-character alphabet that omits visually ambiguous characters (0, O, I, l) to reduce transcription errors. Base58Check adds a 4-byte checksum (from double SHA-256) for integrity validation, ensuring that addresses and keys can be verified before use. This tool supports both plain Base58 and Base58Check modes, running entirely in your browser.",
    howToUse: [
      "Enter text or hex data to encode as Base58 or Base58Check.",
      "Or paste a Base58-encoded string to decode it.",
      "Select between Base58 (plain) and Base58Check (with checksum) modes.",
      "Copy the result using the copy button.",
    ],
    items: [
      {
        question: "What is the difference between Base58 and Base58Check?",
        answer:
          "Base58 is plain encoding without error detection. Base58Check appends a 4-byte checksum derived from double SHA-256, allowing the receiver to verify the data was not corrupted or mistyped.",
      },
      {
        question: "Which alphabet is used?",
        answer:
          "The Bitcoin Base58 alphabet: 123456789ABCDEFGHJKLMNPQRSTUVWXYZabcdefghijkmnopqrstuvwxyz. It omits 0, O, I, and l to avoid visual ambiguity.",
      },
      {
        question: "Where is Base58 used?",
        answer:
          "Base58 and Base58Check are used for Bitcoin addresses, private keys (WIF format), IPFS content hashes, and other cryptocurrency and distributed system identifiers.",
      },
      {
        question: "Why not just use Base64?",
        answer:
          "Base64 includes characters (+, /, 0, O, I, l) that can be confused when manually transcribed. Base58 was specifically designed to avoid these ambiguities for human-readable identifiers.",
      },
      {
        question: "Is my data sent to a server?",
        answer:
          "No. All encoding and decoding runs locally in your browser, including the SHA-256 checksum computation for Base58Check.",
      },
    ],
  },
  "/tools/network/cidr": {
    title: "CIDR / Subnet Calculator FAQ",
    about:
      "Calculate IPv4 and IPv6 subnet ranges, network addresses, broadcast addresses, netmasks, wildcard masks, and host counts directly in your browser. CIDR (Classless Inter-Domain Routing) notation is the standard way to describe network ranges in modern networking, used in routing tables, firewall rules, cloud security groups, VPC configurations, and Kubernetes networking. This tool accepts a CIDR expression like 192.168.1.0/24 or 2001:db8::/32 and produces every value you need to plan a subnet, validate a firewall rule, or audit a network design. All math runs locally using arbitrary-precision BigInt — your network topology never leaves your device.",
    howToUse: [
      "Enter a CIDR expression (e.g. 192.168.1.0/24) or a bare IP address.",
      "View the network address, broadcast, host range, masks, and address counts instantly.",
      "Use the preset buttons for common ranges like 10.0.0.0/8 or fe80::/10.",
      "Copy individual values or the full summary using the copy buttons.",
    ],
    items: [
      {
        question: "Does this support IPv6?",
        answer:
          "Yes. The calculator handles both IPv4 (/0–/32) and IPv6 (/0–/128) using BigInt math, including IPv6 :: compression, embedded IPv4 addresses, and link-local detection.",
      },
      {
        question: "What does /24 mean in CIDR notation?",
        answer:
          "The /24 suffix means the first 24 bits of the address are the network portion, leaving 8 bits for hosts. In IPv4 this gives 256 total addresses (254 usable hosts after reserving network and broadcast).",
      },
      {
        question: "Why are /31 and /32 prefixes special?",
        answer:
          "A /32 represents a single host address. A /31 represents a 2-address point-to-point link where both addresses are usable (per RFC 3021), so the calculator does not subtract network and broadcast for these prefixes.",
      },
      {
        question: "What is the wildcard mask used for?",
        answer:
          "Wildcard masks (the inverse of a netmask) are used in Cisco access control lists and OSPF area definitions, where they specify which bits the router should ignore when matching addresses.",
      },
      {
        question: "Is my input sent to a server?",
        answer:
          "No. All CIDR parsing and subnet math runs locally in your browser using BigInt arithmetic. Nothing is transmitted.",
      },
    ],
  },
  "/tools/ids/qrcode": {
    title: "QR Code Generator FAQ",
    about:
      "Generate QR codes for URLs, plain text, Wi-Fi credentials, contact cards, and any string up to a few thousand characters — directly in your browser. QR codes encode short payloads as a 2D matrix that smartphones, scanners, and modern cameras can read instantly, making them ideal for sharing links, joining Wi-Fi networks, presenting payment details, or distributing app download URLs. This generator runs entirely client-side, supports four error correction levels, and lets you download the result as SVG (scales perfectly) or PNG (works everywhere). Your input is never sent to a server.",
    howToUse: [
      "Type or paste the text or URL you want to encode.",
      "Choose an error correction level: L (smallest), M, Q, or H (most resilient to damage).",
      "Adjust the module size and quiet zone if needed.",
      "Download the QR code as SVG or PNG, or scan it directly from the preview.",
    ],
    items: [
      {
        question: "What is QR error correction?",
        answer:
          "QR codes embed Reed-Solomon error correction so they can still be read when partly damaged or obscured. Level L recovers ~7% damage, M ~15%, Q ~25%, and H ~30%. Higher correction creates denser, larger QR codes.",
      },
      {
        question: "Which error correction level should I pick?",
        answer:
          "Use M for normal screen or print use, Q if the QR will be on a busy or low-quality surface, and H if a logo or sticker may overlap part of the code. L produces the smallest code but is fragile.",
      },
      {
        question: "How much data can a QR code hold?",
        answer:
          "Up to a few thousand alphanumeric characters in the highest QR version, but in practice keep payloads under ~300 characters for reliable scanning by phone cameras.",
      },
      {
        question: "Can I generate Wi-Fi or vCard QR codes?",
        answer:
          "Yes. Paste a Wi-Fi join string (WIFI:T:WPA;S:MySSID;P:MyPassword;;) or a vCard payload to encode it. Most modern phone cameras recognise both formats automatically.",
      },
      {
        question: "Is the QR code generated in my browser?",
        answer:
          "Yes. Generation is entirely local — your input text, URLs, and any sensitive data like Wi-Fi passwords never leave your device.",
      },
    ],
  },
  "/tools/encode/tls-cert": {
    title: "TLS Certificate Viewer FAQ",
    about:
      "Inspect PEM-encoded TLS/SSL certificates to view subject, issuer, validity period, Subject Alternative Names (SANs), key usage, and SHA-256 fingerprints. TLS certificates are fundamental to HTTPS security, and developers frequently need to inspect them when debugging SSL errors, validating certificate chains, checking expiration dates, or verifying SANs match expected domains. This viewer parses X.509 certificates locally in your browser — your certificate data is never sent to a server.",
    howToUse: [
      "Paste a PEM-encoded certificate (starting with -----BEGIN CERTIFICATE-----) into the input field.",
      "View the parsed certificate details: subject, issuer, validity dates, SANs, and fingerprint.",
      "If multiple certificates are pasted, each one is parsed and displayed separately.",
      "Copy individual fields using the copy buttons.",
    ],
    items: [
      {
        question: "What certificate details are shown?",
        answer:
          "The viewer displays subject (CN, O, OU), issuer, validity window (not before / not after), Subject Alternative Names, key usage, basic constraints, and SHA-256 fingerprint.",
      },
      {
        question: "Can I inspect multiple PEM certificates at once?",
        answer:
          "Yes. If you paste a PEM file containing multiple CERTIFICATE blocks (e.g. a full chain), each certificate is parsed and displayed separately.",
      },
      {
        question: "Can I check if a certificate is expired?",
        answer:
          "Yes. The validity dates (not before and not after) are displayed, so you can immediately see if the certificate is currently valid or has expired.",
      },
      {
        question: "What are Subject Alternative Names (SANs)?",
        answer:
          "SANs list the domain names and IP addresses that a certificate is valid for. Modern browsers require the domain to appear in the SAN field, not just the Common Name.",
      },
      {
        question: "Is my certificate data sent to a server?",
        answer:
          "No. All certificate parsing happens locally in your browser. Your PEM data never leaves your device.",
      },
    ],
  },
  "/tools/pdf/unlock": {
    title: "PDF Password Remover FAQ",
    about:
      "Remove password protection from a PDF entirely inside your browser. Supply the password you already use to open the document and the tool decrypts every string and stream, then writes a clean copy with no encryption dictionary — so the unlocked file opens without a prompt in any reader. Decryption runs through a WebAssembly build of qpdf, the long-standing open-source PDF toolkit, executing in a Web Worker on your own device. Most online PDF unlockers upload your file to a server, which means handing a confidential document and its password to a third party. This tool never transmits either. It supports every standard PDF security handler: RC4 40-bit and 128-bit, AES-128, and AES-256.",
    howToUse: [
      "Confirm you own the document or are authorized to modify it.",
      "Drop your PDF onto the upload area, or choose a file from your device.",
      "Type the password you normally use to open the document.",
      "Leave the password empty if the PDF opens freely but blocks printing or copying.",
      "Select Unlock PDF, then download the decrypted copy.",
    ],
    items: [
      {
        question: "Is my PDF uploaded to a server?",
        answer:
          "No. The file is read directly in your browser and decrypted by a WebAssembly module running in a Web Worker on your device. Neither the PDF nor the password is transmitted anywhere, and the worker is terminated as soon as the result is ready.",
      },
      {
        question: "Can this recover a password I do not know?",
        answer:
          "No. This tool removes protection from a document you can already open, which requires the correct password. It does not guess, crack, or brute-force passwords.",
      },
      {
        question:
          "What is the difference between a user password and an owner password?",
        answer:
          "A user password is required to open the document at all. An owner password leaves the PDF readable but restricts actions like printing, copying text, or editing. Either one works here, and removing the encryption clears the restrictions along with it.",
      },
      {
        question:
          "The PDF opens without a password but I cannot print or copy. Will this help?",
        answer:
          "Yes. That is an owner password with an empty user password. Leave the password field blank and unlock the file — the permission restrictions are removed along with the encryption.",
      },
      {
        question: "Which types of PDF encryption are supported?",
        answer:
          "All standard security handlers: RC4 40-bit and 128-bit (revisions 2 and 3), AES-128 (revision 4), and AES-256 (revisions 5 and 6). Enterprise DRM systems such as Adobe LiveCycle or FileOpen use custom handlers and cannot be removed with a password.",
      },
      {
        question: "Does unlocking change the contents of my PDF?",
        answer:
          "Document content — text, images, and page structure — is preserved. qpdf rewrites the file without the encryption layer, so the internal file structure and size may change: streams are recompressed and objects can be renumbered. Keep your original until you have checked the unlocked copy.",
      },
      {
        question: "Am I allowed to remove a password from any PDF?",
        answer:
          "Only remove protection from documents you own or are authorized to modify. Bypassing protection on material you have no right to alter may breach the document owner's terms or your local law. This tool requires the correct password precisely because it is meant for documents you already have legitimate access to.",
      },
      {
        question: "Does this work offline?",
        answer:
          "Yes. Once the page and its WebAssembly module have loaded, unlocking requires no network connection at all.",
      },
      {
        question: "Is there a file size limit?",
        answer:
          "Files up to 100 MB are accepted. The limit exists because the PDF is held in browser memory during decryption, and larger files would risk exhausting the tab.",
      },
    ],
  },
};
