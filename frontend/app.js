/**
 * ReliefUSD - Transparent Disaster Relief System
 * Frontend Application Logic
 */

// ============================================
// GLOBAL STATE
// ============================================

let provider = null;
let signer = null;
let stablecoin = null;
let fundManager = null;
let currentAccount = null;
let currentRole = null;
let isAdmin = false;
let isBeneficiary = false;
let merchants = [];
let selectedMerchant = null;
let isConnecting = false; // Flag to prevent multiple connection attempts

// ============================================
// INITIALIZATION
// ============================================

document.addEventListener('DOMContentLoaded', async () => {
    // Simulate loading
    await new Promise(resolve => setTimeout(resolve, 1500));
    
    // Setup event listeners first
    setupEventListeners();
    
    // Check if we should show view-only mode (Skip Login)
    const urlParams = new URLSearchParams(window.location.search);
    const viewOnly = urlParams.get('view') === 'public' || sessionStorage.getItem('viewOnlyMode') === 'true';
    
    if (viewOnly) {
        // Skip login, go directly to public view
        document.getElementById('loading-screen').classList.add('hidden');
        enterViewOnlyMode();
    } else {
        // Show login screen
        document.getElementById('loading-screen').classList.add('hidden');
        document.getElementById('login-screen').classList.remove('hidden');
    }
    
    // Clear any previous connection preferences on page load
    sessionStorage.removeItem('rememberWalletConnection');
    
    // Check if MetaMask is available
    if (typeof window.ethereum !== 'undefined') {
        console.log('MetaMask detected');
        
        // NEVER auto-connect - user must explicitly click "Connect MetaMask"
        // Only auto-connect if user explicitly enabled "Remember Me" AND localStorage has the flag
        const rememberPermanently = localStorage.getItem('rememberWalletConnection') === 'true';
        
        if (rememberPermanently) {
            const accounts = await window.ethereum.request({ method: 'eth_accounts' });
            if (accounts.length > 0) {
                await connectWallet();
            }
        }
        
        // Listen for account changes
        window.ethereum.on('accountsChanged', handleAccountsChanged);
        window.ethereum.on('chainChanged', () => window.location.reload());
    }
});

function setupEventListeners() {
    // Connect button
    document.getElementById('connect-btn').addEventListener('click', connectWallet);
    
    // View as Guest button (add if doesn't exist)
    const viewAsGuestBtn = document.getElementById('view-as-guest-btn');
    if (viewAsGuestBtn) {
        viewAsGuestBtn.addEventListener('click', enterViewOnlyMode);
    }
    
    // Role selection
    document.querySelectorAll('.role-card').forEach(card => {
        card.addEventListener('click', () => selectRole(card.dataset.role));
    });
    
    // Logout button
    document.getElementById('logout-btn').addEventListener('click', logout);
    
    // Navigation
    document.querySelectorAll('.nav-item').forEach(item => {
        item.addEventListener('click', (e) => {
            e.preventDefault();
            navigateTo(item.dataset.page);
        });
    });
    
    // Mobile menu toggle
    document.getElementById('menu-toggle').addEventListener('click', () => {
        document.getElementById('sidebar').classList.toggle('open');
    });
    
    // Close sidebar on page click (mobile)
    document.querySelector('.main-content').addEventListener('click', () => {
        document.getElementById('sidebar').classList.remove('open');
    });
}

// ============================================
// WALLET CONNECTION
// ============================================

async function connectWallet() {
    if (typeof window.ethereum === 'undefined') {
        showToast('Please install MetaMask to use this application', 'error');
        window.open('https://metamask.io/download/', '_blank');
        return;
    }
    
    // Prevent multiple simultaneous connection attempts
    if (isConnecting) {
        console.log('Connection already in progress...');
        return;
    }
    
    isConnecting = true;
    const connectBtn = document.getElementById('connect-btn');
    connectBtn.disabled = true;
    connectBtn.innerHTML = '<i class="fas fa-spinner fa-spin"></i> Connecting...';
    
    try {
        // Request account access
        const accounts = await window.ethereum.request({ method: 'eth_requestAccounts' });
        currentAccount = accounts[0];
        
        // Handle "Remember Me" checkbox
        const rememberCheckbox = document.getElementById('remember-connection');
        if (rememberCheckbox && rememberCheckbox.checked) {
            // Remember across browser sessions (localStorage persists)
            localStorage.setItem('rememberWalletConnection', 'true');
            sessionStorage.setItem('rememberWalletConnection', 'true');
        } else {
            // Only remember for this session (sessionStorage clears on close)
            localStorage.removeItem('rememberWalletConnection');
            sessionStorage.setItem('rememberWalletConnection', 'true');
        }
        
        // Setup provider and signer
        provider = new ethers.BrowserProvider(window.ethereum);
        signer = await provider.getSigner();
        
        // Initialize contracts
        stablecoin = new ethers.Contract(CONFIG.RELIEF_STABLECOIN, STABLECOIN_ABI, signer);
        fundManager = new ethers.Contract(CONFIG.RELIEF_FUND_MANAGER, FUND_MANAGER_ABI, signer);
        
        // Update UI
        updateWalletStatus(true);
        await checkUserRole();
        
        // Show role selection
        document.getElementById('role-selection').classList.remove('hidden');
        connectBtn.classList.add('hidden');
        
        isConnecting = false; // Reset flag on success
        
    } catch (error) {
        console.error('Connection error:', error);
        showToast('Failed to connect wallet: ' + error.message, 'error');
        connectBtn.disabled = false;
        connectBtn.innerHTML = '<i class="fab fa-ethereum"></i> Connect MetaMask';
        isConnecting = false; // Reset flag on error
    }
}

function handleAccountsChanged(accounts) {
    if (accounts.length === 0) {
        logout();
    } else if (accounts[0] !== currentAccount) {
        window.location.reload();
    }
}

function updateWalletStatus(connected) {
    const statusDiv = document.getElementById('wallet-status');
    const networkBadge = document.getElementById('network-badge');
    
    if (connected) {
        statusDiv.innerHTML = `
            <div class="status-icon connected">
                <i class="fas fa-check"></i>
            </div>
            <span>${shortenAddress(currentAccount)}</span>
        `;
        networkBadge.classList.add('connected');
        document.getElementById('network-name').textContent = 'Localhost:8545';
    } else {
        statusDiv.innerHTML = `
            <div class="status-icon disconnected">
                <i class="fas fa-wallet"></i>
            </div>
            <span>No wallet connected</span>
        `;
        networkBadge.classList.remove('connected');
        document.getElementById('network-name').textContent = 'Not Connected';
    }
}

async function checkUserRole() {
    try {
        console.log('🔍 Checking user role for:', currentAccount);
        console.log('📄 Stablecoin contract:', await stablecoin.getAddress());
        console.log('📄 FundManager contract:', await fundManager.getAddress());
        
        // Check if admin (contract owner)
        const owner = await stablecoin.owner();
        console.log('👑 Contract owner:', owner);
        console.log('👤 Current account:', currentAccount);
        
        isAdmin = owner.toLowerCase() === currentAccount.toLowerCase();
        console.log('✅ Is Admin?', isAdmin);
        
        // Check if beneficiary using the correct contract function name
        const beneficiaryDetails = await fundManager.getBeneficiaryDetails(currentAccount);
        console.log('📋 Beneficiary details:', beneficiaryDetails);
        isBeneficiary = beneficiaryDetails[0]; // isActive
        console.log('✅ Is Beneficiary?', isBeneficiary);
        
        // Update role card states
        const adminCard = document.getElementById('role-admin');
        const beneficiaryCard = document.getElementById('role-beneficiary');
        
        if (!isAdmin) {
            adminCard.classList.add('disabled');
            adminCard.querySelector('.role-badge').textContent = 'Not Admin';
        } else {
            adminCard.classList.remove('disabled');
            adminCard.querySelector('.role-badge').textContent = '✓ Admin Wallet';
        }
        
        if (!isBeneficiary) {
            beneficiaryCard.classList.add('disabled');
            beneficiaryCard.querySelector('.role-badge').textContent = 'Not Registered';
        } else {
            beneficiaryCard.classList.remove('disabled');
            beneficiaryCard.querySelector('.role-badge').textContent = '✓ Registered';
        }
        
    } catch (error) {
        console.error('❌ Error checking role:', error);
        showToast('Error checking user role: ' + error.message, 'error');
    }
}

// ============================================
// ROLE SELECTION & LOGIN
// ============================================

async function selectRole(role) {
    // Validate role selection
    if (role === 'admin' && !isAdmin) {
        showToast('You are not an admin. Please use the admin wallet.', 'warning');
        return;
    }
    
    if (role === 'beneficiary' && !isBeneficiary) {
        showToast('You are not a registered beneficiary.', 'warning');
        return;
    }
    
    currentRole = role;
    
    // Mark selected
    document.querySelectorAll('.role-card').forEach(card => card.classList.remove('selected'));
    document.querySelector(`[data-role="${role}"]`).classList.add('selected');
    
    // Transition to app
    setTimeout(async () => {
        document.getElementById('login-screen').classList.add('hidden');
        document.getElementById('app-screen').classList.remove('hidden');
        
        // Setup UI based on role
        setupRoleBasedUI();
        
        // Setup real-time sync for live updates
        await setupRealTimeSync();
        
        // Load initial data
        await refreshData();
        
        // Update review table
        await updateReviewTable();
    }, 300);
}

function setupRoleBasedUI() {
    // Update user info in sidebar
    document.getElementById('user-role-display').textContent = 
        currentRole === 'admin' ? 'Administrator' : 
        currentRole === 'beneficiary' ? 'Beneficiary' : 'Public Viewer';
    document.getElementById('user-address-display').textContent = shortenAddress(currentAccount);
    
    // Update avatar icon
    const avatarIcons = {
        admin: 'fas fa-user-shield',
        beneficiary: 'fas fa-user',
        public: 'fas fa-eye'
    };
    document.getElementById('user-avatar').innerHTML = `<i class="${avatarIcons[currentRole]}"></i>`;
    
    // Show/hide role-specific sections
    document.querySelectorAll('.admin-only').forEach(el => {
        el.style.display = currentRole === 'admin' ? '' : 'none';
    });
    
    document.querySelectorAll('.beneficiary-only').forEach(el => {
        el.style.display = currentRole === 'beneficiary' ? '' : 'none';
    });
    
    // Hide header balance for public view
    const headerBalance = document.querySelector('.header-balance');
    if (headerBalance) {
        headerBalance.style.display = currentRole === 'public' ? 'none' : '';
    }
    
    // For public view, only show dashboard, transactions, and audit
    if (currentRole === 'public') {
        // Hide all action buttons that shouldn't be visible
        document.querySelectorAll('.page-actions').forEach(el => {
            el.style.display = 'none';
        });
    }
}

