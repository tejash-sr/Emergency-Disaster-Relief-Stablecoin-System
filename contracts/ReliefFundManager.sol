// SPDX-License-Identifier: MIT
pragma solidity ^0.8.24;

import "@openzeppelin/contracts/access/Ownable.sol";
import "@openzeppelin/contracts/utils/Pausable.sol";

/**
 * @title ReliefFundManager
 * @author EBIS 2.0 Team
 * @notice Core contract for managing disaster relief fund distribution
 * @dev Implements beneficiary whitelisting, merchant management, and category-based spending controls
 * 
 * CORE VALUE PROPOSITION:
 * - "Funds are programmable and restricted by purpose"
 * - "Blockchain removes intermediaries"
 * - "Every transaction is publicly auditable"
 * - "This system reduces leakage and corruption"
 * - "Can be deployed instantly in emergencies"
 * 
 * HOW IT WORKS:
 * 1. Admin whitelists verified disaster victims (beneficiaries)
 * 2. Admin whitelists approved vendors (merchants) with spending categories
 * 3. Beneficiaries can ONLY spend funds at approved merchants
 * 4. All transactions are logged on-chain for full transparency
 */
contract ReliefFundManager is Ownable, Pausable {
    
    // ============ Enums ============
    
    /**
     * @notice Spending categories for relief funds
     * @dev Each merchant is assigned ONE category they can accept payments for
     * 
     * FOOD     - Grocery stores, food suppliers
     * MEDICAL  - Pharmacies, hospitals, clinics
     * SHELTER  - Hotels, temporary housing, construction
     * EDUCATION - Schools, educational supplies
     * UTILITIES - Electricity, water, gas providers
     */
    enum SpendingCategory {
        FOOD,       // 0
        MEDICAL,    // 1
        SHELTER,    // 2
        EDUCATION,  // 3
        UTILITIES   // 4
    }
    
    // ============ Structs ============
    
    /**
     * @notice Merchant information structure
     * @param isActive Whether the merchant is currently approved
     * @param category The spending category this merchant accepts
     * @param name Human-readable merchant name (for frontend display)
     * @param registeredAt Timestamp when merchant was registered
     */
    struct Merchant {
        bool isActive;
        SpendingCategory category;
        string name;
        uint256 registeredAt;
    }
    
    /**
     * @notice Beneficiary information structure
     * @param isActive Whether the beneficiary is currently approved
     * @param registeredAt Timestamp when beneficiary was registered
     * @param totalReceived Total RUSD received by this beneficiary
     * @param totalSpent Total RUSD spent by this beneficiary
     */
    struct Beneficiary {
        bool isActive;
        uint256 registeredAt;
        uint256 totalReceived;
        uint256 totalSpent;
    }
    
    /**
     * @notice Transaction record for audit trail
     * @param from Sender (beneficiary) address
     * @param to Recipient (merchant) address
     * @param amount Amount transferred
     * @param category Spending category
     * @param timestamp Block timestamp
     * @param success Whether transaction was successful
     */
    struct TransactionRecord {
        address from;
        address to;
        uint256 amount;
        SpendingCategory category;
        uint256 timestamp;
        bool success;
    }
    
    // ============ State Variables ============
    
    /// @notice Address of the ReliefStablecoin contract
    address public stablecoin;
    
    /// @notice Mapping of beneficiary addresses to their data
    mapping(address => Beneficiary) public beneficiaries;
    
    /// @notice Mapping of merchant addresses to their data
    mapping(address => Merchant) public merchants;
    
    /// @notice Array of all beneficiary addresses (for enumeration)
    address[] public beneficiaryList;
    
    /// @notice Array of all merchant addresses (for enumeration)
    address[] public merchantList;
    
    /// @notice Array of all transaction records (audit trail)
    TransactionRecord[] public transactionHistory;
    
    /// @notice Total beneficiaries registered
    uint256 public totalBeneficiaries;
    
    /// @notice Total merchants registered
    uint256 public totalMerchants;
    
    /// @notice Total successful transactions
    uint256 public totalTransactions;
    
    // ============ Events ============
    
    /// @notice Emitted when a beneficiary is added
    event BeneficiaryAdded(
        address indexed beneficiary,
        uint256 timestamp
    );
    
    /// @notice Emitted when a beneficiary is removed
    event BeneficiaryRemoved(
        address indexed beneficiary,
        uint256 timestamp
    );
    
    /// @notice Emitted when a merchant is added
    event MerchantAdded(
        address indexed merchant,
        SpendingCategory category,
        string name,
        uint256 timestamp
    );
    
    /// @notice Emitted when a merchant is removed
    event MerchantRemoved(
        address indexed merchant,
        uint256 timestamp
    );
    
    /// @notice Emitted when a payment is successfully processed
    event PaymentProcessed(
        address indexed from,
        address indexed to,
        uint256 amount,
        SpendingCategory category,
        uint256 timestamp
    );
    
    /// @notice Emitted when a payment is rejected
    event PaymentRejected(
        address indexed from,
        address indexed to,
        uint256 amount,
        string reason,
        uint256 timestamp
    );
    
    /// @notice Emitted when funds are distributed to a beneficiary
    event FundsDistributed(
        address indexed beneficiary,
        uint256 amount,
        uint256 timestamp
    );
    
    // ============ Errors ============
    
    error ZeroAddress();
    error BeneficiaryAlreadyExists();
    error BeneficiaryNotFound();
    error MerchantAlreadyExists();
    error MerchantNotFound();
    error NotABeneficiary();
    error NotAMerchant();
    error MerchantNotActive();
    error UnauthorizedSpending();
    error InvalidCategory();
    error OnlyStablecoin();
    
    // ============ Modifiers ============
    
    modifier onlyStablecoin() {
        if (msg.sender != stablecoin) revert OnlyStablecoin();
        _;
    }
    
    // ============ Constructor ============
    
    /**
     * @notice Deploy the ReliefFundManager
     * @dev Sets deployer as admin (owner)
     * 
     * "Can be deployed instantly in emergencies"
     */
    constructor() Ownable(msg.sender) {
        // Ready for immediate emergency deployment
    }
    
    // ============ Admin Setup Functions ============
    
    /**
     * @notice Set the ReliefStablecoin contract address
     * @param _stablecoin Address of the stablecoin contract
     * @dev Only owner can set. Required for recordTransfer to work.
     */
    function setStablecoin(address _stablecoin) external onlyOwner {
        if (_stablecoin == address(0)) revert ZeroAddress();
        stablecoin = _stablecoin;
    }
    
    // ============ Admin Functions: Beneficiary Management ============
    
    /**
     * @notice Add a verified beneficiary to the system
     * @param _beneficiary Address of the disaster victim
     * @dev Only admin can add beneficiaries after verification
     * 
     * Real-world flow:
     * 1. Relief agency verifies victim identity
     * 2. Admin adds verified victim to whitelist
     * 3. Victim can now receive and spend relief funds
     */
    function addBeneficiary(address _beneficiary) external onlyOwner whenNotPaused {
        if (_beneficiary == address(0)) revert ZeroAddress();
        if (beneficiaries[_beneficiary].registeredAt != 0) revert BeneficiaryAlreadyExists();
        
        beneficiaries[_beneficiary] = Beneficiary({
            isActive: true,
            registeredAt: block.timestamp,
            totalReceived: 0,
            totalSpent: 0
        });
        
        beneficiaryList.push(_beneficiary);
        totalBeneficiaries++;
        
        emit BeneficiaryAdded(_beneficiary, block.timestamp);
    }
    
    /**
     * @notice Remove a beneficiary from the system
     * @param _beneficiary Address to remove
     * @dev Soft delete - marks as inactive, preserves history
     */
    function removeBeneficiary(address _beneficiary) external onlyOwner {
        if (_beneficiary == address(0)) revert ZeroAddress();
        if (!beneficiaries[_beneficiary].isActive) revert BeneficiaryNotFound();
        
        beneficiaries[_beneficiary].isActive = false;
        totalBeneficiaries--;
        
        emit BeneficiaryRemoved(_beneficiary, block.timestamp);
    }
    
    // ============ Admin Functions: Merchant Management ============
    
    /**
     * @notice Add an approved merchant to the system
     * @param _merchant Address of the vendor
     * @param _category Spending category this merchant accepts
     * @param _name Human-readable name for display
     * @dev Only admin can add merchants after verification
     * 
     * Example:
     * addMerchant(0x123..., SpendingCategory.FOOD, "City Grocery Store")
     */
    function addMerchant(
        address _merchant,
        SpendingCategory _category,
        string calldata _name
    ) external onlyOwner whenNotPaused {
        if (_merchant == address(0)) revert ZeroAddress();
        if (merchants[_merchant].registeredAt != 0) revert MerchantAlreadyExists();
        
        merchants[_merchant] = Merchant({
            isActive: true,
            category: _category,
            name: _name,
            registeredAt: block.timestamp
        });
        
        merchantList.push(_merchant);
        totalMerchants++;
        
        emit MerchantAdded(_merchant, _category, _name, block.timestamp);
    }
    
    /**
     * @notice Remove a merchant from the system
     * @param _merchant Address to remove
     * @dev Soft delete - marks as inactive
     */
    function removeMerchant(address _merchant) external onlyOwner {
        if (_merchant == address(0)) revert ZeroAddress();
        if (!merchants[_merchant].isActive) revert MerchantNotFound();
        
        merchants[_merchant].isActive = false;
        totalMerchants--;
        
        emit MerchantRemoved(_merchant, block.timestamp);
    }
    
    // ============ Core Transfer Validation ============
    
    /**
     * @notice Check if a transfer is allowed
     * @param from Sender address
     * @param to Recipient address
     * @return bool Whether the transfer should be allowed
     * @dev Called by ReliefStablecoin during transfers
     * 
     * SPENDING RULES:
     * ✅ Beneficiary → Active Merchant (allowed)
     * ❌ Beneficiary → Random Wallet (blocked)
     * ❌ Beneficiary → Inactive Merchant (blocked)
     * ✅ Non-beneficiary transfers (allowed - for admin distribution)
     * 
     * "Funds are programmable and restricted by purpose"
     */
    function isTransferAllowed(
        address from,
        address to,
        uint256 /* amount */
    ) external view returns (bool) {
        // If sender is not a beneficiary, allow (admin transfers)
        if (!beneficiaries[from].isActive) {
            return true;
        }
        
        // Beneficiary can only send to active merchants
        if (!merchants[to].isActive) {
            return false;
        }
        
        return true;
    }
    
    /**
     * @notice Record a successful transfer for audit trail
     * @param from Sender address
     * @param to Recipient address
     * @param amount Amount transferred
     * @dev Called by ReliefStablecoin after successful transfer
     */
    function recordTransfer(
        address from,
        address to,
        uint256 amount
    ) external onlyStablecoin {
        if (beneficiaries[from].isActive && merchants[to].isActive) {
            // Update beneficiary stats
            beneficiaries[from].totalSpent += amount;
            
            // Record transaction
            transactionHistory.push(TransactionRecord({
                from: from,
                to: to,
                amount: amount,
                category: merchants[to].category,
                timestamp: block.timestamp,
                success: true
            }));
            
            totalTransactions++;
            
            emit PaymentProcessed(
                from,
                to,
                amount,
                merchants[to].category,
                block.timestamp
            );
        }
    }
    
    /**
     * @notice Record funds distributed to a beneficiary
     * @param beneficiary Address receiving funds
     * @param amount Amount distributed
     * @dev Call this when admin mints tokens to beneficiary
     */
    function recordDistribution(address beneficiary, uint256 amount) external onlyOwner {
        if (beneficiaries[beneficiary].isActive) {
            beneficiaries[beneficiary].totalReceived += amount;
            
            emit FundsDistributed(beneficiary, amount, block.timestamp);
        }
    }
    
    // ============ Emergency Controls ============
    
    /**
     * @notice Pause the system
     * @dev Emergency stop - blocks new registrations
     */
    function pauseSystem() external onlyOwner {
        _pause();
    }
    
    /**
     * @notice Unpause the system
     * @dev Resume normal operations
     */
    function unpauseSystem() external onlyOwner {
        _unpause();
    }
    
    // ============ View Functions ============
    
    /**
     * @notice Check if an address is a whitelisted beneficiary
     * @param _address Address to check
     * @return bool True if active beneficiary
     */
    function isBeneficiary(address _address) external view returns (bool) {
        return beneficiaries[_address].isActive;
    }
    
    /**
     * @notice Check if an address is a whitelisted merchant
     * @param _address Address to check
     * @return bool True if active merchant
     */
    function isMerchant(address _address) external view returns (bool) {
        return merchants[_address].isActive;
    }
    
    /**
     * @notice Get merchant details
     * @param _merchant Merchant address
     * @return isActive Whether merchant is active
     * @return category Spending category
     * @return name Merchant name
     * @return registeredAt Registration timestamp
     */
    function getMerchantDetails(address _merchant) external view returns (
        bool isActive,
        SpendingCategory category,
        string memory name,
        uint256 registeredAt
    ) {
        Merchant memory m = merchants[_merchant];
        return (m.isActive, m.category, m.name, m.registeredAt);
    }
    
    /**
     * @notice Get beneficiary details
     * @param _beneficiary Beneficiary address
     * @return isActive Whether beneficiary is active
     * @return registeredAt Registration timestamp
     * @return totalReceived Total funds received
     * @return totalSpent Total funds spent
     */
    function getBeneficiaryDetails(address _beneficiary) external view returns (
        bool isActive,
        uint256 registeredAt,
        uint256 totalReceived,
        uint256 totalSpent
    ) {
        Beneficiary memory b = beneficiaries[_beneficiary];
        return (b.isActive, b.registeredAt, b.totalReceived, b.totalSpent);
    }
    
    /**
     * @notice Get total transaction count
     * @return uint256 Number of recorded transactions
     */
    function getTransactionCount() external view returns (uint256) {
        return transactionHistory.length;
    }
    
    /**
     * @notice Get transaction by index
     * @param index Transaction index
     * @return TransactionRecord The transaction details
     */
    function getTransaction(uint256 index) external view returns (TransactionRecord memory) {
        require(index < transactionHistory.length, "Index out of bounds");
        return transactionHistory[index];
    }
    
    /**
     * @notice Get all beneficiary addresses
     * @return address[] Array of beneficiary addresses
     */
    function getAllBeneficiaries() external view returns (address[] memory) {
        return beneficiaryList;
    }
    
    /**
     * @notice Get all merchant addresses
     * @return address[] Array of merchant addresses
     */
    function getAllMerchants() external view returns (address[] memory) {
        return merchantList;
    }
    
    /**
     * @notice Get recent transactions (last N)
     * @param count Number of recent transactions to return
     * @return TransactionRecord[] Array of recent transactions
     */
    function getRecentTransactions(uint256 count) external view returns (TransactionRecord[] memory) {
        uint256 total = transactionHistory.length;
        if (count > total) count = total;
        
        TransactionRecord[] memory recent = new TransactionRecord[](count);
        for (uint256 i = 0; i < count; i++) {
            recent[i] = transactionHistory[total - count + i];
        }
        
        return recent;
    }
    
    /**
     * @notice Get category name as string
     * @param category Category enum value
     * @return string Human-readable category name
     */
    function getCategoryName(SpendingCategory category) external pure returns (string memory) {
        if (category == SpendingCategory.FOOD) return "FOOD";
        if (category == SpendingCategory.MEDICAL) return "MEDICAL";
        if (category == SpendingCategory.SHELTER) return "SHELTER";
        if (category == SpendingCategory.EDUCATION) return "EDUCATION";
        if (category == SpendingCategory.UTILITIES) return "UTILITIES";
        return "UNKNOWN";
    }
}
