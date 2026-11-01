import { createServer, type IncomingMessage, type Server, type ServerResponse } from 'http';
import type { AddressInfo } from 'net';
import { SafeHttpClient, type HttpCheckInput } from './safe-http.client';
import { UnsafeTargetError, UrlSafetyService } from './url-safety.service';

function input(url: string, timeoutMs = 2000): HttpCheckInput {
  return {
    url,
    method: 'GET',
    timeoutMs,
    headers: [],
    expectedStatusMin: 200,
    expectedStatusMax: 299,
  };
}

async function startServer(
  handler: (request: IncomingMessage, response: ServerResponse) => void,
): Promise<{ server: Server; base: string }> {
  const server = createServer(handler);
  await new Promise<void>((resolve) => server.listen(0, '127.0.0.1', resolve));
  const address = server.address() as AddressInfo;
  return { server, base: `http://127.0.0.1:${address.port}` };
}

async function stopServer(server: Server): Promise<void> {
  server.closeAllConnections?.();
  await new Promise<void>((resolve, reject) =>
    server.close((error) => (error ? reject(error) : resolve())),
  );
}

function permissiveSafety(): UrlSafetyService {
  const safety = new UrlSafetyService();
  safety.assertSafeUrl = jest.fn(async (raw: string) => {
    const url = new URL(raw);
    return {
      url,
      hostname: url.hostname,
      addresses: ['127.0.0.1'],
      family: 4 as const,
    };
  }) as unknown as typeof safety.assertSafeUrl;
  return safety;
}

describe('SafeHttpClient', () => {
  it('rejects a private target before opening a connection', async () => {
    const client = new SafeHttpClient(new UrlSafetyService());
    const outcome = await client.perform(input('http://127.0.0.1:9/health'));
    expect(outcome.successful).toBe(false);
    expect(outcome.errorCode).toBe('UNSAFE_TARGET');
  });

  it('follows a validated redirect manually and records the count', async () => {
    const { server, base } = await startServer((request, response) => {
      if (request.url === '/redirect') {
        response.writeHead(302, { Location: '/ok' });
        response.end();
        return;
      }
      response.writeHead(200, { 'Content-Type': 'text/plain' });
      response.end('ok');
    });
    try {
      const client = new SafeHttpClient(permissiveSafety());
      const outcome = await client.perform(input(`${base}/redirect`));
      expect(outcome.successful).toBe(true);
      expect(outcome.httpStatus).toBe(200);
      expect(outcome.redirectCount).toBe(1);
    } finally {
      await stopServer(server);
    }
  });

  it('rejects a redirect to a non-public address', async () => {
    const { server, base } = await startServer((_request, response) => {
      response.writeHead(302, { Location: 'http://169.254.169.254/latest/meta-data' });
      response.end();
    });
    try {
      const safety = permissiveSafety();
      const original = safety.assertSafeUrl;
      safety.assertSafeUrl = jest.fn(async (raw: string) => {
        if (raw.includes('169.254.169.254')) {
          throw new UnsafeTargetError('Target IP address is not public');
        }
        return original(raw);
      }) as unknown as typeof safety.assertSafeUrl;

      const client = new SafeHttpClient(safety);
      const outcome = await client.perform(input(`${base}/redirect`));
      expect(outcome.successful).toBe(false);
      expect(outcome.errorCode).toBe('UNSAFE_REDIRECT');
    } finally {
      await stopServer(server);
    }
  });

  it('enforces the request timeout', async () => {
    const { server, base } = await startServer(() => {
      // Intentionally never respond.
    });
    try {
      const client = new SafeHttpClient(permissiveSafety());
      const outcome = await client.perform(input(`${base}/slow`, 150));
      expect(outcome.successful).toBe(false);
      expect(outcome.errorCode).toBe('TIMEOUT');
    } finally {
      await stopServer(server);
    }
  });

  it('marks an unexpected status as unsuccessful without throwing', async () => {
    const { server, base } = await startServer((_request, response) => {
      response.writeHead(503);
      response.end();
    });
    try {
      const client = new SafeHttpClient(permissiveSafety());
      const outcome = await client.perform(input(`${base}/unavailable`));
      expect(outcome.successful).toBe(false);
      expect(outcome.httpStatus).toBe(503);
      expect(outcome.errorCode).toBe('UNEXPECTED_STATUS');
    } finally {
      await stopServer(server);
    }
  });
});
