/**
 * Disaster Relief Stablecoin System
 * Frontend Application - Original Version (All Views Together)
 * IIT EBIS 2.0 Hackathon
 */

// ============================================
// CONFIGURATION
// ============================================

let provider;
let signer;
let stablecoin;
let fundManager;
let currentAccount;

// ============================================
// INITIALIZATION
// ============================================

document.addEventListener('DOMContentLoaded', () => {
    initializeApp();
    setupEventListeners();
});

async function initializeApp() {
    // Check if MetaMask is installed
    if (typeof window.ethereum === 'undefined') {
        showToast('Please install MetaMask to use this application', 'error');
        return;
    }
    
    // Update contract addresses display
    document.getElementById('contract-stablecoin').textContent = CONFIG.RELIEF_STABLECOIN;
    document.getElementById('contract-manager').textContent = CONFIG.RELIEF_FUND_MANAGER;
}

function setupEventListeners() {
    // Wallet Connection
    document.getElementById('connect-wallet').addEventListener('click', connectWallet);
    
    // Tab Navigation
    document.querySelectorAll('.tab').forEach(tab => {
        tab.addEventListener('click', () => switchTab(tab.dataset.tab));
    });
    
    // Admin Actions
    document.getElementById('mint-btn').addEventListener('click', mintTokens);
    document.getElementById('add-beneficiary-btn').addEventListener('click', addBeneficiary);
    document.getElementById('add-merchant-btn').addEventListener('click', addMerchant);
    document.getElementById('pause-btn').addEventListener('click', pauseSystem);
    document.getElementById('unpause-btn').addEventListener('click', unpauseSystem);
    
    // Beneficiary Actions
    document.getElementById('transfer-btn').addEventListener('click', makeTransfer);
    
    // Transparency Actions
    document.getElementById('refresh-history').addEventListener('click', loadTransactionHistory);
}

// ============================================
// WALLET CONNECTION
// ============================================

async function connectWallet() {
    try {
        // Request account access
        const accounts = await window.ethereum.request({ method: 'eth_requestAccounts' });
        currentAccount = accounts[0];
        
        // Setup provider and signer
        provider = new ethers.BrowserProvider(window.ethereum);
        signer = await provider.getSigner();
        
        // Initialize contracts
        stablecoin = new ethers.Contract(CONFIG.RELIEF_STABLECOIN, STABLECOIN_ABI, signer);
        fundManager = new ethers.Contract(CONFIG.RELIEF_FUND_MANAGER, FUND_MANAGER_ABI, signer);
        
        // Update UI
        updateWalletUI();
        loadDashboardData();
        
        // Listen for account changes
        window.ethereum.on('accountsChanged', handleAccountChange);
        window.ethereum.on('chainChanged', () => window.location.reload());
        
        showToast('Wallet connected successfully!', 'success');
        
    } catch (error) {
        console.error('Connection error:', error);
        showToast('Failed to connect wallet', 'error');
    }
}

function handleAccountChange(accounts) {
    if (accounts.length === 0) {
        // User disconnected
        location.reload();
    } else {
        currentAccount = accounts[0];
        updateWalletUI();
        loadDashboardData();
    }
}

function updateWalletUI() {
    const connectBtn = document.getElementById('connect-wallet');
    const walletInfo = document.getElementById('wallet-info');
    const networkBadge = document.getElementById('network-badge');
    
    connectBtn.classList.add('hidden');
    walletInfo.classList.remove('hidden');
    networkBadge.classList.add('connected');
    
    document.getElementById('wallet-address').textContent = shortenAddress(currentAccount);
    document.getElementById('network-name').textContent = 'Localhost';
    document.getElementById('user-address-display').textContent = shortenAddress(currentAccount);
    
    // Update balance
    updateBalance();
}

async function updateBalance() {
    if (!stablecoin || !currentAccount) return;
    
    try {
        const balance = await stablecoin.balanceOf(currentAccount);
        const formatted = ethers.formatEther(balance);
        document.getElementById('wallet-balance').textContent = `${parseFloat(formatted).toFixed(2)} RUSD`;
        document.getElementById('user-balance').textContent = parseFloat(formatted).toFixed(2);
    } catch (error) {
        console.error('Error fetching balance:', error);
    }
}

// ============================================
// TAB NAVIGATION
// ============================================

function switchTab(tabName) {
    // Update tab buttons
    document.querySelectorAll('.tab').forEach(tab => {
        tab.classList.toggle('active', tab.dataset.tab === tabName);
    });
    
    // Update panels
    document.querySelectorAll('.panel').forEach(panel => {
        panel.classList.remove('active');
    });
    document.getElementById(`${tabName}-panel`).classList.add('active');
    
    // Load tab-specific data
    if (tabName === 'transparency') {
        loadTransparencyData();
    } else if (tabName === 'beneficiary') {
        loadBeneficiaryData();
    }
}

