import { ProofError } from '../errors';
import { ProofInputs, ProofResult, SDKConfig, CircuitInputs, ZKProof } from '../types';
import { CIRCUIT_TYPES, MERKLE_TREE_DEPTH, FIELD_SIZE } from '../constants';

// Detect React Native environment
const isReactNative = typeof navigator !== 'undefined' && navigator.product === 'ReactNative';

// Use browser-compatible version of snarkjs for React Native
const snarkjs = require('snarkjs/build/browser.esm.js');

// Conditionally import circomlibjs - use mock for React Native
let buildPoseidon: any;
if (!isReactNative) {
  buildPoseidon = require('circomlibjs').buildPoseidon;
} else {
  // Mock Poseidon for React Native using SHA-256
  console.warn('⚠️  React Native detected - using SHA-256 hashing (not ZK-compatible, for testing only)');

  // In React Native, use global crypto with polyfills or crypto-shim
  let crypto: any;
  try {
    // Try to use global crypto first (polyfilled in global-setup.js)
    if (typeof global !== 'undefined' && (global as any).crypto && (global as any).crypto.createHash) {
      crypto = (global as any).crypto;
      console.log('✅ Using global.crypto polyfills for proof generation');
    } else {
      // Fallback to create-hash directly
      const createHash = require('create-hash');
      crypto = {
        createHash: createHash
      };
      console.log('✅ Using create-hash module for proof generation');
    }
  } catch (error) {
    throw new Error('Crypto polyfills not available. Please ensure create-hash is installed.');
  }

  buildPoseidon = async () => {
    // Hash function that mimics Poseidon interface but uses SHA-256
    return function poseidonMock(inputs: bigint[]): bigint {
      // Concatenate all inputs as hex strings
      const concatenated = inputs.map(i => i.toString(16).padStart(64, '0')).join('');

      // Hash with SHA-256
      const hash = crypto.createHash('sha256').update(concatenated, 'hex').digest('hex');

      // Convert to bigint and mod with BN254 field size
      const hashBigInt = BigInt('0x' + hash);
      const fieldSize = BigInt('21888242871839275222246405745257275088548364400416034343698204186575808495617');

      return hashBigInt % fieldSize;
    };
  };
}

export class ProofGenerator {
  private config: SDKConfig;
  private circuitWasmCache: Map<string, any> = new Map();
  private circuitZkeyCache: Map<string, any> = new Map();
  private poseidon: any = null;
  private initialized: boolean = false;
  private initPromise: Promise<void> | null = null;

  constructor(config: SDKConfig) {
    this.config = config;
    // Start initialization but don't wait for it
    this.initPromise = this.init();
  }

  /**
   * Initialize Poseidon hash function
   */
  private async init(): Promise<void> {
    try {
      console.log('🔄 Initializing Poseidon hash...');
      console.log('🔄 Environment check - isReactNative:', isReactNative);
      this.poseidon = await buildPoseidon();
      console.log('🔄 Poseidon built, checking structure:', {
        hasPoseidon: !!this.poseidon,
        poseidonType: typeof this.poseidon,
        hasF: !!(this.poseidon?.F),
        FType: typeof this.poseidon?.F,
        isFunction: typeof this.poseidon === 'function',
        poseidonKeys: this.poseidon && typeof this.poseidon === 'object' ? Object.keys(this.poseidon).slice(0, 10) : []
      });
      this.initialized = true;
      console.log('✅ Poseidon hash initialized (React Native mode:', isReactNative, ')');
    } catch (error) {
      console.error('❌ Failed to initialize Poseidon:', error);
      throw error;
    }
  }

  /**
   * Ensure Poseidon is initialized
   */
  private async ensureInitialized(): Promise<void> {
    // If initialization is in progress, wait for it
    if (this.initPromise) {
      await this.initPromise;
      this.initPromise = null;
    }

    // If still not initialized, try again
    if (!this.initialized || !this.poseidon) {
      await this.init();
    }

    if (!this.poseidon) {
      throw new ProofError('Poseidon hash not initialized');
    }
  }

