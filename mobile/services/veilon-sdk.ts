// NOTE: global-setup is now loaded in index.js (main entry point)
// Polyfills should be available by the time this module loads
import { VeilonSDK } from "../utils/sdk";
import { ethers } from "ethers";
import * as SecureStore from "expo-secure-store";
import { commitmentStoreRN } from "../utils/commitment-store-rn";
import axios from "axios";
import { getRelayerEndpoint, RELAYER_CONFIG } from "../constants/relayer";
import { PRIVACY_POOL_ABI, getContractAddress } from "../constants/contracts";

/**
 * VeilonSDK Service - Wrapper for Veilon SDK integration in React Native
 */
class VeilonSDKService {
  private sdk: VeilonSDK | null = null;
  private provider: ethers.JsonRpcProvider | null = null;
  private signer: ethers.Wallet | null = null;

  /**
   * Initialize the SDK with a wallet's private key
   */
  async initialize(privateKey: string): Promise<void> {
    try {
      console.log("🔧 Initializing VeilonSDK...");

      // Create provider for Sepolia - using Alchemy public endpoint which supports eth_getLogs
      this.provider = new ethers.JsonRpcProvider(
        "https://ethereum-sepolia-rpc.publicnode.com"
      );

      // Create signer from private key
      const formattedKey = privateKey.startsWith("0x")
        ? privateKey
        : `0x${privateKey}`;
      this.signer = new ethers.Wallet(formattedKey, this.provider);

      // Initialize SDK
      this.sdk = new VeilonSDK({
        network: "sepolia",
        provider: this.provider,
        signer: this.signer,
      });

      console.log("✅ VeilonSDK initialized successfully");
    } catch (error) {
      console.error("❌ Failed to initialize VeilonSDK:", error);
      throw error;
    }
  }

  /**
   * Initialize SDK from stored wallet
   */
  async initializeFromStorage(): Promise<void> {
    try {
      const privateKey = await SecureStore.getItemAsync("wallet_private_key");
      if (!privateKey) {
        throw new Error("No wallet found in storage");
      }

      await this.initialize(privateKey);
    } catch (error) {
      console.error("❌ Failed to initialize SDK from storage:", error);
      throw error;
    }
  }

  /**
   * Get the SDK instance
   */
  getSDK(): VeilonSDK {
    if (!this.sdk) {
      throw new Error("SDK not initialized. Call initialize() first.");
    }
    return this.sdk;
  }

  /**
   * Get the provider instance
   */
  getProvider(): ethers.JsonRpcProvider {
    if (!this.provider) {
      throw new Error("Provider not initialized. Call initialize() first.");
    }
    return this.provider;
  }

  /**
   * Get the signer instance
   */
  getSigner(): ethers.Wallet {
    if (!this.signer) {
      throw new Error("Signer not initialized. Call initialize() first.");
    }
    return this.signer;
  }

  /**
   * Switch to a different network
   */
  async switchNetwork(
    chainId: number,
    rpcUrl: string,
    privateKey: string
  ): Promise<void> {
    try {
      console.log(`🌐 Switching to network (Chain ID: ${chainId})...`);

      // Create new provider for the specified network
      this.provider = new ethers.JsonRpcProvider(rpcUrl);

      // Recreate signer with new provider
      const formattedKey = privateKey.startsWith("0x")
        ? privateKey
        : `0x${privateKey}`;
      this.signer = new ethers.Wallet(formattedKey, this.provider);

      // Determine network name based on chain ID
      let networkName = "mainnet";
      switch (chainId) {
        case 1:
          networkName = "mainnet";
          break;
        case 56:
          networkName = "bsc";
          break;
        case 137:
          networkName = "polygon";
          break;
        case 42161:
          networkName = "arbitrum";
          break;
        case 11155111:
          networkName = "sepolia";
          break;
        default:
          networkName = "mainnet";
      }

      // Reinitialize SDK with new network
      this.sdk = new VeilonSDK({
        network: networkName as any,
        provider: this.provider,
        signer: this.signer,
      });

      console.log(
        `✅ Switched to network: ${networkName} (Chain ID: ${chainId})`
      );
    } catch (error) {
      console.error("❌ Failed to switch network:", error);
      throw error;
    }
  }

  /**
   * Get public balance (ETH balance on Sepolia)
   */
  async getPublicBalance(address: string): Promise<string> {
    try {
      if (!this.provider) {
        throw new Error("Provider not initialized");
      }

      const balance = await this.provider.getBalance(address);
      return ethers.formatEther(balance);
    } catch (error) {
      console.error("❌ Failed to get public balance:", error);
      return "0.00";
    }
  }

  /**
   * Get private balance (shielded balance in privacy pool)
   * Calculates balance from stored commitments
   */
  async getPrivateBalance(address: string): Promise<string> {
    try {
      if (!this.sdk) {
        throw new Error("SDK not initialized");
      }

      // Get balance from React Native commitment store
      const balance = await commitmentStoreRN.getPrivateBalance(address);
      console.log(`💰 Private balance for ${address}: ${balance} ETH`);
      return balance;
    } catch (error) {
      console.error("❌ Failed to get private balance:", error);
      return "0.00";
    }
  }