// ============================================
// DASHBOARD DATA
// ============================================

async function loadDashboardData() {
    if (!fundManager || !stablecoin) return;
    
    try {
        // Load stats
        const [beneficiaryCount, merchantCount, totalSupply, txCount] = await Promise.all([
            fundManager.totalBeneficiaries(),
            fundManager.totalMerchants(),
            stablecoin.totalSupply(),
            fundManager.totalTransactions()
        ]);
        
        document.getElementById('stat-beneficiaries').textContent = beneficiaryCount.toString();
        document.getElementById('stat-merchants').textContent = merchantCount.toString();
        document.getElementById('stat-total-supply').textContent = `${ethers.formatEther(totalSupply)} RUSD`;
        document.getElementById('stat-transactions').textContent = txCount.toString();
        
        // Load system status
        const paused = await stablecoin.paused();
        updateSystemStatus(paused);
        
        // Load lists
        loadBeneficiariesList();
        loadMerchantsList();
        
    } catch (error) {
        console.error('Error loading dashboard data:', error);
    }
}

function updateSystemStatus(paused) {
    const statusBadge = document.getElementById('system-status');
    if (paused) {
        statusBadge.textContent = 'Paused';
        statusBadge.classList.remove('active');
        statusBadge.classList.add('paused');
    } else {
        statusBadge.textContent = 'Active';
        statusBadge.classList.remove('paused');
        statusBadge.classList.add('active');
    }
}

async function loadBeneficiariesList() {
    const container = document.getElementById('beneficiaries-list');
    
    try {
        const addresses = await fundManager.getAllBeneficiaries();
        
        if (addresses.length === 0) {
            container.innerHTML = '<p class="empty-message">No beneficiaries registered</p>';
            return;
        }
        
        let html = '';
        for (const addr of addresses) {
            const info = await fundManager.getBeneficiaryDetails(addr);
            if (info.isActive) {
                html += `
                    <div class="data-item">
                        <span class="address">${shortenAddress(addr)}</span>
                        <span class="text-muted">${ethers.formatEther(info.totalReceived)} RUSD received</span>
                    </div>
                `;
            }
        }
        
        container.innerHTML = html || '<p class="empty-message">No active beneficiaries</p>';
        
    } catch (error) {
        console.error('Error loading beneficiaries:', error);
    }
}

async function loadMerchantsList() {
    const container = document.getElementById('merchants-list');
    const transferSelect = document.getElementById('transfer-merchant');
    
    try {
        const addresses = await fundManager.getAllMerchants();
        
        if (addresses.length === 0) {
            container.innerHTML = '<p class="empty-message">No merchants registered</p>';
            return;
        }
        
        let html = '';
        let options = '<option value="">-- Select Approved Merchant --</option>';
        const categoryNames = ['food', 'medical', 'shelter', 'education', 'utilities'];
        const categoryEmojis = ['🍎', '💊', '🏠', '📚', '⚡'];
        
        for (const addr of addresses) {
            const info = await fundManager.getMerchantDetails(addr);
            if (info.isActive) {
                const catIndex = Number(info.category);
                const catName = categoryNames[catIndex];
                const catEmoji = categoryEmojis[catIndex];
                
                html += `
                    <div class="data-item">
                        <div>
                            <strong>${info.name}</strong>
                            <span class="address">${shortenAddress(addr)}</span>
                        </div>
                        <span class="category-tag ${catName}">${catEmoji} ${catName.toUpperCase()}</span>
                    </div>
                `;
                
                options += `<option value="${addr}">${info.name} (${catName.toUpperCase()})</option>`;
            }
        }
        
        container.innerHTML = html || '<p class="empty-message">No active merchants</p>';
        transferSelect.innerHTML = options;
        
    } catch (error) {
        console.error('Error loading merchants:', error);
    }
}

// ============================================
// ADMIN ACTIONS
// ============================================

async function mintTokens() {
    const address = document.getElementById('mint-address').value.trim();
    const amount = document.getElementById('mint-amount').value;
    
    if (!ethers.isAddress(address)) {
        showToast('Please enter a valid address', 'error');
        return;
    }
    
    if (!amount || parseFloat(amount) <= 0) {
        showToast('Please enter a valid amount', 'error');
        return;
    }
    
    try {
        showToast('Processing...', 'warning');
        const tx = await stablecoin.mint(address, ethers.parseEther(amount));
        await tx.wait();
        
        showToast(`Successfully minted ${amount} RUSD!`, 'success');
        document.getElementById('mint-address').value = '';
        document.getElementById('mint-amount').value = '';
        loadDashboardData();
        updateBalance();
        
    } catch (error) {
        console.error('Mint error:', error);
        showToast('Minting failed: ' + (error.reason || error.message), 'error');
    }
}

