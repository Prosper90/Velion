import { ethers } from 'ethers';
import { ContractError } from '../errors';
import { GovernanceStats } from '../types';

export interface Proposal {
  id: number;
  proposer: string;
  description: string;
  forVotes: string;
  againstVotes: string;
  startBlock: number;
  endBlock: number;
  status: 'pending' | 'active' | 'defeated' | 'succeeded' | 'executed';
  quorumReached: boolean;
}

export class Governance {
  private contract: ethers.Contract;
  private provider: ethers.Provider;
  private signer?: ethers.Signer;

  // Governance ABI
  private static readonly ABI = [
    'function createProposal(string calldata description) external returns (uint256)',
    'function vote(uint256 proposalId, bool support) external',
    'function executeProposal(uint256 proposalId) external',
    'function getProposal(uint256 proposalId) external view returns (address proposer, string memory description, uint256 forVotes, uint256 againstVotes, uint256 startBlock, uint256 endBlock, uint8 status)',
    'function getProposalState(uint256 proposalId) external view returns (uint8)',
    'function hasVoted(uint256 proposalId, address voter) external view returns (bool)',
    'function getVote(uint256 proposalId, address voter) external view returns (bool)',
    'function proposalCount() external view returns (uint256)',
    'function votingDelay() external view returns (uint256)',
    'function votingPeriod() external view returns (uint256)',
    'function quorum() external view returns (uint256)',
    'function proposalThreshold() external view returns (uint256)',
    'function getTotalVotes() external view returns (uint256)',
    'function getActiveProposalCount() external view returns (uint256)',
    'event ProposalCreated(uint256 indexed proposalId, address indexed proposer, string description)',
    'event VoteCast(address indexed voter, uint256 indexed proposalId, bool support, uint256 votes)',
    'event ProposalExecuted(uint256 indexed proposalId)'
  ];

  constructor(address: string, provider: ethers.Provider, signer?: ethers.Signer) {
    this.provider = provider;
    this.signer = signer;
    this.contract = new ethers.Contract(address, Governance.ABI, signer || provider);
  }

  /**
   * Create a new governance proposal
   */
  async createProposal(description: string): Promise<ethers.ContractTransactionResponse> {
    try {
      if (!this.signer) {
        throw new ContractError('Signer is required for creating proposals');
      }

      const tx = await this.contract.createProposal(description);
      return tx;
    } catch (error: any) {
      throw new ContractError(`Proposal creation failed: ${error.message}`, error);
    }
  }

  /**
   * Vote on a proposal
   */
  async vote(proposalId: number, support: boolean): Promise<ethers.ContractTransactionResponse> {
    try {
      if (!this.signer) {
        throw new ContractError('Signer is required for voting');
      }

      const tx = await this.contract.vote(proposalId, support);
      return tx;
    } catch (error: any) {
      throw new ContractError(`Voting failed: ${error.message}`, error);
    }
  }

  /**
   * Execute a successful proposal
   */
  async executeProposal(proposalId: number): Promise<ethers.ContractTransactionResponse> {
    try {
      if (!this.signer) {
        throw new ContractError('Signer is required for proposal execution');
      }

      const tx = await this.contract.executeProposal(proposalId);
      return tx;
    } catch (error: any) {
      throw new ContractError(`Proposal execution failed: ${error.message}`, error);
    }
  }

  /**
   * Get proposal information
   */
  async getProposal(proposalId: number): Promise<Proposal> {
    try {
      const result = await this.contract.getProposal(proposalId);
      const state = await this.contract.getProposalState(proposalId);
      const quorum = await this.contract.quorum();

      const forVotes = ethers.formatEther(result[2]);
      const againstVotes = ethers.formatEther(result[3]);
      const totalVotes = BigInt(result[2]) + BigInt(result[3]);

      return {
        id: proposalId,
        proposer: result[0],
        description: result[1],
        forVotes,
        againstVotes,
        startBlock: Number(result[4]),
        endBlock: Number(result[5]),
        status: this.mapProposalState(state),
        quorumReached: totalVotes >= quorum
      };
    } catch (error: any) {
      throw new ContractError(`Failed to get proposal: ${error.message}`, error);
    }
  }

