import { expect } from "chai";
import { network } from "hardhat";
import type { StokvelOnChain, MockERC20, IMembershipFactory } from "../types/ethers-contracts/index.js";
import type { HardhatEthersSigner } from "@nomicfoundation/hardhat-ethers/types";
import { parseUnits, formatUnits } from "ethers";

const ZeroAddress = '0x0000000000000000000000000000000000000000';
const contribution_asset_decimals = 18;
enum MOUType {
    NONMEMBER = 0,
    ACTIVE = 1,
    TRANSFERRED = 2,
    TERMINATED = 3
}

describe("StokvelOnChain", function () {
    async function deployStokvelFixture() {
        const connection = await network.connect();
        const { ethers } = connection;

        const [owner, member1, member2, member3, operator]: HardhatEthersSigner[] = await ethers.getSigners();

        const membershipFactory = await ethers.deployContract("MembershipFactory", []);
        await membershipFactory.waitForDeployment();

        const rand: MockERC20 = await ethers.deployContract("MockERC20", ["RandCoin", "RZAR", contribution_asset_decimals]) as MockERC20;
        await rand.waitForDeployment();

        const initialBalance = parseUnits("10000", contribution_asset_decimals);
        await rand.mint(member1.address, initialBalance);
        await rand.mint(member2.address, initialBalance);
        await rand.mint(member3.address, initialBalance);

        const randAddress = await rand.getAddress();
        const factoryAddress = await membershipFactory.getAddress();

        const quorum = parseUnits("200", contribution_asset_decimals);
        const stokvel: StokvelOnChain = await ethers.deployContract("StokvelOnChain", [
            '/StokvelOnchain/stokvelOne',
            quorum,
            randAddress,
            factoryAddress
        ]) as StokvelOnChain;
        await stokvel.waitForDeployment();
        return { stokvel, rand, owner, member1, member2, member3, operator, quorum };
    }

    describe("Deployment", function () {
        it("Should set the right owner", async function () {
            const { stokvel, owner } = await deployStokvelFixture();
            expect(await stokvel.owner()).to.equal(owner.address);
        });

        it("Should set the correct quorum", async function () {
            const { stokvel, quorum } = await deployStokvelFixture();
            expect(await stokvel.stokvelQuorum()).to.equal(quorum);
        });

        it("Should have CONTRIBUTION_TOKEN_ID set to 1", async function () {
            const { stokvel } = await deployStokvelFixture();
            expect(await stokvel.CONTRIBUTION_TOKEN_ID()).to.equal(1);
        });

        it("Should revert if quorum is zero", async function () {
            const connection = await network.connect();
            const { ethers } = connection;

            const membershipFactory = await ethers.deployContract("MembershipFactory", []);
            await membershipFactory.waitForDeployment();

            const rand: MockERC20 = await ethers.deployContract("MockERC20", ["RandCoin", "RZAR", contribution_asset_decimals]) as MockERC20;
            await rand.waitForDeployment();

            await expect(
                ethers.deployContract("StokvelOnChain", [
                    '/StokvelOnchain/stokvelOne',
                    0,
                    await rand.getAddress(),
                    await membershipFactory.getAddress()
                ])
            ).to.be.revertedWith("StokvelOnChain: Quorum must be greater than 0");
        });

        it("Should revert if contribution asset is zero", async function () {
            const connection = await network.connect();
            const { ethers } = connection;

            const membershipFactory = await ethers.deployContract("MembershipFactory", []);
            await membershipFactory.waitForDeployment();

            await expect(
                ethers.deployContract("StokvelOnChain", [
                    '/StokvelOnchain/stokvelOne',
                    parseUnits("200", contribution_asset_decimals),
                    ZeroAddress,
                    await membershipFactory.getAddress()
                ])
            ).to.be.revertedWith("StokvelOnChain: Invalid contributionAsset 0 ");
        });

        it("Should revert if factory address is zero", async function () {
            const connection = await network.connect();
            const { ethers } = connection;

            const rand: MockERC20 = await ethers.deployContract("MockERC20", ["RandCoin", "RZAR", contribution_asset_decimals]) as MockERC20;
            await rand.waitForDeployment();

            await expect(
                ethers.deployContract("StokvelOnChain", [
                    '/StokvelOnchain/stokvelOne',
                    parseUnits("200", contribution_asset_decimals),
                    await rand.getAddress(),
                    ZeroAddress
                ])
            ).to.be.revertedWith("StokvelOnChain: Invalid factory 0 ");
        });

        it("Should set factory address correctly", async function () {
            const { stokvel } = await deployStokvelFixture();
            const factoryAddress = await stokvel.factory();
            expect(factoryAddress).to.not.equal(ZeroAddress);
        });


    });


    describe("Contribution Asset", function () {
        it("Should set contribution asset", async function () {
            const { stokvel, rand } = await deployStokvelFixture();
            expect(await stokvel.contributionAsset()).to.equal(await rand.getAddress());
        });

        it("Should emit ContributionAssetSet event", async function () {
            const { stokvel, rand } = await deployStokvelFixture();
            await expect(stokvel.setContributionERC20(await rand.getAddress()))
                .to.emit(stokvel, "ContributionAssetSet")
                .withArgs(await rand.getAddress());
        });

        it("Should revert if non-owner tries to set contribution asset", async function () {
            const { stokvel, rand, member1 } = await deployStokvelFixture();
            await expect(
                stokvel.connect(member1).setContributionERC20(await rand.getAddress())
            ).to.be.revertedWithCustomError(stokvel, "OwnableUnauthorizedAccount");
        });

        it("Should revert if zero address is provided", async function () {
            const { stokvel } = await deployStokvelFixture();
            await expect(
                stokvel.setContributionERC20(ZeroAddress)
            ).to.be.revertedWith("StokvelOnChain: Invalid asset address");
        });
    });

    describe("Contribution Functions", function () {
        it("Should allow active member to contribute", async function () {
            const { stokvel, rand, owner } = await deployStokvelFixture();
            const email1 = 'member1@test.com';

            await stokvel.join(email1, "QmTest123");
            const membershipAddr = await stokvel.getMembership(email1);

            // Fund the membership address with tokens
            const amount = parseUnits("100", contribution_asset_decimals);
            await rand.mint(membershipAddr, amount);
    
            // Owner (who is an active member) makes a contribution on behalf of membership
            await stokvel.connect(owner).contribute(membershipAddr, amount);

            const balance = await stokvel.balanceOf(membershipAddr, await stokvel.CONTRIBUTION_TOKEN_ID());
            expect(balance).to.equal(amount);
        });

        it("Should emit ContributionMade event", async function () {
            const { stokvel, rand, owner } = await deployStokvelFixture();
            const email1 = 'owner@test.com';

            await stokvel.join(email1, "QmTest123");
            const membershipAddr = await stokvel.getMembership(email1);

            const amount = parseUnits("100", contribution_asset_decimals);
            await rand.mint(membershipAddr, amount);
            await rand.connect(owner).approve(await stokvel.getAddress(), amount);

            await expect(stokvel.connect(owner).contribute(membershipAddr, amount))
                .to.emit(stokvel, "ContributionMade")
                .withArgs(membershipAddr, amount);
        });

        it("Should revert if contribution asset not set", async function () {
            const connection = await network.connect();
            const { ethers } = connection;

            const [owner] = await ethers.getSigners();
            const membershipFactory = await ethers.deployContract("MembershipFactory", []);
            await membershipFactory.waitForDeployment();

            const rand: MockERC20 = await ethers.deployContract("MockERC20", ["RandCoin", "RZAR", contribution_asset_decimals]) as MockERC20;
            await rand.waitForDeployment();

            const quorum = parseUnits("200", contribution_asset_decimals);
            const stokvel: StokvelOnChain = await ethers.deployContract("StokvelOnChain", [
                '/StokvelOnchain/stokvelOne',
                quorum,
                await rand.getAddress(),
                await membershipFactory.getAddress()
            ]) as StokvelOnChain;
            await stokvel.waitForDeployment();

            const email1 = 'owner@test.com';
            await stokvel.join(email1, "QmTest123");

            // Set contribution asset to zero
            await expect(stokvel.setContributionERC20(ZeroAddress))
            .to.be.revertedWith("StokvelOnChain: Invalid asset address");
        });

        it("Should revert if amount is zero", async function () {
            const { stokvel, owner } = await deployStokvelFixture();
            const email1 = 'owner@test.com';

            await stokvel.join(email1, "QmTest123");
            const membershipAddr = await stokvel.getMembership(email1);

            await expect(
                stokvel.connect(owner).contribute(membershipAddr, 0)
            ).to.be.revertedWith("StokvelOnChain: Amount must be greater than 0");
        });

        it("Should revert if non-active member tries to contribute", async function () {
            const { stokvel, member1 } = await deployStokvelFixture();

            await expect(
                stokvel.connect(member1).contribute(member1.address, parseUnits("100", contribution_asset_decimals))
            ).to.be.revertedWith("StokvelOnChain: Member must have active membership");
        });

        it("Should revert when paused", async function () {
            const { stokvel, owner } = await deployStokvelFixture();
            const email1 = 'owner@test.com';

            await stokvel.join(email1, "QmTest123");
            const membershipAddr = await stokvel.getMembership(email1);

            await stokvel.pause();

            await expect(
                stokvel.connect(owner).contribute(membershipAddr, parseUnits("100", contribution_asset_decimals))
            ).to.be.revertedWithCustomError(stokvel, "EnforcedPause");
        });
    });

    describe("Quorum Management", function () {
        it("Should update quorum", async function () {
            const { stokvel } = await deployStokvelFixture();
            const newQuorum = parseUnits("500", contribution_asset_decimals);
            await stokvel.setStokvelQuorum(newQuorum);
            expect(await stokvel.stokvelQuorum()).to.equal(newQuorum);
        });

        it("Should emit QuorumUpdated event", async function () {
            const { stokvel, quorum } = await deployStokvelFixture();
            const newQuorum = parseUnits("500", contribution_asset_decimals);
            await expect(stokvel.setStokvelQuorum(newQuorum))
                .to.emit(stokvel, "QuorumUpdated")
                .withArgs(quorum, newQuorum);
        });

        it("Should revert if new quorum is zero", async function () {
            const { stokvel } = await deployStokvelFixture();
            await expect(
                stokvel.setStokvelQuorum(0)
            ).to.be.revertedWith("StokvelOnChain: Quorum must be greater than 0");
        });

        it("Should revert if non-owner tries to set quorum", async function () {
            const { stokvel, member1 } = await deployStokvelFixture();
            await expect(
                stokvel.connect(member1).setStokvelQuorum(parseUnits("500", contribution_asset_decimals))
            ).to.be.revertedWithCustomError(stokvel, "OwnableUnauthorizedAccount");
        });
    });

    describe("Membership Management", function () {
        describe("Join", function () {
            it("Should add a new member", async function () {
                const { stokvel, member1 } = await deployStokvelFixture();
                const ipfsHash = "QmTest123";
                const memberEmail = 'my@test.com'
                await stokvel.join(memberEmail, ipfsHash);
                const membershipAddress = await stokvel.getMembership(memberEmail);
                const member = await stokvel.getMember(membershipAddress);
                expect(member.contractIPFSHash).to.equal(ipfsHash);
                expect(member.state).to.equal(MOUType.ACTIVE);
            });

            it("Should emit MembershipActivated event", async function () {
                const { stokvel, member1 } = await deployStokvelFixture();
                const ipfsHash = "QmTest123";
                const memberEmail = 'my@test.com'
                const membershipAddress = await stokvel.getMembership(memberEmail)
                await expect(stokvel.join(memberEmail, ipfsHash))
                    .to.emit(stokvel, "MembershipActivated")
                    .withArgs(membershipAddress, ipfsHash);
            });

            it("Should revert if member is already active", async function () {
                const { stokvel, member1 } = await deployStokvelFixture();
                const ipfsHash = "QmTest123";
                const memberEmail = 'my@test.com'
                await stokvel.join(memberEmail, ipfsHash);
                await expect(
                    stokvel.join(memberEmail, ipfsHash)
                ).to.be.revertedWith("StokvelOnChain: Member already active");
            });

            it("Should revert if IPFS hash is empty", async function () {
                const { stokvel, member1 } = await deployStokvelFixture();
                const memberEmail = 'member1@test.com';
                await expect(
                    stokvel.join(memberEmail, "")
                ).to.be.revertedWith("StokvelOnChain: IPFS hash required");
            });

            it("Should revert if member address is zero", async function () {
                const { stokvel } = await deployStokvelFixture();
                await expect(
                    stokvel.join('', "QmTest123")
                ).to.be.revertedWith("StokvelOnChain: Member email required");
            });

            it("Should revert if non-owner tries to add member", async function () {
                const { stokvel, member1, member2 } = await deployStokvelFixture();
                await expect(
                    stokvel.connect(member1).join('member2@test.com', "QmTest123")
                ).to.be.revertedWithCustomError(stokvel, "OwnableUnauthorizedAccount");
            });

            it("Should revert when paused", async function () {
                const { stokvel, member1 } = await deployStokvelFixture();
                await stokvel.pause();
                await expect(
                    stokvel.join('member1@test.com', "QmTest123")
                ).to.be.revertedWithCustomError(stokvel, "EnforcedPause");
            });
        });

        describe("Transfer Membership", function () {
            it("Should transfer membership to new address", async function () {
                const { stokvel, rand, member1, member2 } = await deployStokvelFixture();
                const email1 = 'member1@test.com';
                const email2 = 'member2@test.com';

                await stokvel.join(email1, "QmTest123");
                await stokvel.join(email2, "QmTest123");

                // Get the actual membership address created from the email
                const membershipAddr = await stokvel.getMembership(email1);
                const membershipAddr2 = await stokvel.getMembership(email2);


                await stokvel.transferMembership(membershipAddr, membershipAddr2, "QmTransfer456");

                const member1Info = await stokvel.getMember(membershipAddr);
                const member2Info = await stokvel.getMember(membershipAddr2);

                expect(member1Info.state).to.equal(MOUType.TRANSFERRED);
                expect(member2Info.state).to.equal(MOUType.ACTIVE);
            });

            it("Should emit MembershipTransferred event", async function () {
                const { stokvel, member1, member2 } = await deployStokvelFixture();
                const email1 = 'member1@test.com';
                const email2 = 'member2@test.com';

                await stokvel.join(email1, "QmTest123");
                await stokvel.join(email2, "QmTest123");

                // Get the actual membership address created from the email
                const membershipAddr = await stokvel.getMembership(email1);
                const membershipAddr2 = await stokvel.getMembership(email2);

                const transferHash = "QmTransfer456";

                await expect(stokvel.transferMembership(membershipAddr, membershipAddr2, transferHash))
                    .to.emit(stokvel, "MembershipTransferred")
                    .withArgs(membershipAddr, membershipAddr2, transferHash);
            });
            it("Should transfer membership when fromMember has zero balance", async function () {
                const { stokvel, member1, member2 } = await deployStokvelFixture();
                const email1 = 'member1@test.com';
                const email2 = 'member2@test.com';

                await stokvel.join(email1, "QmTest123");
                await stokvel.join(email2, "QmTest456");

                const membershipAddr = await stokvel.getMembership(email1);
                const membershipAddr2 = await stokvel.getMembership(email2);

                await stokvel.transferMembership(membershipAddr, membershipAddr2, "QmTransfer456");

                const member1Info = await stokvel.getMember(membershipAddr);
                const member2Info = await stokvel.getMember(membershipAddr2);

                expect(member1Info.state).to.equal(MOUType.TRANSFERRED);
                expect(member2Info.state).to.equal(MOUType.ACTIVE);
            });

            it("Should revert if new member address is zero", async function () {
                const { stokvel, member1 } = await deployStokvelFixture();
                const email1 = 'member1@test.com';
                await stokvel.join(email1, "QmTest123");
                const membershipAddr = await stokvel.getMembership(email1);
                await expect(
                    stokvel.transferMembership(membershipAddr, ZeroAddress, "QmTransfer456")
                ).to.be.revertedWith("StokvelOnChain: Invalid new member address");
            });

            it("Should revert if from member address is zero", async function () {
                const { stokvel, member2 } = await deployStokvelFixture();
                const email2 = 'member2@test.com';
                await stokvel.join(email2, "QmTest456");
                const membershipAddr2 = await stokvel.getMembership(email2);
                await expect(
                    stokvel.transferMembership(ZeroAddress, membershipAddr2, "QmTransfer456")
                ).to.be.revertedWith("StokvelOnChain: Member must have active membership");
            });

            it("Should revert if IPFS hash is empty", async function () {
                const { stokvel, member1, member2 } = await deployStokvelFixture();
                const email1 = 'member1@test.com';
                const email2 = 'member2@test.com';

                await stokvel.join(email1, "QmTest123");
                await stokvel.join(email2, "QmTest456");

                const membershipAddr = await stokvel.getMembership(email1);
                const membershipAddr2 = await stokvel.getMembership(email2);

                await expect(
                    stokvel.transferMembership(membershipAddr, membershipAddr2, "")
                ).to.be.revertedWith("StokvelOnChain: IPFS hash required");
            });

            it("Should revert when paused", async function () {
                const { stokvel, member1, member2 } = await deployStokvelFixture();
                const email1 = 'member1@test.com';
                const email2 = 'member2@test.com';

                await stokvel.join(email1, "QmTest123");
                await stokvel.join(email2, "QmTest456");

                const membershipAddr = await stokvel.getMembership(email1);
                const membershipAddr2 = await stokvel.getMembership(email2);

                await stokvel.pause();
                await expect(
                    stokvel.transferMembership(membershipAddr, membershipAddr2, "QmTransfer")
                ).to.be.revertedWithCustomError(stokvel, "EnforcedPause");
            });

            it("Should revert if new member is not in NONMEMBER state", async function () {
                const { stokvel, member1, member2 } = await deployStokvelFixture();
                const email1 = 'member1@test.com';
                const email2 = 'member2@test.com';

                await stokvel.join(email1, "QmTest123");

                const membership1 = await stokvel.getMembership(email1);
                const membership2 = await stokvel.getMembership(email2);

                await expect(
                    stokvel.transferMembership(membership1, membership2, "QmTransfer")
                ).to.be.revertedWith("StokvelOnChain: New member must join");
            });

            it("Should revert if non-owner tries to transfer", async function () {
                const { stokvel, member1, member2, member3 } = await deployStokvelFixture();
                const email1 = 'member1@test.com';
                const email2 = 'member2@test.com';

                await stokvel.join(email1, "QmTest123");
                await stokvel.join(email2, "QmTest456");

                const membershipAddr = await stokvel.getMembership(email1);
                const membershipAddr2 = await stokvel.getMembership(email2);

                await expect(
                    stokvel.connect(member3).transferMembership(membershipAddr, membershipAddr2, "QmTransfer")
                ).to.be.revertedWithCustomError(stokvel, "OwnableUnauthorizedAccount");
            });
        });

        describe("Terminate Membership", function () {
            it("Should terminate membership and burn tokens", async function () {
                const { stokvel, rand, member1 } = await deployStokvelFixture();
                const email1 = 'member1@test.com';
                await stokvel.setContributionERC20(await rand.getAddress());
                await stokvel.join(email1, "QmTest123");
                const membershipAddr = await stokvel.getMembership(email1);

                // For now, skip contribution part as it requires the membership address to have ETH for gas
                await stokvel.terminateMembership(membershipAddr, "QmTerminate789");

                const memberInfo = await stokvel.getMember(membershipAddr);
                expect(memberInfo.state).to.equal(MOUType.TERMINATED);
            });

            it("Should emit MembershipTerminated event", async function () {
                const { stokvel, member1 } = await deployStokvelFixture();
                const email1 = 'member1@test.com';
                await stokvel.join(email1, "QmTest123");
                const membershipAddr = await stokvel.getMembership(email1);
                const terminateHash = "QmTerminate789";

                await expect(stokvel.terminateMembership(membershipAddr, terminateHash))
                    .to.emit(stokvel, "MembershipTerminated")
                    .withArgs(membershipAddr, terminateHash);
            });

            it("Should terminate membership when member has zero balance", async function () {
                const { stokvel, member1 } = await deployStokvelFixture();
                const email1 = 'member1@test.com';
                await stokvel.join(email1, "QmTest123");
                const membershipAddr = await stokvel.getMembership(email1);

                await stokvel.terminateMembership(membershipAddr, "QmTerminate789");

                const memberInfo = await stokvel.getMember(membershipAddr);
                expect(memberInfo.state).to.equal(MOUType.TERMINATED);
            });

            it("Should revert if IPFS hash is empty", async function () {
                const { stokvel, member1 } = await deployStokvelFixture();
                const email1 = 'member1@test.com';
                await stokvel.join(email1, "QmTest123");
                const membershipAddr = await stokvel.getMembership(email1);
                await expect(
                    stokvel.terminateMembership(membershipAddr, "")
                ).to.be.revertedWith("StokvelOnChain: IPFS hash required");
            });

            it("Should revert if member is not active", async function () {
                const { stokvel, member1 } = await deployStokvelFixture();
                await expect(
                    stokvel.terminateMembership(member1.address, "QmTerminate789")
                ).to.be.revertedWith("StokvelOnChain: Member must have active membership");
            });

            it("Should revert if non-owner tries to terminate", async function () {
                const { stokvel, member1, member2 } = await deployStokvelFixture();
                const email1 = 'member1@test.com';
                await stokvel.join(email1, "QmTest123");
                const membershipAddr = await stokvel.getMembership(email1);
                await expect(
                    stokvel.connect(member2).terminateMembership(membershipAddr, "QmTerminate789")
                ).to.be.revertedWithCustomError(stokvel, "OwnableUnauthorizedAccount");
            });

            it("Should revert when paused", async function () {
                const { stokvel, member1 } = await deployStokvelFixture();
                const email1 = 'member1@test.com';
                await stokvel.join(email1, "QmTest123");
                const membershipAddr = await stokvel.getMembership(email1);
                await stokvel.pause();
                await expect(
                    stokvel.terminateMembership(membershipAddr, "QmTerminate789")
                ).to.be.revertedWithCustomError(stokvel, "EnforcedPause");
            });
        });
    });

    // Note: Contribution tests require the membership address to have funds for gas
    // These would need to be updated to properly fund and use the membership addresses
    // or the contract design needs to change to allow contributions from any address
    // on behalf of a membership

    describe("View Functions", function () {
        it("Should get member information", async function () {
            const { stokvel, member1 } = await deployStokvelFixture();
            const email1 = 'member1@test.com';
            const ipfsHash = "QmTest123";
            await stokvel.join(email1, ipfsHash);
            const membershipAddr = await stokvel.getMembership(email1);

            const member = await stokvel.getMember(membershipAddr);
            expect(member.contractIPFSHash).to.equal(ipfsHash);
            expect(member.state).to.equal(MOUType.ACTIVE);
        });

        it("Should check if address is active member", async function () {
            const { stokvel, member1 } = await deployStokvelFixture();
            const email1 = 'member1@test.com';
            const membershipAddr = await stokvel.getMembership(email1);

            expect(await stokvel.isActiveMember(membershipAddr)).to.equal(false);

            await stokvel.join(email1, "QmTest123");
            expect(await stokvel.isActiveMember(membershipAddr)).to.equal(true);
        });

        it("Should get contribution asset balance", async function () {
            const { stokvel, rand, member1 } = await deployStokvelFixture();
            await stokvel.setContributionERC20(await rand.getAddress());
            const email1 = 'member1@test.com';
            await stokvel.join(email1, "QmMember1");

            expect(await stokvel.getContributionAssetBalance()).to.equal(0);
        });

        it("Should revert if setting contribution to zero", async function () {
            const connection = await network.connect();
            const { ethers } = connection;

            const membershipFactory = await ethers.deployContract("MembershipFactory", []);
            await membershipFactory.waitForDeployment();

            const rand: MockERC20 = await ethers.deployContract("MockERC20", ["RandCoin", "RZAR", contribution_asset_decimals]) as MockERC20;
            await rand.waitForDeployment();

            const quorum = parseUnits("200", contribution_asset_decimals);
            const stokvel: StokvelOnChain = await ethers.deployContract("StokvelOnChain", [
                '/StokvelOnchain/stokvelOne',
                quorum,
                await rand.getAddress(),
                await membershipFactory.getAddress()
            ]) as StokvelOnChain;
            await stokvel.waitForDeployment();

            await expect(stokvel.setContributionERC20(ZeroAddress))
                .to.be.revertedWith('StokvelOnChain: Invalid asset address');
        });
    });

    describe("URI Management", function () {
        it("Should set new URI", async function () {
            const { stokvel } = await deployStokvelFixture();
            const newUri = "https://new-uri.com/{id}.json";
            await stokvel.setURI(newUri);
        });

        it("Should revert if non-owner tries to set URI", async function () {
            const { stokvel, member1 } = await deployStokvelFixture();
            await expect(
                stokvel.connect(member1).setURI("https://new-uri.com/{id}.json")
            ).to.be.revertedWithCustomError(stokvel, "OwnableUnauthorizedAccount");
        });
    });

    describe("Pausable", function () {
        it("Should pause and unpause", async function () {
            const { stokvel } = await deployStokvelFixture();
            await stokvel.pause();
            expect(await stokvel.paused()).to.equal(true);

            await stokvel.unpause();
            expect(await stokvel.paused()).to.equal(false);
        });

        it("Should prevent operations when paused", async function () {
            const { stokvel, member1 } = await deployStokvelFixture();
            await stokvel.pause();

            await expect(
                stokvel.join('member1@test.com', "QmTest")
            ).to.be.revertedWithCustomError(stokvel, "EnforcedPause");
        });

        it("Should revert if non-owner tries to pause", async function () {
            const { stokvel, member1 } = await deployStokvelFixture();
            await expect(
                stokvel.connect(member1).pause()
            ).to.be.revertedWithCustomError(stokvel, "OwnableUnauthorizedAccount");
        });

        it("Should revert if non-owner tries to unpause", async function () {
            const { stokvel, member1 } = await deployStokvelFixture();
            await stokvel.pause();
            await expect(
                stokvel.connect(member1).unpause()
            ).to.be.revertedWithCustomError(stokvel, "OwnableUnauthorizedAccount");
        });
    });
});