function logout() {
    currentAccount = null;
    currentRole = null;
    isAdmin = false;
    isBeneficiary = false;
    
    // Clear both session and local storage to forget connection completely
    sessionStorage.removeItem('rememberWalletConnection');
    localStorage.removeItem('rememberWalletConnection');
    sessionStorage.removeItem('viewOnlyMode');
    
    document.getElementById('app-screen').classList.add('hidden');
    document.getElementById('login-screen').classList.remove('hidden');
    document.getElementById('role-selection').classList.add('hidden');
    document.getElementById('connect-btn').classList.remove('hidden');
    document.getElementById('connect-btn').disabled = false;
    document.getElementById('connect-btn').innerHTML = 'Connect MetaMask';
    
    // Reset Remember Me checkbox
    const rememberCheckbox = document.getElementById('remember-connection');
    if (rememberCheckbox) {
        rememberCheckbox.checked = false;
    }
    
    updateWalletStatus(false);
}

// ============================================
// VIEW-ONLY MODE (FOR PUBLIC VIEWERS)
// ============================================

async function enterViewOnlyMode() {
    sessionStorage.setItem('viewOnlyMode', 'true');
    currentRole = 'viewer';
    
    // Initialize read-only provider (no signer needed)
    try {
        provider = new ethers.JsonRpcProvider(CONFIG.EXPLORER.includes('localhost') 
            ? 'http://localhost:8545' 
            : 'https://ethereum-sepolia-rpc.publicnode.com');
        
        stablecoin = new ethers.Contract(CONFIG.RELIEF_STABLECOIN, STABLECOIN_ABI, provider);
        fundManager = new ethers.Contract(CONFIG.RELIEF_FUND_MANAGER, FUND_MANAGER_ABI, provider);
        
        // Hide login, show app
        document.getElementById('login-screen').classList.add('hidden');
        document.getElementById('app-screen').classList.remove('hidden');
        
        // Update UI for view-only mode
        document.getElementById('user-address').textContent = 'Public Viewer';
        document.getElementById('user-role').textContent = 'View Only';
        document.getElementById('wallet-icon').innerHTML = '👁️';
        
        // Add banner notification
        const banner = document.createElement('div');
        banner.className = 'view-only-banner';
        banner.innerHTML = `
            <div style="background: linear-gradient(135deg, #667eea 0%, #764ba2 100%); color: white; padding: 12px 20px; text-align: center; font-size: 14px; border-radius: 8px; margin: 10px; box-shadow: 0 2px 8px rgba(0,0,0,0.1);">
                👁️ <strong>Public View Mode</strong> - You're viewing public data. <a href="#" onclick="document.getElementById('app-screen').classList.add('hidden'); document.getElementById('login-screen').classList.remove('hidden'); sessionStorage.removeItem('viewOnlyMode');" style="color: #ffd700; text-decoration: underline;">Connect wallet</a> to interact.
            </div>
        `;
        document.querySelector('.main-content').insertBefore(banner, document.querySelector('.main-content').firstChild);
        
        // Show public-friendly navigation
        showPublicNavigation();
        
        // Start on dashboard
        navigateTo('dashboard');
        
        showToast('👁️ Viewing in public mode - Connect wallet to interact', 'info');
        
    } catch (error) {
        console.error('View-only mode error:', error);
        showToast('Unable to load public data. Please try again.', 'error');
    }
}

function showPublicNavigation() {
    // Hide admin-only pages, show public pages
    const publicPages = ['dashboard', 'beneficiaries', 'merchants', 'transactions', 'audit', 'map', 'donate'];
    
    document.querySelectorAll('.nav-item').forEach(item => {
        const page = item.dataset.page;
        if (publicPages.includes(page)) {
            item.style.display = 'flex';
        } else {
            item.style.display = 'none';
        }
    });
}

// ============================================
// NAVIGATION
// ============================================

function navigateTo(page) {
    // Update nav items
    document.querySelectorAll('.nav-item').forEach(item => {
        item.classList.toggle('active', item.dataset.page === page);
    });
    
    // Show page
    document.querySelectorAll('.page').forEach(p => p.classList.remove('active'));
    const pageEl = document.getElementById(`page-${page}`);
    if (pageEl) {
        pageEl.classList.add('active');
    }
    
    // Update header
    const titles = {
        dashboard: ['Dashboard', 'Overview of relief fund activities'],
        beneficiaries: ['Beneficiaries', 'Manage registered beneficiaries'],
        merchants: ['Merchants', 'Manage approved merchants'],
        mint: ['Mint Tokens', 'Distribute relief funds to beneficiaries'],
        wallet: ['My Wallet', 'View your balance and transactions'],
        payment: ['Make Payment', 'Pay approved merchants'],
        transactions: ['Transactions', 'View all transaction history'],
        audit: ['Audit Trail', 'Transparency and verification'],
        map: ['Relief Map', 'Geographic distribution of aid'],
        donate: ['Donor Portal', 'Support disaster relief efforts']
    };
    
    document.getElementById('page-title').textContent = titles[page]?.[0] || page;
    document.getElementById('page-subtitle').textContent = titles[page]?.[1] || '';
    
    // Close mobile sidebar
    document.getElementById('sidebar').classList.remove('open');
    
    // Initialize map when visiting map page
    if (page === 'map') {
        setTimeout(() => {
            initializeMap();
            updateMapStats();
        }, 100);
    }
    
    // Load donor data when visiting donate page
    if (page === 'donate') {
        loadDonationHistory();
    }
    
    // Refresh page-specific data
    refreshPageData(page);
}

async function refreshPageData(page) {
    // Allow data loading even without wallet connection (read-only)
    switch (page) {
        case 'dashboard':
            await loadDashboardData();
            break;
        case 'beneficiaries':
            await loadBeneficiaries();
            break;
        case 'merchants':
            await loadMerchants();
            break;
        case 'wallet':
            await loadWalletData();
            break;
        case 'payment':
            await loadPaymentData();
            break;
        case 'transactions':
            await loadAllTransactions();
            break;
        case 'audit':
            await loadAuditData();
            break;
        case 'map':
            initializeMap();
            await updateMapStats();
            break;
        case 'donate':
            loadDonationHistory();
            break;
        case 'dashboard':
            await refreshData();
            await getFundDistributionSummary();
            break;
    }
}

// ============================================
// DATA LOADING
// ============================================

async function refreshData() {
    try {
        // Load stats
        const [beneficiaryCount, merchantCount, totalSupply, txCount] = await Promise.all([
            fundManager.totalBeneficiaries(),
            fundManager.totalMerchants(),
            stablecoin.totalSupply(),
            fundManager.getTransactionCount()
        ]);
        
        document.getElementById('stat-beneficiaries').textContent = beneficiaryCount.toString();
        document.getElementById('stat-merchants').textContent = merchantCount.toString();
        document.getElementById('stat-supply').textContent = formatAmount(totalSupply) + ' RUSD';
        document.getElementById('stat-transactions').textContent = txCount.toString();
        
        // Update balance in header
        const balance = await stablecoin.balanceOf(currentAccount);
        document.getElementById('header-balance').textContent = formatAmount(balance) + ' RUSD';
        
        // Check system status
        const paused = await stablecoin.paused();
        updateSystemStatus(paused);
        
        // Load recent activity
        await loadRecentActivity();
        
        // Load minting history
        await loadMintingHistory();
        
        // Update category breakdown charts
        await updateCategoryBreakdown();
        
        // Load contract addresses for audit page
        document.getElementById('contract-rusd').textContent = CONFIG.RELIEF_STABLECOIN;
        document.getElementById('contract-manager').textContent = CONFIG.RELIEF_FUND_MANAGER;
        
        // Log fund distribution summary for verification
        await getFundDistributionSummary();
        
    } catch (error) {
        console.error('Error refreshing data:', error);
        showToast('Error loading data: ' + error.message, 'error');
    }
}

function updateSystemStatus(paused) {
    const statusEl = document.getElementById('system-status');
    const pauseIcon = document.getElementById('pause-icon');
    const pauseText = document.getElementById('pause-text');
    
    if (paused) {
        statusEl.innerHTML = '<i class="fas fa-pause-circle"></i> Paused';
        statusEl.className = 'status-value paused';
        if (pauseIcon) pauseIcon.className = 'fas fa-play-circle';
        if (pauseText) pauseText.textContent = 'Resume System';
    } else {
        statusEl.innerHTML = '<i class="fas fa-check-circle"></i> Active';
        statusEl.className = 'status-value active';
        if (pauseIcon) pauseIcon.className = 'fas fa-pause-circle';
        if (pauseText) pauseText.textContent = 'Emergency Stop';
    }
}

async function loadRecentActivity() {
    const activityList = document.getElementById('recent-activity-list');
    
    try {
        const txCount = await fundManager.getTransactionCount();
        const count = Math.min(Number(txCount), 5);
        
        if (count === 0) {
            activityList.innerHTML = `
                <div class="empty-state">
                    <i class="fas fa-inbox"></i>
                    <p>No recent activity</p>
                </div>
            `;
            return;
        }
        
        let html = '';
        for (let i = Number(txCount) - 1; i >= Number(txCount) - count; i--) {
            const tx = await fundManager.getTransaction(i);
            const time = new Date(Number(tx.timestamp) * 1000);
            
            html += `
                <div class="activity-item">
                    <div class="activity-icon transfer">
                        <i class="fas fa-exchange-alt"></i>
                    </div>
                    <div class="activity-info">
                        <div class="activity-text">
                            ${shortenAddress(tx.from)} → ${shortenAddress(tx.to)}
                        </div>
                        <div class="activity-time">${formatTime(time)}</div>
                    </div>
                    <div class="tx-amount">
                        <div class="tx-amount-value">${formatAmount(tx.amount)} RUSD</div>
                        <span class="category-badge ${getCategoryClass(tx.category)}">${getCategoryName(tx.category)}</span>
                    </div>
                </div>
            `;
        }
        
        activityList.innerHTML = html;
        
    } catch (error) {
        console.error('Error loading activity:', error);
    }
}

// ============================================
// BENEFICIARIES MANAGEMENT
// ============================================

