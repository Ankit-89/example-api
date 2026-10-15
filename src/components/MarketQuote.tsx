import React, { useEffect, useState } from 'react';
import { getMarketData, type MarketData } from '../services/marketApi';

type Props = { symbol: string };

export function MarketQuote({ symbol }: Props) {
  const [quote, setQuote] = useState<MarketData | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [loading, setLoading] = useState(false);

  useEffect(() => {
    let active = true;
    setLoading(true);
    setError(null);
    setQuote(null);

    getMarketData(symbol)
      .then((data) => {
        if (active) setQuote(data);
      })
      .catch((reason: unknown) => {
        if (active) {
          setError(reason instanceof Error ? reason.message : 'Unknown error');
        }
      })
      .finally(() => {
        if (active) setLoading(false);
      });

    // Prevent stale results from an old symbol updating the UI.
    return () => { active = false; };
  }, [symbol]);

  return (
    <section aria-label="Market quote">
      <h2>{symbol}</h2>
      {loading && <p role="status">Loading market data…</p>}
      {error && <p role="alert">Unable to load quote: {error}</p>}
      {quote && !error && <p>Price: {quote.price}</p>}
    </section>
  );
}