async function addBeneficiary() {
    const address = document.getElementById('beneficiary-address').value.trim();
    
    if (!ethers.isAddress(address)) {
        showToast('Please enter a valid address', 'error');
        return;
    }
    
    try {
        showToast('Processing...', 'warning');
        const tx = await fundManager.addBeneficiary(address);
        await tx.wait();
        
        showToast('Beneficiary added successfully!', 'success');
        document.getElementById('beneficiary-address').value = '';
        loadDashboardData();
        
    } catch (error) {
        console.error('Add beneficiary error:', error);
        showToast('Failed: ' + (error.reason || error.message), 'error');
    }
}

async function addMerchant() {
    const address = document.getElementById('merchant-address').value.trim();
    const name = document.getElementById('merchant-name').value.trim();
    const category = parseInt(document.getElementById('merchant-category').value);
    
    if (!ethers.isAddress(address)) {
        showToast('Please enter a valid address', 'error');
        return;
    }
    
    if (!name) {
        showToast('Please enter a merchant name', 'error');
        return;
    }
    
    try {
        showToast('Processing...', 'warning');
        const tx = await fundManager.addMerchant(address, category, name);
        await tx.wait();
        
        showToast('Merchant added successfully!', 'success');
        document.getElementById('merchant-address').value = '';
        document.getElementById('merchant-name').value = '';
        loadDashboardData();
        
    } catch (error) {
        console.error('Add merchant error:', error);
        showToast('Failed: ' + (error.reason || error.message), 'error');
    }
}

async function pauseSystem() {
    try {
        showToast('Processing...', 'warning');
        const tx = await stablecoin.pause();
        await tx.wait();
        
        showToast('System paused!', 'success');
        updateSystemStatus(true);
        
    } catch (error) {
        console.error('Pause error:', error);
        showToast('Failed: ' + (error.reason || error.message), 'error');
    }
}

async function unpauseSystem() {
    try {
        showToast('Processing...', 'warning');
        const tx = await stablecoin.unpause();
        await tx.wait();
        
        showToast('System resumed!', 'success');
        updateSystemStatus(false);
        
    } catch (error) {
        console.error('Unpause error:', error);
        showToast('Failed: ' + (error.reason || error.message), 'error');
    }
}

// ============================================
// BENEFICIARY ACTIONS
// ============================================

async function loadBeneficiaryData() {
    await updateBalance();
    await loadUserTransactions();
}

async function loadUserTransactions() {
    const container = document.getElementById('user-transactions');
    
    try {
        const txCount = await fundManager.totalTransactions();
        if (txCount === 0n) {
            container.innerHTML = '<p class="empty-message">No transactions yet</p>';
            return;
        }
        
        let html = '';
        const count = Math.min(Number(txCount), 10);
        
        for (let i = Number(txCount) - 1; i >= Number(txCount) - count; i--) {
            const tx = await fundManager.getTransaction(i);
            
            // Only show user's transactions
            if (tx.from.toLowerCase() === currentAccount.toLowerCase() || 
                tx.to.toLowerCase() === currentAccount.toLowerCase()) {
                
                const isOutgoing = tx.from.toLowerCase() === currentAccount.toLowerCase();
                const time = new Date(Number(tx.timestamp) * 1000).toLocaleString();
                
                html += `
                    <div class="transaction-item">
                        <div class="tx-info">
                            <div class="tx-addresses">
                                ${isOutgoing ? 'To: ' : 'From: '}${shortenAddress(isOutgoing ? tx.to : tx.from)}
                            </div>
                            <div class="tx-time">${time}</div>
                        </div>
                        <div class="tx-amount">
                            <div class="tx-value ${isOutgoing ? 'negative' : 'positive'}">
                                ${isOutgoing ? '-' : '+'}${ethers.formatEther(tx.amount)} RUSD
                            </div>
                        </div>
                    </div>
                `;
            }
        }
        
        container.innerHTML = html || '<p class="empty-message">No transactions found</p>';
        
    } catch (error) {
        console.error('Error loading user transactions:', error);
    }
}

