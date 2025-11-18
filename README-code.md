# StokvelOnChain Smart Contract

A decentralized stokvel (savings club) smart contract built on Ethereum using Solidity. This contract enables group savings with on-chain governance, membership management, and proportional distribution mechanisms.

## Features

### Core Functionality
- **ERC1155 Multi-Token Standard**: Support for multiple asset types within the stokvel
- **Membership Management**: On-chain membership with IPFS-backed agreements
- **Contribution Tracking**: Token ID 1 represents contribution shares
- **Quorum-Based Governance**: Democratic decision-making for fund usage
- **Proportional Distribution**: Fair distribution based on contribution amounts

### Security Features
- **ReentrancyGuard**: Protection against reentrancy attacks
- **Pausable**: Emergency stop mechanism
- **Ownable**: Admin access control
- **SafeERC20**: Safe token transfer operations

## Contract Architecture

### Token ID Structure
- **Token ID 1**: Reserved for contribution shares (mandatory)
- **Token ID 2+**: Can be used for other stokvel assets (optional)

### Membership States
```solidity
enum MOUType {
    ACTIVE,      // Member is currently active
    TRANSFERRED, // Membership transferred to another address
    TERMINATED   // Membership has been terminated
}
```

## Installation

### Prerequisites
- Node.js v16+
- Hardhat or Foundry
- OpenZeppelin Contracts v5.0+

### Setup
```bash
npm install --save-dev hardhat
npm install @openzeppelin/contracts
```

### Dependencies
```json
{
  "@openzeppelin/contracts": "^5.0.0"
}
```

## Usage

### 1. Deployment
```solidity
// Deploy with metadata URI and initial quorum
StokvelOnChain stokvel = new StokvelOnChain(
    "https://ipfs.io/ipfs/{id}.json",  // Metadata URI
    1000 * 10**18                       // Quorum: 1000 tokens
);
```

### 2. Set Contribution Asset
```solidity
// Set the ERC20 token used for contributions
stokvel.setContributionERC20(usdcTokenAddress);
```

### 3. Member Management

#### Add New Member
```solidity
stokvel.join(
    memberAddress,
    "QmX7y8...IPFS_HASH"  // IPFS hash of membership agreement
);
```

#### Transfer Membership
```solidity
stokvel.transferMembership(
    newMemberAddress,
    oldMemberAddress,
    "QmY8z9...IPFS_HASH"  // IPFS hash of transfer agreement
);
```

#### Terminate Membership
```solidity
stokvel.terminateMembership(
    memberAddress,
    "QmZ9a0...IPFS_HASH"  // IPFS hash of termination agreement
);
```

### 4. Making Contributions
```solidity
// Member must first approve the stokvel contract
contributionToken.approve(stokvelAddress, amount);

// Then contribute
stokvel.contribute(amount);
```

### 5. Governance Process

#### Step 1: Members Vote
```solidity
// Admin records each member's vote
stokvel.approveToUseContribution(voterAddress, operatorAddress);
```

#### Step 2: Grant Permission
```solidity
// Once quorum is reached, admin grants permission
stokvel.grantPermissionToUseContribution(operatorAddress, amount);
```

### 6. Distribution

#### Single Member Distribution
```solidity
stokvel.distributeContributionAsset(memberAddress);
```

#### Batch Distribution
```solidity
address[] memory members = [member1, member2, member3];
stokvel.batchDistributeContributionAsset(members);
```

## Contract Functions

### Admin Functions
| Function | Description |
|----------|-------------|
| `setContributionERC20(address)` | Set the ERC20 token for contributions |
| `setStokvelQuorum(uint256)` | Update quorum requirement |
| `pause()` | Pause all contract operations |
| `unpause()` | Resume contract operations |
| `join(address, string)` | Add new member |
| `transferMembership(address, address, string)` | Transfer membership |
| `terminateMembership(address, string)` | Terminate membership |

### Member Functions
| Function | Description |
|----------|-------------|
| `contribute(uint256)` | Make contribution to stokvel |

### Governance Functions
| Function | Description |
|----------|-------------|
| `approveToUseContribution(address, address)` | Record member's vote |
| `grantPermissionToUseContribution(address, uint256)` | Grant permission after quorum |
| `resetQuorum(address)` | Reset operator's quorum |

### Distribution Functions
| Function | Description |
|----------|-------------|
| `distributeContributionAsset(address)` | Distribute to single member |
| `batchDistributeContributionAsset(address[])` | Distribute to multiple members |

### View Functions
| Function | Description |
|----------|-------------|
| `getMember(address)` | Get member information |
| `isActiveMember(address)` | Check if address is active member |
| `getQuorum(address)` | Get operator's current quorum |
| `getContributionBalance(address)` | Get member's contribution balance |
| `getTotalContributions()` | Get total contributions in stokvel |
| `getContributionAssetBalance()` | Get contract's asset balance |

