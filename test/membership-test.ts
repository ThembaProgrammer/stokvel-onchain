import { expect } from "chai";
import { network } from "hardhat";
import type { Membership, MockERC20, StokvelOnChain } from "../types/ethers-contracts/index.js";
import type { HardhatEthersSigner } from "@nomicfoundation/hardhat-ethers/types";
import { parseUnits, keccak256, toUtf8Bytes, TypedDataEncoder, ethers } from "ethers";

const ZeroAddress = '0x0000000000000000000000000000000000000000';
const ZeroBytes32 = '0x0000000000000000000000000000000000000000000000000000000000000000';
const contribution_asset_decimals = 18;

describe("Membership", function () {
    async function deployMembershipFixture() {
        const connection = await network.connect();
        const { ethers } = connection;

        const [owner, claimant1, claimant2, other]: HardhatEthersSigner[] = await ethers.getSigners();

        const membershipFactory = await ethers.deployContract("MembershipFactory", []);
        await membershipFactory.waitForDeployment();

        const token: MockERC20 = await ethers.deployContract("MockERC20", ["RandCoin", "RZAR", contribution_asset_decimals]) as MockERC20;
        await token.waitForDeployment();

        const initialBalance = parseUnits("10000", contribution_asset_decimals);
        await token.mint(claimant1.address, initialBalance);
        await token.mint(claimant2.address, initialBalance);

        const quorum = parseUnits("200", contribution_asset_decimals);
        const stokvelContract: StokvelOnChain = await ethers.deployContract("StokvelOnChain", [
            '/StokvelOnchain/stokvelOne',
            quorum,
            await token.getAddress(),
            await membershipFactory.getAddress()
        ]) as StokvelOnChain;
        await stokvelContract.waitForDeployment();

        const email = "test@example.com";
        const emailHash = keccak256(toUtf8Bytes(email));
        const stokvelAddress = await stokvelContract.getAddress();

        // Deploy Membership contract
        const membership: Membership = await ethers.deployContract("Membership", [
            stokvelAddress,
            await token.getAddress(),
            emailHash
        ]) as Membership;
        await membership.waitForDeployment();

        return {
            membership,
            token,
            owner,
            stokvelContract,
            stokvelAddress,
            claimant1,
            claimant2,
            other,
            email,
            emailHash
        };
    }

    async function deployStokvelForSignature() {
        const connection = await network.connect();
        const { ethers } = connection;

        const [owner, member1]: HardhatEthersSigner[] = await ethers.getSigners();

        const membershipFactory = await ethers.deployContract("MembershipFactory", []);
        await membershipFactory.waitForDeployment();

        const rand: MockERC20 = await ethers.deployContract("MockERC20", [
            "RandCoin",
            "RZAR",
            contribution_asset_decimals
        ]) as MockERC20;
        await rand.waitForDeployment();

        const quorum = parseUnits("200", contribution_asset_decimals);
        const stokvel: StokvelOnChain = await ethers.deployContract("StokvelOnChain", [
            '/StokvelOnchain/stokvelOne',
            quorum,
            await rand.getAddress(),
            await membershipFactory.getAddress()
        ]) as StokvelOnChain;
        await stokvel.waitForDeployment();

        const email = "test@example.com";
        const emailHash = keccak256(toUtf8Bytes(email));

        // Deploy Membership through factory or directly
        const membership: Membership = await ethers.deployContract("Membership", [
            await stokvel.getAddress(),
            await rand.getAddress(),
            emailHash
        ]) as Membership;
        await membership.waitForDeployment();

        return { stokvel, membership, rand, owner, member1, email, emailHash };
    }

    describe("Deployment", function () {
        it("Should set stokvel contract address", async function () {
            const { membership, stokvelContract, stokvelAddress } = await deployMembershipFixture();
            expect(await membership.stokvelContract()).to.equal(stokvelAddress);
        });

        it("Should set contribution asset address", async function () {
            const { membership, token } = await deployMembershipFixture();
            expect(await membership.contributionAsset()).to.equal(await token.getAddress());
        });

        it("Should set email hash", async function () {
            const { membership, emailHash } = await deployMembershipFixture();
            expect(await membership.emailHash()).to.equal(emailHash);
        });

        it("Should set DOMAIN_SEPARATOR", async function () {
            const { membership } = await deployMembershipFixture();
            const domainSeparator = await membership.DOMAIN_SEPARATOR();
            expect(domainSeparator).to.not.equal(ZeroBytes32);
        });

        it("Should set CLAIM_TYPEHASH", async function () {
            const { membership } = await deployMembershipFixture();
            const typehash = await membership.CLAIM_TYPEHASH();
            const expectedTypehash = keccak256(
                toUtf8Bytes("ClaimMembership(bytes32 emailHash,address claimant,uint256 deadline)")
            );
            expect(typehash).to.equal(expectedTypehash);
        });

        it("Should initialize with no claimant", async function () {
            const { membership } = await deployMembershipFixture();
            expect(await membership.claimant()).to.equal(ZeroAddress);
        });

        it("Should auto-approve stokvel for max amount", async function () {
            const { membership, token, stokvelAddress } = await deployMembershipFixture();
            const allowance = await token.allowance(
                await membership.getAddress(),
                stokvelAddress
            );
            expect(allowance).to.equal(ethers.MaxUint256);
        });

        it("Should revert if stokvel address is zero", async function () {
            const connection = await network.connect();
            const { ethers } = connection;

            const token: MockERC20 = await ethers.deployContract("MockERC20", [
                "TestToken",
                "TEST",
                contribution_asset_decimals
            ]) as MockERC20;
            await token.waitForDeployment();

            const emailHash = keccak256(toUtf8Bytes("test@example.com"));

            await expect(
                ethers.deployContract("Membership", [
                    ZeroAddress,
                    await token.getAddress(),
                    emailHash
                ])
            ).to.be.revertedWithCustomError(
                await ethers.getContractFactory("Membership"),
                "InvalidStokvelAddress"
            );
        });

        it("Should revert if contribution asset is zero", async function () {
            const connection = await network.connect();
            const { ethers } = connection;

            const [, stokvel] = await ethers.getSigners();
            const emailHash = keccak256(toUtf8Bytes("test@example.com"));

            await expect(
                ethers.deployContract("Membership", [
                    stokvel.address,
                    ZeroAddress,
                    emailHash
                ])
            ).to.be.revertedWithCustomError(
                await ethers.getContractFactory("Membership"),
                "InvalidAssetAddress"
            );
        });

        it("Should revert if email hash is zero", async function () {
            const connection = await network.connect();
            const { ethers } = connection;

            const [, stokvel] = await ethers.getSigners();
            const token: MockERC20 = await ethers.deployContract("MockERC20", [
                "TestToken",
                "TEST",
                contribution_asset_decimals
            ]) as MockERC20;
            await token.waitForDeployment();

            await expect(
                ethers.deployContract("Membership", [
                    stokvel.address,
                    await token.getAddress(),
                    ZeroBytes32
                ])
            ).to.be.revertedWithCustomError(
                await ethers.getContractFactory("Membership"),
                "InvalidEmailHash"
            );
        });
    });

    describe("Claim Membership", function () {
        it("Should claim membership with valid signature", async function () {
            const { stokvel, membership, owner, member1, emailHash } = await deployStokvelForSignature();

            const claimant = member1.address;
            const deadline = Math.floor(Date.now() / 1000) + 3600; // 1 hour from now

            // Create EIP-712 signature
            const domain = {
                name: "StokvelMembership",
                version: "1",
                chainId: (await owner.provider!.getNetwork()).chainId,
                verifyingContract: await membership.getAddress()
            };

            const types = {
                ClaimMembership: [
                    { name: "emailHash", type: "bytes32" },
                    { name: "claimant", type: "address" },
                    { name: "deadline", type: "uint256" }
                ]
            };

            const value = {
                emailHash: emailHash,
                claimant: claimant,
                deadline: deadline
            };

            const signature = await owner.signTypedData(domain, types, value);

            await membership.connect(member1).claim(claimant, deadline, signature);

            expect(await membership.claimant()).to.equal(claimant);
        });

        it("Should emit MembershipClaimed event", async function () {
            const { stokvel, membership, owner, member1, emailHash } = await deployStokvelForSignature();

            const claimant = member1.address;
            const deadline = Math.floor(Date.now() / 1000) + 3600;

            const domain = {
                name: "StokvelMembership",
                version: "1",
                chainId: (await owner.provider!.getNetwork()).chainId,
                verifyingContract: await membership.getAddress()
            };

            const types = {
                ClaimMembership: [
                    { name: "emailHash", type: "bytes32" },
                    { name: "claimant", type: "address" },
                    { name: "deadline", type: "uint256" }
                ]
            };

            const value = {
                emailHash: emailHash,
                claimant: claimant,
                deadline: deadline
            };

            const signature = await owner.signTypedData(domain, types, value);

            await expect(membership.connect(member1).claim(claimant, deadline, signature))
                .to.emit(membership, "MembershipClaimed")
                .withArgs(claimant, emailHash);
        });

        it("Should revert if already claimed", async function () {
            const { stokvel, membership, owner, member1, emailHash } = await deployStokvelForSignature();

            const claimant = member1.address;
            const deadline = Math.floor(Date.now() / 1000) + 3600;

            const domain = {
                name: "StokvelMembership",
                version: "1",
                chainId: (await owner.provider!.getNetwork()).chainId,
                verifyingContract: await membership.getAddress()
            };

            const types = {
                ClaimMembership: [
                    { name: "emailHash", type: "bytes32" },
                    { name: "claimant", type: "address" },
                    { name: "deadline", type: "uint256" }
                ]
            };

            const value = {
                emailHash: emailHash,
                claimant: claimant,
                deadline: deadline
            };

            const signature = await owner.signTypedData(domain, types, value);

            await membership.connect(member1).claim(claimant, deadline, signature);

            await expect(
                membership.connect(member1).claim(claimant, deadline, signature)
            ).to.be.revertedWithCustomError(membership, "AlreadyClaimed");
        });

        it("Should revert if claimant is zero address", async function () {
            const { membership, owner, emailHash } = await deployStokvelForSignature();

            const deadline = Math.floor(Date.now() / 1000) + 3600;

            const domain = {
                name: "StokvelMembership",
                version: "1",
                chainId: (await owner.provider!.getNetwork()).chainId,
                verifyingContract: await membership.getAddress()
            };

            const types = {
                ClaimMembership: [
                    { name: "emailHash", type: "bytes32" },
                    { name: "claimant", type: "address" },
                    { name: "deadline", type: "uint256" }
                ]
            };

            const value = {
                emailHash: emailHash,
                claimant: ZeroAddress,
                deadline: deadline
            };

            const signature = await owner.signTypedData(domain, types, value);

            await expect(
                membership.claim(ZeroAddress, deadline, signature)
            ).to.be.revertedWithCustomError(membership, "InvalidClaimant");
        });

        it("Should revert if deadline has passed", async function () {
            const { membership, owner, member1, emailHash } = await deployStokvelForSignature();

            const claimant = member1.address;
            const deadline = Math.floor(Date.now() / 1000) - 3600; // 1 hour ago

            const domain = {
                name: "StokvelMembership",
                version: "1",
                chainId: (await owner.provider!.getNetwork()).chainId,
                verifyingContract: await membership.getAddress()
            };

            const types = {
                ClaimMembership: [
                    { name: "emailHash", type: "bytes32" },
                    { name: "claimant", type: "address" },
                    { name: "deadline", type: "uint256" }
                ]
            };

            const value = {
                emailHash: emailHash,
                claimant: claimant,
                deadline: deadline
            };

            const signature = await owner.signTypedData(domain, types, value);

            await expect(
                membership.claim(claimant, deadline, signature)
            ).to.be.revertedWithCustomError(membership, "SignatureExpired");
        });

        it("Should revert if signature is from wrong signer", async function () {
            const { membership, member1, emailHash } = await deployStokvelForSignature();

            const claimant = member1.address;
            const deadline = Math.floor(Date.now() / 1000) + 3600;

            const domain = {
                name: "StokvelMembership",
                version: "1",
                chainId: (await member1.provider!.getNetwork()).chainId,
                verifyingContract: await membership.getAddress()
            };

            const types = {
                ClaimMembership: [
                    { name: "emailHash", type: "bytes32" },
                    { name: "claimant", type: "address" },
                    { name: "deadline", type: "uint256" }
                ]
            };

            const value = {
                emailHash: emailHash,
                claimant: claimant,
                deadline: deadline
            };

            // Sign with wrong signer (member1 instead of owner)
            const signature = await member1.signTypedData(domain, types, value);

            await expect(
                membership.claim(claimant, deadline, signature)
            ).to.be.revertedWithCustomError(membership, "InvalidSignature");
        });

        it("Should revert if signature parameters don't match", async function () {
            const { membership, owner, member1, emailHash } = await deployStokvelForSignature();

            const claimant = member1.address;
            const deadline = Math.floor(Date.now() / 1000) + 3600;

            const domain = {
                name: "StokvelMembership",
                version: "1",
                chainId: (await owner.provider!.getNetwork()).chainId,
                verifyingContract: await membership.getAddress()
            };

            const types = {
                ClaimMembership: [
                    { name: "emailHash", type: "bytes32" },
                    { name: "claimant", type: "address" },
                    { name: "deadline", type: "uint256" }
                ]
            };

            const value = {
                emailHash: emailHash,
                claimant: claimant,
                deadline: deadline
            };

            const signature = await owner.signTypedData(domain, types, value);

            // Try to claim with different deadline
            const wrongDeadline = deadline + 1000;
            await expect(
                membership.claim(claimant, wrongDeadline, signature)
            ).to.be.revertedWithCustomError(membership, "InvalidSignature");
        });
    });

    describe("Withdraw", function () {
        it("Should withdraw tokens to claimant", async function () {
            const { stokvel, membership, rand, owner, member1, emailHash } = await deployStokvelForSignature();

            // Claim membership first
            const claimant = member1.address;
            const deadline = Math.floor(Date.now() / 1000) + 3600;

            const domain = {
                name: "StokvelMembership",
                version: "1",
                chainId: (await owner.provider!.getNetwork()).chainId,
                verifyingContract: await membership.getAddress()
            };

            const types = {
                ClaimMembership: [
                    { name: "emailHash", type: "bytes32" },
                    { name: "claimant", type: "address" },
                    { name: "deadline", type: "uint256" }
                ]
            };

            const value = {
                emailHash: emailHash,
                claimant: claimant,
                deadline: deadline
            };

            const signature = await owner.signTypedData(domain, types, value);
            await membership.claim(claimant, deadline, signature);

            // Fund membership with tokens
            const amount = parseUnits("100", contribution_asset_decimals);
            await rand.mint(await membership.getAddress(), amount);

            const balanceBefore = await rand.balanceOf(claimant);

            await membership.connect(member1).withdraw(await rand.getAddress(), amount);

            const balanceAfter = await rand.balanceOf(claimant);
            expect(balanceAfter - balanceBefore).to.equal(amount);
        });

        it("Should emit Withdrawal event", async function () {
            const { stokvel, membership, rand, owner, member1, emailHash } = await deployStokvelForSignature();

            const claimant = member1.address;
            const deadline = Math.floor(Date.now() / 1000) + 3600;

            const domain = {
                name: "StokvelMembership",
                version: "1",
                chainId: (await owner.provider!.getNetwork()).chainId,
                verifyingContract: await membership.getAddress()
            };

            const types = {
                ClaimMembership: [
                    { name: "emailHash", type: "bytes32" },
                    { name: "claimant", type: "address" },
                    { name: "deadline", type: "uint256" }
                ]
            };

            const value = {
                emailHash: emailHash,
                claimant: claimant,
                deadline: deadline
            };

            const signature = await owner.signTypedData(domain, types, value);
            await membership.claim(claimant, deadline, signature);

            const amount = parseUnits("100", contribution_asset_decimals);
            await rand.mint(await membership.getAddress(), amount);

            await expect(membership.connect(member1).withdraw(await rand.getAddress(), amount))
                .to.emit(membership, "Withdrawal")
                .withArgs(await rand.getAddress(), amount, claimant);
        });

        it("Should revert if not claimed", async function () {
            const { membership, token } = await deployMembershipFixture();

            const amount = parseUnits("100", contribution_asset_decimals);

            await expect(
                membership.withdraw(await token.getAddress(), amount)
            ).to.be.revertedWithCustomError(membership, "NotClaimed");
        });

        it("Should revert if caller is not claimant", async function () {
            const { stokvel, membership, rand, owner, member1, emailHash } = await deployStokvelForSignature();

            const claimant = member1.address;
            const deadline = Math.floor(Date.now() / 1000) + 3600;

            const domain = {
                name: "StokvelMembership",
                version: "1",
                chainId: (await owner.provider!.getNetwork()).chainId,
                verifyingContract: await membership.getAddress()
            };

            const types = {
                ClaimMembership: [
                    { name: "emailHash", type: "bytes32" },
                    { name: "claimant", type: "address" },
                    { name: "deadline", type: "uint256" }
                ]
            };

            const value = {
                emailHash: emailHash,
                claimant: claimant,
                deadline: deadline
            };

            const signature = await owner.signTypedData(domain, types, value);
            await membership.claim(claimant, deadline, signature);

            const amount = parseUnits("100", contribution_asset_decimals);

            await expect(
                membership.connect(owner).withdraw(await rand.getAddress(), amount)
            ).to.be.revertedWithCustomError(membership, "OnlyClaimant");
        });

        it("Should revert if amount is zero", async function () {
            const { stokvel, membership, rand, owner, member1, emailHash } = await deployStokvelForSignature();

            const claimant = member1.address;
            const deadline = Math.floor(Date.now() / 1000) + 3600;

            const domain = {
                name: "StokvelMembership",
                version: "1",
                chainId: (await owner.provider!.getNetwork()).chainId,
                verifyingContract: await membership.getAddress()
            };

            const types = {
                ClaimMembership: [
                    { name: "emailHash", type: "bytes32" },
                    { name: "claimant", type: "address" },
                    { name: "deadline", type: "uint256" }
                ]
            };

            const value = {
                emailHash: emailHash,
                claimant: claimant,
                deadline: deadline
            };

            const signature = await owner.signTypedData(domain, types, value);
            await membership.claim(claimant, deadline, signature);

            await expect(
                membership.connect(member1).withdraw(await rand.getAddress(), 0)
            ).to.be.revertedWithCustomError(membership, "InvalidAmount");
        });
    });

    describe("Withdraw To", function () {
        it("Should withdraw tokens to specified recipient", async function () {
            const { stokvel, membership, rand, owner, member1, emailHash } = await deployStokvelForSignature();

            const claimant = member1.address;
            const deadline = Math.floor(Date.now() / 1000) + 3600;

            const domain = {
                name: "StokvelMembership",
                version: "1",
                chainId: (await owner.provider!.getNetwork()).chainId,
                verifyingContract: await membership.getAddress()
            };

            const types = {
                ClaimMembership: [
                    { name: "emailHash", type: "bytes32" },
                    { name: "claimant", type: "address" },
                    { name: "deadline", type: "uint256" }
                ]
            };

            const value = {
                emailHash: emailHash,
                claimant: claimant,
                deadline: deadline
            };

            const signature = await owner.signTypedData(domain, types, value);
            await membership.claim(claimant, deadline, signature);

            const amount = parseUnits("100", contribution_asset_decimals);
            await rand.mint(await membership.getAddress(), amount);

            const recipient = owner.address;
            const balanceBefore = await rand.balanceOf(recipient);

            await membership.connect(member1).withdrawTo(await rand.getAddress(), amount, recipient);

            const balanceAfter = await rand.balanceOf(recipient);
            expect(balanceAfter - balanceBefore).to.equal(amount);
        });

        it("Should emit Withdrawal event with recipient", async function () {
            const { stokvel, membership, rand, owner, member1, emailHash } = await deployStokvelForSignature();

            const claimant = member1.address;
            const deadline = Math.floor(Date.now() / 1000) + 3600;

            const domain = {
                name: "StokvelMembership",
                version: "1",
                chainId: (await owner.provider!.getNetwork()).chainId,
                verifyingContract: await membership.getAddress()
            };

            const types = {
                ClaimMembership: [
                    { name: "emailHash", type: "bytes32" },
                    { name: "claimant", type: "address" },
                    { name: "deadline", type: "uint256" }
                ]
            };

            const value = {
                emailHash: emailHash,
                claimant: claimant,
                deadline: deadline
            };

            const signature = await owner.signTypedData(domain, types, value);
            await membership.claim(claimant, deadline, signature);

            const amount = parseUnits("100", contribution_asset_decimals);
            await rand.mint(await membership.getAddress(), amount);

            const recipient = owner.address;

            await expect(membership.connect(member1).withdrawTo(await rand.getAddress(), amount, recipient))
                .to.emit(membership, "Withdrawal")
                .withArgs(await rand.getAddress(), amount, recipient);
        });

        it("Should revert if not claimed", async function () {
            const { membership, token, claimant1 } = await deployMembershipFixture();

            const amount = parseUnits("100", contribution_asset_decimals);

            await expect(
                membership.withdrawTo(await token.getAddress(), amount, claimant1.address)
            ).to.be.revertedWithCustomError(membership, "NotClaimed");
        });

        it("Should revert if caller is not claimant", async function () {
            const { stokvel, membership, rand, owner, member1, emailHash } = await deployStokvelForSignature();

            const claimant = member1.address;
            const deadline = Math.floor(Date.now() / 1000) + 3600;

            const domain = {
                name: "StokvelMembership",
                version: "1",
                chainId: (await owner.provider!.getNetwork()).chainId,
                verifyingContract: await membership.getAddress()
            };

            const types = {
                ClaimMembership: [
                    { name: "emailHash", type: "bytes32" },
                    { name: "claimant", type: "address" },
                    { name: "deadline", type: "uint256" }
                ]
            };

            const value = {
                emailHash: emailHash,
                claimant: claimant,
                deadline: deadline
            };

            const signature = await owner.signTypedData(domain, types, value);
            await membership.claim(claimant, deadline, signature);

            const amount = parseUnits("100", contribution_asset_decimals);

            await expect(
                membership.connect(owner).withdrawTo(await rand.getAddress(), amount, owner.address)
            ).to.be.revertedWithCustomError(membership, "OnlyClaimant");
        });

        it("Should revert if recipient is zero address", async function () {
            const { stokvel, membership, rand, owner, member1, emailHash } = await deployStokvelForSignature();

            const claimant = member1.address;
            const deadline = Math.floor(Date.now() / 1000) + 3600;

            const domain = {
                name: "StokvelMembership",
                version: "1",
                chainId: (await owner.provider!.getNetwork()).chainId,
                verifyingContract: await membership.getAddress()
            };

            const types = {
                ClaimMembership: [
                    { name: "emailHash", type: "bytes32" },
                    { name: "claimant", type: "address" },
                    { name: "deadline", type: "uint256" }
                ]
            };

            const value = {
                emailHash: emailHash,
                claimant: claimant,
                deadline: deadline
            };

            const signature = await owner.signTypedData(domain, types, value);
            await membership.claim(claimant, deadline, signature);

            const amount = parseUnits("100", contribution_asset_decimals);

            await expect(
                membership.connect(member1).withdrawTo(await rand.getAddress(), amount, ZeroAddress)
            ).to.be.revertedWithCustomError(membership, "InvalidRecipient");
        });

        it("Should revert if amount is zero", async function () {
            const { stokvel, membership, rand, owner, member1, emailHash } = await deployStokvelForSignature();

            const claimant = member1.address;
            const deadline = Math.floor(Date.now() / 1000) + 3600;

            const domain = {
                name: "StokvelMembership",
                version: "1",
                chainId: (await owner.provider!.getNetwork()).chainId,
                verifyingContract: await membership.getAddress()
            };

            const types = {
                ClaimMembership: [
                    { name: "emailHash", type: "bytes32" },
                    { name: "claimant", type: "address" },
                    { name: "deadline", type: "uint256" }
                ]
            };

            const value = {
                emailHash: emailHash,
                claimant: claimant,
                deadline: deadline
            };

            const signature = await owner.signTypedData(domain, types, value);
            await membership.claim(claimant, deadline, signature);

            await expect(
                membership.connect(member1).withdrawTo(await rand.getAddress(), 0, owner.address)
            ).to.be.revertedWithCustomError(membership, "InvalidAmount");
        });
    });

    describe("View Functions", function () {
        it("Should return false for isClaimed when not claimed", async function () {
            const { membership } = await deployMembershipFixture();
            expect(await membership.isClaimed()).to.equal(false);
        });

        it("Should return true for isClaimed when claimed", async function () {
            const { stokvel, membership, owner, member1, emailHash } = await deployStokvelForSignature();

            const claimant = member1.address;
            const deadline = Math.floor(Date.now() / 1000) + 3600;

            const domain = {
                name: "StokvelMembership",
                version: "1",
                chainId: (await owner.provider!.getNetwork()).chainId,
                verifyingContract: await membership.getAddress()
            };

            const types = {
                ClaimMembership: [
                    { name: "emailHash", type: "bytes32" },
                    { name: "claimant", type: "address" },
                    { name: "deadline", type: "uint256" }
                ]
            };

            const value = {
                emailHash: emailHash,
                claimant: claimant,
                deadline: deadline
            };

            const signature = await owner.signTypedData(domain, types, value);
            await membership.claim(claimant, deadline, signature);

            expect(await membership.isClaimed()).to.equal(true);
        });

        it("Should return correct token balance", async function () {
            const { membership, token } = await deployMembershipFixture();

            const amount = parseUnits("100", contribution_asset_decimals);
            await token.mint(await membership.getAddress(), amount);

            const balance = await membership.getBalance(await token.getAddress());
            expect(balance).to.equal(amount);
        });

        it("Should return zero balance when no tokens", async function () {
            const { membership, token } = await deployMembershipFixture();

            const balance = await membership.getBalance(await token.getAddress());
            expect(balance).to.equal(0);
        });

        it("Should return claimant address when claimed", async function () {
            const { stokvel, membership, owner, member1, emailHash } = await deployStokvelForSignature();

            const claimant = member1.address;
            const deadline = Math.floor(Date.now() / 1000) + 3600;

            const domain = {
                name: "StokvelMembership",
                version: "1",
                chainId: (await owner.provider!.getNetwork()).chainId,
                verifyingContract: await membership.getAddress()
            };

            const types = {
                ClaimMembership: [
                    { name: "emailHash", type: "bytes32" },
                    { name: "claimant", type: "address" },
                    { name: "deadline", type: "uint256" }
                ]
            };

            const value = {
                emailHash: emailHash,
                claimant: claimant,
                deadline: deadline
            };

            const signature = await owner.signTypedData(domain, types, value);
            await membership.claim(claimant, deadline, signature);

            expect(await membership.claimant()).to.equal(claimant);
        });

        it("Should return zero address for claimant when not claimed", async function () {
            const { membership } = await deployMembershipFixture();
            expect(await membership.claimant()).to.equal(ZeroAddress);
        });
    });
});