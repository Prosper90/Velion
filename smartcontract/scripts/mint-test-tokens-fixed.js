const hre = require("hardhat");

/**
 * Fixed Token Minting Utility
 * Works with both MockERC20 (no owner) and owned token contracts
 *
 * Usage:
 * npx hardhat run scripts/mint-test-tokens-fixed.js --network sepolia
 */

// ============ CONFIGURATION ============
const MINT_CONFIG = {
  // Token address => Array of { recipient, amount }
  "0x1c7D4B196Cb0C7B01d743Fbc6116a902379C7238": [
    // USDC (6 decimals)
    { recipient: "0x742d35Cc6634C0532925a3b844Bc9e7595f0bEb", amount: "10000" },
    { recipient: "0xDd754460819D85675cb5327Ea7727e6255D1853c", amount: "5000" },
  ],
  "0xaA8E23Fb1079EA71e0a56F48a2aA51851D8433D0": [
    // USDT (6 decimals)
    { recipient: "0x742d35Cc6634C0532925a3b844Bc9e7595f0bEb", amount: "10000" },
    { recipient: "0xDd754460819D85675cb5327Ea7727e6255D1853c", amount: "5000" },
  ],
};

const TOKEN_DECIMALS = {
  "0x1c7D4B196Cb0C7B01d743Fbc6116a902379C7238": 6, // USDC
  "0xaA8E23Fb1079EA71e0a56F48a2aA51851D8433D0": 6, // USDT
};

// ========================================

// ABI for both MockERC20 and owned tokens
const MINT_ABI = [
  "function mint(address to, uint256 amount) external",
  "function name() view returns (string)",
  "function symbol() view returns (string)",
  "function decimals() view returns (uint8)",
  "function balanceOf(address) view returns (uint256)",
  "function owner() view returns (address)", // For owned tokens
];

async function checkOwnership(token, minterAddress) {
  try {
    const owner = await token.owner();
    console.log(`   🔑 Token Owner: ${owner}`);
    console.log(`   👤 Your Address: ${minterAddress}`);

    if (owner.toLowerCase() !== minterAddress.toLowerCase()) {
      console.log(`   ⚠️  WARNING: You are not the owner! Minting may fail.`);
      return false;
    } else {
      console.log(`   ✅ You are the owner!`);
      return true;
    }
  } catch (error) {
    // No owner() function - probably MockERC20 (anyone can mint)
    console.log(`   ℹ️  No owner - public minting allowed`);
    return true;
  }
}

async function main() {
  console.log("🪙 Fixed Token Minting Utility\n");

  const [minter] = await hre.ethers.getSigners();
  const minterAddress = await minter.getAddress();

  console.log("Minting with account:", minterAddress);

  const balance = await hre.ethers.provider.getBalance(minterAddress);
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
      // Create contract instance with minimal ABI
      const token = new hre.ethers.Contract(tokenAddress, MINT_ABI, minter);

      // Get token info
      const name = await token.name();
      const symbol = await token.symbol();
      const decimals = TOKEN_DECIMALS[tokenAddress] || (await token.decimals());

      console.log(`   Name: ${name}`);
      console.log(`   Symbol: ${symbol}`);
      console.log(`   Decimals: ${decimals}`);

      // Check ownership
      await checkOwnership(token, minterAddress);

      // Mint to each recipient
      for (const { recipient, amount } of recipients) {
        try {
          console.log(`\n   📝 Minting ${amount} ${symbol} to ${recipient}...`);

          // Convert amount to token units
          const amountInUnits = hre.ethers.parseUnits(amount, decimals);

          // Get balance before
          const balanceBefore = await token.balanceOf(recipient);
          console.log(`   💰 Balance before: ${hre.ethers.formatUnits(balanceBefore, decimals)} ${symbol}`);

          // Mint
          const tx = await token.mint(recipient, amountInUnits);
          console.log(`   ⏳ Tx submitted: ${tx.hash}`);

          const receipt = await tx.wait();
          console.log(`   ✅ Confirmed in block ${receipt.blockNumber}!`);

          // Get balance after
          const balanceAfter = await token.balanceOf(recipient);
          console.log(`   💰 Balance after: ${hre.ethers.formatUnits(balanceAfter, decimals)} ${symbol}`);

          successCount++;
        } catch (error) {
          console.error(`   ❌ Failed:`, error.message);

          // Provide helpful error messages
          if (error.message.includes("Ownable: caller is not the owner")) {
            console.error(`   💡 You need to run this script with the token owner account.`);
            console.error(`   💡 Add the owner's private key to your .env file as PRIVATE_KEY`);
          } else if (error.message.includes("insufficient funds")) {
            console.error(`   💡 You don't have enough ETH for gas fees.`);
          }

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

  if (failCount > 0) {
    console.log("\n🔧 Troubleshooting:");
    console.log("1. Make sure you're using the token owner's account");
    console.log("2. Check your .env file has the correct PRIVATE_KEY");
    console.log("3. Verify you have enough ETH for gas");
    console.log("4. If tokens have owner, you must use owner account to mint");
  }

  if (successCount > 0) {
    console.log("\n📝 Next Steps:");
    console.log("1. Open the Veilon mobile app");
    console.log("2. Go to Shield screen");
    console.log("3. Select USDC or USDT");
    console.log("4. Shield some tokens");
    console.log("5. Test unshield and private transfer");
  }

  console.log("\n" + "=".repeat(70));
}

main()
  .then(() => process.exit(0))
  .catch((error) => {
    console.error("\n❌ Minting failed:");
    console.error(error);
    process.exit(1);
  });