async function loadBeneficiaries() {
    const container = document.getElementById('beneficiaries-list');
    
    try {
        // Use getAllBeneficiaries to get the list of addresses
        const beneficiaryAddresses = await fundManager.getAllBeneficiaries();
        
        if (beneficiaryAddresses.length === 0) {
            container.innerHTML = `
                <div class="empty-state">
                    <i class="fas fa-users"></i>
                    <p>No beneficiaries registered yet</p>
                </div>
            `;
            return;
        }
        
        let html = '';
        for (let i = 0; i < beneficiaryAddresses.length; i++) {
            const address = beneficiaryAddresses[i];
            const info = await fundManager.getBeneficiaryDetails(address);
            const balance = await stablecoin.balanceOf(address);
            
            // info returns: [isActive, registeredAt, totalReceived, totalSpent]
            const isActive = info[0];
            const totalReceived = info[2];
            const totalSpent = info[3];
            
            // Calculate expected balance and verify tally
            const expectedBalance = totalReceived - totalSpent;
            const tallyMatches = balance >= expectedBalance - 1n && balance <= expectedBalance + 1n; // Allow 1 wei tolerance
            
            html += `
                <div class="data-card ${!isActive ? 'inactive' : ''}">
                    <div class="data-avatar">
                        <i class="fas fa-user"></i>
                    </div>
                    <div class="data-info">
                        <div class="data-title">Beneficiary #${i + 1} ${!isActive ? '(Inactive)' : ''}</div>
                        <div class="data-subtitle">${address}</div>
                        <div class="data-meta" style="margin-top: 8px; font-size: 0.8rem; color: var(--text-muted);">
                            <span>Received: <strong style="color: var(--success);">${formatAmount(totalReceived)}</strong></span>
                            <span style="margin-left: 12px;">Spent: <strong style="color: var(--danger);">${formatAmount(totalSpent)}</strong></span>
                        </div>
                    </div>
                    <div class="data-badge">
                        <span class="category-badge shelter">${formatAmount(balance)} RUSD</span>
                        ${tallyMatches ? 
                            '<span class="balance-tally" style="margin-left: 8px;"><i class="fas fa-check-circle"></i> Tally OK</span>' : 
                            '<span class="balance-tally mismatch" style="margin-left: 8px;"><i class="fas fa-exclamation-triangle"></i> Check</span>'
                        }
                    </div>
                </div>
            `;
        }
        
        container.innerHTML = html;
        
    } catch (error) {
        console.error('Error loading beneficiaries:', error);
        container.innerHTML = `<div class="empty-state"><p>Error loading beneficiaries</p></div>`;
    }
}

async function addBeneficiary() {
    // Check for view-only mode
    if (currentRole === 'viewer' || !currentAccount) {
        showToast('Connect your wallet to add beneficiaries', 'warning');
        return;
    }
    
    // Role validation - only admin can add beneficiaries
    if (currentRole !== 'admin') {
        showToast('Only admin can add beneficiaries', 'error');
        return;
    }
    
    const address = document.getElementById('new-beneficiary-address').value.trim();
    
    // Validate address - must be a proper Ethereum address
    if (!address) {
        showToast('Please enter a beneficiary address', 'error');
        return;
    }
    
    // Check if user accidentally entered a private key
    if (address.length === 66 && address.startsWith('0x')) {
        showToast('⚠️ That looks like a PRIVATE KEY! Use the wallet ADDRESS (42 characters).', 'error');
        return;
    }
    
    if (!ethers.isAddress(address)) {
        showToast('Invalid address format. Must be 42 characters starting with 0x', 'error');
        return;
    }
    
    showProcessing('Adding beneficiary...');
    
    try {
        console.log('👤 Adding beneficiary:', address);
        const tx = await fundManager.addBeneficiary(address);
        console.log('📤 TX sent:', tx.hash);
        
        await tx.wait();
        console.log('✅ Beneficiary added!');
        
        closeModal();
        showSuccess('Beneficiary added successfully!');
        
        // Clear the input field
        document.getElementById('new-beneficiary-address').value = '';
        
        // Force refresh all data
        await forceRefreshAll();
        await loadBeneficiaries();
        
    } catch (error) {
        closeModal();
        console.error('Add beneficiary error:', error);
        showError('Failed to add beneficiary: ' + (error.reason || error.message));
    }
}

// ============================================
// MERCHANTS MANAGEMENT
// ============================================

async function loadMerchants() {
    const container = document.getElementById('merchants-list');
    merchants = [];
    
    try {
        // Use getAllMerchants to get the list of addresses
        const merchantAddresses = await fundManager.getAllMerchants();
        
        if (merchantAddresses.length === 0) {
            container.innerHTML = `
                <div class="empty-state">
                    <i class="fas fa-store"></i>
                    <p>No merchants registered yet</p>
                </div>
            `;
            return;
        }
        
        let html = '';
        for (let i = 0; i < merchantAddresses.length; i++) {
            const address = merchantAddresses[i];
            const info = await fundManager.getMerchantDetails(address);
            
            // info returns: [isActive, category, name, registeredAt]
            const isActive = info[0];
            const category = Number(info[1]);
            const name = info[2];
            
            merchants.push({
                address: address,
                name: name,
                category: category
            });
            
            html += `
                <div class="merchant-card ${!isActive ? 'inactive' : ''}">
                    <div class="merchant-header">
                        <div>
                            <div class="merchant-name">${name} ${!isActive ? '(Inactive)' : ''}</div>
                            <div class="merchant-address">${shortenAddress(address)}</div>
                        </div>
                        <span class="category-badge ${getCategoryClass(category)}">
                            <i class="${getCategoryIcon(category)}"></i>
                            ${getCategoryName(category)}
                        </span>
                    </div>
                    <div class="merchant-actions">
                        <button class="btn btn-sm btn-secondary" onclick="showMerchantQR('${address}', '${name}', ${category})">
                            <i class="fas fa-qrcode"></i> QR Code
                        </button>
                    </div>
                </div>
            `;
        }
        
        container.innerHTML = html;
        
    } catch (error) {
        console.error('Error loading merchants:', error);
        container.innerHTML = `<div class="empty-state"><p>Error loading merchants</p></div>`;
    }
}

async function addMerchant() {
    // Check for view-only mode
    if (currentRole === 'viewer' || !currentAccount) {
        showToast('Connect your wallet to add merchants', 'warning');
        return;
    }
    
    // Role validation - only admin can add merchants
    if (currentRole !== 'admin') {
        showToast('Only admin can add merchants', 'error');
        return;
    }
    
    const address = document.getElementById('new-merchant-address').value.trim();
    const name = document.getElementById('new-merchant-name').value.trim();
    const category = document.querySelector('input[name="category"]:checked')?.value;
    
    // Validate address
    if (!address) {
        showToast('Please enter a merchant address', 'error');
        return;
    }
    
    // Check if user accidentally entered a private key
    if (address.length === 66 && address.startsWith('0x')) {
        showToast('⚠️ That looks like a PRIVATE KEY! Use the wallet ADDRESS (42 characters).', 'error');
        return;
    }
    
    if (!ethers.isAddress(address)) {
        showToast('Invalid address format. Must be 42 characters starting with 0x', 'error');
        return;
    }
    
    if (!name) {
        showToast('Please enter a merchant name', 'error');
        return;
    }
    
    if (category === undefined || category === null) {
        showToast('Please select a category', 'error');
        return;
    }
    
    showProcessing('Adding merchant...');
    
    try {
        console.log('🏪 Adding merchant:', name, 'at', address, 'category:', category);
        const tx = await fundManager.addMerchant(address, parseInt(category), name);
        console.log('📤 TX sent:', tx.hash);
        
        await tx.wait();
        console.log('✅ Merchant added!');
        
        closeModal();
        showSuccess('Merchant added successfully!');
        
        // Clear form
        document.getElementById('new-merchant-address').value = '';
        document.getElementById('new-merchant-name').value = '';
        
        // Force refresh all data
        await forceRefreshAll();
        await loadMerchants();
        
    } catch (error) {
        closeModal();
        console.error('Add merchant error:', error);
        showError('Failed to add merchant: ' + (error.reason || error.message));
    }
}

// ============================================
// MINTING
// ============================================

// Minting history storage (in-memory for session, persisted events on chain)
let mintingHistory = [];

async function mintTokens() {
    // Check for view-only mode
    if (currentRole === 'viewer' || !currentAccount) {
        showToast('Connect your wallet to mint tokens', 'warning');
        return;
    }
    
    // Role validation - only admin can mint tokens
    if (currentRole !== 'admin') {
        showToast('Only admin can mint tokens', 'error');
        return;
    }
    
    const recipient = document.getElementById('mint-recipient').value.trim();
    const amount = document.getElementById('mint-amount').value;
    
    // Validate address - must be a proper Ethereum address, NOT a private key
    if (!recipient) {
        showToast('Please enter a recipient address', 'error');
        return;
    }
    
    // Check if user accidentally entered a private key (66 chars starting with 0x)
    if (recipient.length === 66 && recipient.startsWith('0x')) {
        showToast('⚠️ That looks like a PRIVATE KEY, not an ADDRESS! Use the wallet ADDRESS (42 characters).', 'error');
        return;
    }
    
    if (!ethers.isAddress(recipient)) {
        showToast('Invalid address format. Must be 42 characters starting with 0x', 'error');
        return;
    }
    
    if (!amount || parseFloat(amount) <= 0) {
        showToast('Please enter a valid amount', 'error');
        return;
    }
    
    // Maximum mint validation (prevent unrealistic amounts)
    if (parseFloat(amount) > 1000000) {
        showToast('Maximum single mint is 1,000,000 RUSD', 'error');
        return;
    }
    
    showProcessing('Minting tokens...');
    
    try {
        const amountWei = ethers.parseEther(amount);
        console.log('🪙 Minting', amount, 'RUSD to', recipient);
        
        // Step 1: Mint the tokens
        const tx = await stablecoin.mint(recipient, amountWei);
        console.log('📤 Mint TX sent:', tx.hash);
        
        const receipt = await tx.wait();
        console.log('✅ Mint confirmed in block:', receipt.blockNumber);
        
        // Step 2: Record distribution to update beneficiary's totalReceived
        try {
            const recordTx = await fundManager.recordDistribution(recipient, amountWei);
            await recordTx.wait();
            console.log('✅ Distribution recorded for beneficiary');
        } catch (recordError) {
            console.warn('⚠️ Could not record distribution (beneficiary may not be registered):', recordError.message);
        }
        
        // Step 3: Add to local minting history
        const mintRecord = {
            txHash: tx.hash,
            to: recipient,
            amount: amount,
            timestamp: new Date().toISOString(),
            blockNumber: receipt.blockNumber
        };
        mintingHistory.unshift(mintRecord);
        saveMintingHistory();
        
        closeModal();
        showSuccess(`${amount} RUSD minted to ${shortenAddress(recipient)}`);
        showConfetti();
        
        // Send emergency notification for fund distribution
        sendEmergencyAlert(
            '💰 Funds Distributed!', 
            `${amount} RUSD sent to ${shortenAddress(recipient)}`, 
            'success'
        );
        
        document.getElementById('mint-recipient').value = '';
        document.getElementById('mint-amount').value = '';
        
        // Force refresh all data after minting
        await forceRefreshAll();
        
        // Update minting history display
        await loadMintingHistory();
        
    } catch (error) {
        closeModal();
        console.error('Mint error:', error);
        showError('Failed to mint: ' + (error.reason || error.message));
    }
}

