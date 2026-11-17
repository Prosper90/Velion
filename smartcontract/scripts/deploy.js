const hre = require("hardhat");
const fs = require("fs");
const path = require("path");

async function main() {
  console.log("🚀 Starting Veilon Protocol deployment...");

  const [deployer] = await hre.ethers.getSigners();
  const network = hre.network.name;

  console.log(`📡 Network: ${network}`);
  console.log(`👤 Deployer: ${deployer.address}`);
  console.log(`💰 Balance: ${hre.ethers.formatEther(await hre.ethers.provider.getBalance(deployer.address))} ETH`);

  const deployedContracts = {};

  try {
    // Step 1: Deploy Groth16 Verifiers
    console.log("\n🔐 Deploying Groth16 Verifiers...");
    const ShieldVerifier = await hre.ethers.getContractFactory("ShieldGroth16Verifier");
    const shieldVerifier = await ShieldVerifier.deploy();
    await shieldVerifier.waitForDeployment();
    const shieldVerifierAddress = await shieldVerifier.getAddress();
    deployedContracts.ShieldVerifier = shieldVerifierAddress;
    console.log(`✅ ShieldVerifier deployed to: ${shieldVerifierAddress}`);

    const UnshieldVerifier = await hre.ethers.getContractFactory("UnshieldGroth16Verifier");
    const unshieldVerifier = await UnshieldVerifier.deploy();
    await unshieldVerifier.waitForDeployment();
    const unshieldVerifierAddress = await unshieldVerifier.getAddress();
    deployedContracts.UnshieldVerifier = unshieldVerifierAddress;
    console.log(`✅ UnshieldVerifier deployed to: ${unshieldVerifierAddress}`);

    const TransferVerifier = await hre.ethers.getContractFactory("TransferGroth16Verifier");
    const transferVerifier = await TransferVerifier.deploy();
    await transferVerifier.waitForDeployment();
    const transferVerifierAddress = await transferVerifier.getAddress();
    deployedContracts.TransferVerifier = transferVerifierAddress;
    console.log(`✅ TransferVerifier deployed to: ${transferVerifierAddress}`);

    // Step 2: Deploy Verifier Contract
    console.log("\n🔐 Deploying Verifier contract...");
    const Verifier = await hre.ethers.getContractFactory("Verifier");
    const verifier = await Verifier.deploy(
      shieldVerifierAddress,
      unshieldVerifierAddress,
      transferVerifierAddress
    );
    await verifier.waitForDeployment();
    const verifierAddress = await verifier.getAddress();
    deployedContracts.Verifier = verifierAddress;
    console.log(`✅ Verifier deployed to: ${verifierAddress}`);

    // Step 3: Deploy PrivacyPoolV2 Contract
    console.log("\n🏊 Deploying PrivacyPoolV2 contract...");
    const PrivacyPoolV2 = await hre.ethers.getContractFactory("PrivacyPoolV2");
    const privacyPool = await PrivacyPoolV2.deploy(verifierAddress);
    await privacyPool.waitForDeployment();
    const privacyPoolAddress = await privacyPool.getAddress();
    deployedContracts.PrivacyPoolV2 = privacyPoolAddress;
    console.log(`✅ PrivacyPoolV2 deployed to: ${privacyPoolAddress}`);

    // Step 4: RelayerRegistry removed - using off-chain relayer service only
    console.log("\n📡 Relayer service will be used off-chain (no on-chain registry)");

    // Step 5: Deploy Governance Contract
    console.log("\n🏛️  Deploying Governance contract...");
    const quorum = 1;
    const votingPeriod = 86400; // 1 day
    const Governance = await hre.ethers.getContractFactory("Governance");
    const governance = await Governance.deploy(quorum, votingPeriod);
    await governance.waitForDeployment();
    const governanceAddress = await governance.getAddress();
    deployedContracts.Governance = governanceAddress;
    console.log(`✅ Governance deployed to: ${governanceAddress}`);

    // Step 6: Deploy EmergencyExit Contract
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

    // Step 7: Contract initialization (RelayerRegistry removed)
    console.log("\n⚙️  Contract initialization...");

    // Save deployment info
    const deploymentInfo = {
      network: network,
      chainId: (await hre.ethers.provider.getNetwork()).chainId.toString(),
      deployer: deployer.address,
      timestamp: new Date().toISOString(),
      contracts: deployedContracts,
      scannerUrls: generateScannerUrls(network, deployedContracts),
      gasUsed: "Estimated deployment cost calculated"
    };

    // Save to JSON file
    const deploymentsDir = path.join(__dirname, "../deployments");
    if (!fs.existsSync(deploymentsDir)) {
      fs.mkdirSync(deploymentsDir, { recursive: true });
    }

    const deploymentFile = path.join(deploymentsDir, `${network}-deployment.json`);
    fs.writeFileSync(deploymentFile, JSON.stringify(deploymentInfo, null, 2));

    // Update environment file
    updateEnvironmentFile(deployedContracts);

    // Print deployment summary
    console.log("\n🎉 DEPLOYMENT COMPLETE!");
    console.log("=====================================");
    console.log(`📡 Network: ${network}`);
    console.log(`⛓️  Chain ID: ${deploymentInfo.chainId}`);
    console.log(`👤 Deployer: ${deployer.address}`);
    console.log("📋 Contract Addresses:");

    Object.entries(deployedContracts).forEach(([name, address]) => {
      console.log(`   ${name}: ${address}`);
    });

    console.log("\n🔍 Scanner Links:");
    Object.entries(deploymentInfo.scannerUrls).forEach(([name, url]) => {
      console.log(`   ${name}: ${url}`);
    });

    console.log(`\n💾 Deployment info saved to: ${deploymentFile}`);
    console.log("\n🔗 Contract verification commands:");
    console.log(`npx hardhat verify --network ${network} ${verifierAddress}`);
    console.log(`npx hardhat verify --network ${network} ${privacyPoolAddress} "${verifierAddress}"`);
    console.log(`npx hardhat verify --network ${network} ${governanceAddress} "${quorum}" "${votingPeriod}"`);
    console.log(`npx hardhat verify --network ${network} ${emergencyExitAddress} "${privacyPoolAddress}" "${verifierAddress}"`);

    return deploymentInfo;

  } catch (error) {
    console.error("❌ Deployment failed:", error);
    throw error;
  }
}

