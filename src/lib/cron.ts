export interface CronResult {
  description: string;
  nextRuns: Date[];
  error: string | null;
}

interface CronFields {
  minute: string;
  hour: string;
  dayOfMonth: string;
  month: string;
  dayOfWeek: string;
}

const MONTH_NAMES = [
  "",
  "January",
  "February",
  "March",
  "April",
  "May",
  "June",
  "July",
  "August",
  "September",
  "October",
  "November",
  "December",
];

const DAY_NAMES = [
  "Sunday",
  "Monday",
  "Tuesday",
  "Wednesday",
  "Thursday",
  "Friday",
  "Saturday",
];

// Parse a single cron field (e.g. "1,3-5", "*/15", "*") into a sorted list
// of matching values. Returns null if the field is invalid.
function parseField(
  field: string,
  min: number,
  max: number,
  normalize?: (value: number) => number,
): number[] | null {
  const values = new Set<number>();

  for (const part of field.split(",")) {
    const stepMatch = part.match(/^(.+)\/(\d+)$/);
    let range: string;
    let step = 1;

    if (stepMatch) {
      range = stepMatch[1];
      step = Number.parseInt(stepMatch[2], 10);
      if (step < 1) return null;
    } else {
      range = part;
    }

    if (range === "*") {
      for (let i = min; i <= max; i += step) {
        values.add(normalize ? normalize(i) : i);
      }
    } else {
      const rangeMatch = range.match(/^(\d+)-(\d+)$/);
      if (rangeMatch) {
        const start = Number.parseInt(rangeMatch[1], 10);
        const end = Number.parseInt(rangeMatch[2], 10);
        if (start < min || end > max || start > end) return null;
        for (let i = start; i <= end; i += step) {
          values.add(normalize ? normalize(i) : i);
        }
      } else {
        if (!/^\d+$/.test(range)) return null;
        const val = Number.parseInt(range, 10);
        if (val < min || val > max) return null;
        // "N/step" means N through the field's maximum (cronie); without a
        // step it is just N.
        const last = stepMatch ? max : val;
        for (let i = val; i <= last; i += step) {
          values.add(normalize ? normalize(i) : i);
        }
      }
    }
  }

  return [...values].sort((a, b) => a - b);
}

function normalizeDayOfWeek(value: number): number {
  return value === 7 ? 0 : value;
}

function describeField(
  field: string,
  names: string[] | null,
  unit: string,
  normalize?: (value: number) => number,
): string {
  if (field === "*") return `every ${unit}`;

  const label = (raw: string) => {
    if (!names) return raw;
    const value = Number.parseInt(raw, 10);
    return names[normalize ? normalize(value) : value] || raw;
  };

  const parts = field.split(",").map((part) => {
    const [range, step] = part.split("/");
    const rangeMatch = range.match(/^(\d+)-(\d+)$/);
    const base = rangeMatch
      ? `${label(rangeMatch[1])} through ${label(rangeMatch[2])}`
      : label(range);
    if (step === undefined) return base;

    const every = step === "1" ? `every ${unit}` : `every ${step} ${unit}s`;
    if (range === "*") return every;
    // Numeric fields read better with the unit: "from minute 5 through 30".
    const from = names ? base : `${unit} ${base}`;
    return rangeMatch ? `${every} from ${from}` : `${every} from ${from} on`;
  });

  return parts.join(", ");
}

function buildDescription(fields: CronFields): string {
  const parts: string[] = [];

  if (fields.minute === "*" && fields.hour === "*") {
    parts.push("Every minute");
  } else if (fields.minute.match(/^\*\/\d+$/) && fields.hour === "*") {
    parts.push(`Every ${fields.minute.split("/")[1]} minutes`);
  } else if (fields.hour.match(/^\*\/\d+$/) && fields.minute === "0") {
    parts.push(`Every ${fields.hour.split("/")[1]} hours`);
  } else if (fields.minute !== "*" && fields.hour !== "*") {
    const hourDesc = describeField(fields.hour, null, "hour");
    const minDesc = fields.minute.padStart(2, "0");
    if (
      !fields.hour.includes(",") &&
      !fields.hour.includes("-") &&
      !fields.hour.includes("/") &&
      !fields.minute.includes(",") &&
      !fields.minute.includes("-") &&
      !fields.minute.includes("/")
    ) {
      parts.push(
        `At ${fields.hour.padStart(2, "0")}:${fields.minute.padStart(2, "0")}`,
      );
    } else {
      parts.push(`At minute ${minDesc} past ${hourDesc}`);
    }
  } else if (fields.minute.includes("/")) {
    const minuteDesc = describeField(fields.minute, null, "minute");
    parts.push(minuteDesc[0].toUpperCase() + minuteDesc.slice(1));
  } else if (fields.minute !== "*") {
    parts.push(`At minute ${describeField(fields.minute, null, "minute")}`);
  } else {
    parts.push(
      `Every minute during ${describeField(fields.hour, null, "hour")}`,
    );
  }

  // Stepped fields describe themselves ("every 2 months from January
  // through November"); plain ones need a preposition.
  if (fields.dayOfMonth !== "*") {
    const desc = describeField(fields.dayOfMonth, null, "day");
    parts.push(
      fields.dayOfMonth.includes("/")
        ? `${desc} of the month`
        : `on day ${desc} of the month`,
    );
  }

  if (fields.month !== "*") {
    const desc = describeField(fields.month, MONTH_NAMES, "month");
    parts.push(fields.month.includes("/") ? desc : `in ${desc}`);
  }

  if (fields.dayOfWeek !== "*") {
    const desc = describeField(
      fields.dayOfWeek,
      DAY_NAMES,
      "day",
      normalizeDayOfWeek,
    );
    parts.push(fields.dayOfWeek.includes("/") ? desc : `on ${desc}`);
  }

  return parts.join(", ");
}

