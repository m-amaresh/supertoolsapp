export interface TimestampFormats {
  unix: number;
  unixMs: number;
  iso8601: string;
  utc: string;
  local: string;
  relative: string;
}

// Auto-detect input format: numeric timestamps, ISO 8601, RFC 2822, etc.
// Uses a threshold of 32503680000 (year 3000 in seconds) to distinguish
// seconds from milliseconds in bare numeric input.
export function parseTimestamp(input: string): Date | null {
  if (!input.trim()) return null;

  const trimmed = input.trim();

  if (/^\d+$/.test(trimmed)) {
    const num = parseInt(trimmed, 10);
    if (num > 32503680000) {
      return new Date(num);
    }
    return new Date(num * 1000);
  }

  // Try ISO 8601 (reliable cross-browser)
  if (/^\d{4}-\d{2}-\d{2}/.test(trimmed)) {
    const date = new Date(trimmed);
    if (!Number.isNaN(date.getTime())) {
      return date;
    }
  }

  // Try RFC 2822 / month-name formats (cross-browser safe)
  if (/^[A-Za-z]/.test(trimmed) && /\d{4}/.test(trimmed)) {
    const date = new Date(trimmed);
    if (!Number.isNaN(date.getTime())) {
      return date;
    }
  }

  // Reject ambiguous numeric date strings like "01/02/2024" — browsers
  // disagree on whether that's Jan 2 or Feb 1.
  if (/^\d{1,2}[/.-]\d{1,2}[/.-]\d{2,4}$/.test(trimmed)) {
    return null;
  }

  // Try other standard formats via Date constructor
  const date = new Date(trimmed);
  if (!Number.isNaN(date.getTime())) {
    return date;
  }

  return null;
}

export function formatTimestamp(
  date: Date,
  timezone?: string,
): TimestampFormats {
  const unix = Math.floor(date.getTime() / 1000);
  const unixMs = date.getTime();
  const iso8601 = date.toISOString();
  const utc = date.toUTCString();

  let local: string;
  if (timezone) {
    try {
      local = date.toLocaleString("en-US", {
        timeZone: timezone,
        year: "numeric",
        month: "2-digit",
        day: "2-digit",
        hour: "2-digit",
        minute: "2-digit",
        second: "2-digit",
        hour12: false,
      });
    } catch {
      local = date.toLocaleString();
    }
  } else {
    local = date.toLocaleString();
  }

  const relative = getRelativeTime(date);

  return { unix, unixMs, iso8601, utc, local, relative };
}

function getRelativeTime(date: Date): string {
  const now = new Date();
  const diffMs = now.getTime() - date.getTime();
  const diffSec = Math.abs(Math.floor(diffMs / 1000));
  const isFuture = diffMs < 0;

  if (diffSec < 60) {
    return diffSec === 0
      ? "now"
      : `${diffSec} second${diffSec !== 1 ? "s" : ""} ${isFuture ? "from now" : "ago"}`;
  }

  const diffMin = Math.floor(diffSec / 60);
  if (diffMin < 60) {
    return `${diffMin} minute${diffMin !== 1 ? "s" : ""} ${isFuture ? "from now" : "ago"}`;
  }

  const diffHour = Math.floor(diffMin / 60);
  if (diffHour < 24) {
    return `${diffHour} hour${diffHour !== 1 ? "s" : ""} ${isFuture ? "from now" : "ago"}`;
  }

  const diffDay = Math.floor(diffHour / 24);
  if (diffDay < 30) {
    return `${diffDay} day${diffDay !== 1 ? "s" : ""} ${isFuture ? "from now" : "ago"}`;
  }

  const diffMonth = Math.floor(diffDay / 30);
  if (diffMonth < 12) {
    return `${diffMonth} month${diffMonth !== 1 ? "s" : ""} ${isFuture ? "from now" : "ago"}`;
  }

  const diffYear = Math.floor(diffMonth / 12);
  return `${diffYear} year${diffYear !== 1 ? "s" : ""} ${isFuture ? "from now" : "ago"}`;
}

export function getCurrentTimestamp(): Date {
  return new Date();
}

export const commonTimezones = [
  { value: "UTC", label: "UTC" },
  { value: "America/New_York", label: "New York (EST/EDT)" },
  { value: "America/Chicago", label: "Chicago (CST/CDT)" },
  { value: "America/Denver", label: "Denver (MST/MDT)" },
  { value: "America/Phoenix", label: "Phoenix (MST)" },
  { value: "America/Los_Angeles", label: "Los Angeles (PST/PDT)" },
  { value: "Europe/London", label: "London (GMT/BST)" },
  { value: "Europe/Paris", label: "Paris (CET/CEST)" },
  { value: "Europe/Berlin", label: "Berlin (CET/CEST)" },
  { value: "Asia/Kolkata", label: "India (IST)" },
  { value: "Asia/Tokyo", label: "Tokyo (JST)" },
  { value: "Asia/Seoul", label: "Seoul (KST)" },
  { value: "Asia/Shanghai", label: "Shanghai (CST)" },
  { value: "Asia/Hong_Kong", label: "Hong Kong (HKT)" },
  { value: "Asia/Singapore", label: "Singapore (SGT)" },
  { value: "Asia/Dubai", label: "Dubai (GST)" },
  { value: "Australia/Sydney", label: "Sydney (AEST/AEDT)" },
  { value: "Pacific/Auckland", label: "Auckland (NZST/NZDT)" },
];
