# Stokvel Investment Group Smart Contracts 🏦💰

## Two Versions Available!

This repository contains **TWO versions** of the Stokvel smart contract:

### 1️⃣ **ETH Version** (Original)
Uses native cryptocurrency (ETH, MATIC, etc.)

[View Contract](./StokvelInvestmentGroup.sol) | [Documentation](./USAGE_GUIDE.md)

### 2️⃣ **ERC20 Version** ⭐ RECOMMENDED
Uses stablecoins (USDC, DAI, USDT) or CBDCs

[View Contract](./StokvelInvestmentGroup_ERC20.sol) | [Documentation](./ERC20_USAGE_GUIDE.md)

---

## 🎯 Which Version Should I Use?

### Choose ERC20 Version (Stablecoins) If:
✅ You want **stable, predictable value** (no price volatility)  
✅ You need **regulatory compliance** or formal accounting  
✅ Members prefer **ZAR-denominated** investments  
✅ You're targeting **traditional savings groups**  
✅ You want **multi-chain deployment** (USDC on Ethereum, Polygon, Base, etc.)  
✅ You're considering **CBDC integration** for future

**Recommended For:**
- Community savings groups (stokvels, ROSCAs)
- Business investment pools
- Family investment circles
- International groups
- Regulated environments

**Best Tokens:**
- USDC (most popular, regulated, 6 decimals)
- DAI (decentralized, 18 decimals)
- USDT (highest liquidity, 6 decimals)

### Choose ETH Version If:
✅ Members are **crypto-native** and comfortable with volatility  
✅ You want **simplest possible implementation**  
✅ You believe in **ETH price appreciation**  
✅ You're investing in **DeFi protocols** or **NFTs**  
✅ You want **one-step contributions** (no token approval needed)

**Recommended For:**
- Crypto investment groups
- DeFi-focused pools
- NFT buying groups
- Blockchain enthusiasts

---

## 📊 Quick Comparison

| Feature | ETH Version | ERC20 Version |
|---------|-------------|---------------|
| **Contribution** | One step | Two steps (approve + contribute) |
| **Value Stability** | Volatile | Stable (with stablecoins) |
| **Accounting** | Wei/ETH | USD/Token units |
| **Gas Costs** | Lower | Slightly higher |
| **User-Friendly** | For crypto users | For everyone |
| **Regulatory** | Unclear | Better compliance |

**Full Comparison**: [VERSION_COMPARISON.md](./VERSION_COMPARISON.md)

---

## 🚀 Quick Start

### ERC20 Version (USDC Example)

```solidity
// 1. Deploy with USDC
StokvelInvestmentGroup stokvel = new StokvelInvestmentGroup(
    0xA0b86991c6218b36c1d19D4a2e9Eb0cE3606eB48,  // USDC on Ethereum
    "My Stokvel",
    "ipfs://metadata/",
    100 * 10**6,    // 100 USDC minimum (6 decimals)
    7 days,
    51              // 51% quorum
);

// 2. Members approve USDC
IERC20(USDC).approve(stokvelAddress, 1000 * 10**6);

// 3. Members contribute
stokvel.contribute(500 * 10**6);  // Contribute 500 USDC
```

### ETH Version

```solidity
// 1. Deploy
StokvelInvestmentGroup stokvel = new StokvelInvestmentGroup(
    "My Stokvel",
    "ipfs://metadata/",
    0.1 ether,     // 0.1 ETH minimum
    7 days,
    51
);

// 2. Members contribute directly
stokvel.contribute{value: 1 ether}();  // No approval needed!
```

---

## 📚 Documentation

### Core Documentation (Both Versions)
- **[README](./README.md)** - Main overview
- **[SECURITY_AUDIT](./SECURITY_AUDIT.md)** - Security analysis
- **[FRONTEND_INTEGRATION](./FrontendIntegration.jsx)** - React examples

### ETH Version
- **[USAGE_GUIDE](./USAGE_GUIDE.md)** - Complete guide
- **[CONTRACT](./StokvelInvestmentGroup.sol)** - Source code

### ERC20 Version  
- **[ERC20_USAGE_GUIDE](./ERC20_USAGE_GUIDE.md)** - Complete guide with token examples
- **[CONTRACT](./StokvelInvestmentGroup_ERC20.sol)** - Source code
- **[VERSION_COMPARISON](./VERSION_COMPARISON.md)** - Detailed comparison

---

## 🏗️ Features (Both Versions)

### 🤝 Democratic Governance
- Proposal-based decisions
- Weighted voting (shares = voting power)
- Add/remove members democratically
- Purchase/sell assets via voting

### 💎 ERC1155 Asset Management
- Each token ID = unique asset
- Real estate, stocks, crypto, businesses
- Fractional ownership
- Track asset values over time

### 💰 Financial Management
- Pool funds together
- Proportional shares
- Automatic profit distribution
- Minimum contribution requirements

