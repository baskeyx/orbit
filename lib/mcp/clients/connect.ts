import { Client } from '@modelcontextprotocol/client';

export async function connectAll(factories: (() => Promise<Client>)[]) {
  const results = await Promise.allSettled(factories.map((f) => f()));
  const clients = results.flatMap((r) =>
    r.status === 'fulfilled' ? [r.value] : [],
  );
  const close = () => Promise.all(clients.map((c) => c.close()));

  const failed = results.find((r) => r.status === 'rejected');
  if (failed) {
    await close();
    throw failed.reason;
  }
  return { clients, close };
}
