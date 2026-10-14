
import { useState } from "react";
import {
  getMarketData,
  type MarketData
} from "../services/marketApi";

type Props = {
  loadMarketData?: (symbol: string) => Promise<MarketData>;
};

export function MarketDataPanel({
  loadMarketData = getMarketData
}: Props) {
  const [symbol, setSymbol] = useState("NIFTY");
  const [data, setData] = useState<MarketData | null>(null);
  const [error, setError] = useState("");
  const [loading, setLoading] = useState(false);

  async function handleLoad() {
    setLoading(true);
    setError("");
    setData(null);

    try {
      const result = await loadMarketData(symbol);
      setData(result);
    } catch (err) {
      setError(
        err instanceof Error
          ? err.message
          : "Something went wrong"
      );
    } finally {
      setLoading(false);
    }
  }

  return (
    <section aria-label="Market data">
      <h1>Market Data</h1>

      <label htmlFor="symbol">Select symbol</label>

      <select
        id="symbol"
        value={symbol}
        onChange={(event) => setSymbol(event.target.value)}
      >
        <option value="NIFTY">NIFTY</option>
        <option value="BANKNIFTY">BANKNIFTY</option>
      </select>

      <button onClick={handleLoad} disabled={loading}>
        {loading ? "Loading..." : "Load market data"}
      </button>

      {loading && (
        <p role="status">Fetching market data...</p>
      )}

      {error && <p role="alert">{error}</p>}

      {data && (
        <div aria-label="Market result">
          <p>Symbol: {data.symbol}</p>
          <p>Price: {data.price}</p>
        </div>
      )}
    </section>
  );
}
