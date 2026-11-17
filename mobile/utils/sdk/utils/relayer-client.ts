import axios, { AxiosInstance, AxiosResponse } from 'axios';
import { RelayerError, NetworkError } from '../errors';
import { RelayerInfo, TransactionResult } from '../types';

export interface RelayerConfig {
  baseUrl: string;
  timeout?: number;
  apiKey?: string;
  retries?: number;
}

export interface RelayRequest {
  type: 'shield' | 'unshield' | 'transfer';
  amount: string;
  recipient: string;
  proof: any;
  publicInputs: string[];
  fee?: string;
  gasLimit?: string;
  gasPrice?: string;
}

export interface RelayResponse {
  success: boolean;
  transactionHash?: string;
  estimatedGas?: string;
  fee?: string;
  error?: string;
}

export interface RelayerStatus {
  address: string;
  isOnline: boolean;
  fee: string;
  reputation: number;
  latency: number;
  gasPrice: string;
}

export class RelayerClient {
  private client: AxiosInstance;
  private config: RelayerConfig;
  private relayerCache: Map<string, RelayerStatus> = new Map();

  constructor(baseUrl: string, config: Partial<RelayerConfig> = {}) {
    this.config = {
      baseUrl,
      timeout: config.timeout || 30000,
      retries: config.retries || 3,
      ...config
    };

    this.client = axios.create({
      baseURL: this.config.baseUrl,
      timeout: this.config.timeout,
      headers: {
        'Content-Type': 'application/json',
        ...(this.config.apiKey && { 'Authorization': `Bearer ${this.config.apiKey}` })
      }
    });

    this.setupInterceptors();
  }

  /**
   * Submit a relay request to the relayer
   */
  async submitRelayRequest(request: RelayRequest): Promise<RelayResponse> {
    try {
      const response = await this.client.post<RelayResponse>('/relay', request);
      return response.data;
    } catch (error: any) {
      throw new RelayerError(`Relay request failed: ${this.getErrorMessage(error)}`, error);
    }
  }

  /**
   * Submit a shield transaction through relayer
   */
  async relayShield(
    commitment: string,
    amount: string,
    proof: any,
    publicInputs: string[],
    fee?: string
  ): Promise<RelayResponse> {
    const request: RelayRequest = {
      type: 'shield',
      amount,
      recipient: commitment,
      proof,
      publicInputs,
      fee
    };

    return this.submitRelayRequest(request);
  }

  /**
   * Submit an unshield transaction through relayer
   */
  async relayUnshield(
    nullifier: string,
    recipient: string,
    amount: string,
    proof: any,
    publicInputs: string[],
    fee?: string
  ): Promise<RelayResponse> {
    const request: RelayRequest = {
      type: 'unshield',
      amount,
      recipient,
      proof,
      publicInputs,
      fee
    };

    return this.submitRelayRequest(request);
  }

  /**
   * Submit a transfer transaction through relayer
   */
  async relayTransfer(
    outputCommitment: string,
    nullifier: string,
    amount: string,
    proof: any,
    publicInputs: string[],
    fee?: string
  ): Promise<RelayResponse> {
    const request: RelayRequest = {
      type: 'transfer',
      amount,
      recipient: outputCommitment,
      proof,
      publicInputs,
      fee
    };

    return this.submitRelayRequest(request);
  }

  /**
   * Get available relayers
   */
  async getAvailableRelayers(): Promise<RelayerStatus[]> {
    try {
      const response = await this.client.get<RelayerStatus[]>('/relayers');

      // Update cache
      response.data.forEach(relayer => {
        this.relayerCache.set(relayer.address, relayer);
      });

      return response.data;
    } catch (error: any) {
      throw new RelayerError(`Failed to get available relayers: ${this.getErrorMessage(error)}`, error);
    }
  }

  /**
   * Get relayer information
   */
  async getRelayerInfo(address: string): Promise<RelayerInfo> {
    try {
      const response = await this.client.get<RelayerInfo>(`/relayers/${address}`);
      return response.data;
    } catch (error: any) {
      throw new RelayerError(`Failed to get relayer info: ${this.getErrorMessage(error)}`, error);
    }
  }

  /**
   * Check relayer status
   */
  async checkRelayerStatus(address: string): Promise<RelayerStatus> {
    try {
      const response = await this.client.get<RelayerStatus>(`/relayers/${address}/status`);

      // Update cache
      this.relayerCache.set(address, response.data);

      return response.data;
    } catch (error: any) {
      throw new RelayerError(`Failed to check relayer status: ${this.getErrorMessage(error)}`, error);
    }
  }

  /**
   * Get transaction status
   */
  async getTransactionStatus(txHash: string): Promise<TransactionResult> {
    try {
      const response = await this.client.get<TransactionResult>(`/transactions/${txHash}`);
      return response.data;
    } catch (error: any) {
      throw new RelayerError(`Failed to get transaction status: ${this.getErrorMessage(error)}`, error);
    }
  }

