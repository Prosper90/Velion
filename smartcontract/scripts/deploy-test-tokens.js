const hre = require("hardhat");
const fs = require("fs");
const path = require("path");

async function main() {
  console.log("🚀 Deploying Test ERC20 Tokens...\n");

  const [deployer] = await hre.ethers.getSigners();
  console.log("Deploying with account:", deployer.address);

  const balance = await hre.ethers.provider.getBalance(deployer.address);
  console.log("Account balance:", hre.ethers.formatEther(balance), "ETH\n");

  const tokens = {};

  // Deploy Test USDC (6 decimals like real USDC)
  console.log("📝 Deploying Test USDC...");
  const TestUSDC = await hre.ethers.getContractFactory("TestERC20");
  const usdc = await TestUSDC.deploy("Test USDC", "USDC", 6);
  await usdc.waitForDeployment();
  const usdcAddress = await usdc.getAddress();
  console.log("✅ Test USDC deployed to:", usdcAddress);
  tokens.USDC = usdcAddress;

  // Deploy Test USDT (6 decimals like real USDT)
  console.log("\n📝 Deploying Test USDT...");
  const TestUSDT = await hre.ethers.getContractFactory("TestERC20");
  const usdt = await TestUSDT.deploy("Test USDT", "USDT", 6);
  await usdt.waitForDeployment();
  const usdtAddress = await usdt.getAddress();
  console.log("✅ Test USDT deployed to:", usdtAddress);
  tokens.USDT = usdtAddress;

  // Deploy Test DAI (18 decimals like real DAI)
  console.log("\n📝 Deploying Test DAI...");
  const TestDAI = await hre.ethers.getContractFactory("TestERC20");
  const dai = await TestDAI.deploy("Test DAI", "DAI", 18);
  await dai.waitForDeployment();
  const daiAddress = await dai.getAddress();
  console.log("✅ Test DAI deployed to:", daiAddress);
  tokens.DAI = daiAddress;

  // Save deployment addresses
  const deploymentData = {
    network: hre.network.name,
    deployer: deployer.address,
    timestamp: new Date().toISOString(),
    tokens: tokens,
  };

  const deploymentDir = path.join(__dirname, "../deployments");
  if (!fs.existsSync(deploymentDir)) {
    fs.mkdirSync(deploymentDir, { recursive: true });
  }

  const deploymentFile = path.join(
    deploymentDir,
    `${hre.network.name}-test-tokens.json`
  );
  fs.writeFileSync(deploymentFile, JSON.stringify(deploymentData, null, 2));

  console.log("\n" + "=".repeat(70));
  console.log("✅ Test Tokens Deployment Completed!");
  console.log("=".repeat(70));
  console.log("\n📋 Token Addresses:");
  Object.entries(tokens).forEach(([name, address]) => {
    console.log(`${name}:`.padEnd(10), address);
  });

  console.log("\n💾 Deployment data saved to:", deploymentFile);

  console.log("\n📝 Next Steps:");
  console.log("1. Whitelist these tokens in PrivacyPoolV2:");
  console.log(`   npx hardhat run scripts/whitelist-tokens.js --network ${hre.network.name}`);
  console.log("\n2. Mint tokens to test addresses:");
  console.log(`   npx hardhat run scripts/mint-tokens.js --network ${hre.network.name}`);
  console.log("\n3. Update mobile app with these token addresses");

  console.log("\n" + "=".repeat(70));
}

main()
  .then(() => process.exit(0))
  .catch((error) => {
    console.error("\n❌ Deployment failed:");
    console.error(error);
    process.exit(1);
  });
