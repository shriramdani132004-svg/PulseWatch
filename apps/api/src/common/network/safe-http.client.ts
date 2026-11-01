import { Injectable } from '@nestjs/common';
import { request as httpRequest, type RequestOptions } from 'http';
import { request as httpsRequest, type RequestOptions as HttpsRequestOptions } from 'https';
import { Agent as HttpAgent } from 'http';
import { Agent as HttpsAgent } from 'https';
import { isIP } from 'net';
import { UrlSafetyService, UnsafeTargetError } from './url-safety.service';
import type { CustomHeader } from '../crypto/encryption.service';

const MAX_RESPONSE_BYTES = 64 * 1024;
const MAX_REDIRECTS = 3;

export interface HttpCheckInput {
  url: string;
  method: 'GET' | 'HEAD' | 'POST';
  timeoutMs: number;
  headers: CustomHeader[];
  expectedStatusMin: number;
  expectedStatusMax: number;
}

export interface HttpCheckOutcome {
  successful: boolean;
  httpStatus: number | null;
  responseTimeMs: number | null;
  errorCode: string | null;
  sanitizedErrorMessage: string | null;
  redirectCount: number;
}

class HttpCheckError extends Error {
  constructor(
    readonly code: string,
    readonly sanitizedMessage: string,
  ) {
    super(sanitizedMessage);
    this.name = 'HttpCheckError';
  }
}

interface SingleResponse {
  status: number;
  location: string | null;
  responseTimeMs: number;
}

const REDIRECT_CODES = new Set([301, 302, 303, 307, 308]);

@Injectable()
export class SafeHttpClient {
  constructor(private readonly urlSafety: UrlSafetyService) {}

  async perform(input: HttpCheckInput): Promise<HttpCheckOutcome> {
    const startedAt = Date.now();
    const deadline = startedAt + input.timeoutMs;
    let redirectCount = 0;
    let method = input.method;

    try {
      let target = await this.urlSafety.assertSafeUrl(input.url);

      for (;;) {
        const remaining = deadline - Date.now();
        if (remaining <= 0) {
          throw new HttpCheckError('TIMEOUT', `Request timed out after ${input.timeoutMs}ms`);
        }

        const response = await this.requestOnce(target.url, target.hostname, target.addresses[0], method, input.headers, remaining);
        const isRedirect = REDIRECT_CODES.has(response.status) && response.location !== null;

        if (!isRedirect) {
          return this.finalize(response, input, redirectCount);
        }
        if (method !== 'GET' && method !== 'HEAD') {
          return this.finalize(response, input, redirectCount);
        }
        if (redirectCount >= MAX_REDIRECTS) {
          throw new HttpCheckError('REDIRECT_LIMIT', `Redirect limit of ${MAX_REDIRECTS} exceeded`);
        }

        let redirectUrl: URL;
        try {
          redirectUrl = new URL(response.location as string, target.url);
        } catch {
          throw new HttpCheckError('REDIRECT_ERROR', 'Redirect target is invalid');
        }
        try {
          target = await this.urlSafety.assertSafeUrl(redirectUrl.toString());
        } catch (error) {
          if (error instanceof UnsafeTargetError) {
            throw new HttpCheckError('UNSAFE_REDIRECT', 'Redirect target is not a permitted public address');
          }
          throw error;
        }
        redirectCount += 1;
        if (response.status === 303) {
          method = 'GET';
        }
      }
    } catch (error) {
      if (error instanceof HttpCheckError) {
        return {
          successful: false,
          httpStatus: null,
          responseTimeMs: Math.min(Date.now() - startedAt, input.timeoutMs),
          errorCode: error.code,
          sanitizedErrorMessage: error.sanitizedMessage,
          redirectCount,
        };
      }
      if (error instanceof UnsafeTargetError) {
        return {
          successful: false,
          httpStatus: null,
          responseTimeMs: Math.min(Date.now() - startedAt, input.timeoutMs),
          errorCode: 'UNSAFE_TARGET',
          sanitizedErrorMessage: error.message,
          redirectCount,
        };
      }
      return {
        successful: false,
        httpStatus: null,
        responseTimeMs: Math.min(Date.now() - startedAt, input.timeoutMs),
        errorCode: 'INTERNAL_ERROR',
        sanitizedErrorMessage: 'The monitor could not complete the request',
        redirectCount,
      };
    }
  }

  private finalize(response: SingleResponse, input: HttpCheckInput, redirectCount: number): HttpCheckOutcome {
    const inRange = response.status >= input.expectedStatusMin && response.status <= input.expectedStatusMax;
    return {
      successful: inRange,
      httpStatus: response.status,
      responseTimeMs: response.responseTimeMs,
      errorCode: inRange ? null : 'UNEXPECTED_STATUS',
      sanitizedErrorMessage: inRange
        ? null
        : `HTTP ${response.status} is outside the expected range ${input.expectedStatusMin}-${input.expectedStatusMax}`,
      redirectCount,
    };
  }

