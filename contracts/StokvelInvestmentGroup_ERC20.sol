// SPDX-License-Identifier: MIT
pragma solidity ^0.8.20;

import "@openzeppelin/contracts/token/ERC1155/ERC1155.sol";
import "@openzeppelin/contracts/token/ERC20/IERC20.sol";
import "@openzeppelin/contracts/token/ERC20/utils/SafeERC20.sol";
import "@openzeppelin/contracts/access/AccessControl.sol";
import "@openzeppelin/contracts/security/ReentrancyGuard.sol";
import "@openzeppelin/contracts/security/Pausable.sol";

/**
 * @title StokvelInvestmentGroup (ERC20 Version)
 * @dev A Stokvel/Investment Group contract where members pool ERC20 tokens (stablecoins/CBDC) together
 * Each ERC1155 token ID represents a different asset/investment owned by the group
 * Members receive shares proportional to their contributions
 * 
 * Compatible with: USDC, USDT, DAI, BUSD, or any ERC20 token including CBDCs
 */
contract StokvelInvestmentGroup is ERC1155, AccessControl, ReentrancyGuard, Pausable {
    using SafeERC20 for IERC20;
    
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
    
    IERC20 public immutable paymentToken; // The ERC20 token used (USDC, DAI, etc.)
    uint8 public immutable tokenDecimals; // Decimals of the payment token
    
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
    event EmergencyWithdrawal(address indexed admin, uint256 amount);
    
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
    
    /**
     * @param _paymentToken Address of ERC20 token to use (USDC, DAI, CBDC, etc.)
     * @param _name Name of the Stokvel group
     * @param _uri Base URI for ERC1155 metadata
     * @param _minimumContribution Minimum contribution amount in token units
     * @param _votingPeriod Voting period in seconds
     * @param _quorumPercentage Quorum percentage (e.g., 51 for 51%)
     */
    constructor(
        address _paymentToken,
        string memory _name,
        string memory _uri,
        uint256 _minimumContribution,
        uint256 _votingPeriod,
        uint256 _quorumPercentage
    ) ERC1155(_uri) {
        require(_paymentToken != address(0), "Invalid token address");
        require(_quorumPercentage > 0 && _quorumPercentage <= 100, "Invalid quorum");
        
        paymentToken = IERC20(_paymentToken);
        tokenDecimals = _getTokenDecimals(_paymentToken);
        
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
    
    /**
     * @dev Get token decimals (with fallback to 18)
     */
    function _getTokenDecimals(address _token) internal view returns (uint8) {
        try IERC20Metadata(_token).decimals() returns (uint8 decimals) {
            return decimals;
        } catch {
            return 18; // Default fallback
        }
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
    
    /**
     * @dev Admin function to directly add member (for initial setup)
     */
    function adminAddMember(address _member) external onlyAdmin {
        require(_member != address(0), "Invalid address");
        require(!hasRole(MEMBER_ROLE, _member), "Already a member");
        
        _grantRole(MEMBER_ROLE, _member);
        
        members[_member] = Member({
            memberAddress: _member,
            totalContributions: 0,
            shareBalance: 0,
            joinedAt: block.timestamp,
            isActive: true
        });
        memberAddresses.push(_member);
        
        emit MemberAdded(_member, block.timestamp);
    }
    
    // ============ Contributions ============
    
    /**
     * @dev Members contribute ERC20 tokens to the pool
     * @param _amount Amount of tokens to contribute
     * 
     * IMPORTANT: Member must approve this contract to spend their tokens first:
     * Example for USDC (6 decimals): paymentToken.approve(stokvelAddress, 100000000) // 100 USDC
     * Example for DAI (18 decimals): paymentToken.approve(stokvelAddress, 100000000000000000000) // 100 DAI
     */
    function contribute(uint256 _amount) external onlyMember nonReentrant whenNotPaused {
        require(_amount >= minimumContribution, "Below minimum contribution");
        
        // Calculate shares to issue
        uint256 sharesToIssue;
        if (totalShares == 0) {
            // First contribution: 1 token unit = 1000 shares
            sharesToIssue = _amount * 1000;
        } else {
            // Subsequent contributions: maintain proportional shares
            sharesToIssue = (_amount * totalShares) / totalPoolBalance;
        }
        
        // Transfer tokens from member to contract
        paymentToken.safeTransferFrom(msg.sender, address(this), _amount);
        
        // Update state
        members[msg.sender].totalContributions += _amount;
        members[msg.sender].shareBalance += sharesToIssue;
        totalPoolBalance += _amount;
        totalShares += sharesToIssue;
        
        emit ContributionMade(msg.sender, _amount, sharesToIssue);
    }
    
    // ============ Asset Management ============
    
    /**
     * @dev Create proposal to purchase an asset
     */
    function proposeBuyAsset(
        uint256 _price,
        string memory _assetName,
        string memory _description
    ) external onlyMember returns (uint256) {
        require(_price > 0, "Invalid price");
        require(totalPoolBalance >= _price, "Insufficient funds");
        
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
     * @dev Execute asset purchase (internal, after voting)
     */
    function executeBuyAsset(
        uint256 _proposalId,
        string memory _assetName,
        string memory _assetType,
        string memory _metadataURI
    ) internal {
        Proposal storage proposal = proposals[_proposalId];
        uint256 price = proposal.amount;
        
        require(totalPoolBalance >= price, "Insufficient balance");
        
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
        
        // Mint ERC1155 tokens to all active members proportional to their shares
        for (uint256 i = 0; i < memberAddresses.length; i++) {
            address memberAddr = memberAddresses[i];
            Member storage member = members[memberAddr];
            
            if (member.isActive && member.shareBalance > 0) {
                // Each member gets tokens proportional to their share percentage
                uint256 memberTokens = (member.shareBalance * 1000) / totalShares;
                if (memberTokens > 0) {
                    _mint(memberAddr, assetId, memberTokens, "");
                }
            }
        }
        
        emit AssetPurchased(assetId, _assetName, price);
    }
    
    /**
     * @dev Update asset current value (admin only)
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
     * @dev Create proposal to sell an asset
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
     * @dev Execute asset sale (internal, after voting)
     */
    function executeSellAsset(uint256 _proposalId) internal {
        Proposal storage proposal = proposals[_proposalId];
        uint256 assetId = proposal.assetId;
        uint256 salePrice = proposal.amount;
        
        require(assets[assetId].isActive, "Asset not active");
        
        assets[assetId].isActive = false;
        assets[assetId].currentValue = salePrice;
        totalPoolBalance += salePrice;
        
        emit AssetSold(assetId, salePrice);
    }
    
    // ============ Voting ============
    
    /**
     * @dev Vote on a proposal
     */
    function vote(uint256 _proposalId, bool _support) external onlyMember {
        Proposal storage proposal = proposals[_proposalId];
        
        require(block.timestamp <= proposal.deadline, "Voting period ended");
        require(!proposal.executed, "Proposal already executed");
        require(!proposal.hasVoted[msg.sender], "Already voted");
        
        proposal.hasVoted[msg.sender] = true;
        
        uint256 votingPower = members[msg.sender].shareBalance;
        
        if (_support) {
            proposal.forVotes += votingPower;
        } else {
            proposal.againstVotes += votingPower;
        }
        
        emit VoteCast(_proposalId, msg.sender, _support, votingPower);
    }
    
    /**
     * @dev Execute a proposal after voting period ends
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
     * NOTE: For large member counts, consider implementing pull-based pattern
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
                    paymentToken.safeTransfer(memberAddr, memberShare);
                }
            }
        }
        
        totalPoolBalance -= totalDistribution;
        
        emit ProfitsDistributed(totalDistribution, block.timestamp);
    }
    
    /**
     * @dev Create proposal to distribute specific amount
     */
    function proposeDistributeProfits(uint256 _amount, string memory _description) 
        external 
        onlyMember 
        returns (uint256) 
    {
        require(_amount <= totalPoolBalance, "Amount exceeds balance");
        
        uint256 proposalId = nextProposalId++;
        Proposal storage proposal = proposals[proposalId];
        proposal.proposalId = proposalId;
        proposal.description = _description;
        proposal.proposalType = ProposalType.DISTRIBUTE_PROFITS;
        proposal.amount = _amount;
        proposal.deadline = block.timestamp + votingPeriod;
        
        emit ProposalCreated(proposalId, ProposalType.DISTRIBUTE_PROFITS, _description);
        return proposalId;
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
    
    /**
     * @dev Get the payment token address and details
     */
    function getPaymentTokenInfo() external view returns (
        address tokenAddress,
        uint8 decimals,
        uint256 contractBalance
    ) {
        return (
            address(paymentToken),
            tokenDecimals,
            paymentToken.balanceOf(address(this))
        );
    }
    
    /**
     * @dev Get contract's token balance
     */
    function getContractBalance() external view returns (uint256) {
        return paymentToken.balanceOf(address(this));
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
    
    /**
     * @dev Emergency withdrawal function (use with extreme caution)
     * Only to be used if tokens are stuck or in emergency situations
     */
    function emergencyWithdraw(uint256 _amount) external onlyAdmin {
        require(_amount <= paymentToken.balanceOf(address(this)), "Insufficient balance");
        paymentToken.safeTransfer(msg.sender, _amount);
        emit EmergencyWithdrawal(msg.sender, _amount);
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
}

// Interface for getting token decimals
interface IERC20Metadata is IERC20 {
    function decimals() external view returns (uint8);
}
