const hre = require("hardhat");
const fs = require("fs");
const path = require("path");

/**
 * Deploy your own test tokens and mint them
 * This gives you full control over the tokens
 */

// ============ CONFIGURATION ============
const TOKENS_TO_DEPLOY = [
  { name: "Test USDC", symbol: "USDC", decimals: 6 },
  { name: "Test USDT", symbol: "USDT", decimals: 6 },
  { name: "Test DAI", symbol: "DAI", decimals: 18 },
];

const MINT_TO_ADDRESSES = [
  "0x742d35Cc6634C0532925a3b844Bc9e7595f0bEb",
  "0xDd754460819D85675cb5327Ea7727e6255D1853c",
];

const MINT_AMOUNTS = {
  USDC: "100000", // 100,000 USDC
  USDT: "100000", // 100,000 USDT
  DAI: "100000",  // 100,000 DAI
};

// ========================================

async function main() {
  console.log("🚀 Deploying Test Tokens with Minting\n");

  const [deployer] = await hre.ethers.getSigners();
  console.log("Deploying with account:", deployer.address);

  const balance = await hre.ethers.provider.getBalance(deployer.address);
  console.log("Account balance:", hre.ethers.formatEther(balance), "ETH");
  console.log("Network:", hre.network.name);

  if (balance < hre.ethers.parseEther("0.01")) {
    console.error("\n❌ Insufficient ETH for deployment and minting!");
    console.error("You need at least 0.01 ETH for gas fees.");
    process.exit(1);
  }

  const deployedTokens = {};

  console.log("\n" + "=".repeat(70));
  console.log("🔄 Deploying Tokens...");
  console.log("=".repeat(70));

  // Deploy each token
  for (const tokenConfig of TOKENS_TO_DEPLOY) {
    console.log(`\n💎 Deploying ${tokenConfig.name} (${tokenConfig.symbol})...`);

    try {
      // Deploy MockERC20 (anyone can mint)
      const TokenFactory = await hre.ethers.getContractFactory("MockERC20");
      const token = await TokenFactory.deploy(
        tokenConfig.name,
        tokenConfig.symbol,
        tokenConfig.decimals
      );

      await token.waitForDeployment();
      const tokenAddress = await token.getAddress();

      console.log(`✅ Deployed to: ${tokenAddress}`);

      deployedTokens[tokenConfig.symbol] = {
        address: tokenAddress,
        name: tokenConfig.name,
        symbol: tokenConfig.symbol,
        decimals: tokenConfig.decimals,
      };

      // Mint to all addresses
      const mintAmount = MINT_AMOUNTS[tokenConfig.symbol] || "10000";
      const amountInUnits = hre.ethers.parseUnits(
        mintAmount,
        tokenConfig.decimals
      );

      console.log(`\n   🪙 Minting ${mintAmount} ${tokenConfig.symbol} to each address...`);

      for (const recipient of MINT_TO_ADDRESSES) {
        try {
          console.log(`   📝 Minting to ${recipient}...`);
          const tx = await token.mint(recipient, amountInUnits);
          await tx.wait();

          const balance = await token.balanceOf(recipient);
          const balanceFormatted = hre.ethers.formatUnits(
            balance,
            tokenConfig.decimals
          );
          console.log(`   ✅ Balance: ${balanceFormatted} ${tokenConfig.symbol}`);
        } catch (error) {
          console.error(`   ❌ Failed to mint to ${recipient}:`, error.message);
        }
      }
    } catch (error) {
      console.error(`❌ Failed to deploy ${tokenConfig.name}:`, error.message);
    }
  }

  // Save deployment info
  const deploymentData = {
    network: hre.network.name,
    deployer: deployer.address,
    timestamp: new Date().toISOString(),
    tokens: deployedTokens,
  };

  const deploymentDir = path.join(__dirname, "../deployments");
  if (!fs.existsSync(deploymentDir)) {
    fs.mkdirSync(deploymentDir, { recursive: true });
  }

  const deploymentFile = path.join(
    deploymentDir,
    `${hre.network.name}-custom-tokens.json`
  );
  fs.writeFileSync(deploymentFile, JSON.stringify(deploymentData, null, 2));

  console.log("\n" + "=".repeat(70));
  console.log("✅ Deployment Complete!");
  console.log("=".repeat(70));

  console.log("\n📋 Deployed Token Addresses:");
  Object.entries(deployedTokens).forEach(([symbol, info]) => {
    console.log(`${symbol}:`.padEnd(10), info.address);
  });

  console.log("\n💾 Saved to:", deploymentFile);

  console.log("\n📝 Next Steps:");
  console.log("\n1. Whitelist these tokens in PrivacyPoolV2:");
  console.log("   - Edit scripts/whitelist-tokens.js");
  console.log("   - Add these new token addresses");
  console.log("   - Run: npx hardhat run scripts/whitelist-tokens.js --network sepolia");

  console.log("\n2. Update mobile app constants:");
  console.log("   File: mobile/constants/contracts.ts");
  console.log("   Update token addresses to these new ones:");
  Object.entries(deployedTokens).forEach(([symbol, info]) => {
    console.log(`   ${symbol}: "${info.address}"`);
  });

  console.log("\n3. Test in mobile app:");
  console.log("   - Shield tokens");
  console.log("   - Unshield tokens");
  console.log("   - Private transfer");

  console.log("\n💡 To mint more tokens later:");
  console.log("   Anyone can mint from these MockERC20 tokens!");
  console.log("   Just call: token.mint(recipient, amount)");

  console.log("\n" + "=".repeat(70));
}

main()
  .then(() => process.exit(0))
  .catch((error) => {
    console.error("\n❌ Deployment failed:");
    console.error(error);
    process.exit(1);
  });
