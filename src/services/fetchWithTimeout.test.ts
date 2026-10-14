
import { afterEach, expect, it, jest } from "@jest/globals";
import { fetchWithTimeout } from "./fetchWithTimeout";

afterEach(() => {
  jest.useRealTimers();
  jest.restoreAllMocks();
  jest.unstubAllGlobals();
});

it("aborts the request when the timeout expires", async () => {
  jest.useFakeTimers();

  const fetchMock = jest.fn<typeof fetch>(
    (_url, init) =>
      new Promise<Response>((_resolve, reject) => {
        init?.signal?.addEventListener("abort", () => {
          reject(new DOMException("Aborted", "AbortError"));
        });
      })
  );

  jest.stubGlobal("fetch", fetchMock);

  const request = fetchWithTimeout("/api/market-data", 1000);

  const assertion = expect(request).rejects.toMatchObject({
    name: "AbortError",
  });

  await jest.advanceTimersByTimeAsync(1000);
  await assertion;

  expect(fetchMock).toHaveBeenCalledTimes(1);
});

it("cancels the request when the caller aborts", async () => {
  const fetchMock = jest.fn<typeof fetch>(
    (_url, init) =>
      new Promise<Response>((_resolve, reject) => {
        init?.signal?.addEventListener("abort", () => {
          reject(new DOMException("Aborted", "AbortError"));
        });
      })
  );

  jest.stubGlobal("fetch", fetchMock);

  const caller = new AbortController();
  const request = fetchWithTimeout(
    "/api/market-data",
    5000,
    caller.signal
  );

  caller.abort();

  await expect(request).rejects.toMatchObject({
    name: "AbortError",
  });
});