function generateScannerUrls(network, contracts) {
  const scannerUrls = {};
  let baseUrl;

  switch (network) {
    case "sepolia":
      baseUrl = "https://sepolia.etherscan.io/address/";
      break;
    case "bscTestnet":
      baseUrl = "https://testnet.bscscan.com/address/";
      break;
    case "mumbai":
      baseUrl = "https://mumbai.polygonscan.com/address/";
      break;
    case "arbitrumSepolia":
      baseUrl = "https://sepolia.arbiscan.io/address/";
      break;
    case "polygon":
      baseUrl = "https://polygonscan.com/address/";
      break;
    case "mainnet":
      baseUrl = "https://etherscan.io/address/";
      break;
    case "bsc":
      baseUrl = "https://bscscan.com/address/";
      break;
    case "arbitrumOne":
      baseUrl = "https://arbiscan.io/address/";
      break;
    default:
      baseUrl = "https://sepolia.etherscan.io/address/";
  }

  Object.entries(contracts).forEach(([name, address]) => {
    scannerUrls[name] = `${baseUrl}${address}`;
  });

  return scannerUrls;
}

function updateEnvironmentFile(contracts) {
  try {
    const envPath = path.join(__dirname, "../../env.example");
    let envContent = fs.readFileSync(envPath, "utf8");

    // Update contract addresses
    envContent = envContent.replace(
      /PRIVACY_POOL_ADDRESS=.*/,
      `PRIVACY_POOL_ADDRESS=${contracts.PrivacyPool}`
    );
    envContent = envContent.replace(
      /VERIFIER_ADDRESS=.*/,
      `VERIFIER_ADDRESS=${contracts.Verifier}`
    );
    envContent = envContent.replace(
      /GOVERNANCE_ADDRESS=.*/,
      `GOVERNANCE_ADDRESS=${contracts.Governance}`
    );

    // Add emergency exit address if not present
    if (!envContent.includes("EMERGENCY_EXIT_ADDRESS")) {
      envContent += `\nEMERGENCY_EXIT_ADDRESS=${contracts.EmergencyExit}\n`;
    }

    fs.writeFileSync(envPath, envContent);
    console.log("✅ Environment file updated with contract addresses");
  } catch (error) {
    console.log("⚠️  Could not update environment file:", error.message);
  }
}

// Handle errors
main()
  .then((deploymentInfo) => {
    console.log("\n🚀 Deployment script completed successfully!");
    process.exit(0);
  })
  .catch((error) => {
    console.error("💥 Deployment script failed:", error);
    process.exit(1);
  });