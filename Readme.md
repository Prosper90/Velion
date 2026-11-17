# Veilon (VeilOn)

> **Privacy, on your terms.** A zero-knowledge privacy wallet and protocol that lets you shield assets, make private transfers, and unshield them — with an emergency "panic button" and on-chain governance built in.

![Solidity](https://img.shields.io/badge/Solidity-0.8.19-363D3E?logo=solidity&logoColor=white)
![TypeScript](https://img.shields.io/badge/TypeScript-5.x-3178C6?logo=typescript&logoColor=white)
![React Native](https://img.shields.io/badge/React_Native-0.81-61DAFB?logo=react&logoColor=white)
![Expo](https://img.shields.io/badge/Expo-SDK_54-000020?logo=expo&logoColor=white)
![Hardhat](https://img.shields.io/badge/Hardhat-2.26-FFF100?logo=hardhat&logoColor=black)
![Node.js](https://img.shields.io/badge/Node.js-%3E%3D18-339933?logo=node.js&logoColor=white)
![License: MIT](https://img.shields.io/badge/License-MIT-green.svg)
![Network: Sepolia](https://img.shields.io/badge/Network-Sepolia-6C5FC7?logo=ethereum&logoColor=white)

---

## Table of Contents

- [What is Veilon?](#what-is-veilon)
- [Features](#features)
- [Architecture](#architecture)
- [Repository Structure](#repository-structure)
- [Tech Stack](#tech-stack)
- [Getting Started](#getting-started)
  - [Prerequisites](#prerequisites)
  - [1. Smart Contracts](#1-smart-contracts)
  - [2. Relayer / Proof Service](#2-relayer--proof-service)
  - [3. Mobile App](#3-mobile-app)
  - [Environment Variables](#environment-variables)
- [How the Protocol Works](#how-the-protocol-works)
- [API Reference](#api-reference)
- [Smart Contract Reference](#smart-contract-reference)
- [Deployments](#deployments)
- [Testing](#testing)
- [Security Notes & Known Limitations](#security-notes--known-limitations)
- [Contributing](#contributing)
- [License](#license)

---

## What is Veilon?

Veilon is a **privacy-preserving wallet and protocol** built around a commitment-based zero-knowledge privacy pool. Instead of publishing "Alice paid Bob 1 ETH" on-chain, funds are deposited into a pool as a cryptographic **commitment**, private transfers move value between commitments, and withdrawals break the link between the deposit and the recipient using **Groth16 zero-knowledge proofs** verified by Solidity smart contracts.

This repository contains all three pieces of the system:

| Component | Directory | Role |
| --- | --- | --- |
| **Privacy protocol contracts** | [`smartcontract/`](smartcontract/) | Solidity privacy pool, ZK verifiers, DAO governance, emergency exit |
| **Relayer / proof service** | [`backend/`](backend/) | Express + TypeScript service that generates Groth16 proofs and Poseidon hashes |
| **Mobile wallet** | [`mobile/`](mobile/) | Expo / React Native app with file-based routing, PIN security and on-chain interaction |

> **Note:** The mobile app is currently configured against the **Sepolia testnet** and a hosted development relayer. Treat this project as a working prototype / hackathon-grade system, not a production-ready, audited privacy product. See [Security Notes & Known Limitations](#security-notes--known-limitations).

---

## Features

### Privacy protocol
- **Shield** ETH or whitelisted ERC-20 tokens into a commitment pool.
- **Private transfers** between commitments, with change commitments for partial amounts.
- **Unshield** back to a public address, supporting **partial withdrawals** with automatic change.
- **Nullifier-based double-spend prevention** — a commitment can only be spent once.
- **Poseidon hashing** for commitments and nullifier hashes; **Groth16** proofs verified on-chain.
- **Multi-asset accounting** — per-token totals so ETH and ERC-20 balances never get mixed up.
- **Owner-controlled token whitelist** and pausable contracts.

### Wallet & UX (Expo app)
- File-based navigation with Expo Router: onboarding, PIN setup, home, wallet, portfolio, settings.
- Shield, private transfer, unshield, send/receive, token selection and transaction details screens.
- **PIN security** with device biometrics, secure key storage via `expo-secure-store`, and lockout state.
- **Transfer notes** — shareable `veilon://transfer?...` URIs for passing private payment details out of band.
- Live prices via CoinGecko / CryptoCompare and pending-commitment / transaction-history tracking.
- A **private/public DEX aggregator** screen (UI in progress).

### Safety & governance
- **Emergency Exit ("panic button")** — configurable redistribution strategies (equal, weighted, random, time-locked), emergency contacts, cooldowns and stealth wallet generation.
- **DAO governance contract** — proposals, weighted voting, quorum and voting periods.

---

## Architecture

```
┌──────────────────────────┐         HTTPS / JSON          ┌────────────────────────────┐
│   Expo Mobile Wallet     │ ───────────────────────────▶  │  Relayer (Express / TS)    │
│  (React Native, ethers)  │ ◀───────────────────────────  │  snarkjs + circomlibjs     │
└────────────┬─────────────┘       proof + signals         └─────────────┬──────────────┘
             │                                                          │
             │ sign & broadcast tx                        generate commitment / proof
             ▼                                                          ▼
┌──────────────────────────────────────────────────────────────────────────────────────┐
│                     Ethereum (Sepolia) — Solidity contracts                         │
│  PrivacyPoolV2  ◀── Verifier { Shield, Unshield, Transfer }                          │
│       ▲                                                                             │
│       │                    Governance          EmergencyExit                        │
└──────────────────────────────────────────────────────────────────────────────────────┘
```

Data flow for a private action:

1. The wallet prepares the secret, nullifier and randomness values locally and asks the relayer for a proof.
2. The relayer computes the commitment / nullifier hash with Poseidon and generates a Groth16 proof using the compiled circuit artifacts (`wasm` + `zkey`).
3. The wallet submits the proof, public signals and commitment to `PrivacyPoolV2`, which asks the `Verifier` contracts to validate it.
4. On success the pool records the commitment (or marks a nullifier as spent) and emits an event; the wallet tracks it as pending until confirmed.

Because React Native cannot run Node-only libraries such as `snarkjs` and `circomlibjs`, proof generation is intentionally delegated to the relayer. The relayer is the only component that sees the raw proof inputs — **do not use a relayer you do not trust with production funds**.

---

## Repository Structure

```
Velion/
├── backend/                        # ZK proof-generation relayer
│   ├── src/
│   │   ├── server.ts               # Express bootstrap, /health, /api/privacy
│   │   ├── routes/privacy.ts       # shield / unshield / transfer / health endpoints
│   │   └── services/proof-generator.ts  # Poseidon + Groth16 proof service
│   ├── circuits/                   # Compiled artifacts (local only — gitignored)
│   │   ├── keys/                   # *.zkey + verification keys
│   │   └── artifacts/              # *_js/ wasm witness calculators
│   ├── dist/                       # Compiled JavaScript (generated)
│   ├── package.json
│   └── tsconfig.json
│
├── mobile/                         # Expo / React Native wallet
│   ├── app/                        # Expo Router screens
│   │   ├── (tabs)/                 # home, wallet, portfolio, settings
│   │   ├── onboarding/             # brand, get started, link wallet, setup PIN
│   │   ├── _layout.tsx             # root layout (fonts, theme, stores)
│   │   ├── index.tsx               # entry redirect based on wallet/PIN state
│   │   ├── shield-tokens.tsx
│   │   ├── private-transfer.tsx
│   │   ├── unshield-tokens.tsx
│   │   ├── emergency-withdraw.tsx
│   │   ├── import-transfer-note.tsx
│   │   └── ...                     # send/receive, details, token selection, DEX
│   ├── components/                 # Reusable UI + wallet/security components
│   ├── constants/                  # contract addresses/ABI, token lists, relayer URLs
│   ├── services/                   # veilon-sdk.ts, pin-security.ts
│   ├── stores/                     # Zustand: wallet, token, security, notifications
│   ├── utils/
│   │   ├── sdk/                    # Embedded TypeScript SDK (VeilonSDK)
│   │   ├── commitment-store-rn.ts  # Local commitment / pending balance tracking
│   │   ├── transaction-history-rn.ts
│   │   ├── transfer-note.ts        # veilon:// note encoding/decoding
│   │   └── price-fetcher.ts
│   ├── assets/                     # Logos, token icons, fonts, splash
│   ├── app.json / eas.json         # Expo & EAS build configuration
│   ├── metro.config.js             # Node-module polyfill aliases
│   ├── global-setup.js             # RN crypto/buffer/stream/WebAssembly polyfills
│   └── package.json
│
├── smartcontract/                  # Hardhat project
│   ├── contracts/
│   │   ├── PrivacyPoolV2.sol       # Main privacy pool (ETH + ERC-20)
│   │   ├── Verifier.sol            # Aggregates the three Groth16 verifiers
│   │   ├── ShieldVerifier.sol
│   │   ├── UnshieldVerifier.sol
│   │   ├── TransferVerifier.sol
│   │   ├── Governance.sol
│   │   ├── EmergencyExit.sol
│   │   └── MockERC20.sol
│   ├── scripts/                    # Deploy, mint, whitelist, verification helpers
│   ├── test/                       # Hardhat/Chai unit + integration tests
│   ├── deployments/                # sepolia-deployment.json
│   ├── hardhat.config.js
│   └── package.json
│
├── .gitignore
└── README.md                       # This file
```

> There is **no root package manager workspace** — each of the three subprojects installs and runs independently.

---

## Tech Stack

| Layer | Technologies |
| --- | --- |
| **Smart contracts** | Solidity 0.8.19, Hardhat 2.26, OpenZeppelin Contracts 4.9, `@nomicfoundation/hardhat-toolbox`, Chai/Mocha, Etherscan/Sourcify verification |
| **Relayer** | Node.js ≥ 18, TypeScript 5.1, Express 4, Helmet, CORS, Morgan, dotenv, ethers v6, `snarkjs` (Groth16), `circomlibjs` (Poseidon), nodemon |
| **Mobile** | Expo SDK 54, React 19, React Native 0.81, Expo Router 6, TypeScript 5.9, Zustand 4.5, ethers v6, Axios, crypto-js, `expo-secure-store`, `expo-local-authentication`, QR-code + SVG libraries, Jest/jest-expo |
| **Build / deploy** | Hardhat scripts, EAS (Expo Application Services), Metro bundler with custom polyfill resolver, Railway (hosted relayer) |

The mobile project ships a large set of Node polyfills (`buffer`, `stream`, `crypto`, `url`, `zlib`, `WebAssembly`, base64 shims, etc.) so that ethers and the embedded SDK can run inside React Native.

---

## Getting Started

### Prerequisites

- **Node.js 18+** and npm (npm 9+ recommended)
- For contract work: an RPC endpoint (e.g. Sepolia) and a funded deployer key
- For mobile work: **Expo Go** for quick testing, or Android Studio / Xcode for native builds, plus an EAS account for production builds
- A running relayer and the compiled circuit artifacts for real (non-mock) proofs

> ⚠️ The Circom source files (`*.circom`) are **gitignored** and are not in this repository. Only the compiled artifacts (`.wasm`, `.zkey`, verification keys) exist locally, and those are gitignored too. To generate real proofs you must compile the circuits yourself and place the outputs in `backend/circuits/artifacts/` and `backend/circuits/keys/`. Without them, the relayer falls back to **mock proofs** for development.

### 1. Smart Contracts

```bash
cd smartcontract
npm install

# Compile the Solidity sources
npm run compile

# Run the local Hardhat test suite
npm test

# Deploy to Sepolia (requires PRIVATE_KEY + SEPOLIA_RPC_URL in smartcontract/.env)
npm run deploy:sepolia
```

Useful scripts from [`smartcontract/package.json`](smartcontract/package.json):

| Command | Description |
| --- | --- |
| `npm run compile` | `hardhat compile` |
| `npm test` | `hardhat test` |
| `npm run coverage` | `hardhat coverage` |
| `npm run verify` | `hardhat verify` (pass contract address + constructor args) |
| `npm run deploy:localhost` | Deploy to a local Hardhat node |
| `npm run deploy:sepolia` / `deploy:bsc` / `deploy:mumbai` | Deploy to the configured testnets |
| `npm run deploy:all-testnets` | Deploy to Sepolia, BSC testnet, Mumbai and Arbitrum Sepolia in sequence |

> **Heads-up:** the `deploy:arbitrum-*`, `verify:arbitrum-*` and `test:arbitrum` scripts reference `hardhat.config.arbitrum.js`, which is not currently present in this repository. They will fail until that config (and `scripts/deploy-arbitrum.js`) are added.

### 2. Relayer / Proof Service

```bash
cd backend
npm install

# Development (hot reload via nodemon)
npm run dev

# Production-style build & run
npm run build
npm start
```

The service listens on `PORT` (default `3004`). Check it with:

```bash
curl http://localhost:3004/health
curl http://localhost:3004/api/privacy/health
```

If compiled circuits are missing, every proof request returns a **mock proof** and the `/api/privacy/health` response reports `circuitsCompiled: false`. The startup log also suggests running `bash scripts/compile-circuits.sh`; that helper script is not included in this repository — you will need to supply your own circuit compilation step.

### 3. Mobile App

```bash
cd mobile
npm install

# Start the Expo dev server (scan QR with Expo Go, or press a/w/i)
npm start

# Native builds / platforms
npm run android
npm run ios
npm run web

# Unit tests (Jest + jest-expo)
npm test
```

Before running on a device, update [`mobile/constants/relayer.ts`](mobile/constants/relayer.ts): in development the app calls `http://172.20.10.3:3004`, which is a hardcoded local IP. Change it to your machine's LAN address (the device cannot reach `localhost`). Production points at `https://veilonbackend-production.up.railway.app`.

Contract addresses and ABIs are configured in [`mobile/constants/contracts.ts`](mobile/constants/contracts.ts); token lists live in [`mobile/constants/tokens.ts`](mobile/constants/tokens.ts).

### Environment Variables

Environment files (`.env`) are **gitignored** and are not committed. Create them locally using these variable names:

| File | Variables |
| --- | --- |
| `smartcontract/.env` | `PRIVATE_KEY`, `SEPOLIA_RPC_URL`, `BSC_TESTNET_RPC_URL`, `MUMBAI_RPC_URL`, `ARBITRUM_SEPOLIA_RPC_URL`, `ETHERSCAN_API_KEY`, `BSCSCAN_API_KEY`, `POLYGONSCAN_API_KEY`, `ARBISCAN_API_KEY` |
| `backend/.env` | `PORT` (optional, defaults to `3004`) |
| `mobile/.env` | `EXPO_PUBLIC_*` values used by the app (e.g. `EXPO_PUBLIC_ETHERSCAN_API_KEY`) |

Example:

```ini
# smartcontract/.env — never commit this file
PRIVATE_KEY=0xYOUR_DEPLOYER_PRIVATE_KEY
SEPOLIA_RPC_URL=https://your-sepolia-rpc.example
ETHERSCAN_API_KEY=your_etherscan_key
```

---

## How the Protocol Works

### Commitments and nullifiers

A shielded note is a commitment:

```
commitment = Poseidon(secret, nullifier, randomness)
nullifierHash = Poseidon(nullifier, randomness)
```

The commitment is published on-chain so the pool can hold funds without revealing who owns them. The `secret`, `nullifier` and `randomness` stay with the user (backed up in a transfer note or local storage). To spend a commitment, the user proves in zero knowledge that they know the preimage and reveals only the `nullifierHash`, which the contract records in `spentNullifiers` — preventing double spends without linking the spend to the original deposit.

### Shield

1. User generates secret / nullifier / randomness and requests a shield proof.
2. Relayer returns the proof, signals and commitment.
3. Wallet calls `shieldETH(commitment)` (payable) or `shieldERC20(token, amount, commitment)`.
4. Contract stores the commitment with its token and amount and emits `Shield`.

### Private transfer

1. User chooses an input commitment and creates new output + change commitments.
2. Relayer builds a transfer proof showing the input is unspent and value is conserved.
3. `privateTransfer(...)` consumes the input nullifier and registers the new commitments.

### Unshield (with change)

1. User requests an unshield proof for a partial amount; the relayer auto-computes `change = input - output` when not supplied.
2. `unshield(...)` verifies the proof, marks the nullifier spent, pays the recipient and creates a change commitment for the remainder.

### Emergency Exit

`EmergencyExit.sol` lets a user configure emergency contacts, a cooldown and a redistribution strategy. Triggering a panic session generates multiple stealth wallets according to the strategy (equal / weighted / random / time-locked, optionally multi-sig) and records recovery hashes, so funds can be moved quickly without exposing the user's main address.

---

## API Reference

Base URL: `http://localhost:3004` (configurable via `PORT`).

| Method | Endpoint | Description |
| --- | --- | --- |
| `GET` | `/health` | Service liveness — returns `status`, `service`, `timestamp` |
| `GET` | `/api/privacy/health` | Proof service status — `status`, `circuitsCompiled`, `poseidonLoaded` |
| `POST` | `/api/privacy/shield` | Generate a shield proof and commitment |
| `POST` | `/api/privacy/unshield` | Generate an unshield proof (supports change) |
| `POST` | `/api/privacy/transfer` | Generate a private transfer proof (supports change) |

**Example — shield request**

```bash
curl -X POST http://localhost:3004/api/privacy/shield \
  -H "Content-Type: application/json" \
  -d '{ "amount": "0.1", "recipient": "0x...", "chainId": 11155111 }'
```

```json
{
  "success": true,
  "commitment": "...",
  "nullifier": "...",
  "secret": "...",
  "randomness": "...",
  "proof": { "...": "..." },
  "publicSignals": ["..."],
  "message": "Shield proof generated. Blockchain submission pending implementation."
}
```

**Unshield / transfer** additionally accept the input secret/nullifier/randomness and optional output/change values; amounts are parsed with `ethers.parseEther` and change is computed in wei. Responses include the proof, public signals, nullifier hash, change/output commitments and newly generated change secrets.

> The relayer currently **returns proof data only** — on-chain transaction submission is performed by the mobile app via ethers. Amounts sent to these endpoints are expected in **ether** units (the service converts to wei internally).

---

## Smart Contract Reference

| Contract | Purpose |
| --- | --- |
| [`PrivacyPoolV2.sol`](smartcontract/contracts/PrivacyPoolV2.sol) | Core pool: `shieldETH`, `shieldERC20`, `unshield`, `privateTransfer`, `emergencyWithdraw`, whitelisting, pause, per-token accounting |
| [`Verifier.sol`](smartcontract/contracts/Verifier.sol) | Aggregates the three Groth16 verifiers used by the pool |
| [`ShieldVerifier.sol`](smartcontract/contracts/ShieldVerifier.sol), [`UnshieldVerifier.sol`](smartcontract/contracts/UnshieldVerifier.sol), [`TransferVerifier.sol`](smartcontract/contracts/TransferVerifier.sol) | Individual proof verifiers (Groth16) |
| [`EmergencyExit.sol`](smartcontract/contracts/EmergencyExit.sol) | Panic-button redistribution to stealth wallets, contacts, cooldowns, recovery |
| [`Governance.sol`](smartcontract/contracts/Governance.sol) | Proposal creation, weighted voting, quorum, voting periods, execution |
| [`MockERC20.sol`](smartcontract/contracts/MockERC20.sol) | Test token for local development |

Security patterns used: `Ownable`, `ReentrancyGuard`, `Pausable`, `SafeERC20`, duplicate-commitment checks, nullifier replay protection and per-token balance tracking. `ETH` is represented as `address(0)` and whitelisted by default.

---

## Deployments

Live Sepolia deployment recorded in [`smartcontract/deployments/sepolia-deployment.json`](smartcontract/deployments/sepolia-deployment.json) (deployed 2025-11-16, chain ID `11155111`):

| Contract | Address |
| --- | --- |
| ShieldVerifier | `0xDF41CaDa2eeadB79A48ddCD37EDe78A387544c0F` |
| UnshieldVerifier | `0x71475050bA47B37aa30cf5B3D4b8510eF3c9F386` |
| TransferVerifier | `0x50cD4EB467d15503bE7a3AAA32b068fF5C038c5F` |
| Verifier | `0xbd66fF3f6a6a11429e9e2687B21e62a43685E3F1` |
| PrivacyPoolV2 | `0x33a5f045eECb8C17b0CBeaE29ed08e6D0E2ec5f5` |
| Governance | `0x7C0Ba50Cb24cE441e8679c2Cee31179353d06bb9` |
| EmergencyExit | `0xCAC45A7De1cb6bD98431fcF4d1406570B1ACE6Af` |

Supported Sepolia tokens: **ETH** (`0x000…000`), **USDC** (`0x1c7D4B196Cb0C7B01d743Fbc6116a902379C7238`) and **USDT** (`0xaA8E23Fb1079EA71e0a56F48a2aA51851D8433D0`).

---

## Testing

```bash
# Contract unit tests
cd smartcontract && npm test

# Additional coverage report
npm run coverage

# Integration tests (FullFlow.test.js / PrivateTransfer.test.js) call the relayer via axios —
# start the backend on http://localhost:3004 first:
cd ../backend && npm run dev

# Mobile unit tests (watch mode)
cd ../mobile && npm test
```

The contract suite covers the privacy-pool flow and private transfers; the integration tests exercise the end-to-end proof generation path against a running relayer.

---

## Security Notes & Known Limitations

This is a prototype. Please keep the following in mind:

- **No audit.** The contracts and protocol have not been formally audited. Do not use with real funds.
- **Mock proofs by default.** Without compiled `.wasm`/`.zkey` artifacts in `backend/circuits/`, the relayer returns mock proofs. The Circom sources and artifacts are gitignored and are not part of this repository.
- **Trust model.** The relayer receives secret/nullifier/randomness material. A malicious relayer could compromise privacy. A production design should generate proofs client-side (or use a trusted/attested prover network).
- **Secrets.** `.env` files are gitignored, but if any key was ever committed or shared, **rotate it**. Use `.env.example` templates and never hardcode private keys or API keys (including in build profiles such as `eas.json`).
- **Hardcoded endpoints.** The mobile relayer URL and Sepolia RPC endpoint are hardcoded in source. Make these configurable for real deployments.
- **Incomplete scripts.** Arbitrum deploy/verify/test scripts reference a missing `hardhat.config.arbitrum.js` (and `scripts/deploy-arbitrum.js`).
- **Embedded SDK limitation.** `mobile/utils/sdk/sdk.ts` throws "Proof generation not available in React Native" for `shield()`; the app relies on the relayer instead. `mobile/stores/workingwalletStore.txt` is an obsolete snapshot, not active code.
- **Custodial key handling.** The mobile app stores a wallet private key in `expo-secure-store` and signs locally; securing that key against device compromise is the app's responsibility.
- **UI in progress.** The DEX aggregator screen is UI-only, and `mobile/components/CustomAlert.README.md` documents that the custom alert system is only integrated in some screens.

---

## Contributing

Contributions are welcome. A good workflow:

1. Fork the repository and create a feature branch.
2. Install dependencies in the subproject you are changing (`backend/`, `mobile/` or `smartcontract/`).
3. Keep secrets out of commits — use `.env` files and `.env.example` templates.
4. Run the relevant tests (`npm test` in `smartcontract/` and `mobile/`) and `npm run build` in `backend/`.
5. Open a pull request describing the change and any deployment/circuit implications.

Please use the issue tracker for bug reports, feature requests and security disclosures. For critical security issues, contact the maintainers privately rather than opening a public issue.

---

## License

The Solidity sources in this repository are marked `SPDX-License-Identifier: MIT`. Unless otherwise stated, the project is released under the MIT License. See the license headers in the contract files for details.
