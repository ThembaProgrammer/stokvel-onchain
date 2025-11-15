import { network } from "hardhat";

async function main() {
    const connection = await network.connect();
    const { ethers } = connection;
    const [signer] = await ethers.getSigners();
    console.log("Deployer address:", signer.address);

    const balance = await ethers.provider.getBalance(signer.address);
    console.log("Balance:", ethers.formatEther(balance), "ETH");
}

main().catch((error) => {
    console.error(error);
    process.exitCode = 1;
});