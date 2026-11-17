// SPDX-License-Identifier: MIT
pragma solidity ^0.8.19;

import "@openzeppelin/contracts/access/Ownable.sol";
import "@openzeppelin/contracts/security/ReentrancyGuard.sol";
import "@openzeppelin/contracts/security/Pausable.sol";
import "@openzeppelin/contracts/token/ERC20/IERC20.sol";
import "@openzeppelin/contracts/token/ERC20/utils/SafeERC20.sol";
import "@openzeppelin/contracts/utils/Counters.sol";
import "./Verifier.sol";

/**
 * @title PrivacyPoolV2
 * @dev Privacy pool supporting both ETH and ERC20 tokens (USDC, USDT, DAI, etc.)
 */
contract PrivacyPoolV2 is Ownable, ReentrancyGuard, Pausable {
    using Counters for Counters.Counter;
    using SafeERC20 for IERC20;

    // Events
    event Shield(
        address indexed from,
        address indexed token,
        uint256 amount,
        bytes32 commitment
    );
    event Unshield(
        address indexed to,
        address indexed token,
        uint256 amount,
        bytes32 nullifier
    );
    event Transfer(
        bytes32 indexed commitment,
        bytes32 nullifier,
        address indexed token,
        uint256 amount
    );
    event TokenWhitelisted(address indexed token, bool status);

    // Structs
    struct ShieldedTransaction {
        bytes32 commitment;
        address token; // Address(0) for ETH, token address for ERC20
        uint256 amount;
        uint256 timestamp;
        bool spent;
    }

    // State variables
    Counters.Counter private _transactionId;

    mapping(bytes32 => ShieldedTransaction) public shieldedTransactions;
    mapping(bytes32 => bool) public spentNullifiers;
    mapping(bytes32 => bool) public commitmentExists;
    mapping(address => bool) public whitelistedTokens;

    // Per-token accounting (fixes mixed ETH + ERC20 tracking issue)
    mapping(address => uint256) public totalShieldedByToken;
    mapping(address => uint256) public totalUnshieldedByToken;

    // Track commitment metadata for validation
    mapping(bytes32 => uint256) public commitmentAmount;
    mapping(bytes32 => address) public commitmentToken;

    Verifier public verifierContract;

    // ETH is represented as address(0)
    address public constant ETH = address(0);

    // Constructor
    constructor(address _verifierContract) {
        verifierContract = Verifier(_verifierContract);

        // Whitelist ETH by default
        whitelistedTokens[ETH] = true;
    }

    /**
     * @dev Whitelist or blacklist a token
     * @param token Token address (address(0) for ETH)
     * @param status True to whitelist, false to blacklist
     */
    function setTokenWhitelist(address token, bool status) external onlyOwner {
        whitelistedTokens[token] = status;
        emit TokenWhitelisted(token, status);
    }

    /**
     * @dev Shield ETH into the privacy pool
     * @param commitment The commitment hash for the shielded transaction
     */
    function shieldETH(bytes32 commitment)
        external
        payable
        whenNotPaused
        nonReentrant
    {
        require(msg.value > 0, "Amount must be greater than 0");
        require(
            whitelistedTokens[ETH],
            "ETH is not whitelisted"
        );
        require(!commitmentExists[commitment], "Commitment already exists");

        _transactionId.increment();

        // Store commitment data
        commitmentExists[commitment] = true;
        commitmentAmount[commitment] = msg.value;
        commitmentToken[commitment] = ETH;

        shieldedTransactions[commitment] = ShieldedTransaction({
            commitment: commitment,
            token: ETH,
            amount: msg.value,
            timestamp: block.timestamp,
            spent: false
        });

        totalShieldedByToken[ETH] += msg.value;

        emit Shield(msg.sender, ETH, msg.value, commitment);
    }

    /**
     * @dev Shield ERC20 tokens into the privacy pool
     * @param token The ERC20 token address (USDC, USDT, DAI, etc.)
     * @param amount The amount of tokens to shield
     * @param commitment The commitment hash for the shielded transaction
     */
    function shieldERC20(
        address token,
        uint256 amount,
        bytes32 commitment
    ) external whenNotPaused nonReentrant {
        require(token != ETH, "Use shieldETH for ETH");
        require(amount > 0, "Amount must be greater than 0");
        require(
            whitelistedTokens[token],
            "Token is not whitelisted"
        );
        require(!commitmentExists[commitment], "Commitment already exists");

        _transactionId.increment();

        // Transfer tokens from user to contract
        IERC20(token).safeTransferFrom(msg.sender, address(this), amount);

        // Store commitment data
        commitmentExists[commitment] = true;
        commitmentAmount[commitment] = amount;
        commitmentToken[commitment] = token;

        shieldedTransactions[commitment] = ShieldedTransaction({
            commitment: commitment,
            token: token,
            amount: amount,
            timestamp: block.timestamp,
            spent: false
        });

        totalShieldedByToken[token] += amount;

        emit Shield(msg.sender, token, amount, commitment);
    }

    /**
     * @dev Unshield tokens from the privacy pool (supports partial amounts)
     * @param inputCommitment The original commitment to spend
     * @param changeCommitment The change commitment (bytes32(0) if no change)
     * @param recipient The recipient address
     * @param outputAmount The amount to unshield
     * @param changeAmount The change amount (0 if full withdrawal)
     * @param token The token address (address(0) for ETH)
     * @param proof The zero-knowledge proof
     * @notice Public inputs: [nullifierHash, inputCommitment, outputAmount, changeCommitment, changeAmount, recipient]
     */
    function unshield(
        bytes32 inputCommitment,
        bytes32 changeCommitment,
        address recipient,
        uint256 outputAmount,
        uint256 changeAmount,
        address token,
        Verifier.Proof memory proof
    ) external whenNotPaused nonReentrant {
        require(recipient != address(0), "Invalid recipient");
        require(outputAmount > 0, "Output amount must be greater than 0");

        // Validate input commitment exists and is unspent
        require(commitmentExists[inputCommitment], "Input commitment does not exist");
        require(!shieldedTransactions[inputCommitment].spent, "Input commitment already spent");
        require(commitmentToken[inputCommitment] == token, "Token mismatch");

        // Validate amounts
        uint256 inputAmount = commitmentAmount[inputCommitment];
        require(outputAmount + changeAmount == inputAmount, "Amount mismatch: output + change != input");

        // If there's change, validate change commitment
        if (changeAmount > 0) {
            require(changeCommitment != bytes32(0), "Change commitment required when changeAmount > 0");
            require(!commitmentExists[changeCommitment], "Change commitment already exists");
        } else {
            require(changeCommitment == bytes32(0), "Change commitment must be zero when changeAmount = 0");
        }

        // Extract nullifierHash from proof
        bytes32 nullifierHash = bytes32(proof.publicInputs[0]);
        require(!spentNullifiers[nullifierHash], "Nullifier already spent");

        // Verify the ZK proof with public inputs:
        // [nullifierHash, inputCommitment, outputAmount, changeCommitment, changeAmount, recipient, outputAmount, changeAmount, recipient]
        // (The last 3 are duplicates from circuit inputs, total = 9)
        require(proof.publicInputs.length == 9, "Invalid public inputs: expected 9");
        require(verifierContract.verifyUnshieldProof(proof, proof.publicInputs), "Invalid proof");

        // Mark input as spent
        spentNullifiers[nullifierHash] = true;
        shieldedTransactions[inputCommitment].spent = true;

        // Transfer output amount to recipient
        if (token == ETH) {
            require(address(this).balance >= outputAmount, "Insufficient ETH balance");
            (bool success, ) = recipient.call{value: outputAmount}("");
            require(success, "ETH transfer failed");
        } else {
            require(IERC20(token).balanceOf(address(this)) >= outputAmount, "Insufficient token balance");
            IERC20(token).safeTransfer(recipient, outputAmount);
        }

        // Create change commitment if needed
        if (changeAmount > 0) {
            _createCommitment(changeCommitment, token, changeAmount);
            emit Shield(address(this), token, changeAmount, changeCommitment);
        }

        totalUnshieldedByToken[token] += outputAmount;

        emit Unshield(recipient, token, outputAmount, nullifierHash);
    }

    /**
     * @dev Private transfer between commitments (supports partial amounts)
     * @param inputCommitment The sender's commitment to spend
     * @param outputCommitment The receiver's new commitment
     * @param changeCommitment The sender's change commitment (bytes32(0) if no change)
     * @param outputAmount The amount to transfer to recipient
     * @param changeAmount The change amount for sender (0 if full transfer)
     * @param token The token being transferred
     * @param proof The zero-knowledge proof
     * @notice Public inputs: [nullifierHash, inputCommitment, outputCommitment, outputAmount, changeCommitment, changeAmount, recipient]
     */
    function privateTransfer(
        bytes32 inputCommitment,
        bytes32 outputCommitment,
        bytes32 changeCommitment,
        uint256 outputAmount,
        uint256 changeAmount,
        address token,
        Verifier.Proof memory proof
    ) external whenNotPaused nonReentrant {
        require(outputAmount > 0, "Output amount must be greater than 0");

        // Validate input commitment exists and is unspent
        require(commitmentExists[inputCommitment], "Input commitment does not exist");
        require(!shieldedTransactions[inputCommitment].spent, "Input commitment already spent");
        require(commitmentToken[inputCommitment] == token, "Token mismatch");

        // Validate output commitment is new
        require(!commitmentExists[outputCommitment], "Output commitment already exists");

        // Validate amounts
        uint256 inputAmount = commitmentAmount[inputCommitment];
        require(outputAmount + changeAmount == inputAmount, "Amount mismatch: output + change != input");

        // If there's change, validate change commitment
        if (changeAmount > 0) {
            require(changeCommitment != bytes32(0), "Change commitment required when changeAmount > 0");
            require(!commitmentExists[changeCommitment], "Change commitment already exists");
        } else {
            require(changeCommitment == bytes32(0), "Change commitment must be zero when changeAmount = 0");
        }

        // Extract nullifierHash from proof
        bytes32 nullifierHash = bytes32(proof.publicInputs[0]);
        require(!spentNullifiers[nullifierHash], "Nullifier already spent");

        // Verify the ZK proof with public inputs:
        // [nullifierHash, inputCommitment, outputCommitment, outputAmount, changeCommitment, changeAmount, recipient, outputAmount, changeAmount, recipient]
        // (The last 3 are duplicates from circuit inputs, total = 10)
        require(proof.publicInputs.length == 10, "Invalid public inputs: expected 10");
        require(verifierContract.verifyTransferProof(proof, proof.publicInputs), "Invalid transfer proof");

        // Mark input as spent
        spentNullifiers[nullifierHash] = true;
        shieldedTransactions[inputCommitment].spent = true;

        // Create output commitment (for recipient)
        _createCommitment(outputCommitment, token, outputAmount);

        // Create change commitment (for sender) if needed
        if (changeAmount > 0) {
            _createCommitment(changeCommitment, token, changeAmount);
            emit Shield(address(this), token, changeAmount, changeCommitment);
        }

        emit Transfer(outputCommitment, nullifierHash, token, outputAmount);
    }

    /**
     * @dev Get contract balance for a specific token
     * @param token Token address (address(0) for ETH)
     */
    function getBalance(address token) external view returns (uint256) {
        if (token == ETH) {
            return address(this).balance;
        } else {
            return IERC20(token).balanceOf(address(this));
        }
    }

    /**
     * @dev Get total shielded amount for a specific token
     * @param token Token address (address(0) for ETH)
     */
    function getTotalShielded(address token) external view returns (uint256) {
        return totalShieldedByToken[token];
    }

    /**
     * @dev Get total unshielded amount for a specific token
     * @param token Token address (address(0) for ETH)
     */
    function getTotalUnshielded(address token) external view returns (uint256) {
        return totalUnshieldedByToken[token];
    }

    /**
     * @dev Emergency withdraw (owner only)
     * @param token Token address (address(0) for ETH)
     * @param amount Amount to withdraw
     */
    function emergencyWithdraw(address token, uint256 amount)
        external
        onlyOwner
        nonReentrant
    {
        if (token == ETH) {
            (bool success, ) = owner().call{value: amount}("");
            require(success, "ETH transfer failed");
        } else {
            IERC20(token).safeTransfer(owner(), amount);
        }
    }

    /**
     * @dev Pause the contract
     */
    function pause() external onlyOwner {
        _pause();
    }

    /**
     * @dev Unpause the contract
     */
    function unpause() external onlyOwner {
        _unpause();
    }

    /**
     * @dev Internal helper to create a new commitment
     * @param commitment The commitment hash
     * @param token The token address
     * @param amount The amount
     */
    function _createCommitment(
        bytes32 commitment,
        address token,
        uint256 amount
    ) internal {
        _transactionId.increment();

        commitmentExists[commitment] = true;
        commitmentAmount[commitment] = amount;
        commitmentToken[commitment] = token;

        shieldedTransactions[commitment] = ShieldedTransaction({
            commitment: commitment,
            token: token,
            amount: amount,
            timestamp: block.timestamp,
            spent: false
        });
    }

    /**
     * @dev Allow contract to receive ETH
     */
    receive() external payable {}
}