// Save minting history to localStorage
function saveMintingHistory() {
    localStorage.setItem('reliefusd_minting_history', JSON.stringify(mintingHistory));
}

// Load minting history from localStorage and blockchain events
async function loadMintingHistory() {
    // Load from localStorage first
    const stored = localStorage.getItem('reliefusd_minting_history');
    if (stored) {
        mintingHistory = JSON.parse(stored);
    }
    
    // Also try to get from blockchain events
    try {
        if (stablecoin) {
            const filter = stablecoin.filters.TokensMinted();
            const events = await stablecoin.queryFilter(filter, -10000); // Last 10000 blocks
            
            events.forEach(event => {
                const existing = mintingHistory.find(m => m.txHash === event.transactionHash);
                if (!existing) {
                    mintingHistory.push({
                        txHash: event.transactionHash,
                        to: event.args[0],
                        amount: ethers.formatEther(event.args[1]),
                        timestamp: new Date().toISOString(),
                        blockNumber: event.blockNumber
                    });
                }
            });
            
            // Sort by most recent
            mintingHistory.sort((a, b) => (b.blockNumber || 0) - (a.blockNumber || 0));
            saveMintingHistory();
        }
    } catch (e) {
        console.log('Could not load minting events from chain:', e.message);
    }
    
    // Update UI
    updateMintingHistoryUI();
}

function updateMintingHistoryUI() {
    const container = document.getElementById('minting-history-list');
    if (!container) return;
    
    if (mintingHistory.length === 0) {
        container.innerHTML = `
            <div class="empty-state">
                <i class="fas fa-coins"></i>
                <p>No minting history yet</p>
            </div>
        `;
        return;
    }
    
    container.innerHTML = mintingHistory.slice(0, 10).map(mint => `
        <div class="mint-history-item">
            <div class="mint-icon"><i class="fas fa-coins"></i></div>
            <div class="mint-info">
                <div class="mint-address">To: ${shortenAddress(mint.to)}</div>
                <div class="mint-time">${new Date(mint.timestamp).toLocaleString()}</div>
            </div>
            <div class="mint-amount">+${parseFloat(mint.amount).toFixed(2)} RUSD</div>
        </div>
    `).join('');
}

// ============================================
// WALLET & PAYMENTS
// ============================================

async function loadWalletData() {
    try {
        const balance = await stablecoin.balanceOf(currentAccount);
        const info = await fundManager.getBeneficiaryDetails(currentAccount);
        
        // info returns: [isActive, registeredAt, totalReceived, totalSpent]
        const totalReceived = info[2];
        const totalSpent = info[3];
        const currentBalance = balance;
        
        // Update wallet display
        document.getElementById('wallet-balance').textContent = formatAmount(currentBalance);
        document.getElementById('wallet-address-card').textContent = shortenAddress(currentAccount);
        document.getElementById('total-received').textContent = formatAmount(totalReceived) + ' RUSD';
        document.getElementById('total-spent').textContent = formatAmount(totalSpent) + ' RUSD';
        
        // Calculate and verify balance tally
        const expectedBalance = totalReceived - totalSpent;
        console.log('💰 Balance Tally Check:');
        console.log('   Total Received:', formatAmount(totalReceived), 'RUSD');
        console.log('   Total Spent:', formatAmount(totalSpent), 'RUSD');
        console.log('   Expected Balance:', formatAmount(expectedBalance), 'RUSD');
        console.log('   Actual Balance:', formatAmount(currentBalance), 'RUSD');
        
        // Load user's transactions
        await loadMyTransactions();
        
    } catch (error) {
        console.error('Error loading wallet data:', error);
    }
}

async function loadMyTransactions() {
    const container = document.getElementById('my-transactions');
    
    try {
        const txCount = await fundManager.getTransactionCount();
        let html = '';
        let found = 0;
        
        for (let i = Number(txCount) - 1; i >= 0 && found < 10; i--) {
            const tx = await fundManager.getTransaction(i);
            
            if (tx.from.toLowerCase() === currentAccount.toLowerCase() || 
                tx.to.toLowerCase() === currentAccount.toLowerCase()) {
                
                const isSent = tx.from.toLowerCase() === currentAccount.toLowerCase();
                const time = new Date(Number(tx.timestamp) * 1000);
                
                html += `
                    <div class="transaction-item">
                        <div class="tx-icon ${isSent ? 'sent' : 'received'}">
                            <i class="fas fa-arrow-${isSent ? 'up' : 'down'}"></i>
                        </div>
                        <div class="tx-info">
                            <div class="tx-addresses">
                                ${isSent ? 'To: ' : 'From: '}
                                <span>${shortenAddress(isSent ? tx.to : tx.from)}</span>
                            </div>
                            <div class="tx-time">${formatTime(time)}</div>
                        </div>
                        <div class="tx-amount">
                            <div class="tx-amount-value ${isSent ? 'sent' : 'received'}">
                                ${isSent ? '-' : '+'}${formatAmount(tx.amount)} RUSD
                            </div>
                            <span class="category-badge ${getCategoryClass(tx.category)}">${getCategoryName(tx.category)}</span>
                        </div>
                    </div>
                `;
                found++;
            }
        }
        
        if (html === '') {
            container.innerHTML = `
                <div class="empty-state">
                    <i class="fas fa-inbox"></i>
                    <p>No transactions yet</p>
                </div>
            `;
        } else {
            container.innerHTML = html;
        }
        
    } catch (error) {
        console.error('Error loading transactions:', error);
    }
}

async function loadPaymentData() {
    try {
        // Load balance
        const balance = await stablecoin.balanceOf(currentAccount);
        document.getElementById('payment-balance').textContent = formatAmount(balance);
        
        // Load merchants for selection
        const container = document.getElementById('merchant-selector');
        const merchantAddresses = await fundManager.getAllMerchants();
        
        if (merchantAddresses.length === 0) {
            container.innerHTML = `
                <div class="empty-state small">
                    <i class="fas fa-store"></i>
                    <p>No merchants available</p>
                </div>
            `;
            return;
        }
        
        let html = '';
        merchants = [];
        
        for (let i = 0; i < merchantAddresses.length; i++) {
            const address = merchantAddresses[i];
            const info = await fundManager.getMerchantDetails(address);
            
            // info returns: [isActive, category, name, registeredAt]
            const isActive = info[0];
            const category = Number(info[1]);
            const name = info[2];
            
            // Only show active merchants for payment
            if (!isActive) continue;
            
            merchants.push({
                address: address,
                name: name,
                category: category
            });
            
            html += `
                <div class="merchant-option" data-address="${address}" onclick="selectMerchantForPayment('${address}')">
                    <span class="category-badge ${getCategoryClass(category)}">
                        <i class="${getCategoryIcon(category)}"></i>
                    </span>
                    <div class="merchant-option-info">
                        <div class="merchant-option-name">${name}</div>
                        <div class="merchant-option-address">${shortenAddress(address)}</div>
                    </div>
                </div>
            `;
        }
        
        if (html === '') {
            container.innerHTML = `
                <div class="empty-state small">
                    <i class="fas fa-store"></i>
                    <p>No active merchants available</p>
                </div>
            `;
            return;
        }
        
        container.innerHTML = html;
        
    } catch (error) {
        console.error('Error loading payment data:', error);
    }
}

function selectMerchantForPayment(address) {
    selectedMerchant = address;
    
    document.querySelectorAll('.merchant-option').forEach(el => {
        el.classList.toggle('selected', el.dataset.address === address);
    });
}

async function makePayment() {
    // Check for view-only mode
    if (currentRole === 'viewer' || !currentAccount) {
        showToast('Connect your wallet to make payments', 'warning');
        return;
    }
    
    // Role validation - only beneficiaries can make payments
    if (currentRole !== 'beneficiary') {
        showToast('Only beneficiaries can make payments', 'error');
        return;
    }
    
    if (!selectedMerchant) {
        showToast('Please select a merchant', 'error');
        return;
    }
    
    const amount = document.getElementById('payment-amount').value;
    
    if (!amount || parseFloat(amount) <= 0) {
        showToast('Please enter a valid amount', 'error');
        return;
    }
    
    // Check balance first
    const balance = await stablecoin.balanceOf(currentAccount);
    const amountWei = ethers.parseEther(amount);
    
    if (balance < amountWei) {
        showToast('Insufficient balance', 'error');
        return;
    }
    
    showProcessing('Processing payment...');
    
    try {
        // Execute transfer
        const tx = await stablecoin.transfer(selectedMerchant, amountWei);
        console.log('💳 Payment TX sent:', tx.hash);
        
        // Wait for confirmation
        const receipt = await tx.wait();
        console.log('✅ Payment confirmed in block:', receipt.blockNumber);
        
        closeModal();
        
        const merchant = merchants.find(m => m.address === selectedMerchant);
        showSuccess(`Payment of ${amount} RUSD to ${merchant?.name || 'Merchant'} successful!`);
        
        // Clear form
        document.getElementById('payment-amount').value = '';
        selectedMerchant = null;
        document.querySelectorAll('.merchant-option').forEach(el => el.classList.remove('selected'));
        
        // Force immediate refresh of ALL data
        console.log('🔄 Force refreshing all data after payment...');
        await forceRefreshAll();
        
    } catch (error) {
        closeModal();
        console.error('Payment error:', error);
        showError('Payment failed: ' + (error.reason || error.message));
    }
}

// Force refresh all data with delays to ensure blockchain state is updated
async function forceRefreshAll() {
    try {
        // Small delay to ensure blockchain state is updated
        await new Promise(resolve => setTimeout(resolve, 500));
        
        // Refresh main stats
        await refreshData();
        
        // Refresh wallet data
        await loadPaymentData();
        
        // Refresh recent activity
        await loadRecentActivity();
        
        // Refresh all transactions page
        await loadAllTransactions();
        
        // Refresh audit data
        await loadAuditData();
        
        // Update review table
        await updateReviewTable();
        
        console.log('✅ Force refresh complete!');
    } catch (error) {
        console.error('Error in force refresh:', error);
    }
}

// ============================================
// TRANSACTIONS
// ============================================

