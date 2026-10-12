import { BadRequestException } from '@nestjs/common';

export interface WorkingWindow {
  weekday: number;
  startMinute: number;
  endMinute: number;
}

/**
 * Weekly hours are stored as minute windows per weekday. A window must end
 * after it starts, and windows on the same weekday must not overlap. Touching
 * windows (09:00-12:00 and 12:00-15:00) are allowed.
 */
export function assertValidWeeklyHours(
  windows: readonly WorkingWindow[],
): void {
  for (const window of windows) {
    if (window.endMinute <= window.startMinute) {
      throw new BadRequestException(
        `A working window on weekday ${window.weekday} must end after it starts`,
      );
    }
  }

  const byWeekday = new Map<number, WorkingWindow[]>();
  for (const window of windows) {
    const day = byWeekday.get(window.weekday) ?? [];
    day.push(window);
    byWeekday.set(window.weekday, day);
  }

  for (const [weekday, day] of byWeekday) {
    const sorted = [...day].sort((a, b) => a.startMinute - b.startMinute);
    for (let i = 1; i < sorted.length; i++) {
      if (sorted[i].startMinute < sorted[i - 1].endMinute) {
        throw new BadRequestException(
          `Working windows overlap on weekday ${weekday}`,
        );
      }
    }
  }
}
