
export async function fetchWithTimeout(
  url: string,
  timeoutMs = 5000,
  signal?: AbortSignal
): Promise<Response> {
  const controller = new AbortController();

  const abortFromCaller = () => controller.abort();

  if (signal?.aborted) {
    controller.abort();
  } else {
    signal?.addEventListener("abort", abortFromCaller, {
      once: true,
    });
  }

  const timeoutId = setTimeout(() => {
    controller.abort();
  }, timeoutMs);

  try {
    return await fetch(url, {
      signal: controller.signal,
    });
  } finally {
    clearTimeout(timeoutId);
    signal?.removeEventListener("abort", abortFromCaller);
  }
}