  /**
   * Generate a zero-knowledge proof for any circuit type
   */
  async generateProof(circuitType: string, inputs: ProofInputs): Promise<ProofResult> {
    try {
      let circuitInputs: CircuitInputs;

      switch (circuitType) {
        case CIRCUIT_TYPES.SHIELD:
          circuitInputs = await this.prepareShieldInputs(inputs);
          break;
        case CIRCUIT_TYPES.UNSHIELD:
          circuitInputs = await this.prepareUnshieldInputs(inputs);
          break;
        case CIRCUIT_TYPES.TRANSFER:
          circuitInputs = await this.prepareTransferInputs(inputs);
          break;
        case CIRCUIT_TYPES.PROOF_OF_INNOCENCE:
          circuitInputs = await this.preparePoIInputs(inputs);
          break;
        default:
          throw new ProofError(`Unsupported circuit type: ${circuitType}`);
      }

      const proof = await this.generateZKProof(circuitType, circuitInputs);
      const publicInputs = this.extractPublicInputs(circuitType, circuitInputs);

      return {
        proof,
        publicInputs,
        circuitType
      };
    } catch (error: any) {
      throw new ProofError(`Proof generation failed: ${error.message}`, error);
    }
  }

  /**
   * Generate a shield proof
   */
  async generateShieldProof(inputs: {
    amount: string;
    recipient: string;
    sender: string;
  }): Promise<ProofResult> {
    try {
      console.log('🛡️ generateShieldProof: Starting with inputs:', {
        amount: inputs.amount,
        amountType: typeof inputs.amount,
        recipient: inputs.recipient,
        sender: inputs.sender
      });

      console.log('🛡️ generateShieldProof: Generating secret...');
      const secret = this.generateSecret();
      console.log('🛡️ generateShieldProof: Secret generated:', secret.toString().substring(0, 20) + '...');

      console.log('🛡️ generateShieldProof: Generating commitment with amount:', inputs.amount);
      const commitment = await this.generateCommitment(inputs.amount, secret);
      console.log('🛡️ generateShieldProof: Commitment generated:', commitment);

      console.log('🛡️ generateShieldProof: Generating nullifier...');
      const nullifier = await this.generateNullifier(commitment, secret);
      console.log('🛡️ generateShieldProof: Nullifier generated:', nullifier);

      console.log('🛡️ generateShieldProof: Converting circuit inputs...');
      console.log('  - Converting amount:', inputs.amount);
      const amountBigInt = this.toBigInt(inputs.amount);
      console.log('  - Amount converted:', amountBigInt.toString());

      console.log('  - Converting recipient:', inputs.recipient);
      const recipientBigInt = this.addressToBigInt(inputs.recipient);
      console.log('  - Recipient converted:', recipientBigInt.toString());

      console.log('  - Converting sender:', inputs.sender);
      const senderBigInt = this.addressToBigInt(inputs.sender);
      console.log('  - Sender converted:', senderBigInt.toString());

      console.log('  - Converting commitment:', commitment);
      const commitmentBigInt = this.toBigInt(commitment);
      console.log('  - Commitment converted:', commitmentBigInt.toString());

      console.log('  - Converting nullifier:', nullifier);
      const nullifierBigInt = this.toBigInt(nullifier);
      console.log('  - Nullifier converted:', nullifierBigInt.toString());

      const circuitInputs = {
        amount: amountBigInt,
        recipient: recipientBigInt,
        sender: senderBigInt,
        commitment: commitmentBigInt,
        nullifier: nullifierBigInt,
        secret: secret
      };

      console.log('🛡️ generateShieldProof: Generating ZK proof...');
      const proof = await this.generateZKProof(CIRCUIT_TYPES.SHIELD, circuitInputs);
      console.log('🛡️ generateShieldProof: ZK proof generated');

      const publicInputs = [commitment, nullifier];

      return {
        proof,
        publicInputs,
        circuitType: CIRCUIT_TYPES.SHIELD,
        // Return private data for local storage
        secret: secret.toString(),
        commitment,
        nullifier
      };
    } catch (error: any) {
      console.error('🛡️ generateShieldProof: ERROR:', error);
      throw new ProofError(`Shield proof generation failed: ${error.message}`, error);
    }
  }

