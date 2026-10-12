type Endpoint = {
  href: string;
  title: string;
  description: string;
};

const agents: Endpoint[] = [
  {
    href: '/api/agent',
    title: 'Rock, paper, scissors agent',
    description:
      'Completes the open tasks on the monday.com board by playing rock, paper, scissors until it wins, then marks them Done.',
  },
  {
    href: '/api/agent2',
    title: 'Tennis agent',
    description:
      'Picks the best tennis slot at Clissold Park over the next week from coaching sessions, the weather and your calendar, then comments the result on the task and marks it Done.',
  },
];

const dataSources: Endpoint[] = [
  {
    href: '/api/tennis',
    title: 'Tennis sessions',
    description: 'Adult sessions at Clissold Park with places left, from ClubSpark.',
  },
  {
    href: '/api/weather',
    title: 'Weather forecast',
    description: 'Hourly forecast for Clissold Park, from Open-Meteo.',
  },
  {
    href: '/api/calendar',
    title: 'Calendar busy times',
    description: 'Busy periods from your Google Calendar. Only times, no event details.',
  },
];

function EndpointList({ endpoints }: { endpoints: Endpoint[] }) {
  return (
    <ul className="flex flex-col gap-3">
      {endpoints.map(({ href, title, description }) => (
        <li key={href}>
          <a
            href={href}
            className="block rounded-lg border border-black/[.08] p-4 transition-colors hover:bg-black/[.04] dark:border-white/[.145] dark:hover:bg-[#1a1a1a]"
          >
            <div className="flex flex-wrap items-baseline justify-between gap-2">
              <span className="font-medium">{title}</span>
              <code className="font-mono text-sm text-zinc-500 dark:text-zinc-400">
                GET {href}
              </code>
            </div>
            <p className="mt-1 text-sm leading-6 text-zinc-600 dark:text-zinc-400">
              {description}
            </p>
          </a>
        </li>
      ))}
    </ul>
  );
}

export default function Home() {
  return (
    <main className="mx-auto flex w-full max-w-2xl flex-col gap-10 px-4 py-16 font-sans sm:px-8">
      <header className="flex flex-col gap-3">
        <h1 className="text-3xl font-semibold tracking-tight">Orbit</h1>
        <p className="leading-7 text-zinc-600 dark:text-zinc-400">
          Experiments with AI agents that complete real tasks from a monday.com
          board using MCP tools. Each agent run returns JSON with the final
          response and the token count and cost of every request. Tool calls
          are logged in the terminal running <code className="font-mono">pnpm dev</code>.
        </p>
      </header>

      <section className="flex flex-col gap-4">
        <div>
          <h2 className="text-lg font-semibold">Agents</h2>
          <p className="text-sm leading-6 text-zinc-600 dark:text-zinc-400">
            These call the Anthropic API, which costs money, and change items on
            the monday.com board. They only work on tasks that aren&apos;t Done.
          </p>
        </div>
        <EndpointList endpoints={agents} />
      </section>

      <section className="flex flex-col gap-4">
        <div>
          <h2 className="text-lg font-semibold">Data sources</h2>
          <p className="text-sm leading-6 text-zinc-600 dark:text-zinc-400">
            Call each data source directly, without the agent or MCP, for a fixed
            date range.
          </p>
        </div>
        <EndpointList endpoints={dataSources} />
      </section>
    </main>
  );
}
