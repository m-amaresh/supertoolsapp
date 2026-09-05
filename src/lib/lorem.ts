const WORDS = [
  "lorem",
  "ipsum",
  "dolor",
  "sit",
  "amet",
  "consectetur",
  "adipiscing",
  "elit",
  "sed",
  "do",
  "eiusmod",
  "tempor",
  "incididunt",
  "ut",
  "labore",
  "et",
  "dolore",
  "magna",
  "aliqua",
  "enim",
  "ad",
  "minim",
  "veniam",
  "quis",
  "nostrud",
  "exercitation",
  "ullamco",
  "laboris",
  "nisi",
  "aliquip",
  "ex",
  "ea",
  "commodo",
  "consequat",
  "duis",
  "aute",
  "irure",
  "in",
  "reprehenderit",
  "voluptate",
  "velit",
  "esse",
  "cillum",
  "fugiat",
  "nulla",
  "pariatur",
  "excepteur",
  "sint",
  "occaecat",
  "cupidatat",
  "non",
  "proident",
  "sunt",
  "culpa",
  "qui",
  "officia",
  "deserunt",
  "mollit",
  "anim",
  "id",
  "est",
  "laborum",
  "ac",
  "accumsan",
  "aliquet",
  "ante",
  "arcu",
  "at",
  "auctor",
  "augue",
  "bibendum",
  "blandit",
  "condimentum",
  "congue",
  "cras",
  "curabitur",
  "cursus",
  "dapibus",
  "diam",
  "dictum",
  "dignissim",
  "donec",
  "dui",
  "efficitur",
  "egestas",
  "eget",
  "eleifend",
  "elementum",
  "etiam",
  "eu",
  "euismod",
  "facilisis",
  "faucibus",
  "felis",
  "fermentum",
  "finibus",
  "fringilla",
  "gravida",
  "habitant",
  "hendrerit",
  "iaculis",
  "imperdiet",
  "integer",
  "interdum",
  "justo",
  "lacinia",
  "lacus",
  "laoreet",
  "lectus",
  "leo",
  "libero",
  "ligula",
  "lobortis",
  "luctus",
  "maecenas",
  "massa",
  "mattis",
  "mauris",
  "maximus",
  "metus",
  "mi",
  "morbi",
  "nam",
  "nec",
  "neque",
  "nibh",
  "nunc",
  "odio",
  "orci",
  "ornare",
  "pellentesque",
  "pharetra",
  "phasellus",
  "placerat",
  "porta",
  "porttitor",
  "posuere",
  "praesent",
  "pretium",
  "proin",
  "pulvinar",
  "purus",
  "quam",
  "quisque",
  "rhoncus",
  "risus",
  "rutrum",
  "sagittis",
  "sapien",
  "scelerisque",
  "semper",
  "sollicitudin",
  "suscipit",
  "suspendisse",
  "tellus",
  "tincidunt",
  "tortor",
  "tristique",
  "turpis",
  "ultrices",
  "ultricies",
  "urna",
  "varius",
  "vehicula",
  "vel",
  "vestibulum",
  "vitae",
  "vivamus",
  "viverra",
  "volutpat",
  "vulputate",
];

const FIRST_SENTENCE =
  "Lorem ipsum dolor sit amet, consectetur adipiscing elit.";

// CSPRNG integer in [min, max] using rejection sampling to avoid modulo bias.
function randomInt(min: number, max: number): number {
  const range = max - min + 1;
  const buf = new Uint32Array(1);
  crypto.getRandomValues(buf);
  const limit = Math.floor(0x100000000 / range) * range;
  let v = buf[0];
  while (v >= limit) {
    crypto.getRandomValues(buf);
    v = buf[0];
  }
  return min + (v % range);
}

function randomWord(): string {
  return WORDS[randomInt(0, WORDS.length - 1)];
}

function capitalize(s: string): string {
  return s.charAt(0).toUpperCase() + s.slice(1);
}

function generateSentence(): string {
  const wordCount = randomInt(6, 14);
  const words: string[] = [];
  for (let i = 0; i < wordCount; i++) {
    words.push(randomWord());
  }
  return `${capitalize(words.join(" "))}.`;
}

export type LoremUnit = "paragraphs" | "sentences" | "words";

export function generateLorem(
  count: number,
  unit: LoremUnit,
  startWithLorem: boolean,
): string {
  const safeCount = Math.min(Math.max(1, count), 100);

  if (unit === "words") {
    const words: string[] = [];
    for (let i = 0; i < safeCount; i++) {
      words.push(randomWord());
    }
    if (startWithLorem && safeCount >= 2) {
      words[0] = "lorem";
      words[1] = "ipsum";
    }
    return capitalize(words.join(" "));
  }

  if (unit === "sentences") {
    const sentences: string[] = [];
    for (let i = 0; i < safeCount; i++) {
      if (i === 0 && startWithLorem) {
        sentences.push(FIRST_SENTENCE);
      } else {
        sentences.push(generateSentence());
      }
    }
    return sentences.join(" ");
  }

  // paragraphs
  const paragraphs: string[] = [];
  for (let p = 0; p < safeCount; p++) {
    const sentenceCount = randomInt(4, 8);
    const sentences: string[] = [];
    for (let s = 0; s < sentenceCount; s++) {
      if (p === 0 && s === 0 && startWithLorem) {
        sentences.push(FIRST_SENTENCE);
      } else {
        sentences.push(generateSentence());
      }
    }
    paragraphs.push(sentences.join(" "));
  }
  return paragraphs.join("\n\n");
}
