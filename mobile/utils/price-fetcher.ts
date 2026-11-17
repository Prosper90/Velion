/**
 * Price Fetcher Utility
 * Fetches token prices from CryptoCompare API
 */

import { TokenMetadata } from '../constants/tokens';

const CRYPTOCOMPARE_API_BASE = 'https://min-api.cryptocompare.com/data';

export interface TokenPrice {
  symbol: string;
  usd: number;
  change24h?: number;
  marketCap?: number;
  lastUpdated: number;
}

export interface PriceCache {
  [symbol: string]: {
    price: TokenPrice;
    timestamp: number;
  };
}

/**
 * Price cache with 1 minute TTL
 */
const priceCache: PriceCache = {};
const CACHE_TTL = 60 * 1000; // 1 minute

/**
 * Fetch price for a single token
 */
export async function fetchTokenPrice(
  token: TokenMetadata,
  currency: string = 'USD'
): Promise<TokenPrice | null> {
  try {
    const symbol = token.cryptocompareSymbol || token.symbol;

    // Check cache first
    const cached = priceCache[symbol];
    if (cached && Date.now() - cached.timestamp < CACHE_TTL) {
      console.log(`💰 Using cached price for ${symbol}: $${cached.price.usd}`);
      return cached.price;
    }

    console.log(`📡 Fetching price for ${symbol}...`);

    const response = await fetch(
      `${CRYPTOCOMPARE_API_BASE}/price?fsym=${symbol}&tsyms=${currency}`,
      {
        method: 'GET',
        headers: {
          'Content-Type': 'application/json',
        },
      }
    );

    if (!response.ok) {
      throw new Error(`HTTP error! status: ${response.status}`);
    }

    const data = await response.json();

    if (data.Response === 'Error') {
      console.warn(`⚠️ CryptoCompare error for ${symbol}:`, data.Message);
      return null;
    }

    const price: TokenPrice = {
      symbol: token.symbol,
      usd: data[currency] || 0,
      lastUpdated: Date.now(),
    };

    // Cache the price
    priceCache[symbol] = {
      price,
      timestamp: Date.now(),
    };

    console.log(`💵 ${symbol} price: $${price.usd}`);
    return price;
  } catch (error) {
    console.error(`❌ Failed to fetch price for ${token.symbol}:`, error);
    return null;
  }
}

/**
 * Fetch prices for multiple tokens in a single request
 */
export async function fetchMultipleTokenPrices(
  tokens: TokenMetadata[],
  currency: string = 'USD'
): Promise<{ [symbol: string]: TokenPrice }> {
  try {
    const symbols = tokens
      .map(t => t.cryptocompareSymbol || t.symbol)
      .join(',');

    console.log(`📡 Fetching prices for multiple tokens: ${symbols}`);

    const response = await fetch(
      `${CRYPTOCOMPARE_API_BASE}/pricemulti?fsyms=${symbols}&tsyms=${currency}`,
      {
        method: 'GET',
        headers: {
          'Content-Type': 'application/json',
        },
      }
    );

    if (!response.ok) {
      throw new Error(`HTTP error! status: ${response.status}`);
    }

    const data = await response.json();

    if (data.Response === 'Error') {
      throw new Error(data.Message || 'Failed to fetch prices');
    }

    const prices: { [symbol: string]: TokenPrice } = {};

    tokens.forEach(token => {
      const compareSymbol = token.cryptocompareSymbol || token.symbol;
      const priceData = data[compareSymbol];

      if (priceData && priceData[currency]) {
        const price: TokenPrice = {
          symbol: token.symbol,
          usd: priceData[currency],
          lastUpdated: Date.now(),
        };

        prices[token.symbol] = price;

        // Cache individual prices
        priceCache[compareSymbol] = {
          price,
          timestamp: Date.now(),
        };

        console.log(`💵 ${token.symbol}: $${price.usd}`);
      } else {
        console.warn(`⚠️ No price data for ${token.symbol}`);
      }
    });

    return prices;
  } catch (error) {
    console.error('❌ Failed to fetch multiple token prices:', error);
    return {};
  }
}

/**
 * Fetch price with 24h change data
 */
export async function fetchTokenPriceWithChange(
  token: TokenMetadata,
  currency: string = 'USD'
): Promise<TokenPrice | null> {
  try {
    const symbol = token.cryptocompareSymbol || token.symbol;

    console.log(`📡 Fetching detailed price for ${symbol}...`);

    const response = await fetch(
      `${CRYPTOCOMPARE_API_BASE}/pricemultifull?fsyms=${symbol}&tsyms=${currency}`,
      {
        method: 'GET',
        headers: {
          'Content-Type': 'application/json',
        },
      }
    );

    if (!response.ok) {
      throw new Error(`HTTP error! status: ${response.status}`);
    }

    const data = await response.json();

    if (data.Response === 'Error') {
      throw new Error(data.Message || 'Failed to fetch price');
    }

    const rawData = data.RAW?.[symbol]?.[currency];
    if (!rawData) {
      console.warn(`⚠️ No detailed price data for ${symbol}`);
      return await fetchTokenPrice(token, currency);
    }

    const price: TokenPrice = {
      symbol: token.symbol,
      usd: rawData.PRICE || 0,
      change24h: rawData.CHANGEPCT24HOUR || 0,
      marketCap: rawData.MKTCAP || 0,
      lastUpdated: Date.now(),
    };

    // Cache the price
    priceCache[symbol] = {
      price,
      timestamp: Date.now(),
    };

    console.log(`💵 ${symbol}: $${price.usd} (24h: ${price.change24h?.toFixed(2)}%)`);
    return price;
  } catch (error) {
    console.error(`❌ Failed to fetch detailed price for ${token.symbol}:`, error);
    // Fallback to simple price fetch
    return await fetchTokenPrice(token, currency);
  }
}

/**
 * Clear price cache
 */
export function clearPriceCache(): void {
  Object.keys(priceCache).forEach(key => delete priceCache[key]);
  console.log('🗑️ Price cache cleared');
}

/**
 * Get cached price if available
 */
export function getCachedPrice(symbol: string): TokenPrice | null {
  const cached = priceCache[symbol];
  if (cached && Date.now() - cached.timestamp < CACHE_TTL) {
    return cached.price;
  }
  return null;
}

/**
 * Calculate total portfolio value in USD
 */
export function calculatePortfolioValue(
  holdings: { token: TokenMetadata; balance: number }[],
  prices: { [symbol: string]: TokenPrice }
): number {
  return holdings.reduce((total, holding) => {
    const price = prices[holding.token.symbol];
    if (price) {
      return total + holding.balance * price.usd;
    }
    return total;
  }, 0);
}
