# Stokvel ERC20 Version - Usage Guide for Stablecoins & CBDCs

## Overview

This is the **ERC20-based version** of the Stokvel Investment Group contract. Instead of using native ETH, this version uses **ERC20 tokens** such as:

- **Stablecoins**: USDC, USDT, DAI, BUSD
- **CBDCs**: Central Bank Digital Currencies
- **Any ERC20 token**: Custom tokens, governance tokens, etc.

## Key Differences from ETH Version

### ✅ What Changed

1. **Payment Token**: Uses ERC20 instead of native ETH
2. **Approvals Required**: Members must approve tokens before contributing
3. **Token Decimals**: Automatically detects token decimals (6 for USDC, 18 for DAI)
4. **SafeERC20**: Uses OpenZeppelin's SafeERC20 for secure transfers
5. **No `msg.value`**: Contributions use `transferFrom` instead

### 🔄 What Stayed the Same

- ERC1155 asset representation
- Democratic governance & voting
- Member management
- All security features (AccessControl, ReentrancyGuard, Pausable)

## Deployment

### Example 1: Deploy with USDC (Ethereum Mainnet)

```solidity
// USDC on Ethereum Mainnet: 0xA0b86991c6218b36c1d19D4a2e9Eb0cE3606eB48
// USDC has 6 decimals

StokvelInvestmentGroup stokvel = new StokvelInvestmentGroup(
    0xA0b86991c6218b36c1d19D4a2e9Eb0cE3606eB48,  // USDC address
    "USDC Investment Stokvel",                     // Name
    "ipfs://metadata/",                            // Metadata URI
    100 * 10**6,                                   // Min: 100 USDC (6 decimals)
    7 days,                                        // Voting period
    51                                             // Quorum: 51%
);
```

### Example 2: Deploy with DAI (Ethereum Mainnet)

```solidity
// DAI on Ethereum Mainnet: 0x6B175474E89094C44Da98b954EedeAC495271d0F
// DAI has 18 decimals

StokvelInvestmentGroup stokvel = new StokvelInvestmentGroup(
    0x6B175474E89094C44Da98b954EedeAC495271d0F,  // DAI address
    "DAI Investment Stokvel",                     // Name
    "ipfs://metadata/",                            // Metadata URI
    100 * 10**18,                                  // Min: 100 DAI (18 decimals)
    7 days,                                        // Voting period
    51                                             // Quorum: 51%
);
```

### Example 3: Deploy with USDC (Polygon)

```solidity
// USDC on Polygon: 0x2791Bca1f2de4661ED88A30C99A7a9449Aa84174

StokvelInvestmentGroup stokvel = new StokvelInvestmentGroup(
    0x2791Bca1f2de4661ED88A30C99A7a9449Aa84174,  // USDC on Polygon
    "Polygon USDC Stokvel",
    "ipfs://metadata/",
    50 * 10**6,  // Min: 50 USDC (lower gas = lower minimum)
    7 days,
    51
);
```

## Token Addresses

### Ethereum Mainnet
```
USDC:  0xA0b86991c6218b36c1d19D4a2e9Eb0cE3606eB48  (6 decimals)
USDT:  0xdAC17F958D2ee523a2206206994597C13D831ec7  (6 decimals)
DAI:   0x6B175474E89094C44Da98b954EedeAC495271d0F  (18 decimals)
BUSD:  0x4Fabb145d64652a948d72533023f6E7A623C7C53  (18 decimals)
```

### Polygon
```
USDC:  0x2791Bca1f2de4661ED88A30C99A7a9449Aa84174  (6 decimals)
USDT:  0xc2132D05D31c914a87C6611C10748AEb04B58e8F  (6 decimals)
DAI:   0x8f3Cf7ad23Cd3CaDbD9735AFf958023239c6A063  (18 decimals)
```

