export class DateWindowTimeZoneError extends Error {
  code: "INVALID_DATE" | "INVALID_TIMEZONE";

  constructor(code: "INVALID_DATE" | "INVALID_TIMEZONE", message: string) {
    super(message);
    this.code = code;
  }
}

interface DateParts {
  year: number;
  month: number;
  day: number;
}

interface DateTimeParts extends DateParts {
  hour: number;
  minute: number;
  second: number;
}

const DATE_KEY_REGEX = /^\d{4}-\d{2}-\d{2}$/;

function parseDateKey(dateKey: string): DateParts {
  if (!DATE_KEY_REGEX.test(dateKey)) {
    throw new DateWindowTimeZoneError("INVALID_DATE", "date must be YYYY-MM-DD");
  }

  const [yearStr, monthStr, dayStr] = dateKey.split("-");
  const year = Number(yearStr);
  const month = Number(monthStr);
  const day = Number(dayStr);
  if (!Number.isInteger(year) || !Number.isInteger(month) || !Number.isInteger(day)) {
    throw new DateWindowTimeZoneError("INVALID_DATE", "invalid date");
  }

  return { year, month, day };
}

function getDateFormatter(timezone: string): Intl.DateTimeFormat {
  try {
    return new Intl.DateTimeFormat("en-US", {
      timeZone: timezone,
      year: "numeric",
      month: "2-digit",
      day: "2-digit",
      hour: "2-digit",
      minute: "2-digit",
      second: "2-digit",
      hourCycle: "h23"
    });
  } catch {
    throw new DateWindowTimeZoneError("INVALID_TIMEZONE", "invalid timezone");
  }
}

export function isValidTimeZone(timezone: string): boolean {
  const trimmed = timezone.trim();
  if (!trimmed) {
    return false;
  }
  try {
    // eslint-disable-next-line no-new
    new Intl.DateTimeFormat("en-US", { timeZone: trimmed });
    return true;
  } catch {
    return false;
  }
}

function readTimeZoneParts(date: Date, timezone: string): DateTimeParts {
  const formatter = getDateFormatter(timezone);
  const parts = formatter.formatToParts(date);
  const map = Object.fromEntries(parts.map((part) => [part.type, part.value]));

  return {
    year: Number(map.year ?? "1970"),
    month: Number(map.month ?? "01"),
    day: Number(map.day ?? "01"),
    hour: Number(map.hour ?? "00"),
    minute: Number(map.minute ?? "00"),
    second: Number(map.second ?? "00")
  };
}

function zonedDateTimeToUtc(parts: DateTimeParts, timezone: string): Date {
  const utcGuess = Date.UTC(
    parts.year,
    parts.month - 1,
    parts.day,
    parts.hour,
    parts.minute,
    parts.second
  );
  const zoned = readTimeZoneParts(new Date(utcGuess), timezone);
  const zonedAsUtc = Date.UTC(
    zoned.year,
    zoned.month - 1,
    zoned.day,
    zoned.hour,
    zoned.minute,
    zoned.second
  );
  const offset = zonedAsUtc - utcGuess;
  return new Date(utcGuess - offset);
}

function addOneDay(parts: DateParts): DateParts {
  const base = new Date(Date.UTC(parts.year, parts.month - 1, parts.day));
  base.setUTCDate(base.getUTCDate() + 1);
  return {
    year: base.getUTCFullYear(),
    month: base.getUTCMonth() + 1,
    day: base.getUTCDate()
  };
}

export function buildDateWindowForDateKey(
  dateKey: string,
  timezone: string
): { start: Date; endExclusive: Date } {
  const normalizedTimezone = timezone.trim() || "UTC";
  if (!isValidTimeZone(normalizedTimezone)) {
    throw new DateWindowTimeZoneError("INVALID_TIMEZONE", "invalid timezone");
  }

  const target = parseDateKey(dateKey);
  const next = addOneDay(target);
  const start = zonedDateTimeToUtc(
    { ...target, hour: 0, minute: 0, second: 0 },
    normalizedTimezone
  );
  const endExclusive = zonedDateTimeToUtc(
    { ...next, hour: 0, minute: 0, second: 0 },
    normalizedTimezone
  );

  return { start, endExclusive };
}

export function getDateKeyInTimeZone(date: Date, timezone: string): string {
  const normalizedTimezone = timezone.trim() || "UTC";
  if (!isValidTimeZone(normalizedTimezone)) {
    throw new DateWindowTimeZoneError("INVALID_TIMEZONE", "invalid timezone");
  }
  const zoned = readTimeZoneParts(date, normalizedTimezone);
  return `${String(zoned.year).padStart(4, "0")}-${String(zoned.month).padStart(2, "0")}-${String(
    zoned.day
  ).padStart(2, "0")}`;
}

export function shiftDateKeyByDays(dateKey: string, deltaDays: number): string {
  const target = parseDateKey(dateKey);
  const base = new Date(Date.UTC(target.year, target.month - 1, target.day));
  base.setUTCDate(base.getUTCDate() + Math.trunc(deltaDays));
  return `${String(base.getUTCFullYear()).padStart(4, "0")}-${String(base.getUTCMonth() + 1).padStart(
    2,
    "0"
  )}-${String(base.getUTCDate()).padStart(2, "0")}`;
}