// Walk forward from now to find the next `count` matching times.
// Skips non-matching months/days/hours in bulk to avoid iterating minute-by-minute.
// Day matching follows Vixie cron and cronie: when both day fields are
// restricted, either may match (OR). A field whose text starts with "*"
// (including "*/2") counts as unrestricted, and then both must match (AND).
function getNextRuns(fields: CronFields, count: number): Date[] | null {
  const minutes = parseField(fields.minute, 0, 59);
  const hours = parseField(fields.hour, 0, 23);
  const daysOfMonth = parseField(fields.dayOfMonth, 1, 31);
  const months = parseField(fields.month, 1, 12);
  const daysOfWeek = parseField(fields.dayOfWeek, 0, 7, normalizeDayOfWeek);

  if (!minutes || !hours || !daysOfMonth || !months || !daysOfWeek) {
    return null;
  }

  const monthSet = new Set(months);
  const domSet = new Set(daysOfMonth);
  const dowSet = new Set(daysOfWeek);
  const hourSet = new Set(hours);
  const minuteSet = new Set(minutes);
  const eitherDayFieldStarred =
    fields.dayOfMonth.startsWith("*") || fields.dayOfWeek.startsWith("*");

  const runs: Date[] = [];
  const now = new Date();
  const candidate = new Date(now);
  candidate.setSeconds(0, 0);
  candidate.setMinutes(candidate.getMinutes() + 1);

  // Search up to 4 years ahead (covers leap-year schedules)
  const end = new Date(now);
  end.setFullYear(end.getFullYear() + 4);

  while (runs.length < count && candidate < end) {
    if (!monthSet.has(candidate.getMonth() + 1)) {
      candidate.setMonth(candidate.getMonth() + 1, 1);
      candidate.setHours(0, 0, 0, 0);
      continue;
    }

    const dayOfMonthMatch = domSet.has(candidate.getDate());
    const dayOfWeekMatch = dowSet.has(candidate.getDay());
    const dayMatches = eitherDayFieldStarred
      ? dayOfMonthMatch && dayOfWeekMatch
      : dayOfMonthMatch || dayOfWeekMatch;

    if (!dayMatches) {
      candidate.setDate(candidate.getDate() + 1);
      candidate.setHours(0, 0, 0, 0);
      continue;
    }

    if (!hourSet.has(candidate.getHours())) {
      candidate.setHours(candidate.getHours() + 1, 0, 0, 0);
      continue;
    }

    if (!minuteSet.has(candidate.getMinutes())) {
      candidate.setMinutes(candidate.getMinutes() + 1, 0, 0);
      continue;
    }

    runs.push(new Date(candidate));
    candidate.setMinutes(candidate.getMinutes() + 1);
  }

  return runs;
}

export function parseCron(expression: string): CronResult {
  const trimmed = expression.trim();
  if (!trimmed) {
    return { description: "", nextRuns: [], error: null };
  }

  const parts = trimmed.split(/\s+/);
  if (parts.length !== 5) {
    return {
      description: "",
      nextRuns: [],
      error: `Expected 5 fields (minute hour day month weekday), got ${parts.length}`,
    };
  }

  const fields: CronFields = {
    minute: parts[0],
    hour: parts[1],
    dayOfMonth: parts[2],
    month: parts[3],
    dayOfWeek: parts[4],
  };

  if (!parseField(fields.minute, 0, 59)) {
    return {
      description: "",
      nextRuns: [],
      error: "Invalid minute field",
    };
  }
  if (!parseField(fields.hour, 0, 23)) {
    return {
      description: "",
      nextRuns: [],
      error: "Invalid hour field",
    };
  }
  if (!parseField(fields.dayOfMonth, 1, 31)) {
    return {
      description: "",
      nextRuns: [],
      error: "Invalid day-of-month field",
    };
  }
  if (!parseField(fields.month, 1, 12)) {
    return {
      description: "",
      nextRuns: [],
      error: "Invalid month field",
    };
  }
  if (!parseField(fields.dayOfWeek, 0, 7, normalizeDayOfWeek)) {
    return {
      description: "",
      nextRuns: [],
      error: "Invalid day-of-week field",
    };
  }

  const description = buildDescription(fields);
  const nextRuns = getNextRuns(fields, 5) || [];

  return { description, nextRuns, error: null };
}

export interface CronPreset {
  name: string;
  expression: string;
}

export const cronPresets: CronPreset[] = [
  { name: "Every minute", expression: "* * * * *" },
  { name: "Every hour", expression: "0 * * * *" },
  { name: "Every day at midnight", expression: "0 0 * * *" },
  { name: "Every Monday at 9 AM", expression: "0 9 * * 1" },
  { name: "Every weekday at 8 AM", expression: "0 8 * * 1-5" },
  { name: "Every 15 minutes", expression: "*/15 * * * *" },
  { name: "1st of every month", expression: "0 0 1 * *" },
  { name: "Every Sunday at noon", expression: "0 12 * * 0" },
];