### Testnet (Sepolia)
```
USDC:  0x1c7D4B196Cb0C7B01d743Fbc6116a902379C7238  (6 decimals)
DAI:   0x68194a729C2450ad26072b3D33ADaCbcef39D574  (18 decimals)
```

## Usage Flow

### Step 1: Member Approves Tokens

**CRITICAL**: Before contributing, members MUST approve the Stokvel contract to spend their tokens!

```javascript
// Using ethers.js v6

// For USDC (6 decimals) - Approve 1000 USDC
const usdcContract = new ethers.Contract(
    USDC_ADDRESS,
    ['function approve(address spender, uint256 amount) returns (bool)'],
    signer
);

const amount = 1000 * 10**6; // 1000 USDC
await usdcContract.approve(STOKVEL_ADDRESS, amount);

// For DAI (18 decimals) - Approve 1000 DAI
const daiContract = new ethers.Contract(
    DAI_ADDRESS,
    ['function approve(address spender, uint256 amount) returns (bool)'],
    signer
);

const amountDAI = ethers.parseEther("1000"); // 1000 DAI
await daiContract.approve(STOKVEL_ADDRESS, amountDAI);
```

```solidity
// Using Solidity directly
IERC20(USDC_ADDRESS).approve(STOKVEL_ADDRESS, 1000 * 10**6);
```

### Step 2: Contribute Tokens

After approval, contribute to the Stokvel:

```javascript
// Contribute 500 USDC
const stokvelContract = new ethers.Contract(STOKVEL_ADDRESS, ABI, signer);
await stokvelContract.contribute(500 * 10**6);

// Contribute 500 DAI
await stokvelContract.contribute(ethers.parseEther("500"));
```

### Step 3: Create Asset Purchase Proposal

```javascript
// Propose to buy asset worth 2000 USDC
const proposalId = await stokvelContract.proposeBuyAsset(
    2000 * 10**6,                    // 2000 USDC
    "Commercial Property",
    "Downtown office space investment"
);
```

### Step 4: Vote & Execute

Same as ETH version - voting and execution work identically!

```javascript
// Vote
await stokvelContract.vote(proposalId, true);

// Execute after voting period
await stokvelContract.executeProposal(
    proposalId,
    "Commercial Property",
    "Real Estate",
    "ipfs://asset-metadata/"
);
```

## Common Token Operations

### Check Token Balance

```javascript
// Check member's USDC balance
const usdcBalance = await usdcContract.balanceOf(memberAddress);
console.log(`Balance: ${usdcBalance / 10**6} USDC`);

// Check contract's USDC balance
const contractBalance = await stokvelContract.getContractBalance();
console.log(`Stokvel has: ${contractBalance / 10**6} USDC`);
```

### Check Allowance

```javascript
// Check how much the Stokvel can spend on behalf of member
const allowance = await usdcContract.allowance(memberAddress, STOKVEL_ADDRESS);
console.log(`Allowance: ${allowance / 10**6} USDC`);

// If allowance is insufficient, approve more
if (allowance < contributionAmount) {
    await usdcContract.approve(STOKVEL_ADDRESS, contributionAmount);
}
```

### Get Payment Token Info

```javascript
// Get info about the token being used
const [tokenAddress, decimals, balance] = await stokvelContract.getPaymentTokenInfo();
console.log(`Token: ${tokenAddress}`);
console.log(`Decimals: ${decimals}`);
console.log(`Contract Balance: ${balance / 10**decimals}`);
```

## Working with Different Decimal Places

Different tokens have different decimal places. Handle them correctly:

```javascript
// Helper function to handle any token
function formatTokenAmount(amount, decimals) {
    return amount / (10 ** decimals);
}

function parseTokenAmount(amount, decimals) {
    return amount * (10 ** decimals);
}

// Examples
console.log(formatTokenAmount(1000000, 6));  // "1" (USDC)
console.log(formatTokenAmount(1000000000000000000n, 18)); // "1" (DAI)

console.log(parseTokenAmount(100, 6));   // 100000000 (100 USDC)
console.log(parseTokenAmount(100, 18));  // 100000000000000000000 (100 DAI)
```

