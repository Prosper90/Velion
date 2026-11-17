// SPDX-License-Identifier: MIT
pragma solidity ^0.8.19;

import "@openzeppelin/contracts/access/Ownable.sol";
import "@openzeppelin/contracts/security/ReentrancyGuard.sol";
import "./ShieldVerifier.sol";
import "./UnshieldVerifier.sol";  // Real Groth16 verifier (6 inputs)
import "./TransferVerifier.sol";  // Real Groth16 verifier (7 inputs)

/**
 * @title Verifier
 * @dev Contract for verifying zero-knowledge proofs using real Groth16 verifiers
 */
contract Verifier is Ownable, ReentrancyGuard {
    // Events
    event ProofVerified(bytes32 indexed proofHash, bool isValid);
    event CircuitRegistered(string circuitType, bytes32 circuitHash);
    event CircuitDeregistered(string circuitType);

    // Structs
    struct Proof {
        uint256[2] a;
        uint256[2][2] b;
        uint256[2] c;
        uint256[] publicInputs;
    }

    struct Circuit {
        bytes32 hash;
        bool isActive;
        uint256 maxInputs;
        uint256 maxOutputs;
    }

    // State variables
    mapping(bytes32 => bool) public verifiedProofs;
    mapping(string => Circuit) public circuits;
    mapping(bytes32 => bool) public invalidProofs;

    uint256 public totalProofsVerified;
    uint256 public totalValidProofs;
    uint256 public totalInvalidProofs;

    // Real verifier contracts
    ShieldGroth16Verifier public shieldVerifier;
    UnshieldGroth16Verifier public unshieldVerifier;
    TransferGroth16Verifier public transferVerifier;

    // Modifiers
    modifier onlyActiveCircuit(string memory circuitType) {
        require(circuits[circuitType].isActive, "Verifier: Circuit not active");
        _;
    }

    // Constructor
    constructor(
        address _shieldVerifier,
        address _unshieldVerifier,
        address _transferVerifier
    ) {
        require(_shieldVerifier != address(0), "Invalid shield verifier");
        require(_unshieldVerifier != address(0), "Invalid unshield verifier");
        require(_transferVerifier != address(0), "Invalid transfer verifier");

        shieldVerifier = ShieldGroth16Verifier(_shieldVerifier);
        unshieldVerifier = UnshieldGroth16Verifier(_unshieldVerifier);
        transferVerifier = TransferGroth16Verifier(_transferVerifier);

        // Initialize circuits
        _registerCircuit("shield", 5, 1);  // Shield has 5 public signals
        _registerCircuit("unshield", 9, 2);  // Unshield has 9 public signals (3 inputs + 6 outputs)
        _registerCircuit("transfer", 10, 3);  // Transfer has 10 public signals (3 inputs + 7 outputs)
    }

    /**
     * @dev Verify a zero-knowledge proof
     * @param circuitType The type of circuit (shield, unshield, transfer)
     * @param proof The proof data
     * @param publicInputs The public inputs for the proof
     */
    function verifyProof(
        string memory circuitType,
        Proof memory proof,
        uint256[] memory publicInputs
    ) external onlyActiveCircuit(circuitType) nonReentrant returns (bool) {
        bytes32 proofHash = keccak256(abi.encodePacked(
            circuitType,
            proof.a[0], proof.a[1],
            proof.b[0][0], proof.b[0][1], proof.b[1][0], proof.b[1][1],
            proof.c[0], proof.c[1],
            publicInputs
        ));

        // Check if proof was already verified
        if (verifiedProofs[proofHash]) {
            emit ProofVerified(proofHash, true);
            return true;
        }

        // Check if proof was already marked as invalid
        if (invalidProofs[proofHash]) {
            emit ProofVerified(proofHash, false);
            return false;
        }

        // Verify the proof based on circuit type
        bool isValid = _verifyProofByType(circuitType, proof, publicInputs);

        if (isValid) {
            verifiedProofs[proofHash] = true;
            totalValidProofs++;
        } else {
            invalidProofs[proofHash] = true;
            totalInvalidProofs++;
        }

        totalProofsVerified++;
        emit ProofVerified(proofHash, isValid);

        return isValid;
    }

    /**
     * @dev Verify shield proof
     * @param proof The proof data
     * @param publicInputs The public inputs
     */
    function verifyShieldProof(
        Proof memory proof,
        uint256[] memory publicInputs
    ) external returns (bool) {
        return this.verifyProof("shield", proof, publicInputs);
    }

    /**
     * @dev Verify unshield proof
     * @param proof The proof data
     * @param publicInputs The public inputs
     */
    function verifyUnshieldProof(
        Proof memory proof,
        uint256[] memory publicInputs
    ) external returns (bool) {
        return this.verifyProof("unshield", proof, publicInputs);
    }

    /**
     * @dev Verify transfer proof
     * @param proof The proof data
     * @param publicInputs The public inputs
     */
    function verifyTransferProof(
        Proof memory proof,
        uint256[] memory publicInputs
    ) external returns (bool) {
        return this.verifyProof("transfer", proof, publicInputs);
    }

    /**
     * @dev Register a new circuit
     * @param circuitType The type of circuit
     * @param maxInputs Maximum number of inputs
     * @param maxOutputs Maximum number of outputs
     */
    function registerCircuit(
        string memory circuitType,
        uint256 maxInputs,
        uint256 maxOutputs
    ) external onlyOwner {
        _registerCircuit(circuitType, maxInputs, maxOutputs);
    }

    /**
     * @dev Deregister a circuit
     * @param circuitType The type of circuit to deregister
     */
    function deregisterCircuit(string memory circuitType) external onlyOwner {
        require(circuits[circuitType].isActive, "Verifier: Circuit not registered");

        circuits[circuitType].isActive = false;

        emit CircuitDeregistered(circuitType);
    }

    /**
     * @dev Update circuit parameters
     * @param circuitType The type of circuit
     * @param maxInputs New maximum number of inputs
     * @param maxOutputs New maximum number of outputs
     */
    function updateCircuit(
        string memory circuitType,
        uint256 maxInputs,
        uint256 maxOutputs
    ) external onlyOwner {
        require(circuits[circuitType].isActive, "Verifier: Circuit not registered");

        circuits[circuitType].maxInputs = maxInputs;
        circuits[circuitType].maxOutputs = maxOutputs;
    }

    /**
     * @dev Get circuit information
     * @param circuitType The type of circuit
     */
    function getCircuit(string memory circuitType) external view returns (Circuit memory) {
        return circuits[circuitType];
    }

    /**
     * @dev Get verification statistics
     */
    function getStats() external view returns (
        uint256 totalVerified,
        uint256 totalValid,
        uint256 totalInvalid
    ) {
        return (totalProofsVerified, totalValidProofs, totalInvalidProofs);
    }

    /**
     * @dev Check if a proof hash has been verified
     * @param proofHash The proof hash to check
     */
    function isProofVerified(bytes32 proofHash) external view returns (bool) {
        return verifiedProofs[proofHash];
    }

    /**
     * @dev Check if a proof hash has been marked as invalid
     * @param proofHash The proof hash to check
     */
    function isProofInvalid(bytes32 proofHash) external view returns (bool) {
        return invalidProofs[proofHash];
    }

    /**
     * @dev Internal function to register a circuit
     */
    function _registerCircuit(
        string memory circuitType,
        uint256 maxInputs,
        uint256 maxOutputs
    ) internal {
        bytes32 circuitHash = keccak256(abi.encodePacked(circuitType));

        circuits[circuitType] = Circuit({
            hash: circuitHash,
            isActive: true,
            maxInputs: maxInputs,
            maxOutputs: maxOutputs
        });

        emit CircuitRegistered(circuitType, circuitHash);
    }

    /**
     * @dev Internal function to verify proof by circuit type using REAL Groth16 verifiers
     * @param circuitType The type of circuit
     * @param proof The proof data
     * @param publicInputs The public inputs
     */
    function _verifyProofByType(
        string memory circuitType,
        Proof memory proof,
        uint256[] memory publicInputs
    ) internal view returns (bool) {
        // Validate input parameters
        if (!_validateProofInputs(circuitType, proof, publicInputs)) {
            return false;
        }

        // Convert proof format to what Groth16 verifiers expect
        // Note: Groth16 verifiers expect pi_b elements to be reversed
        uint[2] memory pA = [proof.a[0], proof.a[1]];
        uint[2][2] memory pB = [
            [proof.b[0][1], proof.b[0][0]],  // Reversed
            [proof.b[1][1], proof.b[1][0]]   // Reversed
        ];
        uint[2] memory pC = [proof.c[0], proof.c[1]];

        // Call the appropriate real verifier
        if (keccak256(abi.encodePacked(circuitType)) == keccak256(abi.encodePacked("shield"))) {
            require(publicInputs.length == 5, "Shield requires 5 public inputs");
            uint[5] memory pubSignals;
            for (uint i = 0; i < 5; i++) {
                pubSignals[i] = publicInputs[i];
            }
            return shieldVerifier.verifyProof(pA, pB, pC, pubSignals);

        } else if (keccak256(abi.encodePacked(circuitType)) == keccak256(abi.encodePacked("unshield"))) {
            require(publicInputs.length == 9, "Unshield requires 9 public signals");
            uint[9] memory pubSignals;
            for (uint i = 0; i < 9; i++) {
                pubSignals[i] = publicInputs[i];
            }
            return unshieldVerifier.verifyProof(pA, pB, pC, pubSignals);

        } else if (keccak256(abi.encodePacked(circuitType)) == keccak256(abi.encodePacked("transfer"))) {
            require(publicInputs.length == 10, "Transfer requires 10 public signals");
            uint[10] memory pubSignals;
            for (uint i = 0; i < 10; i++) {
                pubSignals[i] = publicInputs[i];
            }
            return transferVerifier.verifyProof(pA, pB, pC, pubSignals);
        }

        return false;
    }

    /**
     * @dev Validate proof inputs
     */
    function _validateProofInputs(
        string memory circuitType,
        Proof memory proof,
        uint256[] memory publicInputs
    ) internal view returns (bool) {
        Circuit memory circuit = circuits[circuitType];

        // Check if circuit is active
        if (!circuit.isActive) {
            return false;
        }

        // Check public inputs count
        if (publicInputs.length > circuit.maxInputs) {
            return false;
        }

        // Basic validation of proof components
        if (proof.a.length != 2 || proof.b.length != 2 || proof.c.length != 2) {
            return false;
        }

        return true;
    }
}
