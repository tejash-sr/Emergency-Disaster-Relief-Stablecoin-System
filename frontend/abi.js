// Contract ABIs for frontend integration
// These are the essential functions needed for the frontend

const RELIEF_STABLECOIN_ABI = [
    // ERC-20 Standard
    "function name() view returns (string)",
    "function symbol() view returns (string)",
    "function decimals() view returns (uint8)",
    "function totalSupply() view returns (uint256)",
    "function balanceOf(address account) view returns (uint256)",
    "function transfer(address to, uint256 amount) returns (bool)",
    "function approve(address spender, uint256 amount) returns (bool)",
    "function allowance(address owner, address spender) view returns (uint256)",
    "function transferFrom(address from, address to, uint256 amount) returns (bool)",
    
    // Admin Functions
    "function owner() view returns (address)",
    "function mint(address to, uint256 amount)",
    "function burn(address from, uint256 amount)",
    "function pause()",
    "function unpause()",
    "function paused() view returns (bool)",
    "function setFundManager(address _fundManager)",
    "function fundManager() view returns (address)",
    
    // Events
    "event Transfer(address indexed from, address indexed to, uint256 value)",
    "event Approval(address indexed owner, address indexed spender, uint256 value)",
    "event TokensMinted(address indexed to, uint256 amount, uint256 timestamp)",
    "event TokensBurned(address indexed from, uint256 amount, uint256 timestamp)",
    "event Paused(address account)",
    "event Unpaused(address account)"
];

const RELIEF_FUND_MANAGER_ABI = [
    // Admin Functions
    "function owner() view returns (address)",
    "function addBeneficiary(address _beneficiary)",
    "function removeBeneficiary(address _beneficiary)",
    "function addMerchant(address _merchant, uint8 _category, string calldata _name)",
    "function removeMerchant(address _merchant)",
    "function pauseSystem()",
    "function unpauseSystem()",
    "function paused() view returns (bool)",
    "function recordDistribution(address beneficiary, uint256 amount)",
    "function recordTransfer(address from, address to, uint256 amount)",
    
    // View Functions
    "function isBeneficiary(address _address) view returns (bool)",
    "function isMerchant(address _address) view returns (bool)",
    "function isTransferAllowed(address from, address to, uint256 amount) view returns (bool)",
    "function totalBeneficiaries() view returns (uint256)",
    "function totalMerchants() view returns (uint256)",
    "function totalTransactions() view returns (uint256)",
    
    // Getters
    "function getMerchantDetails(address _merchant) view returns (bool isActive, uint8 category, string memory name, uint256 registeredAt)",
    "function getBeneficiaryDetails(address _beneficiary) view returns (bool isActive, uint256 registeredAt, uint256 totalReceived, uint256 totalSpent)",
    "function getTransactionCount() view returns (uint256)",
    "function getTransaction(uint256 index) view returns (tuple(address from, address to, uint256 amount, uint8 category, uint256 timestamp, bool success))",
    "function getAllBeneficiaries() view returns (address[])",
    "function getAllMerchants() view returns (address[])",
    "function getRecentTransactions(uint256 count) view returns (tuple(address from, address to, uint256 amount, uint8 category, uint256 timestamp, bool success)[])",
    "function getCategoryName(uint8 category) pure returns (string memory)",
    
    // Events
    "event BeneficiaryAdded(address indexed beneficiary, uint256 timestamp)",
    "event BeneficiaryRemoved(address indexed beneficiary, uint256 timestamp)",
    "event MerchantAdded(address indexed merchant, uint8 category, string name, uint256 timestamp)",
    "event MerchantRemoved(address indexed merchant, uint256 timestamp)",
    "event PaymentProcessed(address indexed from, address indexed to, uint256 amount, uint8 category, uint256 timestamp)",
    "event PaymentRejected(address indexed from, address indexed to, uint256 amount, string reason, uint256 timestamp)",
    "event FundsDistributed(address indexed beneficiary, uint256 amount, uint256 timestamp)"
];

// Category mapping for display
const CATEGORIES = {
    0: { name: "FOOD", icon: "🍎" },
    1: { name: "MEDICAL", icon: "💊" },
    2: { name: "SHELTER", icon: "🏠" },
    3: { name: "EDUCATION", icon: "📚" },
    4: { name: "UTILITIES", icon: "⚡" }
};

// Aliases for app.js compatibility
const STABLECOIN_ABI = RELIEF_STABLECOIN_ABI;
const FUND_MANAGER_ABI = RELIEF_FUND_MANAGER_ABI;
