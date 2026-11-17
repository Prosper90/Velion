// SPDX-License-Identifier: MIT
pragma solidity ^0.8.19;

import "@openzeppelin/contracts/access/Ownable.sol";
import "@openzeppelin/contracts/security/ReentrancyGuard.sol";
import "@openzeppelin/contracts/security/Pausable.sol";
import "@openzeppelin/contracts/utils/Counters.sol";

/**
 * @title Governance
 * @dev Contract for DAO governance and voting mechanisms
 */
contract Governance is Ownable, ReentrancyGuard, Pausable {
    using Counters for Counters.Counter;

    // Events
    event ProposalCreated(uint256 indexed proposalId, address indexed proposer, string description);
    event ProposalExecuted(uint256 indexed proposalId);
    event ProposalCanceled(uint256 indexed proposalId);
    event Voted(uint256 indexed proposalId, address indexed voter, bool support, uint256 weight);
    event VoterRegistered(address indexed voter, uint256 weight);
    event VoterDeregistered(address indexed voter);
    event QuorumUpdated(uint256 newQuorum);
    event VotingPeriodUpdated(uint256 newVotingPeriod);

    // Structs
    struct Proposal {
        uint256 id;
        address proposer;
        string description;
        uint256 forVotes;
        uint256 againstVotes;
        uint256 startTime;
        uint256 endTime;
        bool executed;
        bool canceled;
        mapping(address => Receipt) receipts;
    }

    struct Receipt {
        bool hasVoted;
        bool support;
        uint256 weight;
    }

    struct Voter {
        bool isRegistered;
        uint256 weight;
        uint256 lastVoteTime;
        bool hasVoted;
    }

    // State variables
    Counters.Counter private _proposalId;
    
    mapping(uint256 => Proposal) public proposals;
    mapping(address => Voter) public voters;
    mapping(address => bool) public isVoter;
    
    uint256 public quorum;
    uint256 public votingPeriod;
    uint256 public totalVoters;
    uint256 public totalWeight;

    // Modifiers
    modifier onlyVoter() {
        require(voters[msg.sender].isRegistered, "Governance: Not a registered voter");
        _;
    }

    modifier onlyProposer(uint256 proposalId) {
        require(proposals[proposalId].proposer == msg.sender, "Governance: Not the proposer");
        _;
    }

    modifier proposalExists(uint256 proposalId) {
        require(proposals[proposalId].id != 0, "Governance: Proposal does not exist");
        _;
    }

    modifier proposalActive(uint256 proposalId) {
        require(proposals[proposalId].id != 0, "Governance: Proposal does not exist");
        require(!proposals[proposalId].executed, "Governance: Proposal already executed");
        require(!proposals[proposalId].canceled, "Governance: Proposal already canceled");
        require(block.timestamp <= proposals[proposalId].endTime, "Governance: Voting period ended");
        _;
    }

    // Constructor
    constructor(
        uint256 _quorum,
        uint256 _votingPeriod
    ) {
        quorum = _quorum;
        votingPeriod = _votingPeriod;
    }

    /**
     * @dev Register a new voter
     * @param voter The address of the voter
     * @param weight The voting weight of the voter
     */
    function registerVoter(address voter, uint256 weight) external onlyOwner {
        require(voter != address(0), "Governance: Invalid voter address");
        require(weight > 0, "Governance: Weight must be greater than 0");
        require(!voters[voter].isRegistered, "Governance: Voter already registered");

        voters[voter] = Voter({
            isRegistered: true,
            weight: weight,
            lastVoteTime: 0,
            hasVoted: false
        });

        isVoter[voter] = true;
        totalVoters++;
        totalWeight += weight;

        emit VoterRegistered(voter, weight);
    }

    /**
     * @dev Deregister a voter
     * @param voter The address of the voter to deregister
     */
    function deregisterVoter(address voter) external onlyOwner {
        require(voters[voter].isRegistered, "Governance: Voter not registered");

        totalWeight -= voters[voter].weight;
        totalVoters--;

        delete voters[voter];
        delete isVoter[voter];

        emit VoterDeregistered(voter);
    }

    /**
     * @dev Create a new proposal
     * @param description The description of the proposal
     */
    function createProposal(string memory description) external onlyVoter whenNotPaused returns (uint256) {
        require(bytes(description).length > 0, "Governance: Description cannot be empty");

        _proposalId.increment();
        uint256 proposalId = _proposalId.current();

        Proposal storage proposal = proposals[proposalId];
        proposal.id = proposalId;
        proposal.proposer = msg.sender;
        proposal.description = description;
        proposal.startTime = block.timestamp;
        proposal.endTime = block.timestamp + votingPeriod;

        emit ProposalCreated(proposalId, msg.sender, description);

        return proposalId;
    }

    /**
     * @dev Vote on a proposal
     * @param proposalId The ID of the proposal
     * @param support Whether to support the proposal
     */
    function vote(uint256 proposalId, bool support) external onlyVoter proposalActive(proposalId) nonReentrant {
        Proposal storage proposal = proposals[proposalId];
        Voter storage voter = voters[msg.sender];

        require(!proposal.receipts[msg.sender].hasVoted, "Governance: Already voted");
        require(block.timestamp >= proposal.startTime, "Governance: Voting not started");

        uint256 weight = voter.weight;
        proposal.receipts[msg.sender] = Receipt({
            hasVoted: true,
            support: support,
            weight: weight
        });

        if (support) {
            proposal.forVotes += weight;
        } else {
            proposal.againstVotes += weight;
        }

        voter.lastVoteTime = block.timestamp;

        emit Voted(proposalId, msg.sender, support, weight);
    }

    /**
     * @dev Execute a proposal
     * @param proposalId The ID of the proposal to execute
     */
    function executeProposal(uint256 proposalId) external onlyOwner proposalExists(proposalId) nonReentrant {
        Proposal storage proposal = proposals[proposalId];

        require(!proposal.executed, "Governance: Proposal already executed");
        require(!proposal.canceled, "Governance: Proposal already canceled");
        require(block.timestamp > proposal.endTime, "Governance: Voting period not ended");
        require(proposal.forVotes + proposal.againstVotes >= quorum, "Governance: Quorum not reached");
        require(proposal.forVotes > proposal.againstVotes, "Governance: Proposal not passed");

        proposal.executed = true;

        emit ProposalExecuted(proposalId);
    }

    /**
     * @dev Cancel a proposal
     * @param proposalId The ID of the proposal to cancel
     */
    function cancelProposal(uint256 proposalId) external onlyProposer(proposalId) proposalExists(proposalId) {
        Proposal storage proposal = proposals[proposalId];

        require(!proposal.executed, "Governance: Proposal already executed");
        require(!proposal.canceled, "Governance: Proposal already canceled");

        proposal.canceled = true;

        emit ProposalCanceled(proposalId);
    }

    /**
     * @dev Get proposal information
     * @param proposalId The ID of the proposal
     */
    function getProposal(uint256 proposalId) external view returns (
        uint256 id,
        address proposer,
        string memory description,
        uint256 forVotes,
        uint256 againstVotes,
        uint256 startTime,
        uint256 endTime,
        bool executed,
        bool canceled
    ) {
        Proposal storage proposal = proposals[proposalId];
        return (
            proposal.id,
            proposal.proposer,
            proposal.description,
            proposal.forVotes,
            proposal.againstVotes,
            proposal.startTime,
            proposal.endTime,
            proposal.executed,
            proposal.canceled
        );
    }

    /**
     * @dev Get voter receipt for a proposal
     * @param proposalId The ID of the proposal
     * @param voter The address of the voter
     */
    function getReceipt(uint256 proposalId, address voter) external view returns (
        bool hasVoted,
        bool support,
        uint256 weight
    ) {
        Proposal storage proposal = proposals[proposalId];
        Receipt storage receipt = proposal.receipts[voter];
        return (receipt.hasVoted, receipt.support, receipt.weight);
    }

    /**
     * @dev Get voter information
     * @param voter The address of the voter
     */
    function getVoter(address voter) external view returns (
        bool isRegistered,
        uint256 weight,
        uint256 lastVoteTime,
        bool hasVoted
    ) {
        Voter storage voterData = voters[voter];
        return (
            voterData.isRegistered,
            voterData.weight,
            voterData.lastVoteTime,
            voterData.hasVoted
        );
    }

    /**
     * @dev Get governance statistics
     */
    function getStats() external view returns (
        uint256 totalProposals,
        uint256 totalVotersCount,
        uint256 totalWeightAmount,
        uint256 quorumAmount,
        uint256 votingPeriodDuration
    ) {
        return (
            _proposalId.current(),
            totalVoters,
            totalWeight,
            quorum,
            votingPeriod
        );
    }

    /**
     * @dev Check if a proposal has passed
     * @param proposalId The ID of the proposal
     */
    function proposalPassed(uint256 proposalId) external view returns (bool) {
        Proposal storage proposal = proposals[proposalId];
        
        if (proposal.executed || proposal.canceled) {
            return false;
        }
        
        if (block.timestamp <= proposal.endTime) {
            return false;
        }
        
        if (proposal.forVotes + proposal.againstVotes < quorum) {
            return false;
        }
        
        return proposal.forVotes > proposal.againstVotes;
    }

    /**
     * @dev Check if a voter can vote on a proposal
     * @param proposalId The ID of the proposal
     * @param voter The address of the voter
     */
    function canVote(uint256 proposalId, address voter) external view returns (bool) {
        Proposal storage proposal = proposals[proposalId];
        Voter storage voterData = voters[voter];
        
        if (!voterData.isRegistered) {
            return false;
        }
        
        if (proposal.executed || proposal.canceled) {
            return false;
        }
        
        if (block.timestamp < proposal.startTime || block.timestamp > proposal.endTime) {
            return false;
        }
        
        if (proposal.receipts[voter].hasVoted) {
            return false;
        }
        
        return true;
    }

    /**
     * @dev Update quorum requirement
     * @param newQuorum The new quorum amount
     */
    function updateQuorum(uint256 newQuorum) external onlyOwner {
        require(newQuorum > 0, "Governance: Quorum must be greater than 0");
        require(newQuorum <= totalWeight, "Governance: Quorum cannot exceed total weight");
        
        quorum = newQuorum;
        emit QuorumUpdated(newQuorum);
    }

    /**
     * @dev Update voting period
     * @param newVotingPeriod The new voting period duration
     */
    function updateVotingPeriod(uint256 newVotingPeriod) external onlyOwner {
        require(newVotingPeriod > 0, "Governance: Voting period must be greater than 0");
        
        votingPeriod = newVotingPeriod;
        emit VotingPeriodUpdated(newVotingPeriod);
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
     * @dev Get the number of proposals
     */
    function getProposalCount() external view returns (uint256) {
        return _proposalId.current();
    }

    /**
     * @dev Check if an address is a registered voter
     * @param voter The address to check
     */
    function isRegisteredVoter(address voter) external view returns (bool) {
        return voters[voter].isRegistered;
    }
} 