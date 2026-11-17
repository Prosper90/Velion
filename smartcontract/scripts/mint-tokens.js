const hre = require("hardhat");
const fs = require("fs");
const path = require("path");

/**
 * Mint Test ERC20 Tokens Script
 *
 * Usage:
 * 1. Edit the MINT_CONFIG below to specify addresses and amounts
 * 2. Run: npx hardhat run scripts/mint-tokens.js --network sepolia
 *
 * OR provide command line arguments:
 * npx hardhat run scripts/mint-tokens.js --network sepolia -- <token> <address> <amount>
 * Example: npx hardhat run scripts/mint-tokens.js --network sepolia -- USDC 0x742d35Cc6634C0532925a3b844Bc9e7595f0bEb 1000
 */

// ============ CONFIGURATION ============
// Edit this section to mint tokens to your addresses
const MINT_CONFIG = {
  // Token symbol => Array of { address, amount }
  USDC: [
    { address: "0x742d35Cc6634C0532925a3b844Bc9e7595f0bEb", amount: "10000" }, // 10,000 USDC
    { address: "0xDd754460819D85675cb5327Ea7727e6255D1853c", amount: "5000" },  // 5,000 USDC
  ],
  USDT: [
    { address: "0x742d35Cc6634C0532925a3b844Bc9e7595f0bEb", amount: "10000" }, // 10,000 USDT
    { address: "0xDd754460819D85675cb5327Ea7727e6255D1853c", amount: "5000" },  // 5,000 USDT
  ],
  DAI: [
    { address: "0x742d35Cc6634C0532925a3b844Bc9e7595f0bEb", amount: "10000" }, // 10,000 DAI
    { address: "0xDd754460819D85675cb5327Ea7727e6255D1853c", amount: "5000" },  // 5,000 DAI
  ],
};
// ========================================

async function loadTokenAddresses() {
  const deploymentFile = path.join(
    __dirname,
    `../deployments/${hre.network.name}-test-tokens.json`
  );

  if (!fs.existsSync(deploymentFile)) {
    throw new Error(
      `No deployment file found at ${deploymentFile}. Please deploy test tokens first:\n` +
      `npx hardhat run scripts/deploy-test-tokens.js --network ${hre.network.name}`
    );
  }

  const deployment = JSON.parse(fs.readFileSync(deploymentFile, "utf8"));
  return deployment.tokens;
}

async function mintToken(tokenContract, tokenSymbol, recipient, amount, decimals) {
  // Convert amount to token units (with decimals)
  const amountInUnits = hre.ethers.parseUnits(amount, decimals);

  console.log(`\n📝 Minting ${amount} ${tokenSymbol} to ${recipient}...`);
  const tx = await tokenContract.mint(recipient, amountInUnits);
  await tx.wait();
  console.log(`✅ Minted! Tx: ${tx.hash}`);

  // Check balance
  const balance = await tokenContract.balanceOf(recipient);
  const balanceFormatted = hre.ethers.formatUnits(balance, decimals);
  console.log(`💰 New balance: ${balanceFormatted} ${tokenSymbol}`);
}

async function main() {
  console.log("🪙 Minting Test ERC20 Tokens...\n");

  const [deployer] = await hre.ethers.getSigners();
  console.log("Minting with account:", deployer.address);

  // Load token addresses from deployment file
  const tokenAddresses = await loadTokenAddresses();
  console.log("\n📋 Loaded Token Addresses:");
  Object.entries(tokenAddresses).forEach(([symbol, address]) => {
    console.log(`${symbol}:`.padEnd(10), address);
  });

  // Check if command line arguments provided
  const args = process.argv.slice(2);
  let mintOperations = MINT_CONFIG;

  // Parse command line: -- <token> <address> <amount>
  if (args.length >= 3 && args[0] !== "--network") {
    const tokenIndex = args.findIndex((arg) => !arg.startsWith("--"));
    if (tokenIndex !== -1 && args.length >= tokenIndex + 3) {
      const token = args[tokenIndex];
      const address = args[tokenIndex + 1];
      const amount = args[tokenIndex + 2];

      console.log(`\n🎯 CLI Mode: Minting ${amount} ${token} to ${address}`);
      mintOperations = {
        [token]: [{ address, amount }],
      };
    }
  }

  // Get token decimals (USDC/USDT = 6, DAI = 18)
  const tokenDecimals = {
    USDC: 6,
    USDT: 6,
    DAI: 18,
  };

  console.log("\n" + "=".repeat(70));
  console.log("🔄 Starting Minting Process...");
  console.log("=".repeat(70));

  // Mint tokens for each configured recipient
  for (const [tokenSymbol, recipients] of Object.entries(mintOperations)) {
    if (!tokenAddresses[tokenSymbol]) {
      console.log(`\n⚠️  Skipping ${tokenSymbol} (not deployed)`);
      continue;
    }

    console.log(`\n💎 Processing ${tokenSymbol}...`);

    // Get token contract
    const tokenContract = await hre.ethers.getContractAt(
      "TestERC20",
      tokenAddresses[tokenSymbol]
    );

    const decimals = tokenDecimals[tokenSymbol] || 18;

    // Mint to each recipient
    for (const { address, amount } of recipients) {
      try {
        await mintToken(tokenContract, tokenSymbol, address, amount, decimals);
      } catch (error) {
        console.error(`❌ Failed to mint ${tokenSymbol} to ${address}:`, error.message);
      }
    }
  }

  console.log("\n" + "=".repeat(70));
  console.log("✅ Minting Completed!");
  console.log("=".repeat(70));

  console.log("\n📊 Summary:");
  console.log("Network:", hre.network.name);
  console.log("Minted by:", deployer.address);

  console.log("\n📝 Next Steps:");
  console.log("1. Check token balances in your wallet");
  console.log("2. Shield tokens using the Veilon mobile app");
  console.log("3. Test unshield and private transfer flows");

  console.log("\n💡 Useful Commands:");
  console.log("• Check balance:");
  console.log(`  npx hardhat console --network ${hre.network.name}`);
  console.log(`  > const token = await ethers.getContractAt("TestERC20", "TOKEN_ADDRESS")`);
  console.log(`  > const balance = await token.balanceOf("YOUR_ADDRESS")`);
  console.log(`  > ethers.formatUnits(balance, DECIMALS)`);

  console.log("\n• Mint more tokens:");
  console.log(`  Edit MINT_CONFIG in scripts/mint-tokens.js and run again`);
  console.log(`  Or use CLI: npx hardhat run scripts/mint-tokens.js --network ${hre.network.name} -- TOKEN ADDRESS AMOUNT`);

  console.log("\n" + "=".repeat(70));
}

main()
  .then(() => process.exit(0))
  .catch((error) => {
    console.error("\n❌ Minting failed:");
    console.error(error);
    process.exit(1);
  });
