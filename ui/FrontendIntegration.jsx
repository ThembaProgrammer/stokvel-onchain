// Frontend Integration Example for Stokvel Contract
// Using React + ethers.js v6

import { useState, useEffect } from 'react';
import { ethers } from 'ethers';

// Contract ABI (simplified - import full ABI in production)
const STOKVEL_ABI = [
  "function contribute() external payable",
  "function proposeBuyAsset(uint256 _price, string _name, string _description) external returns (uint256)",
  "function vote(uint256 _proposalId, bool _support) external",
  "function executeProposal(uint256 _proposalId, string _assetName, string _assetType, string _metadataURI) external",
  "function getMember(address _member) external view returns (uint256, uint256, uint256, uint256, bool)",
  "function getProposal(uint256 _proposalId) external view returns (uint256, string, uint8, address, uint256, uint256, uint256, uint256, uint256, bool)",
  "function getActiveMembers() external view returns (address[])",
  "function getActiveAssets() external view returns (uint256[])",
  "function getAsset(uint256 _assetId) external view returns (tuple(uint256,string,string,uint256,uint256,uint256,bool,string))",
  "function getTotalPortfolioValue() external view returns (uint256)",
  "function balanceOf(address account, uint256 id) external view returns (uint256)",
  "event MemberAdded(address indexed member, uint256 timestamp)",
  "event ContributionMade(address indexed member, uint256 amount, uint256 sharesIssued)",
  "event AssetPurchased(uint256 indexed assetId, string assetName, uint256 price)",
  "event ProposalCreated(uint256 indexed proposalId, uint8 proposalType, string description)",
  "event VoteCast(uint256 indexed proposalId, address indexed voter, bool support, uint256 weight)"
];

// Contract address (replace with your deployed address)
const STOKVEL_ADDRESS = "0x...";

// ==========================
// 1. WALLET CONNECTION HOOK
// ==========================

export function useWallet() {
  const [account, setAccount] = useState(null);
  const [provider, setProvider] = useState(null);
  const [signer, setSigner] = useState(null);
  const [connected, setConnected] = useState(false);

  const connectWallet = async () => {
    try {
      if (!window.ethereum) {
        alert("Please install MetaMask!");
        return;
      }

      const provider = new ethers.BrowserProvider(window.ethereum);
      const accounts = await provider.send("eth_requestAccounts", []);
      const signer = await provider.getSigner();

      setProvider(provider);
      setSigner(signer);
      setAccount(accounts[0]);
      setConnected(true);

      console.log("Connected:", accounts[0]);
    } catch (error) {
      console.error("Connection failed:", error);
    }
  };

  const disconnectWallet = () => {
    setAccount(null);
    setProvider(null);
    setSigner(null);
    setConnected(false);
  };

  // Listen for account changes
  useEffect(() => {
    if (window.ethereum) {
      window.ethereum.on('accountsChanged', (accounts) => {
        if (accounts.length > 0) {
          setAccount(accounts[0]);
        } else {
          disconnectWallet();
        }
      });
    }
  }, []);

  return { account, provider, signer, connected, connectWallet, disconnectWallet };
}

// ==========================
// 2. STOKVEL CONTRACT HOOK
// ==========================

export function useStokvel(signer) {
  const [contract, setContract] = useState(null);

  useEffect(() => {
    if (signer) {
      const stokvelContract = new ethers.Contract(
        STOKVEL_ADDRESS,
        STOKVEL_ABI,
        signer
      );
      setContract(stokvelContract);
    }
  }, [signer]);

  return contract;
}

// ==========================
// 3. MEMBER DATA HOOK
// ==========================

export function useMemberData(contract, account) {
  const [memberData, setMemberData] = useState(null);
  const [loading, setLoading] = useState(false);

  const fetchMemberData = async () => {
    if (!contract || !account) return;

    try {
      setLoading(true);
      const [contributions, shares, percentage, joinedAt, isActive] = 
        await contract.getMember(account);

      setMemberData({
        contributions: ethers.formatEther(contributions),
        shares: shares.toString(),
        percentage: (Number(percentage) / 100).toFixed(2), // Convert basis points
        joinedAt: new Date(Number(joinedAt) * 1000),
        isActive
      });
    } catch (error) {
      console.error("Failed to fetch member data:", error);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    fetchMemberData();
  }, [contract, account]);

  return { memberData, loading, refetch: fetchMemberData };
}