  /**
   * Get current network info
   */
  async getNetwork(): Promise<{
    name: string;
    chainId: number;
    isTestnet: boolean;
  }> {
    try {
      if (!this.provider) {
        throw new Error("Provider not initialized");
      }

      const network = await this.provider.getNetwork();

      return {
        name: network.name === "sepolia" ? "Sepolia" : network.name,
        chainId: Number(network.chainId),
        isTestnet: network.chainId === 11155111n, // Sepolia chainId
      };
    } catch (error) {
      console.error("❌ Failed to get network:", error);
      return {
        name: "Unknown",
        chainId: 0,
        isTestnet: false,
      };
    }
  }

  /**
   * Shield ETH (deposit native ETH into privacy pool)
   * Step 1: Generate ZK proof via backend
   * Step 2: Submit transaction to blockchain (called after PIN verification)
   */
  async shieldETH(amount: string): Promise<{
    hash: string;
    status: "pending" | "confirmed" | "failed";
    commitment?: string;
    nullifier?: string;
    secret?: string;
    randomness?: string;
  }> {
    try {
      if (!this.sdk || !this.signer) {
        throw new Error("SDK not initialized");
      }

      const address = await this.signer.getAddress();
      console.log(`🛡️ Step 1: Generating shield proof for ${amount} ETH...`);

      // Check balance before shielding
      const balance = await this.provider?.getBalance(address);
      console.log(
        `💰 Current ETH balance: ${ethers.formatEther(balance || 0n)} ETH`
      );

      if (balance === 0n) {
        throw new Error(
          "Insufficient ETH balance for shielding (balance is 0)"
        );
      }

      // Call backend relayer to generate proof
      console.log("🔐 Calling relayer to generate shield proof...");
      console.log(`📡 Relayer URL: ${getRelayerEndpoint("SHIELD")}`);

      // Get current network info
      const network = await this.provider?.getNetwork();
      const chainId = network ? Number(network.chainId) : null;

      const response = await axios.post(
        getRelayerEndpoint("SHIELD"),
        {
          amount,
          recipient: address,
          token: "ETH", // Specify ETH
          chainId,
          network: network?.name || null,
        },
        {
          timeout: RELAYER_CONFIG.TIMEOUT,
          headers: {
            "Content-Type": "application/json",
          },
        }
      );

      if (!response.data.success) {
        throw new Error(
          response.data.error || "Shield proof generation failed"
        );
      }

      console.log("✅ Shield proof generated by relayer!");
      console.log(
        "🔒 Commitment:",
        response.data.commitment?.substring(0, 10) + "..."
      );
      console.log(
        "🔑 Nullifier:",
        response.data.nullifier?.substring(0, 10) + "..."
      );

      // Return proof data - blockchain submission happens after PIN verification
      return {
        hash: "proof_ready", // Special status indicating proof is ready but not submitted
        status: "pending",
        commitment: response.data.commitment,
        nullifier: response.data.nullifier,
        secret: response.data.secret,
        randomness: response.data.randomness,
      };
    } catch (error: any) {
      console.error("❌ Shield proof generation failed:", error);

      // Provide helpful error messages
      if (error.code === "ECONNREFUSED" || error.code === "ENOTFOUND") {
        throw new Error(
          "Cannot connect to relayer service. Make sure the backend is running at " +
            RELAYER_CONFIG.BASE_URL
        );
      }

      console.error("❌ Error details:", {
        message: error.message,
        code: error.code,
        response: error.response?.data,
      });

      throw new Error(
        error.response?.data?.error ||
          error.message ||
          "Failed to generate shield proof"
      );
    }
  }

