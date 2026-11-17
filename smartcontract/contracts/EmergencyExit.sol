// SPDX-License-Identifier: MIT
pragma solidity ^0.8.19;

import "@openzeppelin/contracts/access/Ownable.sol";
import "@openzeppelin/contracts/security/ReentrancyGuard.sol";
import "@openzeppelin/contracts/security/Pausable.sol";
import "@openzeppelin/contracts/utils/cryptography/ECDSA.sol";
import "./PrivacyPoolV2.sol";
import "./Verifier.sol";

/**
 * @title EmergencyExit
 * @dev Emergency Privacy Exit (Panic Button) Protocol for instant fund redistribution
 * @notice Enables users to trigger automated redistribution of shielded funds into stealth wallets
 */
contract EmergencyExit is Ownable, ReentrancyGuard, Pausable {
    using ECDSA for bytes32;

    // Events
    event PanicTriggered(
        address indexed user,
        bytes32 indexed sessionId,
        uint256 timestamp,
        uint8 redistributionStrategy
    );
    
    event StealthWalletGenerated(
        bytes32 indexed sessionId,
        bytes32 stealthAddress,
        uint256 amount
    );
    
    event EmergencyExitCompleted(
        bytes32 indexed sessionId,
        uint256 totalAmount,
        uint8 walletsCreated,
        uint256 timestamp
    );
    
    event RecoveryInitiated(
        address indexed user,
        bytes32 indexed sessionId,
        uint256 timestamp
    );
    
    event EmergencyContactNotified(
        bytes32 indexed sessionId,
        address indexed contact,
        uint256 timestamp
    );

    // Structs
    struct EmergencySession {
        address user;
        bytes32 sessionId;
        uint256 timestamp;
        uint256 totalAmount;
        uint8 status; // 0: initiated, 1: processing, 2: completed, 3: failed
        uint8 walletsCreated;
        RedistributionStrategy strategy;
        bool isActive;
    }

    struct StealthWallet {
        bytes32 stealthAddress;
        bytes32 viewingKey;
        bytes32 spendingKey;
        uint256 amount;
        uint256 createdAt;
        bool isRecovered;
    }

    struct RedistributionStrategy {
        uint8 strategyType; // 0: equal, 1: weighted, 2: random, 3: time-locked
        uint8 numberOfWallets;
        uint256[] amounts;
        uint256[] timeLocks;
        bool requiresMultiSig;
    }

    struct UserEmergencyConfig {
        bool isEnabled;
        address[] emergencyContacts;
        uint256 cooldownPeriod;
        uint256 lastTriggerTime;
        bytes32 recoveryHash;
        RedistributionStrategy defaultStrategy;
    }

    struct PanicProof {
        bytes32 commitment;
        bytes32 nullifier;
        bytes proof;
        uint256 timestamp;
    }

    // State variables
    mapping(address => UserEmergencyConfig) public userConfigs;
    mapping(bytes32 => EmergencySession) public emergencySessions;
    mapping(bytes32 => StealthWallet[]) public sessionStealthWallets;
    mapping(address => bytes32[]) public userEmergencySessions;
    mapping(bytes32 => PanicProof) public panicProofs;
    mapping(address => bool) public authorizedRelayers;
    
    PrivacyPoolV2 public privacyPool;
    Verifier public verifier;
    
    uint256 public constant MIN_WALLETS = 3;
    uint256 public constant MAX_WALLETS = 20;
    uint256 public constant DEFAULT_COOLDOWN = 24 hours;
    uint256 public constant EMERGENCY_TIMEOUT = 1 hours;
    uint256 public emergencyFee = 0.001 ether;
    
    uint256 private nonce;

    // Modifiers
    modifier onlyAuthorizedRelayer() {
        require(
            authorizedRelayers[msg.sender] || msg.sender == owner(),
            "EmergencyExit: Not authorized relayer"
        );
        _;
    }

    modifier hasEmergencyConfig() {
        require(
            userConfigs[msg.sender].isEnabled,
            "EmergencyExit: Emergency config not set"
        );
        _;
    }

    modifier cooldownPassed() {
        UserEmergencyConfig memory config = userConfigs[msg.sender];
        require(
            block.timestamp >= config.lastTriggerTime + config.cooldownPeriod,
            "EmergencyExit: Cooldown period not passed"
        );
        _;
    }

    // Constructor
    constructor(address payable _privacyPoolAddress, address _verifierAddress) {
        privacyPool = PrivacyPoolV2(_privacyPoolAddress);
        verifier = Verifier(_verifierAddress);
    }

    /**
     * @dev Configure emergency exit settings for a user
     * @param _contacts Emergency contact addresses
     * @param _cooldownPeriod Time between emergency triggers
     * @param _recoveryHash Hash for recovery verification
     * @param _strategy Default redistribution strategy
     */
    function configureEmergencyExit(
        address[] memory _contacts,
        uint256 _cooldownPeriod,
        bytes32 _recoveryHash,
        RedistributionStrategy memory _strategy
    ) external {
        require(_contacts.length > 0, "EmergencyExit: At least one contact required");
        require(_cooldownPeriod >= 1 hours, "EmergencyExit: Cooldown too short");
        require(
            _strategy.numberOfWallets >= MIN_WALLETS && 
            _strategy.numberOfWallets <= MAX_WALLETS,
            "EmergencyExit: Invalid wallet count"
        );

        UserEmergencyConfig storage config = userConfigs[msg.sender];
        config.isEnabled = true;
        for (uint i = 0; i < _contacts.length; i++) {
            config.emergencyContacts.push(_contacts[i]);
        }
        config.cooldownPeriod = _cooldownPeriod;
        config.recoveryHash = _recoveryHash;
        config.defaultStrategy = _strategy;
    }

    /**
     * @dev PANIC BUTTON - Trigger emergency privacy exit
     * @param _proof Zero-knowledge proof of fund ownership
     * @param _totalAmount Total amount to redistribute
     * @param _customStrategy Optional custom redistribution strategy
     */
    function triggerPanicButton(
        bytes calldata _proof,
        uint256 _totalAmount,
        RedistributionStrategy memory _customStrategy
    ) external payable hasEmergencyConfig cooldownPassed nonReentrant {
        require(msg.value >= emergencyFee, "EmergencyExit: Insufficient fee");
        
        // Generate unique session ID
        bytes32 sessionId = keccak256(
            abi.encodePacked(msg.sender, block.timestamp, nonce++)
        );
        
        // Use custom strategy or default
        RedistributionStrategy memory strategy = _customStrategy.numberOfWallets > 0 
            ? _customStrategy 
            : userConfigs[msg.sender].defaultStrategy;
        
        // Create emergency session
        EmergencySession storage session = emergencySessions[sessionId];
        session.user = msg.sender;
        session.sessionId = sessionId;
        session.timestamp = block.timestamp;
        session.totalAmount = _totalAmount;
        session.status = 1; // processing
        session.strategy = strategy;
        session.isActive = true;
        
        userEmergencySessions[msg.sender].push(sessionId);
        userConfigs[msg.sender].lastTriggerTime = block.timestamp;
        
        // Store panic proof
        panicProofs[sessionId] = PanicProof({
            commitment: keccak256(_proof),
            nullifier: keccak256(abi.encodePacked(sessionId, msg.sender)),
            proof: _proof,
            timestamp: block.timestamp
        });
        
        emit PanicTriggered(msg.sender, sessionId, block.timestamp, strategy.strategyType);
        
        // Notify emergency contacts
        _notifyEmergencyContacts(sessionId);
        
        // Execute redistribution
        _executeRedistribution(sessionId, _totalAmount, strategy);
    }

    /**
     * @dev Execute the redistribution of funds into stealth wallets
     */
    function _executeRedistribution(
        bytes32 _sessionId,
        uint256 _totalAmount,
        RedistributionStrategy memory _strategy
    ) internal {
        EmergencySession storage session = emergencySessions[_sessionId];
        
        uint256[] memory amounts = _calculateDistribution(_totalAmount, _strategy);
        
        for (uint8 i = 0; i < _strategy.numberOfWallets; i++) {
            // Generate stealth wallet
            StealthWallet memory wallet = _generateStealthWallet(
                _sessionId,
                amounts[i],
                _strategy.timeLocks.length > i ? _strategy.timeLocks[i] : 0
            );
            
            sessionStealthWallets[_sessionId].push(wallet);
            session.walletsCreated++;
            
            emit StealthWalletGenerated(
                _sessionId,
                wallet.stealthAddress,
                wallet.amount
            );
        }
        
        session.status = 2; // completed
        
        emit EmergencyExitCompleted(
            _sessionId,
            _totalAmount,
            session.walletsCreated,
            block.timestamp
        );
    }

    /**
     * @dev Generate a stealth wallet with unique keys
     */
    function _generateStealthWallet(
        bytes32 _sessionId,
        uint256 _amount,
        uint256 _timeLock
    ) internal view returns (StealthWallet memory) {
        // Generate deterministic but unpredictable keys
        bytes32 seed = keccak256(
            abi.encodePacked(
                _sessionId,
                block.timestamp,
                block.prevrandao,
                _amount,
                nonce
            )
        );
        
        bytes32 stealthAddress = keccak256(abi.encodePacked(seed, "address"));
        bytes32 viewingKey = keccak256(abi.encodePacked(seed, "viewing"));
        bytes32 spendingKey = keccak256(abi.encodePacked(seed, "spending"));
        
        return StealthWallet({
            stealthAddress: stealthAddress,
            viewingKey: viewingKey,
            spendingKey: spendingKey,
            amount: _amount,
            createdAt: block.timestamp + _timeLock,
            isRecovered: false
        });
    }

    /**
     * @dev Calculate distribution amounts based on strategy
     */
    function _calculateDistribution(
        uint256 _totalAmount,
        RedistributionStrategy memory _strategy
    ) internal pure returns (uint256[] memory) {
        uint256[] memory amounts = new uint256[](_strategy.numberOfWallets);
        
        if (_strategy.strategyType == 0) {
            // Equal distribution
            uint256 amountPerWallet = _totalAmount / _strategy.numberOfWallets;
            uint256 remainder = _totalAmount % _strategy.numberOfWallets;
            
            for (uint8 i = 0; i < _strategy.numberOfWallets; i++) {
                amounts[i] = amountPerWallet;
                if (i == 0) amounts[i] += remainder; // Add remainder to first wallet
            }
        } else if (_strategy.strategyType == 1) {
            // Weighted distribution
            require(
                _strategy.amounts.length == _strategy.numberOfWallets,
                "EmergencyExit: Invalid weighted distribution"
            );
            amounts = _strategy.amounts;
        } else if (_strategy.strategyType == 2) {
            // Random distribution (pseudo-random for determinism)
            uint256 remaining = _totalAmount;
            for (uint8 i = 0; i < _strategy.numberOfWallets - 1; i++) {
                uint256 maxAmount = (remaining * 60) / 100; // Max 60% per wallet
                uint256 minAmount = (remaining * 10) / 100; // Min 10% per wallet
                amounts[i] = minAmount + (uint256(keccak256(abi.encodePacked(i, _totalAmount))) % (maxAmount - minAmount));
                remaining -= amounts[i];
            }
            amounts[_strategy.numberOfWallets - 1] = remaining;
        } else if (_strategy.strategyType == 3) {
            // Time-locked distribution
            return _calculateDistribution(_totalAmount, RedistributionStrategy({
                strategyType: 0, // Use equal distribution
                numberOfWallets: _strategy.numberOfWallets,
                amounts: new uint256[](0),
                timeLocks: _strategy.timeLocks,
                requiresMultiSig: _strategy.requiresMultiSig
            }));
        }
        
        return amounts;
    }

    /**
     * @dev Notify emergency contacts about the panic trigger
     */
    function _notifyEmergencyContacts(bytes32 _sessionId) internal {
        UserEmergencyConfig memory config = userConfigs[msg.sender];
        
        for (uint256 i = 0; i < config.emergencyContacts.length; i++) {
            emit EmergencyContactNotified(
                _sessionId,
                config.emergencyContacts[i],
                block.timestamp
            );
        }
    }

    /**
     * @dev Recover funds from stealth wallets (requires recovery proof)
     * @param _sessionId Emergency session ID
     * @param _walletIndex Index of the stealth wallet to recover
     * @param _recoveryProof Proof of ownership for recovery
     */
    function recoverStealthWallet(
        bytes32 _sessionId,
        uint256 _walletIndex,
        bytes calldata _recoveryProof
    ) external nonReentrant {
        EmergencySession memory session = emergencySessions[_sessionId];
        require(session.isActive, "EmergencyExit: Invalid session");
        require(session.user == msg.sender, "EmergencyExit: Not session owner");
        
        StealthWallet storage wallet = sessionStealthWallets[_sessionId][_walletIndex];
        require(!wallet.isRecovered, "EmergencyExit: Already recovered");
        require(
            block.timestamp >= wallet.createdAt,
            "EmergencyExit: Time lock not expired"
        );
        
        // Verify recovery proof
        bytes32 proofHash = keccak256(_recoveryProof);
        require(
            proofHash == userConfigs[msg.sender].recoveryHash,
            "EmergencyExit: Invalid recovery proof"
        );
        
        wallet.isRecovered = true;
        
        emit RecoveryInitiated(msg.sender, _sessionId, block.timestamp);
        
        // Transfer funds back to user (implement actual transfer logic)
        // This would interact with the PrivacyPool contract
    }

    /**
     * @dev Cancel an emergency session (only within timeout period)
     * @param _sessionId Session to cancel
     * @param _cancellationProof Proof of authorization to cancel
     */
    function cancelEmergencySession(
        bytes32 _sessionId,
        bytes calldata _cancellationProof
    ) external {
        EmergencySession storage session = emergencySessions[_sessionId];
        require(session.isActive, "EmergencyExit: Invalid session");
        require(session.user == msg.sender, "EmergencyExit: Not session owner");
        require(
            block.timestamp <= session.timestamp + EMERGENCY_TIMEOUT,
            "EmergencyExit: Timeout expired"
        );
        require(session.status == 1, "EmergencyExit: Cannot cancel completed session");
        
        // Verify cancellation proof
        bytes32 proofHash = keccak256(_cancellationProof);
        require(
            proofHash == userConfigs[msg.sender].recoveryHash,
            "EmergencyExit: Invalid cancellation proof"
        );
        
        session.status = 3; // failed/cancelled
        session.isActive = false;
    }

    /**
     * @dev Get stealth wallets for a session
     */
    function getSessionStealthWallets(bytes32 _sessionId) 
        external 
        view 
        returns (StealthWallet[] memory) 
    {
        return sessionStealthWallets[_sessionId];
    }

    /**
     * @dev Get user's emergency sessions
     */
    function getUserEmergencySessions(address _user) 
        external 
        view 
        returns (bytes32[] memory) 
    {
        return userEmergencySessions[_user];
    }

    /**
     * @dev Update emergency fee (only owner)
     */
    function updateEmergencyFee(uint256 _newFee) external onlyOwner {
        emergencyFee = _newFee;
    }

    /**
     * @dev Add authorized relayer
     */
    function addAuthorizedRelayer(address _relayer) external onlyOwner {
        authorizedRelayers[_relayer] = true;
    }

    /**
     * @dev Remove authorized relayer
     */
    function removeAuthorizedRelayer(address _relayer) external onlyOwner {
        authorizedRelayers[_relayer] = false;
    }

    /**
     * @dev Emergency pause (only owner)
     */
    function pause() external onlyOwner {
        _pause();
    }

    /**
     * @dev Unpause (only owner)
     */
    function unpause() external onlyOwner {
        _unpause();
    }

    function getEmergencyContacts(address _user) external view returns (address[] memory) {
        return userConfigs[_user].emergencyContacts;
    }

    /**
     * @dev Withdraw collected fees (only owner)
     */
    function withdrawFees() external onlyOwner {
        payable(owner()).transfer(address(this).balance);
    }
}