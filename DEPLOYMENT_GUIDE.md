# Stokvel Deployment Guide

## Prerequisites

- Node.js v16+ installed
- Hardhat or Foundry for deployment
- ETH for gas fees
- Wallet with deployment permissions
- OpenZeppelin contracts installed

## Installation

### Using Hardhat

```bash
npm install --save-dev hardhat @openzeppelin/contracts
npm install --save-dev @nomiclabs/hardhat-ethers ethers
```

### Using Foundry

```bash
forge install OpenZeppelin/openzeppelin-contracts
```

## Deployment Steps

### 1. Set Up Environment Variables

Create `.env` file:

```bash
# Network RPC URLs
MAINNET_RPC_URL=https://eth-mainnet.g.alchemy.com/v2/YOUR_KEY
SEPOLIA_RPC_URL=https://eth-sepolia.g.alchemy.com/v2/YOUR_KEY
POLYGON_RPC_URL=https://polygon-mainnet.g.alchemy.com/v2/YOUR_KEY

# Private Keys (NEVER commit these!)
DEPLOYER_PRIVATE_KEY=your_private_key_here
ADMIN_ADDRESS=0x...

# Etherscan API Keys
ETHERSCAN_API_KEY=your_etherscan_api_key
POLYGONSCAN_API_KEY=your_polygonscan_api_key

# Contract Parameters
STOKVEL_NAME="My Investment Stokvel"
MINIMUM_CONTRIBUTION=100000000000000000  # 0.1 ETH in wei
VOTING_PERIOD=604800  # 7 days in seconds
QUORUM_PERCENTAGE=51
METADATA_URI=ipfs://QmYourMetadataHashHere/
```

### 2. Configure Hardhat

`hardhat.config.js`:

```javascript
require("@nomiclabs/hardhat-ethers");
require("@nomiclabs/hardhat-etherscan");
require("dotenv").config();

module.exports = {
  solidity: {
    version: "0.8.20",
    settings: {
      optimizer: {
        enabled: true,
        runs: 200
      }
    }
  },
  networks: {
    hardhat: {
      chainId: 1337
    },
    sepolia: {
      url: process.env.SEPOLIA_RPC_URL,
      accounts: [process.env.DEPLOYER_PRIVATE_KEY],
      chainId: 11155111
    },
    mainnet: {
      url: process.env.MAINNET_RPC_URL,
      accounts: [process.env.DEPLOYER_PRIVATE_KEY],
      chainId: 1
    },
    polygon: {
      url: process.env.POLYGON_RPC_URL,
      accounts: [process.env.DEPLOYER_PRIVATE_KEY],
      chainId: 137
    }
  },
  etherscan: {
    apiKey: {
      mainnet: process.env.ETHERSCAN_API_KEY,
      sepolia: process.env.ETHERSCAN_API_KEY,
      polygon: process.env.POLYGONSCAN_API_KEY
    }
  }
};
```

### 3. Create Deployment Script

`scripts/deploy.js`:

