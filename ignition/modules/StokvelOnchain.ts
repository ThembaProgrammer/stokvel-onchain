import { buildModule } from "@nomicfoundation/hardhat-ignition/modules";
import { parseEther } from "ethers";

const AfrocoinModule = buildModule("StokvelOnchainModule", (m) => {
  const afrocoin = m.contract("StokvelOnChain", [
    '/StokvelOnchain/stokvelOne',
    parseEther('100'),
    '0x7452210945903CA9D19AAC6EfC37C5dD7ce90d5a',
    '0xBd48b01f1B4CB5A7Fa329c48Cb2C3e75d8B75444'
  ]);
  return { afrocoin };
});


export default AfrocoinModule;