  /**
   * Shield ERC20 tokens (deposit ERC20 into privacy pool)
   * Step 1: Generate ZK proof via backend
   * Step 2: Submit transaction to blockchain (called after PIN verification)
   */
  async shieldERC20(
    tokenAddress: string,
    tokenSymbol: string,
    amount: string
  ): Promise<{
    hash: string;
    status: "pending" | "confirmed" | "failed";
    commitment?: string;
    nullifier?: string;
    secret?: string;
    randomness?: string;
    needsApproval?: boolean;
    approvalAmount?: string;
  }> {
    try {
      if (!this.sdk || !this.signer) {
        throw new Error("SDK not initialized");
      }

      const address = await this.signer.getAddress();
      console.log(
        `🛡️ Step 1: Generating shield proof for ${amount} ${tokenSymbol}...`
      );

      // Check ERC20 balance
      const ERC20_ABI = [
        "function balanceOf(address owner) view returns (uint256)",
        "function allowance(address owner, address spender) view returns (uint256)",
        "function decimals() view returns (uint8)",
      ];

      const tokenContract = new ethers.Contract(
        tokenAddress,
        ERC20_ABI,
        this.provider
      );
      const decimals = await tokenContract.decimals();
      const balance = await tokenContract.balanceOf(address);
      const amountWei = ethers.parseUnits(amount, decimals);

      console.log(
        `💰 Current ${tokenSymbol} balance: ${ethers.formatUnits(
          balance,
          decimals
        )} ${tokenSymbol}`
      );

      if (balance < amountWei) {
        throw new Error(`Insufficient ${tokenSymbol} balance for shielding`);
      }

      // Check allowance
      const privacyPoolAddress = getContractAddress("sepolia", "privacyPool");
      const allowance = await tokenContract.allowance(
        address,
        privacyPoolAddress
      );

      console.log(
        `🔍 Current allowance: ${ethers.formatUnits(
          allowance,
          decimals
        )} ${tokenSymbol}`
      );

      // If allowance is insufficient, return approval needed flag
      if (allowance < amountWei) {
        console.log("⚠️ Approval required before shielding");
        return {
          hash: "approval_needed",
          status: "pending",
          needsApproval: true,
          approvalAmount: amountWei.toString(),
        };
      }

      // Call backend relayer to generate proof
      console.log("🔐 Calling relayer to generate shield proof...");
      console.log(`📡 Relayer URL: ${getRelayerEndpoint("SHIELD")}`);

      // Get current network info
      const network = await this.provider?.getNetwork();
      const chainId = network ? Number(network.chainId) : null;

      const response = await axios.post(
        getRelayerEndpoint("SHIELD"),
        {
          amount,
          recipient: address,
          token: tokenSymbol,
          tokenAddress,
          chainId,
          network: network?.name || null,
        },
        {
          timeout: RELAYER_CONFIG.TIMEOUT,
          headers: {
            "Content-Type": "application/json",
          },
        }
      );

      if (!response.data.success) {
        throw new Error(
          response.data.error || "Shield proof generation failed"
        );
      }

      console.log("✅ Shield proof generated by relayer!");
      console.log(
        "🔒 Commitment:",
        response.data.commitment?.substring(0, 10) + "..."
      );
      console.log(
        "🔑 Nullifier:",
        response.data.nullifier?.substring(0, 10) + "..."
      );

      // Return proof data - blockchain submission happens after PIN verification
      return {
        hash: "proof_ready",
        status: "pending",
        commitment: response.data.commitment,
        nullifier: response.data.nullifier,
        secret: response.data.secret,
        randomness: response.data.randomness,
        needsApproval: false,
      };
    } catch (error: any) {
      console.error("❌ Shield ERC20 proof generation failed:", error);

      // Provide helpful error messages
      if (error.code === "ECONNREFUSED" || error.code === "ENOTFOUND") {
        throw new Error(
          "Cannot connect to relayer service. Make sure the backend is running at " +
            RELAYER_CONFIG.BASE_URL
        );
      }

      console.error("❌ Error details:", {
        message: error.message,
        code: error.code,
        response: error.response?.data,
      });

      throw new Error(
        error.response?.data?.error ||
          error.message ||
          "Failed to generate shield proof"
      );
    }
  }

  /**
   * Approve ERC20 token for Privacy Pool contract
   */
  async approveERC20(
    tokenAddress: string,
    tokenSymbol: string,
    amount: string
  ): Promise<{
    hash: string;
    status: "pending" | "confirmed" | "failed";
  }> {
    try {
      if (!this.signer) {
        throw new Error("Signer not initialized");
      }

      console.log(`🔓 Approving ${amount} ${tokenSymbol} for Privacy Pool...`);

      const ERC20_ABI = [
        "function approve(address spender, uint256 amount) returns (bool)",
        "function decimals() view returns (uint8)",
      ];

      const tokenContract = new ethers.Contract(
        tokenAddress,
        ERC20_ABI,
        this.signer
      );
      const decimals = await tokenContract.decimals();
      const amountWei = ethers.parseUnits(amount, decimals);

      const privacyPoolAddress = getContractAddress("sepolia", "privacyPool");

      console.log(`📝 Calling approve(${privacyPoolAddress}, ${amountWei})...`);
      const tx = await tokenContract.approve(privacyPoolAddress, amountWei);

      console.log(`✅ Approval transaction submitted: ${tx.hash}`);
      console.log("⏳ Waiting for confirmation...");

      return {
        hash: tx.hash,
        status: "pending",
      };
    } catch (error: any) {
      console.error("❌ ERC20 approval failed:", error);
      throw new Error(error.message || "Failed to approve ERC20 token");
    }
  }

  /**
   * Legacy method for backward compatibility - redirects to shieldETH
   * @deprecated Use shieldETH() or shieldERC20() instead
   */
  async shield(amount: string): Promise<{
    hash: string;
    status: "pending" | "confirmed" | "failed";
    commitment?: string;
    nullifier?: string;
    secret?: string;
    randomness?: string;
  }> {
    console.log(
      "⚠️ Using deprecated shield() method. Use shieldETH() instead."
    );
    return this.shieldETH(amount);
  }