```javascript
const hre = require("hardhat");

async function main() {
  console.log("Starting Stokvel deployment...");

  // Get deployment parameters from env
  const stokvelName = process.env.STOKVEL_NAME || "My Stokvel";
  const metadataURI = process.env.METADATA_URI || "ipfs://";
  const minimumContribution = process.env.MINIMUM_CONTRIBUTION || "100000000000000000"; // 0.1 ETH
  const votingPeriod = process.env.VOTING_PERIOD || "604800"; // 7 days
  const quorumPercentage = process.env.QUORUM_PERCENTAGE || "51";

  console.log("\nDeployment Parameters:");
  console.log("----------------------");
  console.log("Stokvel Name:", stokvelName);
  console.log("Metadata URI:", metadataURI);
  console.log("Minimum Contribution:", minimumContribution, "wei");
  console.log("Voting Period:", votingPeriod, "seconds");
  console.log("Quorum Percentage:", quorumPercentage, "%");

  // Get the contract factory
  const StokvelInvestmentGroup = await hre.ethers.getContractFactory(
    "StokvelInvestmentGroup"
  );

  // Deploy the contract
  console.log("\nDeploying contract...");
  const stokvel = await StokvelInvestmentGroup.deploy(
    stokvelName,
    metadataURI,
    minimumContribution,
    votingPeriod,
    quorumPercentage
  );

  await stokvel.deployed();

  console.log("\n✅ Stokvel deployed successfully!");
  console.log("Contract address:", stokvel.address);
  console.log("Transaction hash:", stokvel.deployTransaction.hash);

  // Wait for a few confirmations
  console.log("\nWaiting for confirmations...");
  await stokvel.deployTransaction.wait(5);
  
  console.log("✅ Confirmed!");

  // Verify contract on Etherscan (if not local)
  if (hre.network.name !== "hardhat" && hre.network.name !== "localhost") {
    console.log("\nVerifying contract on Etherscan...");
    try {
      await hre.run("verify:verify", {
        address: stokvel.address,
        constructorArguments: [
          stokvelName,
          metadataURI,
          minimumContribution,
          votingPeriod,
          quorumPercentage
        ],
      });
      console.log("✅ Contract verified!");
    } catch (error) {
      console.log("⚠️ Verification failed:", error.message);
    }
  }

  // Save deployment info
  const deploymentInfo = {
    network: hre.network.name,
    contractAddress: stokvel.address,
    deployer: await stokvel.signer.getAddress(),
    deploymentTime: new Date().toISOString(),
    constructorArgs: {
      stokvelName,
      metadataURI,
      minimumContribution,
      votingPeriod,
      quorumPercentage
    }
  };

  const fs = require("fs");
  fs.writeFileSync(
    `deployment-${hre.network.name}-${Date.now()}.json`,
    JSON.stringify(deploymentInfo, null, 2)
  );

  console.log("\n📝 Deployment info saved to deployment-*.json");
  
  // Display next steps
  console.log("\n📋 Next Steps:");
  console.log("1. Add members using proposeAddMember() or adminAddMember()");
  console.log("2. Members can start contributing using contribute()");
  console.log("3. Create proposals for asset purchases");
  console.log("4. Vote and execute proposals");
}

main()
  .then(() => process.exit(0))
  .catch((error) => {
    console.error(error);
    process.exit(1);
  });
```

### 4. Deploy to Network

```bash
# Deploy to local Hardhat network
npx hardhat run scripts/deploy.js --network hardhat

# Deploy to Sepolia testnet
npx hardhat run scripts/deploy.js --network sepolia

# Deploy to mainnet (CAREFUL!)
npx hardhat run scripts/deploy.js --network mainnet

# Deploy to Polygon
npx hardhat run scripts/deploy.js --network polygon
```

## Using Foundry

### Configure Foundry

`foundry.toml`:

```toml
[profile.default]
src = "src"
out = "out"
libs = ["lib"]
solc_version = "0.8.20"
optimizer = true
optimizer_runs = 200

[rpc_endpoints]
sepolia = "${SEPOLIA_RPC_URL}"
mainnet = "${MAINNET_RPC_URL}"
polygon = "${POLYGON_RPC_URL}"

[etherscan]
sepolia = { key = "${ETHERSCAN_API_KEY}" }
mainnet = { key = "${ETHERSCAN_API_KEY}" }
polygon = { key = "${POLYGONSCAN_API_KEY}" }
```

### Deploy with Foundry

```bash
# Deploy to Sepolia
forge create StokvelInvestmentGroup \
  --rpc-url $SEPOLIA_RPC_URL \
  --private-key $DEPLOYER_PRIVATE_KEY \
  --constructor-args \
    "My Stokvel" \
    "ipfs://metadata/" \
    100000000000000000 \
    604800 \
    51 \
  --verify \
  --etherscan-api-key $ETHERSCAN_API_KEY

# Or use forge script
forge script script/Deploy.s.sol:DeployStokvel \
  --rpc-url sepolia \
  --broadcast \
  --verify
```

`script/Deploy.s.sol`:

```solidity
// SPDX-License-Identifier: MIT
pragma solidity ^0.8.20;

import "forge-std/Script.sol";
import "../src/StokvelInvestmentGroup.sol";

contract DeployStokvel is Script {
    function run() external {
        uint256 deployerPrivateKey = vm.envUint("DEPLOYER_PRIVATE_KEY");
        
        vm.startBroadcast(deployerPrivateKey);

        StokvelInvestmentGroup stokvel = new StokvelInvestmentGroup(
            "My Investment Stokvel",
            "ipfs://QmYourHash/",
            0.1 ether,      // minimum contribution
            7 days,         // voting period
            51              // quorum percentage
        );

        console.log("Stokvel deployed at:", address(stokvel));

        vm.stopBroadcast();
    }
}
```

## Post-Deployment Setup

### 1. Add Initial Members