## Frontend Integration (React Example)

```javascript
import { useState, useEffect } from 'react';
import { ethers } from 'ethers';

function StokvelContribute({ stokvelAddress, tokenAddress, tokenDecimals }) {
    const [amount, setAmount] = useState('');
    const [allowance, setAllowance] = useState('0');
    const [balance, setBalance] = useState('0');

    const checkAllowance = async () => {
        const provider = new ethers.BrowserProvider(window.ethereum);
        const signer = await provider.getSigner();
        const address = await signer.getAddress();
        
        const tokenContract = new ethers.Contract(
            tokenAddress,
            ['function allowance(address,address) view returns (uint256)'],
            provider
        );
        
        const allowanceAmount = await tokenContract.allowance(address, stokvelAddress);
        setAllowance(ethers.formatUnits(allowanceAmount, tokenDecimals));
    };

    const approveTokens = async () => {
        const provider = new ethers.BrowserProvider(window.ethereum);
        const signer = await provider.getSigner();
        
        const tokenContract = new ethers.Contract(
            tokenAddress,
            ['function approve(address,uint256) returns (bool)'],
            signer
        );
        
        const amountToApprove = ethers.parseUnits(amount, tokenDecimals);
        const tx = await tokenContract.approve(stokvelAddress, amountToApprove);
        await tx.wait();
        
        alert('Tokens approved!');
        checkAllowance();
    };

    const contribute = async () => {
        const provider = new ethers.BrowserProvider(window.ethereum);
        const signer = await provider.getSigner();
        
        const stokvelContract = new ethers.Contract(
            stokvelAddress,
            ['function contribute(uint256)'],
            signer
        );
        
        const contributionAmount = ethers.parseUnits(amount, tokenDecimals);
        const tx = await stokvelContract.contribute(contributionAmount);
        await tx.wait();
        
        alert('Contribution successful!');
    };

    return (
        <div>
            <h3>Contribute to Stokvel</h3>
            <p>Current Allowance: {allowance} tokens</p>
            
            <input 
                type="number" 
                value={amount}
                onChange={(e) => setAmount(e.target.value)}
                placeholder="Amount"
            />
            
            {parseFloat(allowance) < parseFloat(amount) ? (
                <button onClick={approveTokens}>
                    1. Approve Tokens
                </button>
            ) : (
                <button onClick={contribute}>
                    2. Contribute
                </button>
            )}
        </div>
    );
}
```

## Profit Distribution

When profits are distributed, members receive tokens (not ETH):

```javascript
// Admin distributes all profits
await stokvelContract.distributeProfits();

// Members receive USDC/DAI/etc. directly to their wallets
// No need to claim - it's pushed to them automatically
```

## Best Practices

### 1. Approve Sufficient Amount

```javascript
// Option A: Approve exact amount each time
await tokenContract.approve(stokvelAddress, contributionAmount);

// Option B: Approve large amount once (be careful!)
const MAX_UINT256 = ethers.MaxUint256;
await tokenContract.approve(stokvelAddress, MAX_UINT256);
```

### 2. Check Balances Before Contributing

```javascript
const memberBalance = await tokenContract.balanceOf(memberAddress);
if (memberBalance < contributionAmount) {
    alert("Insufficient token balance!");
    return;
}
```

### 3. Handle Decimals Correctly

```javascript
// ALWAYS use the correct decimals
// USDC/USDT: 6 decimals
// DAI/BUSD: 18 decimals

const amount = 100; // 100 tokens
const amountWithDecimals = amount * 10 ** tokenDecimals;
```

### 4. Monitor Allowances

```javascript
// Periodically check if allowance needs to be refreshed
const currentAllowance = await tokenContract.allowance(member, stokvel);
if (currentAllowance < nextContribution) {
    // Request new approval
}
```

