const { ethers, network } = require("hardhat");
const fs = require("fs");
const path = require("path");

async function main() {
  console.log(`🚀 Deploying Veilon contracts to ${network.name}...`);
  
  const [deployer] = await ethers.getSigners();
  console.log("Deploying contracts with account:", deployer.address);
  
  const balance = await ethers.provider.getBalance(deployer.address);
  console.log("Account balance:", ethers.formatEther(balance), "ETH");

  if (balance < ethers.parseEther("0.01")) {
    throw new Error("Insufficient balance for deployment. Need at least 0.01 ETH");
  }

  const deployments = {};
  const networkName = network.name;

  try {
    // 1. Deploy Verifier contract
    console.log("\n📋 Deploying Verifier...");
    const VerifierFactory = await ethers.getContractFactory("Verifier");
    const verifier = await VerifierFactory.deploy();
    await verifier.waitForDeployment();
    const verifierAddress = await verifier.getAddress();
    
    console.log("✅ Verifier deployed to:", verifierAddress);
    deployments.verifier = verifierAddress;

    // 2. Deploy RelayerRegistry contract
    console.log("\n📋 Deploying RelayerRegistry...");
    const RelayerRegistryFactory = await ethers.getContractFactory("RelayerRegistry");
    
    // Arbitrum-specific parameters
    const minimumStake = ethers.parseEther("0.1"); // 0.1 ETH minimum stake (lower for Arbitrum)
    const maximumFee = ethers.parseEther("0.01"); // 0.01 ETH maximum fee
    const slashPercentage = 1000; // 10%
    const rewardPercentage = 500; // 5%
    
    const relayerRegistry = await RelayerRegistryFactory.deploy(
      minimumStake,
      maximumFee,
      slashPercentage,
      rewardPercentage
    );
    await relayerRegistry.waitForDeployment();
    const relayerRegistryAddress = await relayerRegistry.getAddress();
    
    console.log("✅ RelayerRegistry deployed to:", relayerRegistryAddress);
    deployments.relayerRegistry = relayerRegistryAddress;

    // 3. Deploy PrivacyPool contract
    console.log("\n📋 Deploying PrivacyPool...");
    const PrivacyPoolFactory = await ethers.getContractFactory("PrivacyPool");
    
    const relayerFee = ethers.parseEther("0.001"); // 0.001 ETH relayer fee
    
    const privacyPool = await PrivacyPoolFactory.deploy(
      verifierAddress,
      relayerRegistryAddress,
      relayerFee
    );
    await privacyPool.waitForDeployment();
    const privacyPoolAddress = await privacyPool.getAddress();
    
    console.log("✅ PrivacyPool deployed to:", privacyPoolAddress);
    deployments.privacyPool = privacyPoolAddress;

    // 4. Deploy Governance contract
    console.log("\n📋 Deploying Governance...");
    const GovernanceFactory = await ethers.getContractFactory("Governance");
    
    // Governance parameters for Arbitrum
    const votingDelay = 1; // 1 block delay (Arbitrum has ~4 second blocks)
    const votingPeriod = 43200; // ~2 days (43200 blocks * 4 seconds)
    const proposalThreshold = ethers.parseEther("1000"); // 1000 tokens to propose
    const quorumPercentage = 4; // 4% quorum
    
    const governance = await GovernanceFactory.deploy(
      "VeilonDAO",
      votingDelay,
      votingPeriod,
      proposalThreshold,
      quorumPercentage
    );
    await governance.waitForDeployment();
    const governanceAddress = await governance.getAddress();
    
    console.log("✅ Governance deployed to:", governanceAddress);
    deployments.governance = governanceAddress;

    // 5. Deploy EmergencyExit contract
    console.log("\n📋 Deploying EmergencyExit...");
    const EmergencyExitFactory = await ethers.getContractFactory("EmergencyExit");
    
    const emergencyDelay = 3600; // 1 hour delay for emergency actions
    const maxWallets = 10; // Maximum stealth wallets per emergency
    
    const emergencyExit = await EmergencyExitFactory.deploy(
      privacyPoolAddress,
      emergencyDelay,
      maxWallets
    );
    await emergencyExit.waitForDeployment();
    const emergencyExitAddress = await emergencyExit.getAddress();
    
    console.log("✅ EmergencyExit deployed to:", emergencyExitAddress);
    deployments.emergencyExit = emergencyExitAddress;

    // 6. Configure contracts
    console.log("\n⚙️ Configuring contracts...");
    
    // Register EmergencyExit as authorized relayer
    try {
      console.log("Registering EmergencyExit as relayer...");
      
      // First register in RelayerRegistry with stake
      const stakeTx = await relayerRegistry.registerRelayer(
        ethers.parseEther("0.001"), // emergency relayer fee
        { value: minimumStake }
      );
      await stakeTx.wait();
      
      // Then register in PrivacyPool
      const registerTx = await privacyPool.registerRelayer(
        emergencyExitAddress,
        ethers.parseEther("0.001")
      );
      await registerTx.wait();
      
      console.log("✅ EmergencyExit registered as relayer");
    } catch (error) {
      console.warn("⚠️ Failed to register EmergencyExit as relayer:", error.message);
    }

    // 7. Save deployment info
    console.log("\n💾 Saving deployment information...");
    
    const deploymentInfo = {
      network: networkName,
      chainId: network.config.chainId,
      timestamp: new Date().toISOString(),
      deployer: deployer.address,
      contracts: deployments,
      parameters: {
        relayerFee: ethers.formatEther(relayerFee),
        minimumStake: ethers.formatEther(minimumStake),
        maximumFee: ethers.formatEther(maximumFee),
        emergencyDelay,
        maxWallets,
        votingPeriod,
        proposalThreshold: ethers.formatEther(proposalThreshold)
      },
      blockNumbers: {
        verifier: await ethers.provider.getBlockNumber(),
        relayerRegistry: await ethers.provider.getBlockNumber(),
        privacyPool: await ethers.provider.getBlockNumber(),
        governance: await ethers.provider.getBlockNumber(),
        emergencyExit: await ethers.provider.getBlockNumber()
      }
    };

    // Save to deployments directory
    const deploymentsDir = path.join(__dirname, "../deployments");
    if (!fs.existsSync(deploymentsDir)) {
      fs.mkdirSync(deploymentsDir, { recursive: true });
    }
    
    const deploymentFile = path.join(deploymentsDir, `${networkName}-deployment.json`);
    fs.writeFileSync(deploymentFile, JSON.stringify(deploymentInfo, null, 2));
    
    console.log(`✅ Deployment info saved to: ${deploymentFile}`);

    // 8. Update environment files
    console.log("\n📝 Updating environment files...");
    
    const envUpdates = {
      [`${networkName.toUpperCase()}_PRIVACY_POOL_ADDRESS`]: privacyPoolAddress,
      [`${networkName.toUpperCase()}_VERIFIER_ADDRESS`]: verifierAddress,
      [`${networkName.toUpperCase()}_RELAYER_REGISTRY_ADDRESS`]: relayerRegistryAddress,
      [`${networkName.toUpperCase()}_GOVERNANCE_ADDRESS`]: governanceAddress,
      [`${networkName.toUpperCase()}_EMERGENCY_EXIT_ADDRESS`]: emergencyExitAddress,
      [`${networkName.toUpperCase()}_CHAIN_ID`]: network.config.chainId.toString()
    };

    // Update env.example
    const envExamplePath = path.join(__dirname, "../../env.example");
    if (fs.existsSync(envExamplePath)) {
      let envContent = fs.readFileSync(envExamplePath, "utf8");
      
      Object.entries(envUpdates).forEach(([key, value]) => {
        const regex = new RegExp(`^${key}=.*$`, "m");
        if (regex.test(envContent)) {
          envContent = envContent.replace(regex, `${key}=${value}`);
        } else {
          envContent += `\n${key}=${value}`;
        }
      });
      
      fs.writeFileSync(envExamplePath, envContent);
      console.log("✅ Updated env.example with contract addresses");
    }

    // 9. Verify contracts on Arbiscan (if API key provided)
    if (process.env.ARBISCAN_API_KEY && (networkName === 'arbitrumSepolia' || networkName === 'arbitrumOne')) {
      console.log("\n🔍 Verifying contracts on Arbiscan...");
      
      try {
        // Wait a bit for the transactions to be indexed
        console.log("Waiting for transactions to be indexed...");
        await new Promise(resolve => setTimeout(resolve, 30000));
        
        // Verify Verifier
        await hre.run("verify:verify", {
          address: verifierAddress,
          constructorArguments: [],
        });
        console.log("✅ Verifier verified");

        // Verify RelayerRegistry
        await hre.run("verify:verify", {
          address: relayerRegistryAddress,
          constructorArguments: [minimumStake, maximumFee, slashPercentage, rewardPercentage],
        });
        console.log("✅ RelayerRegistry verified");

        // Verify PrivacyPool
        await hre.run("verify:verify", {
          address: privacyPoolAddress,
          constructorArguments: [verifierAddress, relayerRegistryAddress, relayerFee],
        });
        console.log("✅ PrivacyPool verified");

        // Verify Governance
        await hre.run("verify:verify", {
          address: governanceAddress,
          constructorArguments: ["VeilonDAO", votingDelay, votingPeriod, proposalThreshold, quorumPercentage],
        });
        console.log("✅ Governance verified");

        // Verify EmergencyExit
        await hre.run("verify:verify", {
          address: emergencyExitAddress,
          constructorArguments: [privacyPoolAddress, emergencyDelay, maxWallets],
        });
        console.log("✅ EmergencyExit verified");

      } catch (error) {
        console.warn("⚠️ Contract verification failed:", error.message);
      }
    }

    // 10. Summary
    console.log("\n🎉 Deployment completed successfully!");
    console.log("═".repeat(60));
    console.log(`Network: ${networkName} (Chain ID: ${network.config.chainId})`);
    console.log(`Deployer: ${deployer.address}`);
    console.log(`Gas Used: Check transaction receipts`);
    console.log("═".repeat(60));
    console.log("📋 Contract Addresses:");
    console.log(`  Verifier: ${verifierAddress}`);
    console.log(`  RelayerRegistry: ${relayerRegistryAddress}`);
    console.log(`  PrivacyPool: ${privacyPoolAddress}`);
    console.log(`  Governance: ${governanceAddress}`);
    console.log(`  EmergencyExit: ${emergencyExitAddress}`);
    console.log("═".repeat(60));
    console.log("🔗 Useful Links:");
    
    const explorerBase = networkName === 'arbitrumOne' 
      ? 'https://arbiscan.io' 
      : 'https://sepolia.arbiscan.io';
      
    console.log(`  Explorer: ${explorerBase}`);
    console.log(`  PrivacyPool: ${explorerBase}/address/${privacyPoolAddress}`);
    console.log(`  Bridge: https://bridge.arbitrum.io/`);
    console.log("═".repeat(60));
    
    return deployments;

  } catch (error) {
    console.error("❌ Deployment failed:", error);
    throw error;
  }
}

// Execute deployment
if (require.main === module) {
  main()
    .then(() => process.exit(0))
    .catch((error) => {
      console.error(error);
      process.exit(1);
    });
}

module.exports = main;


