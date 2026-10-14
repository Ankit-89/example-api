
import { afterEach, expect, it, jest } from "@jest/globals";
import { getMarketData } from "./marketApi";

afterEach(() => {
  jest.restoreAllMocks();
  jest.unstubAllGlobals();
});

it("deduplicates simultaneous requests for the same symbol", async () => {
  const fetchMock = jest.fn<typeof fetch>().mockResolvedValue({
    ok: true,
    status: 200,
    json: async () => ({ price: 25000 }),
  } as Response);

  jest.stubGlobal("fetch", fetchMock);

  const [first, second] = await Promise.all([
    getMarketData("NIFTY"),
    getMarketData("NIFTY"),
  ]);

  expect(first.price).toBe(25000);
  expect(second.price).toBe(25000);
  expect(fetchMock).toHaveBeenCalledTimes(1);
});

it("reports HTTP 429 rate-limit errors", async () => {
  const fetchMock = jest.fn<typeof fetch>().mockResolvedValue({
    ok: false,
    status: 429,
  } as Response);

  jest.stubGlobal("fetch", fetchMock);

  await expect(getMarketData("NIFTY")).rejects.toThrow(
    "Rate limit exceeded"
  );
});
