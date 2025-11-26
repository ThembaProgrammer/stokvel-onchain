// SPDX-License-Identifier: MIT
pragma solidity ^0.8.28;

import "@openzeppelin/contracts/token/ERC20/IERC20.sol";
import "@openzeppelin/contracts/utils/Context.sol";
import "@openzeppelin/contracts/utils/cryptography/ECDSA.sol";
import "@openzeppelin/contracts/access/Ownable.sol";
import "@openzeppelin/contracts/token/ERC1155/IERC1155Receiver.sol";
/**
 * @title Membership
 * @notice Individual membership contract deployed via CREATE2 for each stokvel member
 * @dev Email-based identity with optional claiming via EIP-712 signature
 *
 * Features:
 * - Deterministic deployment via CREATE2 using email hash as salt
 * - Unclaimed state: Managed by StokvelOnChain contract
 * - Claimed state: Controlled by user's EOA/smart wallet
 * - Auto-approves StokvelOnChain for contribution asset transfers
 * - Account abstraction compatible via Context
 */
contract Membership is Context, IERC1155Receiver {
    using ECDSA for bytes32;

    // Custom Errors
    error InvalidStokvelAddress();
    error InvalidAssetAddress();
    error InvalidEmailHash();
    error AlreadyClaimed();
    error InvalidClaimant();
    error SignatureExpired();
    error InvalidSignature();
    error NotClaimed();
    error OnlyClaimant();
    error InvalidRecipient();
    error InvalidAmount();

    // Immutable configuration
    address public immutable stokvelContract;
    address public immutable contributionAsset;
    bytes32 public immutable emailHash;

    // Claim state
    address public claimant; // address(0) = unclaimed, non-zero = claimed

    // EIP-712 Domain
    bytes32 public immutable DOMAIN_SEPARATOR;
    bytes32 public constant CLAIM_TYPEHASH =
        keccak256(
            "ClaimMembership(bytes32 emailHash,address claimant,uint256 deadline)"
        );

    // Events
    event MembershipClaimed(address indexed claimant, bytes32 emailHash);
    event Withdrawal(
        address indexed token,
        uint256 amount,
        address indexed recipient
    );

    /**
     * @notice Constructor - called by StokvelOnChain via CREATE2
     * @param _stokvel Address of the StokvelOnChain contract
     * @param _contributionAsset ERC20 token used for contributions
     * @param _emailHash keccak256 hash of member's email
     */
    constructor(
        address _stokvel,
        address _contributionAsset,
        bytes32 _emailHash
    ) {
        if (_stokvel == address(0)) revert InvalidStokvelAddress();
        if (_contributionAsset == address(0)) revert InvalidAssetAddress();
        if (_emailHash == bytes32(0)) revert InvalidEmailHash();

        stokvelContract = _stokvel;
        contributionAsset = _contributionAsset;
        emailHash = _emailHash;

        // Set EIP-712 domain separator
        DOMAIN_SEPARATOR = keccak256(
            abi.encode(
                keccak256(
                    "EIP712Domain(string name,string version,uint256 chainId,address verifyingContract)"
                ),
                keccak256("StokvelMembership"),
                keccak256("1"),
                block.chainid,
                address(this)
            )
        );

        // Grant infinite approval to StokvelOnChain for contribution asset
        IERC20(_contributionAsset).approve(_stokvel, type(uint256).max);
    }

    /**
     * @notice Claim membership ownership using EIP-712 signature
     * @dev Signature must be from StokvelOnChain owner
     * @param _claimant Address that will own this membership
     * @param _deadline Signature expiration timestamp
     * @param _signature EIP-712 signature from StokvelOnChain owner
     */
    function claim(
        address _claimant,
        uint256 _deadline,
        bytes memory _signature
    ) external {
        if (claimant != address(0)) revert AlreadyClaimed();
        if (_claimant == address(0)) revert InvalidClaimant();
        if (block.timestamp > _deadline) revert SignatureExpired();

        // Build EIP-712 hash
        bytes32 structHash = keccak256(
            abi.encode(CLAIM_TYPEHASH, emailHash, _claimant, _deadline)
        );

        bytes32 digest = keccak256(
            abi.encodePacked("\x19\x01", DOMAIN_SEPARATOR, structHash)
        );

        // Recover signer and verify it's the StokvelOnChain owner
        address signer = digest.recover(_signature);
        if (signer != Ownable(stokvelContract).owner())
            revert InvalidSignature();

        claimant = _claimant;
        emit MembershipClaimed(_claimant, emailHash);
    }

    /**
     * @notice Withdraw tokens to claimant's address
     * @dev Only callable by claimant, typically after distribution
     * @param token Token address to withdraw
     * @param amount Amount to withdraw
     */
    function withdraw(address token, uint256 amount) external {
        if (claimant == address(0)) revert NotClaimed();
        if (_msgSender() != claimant) revert OnlyClaimant();
        if (amount == 0) revert InvalidAmount();

        IERC20(token).transfer(claimant, amount);
        emit Withdrawal(token, amount, claimant);
    }

    /**
     * @notice Withdraw tokens to a specified recipient
     * @dev Useful for smart wallets or custom withdrawal strategies
     * @param token Token address to withdraw
     * @param amount Amount to withdraw
     * @param recipient Address to receive tokens
     */
    function withdrawTo(
        address token,
        uint256 amount,
        address recipient
    ) external {
        if (claimant == address(0)) revert NotClaimed();
        if (_msgSender() != claimant) revert OnlyClaimant();
        if (recipient == address(0)) revert InvalidRecipient();
        if (amount == 0) revert InvalidAmount();

        IERC20(token).transfer(recipient, amount);
        emit Withdrawal(token, amount, recipient);
    }

    /**
     * @notice Check if membership has been claimed
     * @return True if membership has a claimant
     */
    function isClaimed() external view returns (bool) {
        return claimant != address(0);
    }

    /**
     * @notice Get token balance of this membership contract
     * @param token Token address to check
     * @return Token balance
     */
    function getBalance(address token) external view returns (uint256) {
        return IERC20(token).balanceOf(address(this));
    }

    function onERC1155Received(
        address,
        address,
        uint256,
        uint256,
        bytes calldata
    ) external pure override returns (bytes4) {
        return this.onERC1155Received.selector;
    }

    function onERC1155BatchReceived(
        address,
        address,
        uint256[] calldata,
        uint256[] calldata,
        bytes calldata
    ) external pure override returns (bytes4) {
        return this.onERC1155BatchReceived.selector;
    }

    function supportsInterface(
        bytes4 interfaceId
    ) public view virtual override returns (bool) {
        return interfaceId == type(IERC1155Receiver).interfaceId;
    }
}