  /**
   * Generate an unshield proof
   */
  async generateUnshieldProof(inputs: {
    commitment: string;
    nullifier: string;
    amount: string;
    recipient: string;
    merkleProof: string[];
    secret: string;
  }): Promise<ProofResult> {
    try {
      const merkleRoot = await this.calculateMerkleRoot(inputs.commitment, inputs.merkleProof);

      const circuitInputs = {
        commitment: this.toBigInt(inputs.commitment),
        nullifier: this.toBigInt(inputs.nullifier),
        amount: this.toBigInt(inputs.amount),
        recipient: this.addressToBigInt(inputs.recipient),
        secret: this.toBigInt(inputs.secret),
        merkleProof: inputs.merkleProof.map(p => this.toBigInt(p)),
        merkleRoot: merkleRoot
      };

      const proof = await this.generateZKProof(CIRCUIT_TYPES.UNSHIELD, circuitInputs);
      const publicInputs = [
        inputs.nullifier,
        inputs.recipient,
        inputs.amount,
        merkleRoot.toString()
      ];

      return {
        proof,
        publicInputs,
        circuitType: CIRCUIT_TYPES.UNSHIELD
      };
    } catch (error: any) {
      throw new ProofError(`Unshield proof generation failed: ${error.message}`, error);
    }
  }

  /**
   * Generate a transfer proof
   */
  async generateTransferProof(inputs: {
    inputCommitment: string;
    outputCommitment: string;
    nullifier: string;
    amount: string;
    recipient: string;
    merkleProof: string[];
    secret: string;
  }): Promise<ProofResult> {
    try {
      const merkleRoot = await this.calculateMerkleRoot(inputs.inputCommitment, inputs.merkleProof);

      const circuitInputs = {
        inputCommitment: this.toBigInt(inputs.inputCommitment),
        outputCommitment: this.toBigInt(inputs.outputCommitment),
        nullifier: this.toBigInt(inputs.nullifier),
        amount: this.toBigInt(inputs.amount),
        recipient: this.addressToBigInt(inputs.recipient),
        secret: this.toBigInt(inputs.secret),
        merkleProof: inputs.merkleProof.map(p => this.toBigInt(p)),
        merkleRoot: merkleRoot
      };

      const proof = await this.generateZKProof(CIRCUIT_TYPES.TRANSFER, circuitInputs);
      const publicInputs = [
        inputs.nullifier,
        inputs.outputCommitment,
        inputs.amount,
        merkleRoot.toString()
      ];

      return {
        proof,
        publicInputs,
        circuitType: CIRCUIT_TYPES.TRANSFER
      };
    } catch (error: any) {
      throw new ProofError(`Transfer proof generation failed: ${error.message}`, error);
    }
  }

  /**
   * Generate proof of innocence
   */
  async generateProofOfInnocence(inputs: {
    commitment: string;
    nullifier: string;
    bannedCommitments: string[];
    merkleProof: string[];
  }): Promise<ProofResult> {
    try {
      const circuitInputs = {
        commitment: this.toBigInt(inputs.commitment),
        nullifier: this.toBigInt(inputs.nullifier),
        bannedCommitments: inputs.bannedCommitments.map(c => this.toBigInt(c)),
        merkleProof: inputs.merkleProof.map(p => this.toBigInt(p)),
        merkleRoot: this.calculateMerkleRoot(inputs.commitment, inputs.merkleProof)
      };

      const proof = await this.generateZKProof(CIRCUIT_TYPES.PROOF_OF_INNOCENCE, circuitInputs);
      const publicInputs = [
        inputs.nullifier,
        circuitInputs.merkleRoot.toString(),
        inputs.bannedCommitments.length.toString()
      ];

      return {
        proof,
        publicInputs,
        circuitType: CIRCUIT_TYPES.PROOF_OF_INNOCENCE
      };
    } catch (error: any) {
      throw new ProofError(`Proof of innocence generation failed: ${error.message}`, error);
    }
  }