// ==========================
// 4. CONTRIBUTION COMPONENT
// ==========================

export function ContributeSection({ contract }) {
  const [amount, setAmount] = useState("");
  const [loading, setLoading] = useState(false);

  const handleContribute = async () => {
    if (!contract || !amount) return;

    try {
      setLoading(true);
      const tx = await contract.contribute({
        value: ethers.parseEther(amount)
      });
      
      console.log("Transaction sent:", tx.hash);
      await tx.wait();
      console.log("Contribution successful!");
      
      alert(`Successfully contributed ${amount} ETH!`);
      setAmount("");
    } catch (error) {
      console.error("Contribution failed:", error);
      alert("Contribution failed: " + error.message);
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="contribute-section">
      <h3>Make a Contribution</h3>
      <input
        type="number"
        step="0.01"
        placeholder="Amount in ETH"
        value={amount}
        onChange={(e) => setAmount(e.target.value)}
        disabled={loading}
      />
      <button onClick={handleContribute} disabled={loading || !amount}>
        {loading ? "Processing..." : "Contribute"}
      </button>
    </div>
  );
}

// ==========================
// 5. PROPOSAL CREATION
// ==========================

export function CreateProposal({ contract }) {
  const [formData, setFormData] = useState({
    assetName: "",
    description: "",
    price: ""
  });
  const [loading, setLoading] = useState(false);

  const handleSubmit = async (e) => {
    e.preventDefault();
    if (!contract) return;

    try {
      setLoading(true);
      const tx = await contract.proposeBuyAsset(
        ethers.parseEther(formData.price),
        formData.assetName,
        formData.description
      );

      console.log("Proposal transaction:", tx.hash);
      const receipt = await tx.wait();
      
      // Extract proposal ID from events
      const event = receipt.logs.find(
        log => log.topics[0] === ethers.id("ProposalCreated(uint256,uint8,string)")
      );
      
      alert("Proposal created successfully!");
      setFormData({ assetName: "", description: "", price: "" });
    } catch (error) {
      console.error("Proposal creation failed:", error);
      alert("Failed to create proposal: " + error.message);
    } finally {
      setLoading(false);
    }
  };

  return (
    <form onSubmit={handleSubmit} className="create-proposal">
      <h3>Propose Asset Purchase</h3>
      <input
        type="text"
        placeholder="Asset Name"
        value={formData.assetName}
        onChange={(e) => setFormData({...formData, assetName: e.target.value})}
        required
      />
      <textarea
        placeholder="Description"
        value={formData.description}
        onChange={(e) => setFormData({...formData, description: e.target.value})}
        required
      />
      <input
        type="number"
        step="0.01"
        placeholder="Price in ETH"
        value={formData.price}
        onChange={(e) => setFormData({...formData, price: e.target.value})}
        required
      />
      <button type="submit" disabled={loading}>
        {loading ? "Creating..." : "Create Proposal"}
      </button>
    </form>
  );
}

// ==========================
// 6. PROPOSAL LIST & VOTING
// ==========================

export function ProposalList({ contract, account }) {
  const [proposals, setProposals] = useState([]);
  const [loading, setLoading] = useState(false);

  const fetchProposals = async () => {
    if (!contract) return;

    try {
      setLoading(true);
      // Fetch proposals (you'll need to track proposal IDs)
      // This is simplified - in production, use events to get all proposals
      const proposalPromises = [];
      for (let i = 1; i <= 10; i++) { // Check first 10 proposals
        proposalPromises.push(
          contract.getProposal(i).catch(() => null)
        );
      }

      const results = await Promise.all(proposalPromises);
      const validProposals = results
        .filter(p => p !== null)
        .map((p, idx) => ({
          id: idx + 1,
          description: p[1],
          proposalType: p[2],
          amount: ethers.formatEther(p[4]),
          forVotes: p[6].toString(),
          againstVotes: p[7].toString(),
          deadline: new Date(Number(p[8]) * 1000),
          executed: p[9]
        }));

      setProposals(validProposals);
    } catch (error) {
      console.error("Failed to fetch proposals:", error);
    } finally {
      setLoading(false);
    }
  };

  const handleVote = async (proposalId, support) => {
    try {
      const tx = await contract.vote(proposalId, support);
      await tx.wait();
      alert(`Vote ${support ? 'FOR' : 'AGAINST'} cast successfully!`);
      fetchProposals(); // Refresh
    } catch (error) {
      console.error("Voting failed:", error);
      alert("Voting failed: " + error.message);
    }
  };

  useEffect(() => {
    fetchProposals();
  }, [contract]);

  if (loading) return <div>Loading proposals...</div>;

  return (
    <div className="proposal-list">
      <h3>Active Proposals</h3>
      {proposals.map(proposal => (
        <div key={proposal.id} className="proposal-card">
          <h4>{proposal.description}</h4>
          <p>Amount: {proposal.amount} ETH</p>
          <p>For: {proposal.forVotes} | Against: {proposal.againstVotes}</p>
          <p>Deadline: {proposal.deadline.toLocaleDateString()}</p>
          <p>Status: {proposal.executed ? "Executed" : "Active"}</p>
          
          {!proposal.executed && new Date() < proposal.deadline && (
            <div className="vote-buttons">
              <button onClick={() => handleVote(proposal.id, true)}>
                Vote For
              </button>
              <button onClick={() => handleVote(proposal.id, false)}>
                Vote Against
              </button>
            </div>
          )}
        </div>
      ))}
    </div>
  );
}

// ==========================
// 7. ASSET PORTFOLIO DISPLAY
// ==========================

export function AssetPortfolio({ contract, account }) {
  const [assets, setAssets] = useState([]);
  const [totalValue, setTotalValue] = useState("0");
  const [loading, setLoading] = useState(false);

  const fetchAssets = async () => {
    if (!contract || !account) return;

    try {
      setLoading(true);
      
      // Get total portfolio value
      const total = await contract.getTotalPortfolioValue();
      setTotalValue(ethers.formatEther(total));

      // Get all asset IDs
      const assetIds = await contract.getActiveAssets();

      // Fetch each asset's details and user's balance
      const assetPromises = assetIds.map(async (id) => {
        const asset = await contract.getAsset(id);
        const balance = await contract.balanceOf(account, id);
        
        return {
          id: id.toString(),
          name: asset[1],
          type: asset[2],
          purchasePrice: ethers.formatEther(asset[3]),
          currentValue: ethers.formatEther(asset[4]),
          userBalance: balance.toString(),
          isActive: asset[6]
        };
      });

      const assetsData = await Promise.all(assetPromises);
      setAssets(assetsData);
    } catch (error) {
      console.error("Failed to fetch assets:", error);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    fetchAssets();
  }, [contract, account]);

  if (loading) return <div>Loading portfolio...</div>;

  return (
    <div className="asset-portfolio">
      <h3>Investment Portfolio</h3>
      <div className="total-value">
        <h2>Total Value: {totalValue} ETH</h2>
      </div>
      
      <div className="assets-grid">
        {assets.map(asset => (
          <div key={asset.id} className="asset-card">
            <h4>{asset.name}</h4>
            <p>Type: {asset.type}</p>
            <p>Purchase Price: {asset.purchasePrice} ETH</p>
            <p>Current Value: {asset.currentValue} ETH</p>
            <p>Your Tokens: {asset.userBalance}</p>
            <div className="profit-indicator">
              {Number(asset.currentValue) > Number(asset.purchasePrice) ? (
                <span className="positive">
                  +{((Number(asset.currentValue) - Number(asset.purchasePrice)) / Number(asset.purchasePrice) * 100).toFixed(2)}%
                </span>
              ) : (
                <span className="negative">
                  {((Number(asset.currentValue) - Number(asset.purchasePrice)) / Number(asset.purchasePrice) * 100).toFixed(2)}%
                </span>
              )}
            </div>
          </div>
        ))}
      </div>
    </div>
  );
}

// ==========================
// 8. MAIN APP COMPONENT
// ==========================

export function StokvelApp() {
  const { account, signer, connected, connectWallet } = useWallet();
  const contract = useStokvel(signer);
  const { memberData, loading: memberLoading } = useMemberData(contract, account);

  if (!connected) {
    return (
      <div className="app">
        <h1>Stokvel Investment Group</h1>
        <button onClick={connectWallet} className="connect-button">
          Connect Wallet
        </button>
      </div>
    );
  }

  return (
    <div className="app">
      <header>
        <h1>Stokvel Investment Group</h1>
        <div className="user-info">
          <p>Connected: {account?.slice(0, 6)}...{account?.slice(-4)}</p>
        </div>
      </header>

      {memberData && (
        <div className="member-dashboard">
          <h2>Your Stats</h2>
          <div className="stats-grid">
            <div className="stat">
              <label>Total Contributions</label>
              <value>{memberData.contributions} ETH</value>
            </div>
            <div className="stat">
              <label>Shares</label>
              <value>{memberData.shares}</value>
            </div>
            <div className="stat">
              <label>Ownership</label>
              <value>{memberData.percentage}%</value>
            </div>
          </div>
        </div>
      )}

      <div className="main-content">
        <ContributeSection contract={contract} />
        <CreateProposal contract={contract} />
        <ProposalList contract={contract} account={account} />
        <AssetPortfolio contract={contract} account={account} />
      </div>
    </div>
  );
}

// ==========================
// 9. EVENT LISTENERS
// ==========================

export function useStokvelEvents(contract) {
  useEffect(() => {
    if (!contract) return;

    // Listen for contributions
    contract.on("ContributionMade", (member, amount, shares) => {
      console.log(`New contribution: ${ethers.formatEther(amount)} ETH from ${member}`);
      // Update UI, show notification, etc.
    });

    // Listen for new assets
    contract.on("AssetPurchased", (assetId, name, price) => {
      console.log(`Asset purchased: ${name} for ${ethers.formatEther(price)} ETH`);
      // Refresh asset list
    });

    // Listen for proposals
    contract.on("ProposalCreated", (proposalId, type, description) => {
      console.log(`New proposal #${proposalId}: ${description}`);
      // Show notification to vote
    });

    // Cleanup
    return () => {
      contract.removeAllListeners();
    };
  }, [contract]);
}

// ==========================
// 10. STYLING (CSS-in-JS or separate CSS)
// ==========================

export const styles = `
.app {
  max-width: 1200px;
  margin: 0 auto;
  padding: 20px;
  font-family: 'Inter', sans-serif;
}

.connect-button {
  background: #007bff;
  color: white;
  padding: 12px 24px;
  border: none;
  border-radius: 8px;
  cursor: pointer;
  font-size: 16px;
}

.member-dashboard {
  background: #f8f9fa;
  padding: 20px;
  border-radius: 12px;
  margin: 20px 0;
}

.stats-grid {
  display: grid;
  grid-template-columns: repeat(auto-fit, minmax(200px, 1fr));
  gap: 20px;
  margin-top: 20px;
}

.stat {
  background: white;
  padding: 20px;
  border-radius: 8px;
  box-shadow: 0 2px 4px rgba(0,0,0,0.1);
}

.proposal-card, .asset-card {
  background: white;
  padding: 20px;
  border-radius: 8px;
  margin: 10px 0;
  box-shadow: 0 2px 4px rgba(0,0,0,0.1);
}

.vote-buttons {
  display: flex;
  gap: 10px;
  margin-top: 15px;
}

.vote-buttons button {
  flex: 1;
  padding: 10px;
  border: none;
  border-radius: 6px;
  cursor: pointer;
}

.vote-buttons button:first-child {
  background: #28a745;
  color: white;
}

.vote-buttons button:last-child {
  background: #dc3545;
  color: white;
}

.assets-grid {
  display: grid;
  grid-template-columns: repeat(auto-fill, minmax(300px, 1fr));
  gap: 20px;
  margin-top: 20px;
}

.positive {
  color: #28a745;
  font-weight: bold;
}

.negative {
  color: #dc3545;
  font-weight: bold;
}
`;