  /**
   * Submit shield transaction to blockchain (ETH)
   * Called after PIN verification
   */
  async submitShieldTransaction(
    commitment: string,
    amount: string,
    tokenAddress?: string,
    tokenSymbol?: string
  ): Promise<{
    hash: string;
    status: "pending" | "confirmed" | "failed";
  }> {
    try {
      if (!this.signer || !this.provider) {
        throw new Error("SDK not initialized");
      }

      console.log("📤 Step 2: Submitting shield transaction to blockchain...");

      // Check gas balance before transaction
      const signerAddress = await this.signer.getAddress();
      const gasBalance = await this.provider.getBalance(signerAddress);
      const minGasRequired = ethers.parseEther("0.001"); // Minimum 0.001 ETH for gas

      console.log(`💰 Gas Balance Check: ${ethers.formatEther(gasBalance)} ETH`);

      if (gasBalance < minGasRequired) {
        throw new Error(
          `Insufficient ETH for gas fees. You need at least ${ethers.formatEther(minGasRequired)} ETH to pay for transaction gas, but you have ${ethers.formatEther(gasBalance)} ETH. Please add some ETH to your wallet first.`
        );
      }

      // Get Privacy Pool contract
      const privacyPoolAddress = getContractAddress("sepolia", "privacyPool");
      const privacyPool = new ethers.Contract(
        privacyPoolAddress,
        PRIVACY_POOL_ABI,
        this.signer
      );

      // Convert commitment string to bytes32
      const commitmentBytes32 = ethers.zeroPadValue(
        ethers.toBeHex(BigInt(commitment)),
        32
      );

      let tx;

      if (tokenAddress && tokenSymbol) {
        // Shield ERC20
        console.log(
          `📝 Calling shieldERC20(${tokenAddress}, ${amount} ${tokenSymbol}, commitment)...`
        );

        const ERC20_ABI = ["function decimals() view returns (uint8)"];
        const tokenContract = new ethers.Contract(
          tokenAddress,
          ERC20_ABI,
          this.provider
        );
        const decimals = await tokenContract.decimals();
        const amountWei = ethers.parseUnits(amount, decimals);

        tx = await privacyPool.shieldERC20(
          tokenAddress,
          amountWei,
          commitmentBytes32
        );
      } else {
        // Shield ETH
        console.log(
          `📝 Calling shieldETH(${commitmentBytes32}) with ${amount} ETH...`
        );
        tx = await privacyPool.shieldETH(commitmentBytes32, {
          value: ethers.parseEther(amount),
        });
      }

      console.log(`✅ Transaction submitted: ${tx.hash}`);
      console.log("⏳ Waiting for confirmation...");

      return {
        hash: tx.hash,
        status: "pending",
      };
    } catch (error: any) {
      console.error("❌ Shield transaction failed:", error);
      throw new Error(error.message || "Failed to submit shield transaction");
    }
  }

