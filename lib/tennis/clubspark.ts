import * as z from 'zod/v4';

// ClubSpark's coaching search API: the same request the Clissold Park coaching page makes.
// Undocumented, so it may change without notice.
const SEARCH_URL =
  'https://prd-lta-kube.clubspark.pro/unified-search-api/api/Search/classic-coaching/Query';

const CLISSOLD_PARK_ID = '24e84e6c-f529-4cd1-8793-cb0cc106e6e7';

const SESSION_NAMES = ['Adult Social Tennis', 'Adult Intermediate Drop In'];

type SearchItem = {
  id: string;
  name: string;
  // This session's start with its UK offset, e.g. "2026-10-15T19:00:00+01:00".
  // (startDateTime/endDateTime are the whole course, not this session.)
  nextDateTime: string;
  startTime: string;
  endTime: string;
  remainingAttendeeCapacity: number;
  maximumAttendeeCapacity: number;
  url: string;
};

// Also the MCP tool's output schema, so the two can't drift apart.
export const tennisSessionSchema = z.object({
  name: z.string(),
  start: z.string().describe('Session start, ISO 8601 UTC'),
  end: z.string().describe('Session end, ISO 8601 UTC'),
  placesLeft: z.number(),
  capacity: z.number(),
  url: z.string(),
});

export type TennisSession = z.infer<typeof tennisSessionSchema>;

// There's no end equivalent of nextDateTime, so reuse its date and UK offset
// with endTime ("21:00"). Assumes no session runs past midnight.
function sessionEnd(item: SearchItem): Date {
  const date = item.nextDateTime.slice(0, 10);
  const offset = item.nextDateTime.slice(19);
  return new Date(`${date}T${item.endTime}:00${offset}`);
}

// Sessions with places left that start within [start, end]. ClubSpark has no
// date filter, so every adult session is fetched and filtered here.
export async function getTennisSessions(start: Date, end: Date): Promise<TennisSession[]> {
  const res = await fetch(SEARCH_URL, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json', Accept: 'application/json' },
    body: JSON.stringify({
      options: { size: 100, from: 0, sortKey: 'date' },
      filters: [
        {
          key: 'organisation-id',
          items: [{ value: CLISSOLD_PARK_ID }],
          operator: 'Or',
        },
        { key: 'programme-type', items: [{ value: 'adult' }] },
      ],
    }),
  });
  if (!res.ok) throw new Error(`ClubSpark search failed: ${res.status}`);

  const data: { searchResults: { item: SearchItem }[] } = await res.json();

  // Each result is a single session date with its own capacity.
  return data.searchResults
    .map((result) => result.item)
    .filter((item) => {
      const sessionStart = new Date(item.nextDateTime);
      return (
        SESSION_NAMES.includes(item.name) &&
        item.remainingAttendeeCapacity > 0 &&
        sessionStart >= start &&
        sessionStart <= end
      );
    })
    .map((item) => ({
      name: item.name,
      start: new Date(item.nextDateTime).toISOString(),
      end: sessionEnd(item).toISOString(),
      placesLeft: item.remainingAttendeeCapacity,
      capacity: item.maximumAttendeeCapacity,
      // The API's own `url` field points to a page that doesn't work; the booking page is Coaching/Summary/{id}.
      url: `https://clubspark.lta.org.uk/ClissoldParkHackney/Coaching/Summary/${item.id}`,
    }));
}