async function loadAllTransactions() {
    const container = document.getElementById('all-transactions');
    
    try {
        const txCount = await fundManager.getTransactionCount();
        
        if (txCount === 0n) {
            container.innerHTML = `
                <div class="empty-state">
                    <i class="fas fa-inbox"></i>
                    <p>No transactions yet</p>
                </div>
            `;
            return;
        }
        
        let html = '';
        const count = Math.min(Number(txCount), 50);
        
        for (let i = Number(txCount) - 1; i >= Number(txCount) - count; i--) {
            const tx = await fundManager.getTransaction(i);
            const time = new Date(Number(tx.timestamp) * 1000);
            
            html += `
                <div class="transaction-item">
                    <div class="tx-icon sent">
                        <i class="fas fa-exchange-alt"></i>
                    </div>
                    <div class="tx-info">
                        <div class="tx-addresses">
                            ${shortenAddress(tx.from)} → <span>${shortenAddress(tx.to)}</span>
                        </div>
                        <div class="tx-time">${formatTime(time)}</div>
                    </div>
                    <div class="tx-amount">
                        <div class="tx-amount-value">${formatAmount(tx.amount)} RUSD</div>
                        <span class="category-badge ${getCategoryClass(tx.category)}">${getCategoryName(tx.category)}</span>
                    </div>
                </div>
            `;
        }
        
        container.innerHTML = html;
        
    } catch (error) {
        console.error('Error loading transactions:', error);
    }
}

async function refreshTransactions() {
    await loadAllTransactions();
    showToast('Transactions refreshed', 'success');
}

// ============================================
// AUDIT
// ============================================

async function loadAuditData() {
    try {
        const [txCount, beneficiaryCount, totalSupply] = await Promise.all([
            fundManager.getTransactionCount(),
            fundManager.totalBeneficiaries(),
            stablecoin.totalSupply()
        ]);
        
        document.getElementById('audit-total-tx').textContent = txCount.toString();
        document.getElementById('audit-total-volume').textContent = formatAmount(totalSupply) + ' RUSD';
        document.getElementById('audit-total-beneficiaries').textContent = beneficiaryCount.toString();
        
    } catch (error) {
        console.error('Error loading audit data:', error);
    }
}

function copyAddress(type) {
    const address = type === 'rusd' ? CONFIG.RELIEF_STABLECOIN : CONFIG.RELIEF_FUND_MANAGER;
    navigator.clipboard.writeText(address);
    showToast('Address copied to clipboard', 'success');
}

// ============================================
// ADMIN FUNCTIONS
// ============================================

async function togglePause() {
    showProcessing('Processing...');
    
    try {
        const paused = await stablecoin.paused();
        
        let tx;
        if (paused) {
            tx = await stablecoin.unpause();
        } else {
            tx = await stablecoin.pause();
        }
        await tx.wait();
        
        closeModal();
        showSuccess(paused ? 'System resumed!' : 'System paused!');
        await refreshData();
        
    } catch (error) {
        closeModal();
        showError('Failed: ' + (error.reason || error.message));
    }
}

// ============================================
// MODAL FUNCTIONS
// ============================================

function openModal(modalType) {
    document.getElementById('modal-overlay').classList.remove('hidden');
    document.getElementById(`modal-${modalType}`).classList.remove('hidden');
}

function closeModal() {
    document.getElementById('modal-overlay').classList.add('hidden');
    document.querySelectorAll('.modal').forEach(m => m.classList.add('hidden'));
}

function showProcessing(message) {
    document.getElementById('processing-message').textContent = message;
    document.getElementById('modal-overlay').classList.remove('hidden');
    document.getElementById('modal-processing').classList.remove('hidden');
}

function showSuccess(message) {
    document.querySelectorAll('.modal').forEach(m => m.classList.add('hidden'));
    document.getElementById('success-message').textContent = message;
    document.getElementById('modal-success').classList.remove('hidden');
}

function showError(message) {
    document.querySelectorAll('.modal').forEach(m => m.classList.add('hidden'));
    document.getElementById('error-message').textContent = message;
    document.getElementById('modal-error').classList.remove('hidden');
}

// ============================================
// TOAST NOTIFICATIONS
// ============================================

function showToast(message, type = 'success') {
    const container = document.getElementById('toast-container');
    const toast = document.createElement('div');
    toast.className = `toast ${type}`;
    
    const icons = {
        success: 'fas fa-check-circle',
        error: 'fas fa-times-circle',
        warning: 'fas fa-exclamation-triangle'
    };
    
    toast.innerHTML = `
        <i class="${icons[type]}"></i>
        <span class="toast-message">${message}</span>
    `;
    
    container.appendChild(toast);
    
    setTimeout(() => {
        toast.style.animation = 'slideInRight 0.3s ease reverse';
        setTimeout(() => toast.remove(), 300);
    }, 4000);
}

// ============================================
// UTILITY FUNCTIONS
// ============================================

function shortenAddress(address) {
    return address.substring(0, 6) + '...' + address.substring(38);
}

function formatAmount(wei) {
    return parseFloat(ethers.formatEther(wei)).toFixed(2);
}

function formatTime(date) {
    const now = new Date();
    const diff = now - date;
    
    if (diff < 60000) return 'Just now';
    if (diff < 3600000) return Math.floor(diff / 60000) + 'm ago';
    if (diff < 86400000) return Math.floor(diff / 3600000) + 'h ago';
    
    return date.toLocaleDateString();
}

function getCategoryName(category) {
    const categories = ['FOOD', 'MEDICAL', 'SHELTER', 'EDUCATION', 'UTILITIES'];
    return categories[Number(category)] || 'UNKNOWN';
}

function getCategoryClass(category) {
    const classes = ['food', 'medical', 'shelter', 'education', 'utilities'];
    return classes[Number(category)] || 'food';
}

function getCategoryIcon(category) {
    const icons = ['fas fa-apple-alt', 'fas fa-medkit', 'fas fa-home', 'fas fa-book', 'fas fa-bolt'];
    return icons[Number(category)] || 'fas fa-tag';
}

// Close modal on overlay click
document.addEventListener('click', (e) => {
    if (e.target.id === 'modal-overlay') {
        // Don't close processing modal
        if (!document.getElementById('modal-processing').classList.contains('hidden')) {
            return;
        }
        closeModal();
    }
});

// Close modal on Escape key
document.addEventListener('keydown', (e) => {
    if (e.key === 'Escape') {
        if (!document.getElementById('modal-processing').classList.contains('hidden')) {
            return;
        }
        closeModal();
    }
});

// ============================================
// THEME TOGGLE
// ============================================

function initTheme() {
    const savedTheme = localStorage.getItem('theme') || 'dark';
    document.documentElement.setAttribute('data-theme', savedTheme);
    updateThemeIcon(savedTheme);
}

function toggleTheme() {
    const currentTheme = document.documentElement.getAttribute('data-theme') || 'dark';
    const newTheme = currentTheme === 'dark' ? 'light' : 'dark';
    
    document.documentElement.setAttribute('data-theme', newTheme);
    localStorage.setItem('theme', newTheme);
    updateThemeIcon(newTheme);
    
    showToast(`Switched to ${newTheme} mode`, 'success');
}

function updateThemeIcon(theme) {
    const icon = document.getElementById('theme-icon');
    if (icon) {
        icon.className = theme === 'dark' ? 'fas fa-moon' : 'fas fa-sun';
    }
}

// Initialize theme on load
document.addEventListener('DOMContentLoaded', initTheme);

// Add click listener to theme toggle button
document.addEventListener('DOMContentLoaded', () => {
    const themeToggle = document.getElementById('theme-toggle');
    if (themeToggle) {
        themeToggle.addEventListener('click', toggleTheme);
    }
});

// ============================================
// REAL-TIME SYNC
// ============================================

let eventListeners = [];

async function setupRealTimeSync() {
    if (!stablecoin || !fundManager) return;
    
    console.log('🔄 Setting up real-time sync...');
    
    // Remove previous listeners
    cleanupEventListeners();
    
    try {
        // Listen for Transfer events on stablecoin
        const transferFilter = stablecoin.filters.Transfer();
        stablecoin.on(transferFilter, handleTransferEvent);
        eventListeners.push({ contract: stablecoin, filter: transferFilter, handler: handleTransferEvent });
        
        // Listen for PaymentProcessed events on fundManager
        const paymentFilter = fundManager.filters.PaymentProcessed();
        fundManager.on(paymentFilter, handlePaymentEvent);
        eventListeners.push({ contract: fundManager, filter: paymentFilter, handler: handlePaymentEvent });
        
        // Listen for TokensMinted events
        const mintFilter = stablecoin.filters.TokensMinted();
        stablecoin.on(mintFilter, handleMintEvent);
        eventListeners.push({ contract: stablecoin, filter: mintFilter, handler: handleMintEvent });
        
        // Update live indicator
        const liveIndicator = document.getElementById('live-indicator');
        if (liveIndicator) {
            liveIndicator.style.display = 'inline-flex';
        }
        
        console.log('✅ Real-time sync active!');
    } catch (error) {
        console.error('Error setting up real-time sync:', error);
    }
}

function cleanupEventListeners() {
    eventListeners.forEach(({ contract, filter, handler }) => {
        try {
            contract.off(filter, handler);
        } catch (e) {
            // Ignore
        }
    });
    eventListeners = [];
}

async function handleTransferEvent(from, to, value, event) {
    console.log('📨 Transfer event:', { from, to, value: ethers.formatEther(value) });
    
    // Show notification
    const amount = parseFloat(ethers.formatEther(value)).toFixed(2);
    showToast(`💸 Transfer: ${amount} RUSD`, 'success');
    
    // Refresh data
    await refreshAllViews();
    
    // Add confetti for significant transfers
    if (parseFloat(amount) >= 100) {
        showConfetti();
    }
}

async function handlePaymentEvent(from, to, amount, category, timestamp, event) {
    console.log('💳 Payment event:', { from, to, amount: ethers.formatEther(amount), category });
    
    const categoryName = getCategoryName(category);
    const amountStr = parseFloat(ethers.formatEther(amount)).toFixed(2);
    showToast(`💳 Payment: ${amountStr} RUSD for ${categoryName}`, 'success');
    
    // Refresh all views
    await refreshAllViews();
    
    // Update review table
    await updateReviewTable();
}

async function handleMintEvent(to, amount, timestamp, event) {
    console.log('🪙 Mint event:', { to, amount: ethers.formatEther(amount) });
    
    const amountStr = parseFloat(ethers.formatEther(amount)).toFixed(2);
    showToast(`🪙 Minted: ${amountStr} RUSD to ${shortenAddress(to)}`, 'success');
    
    // Refresh all views
    await refreshAllViews();
    
    // Add confetti for large mints
    if (parseFloat(amountStr) >= 500) {
        showConfetti();
    }
}

