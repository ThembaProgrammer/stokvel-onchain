import { expect } from "chai";
import { network } from "hardhat";
import type { MembershipFactory, Membership, MockERC20, StokvelOnChain } from "../types/ethers-contracts/index.js";
import type { HardhatEthersSigner } from "@nomicfoundation/hardhat-ethers/types";
import { parseUnits, keccak256, toUtf8Bytes, ethers } from "ethers";

const ZeroAddress = '0x0000000000000000000000000000000000000000';
const ZeroBytes32 = '0x0000000000000000000000000000000000000000000000000000000000000000';
const contribution_asset_decimals = 18;

describe("MembershipFactory", function () {
    async function deployFactoryFixture() {
        const connection = await network.connect();
        const { ethers } = connection;

        const [owner, user1, user2]: HardhatEthersSigner[] = await ethers.getSigners();

        const membershipFactory: MembershipFactory = await ethers.deployContract("MembershipFactory", []) as MembershipFactory;
        await membershipFactory.waitForDeployment();

        const token: MockERC20 = await ethers.deployContract("MockERC20", ["RandCoin", "RZAR", contribution_asset_decimals]) as MockERC20;
        await token.waitForDeployment();

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

        return {
            membershipFactory,
            token,
            stokvelContract,
            owner,
            user1,
            user2,
            email,
            emailHash
        };
    }

    describe("Deployment", function () {
        it("Should deploy MembershipFactory successfully", async function () {
            const { membershipFactory } = await deployFactoryFixture();
            expect(await membershipFactory.getAddress()).to.not.equal(ZeroAddress);
        });
    });

    describe("computeMembershipAddress", function () {
        it("Should compute deterministic address", async function () {
            const { membershipFactory, stokvelContract, token, emailHash } = await deployFactoryFixture();

            const computedAddress = await membershipFactory.computeMembershipAddress(
                await stokvelContract.getAddress(),
                await token.getAddress(),
                emailHash
            );

            expect(computedAddress).to.not.equal(ZeroAddress);
            expect(computedAddress).to.match(/^0x[a-fA-F0-9]{40}$/);
        });

        it("Should compute same address for same inputs", async function () {
            const { membershipFactory, stokvelContract, token, emailHash } = await deployFactoryFixture();

            const address1 = await membershipFactory.computeMembershipAddress(
                await stokvelContract.getAddress(),
                await token.getAddress(),
                emailHash
            );

            const address2 = await membershipFactory.computeMembershipAddress(
                await stokvelContract.getAddress(),
                await token.getAddress(),
                emailHash
            );

            expect(address1).to.equal(address2);
        });

        it("Should compute different addresses for different email hashes", async function () {
            const { membershipFactory, stokvelContract, token, emailHash } = await deployFactoryFixture();

            const email2 = "another@example.com";
            const emailHash2 = keccak256(toUtf8Bytes(email2));

            const address1 = await membershipFactory.computeMembershipAddress(
                await stokvelContract.getAddress(),
                await token.getAddress(),
                emailHash
            );

            const address2 = await membershipFactory.computeMembershipAddress(
                await stokvelContract.getAddress(),
                await token.getAddress(),
                emailHash2
            );

            expect(address1).to.not.equal(address2);
        });

        it("Should compute different addresses for different stokvel addresses", async function () {
            const { membershipFactory, stokvelContract, token, emailHash, user1 } = await deployFactoryFixture();

            const address1 = await membershipFactory.computeMembershipAddress(
                await stokvelContract.getAddress(),
                await token.getAddress(),
                emailHash
            );

            const address2 = await membershipFactory.computeMembershipAddress(
                user1.address,
                await token.getAddress(),
                emailHash
            );

            expect(address1).to.not.equal(address2);
        });

        it("Should compute different addresses for different asset addresses", async function () {
            const { membershipFactory, stokvelContract, token, emailHash, user1 } = await deployFactoryFixture();

            const address1 = await membershipFactory.computeMembershipAddress(
                await stokvelContract.getAddress(),
                await token.getAddress(),
                emailHash
            );

            const address2 = await membershipFactory.computeMembershipAddress(
                await stokvelContract.getAddress(),
                user1.address,
                emailHash
            );

            expect(address1).to.not.equal(address2);
        });
    });

    describe("deployMembership", function () {
        it("Should deploy membership successfully", async function () {
            const { membershipFactory, stokvelContract, token, emailHash } = await deployFactoryFixture();

            const tx = await membershipFactory.deployMembership(
                await stokvelContract.getAddress(),
                await token.getAddress(),
                emailHash
            );

            const receipt = await tx.wait();
            expect(receipt?.status).to.equal(1);
        });

        it("Should emit MembershipDeployed event", async function () {
            const { membershipFactory, stokvelContract, token, emailHash } = await deployFactoryFixture();

            await expect(
                membershipFactory.deployMembership(
                    await stokvelContract.getAddress(),
                    await token.getAddress(),
                    emailHash
                )
            ).to.emit(membershipFactory, "MembershipDeployed");
        });

        it("Should emit MembershipDeployed event with correct parameters", async function () {
            const { membershipFactory, stokvelContract, token, emailHash } = await deployFactoryFixture();

            const computedAddress = await membershipFactory.computeMembershipAddress(
                await stokvelContract.getAddress(),
                await token.getAddress(),
                emailHash
            );

            await expect(
                membershipFactory.deployMembership(
                    await stokvelContract.getAddress(),
                    await token.getAddress(),
                    emailHash
                )
            )
                .to.emit(membershipFactory, "MembershipDeployed")
                .withArgs(computedAddress, emailHash);
        });

        it("Should deploy membership at computed address", async function () {
            const { membershipFactory, stokvelContract, token, emailHash } = await deployFactoryFixture();

            const computedAddress = await membershipFactory.computeMembershipAddress(
                await stokvelContract.getAddress(),
                await token.getAddress(),
                emailHash
            );

            const tx = await membershipFactory.deployMembership(
                await stokvelContract.getAddress(),
                await token.getAddress(),
                emailHash
            );

            const receipt = await tx.wait();
            const event = receipt?.logs.find(
                (log: any) => log.fragment?.name === "MembershipDeployed"
            );

            expect(event).to.not.be.undefined;
            const decodedEvent = membershipFactory.interface.decodeEventLog(
                "MembershipDeployed",
                event!.data,
                event!.topics
            );

            expect(decodedEvent.membership).to.equal(computedAddress);
        });

        // it("Should deploy functional membership contract", async function () {
        //     const connection = await network.connect();
        //     const { ethers } = connection;
        //     const { membershipFactory, stokvelContract, token, emailHash } = await deployFactoryFixture();

        //     const tx = await membershipFactory.deployMembership(
        //         await stokvelContract.getAddress(),
        //         await token.getAddress(),
        //         emailHash
        //     );

        //     const receipt = await tx.wait();
        //     const event = receipt?.logs.find(
        //         (log: any) => log.fragment?.name === "MembershipDeployed"
        //     );

        //     const decodedEvent = membershipFactory.interface.decodeEventLog(
        //         "MembershipDeployed",
        //         event!.data,
        //         event!.topics
        //     );

        //     const membershipAddress = decodedEvent.membership;
        //     const membership: Membership = await ethers.getContractAt("Membership", membershipAddress) as Membership;

        //     expect(await membership.stokvelContract()).to.equal(await stokvelContract.getAddress());
        //     expect(await membership.contributionAsset()).to.equal(await token.getAddress());
        //     expect(await membership.emailHash()).to.equal(emailHash);
        // });

        it("Should return deployed membership address", async function () {
            const { membershipFactory, stokvelContract, token, emailHash } = await deployFactoryFixture();

            const computedAddress = await membershipFactory.computeMembershipAddress(
                await stokvelContract.getAddress(),
                await token.getAddress(),
                emailHash
            );

            const tx = await membershipFactory.deployMembership.staticCall(
                await stokvelContract.getAddress(),
                await token.getAddress(),
                emailHash
            );

            expect(tx).to.equal(computedAddress);
        });

        // it("Should revert when deploying with same parameters twice", async function () {
        //     const { membershipFactory, stokvelContract, token, emailHash } = await deployFactoryFixture();

        //     await membershipFactory.deployMembership(
        //         await stokvelContract.getAddress(),
        //         await token.getAddress(),
        //         emailHash
        //     );

        //     await expect(
        //         membershipFactory.deployMembership(
        //             await stokvelContract.getAddress(),
        //             await token.getAddress(),
        //             emailHash
        //         )
        //     ).to.be.reverted;
        // });

        it("Should deploy different memberships for different email hashes", async function () {
            const { membershipFactory, stokvelContract, token, emailHash } = await deployFactoryFixture();

            const email2 = "another@example.com";
            const emailHash2 = keccak256(toUtf8Bytes(email2));

            const tx1 = await membershipFactory.deployMembership(
                await stokvelContract.getAddress(),
                await token.getAddress(),
                emailHash
            );

            const tx2 = await membershipFactory.deployMembership(
                await stokvelContract.getAddress(),
                await token.getAddress(),
                emailHash2
            );

            const receipt1 = await tx1.wait();
            const receipt2 = await tx2.wait();

            const event1 = receipt1?.logs.find((log: any) => log.fragment?.name === "MembershipDeployed");
            const event2 = receipt2?.logs.find((log: any) => log.fragment?.name === "MembershipDeployed");

            const decoded1 = membershipFactory.interface.decodeEventLog("MembershipDeployed", event1!.data, event1!.topics);
            const decoded2 = membershipFactory.interface.decodeEventLog("MembershipDeployed", event2!.data, event2!.topics);

            expect(decoded1.membership).to.not.equal(decoded2.membership);
        });

        it("Should revert if stokvel address is zero", async function () {
            const { membershipFactory, token, emailHash } = await deployFactoryFixture();

            await expect(
                membershipFactory.deployMembership(
                    ZeroAddress,
                    await token.getAddress(),
                    emailHash
                )
            ).to.be.revertedWithCustomError(membershipFactory, "InvalidStokvelAddress");
        });

        it("Should revert if asset address is zero", async function () {
            const { membershipFactory, stokvelContract, emailHash } = await deployFactoryFixture();

            await expect(
                membershipFactory.deployMembership(
                    await stokvelContract.getAddress(),
                    ZeroAddress,
                    emailHash
                )
            ).to.be.revertedWithCustomError(membershipFactory, "InvalidAssetAddress");
        });

        it("Should revert if email hash is zero", async function () {
            const { membershipFactory, stokvelContract, token } = await deployFactoryFixture();

            await expect(
                membershipFactory.deployMembership(
                    await stokvelContract.getAddress(),
                    await token.getAddress(),
                    ZeroBytes32
                )
            ).to.be.revertedWithCustomError(membershipFactory, "InvalidEmailHash");
        });

        it("Should allow anyone to deploy membership", async function () {
            const { membershipFactory, stokvelContract, token, emailHash, user1, user2 } = await deployFactoryFixture();

            const email2 = "user2@example.com";
            const emailHash2 = keccak256(toUtf8Bytes(email2));

            const tx1 = await membershipFactory.connect(user1).deployMembership(
                await stokvelContract.getAddress(),
                await token.getAddress(),
                emailHash
            );

            const tx2 = await membershipFactory.connect(user2).deployMembership(
                await stokvelContract.getAddress(),
                await token.getAddress(),
                emailHash2
            );

            const receipt1 = await tx1.wait();
            const receipt2 = await tx2.wait();

            expect(receipt1?.status).to.equal(1);
            expect(receipt2?.status).to.equal(1);
        });
    });

    describe("Integration", function () {
        it("Should verify CREATE2 deterministic deployment", async function () {
            const connection = await network.connect();
            const { ethers } = connection;
            const { membershipFactory, stokvelContract, token, emailHash } = await deployFactoryFixture();

            const preComputedAddress = await membershipFactory.computeMembershipAddress(
                await stokvelContract.getAddress(),
                await token.getAddress(),
                emailHash
            );

            const tx = await membershipFactory.deployMembership(
                await stokvelContract.getAddress(),
                await token.getAddress(),
                emailHash
            );

            const receipt = await tx.wait();
            const event = receipt?.logs.find((log: any) => log.fragment?.name === "MembershipDeployed");
            const decoded = membershipFactory.interface.decodeEventLog("MembershipDeployed", event!.data, event!.topics);

            expect(decoded.membership).to.equal(preComputedAddress);

            const code = await ethers.provider.getCode(preComputedAddress);
            expect(code).to.not.equal("0x");
        });

        it("Should deploy membership with correct initial state", async function () {
            const connection = await network.connect();
            const { ethers } = connection;
            const { membershipFactory, stokvelContract, token, emailHash } = await deployFactoryFixture();

            const tx = await membershipFactory.deployMembership(
                await stokvelContract.getAddress(),
                await token.getAddress(),
                emailHash
            );

            const receipt = await tx.wait();
            const event = receipt?.logs.find((log: any) => log.fragment?.name === "MembershipDeployed");
            const decoded = membershipFactory.interface.decodeEventLog("MembershipDeployed", event!.data, event!.topics);

            const membership: Membership = await ethers.getContractAt("Membership", decoded.membership) as Membership;

            expect(await membership.claimant()).to.equal(ZeroAddress);
            expect(await membership.isClaimed()).to.equal(false);
            expect(await membership.stokvelContract()).to.equal(await stokvelContract.getAddress());
            expect(await membership.contributionAsset()).to.equal(await token.getAddress());
            expect(await membership.emailHash()).to.equal(emailHash);
        });

        it("Should deploy membership with auto-approved stokvel allowance", async function () {
            const connection = await network.connect();
            const { ethers } = connection;
            const { membershipFactory, stokvelContract, token, emailHash } = await deployFactoryFixture();

            const tx = await membershipFactory.deployMembership(
                await stokvelContract.getAddress(),
                await token.getAddress(),
                emailHash
            );

            const receipt = await tx.wait();
            const event = receipt?.logs.find((log: any) => log.fragment?.name === "MembershipDeployed");
            const decoded = membershipFactory.interface.decodeEventLog("MembershipDeployed", event!.data, event!.topics);

            const membershipAddress = decoded.membership;
            const allowance = await token.allowance(membershipAddress, await stokvelContract.getAddress());

            expect(allowance).to.equal(ethers.MaxUint256);
        });

        it("Should deploy multiple memberships for same stokvel", async function () {
            const { membershipFactory, stokvelContract, token, emailHash } = await deployFactoryFixture();

            const email2 = "user2@example.com";
            const emailHash2 = keccak256(toUtf8Bytes(email2));

            const email3 = "user3@example.com";
            const emailHash3 = keccak256(toUtf8Bytes(email3));

            await membershipFactory.deployMembership(
                await stokvelContract.getAddress(),
                await token.getAddress(),
                emailHash
            );

            await membershipFactory.deployMembership(
                await stokvelContract.getAddress(),
                await token.getAddress(),
                emailHash2
            );

            await membershipFactory.deployMembership(
                await stokvelContract.getAddress(),
                await token.getAddress(),
                emailHash3
            );

            const address1 = await membershipFactory.computeMembershipAddress(
                await stokvelContract.getAddress(),
                await token.getAddress(),
                emailHash
            );

            const address2 = await membershipFactory.computeMembershipAddress(
                await stokvelContract.getAddress(),
                await token.getAddress(),
                emailHash2
            );

            const address3 = await membershipFactory.computeMembershipAddress(
                await stokvelContract.getAddress(),
                await token.getAddress(),
                emailHash3
            );

            expect(address1).to.not.equal(address2);
            expect(address2).to.not.equal(address3);
            expect(address1).to.not.equal(address3);
        });
    });
});