  /**
   * Unshield tokens - Step 1: Generate ZK proof
   * Calls backend relayer to generate proof
   */
  async unshield(
    inputCommitment: string,
    secret: string,
    nullifier: string,
    randomness: string,
    recipient: string,
    inputAmount: string,
    outputAmount: string,
    token?: string,
    tokenAddress?: string
  ): Promise<{
    hash: string;
    status: "proof_ready" | "pending" | "confirmed" | "failed";
    proof?: any;
    publicSignals?: string[];
    nullifierHash?: string;
    changeCommitment?: string;
    changeSecret?: string;
    changeNullifier?: string;
    changeRandomness?: string;
    changeAmount?: string;
  }> {
    try {
      if (!this.sdk) {
        throw new Error("SDK not initialized");
      }

      // Auto-calculate change amount (in human-readable format)
      // The backend will handle the proper decimal conversion
      const changeAmount = (parseFloat(inputAmount) - parseFloat(outputAmount)).toString();

      console.log(`🔓 Step 1: Generating unshield proof...`);
      console.log(`  Input Amount: ${inputAmount}`);
      console.log(`  Output Amount: ${outputAmount}`);
      console.log(`  Change Amount: ${changeAmount}`);

      // Generate change commitment secrets (random) - convert to decimal string for circuit
      const changeSecret = BigInt(ethers.hexlify(ethers.randomBytes(31))).toString();
      const changeNullifier = BigInt(ethers.hexlify(ethers.randomBytes(31))).toString();
      const changeRandomness = BigInt(ethers.hexlify(ethers.randomBytes(31))).toString();

      // Call backend relayer to generate proof
      console.log("🔐 Calling relayer to generate unshield proof with change support...");
      console.log(`📡 Relayer URL: ${getRelayerEndpoint("UNSHIELD")}`);

      // Get current network info
      const network = await this.provider?.getNetwork();
      const chainId = network ? Number(network.chainId) : null;

      const response = await axios.post(
        getRelayerEndpoint("UNSHIELD"),
        {
          inputAmount,
          outputAmount,
          changeAmount,
          recipient,
          secret,
          nullifier,
          randomness,
          inputCommitment,
          changeSecret,
          changeNullifier,
          changeRandomness,
          chainId,
          network: network?.name || null,
          token: token || "ETH",
          tokenAddress: tokenAddress || undefined,
        },
        {
          timeout: RELAYER_CONFIG.TIMEOUT,
          headers: {
            "Content-Type": "application/json",
          },
        }
      );

      if (!response.data.success) {
        throw new Error(
          response.data.error || "Unshield proof generation failed"
        );
      }

      console.log("✅ Unshield proof generated by relayer!");
      console.log("📊 Change commitment created:", response.data.changeCommitment?.substring(0, 10) + "...");

      // Return proof data - blockchain submission happens after PIN verification
      return {
        hash: "proof_ready", // Special status indicating proof is ready but not submitted
        status: "proof_ready",
        proof: response.data.proof,
        publicSignals: response.data.publicSignals,
        nullifierHash: response.data.nullifierHash,
        changeCommitment: response.data.changeCommitment,
        changeSecret: response.data.changeSecret,
        changeNullifier: response.data.changeNullifier,
        changeRandomness: response.data.changeRandomness,
        changeAmount: response.data.changeAmount || changeAmount, // Use backend's calculated change amount
      };
    } catch (error: any) {
      console.error("❌ Unshield proof generation failed:", error);

      // Provide helpful error messages
      if (error.code === "ECONNREFUSED" || error.code === "ENOTFOUND") {
        throw new Error(
          "Cannot connect to relayer service. Make sure the backend is running at " +
            RELAYER_CONFIG.BASE_URL
        );
      }

      console.error("❌ Error details:", {
        message: error.message,
        code: error.code,
        response: error.response?.data,
      });

      throw new Error(
        error.response?.data?.error ||
          error.message ||
          "Failed to generate unshield proof"
      );
    }
  }

  /**
   * Submit unshield transaction to blockchain
   * Called after PIN verification
   */
  async submitUnshieldTransaction(
    inputCommitment: string,
    changeCommitment: string,
    nullifierHash: string,
    recipient: string,
    outputAmount: string,
    changeAmount: string,
    token: string,
    proof: any,
    publicSignals: string[]
  ): Promise<{
    hash: string;
    status: "pending" | "confirmed" | "failed";
  }> {
    try {
      if (!this.signer || !this.provider) {
        throw new Error("SDK not initialized");
      }

      console.log(
        "📤 Step 2: Submitting unshield transaction to blockchain..."
      );

      // Check gas balance before transaction
      const signerAddress = await this.signer.getAddress();
      const gasBalance = await this.provider.getBalance(signerAddress);
      const minGasRequired = ethers.parseEther("0.001"); // Minimum 0.001 ETH for gas

      console.log(`💰 Gas Balance Check: ${ethers.formatEther(gasBalance)} ETH`);

      if (gasBalance < minGasRequired) {
        throw new Error(
          `Insufficient ETH for gas fees. You need at least ${ethers.formatEther(minGasRequired)} ETH to pay for transaction gas, but you have ${ethers.formatEther(gasBalance)} ETH. Please add some ETH to your wallet first.`
        );
      }

      // Get Privacy Pool contract
      const privacyPoolAddress = getContractAddress("sepolia", "privacyPool");
      const privacyPool = new ethers.Contract(
        privacyPoolAddress,
        PRIVACY_POOL_ABI,
        this.signer
      );

      // Convert commitments to bytes32
      const inputCommitmentBytes32 = ethers.zeroPadValue(
        ethers.toBeHex(BigInt(inputCommitment)),
        32
      );
      const changeCommitmentBytes32 = parseFloat(changeAmount) > 0
        ? ethers.zeroPadValue(ethers.toBeHex(BigInt(changeCommitment)), 32)
        : ethers.ZeroHash; // bytes32(0) if no change

      // Determine token address
      const tokenAddress = token === "ETH" ? ethers.ZeroAddress : token;

      // Get token decimals for amount conversion
      let decimals = 18; // Default for ETH
      if (token !== "ETH" && token !== ethers.ZeroAddress) {
        try {
          const ERC20_ABI = ["function decimals() view returns (uint8)"];
          const tokenContract = new ethers.Contract(
            token,
            ERC20_ABI,
            this.provider
          );
          decimals = await tokenContract.decimals();
          console.log(`🔍 Token decimals: ${decimals}`);
        } catch (error) {
          console.warn(`⚠️ Failed to query token decimals, using 18 as default`);
        }
      }

      // Convert amounts to token base units
      const outputAmountWei = ethers.parseUnits(outputAmount, decimals);
      const changeAmountWei = ethers.parseUnits(changeAmount, decimals);

      console.log("💰 Amount conversion:");
      console.log(`  Output: ${outputAmount} → ${outputAmountWei.toString()} (${decimals} decimals)`);
      console.log(`  Change: ${changeAmount} → ${changeAmountWei.toString()} (${decimals} decimals)`);

      // Parse proof from backend (snarkjs format)
      // The proof comes as { pi_a, pi_b, pi_c, protocol, curve }
      // publicSignals are passed separately as they come from the backend response (not inside proof object)
      const proofA = proof.pi_a ? proof.pi_a.slice(0, 2) : [0, 0];
      const proofB = proof.pi_b
        ? [
            [proof.pi_b[0][0], proof.pi_b[0][1]], // Fixed: DO NOT reverse - tests show this is correct format
            [proof.pi_b[1][0], proof.pi_b[1][1]],
          ]
        : [
            [0, 0],
            [0, 0],
          ];
      const proofC = proof.pi_c ? proof.pi_c.slice(0, 2) : [0, 0];

      console.log("🔍 Proof components:");
      console.log("  A:", proofA);
      console.log("  B:", proofB);
      console.log("  C:", proofC);
      console.log("  Public Signals:", publicSignals);

      // Create proof struct as expected by contract
      const proofStruct = {
        a: proofA,
        b: proofB,
        c: proofC,
        publicInputs: publicSignals,
      };

      // Send transaction with new signature
      console.log(
        `📝 Calling unshield(inputCommitment, changeCommitment, ${recipient}, ${outputAmount}, ${changeAmount}, ${token})...`
      );
      const tx = await privacyPool.unshield(
        inputCommitmentBytes32,
        changeCommitmentBytes32,
        recipient,
        outputAmountWei,
        changeAmountWei,
        tokenAddress,
        proofStruct
      );

      console.log(`✅ Transaction submitted: ${tx.hash}`);
      console.log("⏳ Waiting for confirmation...");

      return {
        hash: tx.hash,
        status: "pending",
      };
    } catch (error: any) {
      console.error("❌ Unshield transaction failed:", error);
      throw new Error(error.message || "Failed to submit unshield transaction");
    }
  }