async function refreshAllViews() {
    console.log('🔄 Refreshing all views...');
    
    try {
        // Refresh main dashboard data
        await refreshData();
        
        // Refresh page-specific data based on current page
        const activePage = document.querySelector('.page.active');
        if (activePage) {
            const pageId = activePage.id;
            
            if (pageId === 'page-beneficiaries') {
                await loadBeneficiaries();
            } else if (pageId === 'page-merchants') {
                await loadMerchants();
            } else if (pageId === 'page-wallet' || pageId === 'page-payment') {
                await loadPaymentData();
            } else if (pageId === 'page-transactions') {
                await loadTransactions();
            } else if (pageId === 'page-audit') {
                await loadAuditData();
            }
        }
        
        // Update review table
        await updateReviewTable();
        
        console.log('✅ All views refreshed!');
    } catch (error) {
        console.error('Error refreshing views:', error);
    }
}

// ============================================
// PAGE-SPECIFIC DATA LOADERS
// ============================================

async function loadTransactions() {
    const container = document.getElementById('all-transactions');
    if (!container) return;
    
    try {
        const txCount = await fundManager.getTransactionCount();
        const count = Math.min(Number(txCount), 50);
        
        if (count === 0) {
            container.innerHTML = `
                <div class="empty-state">
                    <i class="fas fa-inbox"></i>
                    <p>No transactions yet</p>
                </div>
            `;
            return;
        }
        
        let html = '';
        for (let i = Number(txCount) - 1; i >= Math.max(0, Number(txCount) - count); i--) {
            const tx = await fundManager.getTransaction(i);
            const time = new Date(Number(tx.timestamp) * 1000);
            
            html += `
                <div class="transaction-item">
                    <div class="tx-icon ${getCategoryClass(tx.category)}">
                        <i class="${getCategoryIcon(tx.category)}"></i>
                    </div>
                    <div class="tx-details">
                        <div class="tx-addresses">
                            <span class="tx-from">${shortenAddress(tx.from)}</span>
                            <i class="fas fa-arrow-right"></i>
                            <span class="tx-to">${shortenAddress(tx.to)}</span>
                        </div>
                        <div class="tx-meta">
                            <span class="tx-time">${time.toLocaleString()}</span>
                            <span class="category-badge ${getCategoryClass(tx.category)}">${getCategoryName(tx.category)}</span>
                        </div>
                    </div>
                    <div class="tx-amount">
                        <span class="tx-amount-value">${formatAmount(tx.amount)} RUSD</span>
                    </div>
                </div>
            `;
        }
        
        container.innerHTML = html;
        
    } catch (error) {
        console.error('Error loading transactions:', error);
        container.innerHTML = `<div class="empty-state"><p>Error loading transactions</p></div>`;
    }
}

async function loadAuditData() {
    try {
        // Update audit stats
        const txCount = await fundManager.getTransactionCount();
        const totalSupply = await stablecoin.totalSupply();
        const beneficiaryCount = await fundManager.totalBeneficiaries();
        
        // Calculate category breakdown for charts
        await updateCategoryBreakdown();
        
        // Load minting history
        await loadMintingHistory();
        
        const auditTxEl = document.getElementById('audit-total-tx');
        const auditVolumeEl = document.getElementById('audit-total-volume');
        const auditBeneficiariesEl = document.getElementById('audit-total-beneficiaries');
        const totalSpentEl = document.getElementById('total-spent');
        const dashboardTotalEl = document.getElementById('dashboard-total');
        
        if (auditTxEl) auditTxEl.textContent = txCount.toString();
        if (auditVolumeEl) auditVolumeEl.textContent = formatAmount(totalSupply) + ' RUSD';
        if (auditBeneficiariesEl) auditBeneficiariesEl.textContent = beneficiaryCount.toString();
        if (totalSpentEl) totalSpentEl.textContent = formatAmount(totalSupply);
        if (dashboardTotalEl) dashboardTotalEl.textContent = formatAmount(totalSupply);
        
    } catch (error) {
        console.error('Error loading audit data:', error);
    }
}

// ============================================
// CONFETTI CELEBRATION
// ============================================

function showConfetti() {
    const colors = ['#6366f1', '#22c55e', '#f59e0b', '#ec4899', '#0ea5e9'];
    
    for (let i = 0; i < 50; i++) {
        setTimeout(() => {
            const confetti = document.createElement('div');
            confetti.className = 'confetti';
            confetti.style.left = Math.random() * 100 + 'vw';
            confetti.style.background = colors[Math.floor(Math.random() * colors.length)];
            confetti.style.transform = `rotate(${Math.random() * 360}deg)`;
            confetti.style.animationDuration = (2 + Math.random() * 2) + 's';
            document.body.appendChild(confetti);
            
            setTimeout(() => confetti.remove(), 5000);
        }, i * 30);
    }
}

// ============================================
// AUDIT DOWNLOAD FUNCTIONS
// ============================================

async function downloadAuditCSV() {
    showToast('Generating CSV report...', 'warning');
    
    try {
        const transactions = await getTransactionHistory();
        
        let csv = 'Transaction Hash,Type,From,To,Amount,Category,Timestamp\n';
        
        transactions.forEach(tx => {
            csv += `${tx.hash},${tx.type},${tx.from},${tx.to},${tx.amount},${tx.category || 'N/A'},${tx.timestamp}\n`;
        });
        
        // Create download link
        const blob = new Blob([csv], { type: 'text/csv' });
        const url = URL.createObjectURL(blob);
        const a = document.createElement('a');
        a.href = url;
        a.download = `relief-audit-${new Date().toISOString().split('T')[0]}.csv`;
        document.body.appendChild(a);
        a.click();
        document.body.removeChild(a);
        URL.revokeObjectURL(url);
        
        showToast('CSV downloaded successfully!', 'success');
    } catch (error) {
        console.error('CSV download error:', error);
        showToast('Failed to generate CSV', 'error');
    }
}

async function downloadAuditPDF() {
    showToast('Generating PDF report...', 'warning');
    
    try {
        // Simple PDF generation using HTML content
        const transactions = await getTransactionHistory();
        
        const htmlContent = `
            <!DOCTYPE html>
            <html>
            <head>
                <title>ReliefUSD Audit Report</title>
                <style>
                    body { font-family: Arial, sans-serif; padding: 40px; }
                    h1 { color: #6366f1; }
                    table { width: 100%; border-collapse: collapse; margin-top: 20px; }
                    th, td { border: 1px solid #ddd; padding: 12px; text-align: left; }
                    th { background: #6366f1; color: white; }
                    tr:nth-child(even) { background: #f8fafc; }
                    .header { display: flex; justify-content: space-between; margin-bottom: 30px; }
                    .stats { display: flex; gap: 30px; margin-bottom: 30px; }
                    .stat-box { background: #f1f5f9; padding: 20px; border-radius: 8px; }
                    .stat-value { font-size: 24px; font-weight: bold; color: #6366f1; }
                    .stat-label { color: #64748b; }
                </style>
            </head>
            <body>
                <div class="header">
                    <h1>🤝 ReliefUSD Audit Report</h1>
                    <p>Generated: ${new Date().toLocaleString()}</p>
                </div>
                <div class="stats">
                    <div class="stat-box">
                        <div class="stat-value">${transactions.length}</div>
                        <div class="stat-label">Total Transactions</div>
                    </div>
                    <div class="stat-box">
                        <div class="stat-value">${transactions.reduce((sum, tx) => sum + parseFloat(tx.amount || 0), 0).toFixed(2)} RUSD</div>
                        <div class="stat-label">Total Volume</div>
                    </div>
                </div>
                <table>
                    <thead>
                        <tr>
                            <th>Tx Hash</th>
                            <th>Type</th>
                            <th>From</th>
                            <th>To</th>
                            <th>Amount</th>
                            <th>Category</th>
                        </tr>
                    </thead>
                    <tbody>
                        ${transactions.map(tx => `
                            <tr>
                                <td>${tx.hash ? tx.hash.substring(0, 10) + '...' : 'N/A'}</td>
                                <td>${tx.type}</td>
                                <td>${tx.from ? tx.from.substring(0, 8) + '...' : 'N/A'}</td>
                                <td>${tx.to ? tx.to.substring(0, 8) + '...' : 'N/A'}</td>
                                <td>${tx.amount} RUSD</td>
                                <td>${tx.category || 'N/A'}</td>
                            </tr>
                        `).join('')}
                    </tbody>
                </table>
                <p style="margin-top: 40px; color: #64748b; font-size: 12px;">
                    This report was generated from the ReliefUSD blockchain system. All transactions are publicly auditable on-chain.
                </p>
            </body>
            </html>
        `;
        
        // Open print dialog for PDF
        const printWindow = window.open('', '_blank');
        printWindow.document.write(htmlContent);
        printWindow.document.close();
        printWindow.print();
        
        showToast('PDF report ready for printing!', 'success');
    } catch (error) {
        console.error('PDF generation error:', error);
        showToast('Failed to generate PDF', 'error');
    }
}

async function getTransactionHistory() {
    // Get transactions from FundManager contract (audit trail) + minting events
    const transactions = [];
    
    try {
        if (!fundManager) return transactions;
        
        // Get payment transactions from FundManager
        const txCount = await fundManager.getTransactionCount();
        const count = Math.min(Number(txCount), 100);
        
        for (let i = Number(txCount) - 1; i >= Math.max(0, Number(txCount) - count); i--) {
            try {
                const tx = await fundManager.getTransaction(i);
                transactions.push({
                    hash: `TX-${i}`,
                    type: 'Payment',
                    from: tx.from,
                    to: tx.to,
                    amount: parseFloat(ethers.formatEther(tx.amount)).toFixed(2),
                    category: getCategoryName(tx.category),
                    timestamp: new Date(Number(tx.timestamp) * 1000).toISOString()
                });
            } catch (e) {
                console.error(`Error getting transaction ${i}:`, e);
            }
        }
        
        // Also add minting history
        mintingHistory.forEach(mint => {
            transactions.push({
                hash: mint.txHash ? mint.txHash.substring(0, 10) + '...' : `MINT-${Date.now()}`,
                type: 'Mint',
                from: 'Treasury',
                to: mint.to,
                amount: parseFloat(mint.amount).toFixed(2),
                category: 'Distribution',
                timestamp: mint.timestamp
            });
        });
        
        // Sort by timestamp (most recent first)
        transactions.sort((a, b) => new Date(b.timestamp) - new Date(a.timestamp));
        
    } catch (error) {
        console.error('Error getting transaction history:', error);
    }
    
    return transactions;
}

// ============================================
// TOKEN JOURNEY TRACE
// ============================================

