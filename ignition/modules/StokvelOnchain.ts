import { buildModule } from "@nomicfoundation/hardhat-ignition/modules";

const AfrocoinModule = buildModule("StokvelOnchainModule", (m) => {
  const afrocoin = m.contract("StokvelOnchain", [
    '/StokvelOnchain/stokvelOne',
    'StokvelOne',
    2e18,
    '0x7452210945903CA9D19AAC6EfC37C5dD7ce90d5a'
  ]);
  return { afrocoin };
});


export default AfrocoinModule;
