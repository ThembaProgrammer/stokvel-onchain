// SPDX-License-Identifier: MIT
pragma solidity ^0.8.28;

import "@openzeppelin/contracts/token/ERC1155/extensions/ERC1155Supply.sol";
import "@openzeppelin/contracts/token/ERC20/IERC20.sol";
import "@openzeppelin/contracts/token/ERC20/utils/SafeERC20.sol";
import "@openzeppelin/contracts/utils/ReentrancyGuard.sol";
import "@openzeppelin/contracts/utils/Pausable.sol";
import "@openzeppelin/contracts/access/Ownable.sol";

interface IMembershipFactory {
    function deployMembership(
        address stokvel,
        address asset,
        bytes32 emailHash
    ) external returns (address);
    function computeMembershipAddress(
        address stokvel,
        address asset,
        bytes32 emailHash
    ) external view returns (address);
}

/**
 * @title StokvelOnChain
 * @notice A decentralized stokvel (savings club) smart contract with ERC1155 for asset management
 * @dev Token ID 1 is reserved for contribution shares
 *
 * Features:
 * - ERC1155 multi-token standard for flexible asset ownership
 * - Membership management with IPFS-backed agreements
 * - Contribution tracking via token ID 1
 * - Quorum-based governance for fund usage
 * - Proportional distribution mechanism
 * - ReentrancyGuard for security
 * - Pausable for emergency stops
 */
