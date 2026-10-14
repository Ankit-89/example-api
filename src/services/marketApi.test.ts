
import { afterEach, beforeEach, expect, it, jest } from "@jest/globals";
import { getMarketData } from "./marketApi";

const mockResponse = (
  status: number,
  body: unknown
): Response =>
  ({
    ok: status >= 200 && status < 300,
    status,
    json: jest.fn().mockResolvedValue(body),
  }) as unknown as Response;

beforeEach(() => {
  jest.useRealTimers();
});

afterEach(() => {
  jest.restoreAllMocks();
  jest.unstubAllGlobals();
  jest.useRealTimers();
});

it("retries a 503 and succeeds on the next attempt", async () => {
  const fetchMock = jest
    .fn<typeof fetch>()
    .mockResolvedValueOnce(mockResponse(503, {}))
    .mockResolvedValueOnce(mockResponse(200, { price: 25000 }));

  jest.stubGlobal("fetch", fetchMock);

  const result = await getMarketData("NIFTY", {
    maxRetries: 2,
    retryDelayMs: 1,
  });

  expect(result).toEqual({ symbol: "NIFTY", price: 25000 });
  expect(fetchMock).toHaveBeenCalledTimes(2);
});

it("does not retry a non-retryable HTTP 400", async () => {
  const fetchMock = jest
    .fn<typeof fetch>()
    .mockResolvedValue(mockResponse(400, {}));

  jest.stubGlobal("fetch", fetchMock);

  await expect(
    getMarketData("BANKNIFTY", {
      maxRetries: 3,
      retryDelayMs: 1,
    })
  ).rejects.toThrow("HTTP 400");

  expect(fetchMock).toHaveBeenCalledTimes(1);
});

it("stops after the configured number of retries", async () => {
  const fetchMock = jest
    .fn<typeof fetch>()
    .mockResolvedValue(mockResponse(503, {}));

  jest.stubGlobal("fetch", fetchMock);

  await expect(
    getMarketData("FINNIFTY", {
      maxRetries: 2,
      retryDelayMs: 1,
    })
  ).rejects.toThrow("HTTP 503");

  // One initial attempt + two retries.
  expect(fetchMock).toHaveBeenCalledTimes(3);
});

it("rejects malformed market data", async () => {
  const fetchMock = jest
    .fn<typeof fetch>()
    .mockResolvedValue(mockResponse(200, { price: "25000" }));

  jest.stubGlobal("fetch", fetchMock);

  await expect(
    getMarketData("SENSEX", {
      maxRetries: 0,
    })
  ).rejects.toThrow("Invalid market data response");

  expect(fetchMock).toHaveBeenCalledTimes(1);
});

it("deduplicates simultaneous calls for the same symbol", async () => {
  let resolveFetch!: (value: Response) => void;

  const fetchMock = jest.fn<typeof fetch>(
    () =>
      new Promise<Response>((resolve) => {
        resolveFetch = resolve;
      })
  );

  jest.stubGlobal("fetch", fetchMock);

  const first = getMarketData("NIFTY");
  const second = getMarketData(" nifty ");

  expect(fetchMock).toHaveBeenCalledTimes(1);

  resolveFetch(mockResponse(200, { price: 25000 }));

  await expect(Promise.all([first, second])).resolves.toEqual([
    { symbol: "NIFTY", price: 25000 },
    { symbol: "NIFTY", price: 25000 },
  ]);
});
