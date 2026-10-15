import React from 'react';
import { render, screen, waitFor } from '@testing-library/react';
import { MarketQuote } from '../components/MarketQuote';
import { getMarketData } from '../services/marketApi';

jest.mock('../services/marketApi', () => ({
  getMarketData: jest.fn(),
}));

const getMarketDataMock = jest.mocked(getMarketData);

afterEach(() => jest.clearAllMocks());

it('shows the quote after loading', async () => {
  getMarketDataMock.mockResolvedValue({ symbol: 'NIFTY', price: 25000 });
  render(<MarketQuote symbol="NIFTY" />);
  expect(screen.getByRole('status')).toHaveTextContent('Loading');
  expect(await screen.findByText('Price: 25000')).toBeInTheDocument();
  expect(getMarketDataMock).toHaveBeenCalledWith('NIFTY');
});

it('shows an accessible error when the API fails', async () => {
  getMarketDataMock.mockRejectedValue(new Error('Rate limit exceeded'));
  render(<MarketQuote symbol="NIFTY" />);
  expect(await screen.findByRole('alert')).toHaveTextContent('Rate limit exceeded');
});

it('does not show stale results after the symbol changes', async () => {
  let resolveOld!: (value: { symbol: string; price: number }) => void;
  getMarketDataMock
    .mockReturnValueOnce(new Promise((resolve) => { resolveOld = resolve; }))
    .mockResolvedValueOnce({ symbol: 'BANKNIFTY', price: 51000 });

  const { rerender } = render(<MarketQuote symbol="NIFTY" />);
  rerender(<MarketQuote symbol="BANKNIFTY" />);
  expect(await screen.findByText('Price: 51000')).toBeInTheDocument();
  resolveOld({ symbol: 'NIFTY', price: 25000 });
  await waitFor(() => expect(screen.queryByText('Price: 25000')).not.toBeInTheDocument());
});
