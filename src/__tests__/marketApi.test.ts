
import {
  afterEach,
  beforeEach,
  describe,
  expect,
  it,
  jest
} from "@jest/globals";

import {
  getMarketData,
  HttpError,
  MarketDataValidationError
} from "../services/marketApi";

const makeResponse = (
  status: number,
  body: unknown
): Response => ({
  ok: status >= 200 && status < 300,
  status,
  json: jest.fn<() => Promise<unknown>>().mockResolvedValue(body)
} as unknown as Response);

describe("getMarketData", () => {
  beforeEach(() => {
    jest.useRealTimers();
  });

  afterEach(() => {
    jest.useRealTimers();
    jest.restoreAllMocks();
  });

  it("deduplicates concurrent calls for the same symbol", async () => {
    let resolveFetch!: (response: Response) => void;

    const fetchMock = jest.fn<typeof fetch>(
      () => new Promise<Response>((resolve) => {
        resolveFetch = resolve;
      })
    );

    const first = getMarketData("NIFTY", {
      fetchImpl: fetchMock
    });
    const second = getMarketData(" nifty ", {
      fetchImpl: fetchMock
    });

    expect(fetchMock).toHaveBeenCalledTimes(1);

    resolveFetch(makeResponse(200, { price: 25000 }));

    await expect(Promise.all([first, second])).resolves.toEqual([
      { symbol: "NIFTY", price: 25000 },
      { symbol: "NIFTY", price: 25000 }
    ]);
  });

  it("retries HTTP 429 and succeeds", async () => {
    const fetchMock = jest.fn<typeof fetch>()
      .mockResolvedValueOnce(makeResponse(429, {}))
      .mockResolvedValueOnce(makeResponse(200, { price: 25001 }));

    const result = await getMarketData("NIFTY", {
      fetchImpl: fetchMock,
      retryDelayMs: 0
    });

    expect(result.price).toBe(25001);
    expect(fetchMock).toHaveBeenCalledTimes(2);
  });

  it("stops after the default two retries for persistent HTTP 429", async () => {
    const fetchMock = jest.fn<typeof fetch>()
      .mockResolvedValue(makeResponse(429, {}));

    await expect(getMarketData("NIFTY", {
      fetchImpl: fetchMock,
      retryDelayMs: 0
    })).rejects.toBeInstanceOf(HttpError);

    expect(fetchMock).toHaveBeenCalledTimes(3);
  });

  it("does not retry invalid data with default retry settings", async () => {
    const fetchMock = jest.fn<typeof fetch>()
      .mockResolvedValue(makeResponse(200, {
        price: "25000"
      }));

    await expect(getMarketData("NIFTY", {
      fetchImpl: fetchMock,
      retryDelayMs: 0
    })).rejects.toBeInstanceOf(MarketDataValidationError);

    expect(fetchMock).toHaveBeenCalledTimes(1);
  });

  it("does not retry HTTP 400", async () => {
    const fetchMock = jest.fn<typeof fetch>()
      .mockResolvedValue(makeResponse(400, {}));

    await expect(getMarketData("NIFTY", {
      fetchImpl: fetchMock,
      retryDelayMs: 0
    })).rejects.toThrow("HTTP 400");

    expect(fetchMock).toHaveBeenCalledTimes(1);
  });

  it("rejects a blank symbol without calling fetch", async () => {
    const fetchMock = jest.fn<typeof fetch>();

    await expect(getMarketData("  ", {
      fetchImpl: fetchMock
    })).rejects.toThrow("Symbol is required");

    expect(fetchMock).not.toHaveBeenCalled();
  });
});