  /**
   * Check if an address has voted on a proposal
   */
  async hasVoted(proposalId: number, voter: string): Promise<boolean> {
    try {
      return await this.contract.hasVoted(proposalId, voter);
    } catch (error: any) {
      throw new ContractError(`Failed to check vote status: ${error.message}`, error);
    }
  }

  /**
   * Get how an address voted on a proposal
   */
  async getVote(proposalId: number, voter: string): Promise<boolean> {
    try {
      return await this.contract.getVote(proposalId, voter);
    } catch (error: any) {
      throw new ContractError(`Failed to get vote: ${error.message}`, error);
    }
  }

  /**
   * Get the total number of proposals
   */
  async getProposalCount(): Promise<number> {
    try {
      const count = await this.contract.proposalCount();
      return Number(count);
    } catch (error: any) {
      throw new ContractError(`Failed to get proposal count: ${error.message}`, error);
    }
  }

  /**
   * Get governance parameters
   */
  async getGovernanceParams() {
    try {
      const [votingDelay, votingPeriod, quorum, proposalThreshold] = await Promise.all([
        this.contract.votingDelay(),
        this.contract.votingPeriod(),
        this.contract.quorum(),
        this.contract.proposalThreshold()
      ]);

      return {
        votingDelay: Number(votingDelay),
        votingPeriod: Number(votingPeriod),
        quorum: ethers.formatEther(quorum),
        proposalThreshold: ethers.formatEther(proposalThreshold)
      };
    } catch (error: any) {
      throw new ContractError(`Failed to get governance parameters: ${error.message}`, error);
    }
  }

  /**
   * Get governance statistics
   */
  async getStats(): Promise<GovernanceStats> {
    try {
      const [totalProposals, activeProposals, totalVotes, quorum] = await Promise.all([
        this.contract.proposalCount(),
        this.contract.getActiveProposalCount(),
        this.contract.getTotalVotes(),
        this.contract.quorum()
      ]);

      return {
        totalProposals: Number(totalProposals),
        activeProposals: Number(activeProposals),
        totalVotes: Number(totalVotes),
        quorum: ethers.formatEther(quorum)
      };
    } catch (error: any) {
      throw new ContractError(`Failed to get governance stats: ${error.message}`, error);
    }
  }

  /**
   * Get all proposals with pagination
   */
  async getProposals(offset: number = 0, limit: number = 10): Promise<Proposal[]> {
    try {
      const totalCount = await this.getProposalCount();
      const proposals: Proposal[] = [];

      const start = Math.max(0, offset);
      const end = Math.min(totalCount, start + limit);

      for (let i = start; i < end; i++) {
        const proposal = await this.getProposal(i);
        proposals.push(proposal);
      }

      return proposals;
    } catch (error: any) {
      throw new ContractError(`Failed to get proposals: ${error.message}`, error);
    }
  }

  /**
   * Map proposal state number to string
   */
  private mapProposalState(state: number): Proposal['status'] {
    switch (state) {
      case 0: return 'pending';
      case 1: return 'active';
      case 2: return 'defeated';
      case 3: return 'succeeded';
      case 4: return 'executed';
      default: return 'pending';
    }
  }

  /**
   * Listen for ProposalCreated events
   */
  onProposalCreated(callback: (proposalId: number, proposer: string, description: string) => void): void {
    this.contract.on('ProposalCreated', (proposalId, proposer, description, event) => {
      callback(Number(proposalId), proposer, description);
    });
  }

  /**
   * Listen for VoteCast events
   */
  onVoteCast(callback: (voter: string, proposalId: number, support: boolean, votes: string) => void): void {
    this.contract.on('VoteCast', (voter, proposalId, support, votes, event) => {
      callback(voter, Number(proposalId), support, ethers.formatEther(votes));
    });
  }

  /**
   * Listen for ProposalExecuted events
   */
  onProposalExecuted(callback: (proposalId: number) => void): void {
    this.contract.on('ProposalExecuted', (proposalId, event) => {
      callback(Number(proposalId));
    });
  }

  /**
   * Remove all event listeners
   */
  removeAllListeners(): void {
    this.contract.removeAllListeners();
  }

  /**
   * Get the contract instance
   */
  getContract(): ethers.Contract {
    return this.contract;
  }

  /**
   * Get the contract address
   */
  getAddress(): string {
    return this.contract.target as string;
  }
}