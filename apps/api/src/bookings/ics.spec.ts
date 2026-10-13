import { buildIcs, escapeIcsText, foldIcsLine, icsUtc } from './ics';

describe('ics', () => {
  it('escapes text values as RFC 5545 requires', () => {
    expect(escapeIcsText('Cut, color; "wash"\\ttl\nnext')).toBe(
      'Cut\\, color\\; "wash"\\\\ttl\\nnext',
    );
  });

  it('writes instants in UTC basic format', () => {
    expect(icsUtc(new Date('2030-01-07T07:05:09.123Z'))).toBe(
      '20300107T070509Z',
    );
  });

  it('folds long lines at 75 characters with a leading space', () => {
    const folded = foldIcsLine('A'.repeat(80));
    const [first, second] = folded.split('\r\n');
    expect(first).toHaveLength(75);
    expect(second).toBe(` ${'A'.repeat(5)}`);
  });

  it('builds a calendar event for a booking with CRLF line endings', () => {
    const ics = buildIcs({
      uid: 'SW-7K3Q9D@slotwise',
      stamp: new Date('2030-01-01T00:00:00Z'),
      start: new Date('2030-01-07T07:00:00Z'),
      end: new Date('2030-01-07T08:00:00Z'),
      summary: 'Cut at Lumen Studio',
      description: 'Reference SW-7K3Q9D',
      location: 'Dizengoff 1, Tel Aviv',
      cancelled: false,
    });

    expect(ics.startsWith('BEGIN:VCALENDAR\r\n')).toBe(true);
    expect(ics).toContain('DTSTART:20300107T070000Z\r\n');
    expect(ics).toContain('DTEND:20300107T080000Z\r\n');
    expect(ics).toContain('LOCATION:Dizengoff 1\\, Tel Aviv\r\n');
    expect(ics).toContain('STATUS:CONFIRMED\r\n');
    expect(ics.endsWith('END:VCALENDAR\r\n')).toBe(true);
  });
});
