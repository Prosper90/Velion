const hre = require("hardhat");

/**
 * Check Token Ownership
 * Diagnoses who owns the deployed tokens
 */

const TOKENS = {
  USDC: "0x1c7D4B196Cb0C7B01d743Fbc6116a902379C7238",
  USDT: "0xaA8E23Fb1079EA71e0a56F48a2aA51851D8433D0",
};

const TOKEN_ABI = [
  "function name() view returns (string)",
  "function symbol() view returns (string)",
  "function decimals() view returns (uint8)",
  "function owner() view returns (address)",
  "function totalSupply() view returns (uint256)",
];

async function main() {
  console.log("🔍 Token Ownership Diagnostic\n");

  const [signer] = await hre.ethers.getSigners();
  const signerAddress = await signer.getAddress();

  console.log("Your address:", signerAddress);
  console.log("Network:", hre.network.name);

  console.log("\n" + "=".repeat(70));

  for (const [name, address] of Object.entries(TOKENS)) {
    console.log(`\n💎 ${name}: ${address}`);

    try {
      const token = new hre.ethers.Contract(address, TOKEN_ABI, signer);

      // Get basic info
      const symbol = await token.symbol();
      const decimals = await token.decimals();
      const totalSupply = await token.totalSupply();

      console.log(`   Symbol: ${symbol}`);
      console.log(`   Decimals: ${decimals}`);
      console.log(`   Total Supply: ${hre.ethers.formatUnits(totalSupply, decimals)}`);

      // Try to get owner
      try {
        const owner = await token.owner();
        console.log(`   Owner: ${owner}`);

        if (owner.toLowerCase() === signerAddress.toLowerCase()) {
          console.log(`   ✅ YOU ARE THE OWNER - Minting should work!`);
        } else {
          console.log(`   ❌ YOU ARE NOT THE OWNER - Minting will fail!`);
          console.log(`   💡 You need to use account: ${owner}`);
        }
      } catch (error) {
        console.log(`   ℹ️  No owner() function - anyone can mint (MockERC20 style)`);
        console.log(`   ✅ Minting should work for anyone!`);
      }

      // Try to check contract code
      const code = await hre.ethers.provider.getCode(address);
      if (code === "0x") {
        console.log(`   ⚠️  WARNING: No contract deployed at this address!`);
      } else {
        console.log(`   ✅ Contract is deployed (${code.length / 2 - 1} bytes)`);
      }
    } catch (error) {
      console.error(`   ❌ Error:`, error.message);
    }
  }

  console.log("\n" + "=".repeat(70));
}

main()
  .then(() => process.exit(0))
  .catch((error) => {
    console.error("\n❌ Check failed:");
    console.error(error);
    process.exit(1);
  });