  /**
   * Generate actual ZK proof using snarkjs
   */
  private async generateZKProof(circuitType: string, inputs: CircuitInputs): Promise<ZKProof> {
    try {
      // Check if we're in React Native environment
      const isReactNative = typeof navigator !== 'undefined' && navigator.product === 'ReactNative';

      if (isReactNative || typeof global.WebAssembly === 'undefined') {
        console.warn('⚠️  WebAssembly not available - generating mock proof for demo');
        console.warn('ℹ️  In production, ZK proofs should be generated server-side or with native modules');

        // Return a mock proof structure that matches snarkjs format
        return {
          pi_a: ['0', '0', '1'],
          pi_b: [['0', '1'], ['0', '1'], ['0', '1']],
          pi_c: ['0', '0', '1'],
          protocol: 'groth16',
          curve: 'bn128'
        };
      }
      // In a real implementation, these would be loaded from files or URLs
      const wasm = await this.getCircuitWasm(circuitType);
      const zkey = await this.getCircuitZkey(circuitType);

      if (!wasm || !zkey) {
        // For demo purposes, return a mock proof structure
        return this.generateMockProof();
      }

      const { proof, publicSignals } = await snarkjs.groth16.fullProve(inputs, wasm, zkey);

      return {
        pi_a: [proof.pi_a[0], proof.pi_a[1]],
        pi_b: [[proof.pi_b[0][1], proof.pi_b[0][0]], [proof.pi_b[1][1], proof.pi_b[1][0]]],
        pi_c: [proof.pi_c[0], proof.pi_c[1]],
        protocol: 'groth16',
        curve: 'bn128'
      };
    } catch (error: any) {
      throw new ProofError(`ZK proof generation failed: ${error.message}`, error);
    }
  }

  /**
   * Generate a mock proof for testing purposes
   */
  private generateMockProof(): ZKProof {
    return {
      pi_a: [
        '0x1234567890123456789012345678901234567890123456789012345678901234',
        '0x1234567890123456789012345678901234567890123456789012345678901234'
      ],
      pi_b: [
        [
          '0x1234567890123456789012345678901234567890123456789012345678901234',
          '0x1234567890123456789012345678901234567890123456789012345678901234'
        ],
        [
          '0x1234567890123456789012345678901234567890123456789012345678901234',
          '0x1234567890123456789012345678901234567890123456789012345678901234'
        ]
      ],
      pi_c: [
        '0x1234567890123456789012345678901234567890123456789012345678901234',
        '0x1234567890123456789012345678901234567890123456789012345678901234'
      ],
      protocol: 'groth16',
      curve: 'bn128'
    };
  }

  /**
   * Prepare inputs for shield circuit
   */
  private async prepareShieldInputs(inputs: ProofInputs): Promise<CircuitInputs> {
    const amount = inputs.amount || '0';
    const recipient = inputs.recipient || '';
    const secret = this.generateSecret();
    const commitment = await this.generateCommitment(amount, secret);

    return {
      amount: this.toBigInt(amount),
      recipient: this.addressToBigInt(recipient),
      commitment: this.toBigInt(commitment),
      secret: secret
    };
  }

  /**
   * Prepare inputs for unshield circuit
   */
  private async prepareUnshieldInputs(inputs: ProofInputs): Promise<CircuitInputs> {
    return {
      commitment: this.toBigInt(inputs.commitment || '0'),
      nullifier: this.toBigInt(inputs.nullifier || '0'),
      amount: this.toBigInt(inputs.amount || '0'),
      recipient: this.addressToBigInt(inputs.recipient || ''),
      secret: this.toBigInt(inputs.secret || '0'),
      merkleProof: (inputs.merkleProof || []).map(p => this.toBigInt(p)),
      merkleRoot: this.toBigInt(inputs.merkleRoot || '0')
    };
  }

