const { expect } = require("chai");
const { ethers } = require("hardhat");

/**
 * Comprehensive Test Suite for Disaster Relief Stablecoin System
 * 
 * Tests all core functionality:
 * 1. Token minting and burning
 * 2. Beneficiary management
 * 3. Merchant management
 * 4. Category-based spending controls
 * 5. Transfer restrictions
 * 6. Audit trail
 */
describe("Disaster Relief Stablecoin System", function () {
    let stablecoin;
    let fundManager;
    let admin;
    let beneficiary1;
    let beneficiary2;
    let merchantFood;
    let merchantMedical;
    let randomUser;

    // Spending categories
    const CATEGORY = {
        FOOD: 0,
        MEDICAL: 1,
        SHELTER: 2,
        EDUCATION: 3,
        UTILITIES: 4
    };

    beforeEach(async function () {
        // Get signers
        [admin, beneficiary1, beneficiary2, merchantFood, merchantMedical, randomUser] = await ethers.getSigners();

        // Deploy ReliefStablecoin
        const ReliefStablecoin = await ethers.getContractFactory("ReliefStablecoin");
        stablecoin = await ReliefStablecoin.deploy();
        await stablecoin.waitForDeployment();

        // Deploy ReliefFundManager
        const ReliefFundManager = await ethers.getContractFactory("ReliefFundManager");
        fundManager = await ReliefFundManager.deploy();
        await fundManager.waitForDeployment();

        // Link contracts BIDIRECTIONALLY - CRITICAL for proper operation
        await stablecoin.setFundManager(await fundManager.getAddress());
        await fundManager.setStablecoin(await stablecoin.getAddress());
    });

    describe("ReliefStablecoin - Basic Functionality", function () {
        it("Should have correct name and symbol", async function () {
            expect(await stablecoin.name()).to.equal("ReliefUSD");
            expect(await stablecoin.symbol()).to.equal("RUSD");
            expect(await stablecoin.decimals()).to.equal(18);
        });

        it("Should set admin as owner", async function () {
            expect(await stablecoin.owner()).to.equal(admin.address);
        });

        it("Should mint tokens to beneficiary", async function () {
            const amount = ethers.parseEther("1000");
            await stablecoin.mint(beneficiary1.address, amount);
            expect(await stablecoin.balanceOf(beneficiary1.address)).to.equal(amount);
        });

        it("Should emit TokensMinted event", async function () {
            const amount = ethers.parseEther("1000");
            await expect(stablecoin.mint(beneficiary1.address, amount))
                .to.emit(stablecoin, "TokensMinted");
        });

        it("Should burn tokens from address", async function () {
            const amount = ethers.parseEther("1000");
            await stablecoin.mint(beneficiary1.address, amount);
            await stablecoin.burn(beneficiary1.address, ethers.parseEther("500"));
            expect(await stablecoin.balanceOf(beneficiary1.address)).to.equal(ethers.parseEther("500"));
        });

        it("Should revert mint from non-admin", async function () {
            const amount = ethers.parseEther("1000");
            await expect(
                stablecoin.connect(beneficiary1).mint(beneficiary1.address, amount)
            ).to.be.revertedWithCustomError(stablecoin, "OwnableUnauthorizedAccount");
        });

        it("Should revert mint to zero address", async function () {
            await expect(
                stablecoin.mint(ethers.ZeroAddress, ethers.parseEther("100"))
            ).to.be.revertedWithCustomError(stablecoin, "ZeroAddress");
        });

        it("Should revert mint with zero amount", async function () {
            await expect(
                stablecoin.mint(beneficiary1.address, 0)
            ).to.be.revertedWithCustomError(stablecoin, "ZeroAmount");
        });
    });

    describe("ReliefStablecoin - Pause Functionality", function () {
        it("Should pause and unpause", async function () {
            await stablecoin.pause();
            expect(await stablecoin.paused()).to.equal(true);
            
            await stablecoin.unpause();
            expect(await stablecoin.paused()).to.equal(false);
        });

        it("Should block minting when paused", async function () {
            await stablecoin.pause();
            await expect(
                stablecoin.mint(beneficiary1.address, ethers.parseEther("100"))
            ).to.be.revertedWithCustomError(stablecoin, "EnforcedPause");
        });

        it("Should block transfers when paused", async function () {
            await stablecoin.mint(beneficiary1.address, ethers.parseEther("100"));
            await fundManager.addBeneficiary(beneficiary1.address);
            await fundManager.addMerchant(merchantFood.address, CATEGORY.FOOD, "Food Store");
            
            await stablecoin.pause();
            
            await expect(
                stablecoin.connect(beneficiary1).transfer(merchantFood.address, ethers.parseEther("50"))
            ).to.be.revertedWithCustomError(stablecoin, "EnforcedPause");
        });
    });

    describe("ReliefFundManager - Beneficiary Management", function () {
        it("Should add beneficiary", async function () {
            await fundManager.addBeneficiary(beneficiary1.address);
            expect(await fundManager.isBeneficiary(beneficiary1.address)).to.equal(true);
        });

        it("Should emit BeneficiaryAdded event", async function () {
            await expect(fundManager.addBeneficiary(beneficiary1.address))
                .to.emit(fundManager, "BeneficiaryAdded");
        });

        it("Should track total beneficiaries", async function () {
            await fundManager.addBeneficiary(beneficiary1.address);
            await fundManager.addBeneficiary(beneficiary2.address);
            expect(await fundManager.totalBeneficiaries()).to.equal(2);
        });

        it("Should remove beneficiary", async function () {
            await fundManager.addBeneficiary(beneficiary1.address);
            await fundManager.removeBeneficiary(beneficiary1.address);
            expect(await fundManager.isBeneficiary(beneficiary1.address)).to.equal(false);
        });

        it("Should revert adding duplicate beneficiary", async function () {
            await fundManager.addBeneficiary(beneficiary1.address);
            await expect(
                fundManager.addBeneficiary(beneficiary1.address)
            ).to.be.revertedWithCustomError(fundManager, "BeneficiaryAlreadyExists");
        });

        it("Should revert removing non-existent beneficiary", async function () {
            await expect(
                fundManager.removeBeneficiary(beneficiary1.address)
            ).to.be.revertedWithCustomError(fundManager, "BeneficiaryNotFound");
        });
    });

    describe("ReliefFundManager - Merchant Management", function () {
        it("Should add merchant with category", async function () {
            await fundManager.addMerchant(merchantFood.address, CATEGORY.FOOD, "City Grocery");
            expect(await fundManager.isMerchant(merchantFood.address)).to.equal(true);
            
            const details = await fundManager.getMerchantDetails(merchantFood.address);
            expect(details.isActive).to.equal(true);
            expect(details.category).to.equal(CATEGORY.FOOD);
            expect(details.name).to.equal("City Grocery");
        });

        it("Should emit MerchantAdded event", async function () {
            await expect(fundManager.addMerchant(merchantFood.address, CATEGORY.FOOD, "City Grocery"))
                .to.emit(fundManager, "MerchantAdded");
        });

        it("Should add merchants with different categories", async function () {
            await fundManager.addMerchant(merchantFood.address, CATEGORY.FOOD, "Grocery Store");
            await fundManager.addMerchant(merchantMedical.address, CATEGORY.MEDICAL, "Pharmacy");
            
            const foodDetails = await fundManager.getMerchantDetails(merchantFood.address);
            const medicalDetails = await fundManager.getMerchantDetails(merchantMedical.address);
            
            expect(foodDetails.category).to.equal(CATEGORY.FOOD);
            expect(medicalDetails.category).to.equal(CATEGORY.MEDICAL);
        });

        it("Should remove merchant", async function () {
            await fundManager.addMerchant(merchantFood.address, CATEGORY.FOOD, "Grocery Store");
            await fundManager.removeMerchant(merchantFood.address);
            expect(await fundManager.isMerchant(merchantFood.address)).to.equal(false);
        });

        it("Should get all merchants", async function () {
            await fundManager.addMerchant(merchantFood.address, CATEGORY.FOOD, "Grocery");
            await fundManager.addMerchant(merchantMedical.address, CATEGORY.MEDICAL, "Pharmacy");
            
            const allMerchants = await fundManager.getAllMerchants();
            expect(allMerchants.length).to.equal(2);
            expect(allMerchants).to.include(merchantFood.address);
            expect(allMerchants).to.include(merchantMedical.address);
        });
    });

    describe("Transfer Restrictions - Core Feature", function () {
        beforeEach(async function () {
            // Setup: Add beneficiary and merchants
            await fundManager.addBeneficiary(beneficiary1.address);
            await fundManager.addMerchant(merchantFood.address, CATEGORY.FOOD, "Grocery Store");
            await fundManager.addMerchant(merchantMedical.address, CATEGORY.MEDICAL, "Pharmacy");
            
            // Mint tokens to beneficiary
            await stablecoin.mint(beneficiary1.address, ethers.parseEther("1000"));
        });

        it("✅ Beneficiary → Active Merchant: ALLOWED", async function () {
            const amount = ethers.parseEther("100");
            
            await expect(
                stablecoin.connect(beneficiary1).transfer(merchantFood.address, amount)
            ).to.not.be.reverted;
            
            expect(await stablecoin.balanceOf(merchantFood.address)).to.equal(amount);
        });

        it("❌ Beneficiary → Random Wallet: BLOCKED", async function () {
            const amount = ethers.parseEther("100");
            
            await expect(
                stablecoin.connect(beneficiary1).transfer(randomUser.address, amount)
            ).to.be.revertedWithCustomError(stablecoin, "UnauthorizedTransfer");
        });

        it("❌ Beneficiary → Another Beneficiary: BLOCKED", async function () {
            await fundManager.addBeneficiary(beneficiary2.address);
            const amount = ethers.parseEther("100");
            
            // Beneficiary to beneficiary should be blocked (not a merchant)
            await expect(
                stablecoin.connect(beneficiary1).transfer(beneficiary2.address, amount)
            ).to.be.revertedWithCustomError(stablecoin, "UnauthorizedTransfer");
        });

        it("❌ Beneficiary → Inactive Merchant: BLOCKED", async function () {
            // Remove merchant
            await fundManager.removeMerchant(merchantFood.address);
            
            const amount = ethers.parseEther("100");
            await expect(
                stablecoin.connect(beneficiary1).transfer(merchantFood.address, amount)
            ).to.be.revertedWithCustomError(stablecoin, "UnauthorizedTransfer");
        });

        it("✅ Admin → Anyone: ALLOWED", async function () {
            // Admin can transfer freely (for distribution)
            await stablecoin.mint(admin.address, ethers.parseEther("1000"));
            
            await expect(
                stablecoin.connect(admin).transfer(randomUser.address, ethers.parseEther("100"))
            ).to.not.be.reverted;
        });

        it("✅ Non-beneficiary → Anyone: ALLOWED", async function () {
            // Random user who receives tokens (not a beneficiary) can transfer
            await stablecoin.mint(randomUser.address, ethers.parseEther("100"));
            
            // Since randomUser is not a beneficiary, transfer is allowed
            await expect(
                stablecoin.connect(randomUser).transfer(beneficiary1.address, ethers.parseEther("50"))
            ).to.not.be.reverted;
        });
    });

    describe("Transaction Recording & Audit Trail", function () {
        beforeEach(async function () {
            await fundManager.addBeneficiary(beneficiary1.address);
            await fundManager.addMerchant(merchantFood.address, CATEGORY.FOOD, "Grocery Store");
            await stablecoin.mint(beneficiary1.address, ethers.parseEther("1000"));
        });

        it("Should record distribution", async function () {
            await fundManager.recordDistribution(beneficiary1.address, ethers.parseEther("1000"));
            
            const details = await fundManager.getBeneficiaryDetails(beneficiary1.address);
            expect(details.totalReceived).to.equal(ethers.parseEther("1000"));
        });

        it("Should emit FundsDistributed event", async function () {
            await expect(fundManager.recordDistribution(beneficiary1.address, ethers.parseEther("1000")))
                .to.emit(fundManager, "FundsDistributed");
        });

        it("Should track transaction count", async function () {
            // Initial count should be 0
            expect(await fundManager.getTransactionCount()).to.equal(0);
            
            // Setup: Add beneficiary and merchant first (check if already exists)
            if (!(await fundManager.isBeneficiary(beneficiary1.address))) {
                await fundManager.addBeneficiary(beneficiary1.address);
            }
            if (!(await fundManager.isMerchant(merchantFood.address))) {
                await fundManager.addMerchant(merchantFood.address, CATEGORY.FOOD, "Test Food Store");
            }
            
            // Mint tokens to beneficiary
            await stablecoin.mint(beneficiary1.address, ethers.parseEther("1000"));
            
            // Execute a transfer (this will automatically call recordTransfer via the contract)
            await stablecoin.connect(beneficiary1).transfer(merchantFood.address, ethers.parseEther("100"));
            
            expect(await fundManager.getTransactionCount()).to.equal(1);
        });

        it("Should store transaction details", async function () {
            // Setup: Add beneficiary and merchant first (check if already exists)
            if (!(await fundManager.isBeneficiary(beneficiary1.address))) {
                await fundManager.addBeneficiary(beneficiary1.address);
            }
            if (!(await fundManager.isMerchant(merchantFood.address))) {
                await fundManager.addMerchant(merchantFood.address, CATEGORY.FOOD, "Test Food Store");
            }
            
            // Mint tokens to beneficiary
            await stablecoin.mint(beneficiary1.address, ethers.parseEther("1000"));
            
            // Execute a transfer
            const amount = ethers.parseEther("100");
            await stablecoin.connect(beneficiary1).transfer(merchantFood.address, amount);
            
            const tx = await fundManager.getTransaction(0);
            expect(tx.from).to.equal(beneficiary1.address);
            expect(tx.to).to.equal(merchantFood.address);
            expect(tx.amount).to.equal(amount);
            expect(tx.category).to.equal(CATEGORY.FOOD);
            expect(tx.success).to.equal(true);
        });

        it("Should get recent transactions", async function () {
            // Setup: Add beneficiary and merchant first (check if already exists)
            if (!(await fundManager.isBeneficiary(beneficiary1.address))) {
                await fundManager.addBeneficiary(beneficiary1.address);
            }
            if (!(await fundManager.isMerchant(merchantFood.address))) {
                await fundManager.addMerchant(merchantFood.address, CATEGORY.FOOD, "Test Food Store");
            }
            
            // Mint tokens to beneficiary
            await stablecoin.mint(beneficiary1.address, ethers.parseEther("1000"));
            
            // Record multiple transactions through actual transfers
            await stablecoin.connect(beneficiary1).transfer(merchantFood.address, ethers.parseEther("100"));
            await stablecoin.connect(beneficiary1).transfer(merchantFood.address, ethers.parseEther("200"));
            await stablecoin.connect(beneficiary1).transfer(merchantFood.address, ethers.parseEther("300"));
            
            const recent = await fundManager.getRecentTransactions(2);
            expect(recent.length).to.equal(2);
            expect(recent[1].amount).to.equal(ethers.parseEther("300"));
        });
    });

    describe("Category Names", function () {
        it("Should return correct category names", async function () {
            expect(await fundManager.getCategoryName(CATEGORY.FOOD)).to.equal("FOOD");
            expect(await fundManager.getCategoryName(CATEGORY.MEDICAL)).to.equal("MEDICAL");
            expect(await fundManager.getCategoryName(CATEGORY.SHELTER)).to.equal("SHELTER");
            expect(await fundManager.getCategoryName(CATEGORY.EDUCATION)).to.equal("EDUCATION");
            expect(await fundManager.getCategoryName(CATEGORY.UTILITIES)).to.equal("UTILITIES");
        });
    });

    describe("Full Demo Flow", function () {
        it("Should complete full demo scenario", async function () {
            console.log("\n    📋 DEMO FLOW TEST");
            console.log("    ==================");

            // Step 1: Admin whitelists beneficiary
            console.log("    1️⃣  Admin whitelists beneficiary");
            await fundManager.addBeneficiary(beneficiary1.address);
            expect(await fundManager.isBeneficiary(beneficiary1.address)).to.equal(true);

            // Step 2: Admin whitelists merchants
            console.log("    2️⃣  Admin whitelists FOOD merchant");
            await fundManager.addMerchant(merchantFood.address, CATEGORY.FOOD, "City Grocery");
            
            console.log("    3️⃣  Admin whitelists MEDICAL merchant");
            await fundManager.addMerchant(merchantMedical.address, CATEGORY.MEDICAL, "Community Pharmacy");

            // Step 3: Admin mints tokens
            console.log("    4️⃣  Admin mints 1000 RUSD to beneficiary");
            const mintAmount = ethers.parseEther("1000");
            await stablecoin.mint(beneficiary1.address, mintAmount);
            expect(await stablecoin.balanceOf(beneficiary1.address)).to.equal(mintAmount);

            // Step 4: Valid purchase
            console.log("    5️⃣  Beneficiary makes valid FOOD purchase → SUCCESS ✅");
            const purchaseAmount = ethers.parseEther("150");
            await stablecoin.connect(beneficiary1).transfer(merchantFood.address, purchaseAmount);
            expect(await stablecoin.balanceOf(merchantFood.address)).to.equal(purchaseAmount);

            // Step 5: Invalid transfer attempt
            console.log("    6️⃣  Beneficiary attempts transfer to random wallet → BLOCKED ❌");
            await expect(
                stablecoin.connect(beneficiary1).transfer(randomUser.address, ethers.parseEther("100"))
            ).to.be.revertedWithCustomError(stablecoin, "UnauthorizedTransfer");

            // Step 6: Check balances
            console.log("    7️⃣  Verify final balances");
            const finalBalance = await stablecoin.balanceOf(beneficiary1.address);
            expect(finalBalance).to.equal(ethers.parseEther("850")); // 1000 - 150

            console.log("    ✨ Demo flow completed successfully!\n");
        });
    });

    // Helper function to get current block timestamp
    async function getBlockTimestamp() {
        const block = await ethers.provider.getBlock("latest");
        return block.timestamp;
    }
});
