export type MarketData = {
  symbol: string;
  price: number;
};

export type MarketApiOptions = {
  timeoutMs?: number;
  maxRetries?: number;
  retryDelayMs?: number;
  fetchImpl?: typeof fetch;
};

export class HttpError extends Error {
  constructor(public readonly status: number) {
    super(`HTTP ${status}`);
    this.name = 'HttpError';
  }
}

export class MarketDataValidationError extends Error {
  constructor(message = 'Invalid market data response') {
    super(message);
    this.name = 'MarketDataValidationError';
  }
}

// Dedicated error for malformed JSON responses.
// This error is non-retryable.
export class MarketDataParseError extends Error {
  constructor(message = 'Response body is not valid JSON') {
    super(message);
    this.name = 'MarketDataParseError';
  }
}

const inFlightRequests = new Map<string, Promise<MarketData>>();

function isRetryable(error: unknown): boolean {
  if (
    error instanceof MarketDataValidationError ||
    error instanceof MarketDataParseError
  ) {
    return false;
  }

  if (error instanceof HttpError) {
    return [429, 500, 502, 503, 504].includes(error.status);
  }

  // Network errors and timeout errors are treated as transient.
  return true;
}

async function fetchOnce(
  symbol: string,
  fetchImpl: typeof fetch,
  timeoutMs: number
): Promise<MarketData> {
  const controller = new AbortController();
  let timeoutHandle: ReturnType<typeof setTimeout> | undefined;

  const timeoutPromise = new Promise<never>((_resolve, reject) => {
    timeoutHandle = setTimeout(() => {
      controller.abort();

      const error = new Error(
        `Request timed out after ${timeoutMs}ms`
      );
      error.name = 'TimeoutError';

      reject(error);
    }, timeoutMs);
  });

  const requestPromise = (async (): Promise<MarketData> => {
    const response = await fetchImpl(
      `/api/market-data?symbol=${encodeURIComponent(symbol)}`,
      { signal: controller.signal }
    );

    if (!response.ok) {
      throw new HttpError(response.status);
    }

    let payload: unknown;

    try {
      payload = await response.json();
    } catch {
      // Any failure while parsing the response body is treated as
      // a non-retryable response parsing error.
      throw new MarketDataParseError();
    }

    if (
      typeof payload !== 'object' ||
      payload === null ||
      !('price' in payload) ||
      typeof payload.price !== 'number' ||
      !Number.isFinite(payload.price) ||
      payload.price < 0
    ) {
      throw new MarketDataValidationError();
    }

    return {
      symbol,
      price: payload.price
    };
  })();

  try {
    return await Promise.race([
      requestPromise,
      timeoutPromise
    ]);
  } finally {
    if (timeoutHandle !== undefined) {
      clearTimeout(timeoutHandle);
    }
  }
}

export async function getMarketData(
  symbol: string,
  options: MarketApiOptions = {}
): Promise<MarketData> {
  const normalizedSymbol = symbol.trim().toUpperCase();

  if (!normalizedSymbol) {
    throw new Error('Symbol is required');
  }

  const existing = inFlightRequests.get(normalizedSymbol);

  if (existing) {
    return existing;
  }

  const fetchImpl = options.fetchImpl ?? fetch;
  const timeoutMs = options.timeoutMs ?? 5000;
  const maxRetries = options.maxRetries ?? 2;
  const retryDelayMs = options.retryDelayMs ?? 100;

  const request = (async () => {
    for (let attempt = 0; ; attempt++) {
      try {
        return await fetchOnce(
          normalizedSymbol,
          fetchImpl,
          timeoutMs
        );
      } catch (error) {
        if (
          !isRetryable(error) ||
          attempt >= maxRetries
        ) {
          throw error;
        }

        await new Promise<void>((resolve) => {
          setTimeout(
            resolve,
            retryDelayMs * 2 ** attempt
          );
        });
      }
    }
  })().finally(() => {
    if (inFlightRequests.get(normalizedSymbol) === request) {
      inFlightRequests.delete(normalizedSymbol);
    }
  });

  inFlightRequests.set(normalizedSymbol, request);

  return request;
}

// Used by tests to isolate module-level request state.
export function clearMarketDataRequestState(): void {
  inFlightRequests.clear();
}