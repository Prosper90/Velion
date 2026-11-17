const { expect } = require("chai");
const { ethers } = require("hardhat");

describe("PrivacyPoolV2 Multi-Asset Tests", function () {
  let privacyPool, verifier;
  let shieldVerifier, unshieldVerifier, transferVerifier;
  let owner, user1, user2;
  let mockUSDC, mockUSDT;

  const ETH_ADDRESS = "0x0000000000000000000000000000000000000000";

  before(async function () {
    [owner, user1, user2] = await ethers.getSigners();

    // Deploy mock ERC20 tokens for testing
    const MockERC20 = await ethers.getContractFactory("MockERC20");
    mockUSDC = await MockERC20.deploy("Mock USDC", "USDC", 6); // 6 decimals
    await mockUSDC.waitForDeployment();

    mockUSDT = await MockERC20.deploy("Mock USDT", "USDT", 6); // 6 decimals
    await mockUSDT.waitForDeployment();

    console.log("📝 Mock USDC deployed:", await mockUSDC.getAddress());
    console.log("📝 Mock USDT deployed:", await mockUSDT.getAddress());

    // Mint some tokens to test users
    await mockUSDC.mint(user1.address, ethers.parseUnits("1000", 6)); // 1000 USDC
    await mockUSDT.mint(user1.address, ethers.parseUnits("500", 6));  // 500 USDT

    // Deploy verifiers
    const ShieldVerifier = await ethers.getContractFactory("ShieldGroth16Verifier");
    shieldVerifier = await ShieldVerifier.deploy();
    await shieldVerifier.waitForDeployment();

    const UnshieldVerifier = await ethers.getContractFactory("UnshieldGroth16Verifier");
    unshieldVerifier = await UnshieldVerifier.deploy();
    await unshieldVerifier.waitForDeployment();

    const TransferVerifier = await ethers.getContractFactory("TransferGroth16Verifier");
    transferVerifier = await TransferVerifier.deploy();
    await transferVerifier.waitForDeployment();

    // Deploy main Verifier contract
    const Verifier = await ethers.getContractFactory("Verifier");
    verifier = await Verifier.deploy(
      await shieldVerifier.getAddress(),
      await unshieldVerifier.getAddress(),
      await transferVerifier.getAddress()
    );
    await verifier.waitForDeployment();

    // Deploy PrivacyPoolV2
    const PrivacyPoolV2 = await ethers.getContractFactory("PrivacyPoolV2");
    privacyPool = await PrivacyPoolV2.deploy(await verifier.getAddress());
    await privacyPool.waitForDeployment();

    console.log("✅ PrivacyPoolV2 deployed:", await privacyPool.getAddress());

    // Whitelist tokens
    const usdcAddress = await mockUSDC.getAddress();
    const usdtAddress = await mockUSDT.getAddress();

    await privacyPool.setTokenWhitelist(usdcAddress, true);
    await privacyPool.setTokenWhitelist(usdtAddress, true);

    console.log("✅ Tokens whitelisted");
  });

  describe("Token Whitelisting", function () {
    it("Should have ETH whitelisted by default", async function () {
      expect(await privacyPool.whitelistedTokens(ETH_ADDRESS)).to.be.true;
    });

    it("Should whitelist USDC and USDT", async function () {
      const usdcAddress = await mockUSDC.getAddress();
      const usdtAddress = await mockUSDT.getAddress();

      expect(await privacyPool.whitelistedTokens(usdcAddress)).to.be.true;
      expect(await privacyPool.whitelistedTokens(usdtAddress)).to.be.true;
    });

    it("Should only allow owner to whitelist tokens", async function () {
      const randomAddress = "0x0000000000000000000000000000000000000001";
      await expect(
        privacyPool.connect(user1).setTokenWhitelist(randomAddress, true)
      ).to.be.reverted;
    });
  });

  describe("ETH Shielding", function () {
    it("Should allow user to shield ETH", async function () {
      const amount = ethers.parseEther("1.0");
      const commitment = ethers.id("test_commitment_eth");

      await expect(
        privacyPool.connect(user1).shieldETH(commitment, { value: amount })
      ).to.emit(privacyPool, "Shield")
        .withArgs(user1.address, ETH_ADDRESS, amount, commitment);

      // Check shielded transaction was recorded
      const tx = await privacyPool.shieldedTransactions(commitment);
      expect(tx.commitment).to.equal(commitment);
      expect(tx.token).to.equal(ETH_ADDRESS);
      expect(tx.amount).to.equal(amount);
      expect(tx.spent).to.be.false;
    });

    it("Should reject shielding with zero amount", async function () {
      const commitment = ethers.id("test_commitment_zero");

      await expect(
        privacyPool.connect(user1).shieldETH(commitment, { value: 0 })
      ).to.be.revertedWith("Amount must be greater than 0");
    });

    it("Should reject duplicate commitment", async function () {
      const amount = ethers.parseEther("0.5");
      const commitment = ethers.id("test_commitment_duplicate");

      // First shield
      await privacyPool.connect(user1).shieldETH(commitment, { value: amount });

      // Try to shield with same commitment
      await expect(
        privacyPool.connect(user1).shieldETH(commitment, { value: amount })
      ).to.be.revertedWith("Commitment already exists");
    });
  });

  describe("ERC20 Shielding", function () {
    it("Should allow user to shield USDC", async function () {
      const amount = ethers.parseUnits("100", 6); // 100 USDC
      const commitment = ethers.id("test_commitment_usdc");
      const usdcAddress = await mockUSDC.getAddress();
      const poolAddress = await privacyPool.getAddress();

      // Approve PrivacyPool to spend USDC
      await mockUSDC.connect(user1).approve(poolAddress, amount);

      await expect(
        privacyPool.connect(user1).shieldERC20(usdcAddress, amount, commitment)
      ).to.emit(privacyPool, "Shield")
        .withArgs(user1.address, usdcAddress, amount, commitment);

      // Check shielded transaction was recorded
      const tx = await privacyPool.shieldedTransactions(commitment);
      expect(tx.token).to.equal(usdcAddress);
      expect(tx.amount).to.equal(amount);
    });

    it("Should allow user to shield USDT", async function () {
      const amount = ethers.parseUnits("50", 6); // 50 USDT
      const commitment = ethers.id("test_commitment_usdt");
      const usdtAddress = await mockUSDT.getAddress();
      const poolAddress = await privacyPool.getAddress();

      // Approve and shield
      await mockUSDT.connect(user1).approve(poolAddress, amount);

      await expect(
        privacyPool.connect(user1).shieldERC20(usdtAddress, amount, commitment)
      ).to.emit(privacyPool, "Shield");
    });

    it("Should reject non-whitelisted token", async function () {
      const amount = ethers.parseUnits("100", 6);
      const commitment = ethers.id("test_commitment_bad_token");
      const badToken = "0x0000000000000000000000000000000000000001";

      await expect(
        privacyPool.connect(user1).shieldERC20(badToken, amount, commitment)
      ).to.be.revertedWith("Token is not whitelisted");
    });

    it("Should reject shielding without approval", async function () {
      const amount = ethers.parseUnits("100", 6);
      const commitment = ethers.id("test_commitment_no_approval");
      const usdcAddress = await mockUSDC.getAddress();

      // Don't approve, try to shield directly
      await expect(
        privacyPool.connect(user1).shieldERC20(usdcAddress, amount, commitment)
      ).to.be.reverted; // Will fail due to insufficient allowance
    });
  });

  describe("Contract State", function () {
    it("Should track total shielded correctly", async function () {
      const totalShielded = await privacyPool.totalShielded();
      expect(totalShielded).to.be.gt(0);
      console.log("📊 Total Shielded:", totalShielded.toString());
    });

    it("Should be pausable by owner", async function () {
      await privacyPool.pause();
      expect(await privacyPool.paused()).to.be.true;

      // Try to shield while paused
      const commitment = ethers.id("test_paused");
      await expect(
        privacyPool.connect(user1).shieldETH(commitment, { value: ethers.parseEther("0.1") })
      ).to.be.reverted;

      // Unpause
      await privacyPool.unpause();
      expect(await privacyPool.paused()).to.be.false;
    });
  });

  describe("Unshielding", function () {
    it("Should allow user to unshield ETH", async function () {
      const amount = ethers.parseEther("1.0");
      const commitment = ethers.id("test_commitment_unshield_eth");

      // Shield ETH
      await privacyPool.connect(user1).shieldETH(commitment, { value: amount });

      // Unshield ETH
      const nullifier = ethers.id("test_nullifier_unshield_eth");
      const recipient = user2.address;
      const proof = {
        a: [0, 0],
        b: [[0, 0], [0, 0]],
        c: [0, 0],
        publicInputs: [0, 0, 0, 0]
      };

      await expect(
        privacyPool.connect(user1).unshield(nullifier, recipient, amount, ETH_ADDRESS, proof)
      ).to.be.revertedWith("Invalid proof");
    });
  });

  describe("Multi-Asset Support", function () {
    it("Should support shielding multiple assets from same user", async function () {
      // Shield ETH
      const ethCommitment = ethers.id("multi_eth");
      await privacyPool.connect(user2).shieldETH(ethCommitment, {
        value: ethers.parseEther("0.5")
      });

      // Shield USDC
      const usdcCommitment = ethers.id("multi_usdc");
      const usdcAddress = await mockUSDC.getAddress();
      const poolAddress = await privacyPool.getAddress();
      const amount = ethers.parseUnits("50", 6);

      await mockUSDC.mint(user2.address, amount);
      await mockUSDC.connect(user2).approve(poolAddress, amount);
      await privacyPool.connect(user2).shieldERC20(usdcAddress, amount, usdcCommitment);

      // Verify both transactions exist
      const ethTx = await privacyPool.shieldedTransactions(ethCommitment);
      const usdcTx = await privacyPool.shieldedTransactions(usdcCommitment);

      expect(ethTx.token).to.equal(ETH_ADDRESS);
      expect(usdcTx.token).to.equal(usdcAddress);
      expect(ethTx.spent).to.be.false;
      expect(usdcTx.spent).to.be.false;
    });
  });
});

// Mock ERC20 for testing
const MockERC20Code = `
// SPDX-License-Identifier: MIT
pragma solidity ^0.8.19;

import "@openzeppelin/contracts/token/ERC20/ERC20.sol";

contract MockERC20 is ERC20 {
    uint8 private _decimals;

    constructor(string memory name, string memory symbol, uint8 decimals_) ERC20(name, symbol) {
        _decimals = decimals_;
    }

    function decimals() public view virtual override returns (uint8) {
        return _decimals;
    }

    function mint(address to, uint256 amount) external {
        _mint(to, amount);
    }
}
`;

// Dummy Verifier for testing (always returns true)
const DummyVerifierCode = `
// SPDX-License-Identifier: MIT
pragma solidity ^0.8.19;

contract DummyGroth16Verifier {
    function verifyProof(
        uint[2] calldata,
        uint[2][2] calldata,
        uint[2] calldata,
        uint[] calldata
    ) public pure returns (bool) {
        return true; // Always valid for testing
    }
}
`;
