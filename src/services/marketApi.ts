
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
    this.name = "HttpError";
  }
}

export class MarketDataValidationError extends Error {
  constructor(message = "Invalid market data response") {
    super(message);
    this.name = "MarketDataValidationError";
  }
}

const inFlight = new Map<string, Promise<MarketData>>();

function isRetryable(error: unknown): boolean {
  if (error instanceof MarketDataValidationError) {
    return false;
  }

  if (error instanceof HttpError) {
    return [429, 500, 502, 503, 504].includes(error.status);
  }

  // Network failures and abort timeouts are transient candidates.
  return true;
}

async function fetchOnce(
  symbol: string,
  fetchImpl: typeof fetch,
  timeoutMs: number
): Promise<MarketData> {
  const controller = new AbortController();
  let timeoutTriggered = false;

  const timeout = setTimeout(() => {
    timeoutTriggered = true;
    controller.abort();
  }, timeoutMs);

  try {
    const response = await fetchImpl(
      `/api/market-data?symbol=${encodeURIComponent(symbol)}`,
      { signal: controller.signal }
    );

    if (!response.ok) {
      throw new HttpError(response.status);
    }

    // The same timeout also covers response body parsing.
    const payload: unknown = await response.json();

    if (
      typeof payload !== "object" ||
      payload === null ||
      !("price" in payload) ||
      typeof payload.price !== "number" ||
      !Number.isFinite(payload.price) ||
      payload.price < 0
    ) {
      throw new MarketDataValidationError();
    }

    return {
      symbol,
      price: payload.price
    };
  } catch (error) {
    if (timeoutTriggered) {
      throw new Error("Market data request timed out");
    }

    throw error;
  } finally {
    clearTimeout(timeout);
  }
}

export async function getMarketData(
  symbol: string,
  options: MarketApiOptions = {}
): Promise<MarketData> {
  const normalizedSymbol = symbol.trim().toUpperCase();

  if (!normalizedSymbol) {
    throw new Error("Symbol is required");
  }

  const existing = inFlight.get(normalizedSymbol);

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
        if (!isRetryable(error) || attempt >= maxRetries) {
          throw error;
        }

        await new Promise<void>((resolve) => {
          setTimeout(resolve, retryDelayMs * 2 ** attempt);
        });
      }
    }
  })();

  inFlight.set(normalizedSymbol, request);

  try {
    return await request;
  } finally {
    // Don't delete a newer request if this implementation is extended later.
    if (inFlight.get(normalizedSymbol) === request) {
      inFlight.delete(normalizedSymbol);
    }
  }
}
