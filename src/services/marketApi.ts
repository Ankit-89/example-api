
export type MarketData = {
  symbol: string;
  price: number;
};

type MarketApiOptions = {
  maxRetries?: number;
  retryDelayMs?: number;
};

const inFlightRequests = new Map<string, Promise<MarketData>>();

const sleep = (ms: number): Promise<void> =>
  new Promise((resolve) => setTimeout(resolve, ms));

export async function getMarketData(
  symbol: string,
  options: MarketApiOptions = {}
): Promise<MarketData> {
  const normalizedSymbol = symbol.trim().toUpperCase();

  if (!normalizedSymbol) {
    throw new Error("Symbol is required");
  }

  const existing = inFlightRequests.get(normalizedSymbol);
  if (existing) return existing;

  const request = fetchWithRetry(normalizedSymbol, options).finally(
    () => {
      inFlightRequests.delete(normalizedSymbol);
    }
  );

  inFlightRequests.set(normalizedSymbol, request);
  return request;
}

async function fetchWithRetry(
  symbol: string,
  options: MarketApiOptions
): Promise<MarketData> {
  const maxRetries = options.maxRetries ?? 2;
  const retryDelayMs = options.retryDelayMs ?? 200;

  for (let attempt = 0; ; attempt++) {
    try {
      const response = await fetch(
        `/api/market-data?symbol=${encodeURIComponent(symbol)}`
      );

      if (!response.ok) {
        const error = new Error(`HTTP ${response.status}`);
        Object.assign(error, { status: response.status });
        throw error;
      }

      const data: unknown = await response.json();

      if (
        typeof data !== "object" ||
        data === null ||
        !("price" in data) ||
        typeof data.price !== "number" ||
        !Number.isFinite(data.price) ||
        data.price < 0
      ) {
        throw new Error("Invalid market data response");
      }

      return { symbol, price: data.price };
    } catch (error) {
      const status =
        typeof error === "object" &&
        error !== null &&
        "status" in error
          ? error.status
          : undefined;

      const retryable =
        status === undefined ||
        status === 429 ||
        status === 500 ||
        status === 502 ||
        status === 503 ||
        status === 504;

      if (!retryable || attempt >= maxRetries) {
        throw error;
      }

      // Exponential backoff: 200ms, 400ms, 800ms...
      await sleep(retryDelayMs * 2 ** attempt);
    }
  }
}