async function traceTokenJourney() {
    const txHashInput = document.getElementById('journey-tx-hash');
    const txHash = txHashInput ? txHashInput.value.trim() : '';
    
    if (!txHash) {
        showToast('Please enter a transaction hash to trace', 'warning');
        return;
    }
    
    showToast('Tracing token journey...', 'warning');
    
    try {
        const receipt = await provider.getTransactionReceipt(txHash);
        
        if (!receipt) {
            showToast('Transaction not found', 'error');
            return;
        }
        
        // Parse the receipt to show journey
        const timeline = document.getElementById('journey-timeline');
        if (!timeline) return;
        
        const block = await provider.getBlock(receipt.blockNumber);
        const timestamp = new Date(block.timestamp * 1000).toLocaleString();
        
        timeline.innerHTML = `
            <div class="journey-step">
                <div class="journey-icon transfer"><i class="fas fa-paper-plane"></i></div>
                <div class="journey-content">
                    <div class="journey-header">
                        <span class="journey-type">Transaction Sent</span>
                        <span class="journey-time">${timestamp}</span>
                    </div>
                    <p>Transaction initiated on the blockchain</p>
                    <div class="journey-details">
                        <div class="journey-detail-item">
                            <span class="journey-detail-label">From</span>
                            <span class="journey-detail-value">${receipt.from.substring(0, 10)}...</span>
                        </div>
                        <div class="journey-detail-item">
                            <span class="journey-detail-label">To</span>
                            <span class="journey-detail-value">${receipt.to.substring(0, 10)}...</span>
                        </div>
                    </div>
                </div>
            </div>
            <div class="journey-step">
                <div class="journey-icon ${receipt.status === 1 ? 'mint' : 'spend'}">
                    <i class="fas fa-${receipt.status === 1 ? 'check' : 'times'}"></i>
                </div>
                <div class="journey-content">
                    <div class="journey-header">
                        <span class="journey-type">${receipt.status === 1 ? 'Transaction Confirmed' : 'Transaction Failed'}</span>
                        <span class="journey-time">Block #${receipt.blockNumber}</span>
                    </div>
                    <p>${receipt.status === 1 ? 'Transaction successfully included in block' : 'Transaction reverted'}</p>
                    <div class="journey-details">
                        <div class="journey-detail-item">
                            <span class="journey-detail-label">Gas Used</span>
                            <span class="journey-detail-value">${receipt.gasUsed.toString()}</span>
                        </div>
                        <div class="journey-detail-item">
                            <span class="journey-detail-label">Status</span>
                            <span class="journey-detail-value">${receipt.status === 1 ? '✅ Success' : '❌ Failed'}</span>
                        </div>
                    </div>
                </div>
            </div>
        `;
        
        showToast('Token journey traced!', 'success');
        
    } catch (error) {
        console.error('Error tracing journey:', error);
        showToast('Failed to trace transaction', 'error');
    }
}

// ============================================
// REVIEW TABLE FILTER
// ============================================

let allTransactions = [];

async function updateReviewTable() {
    try {
        allTransactions = await getTransactionHistory();
        filterReviewTransactions();
    } catch (error) {
        console.error('Error updating review table:', error);
    }
}

function filterReviewTransactions() {
    const filter = document.getElementById('review-filter');
    const filterValue = filter ? filter.value : 'all';
    
    let filtered = allTransactions;
    
    if (filterValue === 'mints') {
        filtered = allTransactions.filter(tx => tx.type === 'Transfer' && tx.from === '0x0000000000000000000000000000000000000000');
    } else if (filterValue === 'transfers') {
        filtered = allTransactions.filter(tx => tx.type === 'Transfer' && tx.from !== '0x0000000000000000000000000000000000000000');
    } else if (filterValue === 'payments') {
        filtered = allTransactions.filter(tx => tx.type === 'Payment');
    }
    
    renderReviewTable(filtered);
}

function renderReviewTable(transactions) {
    const tbody = document.getElementById('review-table-body');
    if (!tbody) return;
    
    if (transactions.length === 0) {
        tbody.innerHTML = `
            <tr>
                <td colspan="7" style="text-align: center; padding: 40px;">
                    <i class="fas fa-inbox" style="font-size: 2rem; color: var(--text-muted);"></i>
                    <p style="color: var(--text-muted); margin-top: 10px;">No transactions to review</p>
                </td>
            </tr>
        `;
        return;
    }
    
    tbody.innerHTML = transactions.map(tx => `
        <tr>
            <td><code>${tx.hash ? tx.hash.substring(0, 10) + '...' : 'N/A'}</code></td>
            <td><span class="badge badge-${tx.type.toLowerCase()}">${tx.type}</span></td>
            <td><code>${tx.from ? tx.from.substring(0, 8) + '...' : 'N/A'}</code></td>
            <td><code>${tx.to ? tx.to.substring(0, 8) + '...' : 'N/A'}</code></td>
            <td><strong>${tx.amount} RUSD</strong></td>
            <td>${tx.category || '-'}</td>
            <td><span class="review-status verified"><i class="fas fa-check"></i> Verified</span></td>
        </tr>
    `).join('');
}

// Initialize review table when audit page loads
document.addEventListener('DOMContentLoaded', () => {
    setTimeout(() => {
        if (stablecoin) {
            updateReviewTable();
            loadMintingHistory();
        }
    }, 3000);
});

// ============================================
// CATEGORY BREAKDOWN FOR CHARTS
// ============================================

async function updateCategoryBreakdown() {
    try {
        const txCount = await fundManager.getTransactionCount();
        const categoryTotals = {
            FOOD: 0,
            MEDICAL: 0,
            SHELTER: 0,
            EDUCATION: 0,
            UTILITIES: 0
        };
        
        let grandTotal = 0;
        
        for (let i = 0; i < Number(txCount); i++) {
            const tx = await fundManager.getTransaction(i);
            const amount = parseFloat(ethers.formatEther(tx.amount));
            const category = getCategoryName(tx.category);
            
            if (categoryTotals.hasOwnProperty(category)) {
                categoryTotals[category] += amount;
            }
            grandTotal += amount;
        }
        
        // Update pie chart
        updatePieChart(categoryTotals, grandTotal);
        
        // Update dashboard totals
        const dashboardTotal = document.getElementById('dashboard-total');
        const totalSpentEl = document.getElementById('total-spent');
        if (dashboardTotal) dashboardTotal.textContent = grandTotal.toFixed(2);
        if (totalSpentEl && totalSpentEl.closest('.pie-center-text')) {
            totalSpentEl.textContent = grandTotal.toFixed(2);
        }
        
        console.log('📊 Category Breakdown:', categoryTotals);
        
    } catch (error) {
        console.error('Error updating category breakdown:', error);
    }
}

function updatePieChart(categoryTotals, grandTotal) {
    const pieChart = document.getElementById('category-pie-chart');
    const dashboardPieChart = document.getElementById('dashboard-pie-chart');
    
    if (!grandTotal || grandTotal === 0) {
        // Show empty state
        if (pieChart) pieChart.style.background = 'var(--bg-tertiary)';
        if (dashboardPieChart) dashboardPieChart.style.background = 'var(--bg-tertiary)';
        return;
    }
    
    const colors = {
        FOOD: 'var(--cat-food)',
        MEDICAL: 'var(--cat-medical)',
        SHELTER: 'var(--cat-shelter)',
        EDUCATION: 'var(--cat-education)',
        UTILITIES: 'var(--cat-utilities)'
    };
    
    // Build conic gradient
    let gradientParts = [];
    let currentAngle = 0;
    
    Object.keys(categoryTotals).forEach(cat => {
        if (categoryTotals[cat] > 0) {
            const percentage = (categoryTotals[cat] / grandTotal) * 100;
            const endAngle = currentAngle + (percentage * 3.6); // 360 degrees / 100
            gradientParts.push(`${colors[cat]} ${currentAngle}deg ${endAngle}deg`);
            currentAngle = endAngle;
        }
    });
    
    const gradient = gradientParts.length > 0 
        ? `conic-gradient(${gradientParts.join(', ')})`
        : 'var(--bg-tertiary)';
    
    if (pieChart) pieChart.style.background = gradient;
    if (dashboardPieChart) dashboardPieChart.style.background = gradient;
}

// ============================================
// FUND DISTRIBUTION SUMMARY
// ============================================

async function getFundDistributionSummary() {
    try {
        const totalSupply = await stablecoin.totalSupply();
        const beneficiaryAddresses = await fundManager.getAllBeneficiaries();
        
        let totalDistributed = 0n;
        let totalSpent = 0n;
        let totalRemaining = 0n;
        
        for (const addr of beneficiaryAddresses) {
            const info = await fundManager.getBeneficiaryDetails(addr);
            const balance = await stablecoin.balanceOf(addr);
            
            totalDistributed += info[2]; // totalReceived
            totalSpent += info[3]; // totalSpent
            totalRemaining += balance;
        }
        
        console.log('💰 Fund Distribution Summary:');
        console.log('   Total Supply:', formatAmount(totalSupply), 'RUSD');
        console.log('   Total Distributed:', formatAmount(totalDistributed), 'RUSD');
        console.log('   Total Spent:', formatAmount(totalSpent), 'RUSD');
        console.log('   Total Remaining:', formatAmount(totalRemaining), 'RUSD');
        
        // Update Fund Summary Panel in Dashboard
        const fundTotalSupply = document.getElementById('fund-total-supply');
        const fundDistributed = document.getElementById('fund-distributed');
        const fundSpent = document.getElementById('fund-spent');
        const fundRemaining = document.getElementById('fund-remaining');
        
        if (fundTotalSupply) fundTotalSupply.textContent = formatAmount(totalSupply) + ' RUSD';
        if (fundDistributed) fundDistributed.textContent = formatAmount(totalDistributed) + ' RUSD';
        if (fundSpent) fundSpent.textContent = formatAmount(totalSpent) + ' RUSD';
        if (fundRemaining) fundRemaining.textContent = formatAmount(totalRemaining) + ' RUSD';
        
        return {
            totalSupply: formatAmount(totalSupply),
            totalDistributed: formatAmount(totalDistributed),
            totalSpent: formatAmount(totalSpent),
            totalRemaining: formatAmount(totalRemaining)
        };
    } catch (error) {
        console.error('Error getting fund summary:', error);
        return null;
    }
}

// ============================================
// QR CODE PAYMENTS
// ============================================

