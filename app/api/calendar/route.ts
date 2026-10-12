import { getBusyTimes } from '@/lib/calendar/google';

export async function GET() {
  return Response.json(
    await getBusyTimes(
      new Date('2026-10-08T10:00:00+01:00'),
      new Date('2026-10-12T10:00:00+01:00'),
    ),
  );
}