```javascript
// Using ethers.js
const contract = new ethers.Contract(address, ABI, signer);

// Admin can directly add members initially
await contract.adminAddMember("0xMemberAddress1");
await contract.adminAddMember("0xMemberAddress2");
await contract.adminAddMember("0xMemberAddress3");

// Or members can be added through proposals after initial setup
```

### 2. Set Up IPFS Metadata

Create `metadata.json`:

```json
{
  "name": "My Investment Stokvel",
  "description": "A decentralized investment group pooling resources",
  "image": "ipfs://QmImageHash",
  "external_url": "https://mystokvel.com",
  "attributes": [
    {
      "trait_type": "Type",
      "value": "Investment Group"
    },
    {
      "trait_type": "Founded",
      "value": "2024"
    }
  ]
}
```

Upload to IPFS and use the hash as metadata URI.

### 3. Configure Initial Parameters

```javascript
// Adjust parameters if needed
await contract.updateMinimumContribution(ethers.parseEther("0.05"));
await contract.updateVotingPeriod(3 * 24 * 60 * 60); // 3 days
await contract.updateQuorumPercentage(60); // 60% quorum
```

## Network-Specific Considerations

### Ethereum Mainnet
- **Gas costs**: High, optimize for minimal transactions
- **Finality**: ~15 seconds per block
- **Recommend**: Test thoroughly on Sepolia first

### Polygon
- **Gas costs**: Very low
- **Finality**: ~2 seconds per block
- **Recommend**: Good for frequent small transactions

### Optimism/Arbitrum (L2s)
- **Gas costs**: Low to medium
- **Finality**: Fast
- **Recommend**: Balance of cost and security

## Security Checklist

Before deploying to mainnet:

- [ ] Contract audited by professionals
- [ ] All unit tests passing (100% coverage)
- [ ] Integration tests completed
- [ ] Deployed and tested on testnet
- [ ] Access controls verified
- [ ] Reentrancy guards tested
- [ ] Pause mechanism tested
- [ ] Edge cases handled
- [ ] Gas optimization completed
- [ ] Admin keys secured (hardware wallet)
- [ ] Multi-sig wallet for admin role recommended
- [ ] Emergency procedures documented

## Monitoring & Maintenance

### Set Up Event Monitoring

```javascript
// Monitor important events
contract.on("MemberAdded", (member, timestamp) => {
  // Send notification
  // Update database
});

contract.on("AssetPurchased", (assetId, name, price) => {
  // Update portfolio tracking
  // Notify members
});

contract.on("ProposalCreated", (proposalId, type, description) => {
  // Alert members to vote
});
```

### Regular Maintenance Tasks

1. **Weekly**: Review pending proposals
2. **Monthly**: Update asset values
3. **Quarterly**: Distribute accumulated profits
4. **Yearly**: Audit member activity

## Upgrade Path

If you need to upgrade:

1. Deploy new contract version
2. Pause old contract
3. Snapshot all member data
4. Migrate members to new contract
5. Transfer asset ownership
6. Update frontend to new contract address

## Cost Estimates

### Deployment Costs (approximate)

| Network | Gas Price | Deployment Cost |
|---------|-----------|-----------------|
| Mainnet | 30 gwei | ~0.5-1 ETH |
| Polygon | 50 gwei | ~1-5 MATIC |
| Optimism | 0.001 gwei | ~0.001 ETH |

### Operation Costs

| Operation | Mainnet (30 gwei) | Polygon (50 gwei) |
|-----------|-------------------|-------------------|
| Contribute | ~$10-20 | ~$0.01-0.05 |
| Create Proposal | ~$15-30 | ~$0.02-0.10 |
| Vote | ~$5-10 | ~$0.01-0.02 |
| Execute Proposal | ~$20-50 | ~$0.05-0.20 |

## Troubleshooting

### Deployment Fails

1. Check gas price and limit
2. Verify constructor arguments
3. Ensure sufficient ETH in deployer wallet
4. Check contract size (<24KB)

### Verification Fails

1. Ensure exact constructor args match
2. Check Solidity version matches
3. Verify optimizer settings
4. Try manual verification on Etherscan

### High Gas Costs

1. Optimize loop iterations
2. Batch operations where possible
3. Consider L2 deployment
4. Review storage patterns

## Support Resources

- **Hardhat Docs**: https://hardhat.org/docs
- **Foundry Docs**: https://book.getfoundry.sh/
- **OpenZeppelin**: https://docs.openzeppelin.com/
- **Ethereum Gas Tracker**: https://etherscan.io/gastracker

---

**Remember**: Always test on testnets before mainnet deployment!
