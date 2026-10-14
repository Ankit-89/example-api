
import { render, screen } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { MarketDataPanel } from "../components/MarketDataPanel";
import type { MarketData } from "../services/marketApi";

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
    const user = userEvent.setup();

    const loadMarketData = jest.fn(
      async (symbol: string): Promise<MarketData> => ({
        symbol,
        price: 25000
      })
    );

    render(<MarketDataPanel loadMarketData={loadMarketData} />);

    await user.click(
      screen.getByRole("button", { name: "Load market data" })
    );

    expect(await screen.findByText("Symbol: NIFTY"))
      .toBeInTheDocument();
    expect(screen.getByText("Price: 25000"))
      .toBeInTheDocument();

    expect(loadMarketData).toHaveBeenCalledWith("NIFTY");
    expect(loadMarketData).toHaveBeenCalledTimes(1);
  });

  it("shows a loading indicator and disables the button", async () => {
    const user = userEvent.setup();

    let resolveRequest!: (data: MarketData) => void;

    const loadMarketData = jest.fn(
      () => new Promise<MarketData>((resolve) => {
        resolveRequest = resolve;
      })
    );

    render(<MarketDataPanel loadMarketData={loadMarketData} />);

    await user.click(
      screen.getByRole("button", { name: "Load market data" })
    );

    expect(screen.getByRole("status"))
      .toHaveTextContent("Fetching market data...");

    expect(screen.getByRole("button", { name: "Loading..." }))
      .toBeDisabled();

    resolveRequest({ symbol: "NIFTY", price: 25000 });

    expect(await screen.findByText("Price: 25000"))
      .toBeInTheDocument();
  });

  it("shows an error when the API request fails", async () => {
    const user = userEvent.setup();

    const loadMarketData = jest.fn(
      async (): Promise<MarketData> => {
        throw new Error("Rate limit exceeded");
      }
    );

    render(<MarketDataPanel loadMarketData={loadMarketData} />);

    await user.click(
      screen.getByRole("button", { name: "Load market data" })
    );

    expect(await screen.findByRole("alert"))
      .toHaveTextContent("Rate limit exceeded");
  });

  it("loads the symbol selected by the user", async () => {
    const user = userEvent.setup();

    const loadMarketData = jest.fn(
      async (symbol: string): Promise<MarketData> => ({
        symbol,
        price: 51000
      })
    );

    render(<MarketDataPanel loadMarketData={loadMarketData} />);

    await user.selectOptions(
      screen.getByRole("combobox", { name: "Select symbol" }),
      "BANKNIFTY"
    );

    await user.click(
      screen.getByRole("button", { name: "Load market data" })
    );

    expect(await screen.findByText("Symbol: BANKNIFTY"))
      .toBeInTheDocument();

    expect(loadMarketData).toHaveBeenCalledWith("BANKNIFTY");
  });

  it("clears old data when loading a new request", async () => {
    const user = userEvent.setup();

    const loadMarketData = jest.fn()
      .mockResolvedValueOnce({
        symbol: "NIFTY",
        price: 25000
      })
      .mockImplementationOnce(
        () => new Promise<MarketData>(() => {})
      );

    render(<MarketDataPanel loadMarketData={loadMarketData} />);

    await user.click(
      screen.getByRole("button", { name: "Load market data" })
    );

    expect(await screen.findByText("Price: 25000"))
      .toBeInTheDocument();

    await user.click(
      screen.getByRole("button", { name: "Load market data" })
    );

    expect(screen.queryByText("Price: 25000"))
      .not.toBeInTheDocument();
    expect(screen.getByRole("status")).toBeInTheDocument();
  });

  it("clears an earlier error after a successful retry", async () => {
    const user = userEvent.setup();

    const loadMarketData = jest.fn()
      .mockRejectedValueOnce(new Error("Network error"))
      .mockResolvedValueOnce({
        symbol: "NIFTY",
        price: 25000
      });

    render(<MarketDataPanel loadMarketData={loadMarketData} />);

    await user.click(
      screen.getByRole("button", { name: "Load market data" })
    );

    expect(await screen.findByRole("alert"))
      .toHaveTextContent("Network error");

    await user.click(
      screen.getByRole("button", { name: "Load market data" })
    );

    expect(await screen.findByText("Price: 25000"))
      .toBeInTheDocument();
    expect(screen.queryByRole("alert")).not.toBeInTheDocument();
    expect(loadMarketData).toHaveBeenCalledTimes(2);
  });
});
