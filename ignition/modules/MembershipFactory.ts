import { buildModule } from "@nomicfoundation/hardhat-ignition/modules";

const MembershipFactoryModule = buildModule("MembershipFactoryModule", (m) => {
  const membershipFactory = m.contract("MembershipFactory", []);
  return { membershipFactory };
});

export default MembershipFactoryModule;
