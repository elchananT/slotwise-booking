import { DateTime, Info } from "luxon";

export const WEEKDAYS_SHORT = ["Sun", "Mon", "Tue", "Wed", "Thu", "Fri", "Sat"];
export const WEEKDAYS_LONG = ["Sunday", "Monday", "Tuesday", "Wednesday", "Thursday", "Friday", "Saturday"];

export function browserZone(): string {
  try {
    return Intl.DateTimeFormat().resolvedOptions().timeZone || "UTC";
  } catch {
    return "UTC";
  }
}

export function isValidZone(zone: string): boolean {
  return DateTime.local().setZone(zone).isValid;
}

export function allZones(): string[] {
  try {
    const fn = (Intl as unknown as { supportedValuesOf?: (k: string) => string[] }).supportedValuesOf;
    if (fn) return fn("timeZone");
  } catch {
    /* fall through */
  }
  return ["UTC", "Europe/London", "Europe/Berlin", "Asia/Jerusalem", "America/New_York", "America/Los_Angeles"];
}

/** weekday as 0=Sunday..6=Saturday for a luxon DateTime (luxon: 1=Mon..7=Sun). */
export const weekdayIndex = (dt: DateTime) => dt.weekday % 7;

export function inZone(iso: string, zone: string) {
  return DateTime.fromISO(iso, { zone: "utc" }).setZone(zone);
}

export function nowIn(zone: string) {
  return DateTime.now().setZone(zone);
}

export function zoneLabel(zone: string, at?: DateTime) {
  const dt = (at ?? DateTime.now()).setZone(zone);
  const city = zone.split("/").pop()?.replace(/_/g, " ") ?? zone;
  return `${city} time (GMT${dt.toFormat("Z")})`;
}

export function fmtTime(iso: string, zone: string) {
  return inZone(iso, zone).toFormat("h:mm a");
}
export function fmtTimeShort(iso: string, zone: string) {
  const dt = inZone(iso, zone);
  return dt.minute === 0 ? dt.toFormat("h a") : dt.toFormat("h:mm a");
}
export function fmtDate(iso: string, zone: string) {
  return inZone(iso, zone).toFormat("ccc, LLL d");
}
export function fmtDateLong(iso: string, zone: string) {
  return inZone(iso, zone).toFormat("cccc, LLLL d");
}
export function fmtDateTime(iso: string, zone: string) {
  return inZone(iso, zone).toFormat("ccc, LLL d · h:mm a");
}

export function minuteLabel(min: number) {
  const h = Math.floor(min / 60) % 24;
  const m = min % 60;
  const dt = DateTime.fromObject({ hour: h, minute: m });
  return min >= 1440 ? "12:00 AM" : m === 0 ? dt.toFormat("h a") : dt.toFormat("h:mm a");
}

export function weekStart(dt: DateTime) {
  // Sunday-first weeks, in dt's zone
  const base = dt.startOf("day");
  return base.minus({ days: weekdayIndex(base) });
}

export function monthDays(month: DateTime) {
  const first = month.startOf("month");
  const lead = weekdayIndex(first);
  const cells: Array<DateTime | null> = Array.from({ length: lead }, () => null);
  for (let d = 0; d < month.daysInMonth!; d++) cells.push(first.plus({ days: d }));
  while (cells.length % 7 !== 0) cells.push(null);
  return cells;
}

export { DateTime, Info };