  /**
   * Private Transfer - Step 1: Generate proof
   */
  async privateTransfer(
    inputCommitment: string,
    inputSecret: string,
    inputNullifier: string,
    inputRandomness: string,
    inputAmount: string,
    outputAmount: string,
    recipient: string
  ): Promise<{
    hash: string;
    status: "proof_ready" | "pending" | "confirmed" | "failed";
    outputCommitment?: string;
    outputSecret?: string;
    outputNullifier?: string;
    outputRandomness?: string;
    changeCommitment?: string;
    changeSecret?: string;
    changeNullifier?: string;
    changeRandomness?: string;
    changeAmount?: string;
    nullifierHash?: string;
    proof?: any;
  }> {
    try {
      if (!this.sdk || !this.signer) {
        throw new Error("SDK not initialized");
      }

      // Auto-calculate change amount using BigInt to avoid floating point precision errors
      const inputWei = ethers.parseEther(inputAmount);
      const outputWei = ethers.parseEther(outputAmount);
      const changeWei = inputWei - outputWei;
      const changeAmount = ethers.formatEther(changeWei);

      console.log(
        `🔄 Step 1: Generating private transfer proof...`
      );
      console.log(`  Input Amount: ${inputAmount} ETH`);
      console.log(`  Output Amount: ${outputAmount} ETH`);
      console.log(`  Change Amount: ${changeAmount} ETH`);

      // Get current network info
      const network = await this.provider?.getNetwork();
      const chainId = network ? Number(network.chainId) : null;

      // Generate output commitment details (for the recipient) - convert to decimal string for circuit
      const outputSecret = BigInt(ethers.hexlify(ethers.randomBytes(31))).toString();
      const outputNullifier = BigInt(ethers.hexlify(ethers.randomBytes(31))).toString();
      const outputRandomness = BigInt(ethers.hexlify(ethers.randomBytes(31))).toString();

      // Generate change commitment details (for the sender) - convert to decimal string for circuit
      const changeSecret = BigInt(ethers.hexlify(ethers.randomBytes(31))).toString();
      const changeNullifier = BigInt(ethers.hexlify(ethers.randomBytes(31))).toString();
      const changeRandomness = BigInt(ethers.hexlify(ethers.randomBytes(31))).toString();

      // Calculate output commitment
      const response = await axios.post(
        getRelayerEndpoint("TRANSFER"),
        {
          inputCommitment,
          inputAmount,
          outputAmount,
          changeAmount,
          recipient,
          inputSecret,
          inputNullifier,
          inputRandomness,
          outputSecret,
          outputNullifier,
          outputRandomness,
          changeSecret,
          changeNullifier,
          changeRandomness,
          chainId,
          network: network?.name || null,
        },
        {
          timeout: RELAYER_CONFIG.TIMEOUT,
          headers: {
            "Content-Type": "application/json",
          },
        }
      );

      if (!response.data.success) {
        throw new Error(
          response.data.error || "Transfer proof generation failed"
        );
      }

      console.log("✅ Transfer proof generated by relayer!");
      console.log("📊 Public signals count:", response.data.publicSignals?.length);
      console.log("📊 Output commitment:", response.data.outputCommitment?.substring(0, 10) + "...");
      console.log("📊 Change commitment:", response.data.changeCommitment?.substring(0, 10) + "...");

      return {
        hash: "proof_ready",
        status: "proof_ready",
        outputCommitment: response.data.outputCommitment,
        outputSecret: response.data.outputSecret,
        outputNullifier: response.data.outputNullifier,
        outputRandomness: response.data.outputRandomness,
        changeCommitment: response.data.changeCommitment,
        changeSecret: response.data.changeSecret,
        changeNullifier: response.data.changeNullifier,
        changeRandomness: response.data.changeRandomness,
        changeAmount: response.data.changeAmount || changeAmount, // Use backend's calculated change amount
        nullifierHash: response.data.nullifierHash,
        proof: {
          ...response.data.proof,
          publicSignals: response.data.publicSignals // Attach publicSignals to proof object
        },
      };
    } catch (error: any) {
      console.error("❌ Private transfer proof generation failed:", error);
      throw new Error(
        error.response?.data?.error ||
          error.message ||
          "Failed to generate transfer proof"
      );
    }
  }