## Events

```solidity
event ContributionAssetSet(address indexed asset);
event MembershipActivated(address indexed member, string ipfsHash);
event MembershipTransferred(address indexed newMember, address indexed fromMember, string ipfsHash);
event MembershipTerminated(address indexed member, string ipfsHash);
event ContributionMade(address indexed member, uint256 amount);
event ApprovalForContribution(address indexed voter, address indexed operator, uint256 voterWeight, uint256 currentQuorum, uint256 requiredQuorum);
event PermissionGrantedToUseContribution(address indexed operator, uint256 amount, address indexed asset, uint256 achievedQuorum, uint256 requiredQuorum);
event ContributionDistributed(address indexed member, uint256 amount);
event QuorumUpdated(uint256 oldQuorum, uint256 newQuorum);
```

## Example Workflow

### Scenario: Monthly Savings Club

```solidity
// 1. Deploy stokvel
StokvelOnChain stokvel = new StokvelOnChain(
    "ipfs://metadata/",
    10000 * 10**6  // 10,000 USDC quorum
);

// 2. Set USDC as contribution asset
stokvel.setContributionERC20(USDC_ADDRESS);

// 3. Add 10 members
for (uint i = 0; i < 10; i++) {
    stokvel.join(members[i], memberAgreementHashes[i]);
}

// 4. Members contribute monthly
// Each member approves and contributes
USDC.approve(address(stokvel), 100 * 10**6);
stokvel.contribute(100 * 10**6);  // $100 USDC

// 5. After 12 months, vote to use funds for investment
for (uint i = 0; i < 10; i++) {
    stokvel.approveToUseContribution(members[i], investmentContract);
}

// 6. Grant permission to investment contract
stokvel.grantPermissionToUseContribution(
    investmentContract,
    12000 * 10**6  // $12,000 USDC
);

// 7. After investment period, distribute returns
address[] memory allMembers = [member1, member2, ..., member10];
stokvel.batchDistributeContributionAsset(allMembers);
```

## Security Considerations

1. **Admin Control**: The contract owner has significant control. Consider using a multisig wallet or DAO for production.
2. **IPFS Dependencies**: Membership agreements are stored on IPFS. Ensure IPFS hashes are pinned.
3. **Quorum Management**: Set appropriate quorum thresholds to prevent governance attacks.
4. **Token Approvals**: The contract never requests unlimited approvals.
5. **Distribution Math**: Uses proportional distribution to prevent rounding errors.

## Testing

35090 bytes and exceeds 24576 bytes

```bash
# Install dependencies
npm install

# Run tests
npx hardhat test

# Test coverage
npx hardhat coverage
```

## Deployment

### Hardhat Deployment Script
```javascript
const hre = require("hardhat");

async function main() {
  const StokvelOnChain = await hre.ethers.getContractFactory("StokvelOnChain");
  const stokvel = await StokvelOnChain.deploy(
    "https://ipfs.io/ipfs/{id}.json",
    ethers.parseUnits("1000", 18)
  );

  await stokvel.waitForDeployment();
  console.log("StokvelOnChain deployed to:", await stokvel.getAddress());
}

main().catch((error) => {
  console.error(error);
  process.exitCode = 1;
});
```

### Deploy Command
```bash
npx hardhat run scripts/deploy.js --network sepolia
```

## Gas Optimization Tips

1. Use `calldata` for function parameters when possible (already implemented)
2. Batch operations using `batchDistributeContributionAsset`
3. Consider using events for historical data instead of storage
4. Optimize quorum calculations for large member counts

## Upgradeability

This contract is not upgradeable by design for security and transparency. To upgrade:
1. Deploy new contract version
2. Transfer memberships using `transferMembership`
3. Distribute assets using `distributeContributionAsset`
4. Deprecate old contract

## Contributing

Contributions are welcome! Please follow these guidelines:
1. Fork the repository
2. Create a feature branch
3. Add tests for new functionality
4. Submit a pull request

## License

MIT License

## Support

For questions or issues:
- Open an issue on GitHub
- Review the inline documentation in the contract
- Check OpenZeppelin documentation for inherited contracts

## Acknowledgments

- Built with [OpenZeppelin Contracts](https://docs.openzeppelin.com/contracts/)
- ERC1155 Standard: [EIP-1155](https://eips.ethereum.org/EIPS/eip-1155)
- Inspired by traditional stokvel savings clubs

---

**⚠️ Disclaimer**: This contract is provided as-is. Conduct thorough audits before using in production with real funds.
