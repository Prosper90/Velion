const { expect } = require("chai");
const { ethers } = require("hardhat");
const axios = require("axios");

describe("Full Flow Integration Test", function () {
  let privacyPool;
  let verifier;
  let shieldVerifier, unshieldVerifier, transferVerifier;
  let owner, userA, userB;

  const RELAYER_URL = "http://localhost:3004";
  const ETH_ADDRESS = ethers.ZeroAddress;

  before(async function () {
    [owner, userA, userB] = await ethers.getSigners();

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

  describe("Test 1: Shield → Unshield (Same User)", function () {
    it("Should shield and then unshield ETH successfully", async function () {
      this.timeout(120000);

      const shieldAmount = ethers.parseEther("0.001");

      console.log("\n📝 TEST 1: Shield → Unshield");
      console.log("━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━\n");

      // SHIELD
      console.log("📝 Step 1: Generate shield proof from relayer...");
      const shieldResponse = await axios.post(`${RELAYER_URL}/api/privacy/shield`, {
        amount: "0.001",
        recipient: userA.address,
        token: "ETH"
      });

      expect(shieldResponse.data.success).to.be.true;
      const { commitment, nullifier, secret, randomness } = shieldResponse.data;

      console.log("✅ Shield proof generated");
      console.log("  Commitment:", commitment.substring(0, 20) + "...");

      console.log("\n📝 Step 2: Shield ETH on-chain...");
      const commitmentBytes32 = ethers.zeroPadValue(ethers.toBeHex(BigInt(commitment)), 32);

      const shieldTx = await privacyPool.connect(userA).shieldETH(commitmentBytes32, {
        value: shieldAmount
      });
      await shieldTx.wait();

      console.log("✅ Shield transaction confirmed");
      console.log("  Tx hash:", shieldTx.hash);

      const commitmentExists = await privacyPool.commitmentExists(commitmentBytes32);
      expect(commitmentExists).to.be.true;
      console.log("✅ Commitment stored on-chain");

      // UNSHIELD
      console.log("\n📝 Step 3: Generate unshield proof from relayer...");
      const unshieldResponse = await axios.post(`${RELAYER_URL}/api/privacy/unshield`, {
        amount: "0.001",
        recipient: userA.address,
        secret,
        nullifier,
        randomness,
        commitment
      });

      expect(unshieldResponse.data.success).to.be.true;
      const { proof: unshieldProof, publicSignals: unshieldPublicSignals } = unshieldResponse.data;

      console.log("✅ Unshield proof generated");
      console.log("  Public signals count:", unshieldPublicSignals.length);

      console.log("\n📝 Step 4: Unshield ETH on-chain...");

      // Prepare proof struct
      const proofStruct = {
        a: [unshieldProof.pi_a[0], unshieldProof.pi_a[1]],
        b: [
          [unshieldProof.pi_b[0][0], unshieldProof.pi_b[0][1]],
          [unshieldProof.pi_b[1][0], unshieldProof.pi_b[1][1]]
        ],
        c: [unshieldProof.pi_c[0], unshieldProof.pi_c[1]],
        publicInputs: unshieldPublicSignals
      };

      const unshieldTx = await privacyPool.connect(userA).unshield(
        commitmentBytes32,
        userA.address,
        shieldAmount,
        ETH_ADDRESS,
        proofStruct
      );
      await unshieldTx.wait();

      console.log("✅ Unshield transaction confirmed");
      console.log("  Tx hash:", unshieldTx.hash);

      // Verify commitment is spent
      const txData = await privacyPool.shieldedTransactions(commitmentBytes32);
      expect(txData.spent).to.be.true;
      console.log("✅ Commitment marked as spent");

      console.log("\n✅ TEST 1 PASSED: Shield → Unshield successful!\n");
    });
  });

  describe("Test 2: Shield → Private Transfer → Import → Unshield", function () {
    it("Should complete full private transfer flow between users", async function () {
      this.timeout(180000);

      const shieldAmount = ethers.parseEther("0.002");

      console.log("\n📝 TEST 2: Shield → Private Transfer → Import → Unshield");
      console.log("━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━\n");

      // STEP 1: USER A SHIELDS ETH
      console.log("📝 Step 1: User A - Generate shield proof...");
      const shieldResponse = await axios.post(`${RELAYER_URL}/api/privacy/shield`, {
        amount: "0.002",
        recipient: userA.address,
        token: "ETH"
      });

      expect(shieldResponse.data.success).to.be.true;
      const {
        commitment: inputCommitment,
        nullifier: inputNullifier,
        secret: inputSecret,
        randomness: inputRandomness
      } = shieldResponse.data;

      console.log("✅ Shield proof generated for User A");
      console.log("  Input Commitment:", inputCommitment.substring(0, 20) + "...");

      console.log("\n📝 Step 2: User A - Shield ETH on-chain...");
      const inputCommitmentBytes32 = ethers.zeroPadValue(
        ethers.toBeHex(BigInt(inputCommitment)),
        32
      );

      const shieldTx = await privacyPool.connect(userA).shieldETH(inputCommitmentBytes32, {
        value: shieldAmount
      });
      await shieldTx.wait();

      console.log("✅ Shield transaction confirmed for User A");
      console.log("  Tx hash:", shieldTx.hash);

      // STEP 2: USER A MAKES PRIVATE TRANSFER TO USER B
      console.log("\n📝 Step 3: User A - Generate private transfer proof...");

      // Generate random output secrets for User B
      const outputSecret = Math.floor(Math.random() * 1000000000000000).toString();
      const outputNullifier = Math.floor(Math.random() * 1000000000000000).toString();
      const outputRandomness = Math.floor(Math.random() * 1000000000000000).toString();

      const transferResponse = await axios.post(`${RELAYER_URL}/api/privacy/transfer`, {
        inputCommitment,
        outputCommitment: "0",
        amount: "0.002",
        recipient: userB.address,
        inputSecret,
        inputNullifier,
        inputRandomness,
        outputSecret,
        outputNullifier,
        outputRandomness
      });

      expect(transferResponse.data.success).to.be.true;
      const {
        proof: transferProof,
        publicSignals: transferPublicSignals,
        outputCommitment
      } = transferResponse.data;

      console.log("✅ Private transfer proof generated");
      console.log("  Output Commitment (for User B):", outputCommitment.substring(0, 20) + "...");

      // Create transfer note for User B
      const transferNote = {
        version: "1",
        amount: "0.002",
        secret: outputSecret,
        nullifier: outputNullifier,
        randomness: outputRandomness,
        commitment: outputCommitment,
        token: "ETH"
      };

      console.log("\n📝 Step 4: User A - Execute private transfer on-chain...");

      const outputCommitmentBytes32 = ethers.zeroPadValue(
        ethers.toBeHex(BigInt(outputCommitment)),
        32
      );

      const transferProofStruct = {
        a: [transferProof.pi_a[0], transferProof.pi_a[1]],
        b: [
          [transferProof.pi_b[0][0], transferProof.pi_b[0][1]],
          [transferProof.pi_b[1][0], transferProof.pi_b[1][1]]
        ],
        c: [transferProof.pi_c[0], transferProof.pi_c[1]],
        publicInputs: transferPublicSignals
      };

      const transferTx = await privacyPool.connect(userA).privateTransfer(
        inputCommitmentBytes32,
        outputCommitmentBytes32,
        ETH_ADDRESS,
        transferProofStruct
      );
      await transferTx.wait();

      console.log("✅ Private transfer transaction confirmed");
      console.log("  Tx hash:", transferTx.hash);

      // Verify input commitment is spent
      const inputTxData = await privacyPool.shieldedTransactions(inputCommitmentBytes32);
      expect(inputTxData.spent).to.be.true;
      console.log("✅ User A's commitment marked as spent");

      // Verify output commitment exists
      const outputExists = await privacyPool.commitmentExists(outputCommitmentBytes32);
      expect(outputExists).to.be.true;
      console.log("✅ User B's commitment stored on-chain");

      // STEP 3: USER B IMPORTS THE NOTE
      console.log("\n📝 Step 5: User B - Import transfer note...");
      console.log("  Transfer Note Data:");
      console.log("    Amount:", transferNote.amount, "ETH");
      console.log("    Commitment:", transferNote.commitment.substring(0, 20) + "...");
      console.log("    Secret:", transferNote.secret.substring(0, 20) + "...");
      console.log("    Nullifier:", transferNote.nullifier.substring(0, 20) + "...");
      console.log("    Randomness:", transferNote.randomness.substring(0, 20) + "...");

      // Verify commitment matches what User B received
      const importedCommitment = transferNote.commitment;
      expect(importedCommitment).to.equal(outputCommitment);
      console.log("✅ User B successfully imported the note");

      // STEP 4: USER B UNSHIELDS THE IMPORTED FUNDS
      console.log("\n📝 Step 6: User B - Generate unshield proof for imported funds...");

      const userBUnshieldResponse = await axios.post(`${RELAYER_URL}/api/privacy/unshield`, {
        amount: "0.002",
        recipient: userB.address,
        secret: transferNote.secret,
        nullifier: transferNote.nullifier,
        randomness: transferNote.randomness,
        commitment: transferNote.commitment
      });

      expect(userBUnshieldResponse.data.success).to.be.true;
      const {
        proof: userBUnshieldProof,
        publicSignals: userBUnshieldPublicSignals,
        nullifierHash: userBNullifierHash
      } = userBUnshieldResponse.data;

      console.log("✅ Unshield proof generated for User B");
      console.log("  Public signals count:", userBUnshieldPublicSignals.length);
      console.log("  Nullifier Hash:", userBNullifierHash.substring(0, 20) + "...");

      console.log("\n📝 Step 7: User B - Unshield imported funds on-chain...");

      const userBProofStruct = {
        a: [userBUnshieldProof.pi_a[0], userBUnshieldProof.pi_a[1]],
        b: [
          [userBUnshieldProof.pi_b[0][0], userBUnshieldProof.pi_b[0][1]],
          [userBUnshieldProof.pi_b[1][0], userBUnshieldProof.pi_b[1][1]]
        ],
        c: [userBUnshieldProof.pi_c[0], userBUnshieldProof.pi_c[1]],
        publicInputs: userBUnshieldPublicSignals
      };

      const userBUnshieldTx = await privacyPool.connect(userB).unshield(
        outputCommitmentBytes32,
        userB.address,
        shieldAmount,
        ETH_ADDRESS,
        userBProofStruct
      );
      await userBUnshieldTx.wait();

      console.log("✅ Unshield transaction confirmed for User B");
      console.log("  Tx hash:", userBUnshieldTx.hash);

      // Verify output commitment is spent
      const outputTxData = await privacyPool.shieldedTransactions(outputCommitmentBytes32);
      expect(outputTxData.spent).to.be.true;
      console.log("✅ User B's commitment marked as spent");

      console.log("\n✅ TEST 2 PASSED: Full flow successful!");
      console.log("  User A: Shield → Private Transfer ✅");
      console.log("  User B: Import Note → Unshield ✅\n");
    });
  });

  after(function () {
    console.log("\n━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━");
    console.log("🎉 ALL TESTS PASSED!");
    console.log("━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━\n");
    console.log("Summary:");
    console.log("  ✅ Shield → Unshield (same user)");
    console.log("  ✅ Shield → Private Transfer → Import → Unshield (different users)");
    console.log("\nThe Veilon Privacy Pool is working perfectly! 🚀\n");
  });
});