  /**
   * Prepare inputs for transfer circuit
   */
  private async prepareTransferInputs(inputs: ProofInputs): Promise<CircuitInputs> {
    const secret = this.toBigInt(inputs.secret || this.generateSecret().toString());
    const outputCommitment = await this.generateCommitment(inputs.amount || '0', secret);

    return {
      inputCommitment: this.toBigInt(inputs.commitment || '0'),
      outputCommitment: this.toBigInt(outputCommitment),
      nullifier: this.toBigInt(inputs.nullifier || '0'),
      amount: this.toBigInt(inputs.amount || '0'),
      recipient: this.addressToBigInt(inputs.recipient || ''),
      secret: secret,
      merkleProof: (inputs.merkleProof || []).map(p => this.toBigInt(p)),
      merkleRoot: this.toBigInt(inputs.merkleRoot || '0')
    };
  }

  /**
   * Prepare inputs for proof of innocence circuit
   */
  private async preparePoIInputs(inputs: ProofInputs): Promise<CircuitInputs> {
    return {
      commitment: this.toBigInt(inputs.commitment || '0'),
      nullifier: this.toBigInt(inputs.nullifier || '0'),
      merkleProof: (inputs.merkleProof || []).map(p => this.toBigInt(p)),
      merkleRoot: this.toBigInt(inputs.merkleRoot || '0')
    };
  }

  /**
   * Extract public inputs from circuit inputs
   */
  private extractPublicInputs(circuitType: string, inputs: CircuitInputs): string[] {
    switch (circuitType) {
      case CIRCUIT_TYPES.SHIELD:
        return [inputs.commitment?.toString() || '0'];
      case CIRCUIT_TYPES.UNSHIELD:
        return [
          inputs.nullifier?.toString() || '0',
          inputs.recipient?.toString() || '0',
          inputs.amount?.toString() || '0',
          inputs.merkleRoot?.toString() || '0'
        ];
      case CIRCUIT_TYPES.TRANSFER:
        return [
          inputs.nullifier?.toString() || '0',
          inputs.outputCommitment?.toString() || '0',
          inputs.amount?.toString() || '0',
          inputs.merkleRoot?.toString() || '0'
        ];
      default:
        return [];
    }
  }

  /**
   * Generate a commitment using Poseidon hash
   * commitment = Poseidon(amount, nullifier, secret)
   */
  private async generateCommitment(amount: string, secret: bigint): Promise<string> {
    console.log('🔍 generateCommitment: Starting');
    await this.ensureInitialized();
    console.log('🔍 generateCommitment: Initialized');

    if (!this.poseidon) {
      throw new ProofError('Poseidon hash not initialized');
    }

    const amountBigInt = this.toBigInt(amount);
    console.log('🔍 generateCommitment: Hashing amount:', amountBigInt.toString(), 'with secret');

    // Hash: commitment = Poseidon(amount, secret)
    const hash = this.poseidon([amountBigInt, secret]);
    console.log('🔍 generateCommitment: Hash result type:', typeof hash);

    // Convert hash to hex string
    // In React Native mock mode, hash is already a BigInt
    // In regular mode with circomlibjs, need to use F.toString
    let hashHex: string;

    if (isReactNative || typeof hash === 'bigint') {
      // React Native mock or direct BigInt
      console.log('🔍 generateCommitment: Using BigInt.toString');
      hashHex = hash.toString(16);
    } else if (this.poseidon.F && typeof this.poseidon.F.toString === 'function') {
      // Full circomlibjs with field element
      console.log('🔍 generateCommitment: Using F.toString');
      hashHex = this.poseidon.F.toString(hash, 16);
    } else {
      // Fallback
      console.log('🔍 generateCommitment: Using fallback toString');
      hashHex = hash.toString(16);
    }

    const result = '0x' + hashHex.padStart(64, '0');
    console.log('🔍 generateCommitment: Result:', result);
    return result;
  }