  /**
   * Private Transfer - Step 2: Submit to blockchain
   */
  async submitPrivateTransfer(
    inputCommitment: string,
    outputCommitment: string,
    changeCommitment: string,
    nullifierHash: string,
    outputAmount: string,
    changeAmount: string,
    proof: any
  ): Promise<{
    hash: string;
    status: "pending" | "confirmed" | "failed";
  }> {
    try {
      if (!this.signer || !this.provider) {
        throw new Error("SDK not initialized");
      }

      console.log("📤 Step 2: Submitting private transfer to blockchain...");

      // Check gas balance before transaction
      const signerAddress = await this.signer.getAddress();
      const gasBalance = await this.provider.getBalance(signerAddress);
      const minGasRequired = ethers.parseEther("0.001"); // Minimum 0.001 ETH for gas

      console.log(`💰 Gas Balance Check: ${ethers.formatEther(gasBalance)} ETH`);

      if (gasBalance < minGasRequired) {
        throw new Error(
          `Insufficient ETH for gas fees. You need at least ${ethers.formatEther(minGasRequired)} ETH to pay for transaction gas, but you have ${ethers.formatEther(gasBalance)} ETH. Please add some ETH to your wallet first.`
        );
      }

      // Get Privacy Pool contract
      const privacyPoolAddress = getContractAddress("sepolia", "privacyPool");
      const privacyPool = new ethers.Contract(
        privacyPoolAddress,
        PRIVACY_POOL_ABI,
        this.signer
      );

      // Convert to bytes32
      const inputCommitmentBytes32 = ethers.zeroPadValue(
        ethers.toBeHex(BigInt(inputCommitment)),
        32
      );
      const outputCommitmentBytes32 = ethers.zeroPadValue(
        ethers.toBeHex(BigInt(outputCommitment)),
        32
      );
      const changeCommitmentBytes32 = parseFloat(changeAmount) > 0
        ? ethers.zeroPadValue(ethers.toBeHex(BigInt(changeCommitment)), 32)
        : ethers.ZeroHash; // bytes32(0) if no change

      // Get token address (ETH = zero address)
      const tokenAddress = ethers.ZeroAddress; // For ETH, change later for ERC20

      // Prepare proof struct
      // Note: snarkjs returns pi_c with 3 elements, but Solidity expects 2
      const proofStruct = {
        a: [proof.pi_a[0], proof.pi_a[1]],
        b: [[proof.pi_b[0][0], proof.pi_b[0][1]], [proof.pi_b[1][0], proof.pi_b[1][1]]],
        c: [proof.pi_c[0], proof.pi_c[1]], // Only take first 2 elements
        publicInputs: proof.publicSignals || []
      };

      console.log('📝 Proof structure:', {
        a: proofStruct.a,
        b: proofStruct.b,
        c: proofStruct.c,
        publicInputsCount: proofStruct.publicInputs.length,
        publicInputs: proofStruct.publicInputs
      });

      console.log('📝 Full proof object from backend:', proof);

      console.log('📝 Submitting with parameters:', {
        inputCommitment: inputCommitmentBytes32,
        outputCommitment: outputCommitmentBytes32,
        changeCommitment: changeCommitmentBytes32,
        outputAmount,
        changeAmount,
        token: tokenAddress
      });

      // Send transaction with new signature
      const tx = await privacyPool.privateTransfer(
        inputCommitmentBytes32,
        outputCommitmentBytes32,
        changeCommitmentBytes32,
        ethers.parseEther(outputAmount),
        ethers.parseEther(changeAmount),
        tokenAddress,
        proofStruct
      );

      console.log(`✅ Transfer transaction submitted: ${tx.hash}`);

      return {
        hash: tx.hash,
        status: "pending",
      };
    } catch (error: any) {
      console.error("❌ Private transfer transaction failed:", error);
      throw new Error(error.message || "Failed to submit private transfer");
    }
  }