  /**
   * Estimate relay fee
   */
  async estimateRelayFee(request: RelayRequest): Promise<{
    fee: string;
    gasEstimate: string;
    gasPrice: string;
  }> {
    try {
      const response = await this.client.post('/estimate', request);
      return response.data;
    } catch (error: any) {
      throw new RelayerError(`Failed to estimate relay fee: ${this.getErrorMessage(error)}`, error);
    }
  }

  /**
   * Find best relayer based on criteria
   */
  async findBestRelayer(criteria: {
    maxFee?: string;
    minReputation?: number;
    maxLatency?: number;
  } = {}): Promise<RelayerStatus | null> {
    try {
      const relayers = await this.getAvailableRelayers();

      let filteredRelayers = relayers.filter(relayer => relayer.isOnline);

      if (criteria.maxFee) {
        filteredRelayers = filteredRelayers.filter(
          relayer => parseFloat(relayer.fee) <= parseFloat(criteria.maxFee!)
        );
      }

      if (criteria.minReputation) {
        filteredRelayers = filteredRelayers.filter(
          relayer => relayer.reputation >= criteria.minReputation!
        );
      }

      if (criteria.maxLatency) {
        filteredRelayers = filteredRelayers.filter(
          relayer => relayer.latency <= criteria.maxLatency!
        );
      }

      if (filteredRelayers.length === 0) {
        return null;
      }

      // Sort by reputation (descending) and then by fee (ascending)
      filteredRelayers.sort((a, b) => {
        if (a.reputation !== b.reputation) {
          return b.reputation - a.reputation;
        }
        return parseFloat(a.fee) - parseFloat(b.fee);
      });

      return filteredRelayers[0];
    } catch (error: any) {
      throw new RelayerError(`Failed to find best relayer: ${this.getErrorMessage(error)}`, error);
    }
  }

  /**
   * Test relayer connectivity
   */
  async testConnectivity(address?: string): Promise<boolean> {
    try {
      const endpoint = address ? `/relayers/${address}/ping` : '/ping';
      const response = await this.client.get(endpoint);
      return response.status === 200;
    } catch (error: any) {
      return false;
    }
  }

  /**
   * Get cached relayer status
   */
  getCachedRelayerStatus(address: string): RelayerStatus | undefined {
    return this.relayerCache.get(address);
  }

  /**
   * Clear relayer cache
   */
  clearCache(): void {
    this.relayerCache.clear();
  }

  /**
   * Update relayer configuration
   */
  updateConfig(config: Partial<RelayerConfig>): void {
    this.config = { ...this.config, ...config };

    // Update axios instance
    this.client.defaults.baseURL = this.config.baseUrl;
    this.client.defaults.timeout = this.config.timeout;

    if (this.config.apiKey) {
      this.client.defaults.headers['Authorization'] = `Bearer ${this.config.apiKey}`;
    }
  }

  /**
   * Setup axios interceptors for retry logic and error handling
   */
  private setupInterceptors(): void {
    // Request interceptor
    this.client.interceptors.request.use(
      (config) => {
        console.log(`[RelayerClient] Request: ${config.method?.toUpperCase()} ${config.url}`);
        return config;
      },
      (error) => {
        console.error('[RelayerClient] Request error:', error);
        return Promise.reject(error);
      }
    );

    // Response interceptor with retry logic
    this.client.interceptors.response.use(
      (response) => {
        console.log(`[RelayerClient] Response: ${response.status} ${response.config.url}`);
        return response;
      },
      async (error) => {
        const config = error.config;

        if (!config._retry && config._retryCount !== undefined) {
          config._retry = true;
          config._retryCount = config._retryCount || 0;

          if (config._retryCount < (this.config.retries || 3)) {
            config._retryCount++;
            console.log(`[RelayerClient] Retrying request (${config._retryCount}/${this.config.retries})`);

            // Exponential backoff
            const delay = Math.pow(2, config._retryCount) * 1000;
            await new Promise(resolve => setTimeout(resolve, delay));

            return this.client(config);
          }
        }

        console.error('[RelayerClient] Response error:', error);
        return Promise.reject(error);
      }
    );
  }

  /**
   * Extract error message from axios error
   */
  private getErrorMessage(error: any): string {
    if (error.response) {
      return error.response.data?.message || error.response.statusText || 'Unknown server error';
    } else if (error.request) {
      return 'Network error - no response received';
    } else {
      return error.message || 'Unknown error';
    }
  }

  /**
   * Monitor relayer performance
   */
  async monitorRelayers(interval: number = 30000): Promise<void> {
    const monitor = async () => {
      try {
        const relayers = await this.getAvailableRelayers();
        console.log(`[RelayerClient] Monitoring ${relayers.length} relayers`);

        for (const relayer of relayers) {
          const startTime = Date.now();
          const isOnline = await this.testConnectivity(relayer.address);
          const latency = Date.now() - startTime;

          // Update cached status
          const updatedStatus: RelayerStatus = {
            ...relayer,
            isOnline,
            latency
          };

          this.relayerCache.set(relayer.address, updatedStatus);
        }
      } catch (error) {
        console.error('[RelayerClient] Monitoring error:', error);
      }

      setTimeout(monitor, interval);
    };

    monitor();
  }
}