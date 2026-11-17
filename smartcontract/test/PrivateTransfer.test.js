const { expect } = require("chai");
const { ethers } = require("hardhat");
const axios = require("axios");

describe("PrivateTransfer Integration Test", function () {
  let privacyPool;
  let verifier;
  let shieldVerifier, unshieldVerifier, transferVerifier;
  let owner, user1, user2;

  const RELAYER_URL = "http://localhost:3004";
  const ETH_ADDRESS = ethers.ZeroAddress;

  before(async function () {
    [owner, user1, user2] = await ethers.getSigners();

    console.log("\n🔧 Deploying contracts...\n");

    // Deploy Groth16 Verifiers
    const ShieldVerifier = await ethers.getContractFactory("ShieldGroth16Verifier");
    shieldVerifier = await ShieldVerifier.deploy();
    await shieldVerifier.waitForDeployment();
    console.log("✅ ShieldVerifier deployed:", await shieldVerifier.getAddress());

    const UnshieldVerifier = await ethers.getContractFactory("UnshieldGroth16Verifier");
    unshieldVerifier = await UnshieldVerifier.deploy();
    await unshieldVerifier.waitForDeployment();
    console.log("✅ UnshieldVerifier deployed:", await unshieldVerifier.getAddress());

    const TransferVerifier = await ethers.getContractFactory("TransferGroth16Verifier");
    transferVerifier = await TransferVerifier.deploy();
    await transferVerifier.waitForDeployment();
    console.log("✅ TransferVerifier deployed:", await transferVerifier.getAddress());

    // Deploy Main Verifier
    const Verifier = await ethers.getContractFactory("Verifier");
    verifier = await Verifier.deploy(
      await shieldVerifier.getAddress(),
      await unshieldVerifier.getAddress(),
      await transferVerifier.getAddress()
    );
    await verifier.waitForDeployment();
    console.log("✅ Verifier deployed:", await verifier.getAddress());

    // Deploy PrivacyPoolV2
    const PrivacyPoolV2 = await ethers.getContractFactory("PrivacyPoolV2");
    privacyPool = await PrivacyPoolV2.deploy(await verifier.getAddress());
    await privacyPool.waitForDeployment();
    console.log("✅ PrivacyPoolV2 deployed:", await privacyPool.getAddress());
  });

  it("Should complete full private transfer flow", async function () {
    this.timeout(120000); // 2 minutes timeout

    const shieldAmount = ethers.parseEther("0.002");

    console.log("\n📝 Step 1: Generate shield proof from relayer...");

    // Call relayer to generate shield proof
    const shieldResponse = await axios.post(`${RELAYER_URL}/api/privacy/shield`, {
      amount: "0.002",
      recipient: user1.address,
      token: "ETH"
    });

    expect(shieldResponse.data.success).to.be.true;
    const { commitment, nullifier, secret, randomness, proof: shieldProof } = shieldResponse.data;

    console.log("✅ Shield proof generated");
    console.log("  Commitment:", commitment.substring(0, 20) + "...");

    console.log("\n📝 Step 2: Shield ETH on-chain...");

    // Convert commitment to bytes32
    const commitmentBytes32 = ethers.zeroPadValue(
      ethers.toBeHex(BigInt(commitment)),
      32
    );

    // Shield ETH
    const shieldTx = await privacyPool.connect(user1).shieldETH(commitmentBytes32, {
      value: shieldAmount
    });
    await shieldTx.wait();

    console.log("✅ Shield transaction confirmed");
    console.log("  Tx hash:", shieldTx.hash);

    // Verify commitment exists
    const commitmentExists = await privacyPool.commitmentExists(commitmentBytes32);
    expect(commitmentExists).to.be.true;
    console.log("✅ Commitment stored on-chain");

    console.log("\n📝 Step 3: Generate transfer proof from relayer...");

    // Call relayer to generate transfer proof
    const transferResponse = await axios.post(`${RELAYER_URL}/api/privacy/transfer`, {
      inputCommitment: commitment,
      outputCommitment: "0", // Will be calculated by backend
      amount: "0.002",
      recipient: user2.address,
      inputSecret: secret,
      inputNullifier: nullifier,
      inputRandomness: randomness,
      outputSecret: Math.floor(Math.random() * 1000000000000000).toString(),
      outputNullifier: Math.floor(Math.random() * 1000000000000000).toString(),
      outputRandomness: Math.floor(Math.random() * 1000000000000000).toString()
    });

    expect(transferResponse.data.success).to.be.true;
    const {
      proof: transferProof,
      publicSignals,
      nullifierHash,
      outputCommitment: newOutputCommitment
    } = transferResponse.data;

    console.log("✅ Transfer proof generated");
    console.log("  Public signals count:", publicSignals.length);
    console.log("  Public signals:");
    publicSignals.forEach((signal, i) => {
      console.log(`    [${i}]:`, signal);
    });

    console.log("\n📝 Step 4: Verify proof structure...");

    // Check proof structure
    expect(transferProof).to.have.property('pi_a');
    expect(transferProof).to.have.property('pi_b');
    expect(transferProof).to.have.property('pi_c');
    expect(publicSignals).to.have.lengthOf(5);

    console.log("✅ Proof structure valid");

    console.log("\n📝 Step 5: Test direct verifier call...");

    // Prepare proof for Solidity (remove 3rd element of pi_c)
    const proofForSolidity = [
      transferProof.pi_a[0],
      transferProof.pi_a[1]
    ];
    const proofB = [
      [transferProof.pi_b[0][1], transferProof.pi_b[0][0]], // Reversed!
      [transferProof.pi_b[1][1], transferProof.pi_b[1][0]]  // Reversed!
    ];
    const proofC = [
      transferProof.pi_c[0],
      transferProof.pi_c[1]
    ];

    try {
      const directVerifyResult = await transferVerifier.verifyProof(
        proofForSolidity,
        proofB,
        proofC,
        publicSignals
      );
      console.log("✅ Direct verifier result:", directVerifyResult);
    } catch (error) {
      console.log("❌ Direct verifier failed:", error.message);
    }

    console.log("\n📝 Step 5.5: Check circuit registration...");

    // Check if transfer circuit is registered
    try {
      const transferCircuit = await verifier.circuits("transfer");
      console.log("Transfer circuit info:");
      console.log("  isActive:", transferCircuit.isActive);
      console.log("  maxInputs:", transferCircuit.maxInputs.toString());
      console.log("  maxOutputs:", transferCircuit.maxOutputs.toString());
    } catch (error) {
      console.log("❌ Failed to query circuit:", error.message);
    }

    console.log("\n📝 Step 6: Execute private transfer on-chain...");

    // Convert values to bytes32
    const inputCommitmentBytes32 = ethers.zeroPadValue(
      ethers.toBeHex(BigInt(commitment)),
      32
    );
    const outputCommitmentBytes32 = ethers.zeroPadValue(
      ethers.toBeHex(BigInt(newOutputCommitment)),
      32
    );

    // Prepare proof struct
    const proofStruct = {
      a: [transferProof.pi_a[0], transferProof.pi_a[1]],
      b: [
        [transferProof.pi_b[0][0], transferProof.pi_b[0][1]],
        [transferProof.pi_b[1][0], transferProof.pi_b[1][1]]
      ],
      c: [transferProof.pi_c[0], transferProof.pi_c[1]],
      publicInputs: publicSignals
    };

    console.log("📊 Proof struct being sent:");
    console.log("  a:", proofStruct.a);
    console.log("  b:", proofStruct.b);
    console.log("  c:", proofStruct.c);
    console.log("  publicInputs:", proofStruct.publicInputs);

    try {
      // Execute private transfer
      const transferTx = await privacyPool.connect(user1).privateTransfer(
        inputCommitmentBytes32,
        outputCommitmentBytes32,
        ETH_ADDRESS,
        proofStruct
      );
      await transferTx.wait();

      console.log("✅ Private transfer successful!");
      console.log("  Tx hash:", transferTx.hash);

      // Verify output commitment exists
      const outputExists = await privacyPool.commitmentExists(outputCommitmentBytes32);
      expect(outputExists).to.be.true;
      console.log("✅ Output commitment stored on-chain");

    } catch (error) {
      console.log("\n❌ Private transfer failed!");
      console.log("Error:", error.message);

      // Log more details
      if (error.data) {
        console.log("Error data:", error.data);
      }

      throw error;
    }
  });
});