  /**
   * Wait for transaction confirmation
   */
  async waitForTransaction(txHash: string): Promise<boolean> {
    try {
      if (!this.provider) {
        throw new Error("Provider not initialized");
      }

      console.log(`⏳ Waiting for transaction ${txHash}...`);

      const receipt = await this.provider.waitForTransaction(txHash, 1);

      if (receipt?.status === 1) {
        console.log("✅ Transaction confirmed");
        return true;
      } else {
        console.log("❌ Transaction failed");
        return false;
      }
    } catch (error) {
      console.error("❌ Error waiting for transaction:", error);
      return false;
    }
  }

  /**
   * Save commitment to local storage after successful shield
   */
  async saveCommitment(
    address: string,
    commitment: string,
    nullifier: string,
    secret: string,
    amount: string,
    txHash: string,
    randomness?: string,
    token?: string,
    tokenAddress?: string
  ): Promise<void> {
    try {
      console.log("💾 Saving commitment to local storage...");

      if (!this.provider) {
        throw new Error("Provider not initialized");
      }

      // Get transaction receipt to get block number and leaf index
      const receipt = await this.provider.getTransactionReceipt(txHash);
      if (!receipt) {
        throw new Error("Transaction receipt not found");
      }

      // For now, use a placeholder leafIndex (in production, parse from contract events)
      const leafIndex = 0; // TODO: Parse from contract event logs

      // Determine token decimals and convert amount properly
      let amountWei: string;
      if (token && token !== "ETH" && tokenAddress) {
        const ERC20_ABI = ["function decimals() view returns (uint8)"];
        const tokenContract = new ethers.Contract(
          tokenAddress,
          ERC20_ABI,
          this.provider
        );
        const decimals = await tokenContract.decimals();
        amountWei = ethers.parseUnits(amount, decimals).toString();
      } else {
        amountWei = ethers.parseEther(amount).toString(); // ETH uses 18 decimals
      }

      console.log("💾 Calling commitmentStoreRN.addCommitment...");
      await commitmentStoreRN.addCommitment(address, {
        commitment,
        nullifier,
        amount: amountWei,
        secret,
        randomness, // Added for unshield proof generation
        token: token || "ETH", // NEW: Track token type
        tokenAddress: tokenAddress || ethers.ZeroAddress, // NEW: Track token address
        leafIndex,
        blockNumber: receipt.blockNumber,
        txHash,
        spent: false,
        timestamp: Date.now(),
      });

      console.log(`✅ Commitment saved successfully for ${token || "ETH"}`);

      // Verify it was saved
      const savedCommitments = await commitmentStoreRN.getCommitments(address);
      console.log(
        "✅ Verification: Total commitments now:",
        savedCommitments.length
      );
    } catch (error) {
      console.error("❌ Failed to save commitment:", error);
      throw error;
    }
  }

  /**
   * Sync commitments with blockchain to update spent status
   * Queries blockchain for Unshield events and marks matching commitments as spent
   */
  async syncCommitments(address: string): Promise<{
    totalCommitments: number;
    markedAsSpent: number;
    stillUnspent: number;
  }> {
    try {
      if (!this.provider) {
        throw new Error("Provider not initialized");
      }

      console.log("🔄 Starting commitment sync for:", address);

      // Get the Privacy Pool contract address based on current network
      const network = await this.provider.getNetwork();
      let privacyPoolAddress: string;

      // Map chain ID to privacy pool address
      switch (Number(network.chainId)) {
        case 11155111: // Sepolia
          privacyPoolAddress = "0x2f2B95f475F9774F52bE449e060fC52727B11dEB"; // PrivacyPoolV2
          break;
        case 1: // Mainnet
          privacyPoolAddress = "0x0000000000000000000000000000000000000000"; // Update when deployed
          break;
        // Add other networks as needed
        default:
          throw new Error(`Unsupported network: ${network.chainId}`);
      }

      console.log(`🔍 Using Privacy Pool address: ${privacyPoolAddress}`);

      // Call the sync method from commitment store
      const result = await commitmentStoreRN.syncCommitmentsWithBlockchain(
        address,
        this.provider,
        privacyPoolAddress
      );

      console.log("✅ Sync completed successfully");
      return result;
    } catch (error: any) {
      console.error("❌ Sync failed:", error);
      throw new Error(error.message || "Failed to sync commitments");
    }
  }

  /**
   * Cleanup and disconnect
   */
  disconnect(): void {
    this.sdk = null;
    this.provider = null;
    this.signer = null;
    console.log("🔌 VeilonSDK disconnected");
  }
}

// Export singleton instance
export const veilonSDK = new VeilonSDKService();
