# StokvelOnChain Smart Contract

[![License: MIT](https://img.shields.io/badge/License-MIT-yellow.svg)](https://opensource.org/licenses/MIT)
[![Solidity](https://img.shields.io/badge/Solidity-0.8.28-blue)](https://soliditylang.org/)
[![OpenZeppelin](https://img.shields.io/badge/OpenZeppelin-5.0-purple)](https://openzeppelin.com/)

A decentralized stokvel (savings club) smart contract built on Ethereum using Solidity. This contract enables group savings with on-chain governance, username membership management, and proportional distribution mechanisms.

## 📋 Table of Contents

- [Overview](#overview)
- [Key Features](#key-features)
- [Architecture](#architecture)
- [How It Works](#how-it-works)
- [Installation](#installation)
- [Usage](#usage)
- [Contract Functions](#contract-functions)
- [Events](#events)
- [Security](#security)
- [Testing](#testing)
- [Deployment](#deployment)
- [Gas Optimization](#gas-optimization)
- [License](#license)

## 🎯 Overview

**StokvelOnChain** enables groups to pool funds, manage membership with email-based identification, and track shared contributions using blockchain technology. The system uses:

- **Membership Contracts**: Individual smart contracts per member, created via MembershipFactory
- **Email-Based Identity**: Members identified by email hash (privacy-preserving)
- **ERC1155 Token ID 1**: Represents contribution shares
- **IPFS Agreements**: Membership agreements stored on IPFS

### What is a Stokvel?

A Stokvel is a traditional South African savings scheme where members regularly contribute to a common pool. This smart contract brings this concept on-chain with:

- **Transparency**: All transactions recorded on blockchain
- **Privacy**: Email-based identity with hashed storage
- **Automation**: Smart contract enforces rules automatically
- **Individual Custody**: Each member has their own Membership contract

## ✨ Key Features

### 🤝 Membership Management
- **MembershipFactory Pattern**: Creates individual Membership contracts for each member
- **Email-Based Identity**: Privacy-preserving email hash identification
- **IPFS-Backed Agreements**: Each member has a membership agreement stored on IPFS
- **State Tracking**: Members can be NONMEMBER, ACTIVE, TRANSFERRED, or TERMINATED
- **Membership Transfer**: Transfer membership and contribution tokens to new members
- **Claim Mechanism**: EIP-712 signature-based membership claiming

### 💰 Financial Management
- **ERC20 Contributions**: Members contribute using a specified ERC20 token
- **Individual Membership Contracts**: Each member's funds held in their own contract
- **Token-Based System**: ERC1155 Token ID 1 represents contribution shares
- **Auto-Approval**: Membership contracts automatically approve Stokvel for max amount
- **Flexible Withdrawals**: Members can withdraw funds to any address after claiming

### 🏛️ Governance System
- **Quorum-Based Approval**: Weighted voting based on contribution token balance
- **Operator Permissions**: Grant spending permissions after quorum is reached
- **Owner Authority**: Contract owner facilitates voting and execution

### 🔐 Security Features
- **Owner Control**: Ownable pattern for administrative functions
- **Reentrancy Protection**: Guards on all fund transfers
- **Pausable**: Emergency stop mechanism
- **Input Validation**: Comprehensive checks on all operations
- **Safe ERC20**: SafeERC20 library for secure token transfers
- **EIP-712 Signatures**: Secure membership claiming

## 🏗️ Architecture

```
System Architecture:
├── StokvelOnChain.sol
│   ├── ERC1155Supply (OpenZeppelin)
│   │   └── Multi-token standard - Token ID 1 for contributions
│   ├── Ownable (OpenZeppelin)
│   ├── ReentrancyGuard (OpenZeppelin)
│   └── Pausable (OpenZeppelin)
├── MembershipFactory.sol
│   └── Creates individual Membership contracts
└── Membership.sol
    ├── Individual contract per member
    ├── Holds member's contribution assets
    ├── Auto-approves Stokvel contract
    └── EIP-712 claim functionality

Token ID Structure:
├── Token ID 1: Contribution shares (mandatory)
└── Token ID 2+: Available for other stokvel assets (optional)

Membership States:
├── NONMEMBER (0): Address unknown to contract
├── ACTIVE (1): Member is currently active
├── TRANSFERRED (2): Membership transferred to another address
└── TERMINATED (3): Membership has been terminated
```

## 🔄 How It Works

### Phase 1: Deployment & Setup

```solidity
// 1. Deploy MembershipFactory
MembershipFactory factory = new MembershipFactory();

// 2. Deploy StokvelOnChain with parameters
StokvelOnChain stokvel = new StokvelOnChain(
    "/StokvelOnchain/stokvelOne",    // Metadata URI
    1000 * 10**18,                    // Quorum (e.g., 1000 tokens)
    0xRANDCOIN_TOKEN_ADDRESS,             // Contribution asset (ERC20)
    address(factory)                  // MembershipFactory address
);
```

### Phase 2: Add Members

```solidity
// Owner adds member using email
// This creates a Membership contract for the member
stokvel.join(
    "member1@example.com",
    "QmIPFSHash123"  // IPFS hash of membership agreement
);

// Get the member's Membership contract address
address membershipAddr = stokvel.getMembership("member1@example.com");
```

### Phase 3: Member Claims Membership

```solidity
// Member claims their Membership contract using EIP-712 signature
// Owner generates signature off-chain:

const domain = {
    name: "StokvelMembership",
    version: "1",
    chainId: chainId,
    verifyingContract: membershipAddress
};

const types = {
    ClaimMembership: [
        { name: "emailHash", type: "bytes32" },
        { name: "claimant", type: "address" },
        { name: "deadline", type: "uint256" }
    ]
};

const value = {
    emailHash: keccak256(email),
    claimant: memberAddress,
    deadline: timestamp
};

const signature = await owner.signTypedData(domain, types, value);

// Member claims ownership
membership.claim(memberAddress, deadline, signature);
```

### Phase 4: Member Contributions

```solidity
// 1. Member sends contribution tokens to their Membership contract
contributionToken.transfer(membershipAddr, amount);

// 2. Owner triggers contribution on behalf of membership
// (Membership contract has already approved Stokvel for max amount)
stokvel.contribute(membershipAddr, amount);
// - Transfers tokens from Membership to Stokvel
// - Mints ERC1155 contribution tokens (ID 1) to member's wallet
```

### Phase 5: Governance & Approvals

```solidity
// 1. Owner collects votes from members to approve an operator
stokvel.approveToUseContribution(
    voterAddress,    // Member voting (their wallet)
    operatorAddress  // Address to grant permission
);
// Voting power = member's contribution token balance

// 2. Once quorum reached, owner grants permission
stokvel.grantPermissionToUseContribution(
    operatorAddress,
    1000 * 10**18  // Amount operator can spend
);
// Operator now has ERC20 approval to spend contribution assets
```

### Phase 6: Distribution

```solidity
// Owner initiates distribution to member's Membership contract
stokvel.distributeContributionAsset(membershipAddr);
// Membership contract receives: (contribution tokens / total) × pool balance
// Contribution tokens are burned

// Or distribute to multiple members
address[] memory memberships = [membership1, membership2, membership3];
stokvel.batchDistributeContributionAsset(memberships);
```

### Phase 7: Member Withdrawals

```solidity
// After distribution, member can withdraw from their Membership contract
membership.withdrawTo(
    tokenAddress,
    amount,
    recipientAddress
);
```

### Phase 8: Membership Management

```solidity
// Transfer membership to new address
stokvel.transferMembership(
    newMemberAddress,
    oldMembershipAddr,
    "QmTransferHash456"
);
// Transfers all contribution tokens (ID 1) to new member's wallet

// Terminate membership (only if balance is zero)
stokvel.terminateMembership(
    membershipAddr,
    "QmTerminateHash789"
);
```

## 📦 Installation

### Prerequisites

```bash
# Node.js v16 or higher
node --version

# Hardhat
npx hardhat version
```

### Setup

```bash
# Install dependencies
npm install 
```

### Run tests

```bash
npx hardhat --coverage test
```

## 🚀 Usage

### 1. Deployment

```solidity
// Deploy MembershipFactory first
const MembershipFactory = await ethers.getContractFactory("MembershipFactory");
const factory = await MembershipFactory.deploy();
await factory.waitForDeployment();
```
#### or if using ETH sepolia there is alread deployed factor : 0xBd48b01f1B4CB5A7Fa329c48Cb2C3e75d8B75444
```solidity
// Deploy MockERC20 (or use existing token)
const MockERC20 = await ethers.getContractFactory("MockERC20");
const token = await MockERC20.deploy("RandCoin", "RZAR", 18);
await token.waitForDeployment();

// Deploy StokvelOnChain
const StokvelOnChain = await ethers.getContractFactory("StokvelOnChain");
const stokvel = await StokvelOnChain.deploy(
    "/StokvelOnchain/stokvelOne",
    ethers.parseUnits("1000", 18),  // Quorum
    await token.getAddress(),
    await factory.getAddress()
);
await stokvel.waitForDeployment();
```

### 2. Add Members

```solidity
// Owner adds member using email
await stokvel.join(
    "member1@example.com",
    "QmIPFSHash123"
);

// Get membership contract address
const membershipAddr = await stokvel.getMembership("member1@example.com");
```

### 3. Member Claims Membership

```javascript
// Generate EIP-712 signature (off-chain)
const emailHash = ethers.keccak256(ethers.toUtf8Bytes(email));
const deadline = Math.floor(Date.now() / 1000) + 3600; // 1 hour

const domain = {
    name: "StokvelMembership",
    version: "1",
    chainId: (await ethers.provider.getNetwork()).chainId,
    verifyingContract: membershipAddress
};

const types = {
    ClaimMembership: [
        { name: "emailHash", type: "bytes32" },
        { name: "claimant", type: "address" },
        { name: "deadline", type: "uint256" }
    ]
};

const value = {
    emailHash: emailHash,
    claimant: claimantAddress,
    deadline: deadline
};

const signature = await owner.signTypedData(domain, types, value);

// Member claims membership
await membership.claim(claimantAddress, deadline, signature);
```

### 4. Making Contributions

```solidity
// 1. Send tokens to membership contract
await token.transfer(membershipAddr, amount);

// 2. Owner triggers contribution
await stokvel.contribute(membershipAddr, amount);
```

### 5. Governance Process

```solidity
// Step 1: Members vote
await stokvel.approveToUseContribution(voterAddress, operatorAddress);

// Step 2: Grant permission once quorum is reached
await stokvel.grantPermissionToUseContribution(operatorAddress, amount);
```

### 6. Distribution

```solidity
// Single member
await stokvel.distributeContributionAsset(membershipAddr);

// Batch distribution
const memberships = [membership1, membership2, membership3];
await stokvel.batchDistributeContributionAsset(memberships);
```

### 7. Member Withdrawals

```solidity
// Member withdraws from their Membership contract
await membership.withdrawTo(tokenAddress, amount, recipientAddress);
```

## 📚 Contract Functions

### StokvelOnChain - Admin Functions

| Function | Description |
|----------|-------------|
| `setContributionERC20(address)` | Set the ERC20 token for contributions |
| `setStokvelQuorum(uint256)` | Update quorum requirement |
| `pause()` | Pause all contract operations |
| `unpause()` | Resume contract operations |
| `join(string, string)` | Add new member by email |
| `transferMembership(address, address, string)` | Transfer membership |
| `terminateMembership(address, string)` | Terminate membership (only if balance is zero) |

### StokvelOnChain - Member Functions

| Function | Description |
|----------|-------------|
| `contribute(address, uint256)` | Make contribution on behalf of membership |

### StokvelOnChain - Governance Functions

| Function | Description |
|----------|-------------|
| `approveToUseContribution(address, address)` | Record member's vote |
| `grantPermissionToUseContribution(address, uint256)` | Grant permission after quorum |
| `resetQuorum(address)` | Reset operator's quorum |

### StokvelOnChain - Distribution Functions

| Function | Description |
|----------|-------------|
| `distributeContributionAsset(address)` | Distribute to single membership |
| `batchDistributeContributionAsset(address[])` | Distribute to multiple memberships |

### StokvelOnChain - View Functions

| Function | Description |
|----------|-------------|
| `getMembership(string)` | Get Membership contract address by email |
| `getMember(address)` | Get member information |
| `isActiveMember(address)` | Check if Membership address is active |
| `getQuorum(address)` | Get operator's current quorum |
| `getContributionBalance(address)` | Get member's contribution balance |
| `getTotalContributions()` | Get total contributions in stokvel |
| `getContributionAssetBalance()` | Get contract's asset balance |

### Membership - Member Functions

| Function | Description |
|----------|-------------|
| `claim(address, uint256, bytes)` | Claim membership with EIP-712 signature |
| `withdrawTo(address, uint256, address)` | Withdraw tokens to recipient (only claimant) |

### Membership - View Functions

| Function | Description |
|----------|-------------|
| `isClaimed()` | Check if membership has been claimed |
| `claimant()` | Get address of claimant |
| `getBalance(address)` | Get token balance in Membership contract |
| `stokvelContract()` | Get Stokvel contract address |
| `contributionAsset()` | Get contribution asset address |
| `emailHash()` | Get email hash |

## 📡 Events

### StokvelOnChain Events

```solidity
event ContributionAssetSet(address indexed asset);
event MembershipActivated(address indexed membership, string ipfsHash);
event MembershipTransferred(address indexed newMember, address indexed fromMembership, string ipfsHash);
event MembershipTerminated(address indexed membership, string ipfsHash);
event ContributionMade(address indexed member, uint256 amount);
event ApprovalForContribution(address indexed voter, address indexed operator, uint256 voterWeight, uint256 currentQuorum, uint256 requiredQuorum);
event PermissionGrantedToUseContribution(address indexed operator, uint256 amount, address indexed asset, uint256 achievedQuorum, uint256 requiredQuorum);
event ContributionDistributed(address indexed membership, uint256 amount);
event QuorumUpdated(uint256 oldQuorum, uint256 newQuorum);
```

### Membership Events

```solidity
event MembershipClaimed(address indexed claimant, bytes32 indexed emailHash);
event TokensWithdrawn(address indexed token, uint256 amount, address indexed recipient);
```

## 🔒 Security

### Security Features Implemented

✅ **Owner Control**: Ownable pattern for administrative functions
✅ **Reentrancy Guard**: Protection on all fund transfer functions
✅ **Pausable**: Emergency pause mechanism
✅ **Input Validation**: Comprehensive checks (zero addresses, minimum values)
✅ **Safe ERC20**: SafeERC20 library for secure token operations
✅ **EIP-712 Signatures**: Secure membership claiming
✅ **Individual Custody**: Each member has their own Membership contract
✅ **Auto-Approval**: Membership contracts auto-approve Stokvel (no user approval needed)
✅ **Event Logging**: Complete audit trail of all operations

### Security Considerations

1. **Admin Control**: The contract owner has significant control. Consider using a multisig wallet or DAO for production.
2. **IPFS Dependencies**: Membership agreements are stored on IPFS. Ensure IPFS hashes are pinned.
3. **Quorum Management**: Set appropriate quorum thresholds to prevent governance attacks.
4. **Email Privacy**: Emails are hashed, but ensure off-chain email handling is secure.
5. **Signature Security**: EIP-712 signatures must be generated securely and not reused.
6. **Distribution Math**: Uses proportional distribution to prevent rounding errors.
7. **Membership Termination**: Only allowed when contribution balance is zero.

### Reporting Security Issues

Found a vulnerability? Please report responsibly.

## 🧪 Testing

### Test Structure

```
tests/
├── membership-test.ts        # Membership contract tests
└── stokvel-onchain-test.ts  # StokvelOnChain contract tests
```

### Running Tests

```bash
# Install dependencies
npm install

# Run all tests
npx hardhat test

# Run specific test file
npx hardhat test test/membership-test.ts
npx hardhat test test/stokvel-onchain-test.ts

# Test coverage
npx hardhat coverage

```

## 🚢 Deployment

```bash
# set sepolia rpc endpoint
npx hardhat keystore set SEPOLIA_RPC_URL

# set private key with sepolia ETH for deployment
npx hardhat keystore set SEPOLIA_PRIVATE_KEY
```

### Hardhat ignition Deployment
[learn more about hardhat ignition](https://hardhat.org/ignition/docs/getting-started)

```javascript
import { buildModule } from "@nomicfoundation/hardhat-ignition/modules";
import { parseEther } from "ethers";

const StokvelOnchainModule = buildModule("StokvelOnchainModule", (m) => {
  const stokvelOnchain = m.contract("StokvelOnChain", [
    '/StokvelOnchain/stokvelOne',                 // stokvel uri
    parseEther('100'),                            // Qouram
    '0x7452210945903CA9D19AAC6EfC37C5dD7ce90d5a', // ERC20 token 
    '0xBd48b01f1B4CB5A7Fa329c48Cb2C3e75d8B75444'  // FACTORY contract
  ]);
  return { stokvelOnchain };
});
export default StokvelOnchainModule;
```

### Deploy Command

```bash
# Deploy factory to Sepolia testnet or skip and use already deploy factory
npx hardhat ignition deploy ./ignition/modules/MembershipFactory.ts --network sepolia  

# Deploy stokvel contract
npx hardhat ignition deploy ./ignition/modules/StokvelOnchain.ts --network sepolia
```

### Supported Networks

- **Development**: Hardhat Local, Ganache
- **Testnets**: Sepolia, Goerli, Mumbai (Polygon)
- **Mainnets**: Ethereum, Polygon, Optimism, Arbitrum, Base

## ⚡ Gas Optimization Tips

1. Use `calldata` for function parameters when possible (already implemented)
2. Batch operations using `batchDistributeContributionAsset`
3. Consider using events for historical data instead of storage
4. Optimize quorum calculations for large member counts
5. Individual Membership contracts reduce gas for single-member operations

## 🔄 Upgradeability

This contract is not upgradeable by design for security and transparency. To upgrade:

1. Deploy new StokvelOnChain version
2. Use `transferMembership` to migrate members
3. Use `distributeContributionAsset` to return assets
4. Deprecate old contract

## 📄 Example Workflow

### Scenario: Monthly Savings Club

```solidity
// 1. Deploy system
MembershipFactory factory = new MembershipFactory();
StokvelOnChain stokvel = new StokvelOnChain(
    "/StokvelOnchain/stokvelOne",
    10000 * 10**6,  // 10,000 USDC quorum
    USDC_ADDRESS,
    address(factory)
);

// 2. Add 10 members
for (uint i = 0; i < 10; i++) {
    stokvel.join(emails[i], memberAgreementHashes[i]);
}

// 3. Members claim their memberships
// (Each member signs and claims ownership of their Membership contract)

// 4. Members contribute monthly
// Member sends USDC to their Membership contract
USDC.transfer(membershipAddr, 100 * 10**6);
// Owner triggers contribution
stokvel.contribute(membershipAddr, 100 * 10**6);  // $100 USDC

// 5. After 12 months, vote to use funds for investment
for (uint i = 0; i < 10; i++) {
    stokvel.approveToUseContribution(memberWallets[i], investmentContract);
}

// 6. Grant permission to investment contract
stokvel.grantPermissionToUseContribution(
    investmentContract,
    12000 * 10**6  // $12,000 USDC
);

// 7. After investment period, distribute returns
address[] memory allMemberships = [membership1, ..., membership10];
stokvel.batchDistributeContributionAsset(allMemberships);

// 8. Members withdraw from their Membership contracts
membership.withdrawTo(USDC_ADDRESS, amount, memberWallet);
```

## 🤝 Contributing

Contributions are welcome! Here's how to contribute:

1. **Fork** the repository
2. **Create** a feature branch: `git checkout -b feature/AmazingFeature`
3. **Commit** your changes: `git commit -m 'Add AmazingFeature'`
4. **Push** to branch: `git push origin feature/AmazingFeature`
5. **Open** a Pull Request

### Development Guidelines

- Follow [Solidity Style Guide](https://docs.soliditylang.org/en/latest/style-guide.html)
- Write comprehensive tests for all new features
- Update documentation accordingly
- Ensure all tests pass: `npx hardhat test`
- Check for security issues: `npm run security-check`
- Optimize for gas efficiency

## 📄 License

This project is licensed under the MIT License - see the [LICENSE](LICENSE) file for details.

## 🙏 Acknowledgments

- **OpenZeppelin**: For security-audited contract libraries
- **Hardhat**: For the excellent development environment
- **Ethereum Community**: For innovation and robust community support



## ⚖️ Legal Disclaimer

**IMPORTANT**: This smart contract is provided "as is" without any warranties, express or implied. 

- Users are solely responsible for ensuring compliance with local laws and regulations
- Depending on your jurisdiction, this contract may be subject to securities laws
- The creators and contributors are not liable for any losses incurred
- Not financial advice - consult with legal and financial professionals
- Use at your own risk

Always consult with legal counsel before deploying or using this contract for real funds.

---

<div align="center">

**Built with ❤️ for the Web3 Community**

*Empowering communities through decentralized finance*

[Website](https://yourproject.com) • [Documentation](./docs) • [Twitter](https://twitter.com/yourproject) • [Discord](https://discord.gg/yourserver)

</div>