### 🔐 Security
- OpenZeppelin contracts
- AccessControl (Admin/Member roles)
- ReentrancyGuard
- Pausable emergency stop
- Full event logging

---

## 🌍 Token Addresses (ERC20 Version)

### Ethereum Mainnet
```
USDC: 0xA0b86991c6218b36c1d19D4a2e9Eb0cE3606eB48 (6 decimals)
DAI:  0x6B175474E89094C44Da98b954EedeAC495271d0F (18 decimals)
USDT: 0xdAC17F958D2ee523a2206206994597C13D831ec7 (6 decimals)
```

### Polygon
```
USDC: 0x2791Bca1f2de4661ED88A30C99A7a9449Aa84174 (6 decimals)
DAI:  0x8f3Cf7ad23Cd3CaDbD9735AFf958023239c6A063 (18 decimals)
```

### Base
```
USDC: 0x833589fCD6eDb6E08f4c7C32D4f71b54bdA02913 (6 decimals)
```

**More addresses in**: [ERC20_USAGE_GUIDE.md](./ERC20_USAGE_GUIDE.md)

---

## 💡 Example Use Cases

### Traditional Savings Group (ERC20 + USDC)
```
- 10 friends contribute $100 USDC monthly
- Pool grows to $10,000 USDC
- Vote to invest in real estate
- Asset purchased, ERC1155 tokens distributed
- Property appreciates, group sells at profit
- Profits distributed proportionally in USDC
```

### Crypto Investment Group (ETH)
```
- 5 members contribute 2 ETH each = 10 ETH pool
- Vote to invest in DeFi yield farming
- Vote to buy NFT collection
- ETH appreciates 2x
- Distribute profits in ETH
```

---

## 🔒 Security Status

✅ **Code Complete** - Both versions fully implemented  
✅ **OpenZeppelin Libraries** - Battle-tested security  
✅ **Access Controls** - Role-based permissions  
✅ **Reentrancy Protection** - All transfers protected  
✅ **Event Logging** - Full audit trail  

⚠️ **Not Yet Audited** - Professional audit required before mainnet  
⚠️ **Test Thoroughly** - Deploy to testnet first  

---

## 📦 Installation

```bash
git clone https://github.com/yourusername/stokvel-onchain.git
cd stokvel-onchain
npm install

# Compile
npx hardhat compile

# Test
npx hardhat test

# Deploy (choose your version)
npx hardhat run scripts/deploy-erc20.js --network sepolia
```

---

## 🛠️ Development Tools

- **Solidity**: 0.8.20
- **OpenZeppelin**: Latest contracts
- **Hardhat**: Development environment
- **Ethers.js**: v6 for frontend
- **Testing**: 100% coverage goal

---

## 📈 Roadmap

### ✅ Phase 1 (Complete)
- [x] Core contract functionality
- [x] ETH version
- [x] ERC20 version
- [x] Democratic governance
- [x] ERC1155 assets
- [x] Security features

### 🚧 Phase 2 (In Progress)
- [ ] Professional security audit
- [ ] Testnet deployment
- [ ] Frontend dApp
- [ ] Documentation videos
- [ ] Community testing

### 📅 Phase 3 (Planned)
- [ ] Mainnet deployment
- [ ] Multi-token support (multiple ERC20s)
- [ ] DeFi integrations
- [ ] Mobile app
- [ ] CBDC integration

---

## 🤝 Contributing

Contributions welcome! Please:

1. Fork the repository
2. Create feature branch
3. Write tests
4. Submit pull request

---

## 📄 License

MIT License - See [LICENSE](./LICENSE)

---

## 🆘 Support

- **Issues**: [GitHub Issues](https://github.com/yourusername/stokvel-onchain/issues)
- **Docs**: See documentation folder
- **Email**: support@yourproject.com

---

## ⚖️ Legal Disclaimer

**IMPORTANT**: This smart contract may be subject to securities laws in your jurisdiction. Always consult legal counsel before deployment. Use at your own risk.

---

## 🌟 Why Stokvel on Blockchain?

Traditional stokvels have limitations:
- ❌ Lack of transparency
- ❌ Trust issues with treasurers
- ❌ Manual record keeping
- ❌ Difficult to enforce rules
- ❌ Limited to local members

Blockchain stokvels solve these:
- ✅ Full transparency
- ✅ Trustless - smart contract enforces rules
- ✅ Automatic record keeping
- ✅ Immutable audit trail
- ✅ Global membership possible
- ✅ Programmable governance

---

<div align="center">

**Built with ❤️ for communities worldwide**

*Bringing traditional savings groups into the future*

[Docs](./docs) • [ETH Version](./StokvelInvestmentGroup.sol) • [ERC20 Version](./StokvelInvestmentGroup_ERC20.sol)

</div>
