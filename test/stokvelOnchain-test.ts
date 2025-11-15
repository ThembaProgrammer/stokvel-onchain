import { expect } from "chai";
import { network } from "hardhat";
import type { StokvelOnChain, MockERC20 } from "../types/ethers-contracts/index.js";
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

        const rand: MockERC20 = await ethers.deployContract("MockERC20", ["RandCoin", "RZAR", contribution_asset_decimals]) as MockERC20;
        await rand.waitForDeployment();

        const initialBalance = parseUnits("10000", contribution_asset_decimals);
        await rand.mint(member1.address, initialBalance);
        await rand.mint(member2.address, initialBalance);
        await rand.mint(member3.address, initialBalance);

        const quorum = parseUnits("200", contribution_asset_decimals);
        const stokvel: StokvelOnChain = await ethers.deployContract("StokvelOnChain", [
            '/StokvelOnchain/stokvelOne',
            quorum,
            await rand.getAddress()
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

            const rand: MockERC20 = await ethers.deployContract("MockERC20", ["RandCoin", "RZAR", contribution_asset_decimals]) as MockERC20;
            await rand.waitForDeployment();

            await expect(
                ethers.deployContract("StokvelOnChain", [
                    '/StokvelOnchain/stokvelOne',
                    0,
                    await rand.getAddress()
                ])
            ).to.be.revertedWith("StokvelOnChain: Quorum must be greater than 0");
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
                await stokvel.join(member1.address, ipfsHash);
                const member = await stokvel.getMember(member1.address);
                expect(member.contractIPFSHash).to.equal(ipfsHash);
                expect(member.state).to.equal(MOUType.ACTIVE);
            });

            it("Should emit MembershipActivated event", async function () {
                const { stokvel, member1 } = await deployStokvelFixture();
                const ipfsHash = "QmTest123";
                await expect(stokvel.join(member1.address, ipfsHash))
                    .to.emit(stokvel, "MembershipActivated")
                    .withArgs(member1.address, ipfsHash);
            });

            it("Should revert if member is already active", async function () {
                const { stokvel, member1 } = await deployStokvelFixture();
                const ipfsHash = "QmTest123";
                await stokvel.join(member1.address, ipfsHash);
                await expect(
                    stokvel.join(member1.address, ipfsHash)
                ).to.be.revertedWith("StokvelOnChain: Member already active");
            });

            it("Should revert if IPFS hash is empty", async function () {
                const { stokvel, member1 } = await deployStokvelFixture();
                await expect(
                    stokvel.join(member1.address, "")
                ).to.be.revertedWith("StokvelOnChain: IPFS hash required");
            });

            it("Should revert if member address is zero", async function () {
                const { stokvel } = await deployStokvelFixture();
                await expect(
                    stokvel.join(ZeroAddress, "QmTest123")
                ).to.be.revertedWith("StokvelOnChain: Invalid member address");
            });

            it("Should revert if non-owner tries to add member", async function () {
                const { stokvel, member1, member2 } = await deployStokvelFixture();
                await expect(
                    stokvel.connect(member1).join(member2.address, "QmTest123")
                ).to.be.revertedWithCustomError(stokvel, "OwnableUnauthorizedAccount");
            });

            it("Should revert when paused", async function () {
                const { stokvel, member1 } = await deployStokvelFixture();
                await stokvel.pause();
                await expect(
                    stokvel.join(member1.address, "QmTest123")
                ).to.be.revertedWithCustomError(stokvel, "EnforcedPause");
            });
        });

        describe("Transfer Membership", function () {
            it("Should transfer membership to new address", async function () {
                const { stokvel, rand, member1, member2 } = await deployStokvelFixture();
                await stokvel.setContributionERC20(await rand.getAddress());
                await stokvel.join(member1.address, "QmTest123");
                await rand.connect(member1).approve(await stokvel.getAddress(), parseUnits("100", contribution_asset_decimals));
                await stokvel.connect(member1).contribute(parseUnits("100", contribution_asset_decimals));

                await stokvel.transferMembership(member2.address, member1.address, "QmTransfer456");

                const member1Info = await stokvel.getMember(member1.address);
                const member2Info = await stokvel.getMember(member2.address);

                expect(member1Info.state).to.equal(MOUType.TRANSFERRED);
                expect(member2Info.state).to.equal(MOUType.ACTIVE);
                expect(await stokvel.balanceOf(member2.address, 1)).to.equal(parseUnits("100", contribution_asset_decimals));
                expect(await stokvel.balanceOf(member1.address, 1)).to.equal(0);
            });

            it("Should emit MembershipTransferred event", async function () {
                const { stokvel, member1, member2 } = await deployStokvelFixture();
                await stokvel.join(member1.address, "QmTest123");
                const transferHash = "QmTransfer456";

                await expect(stokvel.transferMembership(member2.address, member1.address, transferHash))
                    .to.emit(stokvel, "MembershipTransferred")
                    .withArgs(member2.address, member1.address, transferHash);
            });

            it("Should transfer membership when fromMember has zero balance", async function () {
                const { stokvel, member1, member2 } = await deployStokvelFixture();
                await stokvel.join(member1.address, "QmTest123");

                await stokvel.transferMembership(member2.address, member1.address, "QmTransfer456");

                const member1Info = await stokvel.getMember(member1.address);
                const member2Info = await stokvel.getMember(member2.address);

                expect(member1Info.state).to.equal(MOUType.TRANSFERRED);
                expect(member2Info.state).to.equal(MOUType.ACTIVE);
            });

            it("Should revert if new member address is zero", async function () {
                const { stokvel, member1 } = await deployStokvelFixture();
                await stokvel.join(member1.address, "QmTest123");
                await expect(
                    stokvel.transferMembership(ZeroAddress, member1.address, "QmTransfer456")
                ).to.be.revertedWith("StokvelOnChain: Invalid new member address");
            });

            it("Should revert if from member address is zero", async function () {
                const { stokvel, member2 } = await deployStokvelFixture();
                await expect(
                    stokvel.transferMembership(member2.address, ZeroAddress, "QmTransfer456")
                ).to.be.revertedWith("StokvelOnChain: Member must have active membership");
            });

            it("Should revert if new member is already active", async function () {
                const { stokvel, member1, member2 } = await deployStokvelFixture();
                await stokvel.join(member1.address, "QmTest123");
                await stokvel.join(member2.address, "QmTest456");
                await expect(
                    stokvel.transferMembership(member2.address, member1.address, "QmTransfer")
                ).to.be.revertedWith("StokvelOnChain: New member already active");
            });

            it("Should revert if from member is not active", async function () {
                const { stokvel, member1, member2 } = await deployStokvelFixture();
                await expect(
                    stokvel.transferMembership(member2.address, member1.address, "QmTransfer")
                ).to.be.revertedWith("StokvelOnChain: Member must have active membership");
            });

            it("Should revert if IPFS hash is empty", async function () {
                const { stokvel, member1, member2 } = await deployStokvelFixture();
                await stokvel.join(member1.address, "QmTest123");
                await expect(
                    stokvel.transferMembership(member2.address, member1.address, "")
                ).to.be.revertedWith("StokvelOnChain: IPFS hash required");
            });

            it("Should revert if non-owner tries to transfer", async function () {
                const { stokvel, member1, member2, member3 } = await deployStokvelFixture();
                await stokvel.join(member1.address, "QmTest123");
                await expect(
                    stokvel.connect(member3).transferMembership(member2.address, member1.address, "QmTransfer")
                ).to.be.revertedWithCustomError(stokvel, "OwnableUnauthorizedAccount");
            });

            it("Should revert when paused", async function () {
                const { stokvel, member1, member2 } = await deployStokvelFixture();
                await stokvel.join(member1.address, "QmTest123");
                await stokvel.pause();
                await expect(
                    stokvel.transferMembership(member2.address, member1.address, "QmTransfer")
                ).to.be.revertedWithCustomError(stokvel, "EnforcedPause");
            });
        });

        describe("Terminate Membership", function () {
            it("Should terminate membership and burn tokens", async function () {
                const { stokvel, rand, member1 } = await deployStokvelFixture();
                await stokvel.setContributionERC20(await rand.getAddress());
                await stokvel.join(member1.address, "QmTest123");
                await rand.connect(member1).approve(await stokvel.getAddress(), parseUnits("100", contribution_asset_decimals));
                await stokvel.connect(member1).contribute(parseUnits("100", contribution_asset_decimals));

                await stokvel.terminateMembership(member1.address, "QmTerminate789");

                const memberInfo = await stokvel.getMember(member1.address);
                expect(memberInfo.state).to.equal(MOUType.TERMINATED);
                expect(await stokvel.balanceOf(member1.address, 1)).to.equal(0);
            });

            it("Should emit MembershipTerminated event", async function () {
                const { stokvel, member1 } = await deployStokvelFixture();
                await stokvel.join(member1.address, "QmTest123");
                const terminateHash = "QmTerminate789";

                await expect(stokvel.terminateMembership(member1.address, terminateHash))
                    .to.emit(stokvel, "MembershipTerminated")
                    .withArgs(member1.address, terminateHash);
            });

            it("Should terminate membership when member has zero balance", async function () {
                const { stokvel, member1 } = await deployStokvelFixture();
                await stokvel.join(member1.address, "QmTest123");

                await stokvel.terminateMembership(member1.address, "QmTerminate789");

                const memberInfo = await stokvel.getMember(member1.address);
                expect(memberInfo.state).to.equal(MOUType.TERMINATED);
            });

            it("Should revert if member address is zero", async function () {
                const { stokvel } = await deployStokvelFixture();
                await expect(
                    stokvel.terminateMembership(ZeroAddress, "QmTerminate")
                ).to.be.revertedWith("StokvelOnChain: Invalid member address");
            });

            it("Should revert if member is not active", async function () {
                const { stokvel, member1 } = await deployStokvelFixture();
                await expect(
                    stokvel.terminateMembership(member1.address, "QmTerminate")
                ).to.be.revertedWith("StokvelOnChain: Member must have active membership");
            });

            it("Should revert if IPFS hash is empty", async function () {
                const { stokvel, member1 } = await deployStokvelFixture();
                await stokvel.join(member1.address, "QmTest123");
                await expect(
                    stokvel.terminateMembership(member1.address, "")
                ).to.be.revertedWith("StokvelOnChain: IPFS hash required");
            });

            it("Should revert if non-owner tries to terminate", async function () {
                const { stokvel, member1, member2 } = await deployStokvelFixture();
                await stokvel.join(member1.address, "QmTest123");
                await expect(
                    stokvel.connect(member2).terminateMembership(member1.address, "QmTerminate")
                ).to.be.revertedWithCustomError(stokvel, "OwnableUnauthorizedAccount");
            });

            it("Should revert when paused", async function () {
                const { stokvel, member1 } = await deployStokvelFixture();
                await stokvel.join(member1.address, "QmTest123");
                await stokvel.pause();
                await expect(
                    stokvel.terminateMembership(member1.address, "QmTerminate")
                ).to.be.revertedWithCustomError(stokvel, "EnforcedPause");
            });
        });
    });

    describe("Contributions", function () {
        it("Should allow active member to contribute", async function () {
            const { stokvel, rand, member1 } = await deployStokvelFixture();
            await stokvel.setContributionERC20(await rand.getAddress());
            await stokvel.join(member1.address, "QmTest123");

            const amount = parseUnits("100", contribution_asset_decimals);
            await rand.connect(member1).approve(await stokvel.getAddress(), amount);
            await stokvel.connect(member1).contribute(amount);

            expect(await stokvel.balanceOf(member1.address, 1)).to.equal(amount);
            expect(await rand.balanceOf(await stokvel.getAddress())).to.equal(amount);
        });

        it("Should emit ContributionMade event", async function () {
            const { stokvel, rand, member1 } = await deployStokvelFixture();
            await stokvel.setContributionERC20(await rand.getAddress());
            await stokvel.join(member1.address, "QmTest123");

            const amount = parseUnits("100", contribution_asset_decimals);
            await rand.connect(member1).approve(await stokvel.getAddress(), amount);

            await expect(stokvel.connect(member1).contribute(amount))
                .to.emit(stokvel, "ContributionMade")
                .withArgs(member1.address, amount);
        });

        it("Should revert if non-member tries to contribute", async function () {
            const { stokvel, rand, member1 } = await deployStokvelFixture();
            await stokvel.setContributionERC20(await rand.getAddress());

            const amount = parseUnits("100", contribution_asset_decimals);
            await rand.connect(member1).approve(await stokvel.getAddress(), amount);

            await expect(
                stokvel.connect(member1).contribute(amount)
            ).to.be.revertedWith("StokvelOnChain: Member must have active membership");
        });

        it("Should revert if amount is zero", async function () {
            const { stokvel, rand, member1 } = await deployStokvelFixture();
            await stokvel.setContributionERC20(await rand.getAddress());
            await stokvel.join(member1.address, "QmTest123");

            await expect(
                stokvel.connect(member1).contribute(0)
            ).to.be.revertedWith("StokvelOnChain: Amount must be greater than 0");
        });

        it("Should revert if contribution asset not set", async function () {
            const connection = await network.connect();
            const { ethers } = connection;
            const [owner, member1] = await ethers.getSigners();

            const quorum = parseUnits("200", contribution_asset_decimals);
            const stokvel: StokvelOnChain = await ethers.deployContract("StokvelOnChain", [
                '/StokvelOnchain/stokvelOne',
                quorum,
                ZeroAddress
            ]) as StokvelOnChain;
            await stokvel.waitForDeployment();

            await stokvel.join(member1.address, "QmTest123");

            await expect(
                stokvel.connect(member1).contribute(parseUnits("100", contribution_asset_decimals))
            ).to.be.revertedWith("StokvelOnChain: Contribution asset not set");
        });

        it("Should revert when paused", async function () {
            const { stokvel, rand, member1 } = await deployStokvelFixture();
            await stokvel.setContributionERC20(await rand.getAddress());
            await stokvel.join(member1.address, "QmTest123");

            const amount = parseUnits("100", contribution_asset_decimals);
            await rand.connect(member1).approve(await stokvel.getAddress(), amount);

            await stokvel.pause();

            await expect(
                stokvel.connect(member1).contribute(amount)
            ).to.be.revertedWithCustomError(stokvel, "EnforcedPause");
        });
    });

    describe("Governance", function () {
        describe("Approve To Use Contribution", function () {
            it("Should accumulate quorum from member votes", async function () {
                const { stokvel, rand, member1, member2, operator } = await deployStokvelFixture();
                await stokvel.setContributionERC20(await rand.getAddress());
                await stokvel.join(member1.address, "QmMember1");
                await stokvel.join(member2.address, "QmMember2");

                const amount = parseUnits("500", contribution_asset_decimals);
                await rand.connect(member1).approve(await stokvel.getAddress(), amount);
                await rand.connect(member2).approve(await stokvel.getAddress(), amount);
                await stokvel.connect(member1).contribute(amount);
                await stokvel.connect(member2).contribute(amount);

                await stokvel.approveToUseContribution(member1.address, operator.address);
                await stokvel.approveToUseContribution(member2.address, operator.address);

                expect(await stokvel.getQuorum(operator.address)).to.equal(parseUnits("1000", contribution_asset_decimals));
            });

            it("Should emit ApprovedToUseContribution event", async function () {
                const { stokvel, rand, member1, operator, quorum } = await deployStokvelFixture();
                await stokvel.setContributionERC20(await rand.getAddress());
                await stokvel.join(member1.address, "QmMember1");

                const amount = parseUnits("500", contribution_asset_decimals);
                await rand.connect(member1).approve(await stokvel.getAddress(), amount);
                await stokvel.connect(member1).contribute(amount);

                await expect(stokvel.approveToUseContribution(member1.address, operator.address))
                    .to.emit(stokvel, "ApprovedToUseContribution")
                    .withArgs(member1.address, operator.address, amount, amount, quorum);
            });

            it("Should revert if operator address is zero", async function () {
                const { stokvel, rand, member1 } = await deployStokvelFixture();
                await stokvel.setContributionERC20(await rand.getAddress());
                await stokvel.join(member1.address, "QmMember1");

                const amount = parseUnits("100", contribution_asset_decimals);
                await rand.connect(member1).approve(await stokvel.getAddress(), amount);
                await stokvel.connect(member1).contribute(amount);

                await expect(
                    stokvel.approveToUseContribution(member1.address, ZeroAddress)
                ).to.be.revertedWith("StokvelOnChain: Invalid operator address");
            });

            it("Should revert if voter is not active member", async function () {
                const { stokvel, member1, operator } = await deployStokvelFixture();
                await expect(
                    stokvel.approveToUseContribution(member1.address, operator.address)
                ).to.be.revertedWith("StokvelOnChain: Voter must be active member");
            });

            it("Should revert if voter has no contribution tokens", async function () {
                const { stokvel, member1, operator } = await deployStokvelFixture();
                await stokvel.join(member1.address, "QmMember1");

                await expect(
                    stokvel.approveToUseContribution(member1.address, operator.address)
                ).to.be.revertedWith("StokvelOnChain: Voter has no contribution tokens");
            });

            it("Should revert if non-owner tries to approve", async function () {
                const { stokvel, rand, member1, member2, operator } = await deployStokvelFixture();
                await stokvel.setContributionERC20(await rand.getAddress());
                await stokvel.join(member1.address, "QmMember1");

                const amount = parseUnits("100", contribution_asset_decimals);
                await rand.connect(member1).approve(await stokvel.getAddress(), amount);
                await stokvel.connect(member1).contribute(amount);

                await expect(
                    stokvel.connect(member2).approveToUseContribution(member1.address, operator.address)
                ).to.be.revertedWithCustomError(stokvel, "OwnableUnauthorizedAccount");
            });

            it("Should revert when paused", async function () {
                const { stokvel, rand, member1, operator } = await deployStokvelFixture();
                await stokvel.setContributionERC20(await rand.getAddress());
                await stokvel.join(member1.address, "QmMember1");

                const amount = parseUnits("100", contribution_asset_decimals);
                await rand.connect(member1).approve(await stokvel.getAddress(), amount);
                await stokvel.connect(member1).contribute(amount);

                await stokvel.pause();

                await expect(
                    stokvel.approveToUseContribution(member1.address, operator.address)
                ).to.be.revertedWithCustomError(stokvel, "EnforcedPause");
            });
        });

        describe("Grant Permission To Use Contribution", function () {
            it("Should grant permission when quorum is reached", async function () {
                const { stokvel, rand, member1, member2, operator, quorum } = await deployStokvelFixture();
                await stokvel.setContributionERC20(await rand.getAddress());
                await stokvel.join(member1.address, "QmMember1");
                await stokvel.join(member2.address, "QmMember2");

                const amount = parseUnits("500", contribution_asset_decimals);
                await rand.connect(member1).approve(await stokvel.getAddress(), amount);
                await rand.connect(member2).approve(await stokvel.getAddress(), amount);
                await stokvel.connect(member1).contribute(amount);
                await stokvel.connect(member2).contribute(amount);

                await stokvel.approveToUseContribution(member1.address, operator.address);
                await stokvel.approveToUseContribution(member2.address, operator.address);

                await stokvel.grantPermissionToUseContribution(operator.address, parseUnits("1000", contribution_asset_decimals));

                expect(await rand.allowance(await stokvel.getAddress(), operator.address)).to.equal(parseUnits("1000", contribution_asset_decimals));
            });

            it("Should emit PermissionGrantedToUseContribution event", async function () {
                const { stokvel, rand, member1, member2, operator, quorum } = await deployStokvelFixture();
                await stokvel.setContributionERC20(await rand.getAddress());
                await stokvel.join(member1.address, "QmMember1");
                await stokvel.join(member2.address, "QmMember2");

                const amount = parseUnits("500", contribution_asset_decimals);
                await rand.connect(member1).approve(await stokvel.getAddress(), amount);
                await rand.connect(member2).approve(await stokvel.getAddress(), amount);
                await stokvel.connect(member1).contribute(amount);
                await stokvel.connect(member2).contribute(amount);

                await stokvel.approveToUseContribution(member1.address, operator.address);
                await stokvel.approveToUseContribution(member2.address, operator.address);

                const grantAmount = parseUnits("1000", contribution_asset_decimals);
                const totalQuorum = parseUnits("1000", contribution_asset_decimals);

                await expect(stokvel.grantPermissionToUseContribution(operator.address, grantAmount))
                    .to.emit(stokvel, "PermissionGrantedToUseContribution")
                    .withArgs(operator.address, grantAmount, await rand.getAddress(), totalQuorum, quorum);
            });

            it("Should reset quorum after granting permission", async function () {
                const { stokvel, rand, member1, member2, operator } = await deployStokvelFixture();
                await stokvel.setContributionERC20(await rand.getAddress());
                await stokvel.join(member1.address, "QmMember1");
                await stokvel.join(member2.address, "QmMember2");

                const amount = parseUnits("500", contribution_asset_decimals);
                await rand.connect(member1).approve(await stokvel.getAddress(), amount);
                await rand.connect(member2).approve(await stokvel.getAddress(), amount);
                await stokvel.connect(member1).contribute(amount);
                await stokvel.connect(member2).contribute(amount);

                await stokvel.approveToUseContribution(member1.address, operator.address);
                await stokvel.approveToUseContribution(member2.address, operator.address);

                await stokvel.grantPermissionToUseContribution(operator.address, parseUnits("1000", contribution_asset_decimals));

                expect(await stokvel.getQuorum(operator.address)).to.equal(0);
            });

            it("Should revert if quorum not reached", async function () {
                const { stokvel, operator } = await deployStokvelFixture();
                await expect(
                    stokvel.grantPermissionToUseContribution(operator.address, parseUnits("1000", contribution_asset_decimals))
                ).to.be.revertedWith("StokvelOnChain: Quorum not reached");
            });

            it("Should revert if contribution asset not set", async function () {
                const connection = await network.connect();
                const { ethers } = connection;
                const [owner] = await ethers.getSigners();

                const quorum = parseUnits("200", contribution_asset_decimals);
                const stokvel: StokvelOnChain = await ethers.deployContract("StokvelOnChain", [
                    '/StokvelOnchain/stokvelOne',
                    quorum,
                    ZeroAddress
                ]) as StokvelOnChain;
                await stokvel.waitForDeployment();

                const [, , , , operator] = await ethers.getSigners();

                await expect(
                    stokvel.grantPermissionToUseContribution(operator.address, parseUnits("100", contribution_asset_decimals))
                ).to.be.revertedWith("StokvelOnChain: Contribution asset not set");
            });

            it("Should revert if operator address is zero", async function () {
                const { stokvel } = await deployStokvelFixture();
                await expect(
                    stokvel.grantPermissionToUseContribution(ZeroAddress, parseUnits("100", contribution_asset_decimals))
                ).to.be.revertedWith("StokvelOnChain: Invalid operator address");
            });

            it("Should revert if amount is zero", async function () {
                const { stokvel, operator } = await deployStokvelFixture();
                await expect(
                    stokvel.grantPermissionToUseContribution(operator.address, 0)
                ).to.be.revertedWith("StokvelOnChain: Amount must be greater than 0");
            });

            it("Should revert if non-owner tries to grant permission", async function () {
                const { stokvel, member1, operator } = await deployStokvelFixture();
                await expect(
                    stokvel.connect(member1).grantPermissionToUseContribution(operator.address, parseUnits("100", contribution_asset_decimals))
                ).to.be.revertedWithCustomError(stokvel, "OwnableUnauthorizedAccount");
            });

            it("Should revert when paused", async function () {
                const { stokvel, rand, member1, member2, operator } = await deployStokvelFixture();
                await stokvel.setContributionERC20(await rand.getAddress());
                await stokvel.join(member1.address, "QmMember1");
                await stokvel.join(member2.address, "QmMember2");

                const amount = parseUnits("500", contribution_asset_decimals);
                await rand.connect(member1).approve(await stokvel.getAddress(), amount);
                await rand.connect(member2).approve(await stokvel.getAddress(), amount);
                await stokvel.connect(member1).contribute(amount);
                await stokvel.connect(member2).contribute(amount);

                await stokvel.approveToUseContribution(member1.address, operator.address);
                await stokvel.approveToUseContribution(member2.address, operator.address);

                await stokvel.pause();

                await expect(
                    stokvel.grantPermissionToUseContribution(operator.address, parseUnits("1000", contribution_asset_decimals))
                ).to.be.revertedWithCustomError(stokvel, "EnforcedPause");
            });
        });

        describe("Reset Quorum", function () {
            it("Should reset quorum for operator", async function () {
                const { stokvel, rand, member1, operator } = await deployStokvelFixture();
                await stokvel.setContributionERC20(await rand.getAddress());
                await stokvel.join(member1.address, "QmMember1");

                const amount = parseUnits("500", contribution_asset_decimals);
                await rand.connect(member1).approve(await stokvel.getAddress(), amount);
                await stokvel.connect(member1).contribute(amount);

                await stokvel.approveToUseContribution(member1.address, operator.address);
                expect(await stokvel.getQuorum(operator.address)).to.equal(amount);

                await stokvel.resetQuorum(operator.address);
                expect(await stokvel.getQuorum(operator.address)).to.equal(0);
            });

            it("Should revert if non-owner tries to reset quorum", async function () {
                const { stokvel, member1, operator } = await deployStokvelFixture();
                await expect(
                    stokvel.connect(member1).resetQuorum(operator.address)
                ).to.be.revertedWithCustomError(stokvel, "OwnableUnauthorizedAccount");
            });
        });
    });

    describe("Distribution", function () {
        describe("Distribute Contribution Asset", function () {
            it("Should distribute assets proportionally", async function () {
                const { stokvel, rand, member1, member2 } = await deployStokvelFixture();
                await stokvel.setContributionERC20(await rand.getAddress());
                await stokvel.join(member1.address, "QmMember1");
                await stokvel.join(member2.address, "QmMember2");

                await rand.connect(member1).approve(await stokvel.getAddress(), parseUnits("600", contribution_asset_decimals));
                await rand.connect(member2).approve(await stokvel.getAddress(), parseUnits("400", contribution_asset_decimals));
                await stokvel.connect(member1).contribute(parseUnits("600", contribution_asset_decimals));
                await stokvel.connect(member2).contribute(parseUnits("400", contribution_asset_decimals));

                await stokvel.distributeContributionAsset(member1.address);

                expect(await rand.balanceOf(member1.address)).to.equal(parseUnits("10000", contribution_asset_decimals));
                expect(await stokvel.balanceOf(member1.address, 1)).to.equal(0);
            });

            it("Should emit ContributionDistributed event", async function () {
                const { stokvel, rand, member1 } = await deployStokvelFixture();
                await stokvel.setContributionERC20(await rand.getAddress());
                await stokvel.join(member1.address, "QmMember1");

                await rand.connect(member1).approve(await stokvel.getAddress(), parseUnits("100", contribution_asset_decimals));
                await stokvel.connect(member1).contribute(parseUnits("100", contribution_asset_decimals));

                await expect(stokvel.distributeContributionAsset(member1.address))
                    .to.emit(stokvel, "ContributionDistributed")
                    .withArgs(member1.address, parseUnits("100", contribution_asset_decimals));
            });

            it("Should revert if member has no contribution", async function () {
                const { stokvel, member1 } = await deployStokvelFixture();
                await expect(
                    stokvel.distributeContributionAsset(member1.address)
                ).to.be.revertedWith("StokvelOnChain: No contribution found");
            });

            it("Should revert if total supply is zero", async function () {
                const connection = await network.connect();
                const { ethers } = connection;
                const [owner, member1] = await ethers.getSigners();

                const rand: MockERC20 = await ethers.deployContract("MockERC20", ["RandCoin", "RZAR", contribution_asset_decimals]) as MockERC20;
                await rand.waitForDeployment();

                const quorum = parseUnits("200", contribution_asset_decimals);
                const stokvel: StokvelOnChain = await ethers.deployContract("StokvelOnChain", [
                    '/StokvelOnchain/stokvelOne',
                    quorum,
                    await rand.getAddress()
                ]) as StokvelOnChain;
                await stokvel.waitForDeployment();

                await expect(
                    stokvel.distributeContributionAsset(member1.address)
                ).to.be.revertedWith("StokvelOnChain: No contribution found");
            });

            it("Should revert if contract has no assets to distribute", async function () {
                const connection = await network.connect();
                const { ethers } = connection;
                const [owner, member1] = await ethers.getSigners();

                const rand: MockERC20 = await ethers.deployContract("MockERC20", ["RandCoin", "RZAR", contribution_asset_decimals]) as MockERC20;
                await rand.waitForDeployment();

                const quorum = parseUnits("200", contribution_asset_decimals);
                const stokvel: StokvelOnChain = await ethers.deployContract("StokvelOnChain", [
                    '/StokvelOnchain/stokvelOne',
                    quorum,
                    await rand.getAddress()
                ]) as StokvelOnChain;
                await stokvel.waitForDeployment();

                await stokvel.join(member1.address, "QmMember1");

                await stokvel.connect(owner).getFunction("safeTransferFrom(address,address,uint256,uint256,bytes)").call(
                    ZeroAddress,
                    member1.address,
                    1,
                    parseUnits("100", contribution_asset_decimals),
                    "0x"
                );
                await expect(
                    stokvel.distributeContributionAsset(member1.address)
                ).to.be.revertedWith("StokvelOnChain: No assets to distribute");
            });

            it("Should revert if non-owner tries to distribute", async function () {
                const { stokvel, rand, member1, member2 } = await deployStokvelFixture();
                await stokvel.setContributionERC20(await rand.getAddress());
                await stokvel.join(member1.address, "QmMember1");

                await rand.connect(member1).approve(await stokvel.getAddress(), parseUnits("100", contribution_asset_decimals));
                await stokvel.connect(member1).contribute(parseUnits("100", contribution_asset_decimals));

                await expect(
                    stokvel.connect(member2).distributeContributionAsset(member1.address)
                ).to.be.revertedWithCustomError(stokvel, "OwnableUnauthorizedAccount");
            });

            it("Should revert when paused", async function () {
                const { stokvel, rand, member1 } = await deployStokvelFixture();
                await stokvel.setContributionERC20(await rand.getAddress());
                await stokvel.join(member1.address, "QmMember1");

                await rand.connect(member1).approve(await stokvel.getAddress(), parseUnits("100", contribution_asset_decimals));
                await stokvel.connect(member1).contribute(parseUnits("100", contribution_asset_decimals));

                await stokvel.pause();

                await expect(
                    stokvel.distributeContributionAsset(member1.address)
                ).to.be.revertedWithCustomError(stokvel, "EnforcedPause");
            });
        });

        describe("Batch Distribute Contribution Asset", function () {
            it("Should distribute to multiple members", async function () {
                const { stokvel, rand, member1, member2, member3 } = await deployStokvelFixture();
                await stokvel.setContributionERC20(await rand.getAddress());
                await stokvel.join(member1.address, "QmMember1");
                await stokvel.join(member2.address, "QmMember2");
                await stokvel.join(member3.address, "QmMember3");

                const amount = parseUnits("300", contribution_asset_decimals);
                await rand.connect(member1).approve(await stokvel.getAddress(), amount);
                await rand.connect(member2).approve(await stokvel.getAddress(), amount);
                await rand.connect(member3).approve(await stokvel.getAddress(), amount);
                await stokvel.connect(member1).contribute(amount);
                await stokvel.connect(member2).contribute(amount);
                await stokvel.connect(member3).contribute(amount);

                await stokvel.batchDistributeContributionAsset([member1.address, member2.address, member3.address]);

                expect(await stokvel.balanceOf(member1.address, 1)).to.equal(0);
                expect(await stokvel.balanceOf(member2.address, 1)).to.equal(0);
                expect(await stokvel.balanceOf(member3.address, 1)).to.equal(0);
            });

            it("Should emit ContributionDistributed events for each member", async function () {
                const { stokvel, rand, member1, member2 } = await deployStokvelFixture();
                await stokvel.setContributionERC20(await rand.getAddress());
                await stokvel.join(member1.address, "QmMember1");
                await stokvel.join(member2.address, "QmMember2");

                const amount = parseUnits("500", contribution_asset_decimals);
                await rand.connect(member1).approve(await stokvel.getAddress(), amount);
                await rand.connect(member2).approve(await stokvel.getAddress(), amount);
                await stokvel.connect(member1).contribute(amount);
                await stokvel.connect(member2).contribute(amount);

                await expect(stokvel.batchDistributeContributionAsset([member1.address, member2.address]))
                    .to.emit(stokvel, "ContributionDistributed")
                    .withArgs(member1.address, amount);
            });

            it("Should skip members with zero balance", async function () {
                const { stokvel, rand, member1, member2, member3 } = await deployStokvelFixture();
                await stokvel.setContributionERC20(await rand.getAddress());
                await stokvel.join(member1.address, "QmMember1");
                await stokvel.join(member2.address, "QmMember2");

                const amount = parseUnits("500", contribution_asset_decimals);
                await rand.connect(member1).approve(await stokvel.getAddress(), amount);
                await stokvel.connect(member1).contribute(amount);

                await stokvel.batchDistributeContributionAsset([member1.address, member2.address, member3.address]);

                expect(await stokvel.balanceOf(member1.address, 1)).to.equal(0);
            });

            it("Should revert if members list is empty", async function () {
                const { stokvel } = await deployStokvelFixture();
                await expect(
                    stokvel.batchDistributeContributionAsset([])
                ).to.be.revertedWith("StokvelOnChain: Empty members list");
            });

            it("Should revert if contribution asset not set", async function () {
                const connection = await network.connect();
                const { ethers } = connection;
                const [owner, member1] = await ethers.getSigners();

                const quorum = parseUnits("200", contribution_asset_decimals);
                const stokvel: StokvelOnChain = await ethers.deployContract("StokvelOnChain", [
                    '/StokvelOnchain/stokvelOne',
                    quorum,
                    ZeroAddress
                ]) as StokvelOnChain;
                await stokvel.waitForDeployment();

                await expect(
                    stokvel.batchDistributeContributionAsset([member1.address])
                ).to.be.revertedWith("StokvelOnChain: Contribution asset not set");
            });

            it("Should revert if total supply is zero", async function () {
                const { stokvel, rand, member1 } = await deployStokvelFixture();
                await stokvel.setContributionERC20(await rand.getAddress());

                await expect(
                    stokvel.batchDistributeContributionAsset([member1.address])
                ).to.be.revertedWith("StokvelOnChain: No total supply");
            });

            it("Should revert if contract has no assets to distribute", async function () {
                const connection = await network.connect();
                const { ethers } = connection;
                const [owner, member1] = await ethers.getSigners();

                const rand: MockERC20 = await ethers.deployContract("MockERC20", ["RandCoin", "RZAR", contribution_asset_decimals]) as MockERC20;
                await rand.waitForDeployment();

                const quorum = parseUnits("200", contribution_asset_decimals);
                const stokvel: StokvelOnChain = await ethers.deployContract("StokvelOnChain", [
                    '/StokvelOnchain/stokvelOne',
                    quorum,
                    await rand.getAddress()
                ]) as StokvelOnChain;
                await stokvel.waitForDeployment();

                await stokvel.join(member1.address, "QmMember1");

                await stokvel.connect(owner).getFunction("safeTransferFrom(address,address,uint256,uint256,bytes)").call(
                    ZeroAddress,
                    member1.address,
                    1,
                    parseUnits("100", contribution_asset_decimals),
                    "0x"
                );

                await expect(
                    stokvel.batchDistributeContributionAsset([member1.address])
                ).to.be.revertedWith("StokvelOnChain: No assets to distribute");
            });

            it("Should revert if non-owner tries to batch distribute", async function () {
                const { stokvel, rand, member1, member2 } = await deployStokvelFixture();
                await stokvel.setContributionERC20(await rand.getAddress());
                await stokvel.join(member1.address, "QmMember1");

                await rand.connect(member1).approve(await stokvel.getAddress(), parseUnits("100", contribution_asset_decimals));
                await stokvel.connect(member1).contribute(parseUnits("100", contribution_asset_decimals));

                await expect(
                    stokvel.connect(member2).batchDistributeContributionAsset([member1.address])
                ).to.be.revertedWithCustomError(stokvel, "OwnableUnauthorizedAccount");
            });

            it("Should revert when paused", async function () {
                const { stokvel, rand, member1 } = await deployStokvelFixture();
                await stokvel.setContributionERC20(await rand.getAddress());
                await stokvel.join(member1.address, "QmMember1");

                await rand.connect(member1).approve(await stokvel.getAddress(), parseUnits("100", contribution_asset_decimals));
                await stokvel.connect(member1).contribute(parseUnits("100", contribution_asset_decimals));

                await stokvel.pause();

                await expect(
                    stokvel.batchDistributeContributionAsset([member1.address])
                ).to.be.revertedWithCustomError(stokvel, "EnforcedPause");
            });
        });
    });

    describe("View Functions", function () {
        it("Should get member information", async function () {
            const { stokvel, member1 } = await deployStokvelFixture();
            const ipfsHash = "QmTest123";
            await stokvel.join(member1.address, ipfsHash);

            const member = await stokvel.getMember(member1.address);
            expect(member.contractIPFSHash).to.equal(ipfsHash);
            expect(member.state).to.equal(MOUType.ACTIVE);
        });

        it("Should check if address is active member", async function () {
            const { stokvel, member1 } = await deployStokvelFixture();
            expect(await stokvel.isActiveMember(member1.address)).to.equal(false);

            await stokvel.join(member1.address, "QmTest123");
            expect(await stokvel.isActiveMember(member1.address)).to.equal(true);
        });

        it("Should get quorum for operator", async function () {
            const { stokvel, rand, member1, operator } = await deployStokvelFixture();
            await stokvel.setContributionERC20(await rand.getAddress());
            await stokvel.join(member1.address, "QmMember1");

            const amount = parseUnits("500", contribution_asset_decimals);
            await rand.connect(member1).approve(await stokvel.getAddress(), amount);
            await stokvel.connect(member1).contribute(amount);

            expect(await stokvel.getQuorum(operator.address)).to.equal(0);

            await stokvel.approveToUseContribution(member1.address, operator.address);
            expect(await stokvel.getQuorum(operator.address)).to.equal(amount);
        });

        it("Should get contribution balance", async function () {
            const { stokvel, rand, member1 } = await deployStokvelFixture();
            await stokvel.setContributionERC20(await rand.getAddress());
            await stokvel.join(member1.address, "QmMember1");

            expect(await stokvel.getContributionBalance(member1.address)).to.equal(0);

            const amount = parseUnits("100", contribution_asset_decimals);
            await rand.connect(member1).approve(await stokvel.getAddress(), amount);
            await stokvel.connect(member1).contribute(amount);

            expect(await stokvel.getContributionBalance(member1.address)).to.equal(amount);
        });

        it("Should get total contributions", async function () {
            const { stokvel, rand, member1, member2 } = await deployStokvelFixture();
            await stokvel.setContributionERC20(await rand.getAddress());
            await stokvel.join(member1.address, "QmMember1");
            await stokvel.join(member2.address, "QmMember2");

            expect(await stokvel.getTotalContributions()).to.equal(0);

            const amount = parseUnits("100", contribution_asset_decimals);
            await rand.connect(member1).approve(await stokvel.getAddress(), amount);
            await rand.connect(member2).approve(await stokvel.getAddress(), amount);
            await stokvel.connect(member1).contribute(amount);
            await stokvel.connect(member2).contribute(amount);

            expect(await stokvel.getTotalContributions()).to.equal(parseUnits("200", contribution_asset_decimals));
        });

        it("Should get contribution asset balance", async function () {
            const { stokvel, rand, member1 } = await deployStokvelFixture();
            await stokvel.setContributionERC20(await rand.getAddress());
            await stokvel.join(member1.address, "QmMember1");

            expect(await stokvel.getContributionAssetBalance()).to.equal(0);

            const amount = parseUnits("100", contribution_asset_decimals);
            await rand.connect(member1).approve(await stokvel.getAddress(), amount);
            await stokvel.connect(member1).contribute(amount);

            expect(await stokvel.getContributionAssetBalance()).to.equal(amount);
        });

        it("Should return zero if contribution asset not set", async function () {
            const connection = await network.connect();
            const { ethers } = connection;

            const quorum = parseUnits("200", contribution_asset_decimals);
            const stokvel: StokvelOnChain = await ethers.deployContract("StokvelOnChain", [
                '/StokvelOnchain/stokvelOne',
                quorum,
                ZeroAddress
            ]) as StokvelOnChain;
            await stokvel.waitForDeployment();

            expect(await stokvel.getContributionAssetBalance()).to.equal(0);
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
                stokvel.join(member1.address, "QmTest")
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

        it("Should prevent token transfers when paused", async function () {
            const { stokvel, rand, member1, member2 } = await deployStokvelFixture();
            await stokvel.setContributionERC20(await rand.getAddress());
            await stokvel.join(member1.address, "QmMember1");
            await stokvel.join(member2.address, "QmMember2");

            const amount = parseUnits("100", contribution_asset_decimals);
            await rand.connect(member1).approve(await stokvel.getAddress(), amount);
            await stokvel.connect(member1).contribute(amount);

            await stokvel.pause();

            await expect(
                await stokvel.connect(member1).getFunction("safeTransferFrom(address,address,uint256,uint256,bytes)").call(
                    ZeroAddress,
                    member1.address,
                    1,
                    parseUnits("100", contribution_asset_decimals),
                    "0x"
                )
            ).to.be.revertedWithCustomError(stokvel, "EnforcedPause");
        });
    });
});