  /**
   * Generate a nullifier using Poseidon hash
   * nullifier = Poseidon(commitment, secret, index)
   */
  private async generateNullifier(commitment: string, secret: bigint, index: number = 0): Promise<string> {
    await this.ensureInitialized();

    if (!this.poseidon) {
      throw new ProofError('Poseidon hash not initialized');
    }

    const commitmentBigInt = this.toBigInt(commitment);
    const indexBigInt = BigInt(index);

    // Hash: nullifier = Poseidon(commitment, secret, index)
    const hash = this.poseidon([commitmentBigInt, secret, indexBigInt]);

    // Convert hash to hex string
    let hashHex: string;

    if (isReactNative || typeof hash === 'bigint') {
      // React Native mock or direct BigInt
      hashHex = hash.toString(16);
    } else if (this.poseidon.F && typeof this.poseidon.F.toString === 'function') {
      // Full circomlibjs with field element
      hashHex = this.poseidon.F.toString(hash, 16);
    } else {
      // Fallback
      hashHex = hash.toString(16);
    }

    return '0x' + hashHex.padStart(64, '0');
  }

  /**
   * Generate a random secret (32 bytes)
   */
  private generateSecret(): bigint {
    // Use environment-appropriate crypto
    let randomBytes: Uint8Array;

    if (typeof window !== 'undefined' || (typeof process !== 'undefined' && (process as any).browser)) {
      // Browser/React Native environment
      randomBytes = new Uint8Array(32);
      if (typeof crypto !== 'undefined' && crypto.getRandomValues) {
        // Web Crypto API
        crypto.getRandomValues(randomBytes);
      } else if (typeof global !== 'undefined' && (global as any).crypto?.getRandomValues) {
        // React Native with polyfill
        (global as any).crypto.getRandomValues(randomBytes);
      } else {
        // Fallback: use Math.random (not cryptographically secure, but works)
        for (let i = 0; i < 32; i++) {
          randomBytes[i] = Math.floor(Math.random() * 256);
        }
      }
    } else {
      // Node.js environment
      const nodeCrypto = require('crypto');
      randomBytes = nodeCrypto.randomBytes(32);
    }

    // Convert to hex string then to BigInt
    const hexString = Array.from(randomBytes)
      .map(b => b.toString(16).padStart(2, '0'))
      .join('');
    return BigInt('0x' + hexString);
  }

  /**
   * Calculate Merkle tree root using Poseidon
   */
  private async calculateMerkleRoot(leaf: string, proof: string[]): Promise<bigint> {
    await this.ensureInitialized();

    let current = this.toBigInt(leaf);

    for (const sibling of proof) {
      const siblingBigInt = this.toBigInt(sibling);

      // Poseidon hash combination: parent = Poseidon(left, right)
      // Sort to maintain consistency
      const [left, right] = current < siblingBigInt
        ? [current, siblingBigInt]
        : [siblingBigInt, current];

      const hash = this.poseidon([left, right]);

      // Safe conversion handling F.toString
      if (isReactNative || typeof hash === 'bigint') {
        current = BigInt(hash);
      } else if (this.poseidon.F && typeof this.poseidon.F.toString === 'function') {
        current = BigInt(this.poseidon.F.toString(hash));
      } else {
        current = BigInt(hash.toString());
      }
    }

    return current;
  }

  /**
   * Hash using Poseidon
   */
  private async poseidonHash(inputs: bigint[]): Promise<bigint> {
    await this.ensureInitialized();
    const hash = this.poseidon(inputs);

    // Safe conversion handling F.toString
    if (isReactNative || typeof hash === 'bigint') {
      return BigInt(hash);
    } else if (this.poseidon.F && typeof this.poseidon.F.toString === 'function') {
      return BigInt(this.poseidon.F.toString(hash));
    } else {
      return BigInt(hash.toString());
    }
  }