contract StokvelOnChain is ERC1155Supply, ReentrancyGuard, Pausable, Ownable {
    using SafeERC20 for IERC20;

    // Constants
    uint256 public constant CONTRIBUTION_TOKEN_ID = 1;

    // Enums
    enum MOUType {
        NONMEMBER, // Membership has been terminated
        ACTIVE, // Member is active in the stokvel
        TRANSFERRED, // Membership has been transferred to another address
        TERMINATED // Membership has been terminated
    }

    // Structs
    struct Member {
        string contractIPFSHash; // IPFS hash of membership agreement document
        MOUType state; // Current membership state
    }

    // State variables
    address public contributionAsset; // ERC20 token used for contributions
    uint256 public stokvelQuorum; // Required quorum for approvals
    IMembershipFactory public factory;

    mapping(address => Member) public members; // Member registry
    mapping(address => uint256) public quorum; // Accumulated quorum per operator
    mapping(address => bool) public hasVoted; // Track if member has voted (optional)

    // Events
    event ContributionAssetSet(address indexed asset);
    event MembershipActivated(
        address indexed membershipAddress,
        string ipfsHash
    );
    event MembershipTransferred(
        address indexed newMember,
        address indexed fromMember,
        string ipfsHash
    );
    event MembershipTerminated(address indexed member, string ipfsHash);
    event ContributionMade(address indexed member, uint256 amount);
    event ApprovedToUseContribution(
        address indexed voter,
        address indexed operator,
        uint256 voterWeight,
        uint256 currentQuorum,
        uint256 requiredQuorum
    );
    event PermissionGrantedToUseContribution(
        address indexed operator,
        uint256 amount,
        address indexed asset,
        uint256 achievedQuorum,
        uint256 requiredQuorum
    );
    event ContributionDistributed(address indexed member, uint256 amount);
    event QuorumUpdated(uint256 oldQuorum, uint256 newQuorum);

    // Modifiers
    modifier onlyActiveMember(address member) {
        require(
            members[member].state == MOUType.ACTIVE,
            "StokvelOnChain: Member must have active membership"
        );
        _;
    }

    /**
     * @notice Constructor
     * @param _uri Base URI for ERC1155 metadata
     * @param _stokvelQuorum Initial quorum requirement
     */
    constructor(
        string memory _uri,
        uint256 _stokvelQuorum,
        address _contributionAsset,
        address _factory
    ) ERC1155(_uri) Ownable(msg.sender) {
        require(
            _stokvelQuorum > 0,
            "StokvelOnChain: Quorum must be greater than 0"
        );
        require(
            _contributionAsset != address(0),
            "StokvelOnChain: Invalid contributionAsset 0 "
        );
        require(
            _factory != address(0),
            "StokvelOnChain: Invalid factory 0 "
        );
        stokvelQuorum = _stokvelQuorum;
        contributionAsset = _contributionAsset;
        factory = IMembershipFactory(_factory); // Add this
    }

    function getMembership(string memory email) public view returns (address) {
        bytes32 emailHash = keccak256(abi.encodePacked(email));
        return
            factory.computeMembershipAddress(
                address(this),
                contributionAsset,
                emailHash
            );
    }

    // ==================== Admin Functions ====================

    /**
     * @notice Set the ERC20 token used for contributions
     * @param _contributionAsset Address of the ERC20 token
     */
    function setContributionERC20(
        address _contributionAsset
    ) external onlyOwner {
        require(
            _contributionAsset != address(0),
            "StokvelOnChain: Invalid asset address"
        );
        contributionAsset = _contributionAsset;
        emit ContributionAssetSet(_contributionAsset);
    }

    /**
     * @notice Update the quorum requirement
     * @param _newQuorum New quorum value
     */
    function setStokvelQuorum(uint256 _newQuorum) external onlyOwner {
        require(
            _newQuorum > 0,
            "StokvelOnChain: Quorum must be greater than 0"
        );
        uint256 oldQuorum = stokvelQuorum;
        stokvelQuorum = _newQuorum;
        emit QuorumUpdated(oldQuorum, _newQuorum);
    }

    /**
     * @notice Pause the contract (emergency stop)
     */
    function pause() external onlyOwner {
        _pause();
    }

    /**
     * @notice Unpause the contract
     */
    function unpause() external onlyOwner {
        _unpause();
    }

    // ==================== Membership Functions ====================

    /**
     * @notice Add a new member to the stokvel
     * @param email address of the new member
     * @param stokvelContractIPFSHash IPFS hash of the membership agreement
     */
    function join(
        string calldata email,
        string calldata stokvelContractIPFSHash
    ) external onlyOwner whenNotPaused {
        require(
            bytes(stokvelContractIPFSHash).length > 0,
            "StokvelOnChain: IPFS hash required"
        );
        require(
            bytes(email).length > 0,
            "StokvelOnChain: Member email required"
        );

        bytes32 emailHash = keccak256(abi.encodePacked(email));
        address membershipAddr = factory.computeMembershipAddress(
            address(this),
            contributionAsset,
            emailHash
        );
        require(
            members[membershipAddr].state != MOUType.ACTIVE,
            "StokvelOnChain: Member already active"
        );

        address deployed = factory.deployMembership(address(this), contributionAsset, emailHash);

        assert(deployed == membershipAddr);

        members[membershipAddr] = Member({
            contractIPFSHash: stokvelContractIPFSHash,
            state: MOUType.ACTIVE
        });

        emit MembershipActivated(membershipAddr, stokvelContractIPFSHash);
    }

    /**
     * @notice Transfer membership from one address to another
     * @param newMember Address of the new member
     * @param fromMember Address of the existing member
     * @param stokvelTransferIPFSHash IPFS hash of the transfer agreement
     */
    function transferMembership(
        address fromMember,
        address newMember,
        string calldata stokvelTransferIPFSHash
    ) external onlyOwner onlyActiveMember(fromMember) whenNotPaused {
        require(
            newMember != address(0),
            "StokvelOnChain: Invalid new member address"
        );
        require(
            fromMember != address(0),
            "StokvelOnChain: Invalid member address"
        );
        require(
            members[newMember].state != MOUType.NONMEMBER,
            "StokvelOnChain: New member must join"
        );
        require(
            bytes(stokvelTransferIPFSHash).length > 0,
            "StokvelOnChain: IPFS hash required"
        );

        // Transfer all contribution tokens from old member to new member
        uint256 balance = balanceOf(fromMember, CONTRIBUTION_TOKEN_ID);
        if (balance > 0) {
            _safeTransferFrom(
                fromMember,
                newMember,
                CONTRIBUTION_TOKEN_ID,
                balance,
                ""
            );
        }

        if (members[newMember].state != MOUType.ACTIVE) {
            // Update membership states
            members[newMember] = Member({
                contractIPFSHash: stokvelTransferIPFSHash,
                state: MOUType.ACTIVE
            });
        }

        members[fromMember].contractIPFSHash = stokvelTransferIPFSHash;
        members[fromMember].state = MOUType.TRANSFERRED;

        emit MembershipTransferred(
            fromMember,
            newMember,
            stokvelTransferIPFSHash
        );
    }

    /**
     * @notice Terminate a member's membership
     * @param member Address of the member to terminate
     * @param stokvelTerminationIPFSHash IPFS hash of the termination agreement
     */
    function terminateMembership(
        address member,
        string calldata stokvelTerminationIPFSHash
    ) external onlyOwner onlyActiveMember(member) whenNotPaused {
        require(
            bytes(stokvelTerminationIPFSHash).length > 0,
            "StokvelOnChain: IPFS hash required"
        );

        uint256 balance = balanceOf(member, CONTRIBUTION_TOKEN_ID);

        members[member].contractIPFSHash = stokvelTerminationIPFSHash;
        members[member].state = MOUType.TERMINATED;

        // Burn all contribution tokens
        if (balance > 0) {
            _burn(member, CONTRIBUTION_TOKEN_ID, balance);
        }

        emit MembershipTerminated(member, stokvelTerminationIPFSHash);
    }

    // ==================== Contribution Functions ====================

    /**
     * @notice Make a contribution to the stokvel
     * @param amount Amount of contribution asset to deposit
     */
    function contribute(
        address membershipAddress,
        uint256 amount
    ) external nonReentrant onlyActiveMember(membershipAddress) whenNotPaused {
        require(
            contributionAsset != address(0),
            "StokvelOnChain: Contribution asset not set"
        );
        require(amount > 0, "StokvelOnChain: Amount must be greater than 0");

        // Transfer contribution asset from member to contract
        IERC20(contributionAsset).safeTransferFrom(
           membershipAddress,
            address(this),
            amount
        );

        // Mint contribution tokens (ID 1) to the member
        _mint(msg.sender, CONTRIBUTION_TOKEN_ID, amount, "");

        emit ContributionMade(msg.sender, amount);
    }

    // ==================== Governance Functions ====================

    /**
     * @notice Vote to approve an operator to use contributions
     * @param voter Address of the voting member
     * @param operator Address to grant permission to
     */
    function approveToUseContribution(
        address voter,
        address operator
    ) external onlyOwner whenNotPaused {
        require(
            operator != address(0),
            "StokvelOnChain: Invalid operator address"
        );
        require(
            members[voter].state == MOUType.ACTIVE,
            "StokvelOnChain: Voter must be active member"
        );

        uint256 voterWeight = balanceOf(voter, CONTRIBUTION_TOKEN_ID);
        require(
            voterWeight > 0,
            "StokvelOnChain: Voter has no contribution tokens"
        );

        quorum[operator] += voterWeight;

        emit ApprovedToUseContribution(
            voter,
            operator,
            voterWeight,
            quorum[operator],
            stokvelQuorum
        );
    }

    /**
     * @notice Grant permission to operator after quorum is reached
     * @param operator Address to grant permission to
     * @param amount Amount to approve for spending
     */
    function grantPermissionToUseContribution(
        address operator,
        uint256 amount
    ) external onlyOwner nonReentrant whenNotPaused {
        require(
            contributionAsset != address(0),
            "StokvelOnChain: Contribution asset not set"
        );
        require(
            operator != address(0),
            "StokvelOnChain: Invalid operator address"
        );
        require(amount > 0, "StokvelOnChain: Amount must be greater than 0");

        uint256 tempQuorum = quorum[operator];
        require(
            tempQuorum >= stokvelQuorum,
            "StokvelOnChain: Quorum not reached"
        );

        // Reset quorum for this operator
        quorum[operator] = 0;

        // Approve the operator to spend contribution assets
        IERC20(contributionAsset).approve(operator, amount);

        emit PermissionGrantedToUseContribution(
            operator,
            amount,
            contributionAsset,
            tempQuorum,
            stokvelQuorum
        );
    }

    /**
     * @notice Reset quorum for an operator (in case of governance changes)
     * @param operator Address of the operator
     */
    function resetQuorum(address operator) external onlyOwner {
        quorum[operator] = 0;
    }

    // ==================== Distribution Functions ====================

    /**
     * @notice Distribute contribution assets proportionally to a member
     * @param member Address of the member to receive distribution
     */
    function distributeContributionAsset(
        address member
    ) external onlyOwner nonReentrant whenNotPaused {
        require(
            contributionAsset != address(0),
            "StokvelOnChain: Contribution asset not set"
        );

        uint256 memberBalance = balanceOf(member, CONTRIBUTION_TOKEN_ID);
        require(memberBalance > 0, "StokvelOnChain: No contribution found");

        uint256 supply = totalSupply(CONTRIBUTION_TOKEN_ID);
        require(supply > 0, "StokvelOnChain: No total supply");

        uint256 contractBalance = IERC20(contributionAsset).balanceOf(
            address(this)
        );
        require(contractBalance > 0, "StokvelOnChain: No assets to distribute");

        // Calculate proportional amount
        uint256 amountToGiveMember = (contractBalance * memberBalance) / supply;
        require(amountToGiveMember > 0, "StokvelOnChain: Amount too small");

        // Burn member's contribution tokens
        _burn(member, CONTRIBUTION_TOKEN_ID, memberBalance);

        // Transfer contribution assets to member
        IERC20(contributionAsset).safeTransfer(member, amountToGiveMember);

        emit ContributionDistributed(member, amountToGiveMember);
    }

    /**
     * @notice Distribute to all active members (batch distribution)
     * @dev This should be used carefully as it can be gas-intensive
     * @param membersList Array of member addresses to distribute to
     */
    function batchDistributeContributionAsset(
        address[] calldata membersList
    ) external onlyOwner nonReentrant whenNotPaused {
        require(
            contributionAsset != address(0),
            "StokvelOnChain: Contribution asset not set"
        );
        require(membersList.length > 0, "StokvelOnChain: Empty members list");

        uint256 supply = totalSupply(CONTRIBUTION_TOKEN_ID);
        require(supply > 0, "StokvelOnChain: No total supply");

        uint256 contractBalance = IERC20(contributionAsset).balanceOf(
            address(this)
        );
        require(contractBalance > 0, "StokvelOnChain: No assets to distribute");

        for (uint256 i = 0; i < membersList.length; i++) {
            address member = membersList[i];
            uint256 memberBalance = balanceOf(member, CONTRIBUTION_TOKEN_ID);

            if (memberBalance > 0) {
                uint256 amountToGiveMember = (contractBalance * memberBalance) /
                    supply;

                if (amountToGiveMember > 0) {
                    _burn(member, CONTRIBUTION_TOKEN_ID, memberBalance);
                    IERC20(contributionAsset).safeTransfer(
                        member,
                        amountToGiveMember
                    );
                    emit ContributionDistributed(member, amountToGiveMember);
                }
            }
        }
    }

    // ==================== View Functions ====================

    /**
     * @notice Get member information
     * @param member Address of the member
     * @return Member struct containing IPFS hash and state
     */
    function getMember(address member) external view returns (Member memory) {
        return members[member];
    }

    /**
     * @notice Check if an address is an active member
     * @param member Address to check
     * @return True if member is active
     */
    function isActiveMember(address member) external view returns (bool) {
        return members[member].state == MOUType.ACTIVE;
    }

    /**
     * @notice Get current quorum for an operator
     * @param operator Address of the operator
     * @return Current quorum value
     */
    function getQuorum(address operator) external view returns (uint256) {
        return quorum[operator];
    }

    /**
     * @notice Get contribution balance for a member
     * @param member Address of the member
     * @return Balance of contribution tokens (ID 1)
     */
    function getContributionBalance(
        address member
    ) external view returns (uint256) {
        return balanceOf(member, CONTRIBUTION_TOKEN_ID);
    }

    /**
     * @notice Get total contributions in the stokvel
     * @return Total supply of contribution tokens
     */
    function getTotalContributions() external view returns (uint256) {
        return totalSupply(CONTRIBUTION_TOKEN_ID);
    }

    /**
     * @notice Get contract's balance of contribution asset
     * @return Balance of contribution asset held by contract
     */
    function getContributionAssetBalance() external view returns (uint256) {
        if (contributionAsset == address(0)) {
            return 0;
        }
        return IERC20(contributionAsset).balanceOf(address(this));
    }

    /**
     * @notice Update base URI for metadata
     * @param newuri New base URI
     */
    function setURI(string memory newuri) external onlyOwner {
        _setURI(newuri);
    }

    // ==================== Required Overrides ====================

    /**
     * @notice Override _update to add pause functionality
     */
    function _update(
        address from,
        address to,
        uint256[] memory ids,
        uint256[] memory values
    ) internal virtual override whenNotPaused {
        super._update(from, to, ids, values);
    }
}