async function makeTransfer() {
    const merchantAddress = document.getElementById('transfer-merchant').value;
    const amount = document.getElementById('transfer-amount').value;
    
    if (!merchantAddress) {
        showToast('Please select a merchant', 'error');
        return;
    }
    
    if (!amount || parseFloat(amount) <= 0) {
        showToast('Please enter a valid amount', 'error');
        return;
    }
    
    try {
        showToast('Processing payment...', 'warning');
        const tx = await stablecoin.transfer(merchantAddress, ethers.parseEther(amount));
        await tx.wait();
        
        showToast(`Payment of ${amount} RUSD successful!`, 'success');
        document.getElementById('transfer-amount').value = '';
        updateBalance();
        loadUserTransactions();
        loadDashboardData();
        
    } catch (error) {
        console.error('Transfer error:', error);
        showToast('Payment failed: ' + (error.reason || error.message), 'error');
    }
}

// ============================================
// TRANSPARENCY DATA
// ============================================

async function loadTransparencyData() {
    if (!fundManager || !stablecoin) return;
    
    try {
        // Load overall stats
        const [totalSupply, txCount, beneficiaryCount] = await Promise.all([
            stablecoin.totalSupply(),
            fundManager.totalTransactions(),
            fundManager.totalBeneficiaries()
        ]);
        
        document.getElementById('total-distributed').textContent = `${ethers.formatEther(totalSupply)} RUSD`;
        document.getElementById('total-tx-count').textContent = txCount.toString();
        document.getElementById('total-beneficiaries').textContent = beneficiaryCount.toString();
        
        // Load transaction history
        await loadTransactionHistory();
        
        // Calculate category breakdown
        await calculateCategoryBreakdown();
        
    } catch (error) {
        console.error('Error loading transparency data:', error);
    }
}

async function loadTransactionHistory() {
    const tbody = document.getElementById('transaction-history-table');
    
    try {
        const txCount = await fundManager.totalTransactions();
        
        if (txCount === 0n) {
            tbody.innerHTML = '<tr><td colspan="6" class="empty-message">No transactions recorded</td></tr>';
            return;
        }
        
        let html = '';
        const count = Math.min(Number(txCount), 20);
        const categoryNames = ['FOOD', 'MEDICAL', 'SHELTER', 'EDUCATION', 'UTILITIES'];
        
        for (let i = Number(txCount) - 1; i >= Number(txCount) - count; i--) {
            const tx = await fundManager.getTransaction(i);
            const time = new Date(Number(tx.timestamp) * 1000).toLocaleString();
            
            html += `
                <tr>
                    <td>${i + 1}</td>
                    <td>${shortenAddress(tx.from)}</td>
                    <td>${shortenAddress(tx.to)}</td>
                    <td>${ethers.formatEther(tx.amount)} RUSD</td>
                    <td><span class="category-tag ${categoryNames[Number(tx.category)].toLowerCase()}">${categoryNames[Number(tx.category)]}</span></td>
                    <td>${time}</td>
                </tr>
            `;
        }
        
        tbody.innerHTML = html;
        
    } catch (error) {
        console.error('Error loading transaction history:', error);
    }
}

async function calculateCategoryBreakdown() {
    try {
        const txCount = await fundManager.totalTransactions();
        if (txCount === 0n) return;
        
        const categoryTotals = [0, 0, 0, 0, 0];
        let grandTotal = 0;
        
        for (let i = 0; i < Number(txCount); i++) {
            const tx = await fundManager.getTransaction(i);
            const amount = parseFloat(ethers.formatEther(tx.amount));
            categoryTotals[Number(tx.category)] += amount;
            grandTotal += amount;
        }
        
        const categoryNames = ['food', 'medical', 'shelter', 'education', 'utilities'];
        
        for (let i = 0; i < 5; i++) {
            const percentage = grandTotal > 0 ? (categoryTotals[i] / grandTotal) * 100 : 0;
            document.getElementById(`progress-${categoryNames[i]}`).style.width = `${percentage}%`;
            document.getElementById(`category-${categoryNames[i]}`).textContent = `${categoryTotals[i].toFixed(2)} RUSD`;
        }
        
    } catch (error) {
        console.error('Error calculating category breakdown:', error);
    }
}

// ============================================
// UTILITY FUNCTIONS
// ============================================

function shortenAddress(address) {
    return `${address.substring(0, 6)}...${address.substring(38)}`;
}

function showToast(message, type = 'info') {
    const toast = document.getElementById('toast');
    const toastMessage = document.getElementById('toast-message');
    
    toast.className = `toast ${type}`;
    toastMessage.textContent = message;
    toast.classList.remove('hidden');
    
    setTimeout(() => {
        toast.classList.add('hidden');
    }, 3000);
}
