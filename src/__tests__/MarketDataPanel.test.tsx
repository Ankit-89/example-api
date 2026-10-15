
import { render, screen, fireEvent, act } from "@testing-library/react";
import { MarketDataPanel } from "../components/MarketDataPanel";
import type { MarketData } from "../services/marketApi";

function deferred<T>() {
  let resolve!: (v: T) => void;
  const promise = new Promise<T>((res) => { resolve = res; });
  return { promise, resolve };
}

describe("MarketDataPanel", () => {
  it("renders the initial UI", () => {
    render(<MarketDataPanel />);

    expect(
      screen.getByRole("heading", { name: "Market Data" })
    ).toBeInTheDocument();

    expect(
      screen.getByRole("combobox", { name: "Select symbol" })
    ).toHaveValue("NIFTY");

    expect(
      screen.getByRole("button", { name: "Load market data" })
    ).toBeEnabled();
  });

  it("displays data after a successful request", async () => {
    const loadMarketData = jest.fn(
      async (symbol: string): Promise<MarketData> => ({
        symbol,
        price: 25000
      })
    );

    render(<MarketDataPanel loadMarketData={loadMarketData} />);

    fireEvent.click(screen.getByRole("button", { name: "Load market data" }));

    expect(await screen.findByText("Symbol: NIFTY"))
      .toBeInTheDocument();
    expect(screen.getByText("Price: 25000"))
      .toBeInTheDocument();

    expect(loadMarketData).toHaveBeenCalledWith("NIFTY");
    expect(loadMarketData).toHaveBeenCalledTimes(1);
  });

  it("shows a loading indicator and disables the button", async () => {
    let resolveRequest!: (data: MarketData) => void;

    const loadMarketData = jest.fn(
      () => new Promise<MarketData>((resolve) => {
        resolveRequest = resolve;
      })
    );

    render(<MarketDataPanel loadMarketData={loadMarketData} />);

    fireEvent.click(screen.getByRole("button", { name: "Load market data" }));

    expect(screen.getByRole("status"))
      .toHaveTextContent("Fetching market data...");

    expect(screen.getByRole("button", { name: "Loading..." }))
      .toBeDisabled();

    resolveRequest({ symbol: "NIFTY", price: 25000 });

    expect(await screen.findByText("Price: 25000"))
      .toBeInTheDocument();
  });

  it("shows an error when the API request fails", async () => {
    const loadMarketData = jest.fn(
      async (): Promise<MarketData> => {
        throw new Error("Rate limit exceeded");
      }
    );

    render(<MarketDataPanel loadMarketData={loadMarketData} />);

    fireEvent.click(screen.getByRole("button", { name: "Load market data" }));

    expect(await screen.findByRole("alert"))
      .toHaveTextContent("Rate limit exceeded");
  });

  it("loads the symbol selected by the user", async () => {
    const loadMarketData = jest.fn(
      async (symbol: string): Promise<MarketData> => ({
        symbol,
        price: 51000
      })
    );

    render(<MarketDataPanel loadMarketData={loadMarketData} />);

    fireEvent.change(screen.getByRole("combobox", { name: "Select symbol" }), {
      target: { value: "BANKNIFTY" }
    });
    fireEvent.click(screen.getByRole("button", { name: "Load market data" }));

    expect(await screen.findByText("Symbol: BANKNIFTY"))
      .toBeInTheDocument();

    expect(loadMarketData).toHaveBeenCalledWith("BANKNIFTY");
  });

  it("clears old data when loading a new request", async () => {
    const loadMarketData = jest.fn()
      .mockResolvedValueOnce({
        symbol: "NIFTY",
        price: 25000
      })
      .mockImplementationOnce(
        () => new Promise<MarketData>(() => {})
      );

    render(<MarketDataPanel loadMarketData={loadMarketData} />);

    fireEvent.click(screen.getByRole("button", { name: "Load market data" }));

    expect(await screen.findByText("Price: 25000"))
      .toBeInTheDocument();

    fireEvent.click(screen.getByRole("button", { name: "Load market data" }));

    expect(screen.queryByText("Price: 25000"))
      .not.toBeInTheDocument();
    expect(screen.getByRole("status")).toBeInTheDocument();
  });

  it("clears an earlier error after a successful retry", async () => {
    const loadMarketData = jest.fn()
      .mockRejectedValueOnce(new Error("Network error"))
      .mockResolvedValueOnce({
        symbol: "NIFTY",
        price: 25000
      });

    render(<MarketDataPanel loadMarketData={loadMarketData} />);

    fireEvent.click(screen.getByRole("button", { name: "Load market data" }));

    expect(await screen.findByRole("alert"))
      .toHaveTextContent("Network error");

    fireEvent.click(screen.getByRole("button", { name: "Load market data" }));

    expect(await screen.findByText("Price: 25000"))
      .toBeInTheDocument();
    expect(screen.queryByRole("alert")).not.toBeInTheDocument();
    expect(loadMarketData).toHaveBeenCalledTimes(2);
  });

  test("a stale response cannot overwrite the newer symbol's quote", async () => {
  const first = deferred<MarketData>();
  const second = deferred<MarketData>();
  const load = jest.fn().mockReturnValueOnce(first.promise).mockReturnValueOnce(second.promise);
  render(<MarketDataPanel loadMarketData={load} />);

  fireEvent.click(screen.getByRole("button", { name: /load market data/i }));
  fireEvent.change(screen.getByLabelText(/select symbol/i), { target: { value: "BANKNIFTY" } });
  fireEvent.click(screen.getByRole("button", { name: /load market data/i }));

  await act(async () => { second.resolve({ symbol: "BANKNIFTY", price: 200 }); });
  await act(async () => { first.resolve({ symbol: "NIFTY", price: 100 }); }); // late

  expect(screen.getByText("Symbol: BANKNIFTY")).toBeTruthy();
  expect(screen.queryByText("Symbol: NIFTY")).toBeNull();
});
});
