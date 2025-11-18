// SPDX-License-Identifier: MIT
pragma solidity ^0.8.28;

import "./Membership.sol";

contract MembershipFactory {
    error InvalidStokvelAddress();
    error InvalidAssetAddress();
    error InvalidEmailHash();

    event MembershipDeployed(address indexed membership, bytes32 emailHash);

    function computeMembershipAddress(
        address stokvel,
        address asset,
        bytes32 emailHash
    ) public view returns (address) {
        bytes memory bytecode = abi.encodePacked(
            type(Membership).creationCode,
            abi.encode(stokvel, asset, emailHash)
        );
        return
            address(
                uint160(
                    uint256(
                        keccak256(
                            abi.encodePacked(
                                bytes1(0xff),
                                address(this),
                                emailHash,
                                keccak256(bytecode)
                            )
                        )
                    )
                )
            );
    }

    function deployMembership(
        address stokvel,
        address asset,
        bytes32 emailHash
    ) external returns (address membership) {
        if (stokvel == address(0)) revert InvalidStokvelAddress();
        if (asset == address(0)) revert InvalidAssetAddress();
        if (emailHash == bytes32(0)) revert InvalidEmailHash();

        Membership deployed = new Membership{salt: emailHash}(
            stokvel,
            asset,
            emailHash
        );
        membership = address(deployed);
        emit MembershipDeployed(membership, emailHash);
    }
}
