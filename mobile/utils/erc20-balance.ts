import { ethers } from "ethers";

/**
 * ERC20 Token Balance Utilities
 * Fetches and manages ERC20 token balances
 */

// Standard ERC20 ABI (only the functions we need)
const ERC20_ABI = [
  "function balanceOf(address owner) view returns (uint256)",
  "function decimals() view returns (uint8)",
  "function symbol() view returns (string)",
  "function name() view returns (string)",
  "function totalSupply() view returns (uint256)",
];

/**
 * Fetch ERC20 token balance for an address
 */
export async function getERC20Balance(
  tokenAddress: string,
  walletAddress: string,
  provider: ethers.Provider
): Promise<{ balance: string; decimals: number }> {
  try {
    const contract = new ethers.Contract(tokenAddress, ERC20_ABI, provider);

    const [balance, decimals] = await Promise.all([
      contract.balanceOf(walletAddress),
      contract.decimals(),
    ]);

    const formattedBalance = ethers.formatUnits(balance, decimals);

    return {
      balance: formattedBalance,
      decimals: Number(decimals),
    };
  } catch (error) {
    console.error(`Failed to fetch ERC20 balance for ${tokenAddress}:`, error);
    return { balance: "0.00", decimals: 18 };
  }
}

/**
 * Fetch balances for multiple ERC20 tokens
 */
export async function getMultipleERC20Balances(
  tokenAddresses: string[],
  walletAddress: string,
  provider: ethers.Provider
): Promise<Record<string, { balance: string; decimals: number }>> {
  const results: Record<string, { balance: string; decimals: number }> = {};

  await Promise.all(
    tokenAddresses.map(async (tokenAddress) => {
      const result = await getERC20Balance(
        tokenAddress,
        walletAddress,
        provider
      );
      results[tokenAddress.toLowerCase()] = result;
    })
  );

  return results;
}

/**
 * Fetch token metadata from contract
 */
export async function getTokenMetadata(
  tokenAddress: string,
  provider: ethers.Provider
): Promise<{
  name: string;
  symbol: string;
  decimals: number;
  totalSupply: string;
} | null> {
  try {
    const contract = new ethers.Contract(tokenAddress, ERC20_ABI, provider);

    const [name, symbol, decimals, totalSupply] = await Promise.all([
      contract.name(),
      contract.symbol(),
      contract.decimals(),
      contract.totalSupply(),
    ]);

    return {
      name,
      symbol,
      decimals: Number(decimals),
      totalSupply: ethers.formatUnits(totalSupply, decimals),
    };
  } catch (error) {
    console.error(`Failed to fetch token metadata for ${tokenAddress}:`, error);
    return null;
  }
}

/**
 * Validate if address is a valid ERC20 token contract
 */
export async function isValidERC20Token(
  tokenAddress: string,
  provider: ethers.Provider
): Promise<boolean> {
  try {
    // Check if address has code (is a contract)
    const code = await provider.getCode(tokenAddress);
    if (code === "0x") {
      return false;
    }

    // Try to call ERC20 functions
    const contract = new ethers.Contract(tokenAddress, ERC20_ABI, provider);
    await Promise.all([
      contract.name(),
      contract.symbol(),
      contract.decimals(),
    ]);

    return true;
  } catch (error) {
    return false;
  }
}
