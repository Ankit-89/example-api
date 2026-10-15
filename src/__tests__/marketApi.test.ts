import { afterEach, beforeEach, describe, expect, it, jest } from '@jest/globals';
import {
  clearMarketDataRequestState,
  getMarketData,
  HttpError,
  MarketDataValidationError,
} from '../services/marketApi';

const response = (status: number, body: unknown): Response => ({
  ok: status >= 200 && status < 300,
  status,
  json: jest.fn().mockResolvedValue(body),
} as unknown as Response);

beforeEach(() => {
  clearMarketDataRequestState();
  jest.useRealTimers();
});

afterEach(() => {
  jest.useRealTimers();
  jest.restoreAllMocks();
});

describe('getMarketData', () => {
  it('deduplicates simultaneous requests for a normalized symbol', async () => {
    let resolveFetch!: (value: Response) => void;
    const fetchMock = jest.fn<typeof fetch>(
      () => new Promise<Response>((resolve) => { resolveFetch = resolve; })
    );
    const first = getMarketData('NIFTY', { fetchImpl: fetchMock });
    const second = getMarketData(' nifty ', { fetchImpl: fetchMock });
    expect(fetchMock).toHaveBeenCalledTimes(1);
    resolveFetch(response(200, { price: 25000 }));
    await expect(Promise.all([first, second])).resolves.toEqual([
      { symbol: 'NIFTY', price: 25000 },
      { symbol: 'NIFTY', price: 25000 },
    ]);
  });

  it('retries HTTP 429 with default retry count and succeeds', async () => {
    const fetchMock = jest.fn<typeof fetch>()
      .mockResolvedValueOnce(response(429, {}))
      .mockResolvedValueOnce(response(200, { price: 25001 }));
    await expect(getMarketData('NIFTY', {
      fetchImpl: fetchMock, retryDelayMs: 0,
    })).resolves.toEqual({ symbol: 'NIFTY', price: 25001 });
    expect(fetchMock).toHaveBeenCalledTimes(2);
  });

  it('makes three total attempts for persistent HTTP 429 with default retries', async () => {
    const fetchMock = jest.fn<typeof fetch>().mockResolvedValue(response(429, {}));
    await expect(getMarketData('NIFTY', {
      fetchImpl: fetchMock, retryDelayMs: 0,
    })).rejects.toBeInstanceOf(HttpError);
    expect(fetchMock).toHaveBeenCalledTimes(3); // initial + 2 retries
  });

  it('does not retry invalid data with default retry count', async () => {
    const fetchMock = jest.fn<typeof fetch>()
      .mockResolvedValue(response(200, { price: '25000' }));
    await expect(getMarketData('NIFTY', {
      fetchImpl: fetchMock, retryDelayMs: 0,
    })).rejects.toBeInstanceOf(MarketDataValidationError);
    expect(fetchMock).toHaveBeenCalledTimes(1);
  });

  it('does not retry ordinary HTTP 400 errors', async () => {
    const fetchMock = jest.fn<typeof fetch>().mockResolvedValue(response(400, {}));
    await expect(getMarketData('NIFTY', {
      fetchImpl: fetchMock, retryDelayMs: 0,
    })).rejects.toThrow('HTTP 400');
    expect(fetchMock).toHaveBeenCalledTimes(1);
  });

  it('stops after timeout retries and allows a fresh call for the same symbol', async () => {
    // These first two transport calls never settle and deliberately ignore the
    // AbortSignal. The service-level timeout must still release the caller.
    const fetchMock = jest.fn<typeof fetch>()
      .mockImplementationOnce(() => new Promise<Response>(() => undefined))
      .mockImplementationOnce(() => new Promise<Response>(() => undefined))
      .mockResolvedValueOnce(response(200, { price: 25003 }));

    await expect(getMarketData('NIFTY', {
      fetchImpl: fetchMock,
      timeoutMs: 5,
      retryDelayMs: 0,
      maxRetries: 1,
    })).rejects.toThrow('Request timed out after 5ms');
    expect(fetchMock).toHaveBeenCalledTimes(2); // initial + one retry; then stop

    await expect(getMarketData('NIFTY', {
      fetchImpl: fetchMock,
      timeoutMs: 50,
      retryDelayMs: 0,
      maxRetries: 0,
    })).resolves.toEqual({ symbol: 'NIFTY', price: 25003 });
    expect(fetchMock).toHaveBeenCalledTimes(3);
  });

  it('does not retry malformed JSON with the default retry count', async () => {
    const malformedResponse = {
      ok: true,
      status: 200,
      json: jest.fn().mockRejectedValue(new SyntaxError('Unexpected token')),
    } as unknown as Response;
    const fetchMock = jest.fn<typeof fetch>().mockResolvedValue(malformedResponse);

    await expect(getMarketData('NIFTY', {
      fetchImpl: fetchMock,
      retryDelayMs: 0,
    })).rejects.toMatchObject({
      name: 'MarketDataValidationError',
      message: 'Response body is not valid JSON',
    });
    expect(fetchMock).toHaveBeenCalledTimes(1);
  });

  it('rejects blank symbols before making a request', async () => {
    const fetchMock = jest.fn<typeof fetch>();
    await expect(getMarketData('  ', { fetchImpl: fetchMock })).rejects.toThrow('Symbol is required');
    expect(fetchMock).not.toHaveBeenCalled();
  });
});