function showMerchantQR(address, name, category) {
    const container = document.getElementById('qr-code-container');
    const merchantName = document.getElementById('qr-merchant-name');
    const qrAddress = document.getElementById('qr-address');
    const qrCategory = document.getElementById('qr-category');
    
    // Clear previous QR code
    container.innerHTML = '';
    
    // Update details
    if (merchantName) merchantName.textContent = name;
    if (qrAddress) qrAddress.textContent = address;
    if (qrCategory) qrCategory.textContent = getCategoryName(category);
    
    // Generate QR code with payment data
    const paymentData = JSON.stringify({
        type: 'relief-payment',
        merchant: address,
        name: name,
        category: getCategoryName(category),
        network: 'localhost:8545',
        token: CONFIG.RELIEF_STABLECOIN
    });
    
    // Use QRCode library
    if (typeof QRCode !== 'undefined') {
        QRCode.toCanvas(paymentData, { width: 200, margin: 2 }, (error, canvas) => {
            if (error) {
                console.error('QR Error:', error);
                container.innerHTML = '<p>Error generating QR code</p>';
            } else {
                container.appendChild(canvas);
            }
        });
    } else {
        // Fallback: show text
        container.innerHTML = `<div class="qr-fallback"><code>${address}</code></div>`;
    }
    
    // Show modal
    document.getElementById('modal-overlay').classList.remove('hidden');
    document.getElementById('modal-qr').classList.remove('hidden');
}

// ============================================
// EMERGENCY ALERT SYSTEM
// ============================================

let notificationsEnabled = false;

async function requestNotificationPermission() {
    if ('Notification' in window) {
        const permission = await Notification.requestPermission();
        notificationsEnabled = permission === 'granted';
        return notificationsEnabled;
    }
    return false;
}

function sendEmergencyAlert(title, message, type = 'info') {
    // Show toast
    showToast(message, type);
    
    // Send browser notification if enabled
    if (notificationsEnabled && 'Notification' in window) {
        const notification = new Notification(title, {
            body: message,
            icon: '/favicon.ico',
            badge: '/favicon.ico',
            tag: 'relief-alert',
            requireInteraction: type === 'emergency'
        });
        
        notification.onclick = () => {
            window.focus();
            notification.close();
        };
    }
    
    // Play sound for emergency alerts
    if (type === 'emergency') {
        playAlertSound();
    }
}

function playAlertSound() {
    try {
        const audioContext = new (window.AudioContext || window.webkitAudioContext)();
        const oscillator = audioContext.createOscillator();
        const gainNode = audioContext.createGain();
        
        oscillator.connect(gainNode);
        gainNode.connect(audioContext.destination);
        
        oscillator.frequency.value = 800;
        oscillator.type = 'sine';
        gainNode.gain.value = 0.3;
        
        oscillator.start();
        setTimeout(() => oscillator.stop(), 200);
    } catch (e) {
        console.log('Audio alert not supported');
    }
}

// ============================================
// GEOGRAPHIC MAP (LEAFLET)
// ============================================

let reliefMap = null;
let mapMarkers = [];

function initializeMap() {
    if (reliefMap) {
        // If already initialized, just refresh
        reliefMap.invalidateSize();
        return;
    }
    
    const mapContainer = document.getElementById('relief-map');
    if (!mapContainer) {
        console.log('Map container not found');
        return;
    }
    
    try {
        // Initialize Leaflet map centered on India with fast loading
        reliefMap = L.map('relief-map', {
            preferCanvas: true,
            zoomControl: true,
            attributionControl: true
        }).setView([20.5937, 78.9629], 5);
        
        // Add OpenStreetMap tiles with fast loading
        L.tileLayer('https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png', {
            attribution: '© OpenStreetMap',
            maxZoom: 18,
            minZoom: 3,
            updateWhenZooming: false,
            updateWhenIdle: true,
            keepBuffer: 2
        }).addTo(reliefMap);
        
        // Wait for tiles to load then add markers
        setTimeout(() => {
            addDisasterZones();
            addMerchantMarkers();
            reliefMap.invalidateSize();
        }, 500);
        
    } catch (error) {
        console.error('Map initialization error:', error);
    }
}

function addDisasterZones() {
    const disasterZones = [
        { lat: 26.8467, lng: 80.9462, name: 'Lucknow Flood Zone', severity: 'high', beneficiaries: 150, distributed: 15000 },
        { lat: 19.0760, lng: 72.8777, name: 'Mumbai Relief Center', severity: 'medium', beneficiaries: 200, distributed: 25000 },
        { lat: 13.0827, lng: 80.2707, name: 'Chennai Cyclone Zone', severity: 'high', beneficiaries: 180, distributed: 20000 },
        { lat: 22.5726, lng: 88.3639, name: 'Kolkata Distribution', severity: 'low', beneficiaries: 100, distributed: 12000 },
        { lat: 28.6139, lng: 77.2090, name: 'Delhi Emergency Hub', severity: 'medium', beneficiaries: 120, distributed: 18000 }
    ];
    
    const severityColors = {
        high: '#ef4444',
        medium: '#f59e0b',
        low: '#22c55e'
    };
    
    disasterZones.forEach(zone => {
        const marker = L.circleMarker([zone.lat, zone.lng], {
            radius: 15,
            fillColor: severityColors[zone.severity],
            color: '#fff',
            weight: 2,
            opacity: 1,
            fillOpacity: 0.7
        }).addTo(reliefMap);
        
        marker.bindPopup(`
            <div class="map-popup">
                <h4>${zone.name}</h4>
                <p><strong>Severity:</strong> ${zone.severity.toUpperCase()}</p>
                <p><strong>Beneficiaries:</strong> ${zone.beneficiaries}</p>
                <p><strong>Distributed:</strong> ${zone.distributed.toLocaleString()} RUSD</p>
            </div>
        `);
        
        mapMarkers.push(marker);
    });
}

function addMerchantMarkers() {
    const merchantLocations = [
        { lat: 26.9, lng: 81.0, name: 'City Grocery Store', category: 'FOOD' },
        { lat: 19.1, lng: 72.9, name: 'Community Pharmacy', category: 'MEDICAL' },
        { lat: 13.1, lng: 80.3, name: 'Relief Housing Co', category: 'SHELTER' }
    ];
    
    const merchantIcon = L.divIcon({
        className: 'merchant-marker',
        html: '<i class="fas fa-store"></i>',
        iconSize: [30, 30]
    });
    
    merchantLocations.forEach(loc => {
        const marker = L.marker([loc.lat, loc.lng], { icon: merchantIcon }).addTo(reliefMap);
        marker.bindPopup(`
            <div class="map-popup">
                <h4>${loc.name}</h4>
                <p><strong>Category:</strong> ${loc.category}</p>
                <p>Approved Relief Merchant</p>
            </div>
        `);
        mapMarkers.push(marker);
    });
}

async function updateMapStats() {
    try {
        const beneficiaryCount = await fundManager.totalBeneficiaries();
        const merchantCount = await fundManager.totalMerchants();
        const totalSupply = await stablecoin.totalSupply();
        
        const mapBeneficiaries = document.getElementById('map-beneficiaries');
        const mapMerchants = document.getElementById('map-merchants');
        const mapDistributed = document.getElementById('map-distributed');
        
        if (mapBeneficiaries) mapBeneficiaries.textContent = beneficiaryCount.toString();
        if (mapMerchants) mapMerchants.textContent = merchantCount.toString();
        if (mapDistributed) mapDistributed.textContent = formatAmount(totalSupply);
    } catch (error) {
        console.error('Error updating map stats:', error);
    }
}

// ============================================
// DONOR PORTAL
// ============================================

let donationHistory = [];

function setDonationAmount(amount) {
    // Convert RUSD to approximate ETH (1 ETH = 1000 RUSD for demo)
    const ethAmount = (amount / 1000).toFixed(3);
    document.getElementById('donation-amount').value = ethAmount;
    
    // Highlight selected button
    document.querySelectorAll('.amount-btn').forEach(btn => btn.classList.remove('selected'));
    event.target.classList.add('selected');
}

async function makeDonation() {
    const amountInput = document.getElementById('donation-amount');
    const messageInput = document.getElementById('donation-message');
    
    const amount = parseFloat(amountInput.value);
    const message = messageInput.value.trim();
    
    if (!amount || amount <= 0) {
        showToast('Please enter a donation amount', 'error');
        return;
    }
    
    if (amount < 0.001) {
        showToast('Minimum donation is 0.001 ETH', 'error');
        return;
    }
    
    showProcessing('Processing donation...');
    
    try {
        // Send ETH donation to contract owner (admin)
        const owner = await stablecoin.owner();
        const tx = await signer.sendTransaction({
            to: owner,
            value: ethers.parseEther(amount.toString())
        });
        
        console.log('💝 Donation TX:', tx.hash);
        await tx.wait();
        
        // Record donation
        const donation = {
            from: currentAccount,
            amount: amount,
            message: message,
            timestamp: new Date().toISOString(),
            txHash: tx.hash
        };
        
        donationHistory.unshift(donation);
        saveDonationHistory();
        
        closeModal();
        showSuccess(`Thank you! Your donation of ${amount} ETH has been received!`);
        showConfetti();
        
        // Send alert
        sendEmergencyAlert('🎉 New Donation!', `${shortenAddress(currentAccount)} donated ${amount} ETH`, 'success');
        
        // Clear form
        amountInput.value = '';
        messageInput.value = '';
        
        // Update display
        updateDonorDisplay();
        
    } catch (error) {
        closeModal();
        console.error('Donation error:', error);
        showError('Donation failed: ' + (error.reason || error.message));
    }
}

function saveDonationHistory() {
    localStorage.setItem('reliefusd_donations', JSON.stringify(donationHistory));
}

function loadDonationHistory() {
    const stored = localStorage.getItem('reliefusd_donations');
    if (stored) {
        donationHistory = JSON.parse(stored);
    }
    updateDonorDisplay();
}

function updateDonorDisplay() {
    const donorsList = document.getElementById('donors-list');
    const totalDonations = document.getElementById('total-donations');
    const donorsCount = document.getElementById('donors-count');
    const helpedCount = document.getElementById('helped-count');
    
    if (donorsList && donationHistory.length > 0) {
        donorsList.innerHTML = donationHistory.slice(0, 10).map(d => `
            <div class="donor-item">
                <div class="donor-avatar"><i class="fas fa-heart"></i></div>
                <div class="donor-info">
                    <span class="donor-address">${shortenAddress(d.from)}</span>
                    <span class="donor-time">${formatTime(new Date(d.timestamp))}</span>
                </div>
                <div class="donor-amount">${d.amount} ETH</div>
            </div>
        `).join('');
    }
    
    // Calculate totals
    const total = donationHistory.reduce((sum, d) => sum + d.amount, 0);
    const uniqueDonors = new Set(donationHistory.map(d => d.from)).size;
    
    if (totalDonations) totalDonations.textContent = total.toFixed(3) + ' ETH';
    if (donorsCount) donorsCount.textContent = uniqueDonors.toString();
    if (helpedCount) helpedCount.textContent = (uniqueDonors * 5).toString(); // Estimate
}

// Initialize donations and notifications on load
document.addEventListener('DOMContentLoaded', () => {
    loadDonationHistory();
    // Request notification permission after a delay
    setTimeout(requestNotificationPermission, 3000);
});