export interface IcsEvent {
  uid: string;
  stamp: Date;
  start: Date;
  end: Date;
  summary: string;
  description: string;
  location: string;
  cancelled: boolean;
}

const LINE_LIMIT = 75;

/** RFC 5545 text escaping: backslash, semicolon, comma and newline. */
export function escapeIcsText(value: string): string {
  return value
    .replace(/\\/g, '\\\\')
    .replace(/;/g, '\\;')
    .replace(/,/g, '\\,')
    .replace(/\r?\n/g, '\\n');
}

/** Folds a content line at 75 characters; continuation lines start with a space. */
export function foldIcsLine(line: string): string {
  if (line.length <= LINE_LIMIT) {
    return line;
  }
  const parts: string[] = [line.slice(0, LINE_LIMIT)];
  for (let i = LINE_LIMIT; i < line.length; i += LINE_LIMIT - 1) {
    parts.push(` ${line.slice(i, i + LINE_LIMIT - 1)}`);
  }
  return parts.join('\r\n');
}

/** UTC timestamp in the basic format used by iCalendar, e.g. 20300107T070000Z. */
export function icsUtc(date: Date): string {
  return date
    .toISOString()
    .replace(/[-:]/g, '')
    .replace(/\.\d{3}Z$/, 'Z');
}

export function buildIcs(event: IcsEvent): string {
  const lines = [
    'BEGIN:VCALENDAR',
    'VERSION:2.0',
    'PRODID:-//Slotwise//Booking//EN',
    'CALSCALE:GREGORIAN',
    'BEGIN:VEVENT',
    `UID:${event.uid}`,
    `DTSTAMP:${icsUtc(event.stamp)}`,
    `DTSTART:${icsUtc(event.start)}`,
    `DTEND:${icsUtc(event.end)}`,
    `SUMMARY:${escapeIcsText(event.summary)}`,
    `DESCRIPTION:${escapeIcsText(event.description)}`,
    `LOCATION:${escapeIcsText(event.location)}`,
    `STATUS:${event.cancelled ? 'CANCELLED' : 'CONFIRMED'}`,
    'END:VEVENT',
    'END:VCALENDAR',
  ];
  return `${lines.map(foldIcsLine).join('\r\n')}\r\n`;
}
