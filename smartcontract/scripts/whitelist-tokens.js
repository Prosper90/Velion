const hre = require("hardhat");
const fs = require("fs");
const path = require("path");

async function main() {
  const [deployer] = await hre.ethers.getSigners();
  const network = hre.network.name;

  console.log(`📡 Network: ${network}`);
  console.log(`👤 Deployer: ${deployer.address}`);

  // Load PrivacyPoolV2 address from deployment file
  const deploymentFile = path.join(
    __dirname,
    `../deployments/${network}-deployment.json`
  );

  if (!fs.existsSync(deploymentFile)) {
    console.error(
      `❌ No deployment file found at ${deploymentFile}\n` +
      `Please deploy contracts first: npx hardhat run scripts/deploy-${network}.js --network ${network}`
    );
    return;
  }

  const deployment = JSON.parse(fs.readFileSync(deploymentFile, "utf8"));
  const privacyPoolAddress = deployment.contracts.PrivacyPoolV2;

  console.log(`\n🏦 PrivacyPoolV2: ${privacyPoolAddress}`);

  // Load test token addresses
  const testTokensFile = path.join(
    __dirname,
    `../deployments/${network}-test-tokens.json`
  );

  let tokensToWhitelist = [];

  if (fs.existsSync(testTokensFile)) {
    const testTokens = JSON.parse(fs.readFileSync(testTokensFile, "utf8"));
    tokensToWhitelist = Object.values(testTokens.tokens);
    console.log(`\n💎 Found ${tokensToWhitelist.length} test tokens to whitelist`);
  } else {
    console.log(`\n⚠️  No test tokens file found at ${testTokensFile}`);
    console.log(`Using tokens from main deployment file...`);
    tokensToWhitelist = Object.values(deployment.supportedTokens).filter(
      (addr) => addr !== "0x0000000000000000000000000000000000000000"
    );
  }

  const privacyPool = await hre.ethers.getContractAt(
    "PrivacyPoolV2",
    privacyPoolAddress
  );

  console.log("\n" + "=".repeat(70));
  console.log("🔄 Whitelisting Tokens...");
  console.log("=".repeat(70));

  for (const tokenAddress of tokensToWhitelist) {
    console.log(`\n📝 Whitelisting: ${tokenAddress}...`);
    try {
      const tx = await privacyPool.setTokenWhitelist(tokenAddress, true);
      await tx.wait();
      console.log(`✅ Whitelisted! Tx: ${tx.hash}`);

      // Verify
      const isWhitelisted = await privacyPool.whitelistedTokens(tokenAddress);
      console.log(`🔍 Verified: ${isWhitelisted ? "✅ Whitelisted" : "❌ Not whitelisted"}`);
    } catch (error) {
      console.error(`❌ Error whitelisting ${tokenAddress}:`, error.message);
    }
  }

  console.log("\n" + "=".repeat(70));
  console.log("✅ Whitelisting Completed!");
  console.log("=".repeat(70));
}

main()
  .then(() => process.exit(0))
  .catch((error) => {
    console.error(error);
    process.exit(1);
  });
