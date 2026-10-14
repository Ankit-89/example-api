
type MarketData = {
  price: number;
};

const inFlightRequests = new Map<string, Promise<MarketData>>();

export async function getMarketData(
  symbol: string
): Promise<MarketData> {
  const existingRequest = inFlightRequests.get(symbol);

  if (existingRequest) {
    return existingRequest;
  }

  const request = fetch(
    `/api/market-data?symbol=${encodeURIComponent(symbol)}`
  )
    .then(async (response) => {
      if (response.status === 429) {
        throw new Error("Rate limit exceeded. Please retry later.");
      }

      if (!response.ok) {
        throw new Error(`API request failed: ${response.status}`);
      }

      const data = await response.json();

      if (typeof data.price !== "number") {
        throw new Error("Invalid market data response");
      }

      return data as MarketData;
    })
    .finally(() => {
      inFlightRequests.delete(symbol);
    });

  inFlightRequests.set(symbol, request);

  return request;
}
