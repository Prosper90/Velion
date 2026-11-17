
const { expect } = require("chai");
const { ethers } = require("hardhat");
const { loadFixture } = require("@nomicfoundation/hardhat-toolbox/network-helpers");

describe("EmergencyExit Simple", function () {
  // Fixture for deploying contracts
  async function deployEmergencyExitFixture() {
    const [owner, user1, emergencyContact1, emergencyContact2] = await ethers.getSigners();

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

    return { emergencyExit, owner, user1, emergencyContact1, emergencyContact2 };
  }

  it("Should store emergency contacts", async function () {
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

    await emergencyExit.connect(user1).configureEmergencyExit(contacts, cooldownPeriod, recoveryHash, strategy);

    const config = await emergencyExit.userConfigs(user1.address);
    const storedContacts = await emergencyExit.getEmergencyContacts(user1.address);
    console.log("Stored Contacts:", storedContacts);
    expect(storedContacts).to.deep.equal(contacts);
  });
});