## Security Considerations

### ✅ Advantages of ERC20 Tokens

1. **Stable Value**: Stablecoins maintain value (no volatility)
2. **Price Predictability**: Know exact value of investments
3. **Easier Accounting**: Fixed denominations
4. **Regulatory Compliance**: Some stablecoins are regulated
5. **Global Access**: Available on many chains

### ⚠️ Risks

1. **Token Contract Risk**: Underlying token could have bugs
2. **Approval Risk**: Malicious contracts could drain approved tokens
3. **Stablecoin Risk**: Depegging, centralization, censorship
4. **Smart Contract Risk**: Always audit Stokvel contract

### 🛡️ Mitigations

1. Use well-established tokens (USDC, DAI)
2. Approve only what you need
3. Regular security audits
4. Multi-sig admin wallets
5. Monitor token contract upgrades

## Comparison: ETH vs ERC20 Version

| Feature | ETH Version | ERC20 Version |
|---------|-------------|---------------|
| **Payment** | Native ETH | USDC/DAI/etc. |
| **Approval** | Not needed | Required before contribution |
| **Value Stability** | Volatile | Stable (if using stablecoins) |
| **Gas Costs** | Medium | Slightly higher (extra transfer) |
| **Accounting** | In wei | In token units |
| **Cross-chain** | Limited | Easier (stablecoins on many chains) |
| **Regulations** | Less clear | Better for compliance |

## Example Deployment Script

```javascript
const { ethers } = require("hardhat");

async function main() {
    // Token addresses
    const USDC_MAINNET = "0xA0b86991c6218b36c1d19D4a2e9Eb0cE3606eB48";
    const USDC_POLYGON = "0x2791Bca1f2de4661ED88A30C99A7a9449Aa84174";
    
    const StokvelInvestmentGroup = await ethers.getContractFactory(
        "StokvelInvestmentGroup"
    );
    
    const stokvel = await StokvelInvestmentGroup.deploy(
        USDC_MAINNET,              // Payment token
        "USDC Stokvel",            // Name
        "ipfs://metadata/",        // URI
        100 * 10**6,               // 100 USDC minimum
        7 * 24 * 60 * 60,         // 7 days
        51                         // 51% quorum
    );
    
    await stokvel.deployed();
    console.log("Stokvel deployed to:", stokvel.address);
    console.log("Using token:", USDC_MAINNET);
}

main()
    .then(() => process.exit(0))
    .catch((error) => {
        console.error(error);
        process.exit(1);
    });
```

## Testing with Mock Tokens

For testing, create a mock ERC20:

```solidity
// MockUSDC.sol
pragma solidity ^0.8.20;

import "@openzeppelin/contracts/token/ERC20/ERC20.sol";

contract MockUSDC is ERC20 {
    constructor() ERC20("Mock USDC", "mUSDC") {
        _mint(msg.sender, 1000000 * 10**6); // 1M USDC
    }
    
    function decimals() public pure override returns (uint8) {
        return 6;
    }
    
    function mint(address to, uint256 amount) public {
        _mint(to, amount);
    }
}
```

## FAQ

**Q: Can I change the payment token after deployment?**
A: No, the payment token is immutable. Deploy a new contract for different tokens.

**Q: What if the token doesn't have a `decimals()` function?**
A: The contract defaults to 18 decimals if detection fails.

**Q: Can members contribute different ERC20 tokens?**
A: No, all members must use the same token specified at deployment.

**Q: How do I migrate from ETH to ERC20 version?**
A: Deploy new ERC20 version, snapshot balances, and redistribute accordingly.

**Q: What about tokens with transfer fees (like some meme coins)?**
A: Not recommended. Use standard tokens without transfer fees.

---

**Ready to deploy your ERC20-based Stokvel!** 🚀

For more help, see the main [USAGE_GUIDE.md](./USAGE_GUIDE.md)