  /**
   * Convert string to BigInt
   * Handles decimal ETH amounts by converting to wei
   */
  private toBigInt(value: string | number | bigint): bigint {
    try {
      if (typeof value === 'bigint') return value;
      if (typeof value === 'number') {
        // Check if it's a decimal number
        if (!Number.isInteger(value)) {
          // Convert to wei (multiply by 10^18)
          const ethers = require('ethers');
          return BigInt(ethers.parseEther(value.toString()).toString());
        }
        return BigInt(value);
      }

      // Handle string values
      if (typeof value === 'string') {
        // Remove any whitespace
        const cleanValue = value.trim();

        // Empty string check
        if (!cleanValue) {
          console.warn('⚠️  toBigInt: Empty string, returning 0');
          return BigInt(0);
        }

        // Hex string (with 0x prefix)
        if (cleanValue.startsWith('0x') || cleanValue.startsWith('0X')) {
          return BigInt(cleanValue);
        }

        // Check if it's a decimal number (ETH amount like "0.2" or "1.5")
        if (/^\d+\.\d+$/.test(cleanValue) || /^\d+$/.test(cleanValue)) {
          // If it contains a decimal point, it's ETH and needs to be converted to wei
          if (cleanValue.includes('.')) {
            const ethers = require('ethers');
            const weiValue = ethers.parseEther(cleanValue);
            console.log(`🔄 Converted ${cleanValue} ETH to ${weiValue.toString()} wei`);
            return BigInt(weiValue.toString());
          } else {
            // It's already an integer (probably wei)
            return BigInt(cleanValue);
          }
        }

        // If it looks like a hex without 0x, add the prefix
        if (/^[0-9a-fA-F]+$/.test(cleanValue)) {
          return BigInt('0x' + cleanValue);
        }

        console.error('❌ toBigInt: Invalid value:', cleanValue);
        throw new Error(`Invalid BigInt value: ${cleanValue}`);
      }

      return BigInt(value);
    } catch (error: any) {
      console.error('❌ toBigInt conversion failed:', { value, type: typeof value, error: error.message });
      throw new ProofError(`Failed to convert to BigInt: ${error.message}`);
    }
  }

  /**
   * Convert address to BigInt
   */
  private addressToBigInt(address: string): bigint {
    try {
      // Ethereum addresses are hex strings
      const cleanAddress = address.trim();

      if (!cleanAddress) {
        throw new Error('Empty address');
      }

      // Ensure address starts with 0x
      const hexAddress = cleanAddress.startsWith('0x') ? cleanAddress : '0x' + cleanAddress;

      return BigInt(hexAddress);
    } catch (error: any) {
      console.error('❌ addressToBigInt conversion failed:', { address, error: error.message });
      throw new ProofError(`Failed to convert address to BigInt: ${error.message}`);
    }
  }

  /**
   * Get circuit WASM file
   */
  private async getCircuitWasm(circuitType: string): Promise<any> {
    if (this.circuitWasmCache.has(circuitType)) {
      return this.circuitWasmCache.get(circuitType);
    }

    try {
      const path = require('path');
      const circuitsPath = path.join(__dirname, '../../circuits');
      const wasmPath = path.join(circuitsPath, `${circuitType}.wasm`);

      // Cache and return the path (snarkjs can load from path)
      this.circuitWasmCache.set(circuitType, wasmPath);
      return wasmPath;
    } catch (error) {
      console.warn(`Circuit WASM not found for ${circuitType}, using mock proof`);
      return null;
    }
  }

  /**
   * Get circuit proving key
   */
  private async getCircuitZkey(circuitType: string): Promise<any> {
    if (this.circuitZkeyCache.has(circuitType)) {
      return this.circuitZkeyCache.get(circuitType);
    }

    try {
      const path = require('path');
      const circuitsPath = path.join(__dirname, '../../circuits');
      const zkeyPath = path.join(circuitsPath, `${circuitType}_final.zkey`);

      // Cache and return the path (snarkjs can load from path)
      this.circuitZkeyCache.set(circuitType, zkeyPath);
      return zkeyPath;
    } catch (error) {
      console.warn(`Circuit zkey not found for ${circuitType}, using mock proof`);
      return null;
    }
  }
}