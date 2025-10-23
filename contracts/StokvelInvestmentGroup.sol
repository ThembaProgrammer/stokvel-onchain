// SPDX-License-Identifier: MIT
pragma solidity ^0.8.20;

import "@openzeppelin/contracts/token/ERC1155/ERC1155.sol";
import "@openzeppelin/contracts/access/AccessControl.sol";
import "@openzeppelin/contracts/security/ReentrancyGuard.sol";
import "@openzeppelin/contracts/security/Pausable.sol";

/**
 * @title StokvelInvestmentGroup
 * @dev A Stokvel/Investment Group contract where members pool funds together
 * Each ERC1155 token ID represents a different asset/investment owned by the group
 * Members receive shares proportional to their contributions
 */
contract StokvelInvestmentGroup is ERC1155, AccessControl, ReentrancyGuard, Pausable {
    
    // ============ Roles ============
    bytes32 public constant ADMIN_ROLE = keccak256("ADMIN_ROLE");
    bytes32 public constant MEMBER_ROLE = keccak256("MEMBER_ROLE");
    
    // ============ Structs ============
    
    struct Member {
        address memberAddress;
        uint256 totalContributions;
        uint256 shareBalance;
        uint256 joinedAt;
        bool isActive;
    }
    
    struct Asset {
        uint256 assetId;
        string assetName;
        string assetType; // e.g., "Real Estate", "Stock", "Crypto", "Bond"
        uint256 purchasePrice;
        uint256 currentValue;
        uint256 purchaseDate;
        bool isActive;
        string metadataURI;
    }
    
    struct Proposal {
        uint256 proposalId;
        string description;
        ProposalType proposalType;
        address targetAddress;
        uint256 amount;
        uint256 assetId;
        uint256 forVotes;
        uint256 againstVotes;
        uint256 deadline;
        bool executed;
        mapping(address => bool) hasVoted;
    }
    
    enum ProposalType {
        ADD_MEMBER,
        REMOVE_MEMBER,
        BUY_ASSET,
        SELL_ASSET,
        DISTRIBUTE_PROFITS,
        WITHDRAW_FUNDS
    }
    
    // ============ State Variables ============
    
    string public stokvelName;
    uint256 public minimumContribution;
    uint256 public totalPoolBalance;
    uint256 public totalShares;
    uint256 public nextAssetId;
    uint256 public nextProposalId;
    uint256 public votingPeriod; // in seconds
    uint256 public quorumPercentage; // percentage of votes needed (e.g., 51)
    
    mapping(address => Member) public members;
    address[] public memberAddresses;
    mapping(uint256 => Asset) public assets;
    uint256[] public assetIds;
    mapping(uint256 => Proposal) public proposals;
    
    // ============ Events ============
    
    event MemberAdded(address indexed member, uint256 timestamp);
    event MemberRemoved(address indexed member, uint256 timestamp);
    event ContributionMade(address indexed member, uint256 amount, uint256 sharesIssued);
    event AssetPurchased(uint256 indexed assetId, string assetName, uint256 price);
    event AssetSold(uint256 indexed assetId, uint256 salePrice);
    event AssetValueUpdated(uint256 indexed assetId, uint256 oldValue, uint256 newValue);
    event ProposalCreated(uint256 indexed proposalId, ProposalType proposalType, string description);
    event VoteCast(uint256 indexed proposalId, address indexed voter, bool support, uint256 weight);
    event ProposalExecuted(uint256 indexed proposalId);
    event ProfitsDistributed(uint256 totalAmount, uint256 timestamp);
    event FundsWithdrawn(address indexed recipient, uint256 amount);
    
    // ============ Modifiers ============
    
    modifier onlyMember() {
        require(hasRole(MEMBER_ROLE, msg.sender), "Not a member");
        require(members[msg.sender].isActive, "Member is not active");
        _;
    }
    
    modifier onlyAdmin() {
        require(hasRole(ADMIN_ROLE, msg.sender), "Not an admin");
        _;
    }
    
    // ============ Constructor ============
    
    constructor(
        string memory _name,
        string memory _uri,
        uint256 _minimumContribution,
        uint256 _votingPeriod,
        uint256 _quorumPercentage
    ) ERC1155(_uri) {
        stokvelName = _name;
        minimumContribution = _minimumContribution;
        votingPeriod = _votingPeriod;
        quorumPercentage = _quorumPercentage;
        nextAssetId = 1;
        nextProposalId = 1;
        
        _grantRole(DEFAULT_ADMIN_ROLE, msg.sender);
        _grantRole(ADMIN_ROLE, msg.sender);
        _grantRole(MEMBER_ROLE, msg.sender);
        
        // Add creator as first member
        members[msg.sender] = Member({
            memberAddress: msg.sender,
            totalContributions: 0,
            shareBalance: 0,
            joinedAt: block.timestamp,
            isActive: true
        });
        memberAddresses.push(msg.sender);
        
        emit MemberAdded(msg.sender, block.timestamp);
    }
    
    // ============ Member Management ============
    
    /**
     * @dev Create a proposal to add a new member
     */
    function proposeAddMember(address _newMember, string memory _description) 
        external 
        onlyMember 
        returns (uint256) 
    {
        require(_newMember != address(0), "Invalid address");
        require(!hasRole(MEMBER_ROLE, _newMember), "Already a member");
        
        uint256 proposalId = nextProposalId++;
        Proposal storage proposal = proposals[proposalId];
        proposal.proposalId = proposalId;
        proposal.description = _description;
        proposal.proposalType = ProposalType.ADD_MEMBER;
        proposal.targetAddress = _newMember;
        proposal.deadline = block.timestamp + votingPeriod;
        
        emit ProposalCreated(proposalId, ProposalType.ADD_MEMBER, _description);
        return proposalId;
    }
    
    /**
     * @dev Create a proposal to remove a member
     */
    function proposeRemoveMember(address _member, string memory _description) 
        external 
        onlyMember 
        returns (uint256) 
    {
        require(_member != address(0), "Invalid address");
        require(hasRole(MEMBER_ROLE, _member), "Not a member");
        require(members[_member].isActive, "Member already inactive");
        
        uint256 proposalId = nextProposalId++;
        Proposal storage proposal = proposals[proposalId];
        proposal.proposalId = proposalId;
        proposal.description = _description;
        proposal.proposalType = ProposalType.REMOVE_MEMBER;
        proposal.targetAddress = _member;
        proposal.deadline = block.timestamp + votingPeriod;
        
        emit ProposalCreated(proposalId, ProposalType.REMOVE_MEMBER, _description);
        return proposalId;
    }
    
    /**
     * @dev Execute a proposal to add a member (after voting passes)
     */
    function executeAddMember(uint256 _proposalId) internal {
        Proposal storage proposal = proposals[_proposalId];
        address newMember = proposal.targetAddress;
        
        _grantRole(MEMBER_ROLE, newMember);
        
        members[newMember] = Member({
            memberAddress: newMember,
            totalContributions: 0,
            shareBalance: 0,
            joinedAt: block.timestamp,
            isActive: true
        });
        memberAddresses.push(newMember);
        
        emit MemberAdded(newMember, block.timestamp);
    }
    
    /**
     * @dev Execute a proposal to remove a member (after voting passes)
     */
    function executeRemoveMember(uint256 _proposalId) internal {
        Proposal storage proposal = proposals[_proposalId];
        address memberToRemove = proposal.targetAddress;
        
        members[memberToRemove].isActive = false;
        _revokeRole(MEMBER_ROLE, memberToRemove);
        
        emit MemberRemoved(memberToRemove, block.timestamp);
    }
    
    // ============ Contributions ============
    
    /**
     * @dev Members contribute ETH to the pool
     */
    function contribute() external payable onlyMember nonReentrant whenNotPaused {
        require(msg.value >= minimumContribution, "Below minimum contribution");
        
        uint256 sharesToIssue;
        if (totalShares == 0) {
            // First contribution: 1 ETH = 1000 shares
            sharesToIssue = msg.value * 1000;
        } else {
            // Subsequent contributions: maintain proportional shares
            sharesToIssue = (msg.value * totalShares) / totalPoolBalance;
        }
        
        members[msg.sender].totalContributions += msg.value;
        members[msg.sender].shareBalance += sharesToIssue;
        totalPoolBalance += msg.value;
        totalShares += sharesToIssue;
        
        emit ContributionMade(msg.sender, msg.value, sharesToIssue);
    }
    
    // ============ Asset Management ============
    
    /**
     * @dev Create a proposal to purchase an asset
     */
    function proposeBuyAsset(
        string memory _assetName,
        string memory _assetType,
        uint256 _price,
        string memory _metadataURI,
        string memory _description
    ) external onlyMember returns (uint256) {
        require(_price <= totalPoolBalance, "Insufficient pool balance");
        
        uint256 proposalId = nextProposalId++;
        Proposal storage proposal = proposals[proposalId];
        proposal.proposalId = proposalId;
        proposal.description = _description;
        proposal.proposalType = ProposalType.BUY_ASSET;
        proposal.amount = _price;
        proposal.deadline = block.timestamp + votingPeriod;
        
        emit ProposalCreated(proposalId, ProposalType.BUY_ASSET, _description);
        return proposalId;
    }
    
    /**
     * @dev Execute asset purchase (after proposal passes)
     */
    function executeBuyAsset(
        uint256 _proposalId,
        string memory _assetName,
        string memory _assetType,
        string memory _metadataURI
    ) internal {
        Proposal storage proposal = proposals[_proposalId];
        uint256 price = proposal.amount;
        
        uint256 assetId = nextAssetId++;
        
        assets[assetId] = Asset({
            assetId: assetId,
            assetName: _assetName,
            assetType: _assetType,
            purchasePrice: price,
            currentValue: price,
            purchaseDate: block.timestamp,
            isActive: true,
            metadataURI: _metadataURI
        });
        
        assetIds.push(assetId);
        totalPoolBalance -= price;
        
        // Mint ERC1155 tokens representing this asset to the contract
        _mint(address(this), assetId, 1000, ""); // 1000 units representing 100% of asset
        
        emit AssetPurchased(assetId, _assetName, price);
    }
    
    /**
     * @dev Update the current value of an asset
     */
    function updateAssetValue(uint256 _assetId, uint256 _newValue) 
        external 
        onlyAdmin 
    {
        require(assets[_assetId].isActive, "Asset not active");
        
        uint256 oldValue = assets[_assetId].currentValue;
        assets[_assetId].currentValue = _newValue;
        
        emit AssetValueUpdated(_assetId, oldValue, _newValue);
    }
    
    /**
     * @dev Create a proposal to sell an asset
     */
    function proposeSellAsset(
        uint256 _assetId,
        uint256 _salePrice,
        string memory _description
    ) external onlyMember returns (uint256) {
        require(assets[_assetId].isActive, "Asset not active");
        
        uint256 proposalId = nextProposalId++;
        Proposal storage proposal = proposals[proposalId];
        proposal.proposalId = proposalId;
        proposal.description = _description;
        proposal.proposalType = ProposalType.SELL_ASSET;
        proposal.assetId = _assetId;
        proposal.amount = _salePrice;
        proposal.deadline = block.timestamp + votingPeriod;
        
        emit ProposalCreated(proposalId, ProposalType.SELL_ASSET, _description);
        return proposalId;
    }
    
    /**
     * @dev Execute asset sale (after proposal passes)
     */
    function executeSellAsset(uint256 _proposalId) internal {
        Proposal storage proposal = proposals[_proposalId];
        uint256 assetId = proposal.assetId;
        uint256 salePrice = proposal.amount;
        
        assets[assetId].isActive = false;
        totalPoolBalance += salePrice;
        
        // Burn the ERC1155 tokens representing this asset
        _burn(address(this), assetId, 1000);
        
        emit AssetSold(assetId, salePrice);
    }
    
    // ============ Voting & Governance ============
    
    /**
     * @dev Vote on a proposal
     */
    function vote(uint256 _proposalId, bool _support) external onlyMember {
        Proposal storage proposal = proposals[_proposalId];
        require(block.timestamp <= proposal.deadline, "Voting period ended");
        require(!proposal.executed, "Proposal already executed");
        require(!proposal.hasVoted[msg.sender], "Already voted");
        
        uint256 voteWeight = members[msg.sender].shareBalance;
        require(voteWeight > 0, "No voting power");
        
        proposal.hasVoted[msg.sender] = true;
        
        if (_support) {
            proposal.forVotes += voteWeight;
        } else {
            proposal.againstVotes += voteWeight;
        }
        
        emit VoteCast(_proposalId, msg.sender, _support, voteWeight);
    }
    
    /**
     * @dev Execute a proposal after voting period
     */
    function executeProposal(
        uint256 _proposalId,
        string memory _assetName,
        string memory _assetType,
        string memory _metadataURI
    ) external onlyMember nonReentrant {
        Proposal storage proposal = proposals[_proposalId];
        require(block.timestamp > proposal.deadline, "Voting still active");
        require(!proposal.executed, "Already executed");
        
        uint256 totalVotes = proposal.forVotes + proposal.againstVotes;
        uint256 quorum = (totalShares * quorumPercentage) / 100;
        
        require(totalVotes >= quorum, "Quorum not reached");
        require(proposal.forVotes > proposal.againstVotes, "Proposal rejected");
        
        proposal.executed = true;
        
        if (proposal.proposalType == ProposalType.ADD_MEMBER) {
            executeAddMember(_proposalId);
        } else if (proposal.proposalType == ProposalType.REMOVE_MEMBER) {
            executeRemoveMember(_proposalId);
        } else if (proposal.proposalType == ProposalType.BUY_ASSET) {
            executeBuyAsset(_proposalId, _assetName, _assetType, _metadataURI);
        } else if (proposal.proposalType == ProposalType.SELL_ASSET) {
            executeSellAsset(_proposalId);
        }
        
        emit ProposalExecuted(_proposalId);
    }
    
    // ============ Profit Distribution ============
    
    /**
     * @dev Distribute profits to all members proportionally
     */
    function distributeProfits() external onlyAdmin nonReentrant {
        require(totalPoolBalance > 0, "No funds to distribute");
        require(totalShares > 0, "No shares exist");
        
        uint256 totalDistribution = 0;
        
        for (uint256 i = 0; i < memberAddresses.length; i++) {
            address memberAddr = memberAddresses[i];
            Member storage member = members[memberAddr];
            
            if (member.isActive && member.shareBalance > 0) {
                uint256 memberShare = (totalPoolBalance * member.shareBalance) / totalShares;
                
                if (memberShare > 0) {
                    totalDistribution += memberShare;
                    payable(memberAddr).transfer(memberShare);
                }
            }
        }
        
        totalPoolBalance -= totalDistribution;
        
        emit ProfitsDistributed(totalDistribution, block.timestamp);
    }
    
    // ============ View Functions ============
    
    /**
     * @dev Get member information
     */
    function getMember(address _member) external view returns (
        uint256 totalContributions,
        uint256 shareBalance,
        uint256 sharePercentage,
        uint256 joinedAt,
        bool isActive
    ) {
        Member memory member = members[_member];
        uint256 percentage = totalShares > 0 ? (member.shareBalance * 10000) / totalShares : 0;
        
        return (
            member.totalContributions,
            member.shareBalance,
            percentage, // in basis points (10000 = 100%)
            member.joinedAt,
            member.isActive
        );
    }
    
    /**
     * @dev Get asset information
     */
    function getAsset(uint256 _assetId) external view returns (Asset memory) {
        return assets[_assetId];
    }
    
    /**
     * @dev Get total portfolio value (pool + all assets)
     */
    function getTotalPortfolioValue() external view returns (uint256) {
        uint256 total = totalPoolBalance;
        
        for (uint256 i = 0; i < assetIds.length; i++) {
            if (assets[assetIds[i]].isActive) {
                total += assets[assetIds[i]].currentValue;
            }
        }
        
        return total;
    }
    
    /**
     * @dev Get all active members
     */
    function getActiveMembers() external view returns (address[] memory) {
        uint256 activeCount = 0;
        
        for (uint256 i = 0; i < memberAddresses.length; i++) {
            if (members[memberAddresses[i]].isActive) {
                activeCount++;
            }
        }
        
        address[] memory activeMembers = new address[](activeCount);
        uint256 index = 0;
        
        for (uint256 i = 0; i < memberAddresses.length; i++) {
            if (members[memberAddresses[i]].isActive) {
                activeMembers[index] = memberAddresses[i];
                index++;
            }
        }
        
        return activeMembers;
    }
    
    /**
     * @dev Get all active assets
     */
    function getActiveAssets() external view returns (uint256[] memory) {
        uint256 activeCount = 0;
        
        for (uint256 i = 0; i < assetIds.length; i++) {
            if (assets[assetIds[i]].isActive) {
                activeCount++;
            }
        }
        
        uint256[] memory activeAssets = new uint256[](activeCount);
        uint256 index = 0;
        
        for (uint256 i = 0; i < assetIds.length; i++) {
            if (assets[assetIds[i]].isActive) {
                activeAssets[index] = assetIds[i];
                index++;
            }
        }
        
        return activeAssets;
    }
    
    /**
     * @dev Get proposal details
     */
    function getProposal(uint256 _proposalId) external view returns (
        uint256 proposalId,
        string memory description,
        ProposalType proposalType,
        address targetAddress,
        uint256 amount,
        uint256 assetId,
        uint256 forVotes,
        uint256 againstVotes,
        uint256 deadline,
        bool executed
    ) {
        Proposal storage proposal = proposals[_proposalId];
        return (
            proposal.proposalId,
            proposal.description,
            proposal.proposalType,
            proposal.targetAddress,
            proposal.amount,
            proposal.assetId,
            proposal.forVotes,
            proposal.againstVotes,
            proposal.deadline,
            proposal.executed
        );
    }
    
    // ============ Admin Functions ============
    
    /**
     * @dev Update minimum contribution
     */
    function updateMinimumContribution(uint256 _newMinimum) external onlyAdmin {
        minimumContribution = _newMinimum;
    }
    
    /**
     * @dev Update voting period
     */
    function updateVotingPeriod(uint256 _newPeriod) external onlyAdmin {
        votingPeriod = _newPeriod;
    }
    
    /**
     * @dev Update quorum percentage
     */
    function updateQuorumPercentage(uint256 _newPercentage) external onlyAdmin {
        require(_newPercentage <= 100, "Invalid percentage");
        quorumPercentage = _newPercentage;
    }
    
    /**
     * @dev Pause contract
     */
    function pause() external onlyAdmin {
        _pause();
    }
    
    /**
     * @dev Unpause contract
     */
    function unpause() external onlyAdmin {
        _unpause();
    }
    
    /**
     * @dev Update base URI for metadata
     */
    function setURI(string memory newuri) external onlyAdmin {
        _setURI(newuri);
    }
    
    // ============ Required Overrides ============
    
    function supportsInterface(bytes4 interfaceId)
        public
        view
        override(ERC1155, AccessControl)
        returns (bool)
    {
        return super.supportsInterface(interfaceId);
    }
    
    // ============ Receive Function ============
    
    receive() external payable {
        totalPoolBalance += msg.value;
    }
}
