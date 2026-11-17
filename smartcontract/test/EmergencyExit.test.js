
const { expect } = require("chai");
const { ethers } = require("hardhat");
const { loadFixture } = require("@nomicfoundation/hardhat-toolbox/network-helpers");

describe("EmergencyExit", function () {
  // Fixture for deploying contracts
  async function deployEmergencyExitFixture() {
    const [owner, user1, user2, emergencyContact1, emergencyContact2] = await ethers.getSigners();

    // Deploy Verifier
    const ShieldGroth16Verifier = await ethers.getContractFactory("ShieldGroth16Verifier");
    const shieldVerifier = await ShieldGroth16Verifier.deploy();
    await shieldVerifier.waitForDeployment();

    const UnshieldGroth16Verifier = await ethers.getContractFactory("UnshieldGroth16Verifier");
    const unshieldVerifier = await UnshieldGroth16Verifier.deploy();
    await unshieldVerifier.waitForDeployment();

    const TransferGroth16Verifier = await ethers.getContractFactory("TransferGroth16Verifier");
    const transferVerifier = await TransferGroth16Verifier.deploy();
    await transferVerifier.waitForDeployment();

    const Verifier = await ethers.getContractFactory("Verifier");
    const verifier = await Verifier.deploy(
      await shieldVerifier.getAddress(),
      await unshieldVerifier.getAddress(),
      await transferVerifier.getAddress()
    );
    await verifier.waitForDeployment();

    // Deploy PrivacyPoolV2
    const PrivacyPoolV2 = await ethers.getContractFactory("PrivacyPoolV2");
    const privacyPoolV2 = await PrivacyPoolV2.deploy(await verifier.getAddress());
    await privacyPoolV2.waitForDeployment();

    // Deploy EmergencyExit
    const EmergencyExit = await ethers.getContractFactory("EmergencyExit");
    const emergencyExit = await EmergencyExit.deploy(
      await privacyPoolV2.getAddress(),
      await verifier.getAddress()
    );
    await emergencyExit.waitForDeployment();

    return { emergencyExit, privacyPoolV2, verifier, owner, user1, user2, emergencyContact1, emergencyContact2 };
  }

  describe("Deployment", function () {
    it("Should set the correct PrivacyPoolV2 address", async function () {
      const { emergencyExit, privacyPoolV2 } = await loadFixture(deployEmergencyExitFixture);
      expect(await emergencyExit.privacyPool()).to.equal(await privacyPoolV2.getAddress());
    });

    it("Should set the correct verifier address", async function () {
      const { emergencyExit, verifier } = await loadFixture(deployEmergencyExitFixture);
      expect(await emergencyExit.verifier()).to.equal(await verifier.getAddress());
    });

    it("Should set the correct owner", async function () {
      const { emergencyExit, owner } = await loadFixture(deployEmergencyExitFixture);
      expect(await emergencyExit.owner()).to.equal(owner.address);
    });
  });

  describe("Configuration", function () {
    it("Should allow a user to configure their emergency settings", async function () {
      const { emergencyExit, user1, emergencyContact1, emergencyContact2 } = await loadFixture(deployEmergencyExitFixture);

      const contacts = [emergencyContact1.address, emergencyContact2.address];
      const cooldownPeriod = 3600; // 1 hour
      const recoveryHash = ethers.keccak256(ethers.toUtf8Bytes("recovery-phrase"));
      const strategy = {
        strategyType: 0, // equal
        numberOfWallets: 3,
        amounts: [],
        timeLocks: [],
        requiresMultiSig: false,
      };

      await expect(
        emergencyExit.connect(user1).configureEmergencyExit(contacts, cooldownPeriod, recoveryHash, strategy)
      ).to.not.be.reverted;

      const config = await emergencyExit.userConfigs(user1.address);
      const storedContacts = await emergencyExit.getEmergencyContacts(user1.address);
      expect(storedContacts).to.deep.equal(contacts);
      expect(config.cooldownPeriod).to.equal(cooldownPeriod);
      expect(config.recoveryHash).to.equal(recoveryHash);
    });
  });

  describe("Panic Button", function () {
    it("Should allow a user to trigger the panic button", async function () {
      const { emergencyExit, user1, emergencyContact1 } = await loadFixture(deployEmergencyExitFixture);

      // First, configure emergency settings
      const contacts = [emergencyContact1.address];
      const cooldownPeriod = 3600;
      const recoveryHash = ethers.keccak256(ethers.toUtf8Bytes("recovery-phrase"));
      const strategy = {
        strategyType: 0,
        numberOfWallets: 3,
        amounts: [],
        timeLocks: [],
        requiresMultiSig: false,
      };
      await emergencyExit.connect(user1).configureEmergencyExit(contacts, cooldownPeriod, recoveryHash, strategy);

      const proof = "0x1234"; // Dummy proof
      const totalAmount = ethers.parseEther("10.0");
      const customStrategy = {
        strategyType: 0,
        numberOfWallets: 0, // Using default strategy
        amounts: [],
        timeLocks: [],
        requiresMultiSig: false,
      };
      const emergencyFee = await emergencyExit.emergencyFee();

      await expect(
        emergencyExit.connect(user1).triggerPanicButton(proof, totalAmount, customStrategy, { value: emergencyFee })
      ).to.emit(emergencyExit, "PanicTriggered");
    });
  });
});
