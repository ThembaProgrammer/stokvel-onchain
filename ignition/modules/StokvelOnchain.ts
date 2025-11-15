import { buildModule } from "@nomicfoundation/hardhat-ignition/modules";
import { parseEther } from "ethers";

const AfrocoinModule = buildModule("StokvelOnchainModule", (m) => {
  const afrocoin = m.contract("StokvelOnchain", [
    '/StokvelOnchain/stokvelOne',
    'StokvelOne',
    parseEther('100'),
    '0x7452210945903CA9D19AAC6EfC37C5dD7ce90d5a'
  ]);
  return { afrocoin };
});


export default AfrocoinModule;
