const hre = require("hardhat");
const fs = require("fs");
const path = require("path");

/**
 * Deployment Script for Disaster Relief Stablecoin System
 * 
 * This script deploys:
 * 1. ReliefStablecoin (RUSD) - ERC-20 token
 * 2. ReliefFundManager - Admin & spending controls
 * 
 * Then links them together and exports addresses for frontend
 */
async function main() {
    console.log("\n🚀 DISASTER RELIEF STABLECOIN SYSTEM DEPLOYMENT");
    console.log("================================================\n");

    const [deployer] = await hre.ethers.getSigners();
    const network = hre.network.name;
    
    console.log(`📍 Network: ${network}`);
    console.log(`👤 Deployer: ${deployer.address}`);
    console.log(`💰 Balance: ${hre.ethers.formatEther(await hre.ethers.provider.getBalance(deployer.address))} ETH\n`);

    // ============ Deploy ReliefStablecoin ============
    console.log("📦 Deploying ReliefStablecoin (RUSD)...");
    const ReliefStablecoin = await hre.ethers.getContractFactory("ReliefStablecoin");
    const stablecoin = await ReliefStablecoin.deploy();
    await stablecoin.waitForDeployment();
    const stablecoinAddress = await stablecoin.getAddress();
    console.log(`✅ ReliefStablecoin deployed: ${stablecoinAddress}\n`);

    // ============ Deploy ReliefFundManager ============
    console.log("📦 Deploying ReliefFundManager...");
    const ReliefFundManager = await hre.ethers.getContractFactory("ReliefFundManager");
    const fundManager = await ReliefFundManager.deploy();
    await fundManager.waitForDeployment();
    const fundManagerAddress = await fundManager.getAddress();
    console.log(`✅ ReliefFundManager deployed: ${fundManagerAddress}\n`);

    // ============ Link Contracts (Bidirectional) ============
    console.log("🔗 Linking contracts...");
    
    // Link Stablecoin -> FundManager
    const linkTx1 = await stablecoin.setFundManager(fundManagerAddress);
    await linkTx1.wait();
    console.log(`   ✅ ReliefStablecoin linked to ReliefFundManager`);
    
    // Link FundManager -> Stablecoin (for recordTransfer)
    const linkTx2 = await fundManager.setStablecoin(stablecoinAddress);
    await linkTx2.wait();
    console.log(`   ✅ ReliefFundManager linked to ReliefStablecoin\n`);

    // ============ Setup Demo Data (for local/testnet) ============
    if (network === "localhost" || network === "hardhat" || network === "sepolia") {
        console.log("🎭 Setting up demo data...\n");
        
        // Get additional signers for demo (if available)
        const signers = await hre.ethers.getSigners();
        
        let beneficiaryAddr, beneficiary2Addr, merchantFoodAddr, merchantMedicalAddr, merchantShelterAddr, merchantEducationAddr, merchantUtilitiesAddr;
        
        if (signers.length >= 8) {
            beneficiaryAddr = signers[1].address;
            beneficiary2Addr = signers[2].address;
            merchantFoodAddr = signers[3].address;
            merchantMedicalAddr = signers[4].address;
            merchantShelterAddr = signers[5].address;
            merchantEducationAddr = signers[6].address;
            merchantUtilitiesAddr = signers[7].address;
        } else {
            // Use Hardhat's default test accounts
            beneficiaryAddr = "0x70997970C51812dc3A010C7d01b50e0d17dc79C8";
            beneficiary2Addr = "0x3C44CdDdB6a900fa2b585dd299e03d12FA4293BC";
            merchantFoodAddr = "0x90F79bf6EB2c4f870365E785982E1f101E93b906";
            merchantMedicalAddr = "0x15d34AAf54267DB7D7c367839AAf71A00a2C6A65";
            merchantShelterAddr = "0x9965507D1a55bcC2695C58ba16FB37d819B0A4dc";
            merchantEducationAddr = "0x976EA74026E726554dB657fA54763abd0C3a0aa9";
            merchantUtilitiesAddr = "0x14dC79964da2C08b23698B3D3cc7Ca32193d9955";
        }
        
        // Add beneficiaries
        console.log(`   Adding beneficiary 1: ${beneficiaryAddr}`);
        await (await fundManager.addBeneficiary(beneficiaryAddr)).wait();
        
        console.log(`   Adding beneficiary 2: ${beneficiary2Addr}`);
        await (await fundManager.addBeneficiary(beneficiary2Addr)).wait();
        
        // Add merchants for ALL categories
        console.log(`   Adding FOOD merchant: ${merchantFoodAddr}`);
        await (await fundManager.addMerchant(merchantFoodAddr, 0, "City Grocery Store")).wait();
        
        console.log(`   Adding MEDICAL merchant: ${merchantMedicalAddr}`);
        await (await fundManager.addMerchant(merchantMedicalAddr, 1, "Community Pharmacy")).wait();
        
        console.log(`   Adding SHELTER merchant: ${merchantShelterAddr}`);
        await (await fundManager.addMerchant(merchantShelterAddr, 2, "Relief Housing Co")).wait();
        
        console.log(`   Adding EDUCATION merchant: ${merchantEducationAddr}`);
        await (await fundManager.addMerchant(merchantEducationAddr, 3, "School Supplies Shop")).wait();
        
        console.log(`   Adding UTILITIES merchant: ${merchantUtilitiesAddr}`);
        await (await fundManager.addMerchant(merchantUtilitiesAddr, 4, "Power & Water Services")).wait();
        
        // Mint tokens to beneficiaries
        const mintAmount = hre.ethers.parseEther("1000");
        console.log(`   Minting 1000 RUSD to beneficiary 1...`);
        await (await stablecoin.mint(beneficiaryAddr, mintAmount)).wait();
        await (await fundManager.recordDistribution(beneficiaryAddr, mintAmount)).wait();
        
        const mintAmount2 = hre.ethers.parseEther("500");
        console.log(`   Minting 500 RUSD to beneficiary 2...`);
        await (await stablecoin.mint(beneficiary2Addr, mintAmount2)).wait();
        await (await fundManager.recordDistribution(beneficiary2Addr, mintAmount2)).wait();
        
        console.log("\n✅ Demo data setup complete!\n");
    }

    // ============ Export Deployment Info ============
    const deploymentInfo = {
        network: network,
        deployer: deployer.address,
        contracts: {
            ReliefStablecoin: stablecoinAddress,
            ReliefFundManager: fundManagerAddress
        },
        timestamp: new Date().toISOString(),
        chainId: (await hre.ethers.provider.getNetwork()).chainId.toString()
    };

    // Save to deployments folder
    const deploymentsDir = path.join(__dirname, "..", "deployments");
    if (!fs.existsSync(deploymentsDir)) {
        fs.mkdirSync(deploymentsDir, { recursive: true });
    }
    
    const deploymentFile = path.join(deploymentsDir, `${network}.json`);
    fs.writeFileSync(deploymentFile, JSON.stringify(deploymentInfo, null, 2));
    console.log(`📁 Deployment info saved to: ${deploymentFile}`);

    // Also save to frontend config
    const frontendDir = path.join(__dirname, "..", "frontend");
    if (!fs.existsSync(frontendDir)) {
        fs.mkdirSync(frontendDir, { recursive: true });
    }
    
    const frontendConfig = path.join(frontendDir, "config.js");
    const configContent = `// Auto-generated deployment configuration
// Network: ${network}
// Deployed: ${deploymentInfo.timestamp}

const CONFIG = {
    NETWORK: "${network}",
    CHAIN_ID: ${deploymentInfo.chainId},
    RELIEF_STABLECOIN: "${stablecoinAddress}",
    RELIEF_FUND_MANAGER: "${fundManagerAddress}",
    EXPLORER: ${network === "sepolia" ? '"https://sepolia.etherscan.io"' : '"http://localhost:8545"'}
};

// Export for use in frontend
if (typeof module !== 'undefined') {
    module.exports = CONFIG;
}
`;
    fs.writeFileSync(frontendConfig, configContent);
    console.log(`📁 Frontend config saved to: ${frontendConfig}`);

    // ============ Summary ============
    console.log("\n" + "=".repeat(50));
    console.log("📋 DEPLOYMENT SUMMARY");
    console.log("=".repeat(50));
    console.log(`Network:           ${network}`);
    console.log(`Chain ID:          ${deploymentInfo.chainId}`);
    console.log(`ReliefStablecoin:  ${stablecoinAddress}`);
    console.log(`ReliefFundManager: ${fundManagerAddress}`);
    console.log(`Deployer (Admin):  ${deployer.address}`);
    console.log("=".repeat(50));
    
    if (network === "sepolia") {
        console.log("\n🔍 Verify on Etherscan:");
        console.log(`   npx hardhat verify --network sepolia ${stablecoinAddress}`);
        console.log(`   npx hardhat verify --network sepolia ${fundManagerAddress}`);
    }
    
    console.log("\n✨ Deployment complete! Ready for demo.\n");
}

main()
    .then(() => process.exit(0))
    .catch((error) => {
        console.error("❌ Deployment failed:", error);
        process.exit(1);
    });
