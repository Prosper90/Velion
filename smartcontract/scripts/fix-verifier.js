const hre = require("hardhat");
const { ethers } = require("hardhat");

async function main() {
  console.log("🔧 Fixing Verifier circuit configuration...");

  // Get the deployer/owner account
  const [owner] = await ethers.getSigners();
  console.log("Owner address:", owner.address);

  // Verifier contract address (you'll need to find this)
  // It was deployed before PrivacyPool, so check your deployment logs
  // For now, we'll need to get it from the PrivacyPool contract
  const PRIVACY_POOL_ADDRESS = "0xC8d00b04F029F9F30A0Ece252FbfB8B455708EF6";

  const PrivacyPool = await ethers.getContractFactory("PrivacyPool");
  const privacyPool = PrivacyPool.attach(PRIVACY_POOL_ADDRESS);

  // Get the verifier contract address
  const verifierAddress = await privacyPool.verifierContract();
  console.log("Verifier contract address:", verifierAddress);

  // Connect to the Verifier contract
  const Verifier = await ethers.getContractFactory("Verifier");
  const verifier = Verifier.attach(verifierAddress);

  console.log("\n📊 Current circuit info:");
  const currentCircuit = await verifier.getCircuit("unshield");
  console.log("  Circuit type: unshield");
  console.log("  Is active:", currentCircuit.isActive);
  console.log("  Max inputs:", currentCircuit.maxInputs.toString());
  console.log("  Max outputs:", currentCircuit.maxOutputs.toString());

  console.log("\n🔄 Updating circuit to accept 3 public inputs...");

  // Update the circuit to accept 3 inputs (nullifier, recipient, amount)
  const tx = await verifier.updateCircuit("unshield", 3, 1);
  console.log("⏳ Transaction submitted:", tx.hash);

  await tx.wait();
  console.log("✅ Circuit updated successfully!");

  // Verify the update
  const updatedCircuit = await verifier.getCircuit("unshield");
  console.log("\n✅ Updated circuit info:");
  console.log("  Max inputs:", updatedCircuit.maxInputs.toString());
  console.log("  Max outputs:", updatedCircuit.maxOutputs.toString());

  console.log("\n🎉 Done! You can now unshield tokens.");
}

main()
  .then(() => process.exit(0))
  .catch((error) => {
    console.error(error);
    process.exit(1);
  });
