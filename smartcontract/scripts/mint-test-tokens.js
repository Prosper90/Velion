const hre = require("hardhat");

/**
 * Simple Token Minting Utility
 *
 * Usage:
 * npx hardhat run scripts/mint-test-tokens.js --network sepolia
 *
 * Edit the MINT_CONFIG below to specify which tokens to mint and to whom
 */

// ============ CONFIGURATION ============
// Edit this section before running

const MINT_CONFIG = {
  // Token address => Array of { recipient, amount }
  "0x1c7D4B196Cb0C7B01d743Fbc6116a902379C7238": [
    // USDC (6 decimals)
    { recipient: "0x742d35Cc6634C0532925a3b844Bc9e7595f0bEb", amount: "10000" }, // 10,000 USDC
    { recipient: "0xDd754460819D85675cb5327Ea7727e6255D1853c", amount: "5000" }, // 5,000 USDC
  ],
  "0xaA8E23Fb1079EA71e0a56F48a2aA51851D8433D0": [
    // USDT (6 decimals)
    { recipient: "0x742d35Cc6634C0532925a3b844Bc9e7595f0bEb", amount: "10000" }, // 10,000 USDT
    { recipient: "0xDd754460819D85675cb5327Ea7727e6255D1853c", amount: "5000" }, // 5,000 USDT
  ],
};

// Decimals for each token (default 18 for unknown tokens)
const TOKEN_DECIMALS = {
  "0x1c7D4B196Cb0C7B01d743Fbc6116a902379C7238": 6, // USDC
  "0xaA8E23Fb1079EA71e0a56F48a2aA51851D8433D0": 6, // USDT
};

// ========================================

async function main() {
  console.log("🪙 Token Minting Utility\n");

  const [minter] = await hre.ethers.getSigners();
  console.log("Minting with account:", minter.address);

  const balance = await hre.ethers.provider.getBalance(minter.address);
  console.log("Account balance:", hre.ethers.formatEther(balance), "ETH");
  console.log("Network:", hre.network.name);

  console.log("\n" + "=".repeat(70));
  console.log("🔄 Starting Minting Process...");
  console.log("=".repeat(70));

  let successCount = 0;
  let failCount = 0;

  // Process each token
  for (const [tokenAddress, recipients] of Object.entries(MINT_CONFIG)) {
    console.log(`\n💎 Token: ${tokenAddress}`);

    try {
      // Get token contract
      const token = await hre.ethers.getContractAt("MockERC20", tokenAddress);

      // Get token info
      const name = await token.name();
      const symbol = await token.symbol();
      const decimals = TOKEN_DECIMALS[tokenAddress] || (await token.decimals());

      console.log(`   Name: ${name}`);
      console.log(`   Symbol: ${symbol}`);
      console.log(`   Decimals: ${decimals}`);

      // Mint to each recipient
      for (const { recipient, amount } of recipients) {
        try {
          console.log(`\n   📝 Minting ${amount} ${symbol} to ${recipient}...`);

          // Convert amount to token units
          const amountInUnits = hre.ethers.parseUnits(amount, decimals);

          // Mint
          const tx = await token.mint(recipient, amountInUnits);
          console.log(`   ⏳ Tx submitted: ${tx.hash}`);

          await tx.wait();
          console.log(`   ✅ Confirmed!`);

          // Check new balance
          const newBalance = await token.balanceOf(recipient);
          const balanceFormatted = hre.ethers.formatUnits(newBalance, decimals);
          console.log(`   💰 New balance: ${balanceFormatted} ${symbol}`);

          successCount++;
        } catch (error) {
          console.error(`   ❌ Failed:`, error.message);
          failCount++;
        }
      }
    } catch (error) {
      console.error(`   ❌ Error with token ${tokenAddress}:`, error.message);
      failCount += recipients.length;
    }
  }

  console.log("\n" + "=".repeat(70));
  console.log("📊 Minting Summary");
  console.log("=".repeat(70));
  console.log(`✅ Successful: ${successCount}`);
  console.log(`❌ Failed: ${failCount}`);

  console.log("\n📝 Next Steps:");
  console.log("1. Open the Veilon mobile app");
  console.log("2. Go to Shield screen");
  console.log("3. Select USDC or USDT");
  console.log("4. Shield some tokens");
  console.log("5. Test unshield and private transfer");

  console.log("\n💡 To mint more tokens:");
  console.log("1. Edit MINT_CONFIG in this script");
  console.log(
    "2. Run: npx hardhat run scripts/mint-test-tokens.js --network sepolia"
  );

  console.log("\n" + "=".repeat(70));
}

main()
  .then(() => process.exit(0))
  .catch((error) => {
    console.error("\n❌ Minting failed:");
    console.error(error);
    process.exit(1);
  });