  private requestOnce(
    url: URL,
    hostname: string,
    pinnedAddress: string,
    method: 'GET' | 'HEAD' | 'POST',
    customHeaders: CustomHeader[],
    timeoutMs: number,
  ): Promise<SingleResponse> {
    return new Promise((resolve, reject) => {
      const startedAt = Date.now();
      const family = isIP(pinnedAddress);
      const headers: Record<string, string> = {
        Accept: '*/*',
        'User-Agent': 'PulseWatch-Monitor/1.0',
        Connection: 'close',
      };
      if (method === 'POST') {
        headers['Content-Length'] = '0';
      }
      for (const header of customHeaders) {
        headers[header.name] = header.value;
      }

      const options: RequestOptions & HttpsRequestOptions = {
        protocol: url.protocol,
        hostname,
        port: url.port ? Number(url.port) : url.protocol === 'https:' ? 443 : 80,
        path: `${url.pathname || '/'}${url.search}`,
        method,
        headers,
        lookup: ((_host: string, lookupOptions: unknown, callback: (...args: unknown[]) => void) => {
          if (lookupOptions && typeof lookupOptions === 'object' && (lookupOptions as { all?: boolean }).all) {
            callback(null, [{ address: pinnedAddress, family }]);
          } else {
            callback(null, pinnedAddress, family);
          }
        }) as RequestOptions['lookup'],
      };

      if (url.protocol === 'https:') {
        options.agent = new HttpsAgent({ keepAlive: false, maxSockets: 1 });
        options.rejectUnauthorized = true;
        if (isIP(hostname) === 0) {
          options.servername = hostname;
        }
      } else {
        options.agent = new HttpAgent({ keepAlive: false, maxSockets: 1 });
      }

      const requester = url.protocol === 'https:' ? httpsRequest : httpRequest;
      let settled = false;
      let timedOut = false;

      const finish = (fn: () => void) => {
        if (settled) return;
        settled = true;
        fn();
      };

      const request = requester(options, (response) => {
        let bytes = 0;
        const complete = () => {
          finish(() =>
            resolve({
              status: response.statusCode ?? 0,
              location: typeof response.headers.location === 'string' ? response.headers.location : null,
              responseTimeMs: Math.max(1, Date.now() - startedAt),
            }),
          );
        };
        response.on('data', (chunk: Buffer) => {
          bytes += chunk.length;
          if (bytes > MAX_RESPONSE_BYTES) {
            response.destroy();
            complete();
          }
        });
        response.on('end', complete);
        response.on('error', () => {
          finish(() =>
            reject(new HttpCheckError('RESPONSE_ERROR', 'The response could not be read completely')),
          );
        });
      });

      request.setTimeout(timeoutMs, () => {
        timedOut = true;
        request.destroy(new Error('request timeout'));
      });

      request.on('error', (error: NodeJS.ErrnoException) => {
        finish(() => reject(this.classifyError(error, timedOut, timeoutMs)));
      });

      request.end();
    });
  }

  private classifyError(error: NodeJS.ErrnoException, timedOut: boolean, timeoutMs: number): HttpCheckError {
    if (timedOut || error.code === 'ETIMEDOUT' || /timeout/i.test(error.message)) {
      return new HttpCheckError('TIMEOUT', `Request timed out after ${timeoutMs}ms`);
    }
    if (error.code === 'ENOTFOUND' || error.code === 'EAI_AGAIN') {
      return new HttpCheckError('DNS_ERROR', 'Target hostname could not be resolved');
    }
    if (
      error.code === 'ECONNREFUSED' ||
      error.code === 'EHOSTUNREACH' ||
      error.code === 'ENETUNREACH'
    ) {
      return new HttpCheckError('CONNECTION_REFUSED', 'The target refused or could not accept the connection');
    }
    if (error.code === 'ECONNRESET' || error.code === 'EPIPE' || error.code === 'ECONNABORTED') {
      return new HttpCheckError('CONNECTION_RESET', 'The connection was reset before a response completed');
    }
    if (
      error.code?.startsWith('CERT_') ||
      error.code === 'UNABLE_TO_VERIFY_LEAF_SIGNATURE' ||
      error.code === 'DEPTH_ZERO_SELF_SIGNED_CERT' ||
      error.code === 'ERR_TLS_CERT_ALTNAME_INVALID'
    ) {
      return new HttpCheckError('TLS_ERROR', 'TLS certificate verification failed');
    }
    return new HttpCheckError('NETWORK_ERROR', 'The request failed before a response was received');
  }
}
