const hre = require("hardhat");
const fs = require("fs");
const path = require("path");

async function main() {
  console.log("🚀 Starting LOCAL Veilon Protocol deployment...");

  const [deployer] = await hre.ethers.getSigners();
  const network = hre.network.name;

  console.log(`📡 Network: ${network}`);
  console.log(`👤 Deployer: ${deployer.address}`);
  console.log(`💰 Balance: ${hre.ethers.formatEther(await hre.ethers.provider.getBalance(deployer.address))} ETH`);

  const deployedContracts = {};

  try {
    // Step 1: Deploy Verifier Contract
    console.log("\n🔐 Deploying Verifier contract...");
    const Verifier = await hre.ethers.getContractFactory("Verifier");
    const verifier = await Verifier.deploy();
    await verifier.waitForDeployment();
    const verifierAddress = await verifier.getAddress();
    deployedContracts.Verifier = verifierAddress;
    console.log(`✅ Verifier deployed to: ${verifierAddress}`);

    // Step 2: Deploy RelayerRegistry Contract
    console.log("\n🔗 Deploying RelayerRegistry contract...");
    const RelayerRegistry = await hre.ethers.getContractFactory("RelayerRegistry");
    const relayerRegistry = await RelayerRegistry.deploy();
    await relayerRegistry.waitForDeployment();
    const relayerRegistryAddress = await relayerRegistry.getAddress();
    deployedContracts.RelayerRegistry = relayerRegistryAddress;
    console.log(`✅ RelayerRegistry deployed to: ${relayerRegistryAddress}`);

    // Step 3: Deploy PrivacyPool Contract
    console.log("\n🏊 Deploying PrivacyPool contract...");
    const relayerFee = hre.ethers.parseEther("0.001"); // 0.001 ETH relayer fee
    const PrivacyPool = await hre.ethers.getContractFactory("PrivacyPool");
    const privacyPool = await PrivacyPool.deploy(
      verifierAddress,
      relayerRegistryAddress,
      relayerFee
    );
    await privacyPool.waitForDeployment();
    const privacyPoolAddress = await privacyPool.getAddress();
    deployedContracts.PrivacyPool = privacyPoolAddress;
    console.log(`✅ PrivacyPool deployed to: ${privacyPoolAddress}`);

    // Step 4: Deploy Governance Contract
    console.log("\n🏛️  Deploying Governance contract...");
    const Governance = await hre.ethers.getContractFactory("Governance");
    const governance = await Governance.deploy(
      privacyPoolAddress,
      relayerRegistryAddress
    );
    await governance.waitForDeployment();
    const governanceAddress = await governance.getAddress();
    deployedContracts.Governance = governanceAddress;
    console.log(`✅ Governance deployed to: ${governanceAddress}`);

    // Step 5: Deploy EmergencyExit Contract
    console.log("\n🚨 Deploying EmergencyExit contract...");
    const EmergencyExit = await hre.ethers.getContractFactory("EmergencyExit");
    const emergencyExit = await EmergencyExit.deploy(
      privacyPoolAddress,
      verifierAddress
    );
    await emergencyExit.waitForDeployment();
    const emergencyExitAddress = await emergencyExit.getAddress();
    deployedContracts.EmergencyExit = emergencyExitAddress;
    console.log(`✅ EmergencyExit deployed to: ${emergencyExitAddress}`);

    // Save deployment info
    const deploymentInfo = {
      network: network,
      chainId: (await hre.ethers.provider.getNetwork()).chainId.toString(),
      deployer: deployer.address,
      timestamp: new Date().toISOString(),
      contracts: deployedContracts,
      description: "Local deployment for testing and development"
    };

    // Save to JSON file
    const deploymentsDir = path.join(__dirname, "../deployments");
    if (!fs.existsSync(deploymentsDir)) {
      fs.mkdirSync(deploymentsDir, { recursive: true });
    }

    const deploymentFile = path.join(deploymentsDir, `${network}-deployment.json`);
    fs.writeFileSync(deploymentFile, JSON.stringify(deploymentInfo, null, 2));

    // Print deployment summary
    console.log("\n🎉 LOCAL DEPLOYMENT COMPLETE!");
    console.log("=====================================");
    console.log(`📡 Network: ${network}`);
    console.log(`⛓️  Chain ID: ${deploymentInfo.chainId}`);
    console.log(`👤 Deployer: ${deployer.address}`);
    console.log("📋 Contract Addresses:");

    Object.entries(deployedContracts).forEach(([name, address]) => {
      console.log(`   ${name}: ${address}`);
    });

    console.log(`\n💾 Deployment info saved to: ${deploymentFile}`);

    // Create testnet deployment instructions
    createTestnetInstructions(deployedContracts);

    return deploymentInfo;

  } catch (error) {
    console.error("❌ Deployment failed:", error);
    throw error;
  }
}

function createTestnetInstructions(contracts) {
  const instructions = `# 🚀 Testnet Deployment Instructions

## Prerequisites
1. Get testnet ETH from faucets:
   - Sepolia: https://sepoliafaucet.com/
   - Mumbai: https://faucet.polygon.technology/

2. Get RPC URLs (free options):
   - Alchemy: https://www.alchemy.com/
   - Infura: https://infura.io/
   - QuickNode: https://www.quicknode.com/

## Update .env file with your values:
\`\`\`
PRIVATE_KEY=your_actual_private_key_here
SEPOLIA_RPC_URL=https://eth-sepolia.g.alchemy.com/v2/YOUR_API_KEY
MUMBAI_RPC_URL=https://polygon-mumbai.g.alchemy.com/v2/YOUR_API_KEY
ETHERSCAN_API_KEY=your_etherscan_api_key
POLYGONSCAN_API_KEY=your_polygonscan_api_key
\`\`\`

## Deploy to testnet:
\`\`\`bash
# Deploy to Sepolia
npm run deploy:sepolia

# Deploy to Mumbai
npm run deploy:mumbai

# Verify contracts (after deployment)
npx hardhat verify --network sepolia CONTRACT_ADDRESS
\`\`\`

## Local deployment addresses (for reference):
${Object.entries(contracts).map(([name, address]) => `${name}: ${address}`).join('\n')}
`;

  fs.writeFileSync(path.join(__dirname, "../TESTNET_DEPLOYMENT.md"), instructions);
  console.log("\n📖 Testnet deployment instructions created: TESTNET_DEPLOYMENT.md");
}

main()
  .then((deploymentInfo) => {
    console.log("\n🚀 Local deployment completed successfully!");
    console.log("\n🌐 To deploy to testnet:");
    console.log("1. Get testnet ETH from faucets");
    console.log("2. Update .env with your RPC URLs and private key");
    console.log("3. Run: npm run deploy:sepolia");
    process.exit(0);
  })
  .catch((error) => {
    console.error("💥 Deployment script failed:", error);
    process.exit(1);
  });