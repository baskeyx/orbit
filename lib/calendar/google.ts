import ical, { type VEvent } from 'node-ical';

export type BusyTime = { start: Date; end: Date };

// Busy periods from the Google Calendar "secret address in iCal format" feed.
// Only times are returned: event titles and details never leave this function.
export async function getBusyTimes(from: Date, to: Date): Promise<BusyTime[]> {
  const url = process.env.GOOGLE_CALENDAR_ICS_URL;
  if (!url) throw new Error('GOOGLE_CALENDAR_ICS_URL is not set');

  const res = await fetch(url);
  if (!res.ok) throw new Error(`Calendar feed failed: ${res.status}`);
  const calendar = ical.sync.parseICS(await res.text());

  const events = Object.values(calendar).filter(
    (component): component is VEvent => component?.type === 'VEVENT',
  );

  // expandRecurringEvent turns repeating events into individual dates
  // (handling exceptions and moved occurrences); one-off events come back as a single instance.
  const busy = events.flatMap((event) =>
    ical
      .expandRecurringEvent(event, { from, to, expandOngoing: true })
      .filter(
        ({ event }) =>
          event.status !== 'CANCELLED' &&
          // Events marked "Free" in Google (most all-day events, e.g. birthdays) don't block time.
          event.transparency !== 'TRANSPARENT',
      )
      .map(({ start, end }) => ({ start: new Date(start), end: new Date(end) })),
  );

  return busy
    .filter(({ start, end }) => start < to && end > from)
    .sort((a, b) => a.start.getTime() - b.start.getTime());
}

export function isBusy(start: Date, end: Date, busyTimes: BusyTime[]) {
  return busyTimes.some((busy) => busy.start < end && busy.end > start);
}
