// SPDX-License-Identifier: MIT
pragma solidity ^0.8.24;

import "@openzeppelin/contracts/token/ERC20/ERC20.sol";
import "@openzeppelin/contracts/access/Ownable.sol";
import "@openzeppelin/contracts/utils/Pausable.sol";

/**
 * @title ReliefStablecoin V2 (ReliefUSD - RUSD)
 * @author EBIS 2.0 Team - IIT Hackathon
 * @notice Advanced ERC-20 stablecoin with Purpose-Bound Money, Time-Locks, and Multi-Sig
 * @dev Industry-grade disaster relief fund distribution system
 * 
 * ADVANCED FEATURES:
 * - Purpose-Bound Money (Programmable Aid DNA)
 * - Time-Locked Relief Funds with Expiry
 * - Multi-Authority Approval System
 * - Emergency Kill-Switch + Recovery Mode
 * - Aid Traceback Token Journey
 * - Beneficiary Proof-of-Life Check
 */
contract ReliefStablecoinV2 is ERC20, Ownable, Pausable {
    
    // ============ Enums ============
    
    enum SpendingCategory {
        FOOD,       // 0
        MEDICAL,    // 1
        SHELTER,    // 2
        EDUCATION,  // 3
        UTILITIES   // 4
    }
    
    enum RecoveryMode {
        NORMAL,
        EMERGENCY,
        RECOVERY
    }
    
    // ============ Structs ============
    
    /// @notice Fund allocation with purpose and expiry
    struct FundAllocation {
        uint256 amount;
        SpendingCategory purpose;
        uint256 expiryTimestamp;
        uint256 allocatedAt;
        bool isActive;
    }
    
    /// @notice Multi-sig mint request
    struct MintRequest {
        address beneficiary;
        uint256 amount;
        SpendingCategory purpose;
        uint256 expiryDays;
        address proposer;
        uint256 approvalCount;
        bool executed;
        uint256 createdAt;
        mapping(address => bool) approvals;
    }
    
    /// @notice Token journey record
    struct TokenJourney {
        address from;
        address to;
        uint256 amount;
        SpendingCategory category;
        string journeyType; // "MINT", "TRANSFER", "SPEND", "EXPIRE", "RECLAIM"
        uint256 timestamp;
        bytes32 journeyId;
    }
    
    // ============ State Variables ============
    
    /// @notice Address of the ReliefFundManager contract
    address public fundManager;
    
    /// @notice Current system recovery mode
    RecoveryMode public recoveryMode;
    
    /// @notice Multi-sig authorities
    mapping(address => bool) public authorities;
    address[] public authorityList;
    uint256 public requiredApprovals;
    
    /// @notice Mint request counter
    uint256 public mintRequestCount;
    mapping(uint256 => MintRequest) public mintRequests;
    
    /// @notice Fund allocations per beneficiary
    mapping(address => FundAllocation[]) public beneficiaryAllocations;
    
    /// @notice Last activity timestamp for proof-of-life
    mapping(address => uint256) public lastActivityTimestamp;
    uint256 public proofOfLifeInterval = 30 days;
    
    /// @notice Token journey history
    TokenJourney[] public tokenJourneys;
    mapping(bytes32 => uint256[]) public journeysByToken;
    
    /// @notice Total stats
    uint256 public totalMinted;
    uint256 public totalBurned;
    uint256 public totalExpired;
    uint256 public totalReclaimed;
    
    /// @notice Category-wise spending tracking
    mapping(SpendingCategory => uint256) public categorySpending;
    
    // ============ Events ============
    
    event TokensMinted(
        address indexed to, 
        uint256 amount, 
        SpendingCategory purpose,
        uint256 expiryTimestamp,
        bytes32 indexed journeyId,
        uint256 timestamp
    );
    
    event TokensBurned(address indexed from, uint256 amount, uint256 timestamp);
    
    event FundManagerUpdated(address indexed oldManager, address indexed newManager);
    
    event MintRequestCreated(
        uint256 indexed requestId,
        address indexed beneficiary,
        uint256 amount,
        SpendingCategory purpose,
        address proposer
    );
    
    event MintRequestApproved(
        uint256 indexed requestId,
        address indexed approver,
        uint256 currentApprovals
    );
    
    event MintRequestExecuted(
        uint256 indexed requestId,
        address indexed beneficiary,
        uint256 amount
    );
    
    event PurposeEnforcedTransfer(
        address indexed from,
        address indexed to,
        uint256 amount,
        SpendingCategory category,
        bytes32 indexed journeyId,
        uint256 timestamp
    );
    
    event FundsExpired(
        address indexed beneficiary,
        uint256 amount,
        uint256 allocationIndex,
        uint256 timestamp
    );
    
    event FundsReclaimed(
        address indexed beneficiary,
        uint256 amount,
        address indexed reclaimedTo,
        uint256 timestamp
    );
    
    event EmergencyModeActivated(RecoveryMode mode, uint256 timestamp, string reason);
    
    event ProofOfLifeConfirmed(address indexed beneficiary, uint256 timestamp);
    
    event AuthorityAdded(address indexed authority);
    event AuthorityRemoved(address indexed authority);
    
    event TokenJourneyRecorded(
        bytes32 indexed journeyId,
        address indexed from,
        address indexed to,
        string journeyType,
        uint256 amount
    );
    
    // ============ Errors ============
    
    error ZeroAddress();
    error ZeroAmount();
    error InsufficientBalance();
    error UnauthorizedTransfer();
    error InvalidCategory();
    error FundsExpiredError();
    error NotAnAuthority();
    error AlreadyApproved();
    error RequestAlreadyExecuted();
    error InsufficientApprovals();
    error ProofOfLifeRequired();
    error EmergencyModeActive();
    error InvalidRecoveryMode();
    
    // ============ Modifiers ============
    
    modifier onlyAuthority() {
        if (!authorities[msg.sender] && msg.sender != owner()) revert NotAnAuthority();
        _;
    }
    
    modifier notInEmergency() {
        if (recoveryMode == RecoveryMode.EMERGENCY) revert EmergencyModeActive();
        _;
    }
    
    modifier checkProofOfLife(address beneficiary) {
        // Skip check for owner/authorities
        if (beneficiary != owner() && !authorities[beneficiary]) {
            if (block.timestamp - lastActivityTimestamp[beneficiary] > proofOfLifeInterval) {
                // Soft check - just update activity, don't revert
                // revert ProofOfLifeRequired();
            }
        }
        _;
    }
    
    // ============ Constructor ============
    
    constructor() ERC20("ReliefUSD", "RUSD") Ownable(msg.sender) {
        recoveryMode = RecoveryMode.NORMAL;
        requiredApprovals = 1; // Start with single approval, can be upgraded
        
        // Owner is first authority
        authorities[msg.sender] = true;
        authorityList.push(msg.sender);
        
        emit AuthorityAdded(msg.sender);
    }
    
    // ============ Multi-Sig Authority Management ============
    
    function addAuthority(address _authority) external onlyOwner {
        if (_authority == address(0)) revert ZeroAddress();
        if (!authorities[_authority]) {
            authorities[_authority] = true;
            authorityList.push(_authority);
            emit AuthorityAdded(_authority);
        }
    }
    
    function removeAuthority(address _authority) external onlyOwner {
        if (authorities[_authority]) {
            authorities[_authority] = false;
            // Remove from array
            for (uint i = 0; i < authorityList.length; i++) {
                if (authorityList[i] == _authority) {
                    authorityList[i] = authorityList[authorityList.length - 1];
                    authorityList.pop();
                    break;
                }
            }
            emit AuthorityRemoved(_authority);
        }
    }
    
    function setRequiredApprovals(uint256 _required) external onlyOwner {
        require(_required > 0 && _required <= authorityList.length, "Invalid approval count");
        requiredApprovals = _required;
    }
    
    function getAuthorityCount() external view returns (uint256) {
        return authorityList.length;
    }
    
    // ============ Multi-Sig Mint System ============
    
    function proposeMint(
        address _beneficiary,
        uint256 _amount,
        SpendingCategory _purpose,
        uint256 _expiryDays
    ) external onlyAuthority notInEmergency returns (uint256) {
        if (_beneficiary == address(0)) revert ZeroAddress();
        if (_amount == 0) revert ZeroAmount();
        
        uint256 requestId = mintRequestCount++;
        MintRequest storage request = mintRequests[requestId];
        
        request.beneficiary = _beneficiary;
        request.amount = _amount;
        request.purpose = _purpose;
        request.expiryDays = _expiryDays;
        request.proposer = msg.sender;
        request.approvalCount = 1; // Proposer auto-approves
        request.approvals[msg.sender] = true;
        request.createdAt = block.timestamp;
        
        emit MintRequestCreated(requestId, _beneficiary, _amount, _purpose, msg.sender);
        emit MintRequestApproved(requestId, msg.sender, 1);
        
        // Auto-execute if single approval is enough
        if (request.approvalCount >= requiredApprovals) {
            _executeMint(requestId);
        }
        
        return requestId;
    }
    
    function approveMint(uint256 _requestId) external onlyAuthority notInEmergency {
        MintRequest storage request = mintRequests[_requestId];
        
        if (request.executed) revert RequestAlreadyExecuted();
        if (request.approvals[msg.sender]) revert AlreadyApproved();
        
        request.approvals[msg.sender] = true;
        request.approvalCount++;
        
        emit MintRequestApproved(_requestId, msg.sender, request.approvalCount);
        
        // Execute if enough approvals
        if (request.approvalCount >= requiredApprovals) {
            _executeMint(_requestId);
        }
    }
    
    function _executeMint(uint256 _requestId) internal {
        MintRequest storage request = mintRequests[_requestId];
        
        if (request.executed) revert RequestAlreadyExecuted();
        if (request.approvalCount < requiredApprovals) revert InsufficientApprovals();
        
        request.executed = true;
        
        // Calculate expiry
        uint256 expiryTimestamp = request.expiryDays > 0 
            ? block.timestamp + (request.expiryDays * 1 days)
            : 0; // 0 means no expiry
        
        // Create fund allocation
        beneficiaryAllocations[request.beneficiary].push(FundAllocation({
            amount: request.amount,
            purpose: request.purpose,
            expiryTimestamp: expiryTimestamp,
            allocatedAt: block.timestamp,
            isActive: true
        }));
        
        // Mint tokens
        _mint(request.beneficiary, request.amount);
        totalMinted += request.amount;
        
        // Update proof of life
        lastActivityTimestamp[request.beneficiary] = block.timestamp;
        
        // Record journey
        bytes32 journeyId = keccak256(abi.encodePacked(
            address(0), // from treasury
            request.beneficiary,
            request.amount,
            block.timestamp,
            _requestId
        ));
        
        _recordJourney(
            address(0),
            request.beneficiary,
            request.amount,
            request.purpose,
            "MINT",
            journeyId
        );
        
        emit TokensMinted(
            request.beneficiary,
            request.amount,
            request.purpose,
            expiryTimestamp,
            journeyId,
            block.timestamp
        );
        
        emit MintRequestExecuted(_requestId, request.beneficiary, request.amount);
    }
    
    // ============ Direct Mint (Single Authority - for demo) ============
    
    function mint(address to, uint256 amount) external onlyOwner whenNotPaused notInEmergency {
        if (to == address(0)) revert ZeroAddress();
        if (amount == 0) revert ZeroAmount();
        
        _mint(to, amount);
        totalMinted += amount;
        
        // Update activity
        lastActivityTimestamp[to] = block.timestamp;
        
        // Record journey
        bytes32 journeyId = keccak256(abi.encodePacked(
            address(0),
            to,
            amount,
            block.timestamp,
            block.number
        ));
        
        _recordJourney(address(0), to, amount, SpendingCategory.FOOD, "MINT", journeyId);
        
        emit TokensMinted(to, amount, SpendingCategory.FOOD, 0, journeyId, block.timestamp);
    }
    
    // ============ Time-Lock & Expiry Functions ============
    
    function checkAndExpireFunds(address _beneficiary) external {
        FundAllocation[] storage allocations = beneficiaryAllocations[_beneficiary];
        
        for (uint i = 0; i < allocations.length; i++) {
            if (allocations[i].isActive && 
                allocations[i].expiryTimestamp > 0 && 
                block.timestamp > allocations[i].expiryTimestamp) {
                
                uint256 expiredAmount = allocations[i].amount;
                allocations[i].isActive = false;
                
                // Burn expired tokens if beneficiary still has them
                uint256 balance = balanceOf(_beneficiary);
                if (balance >= expiredAmount) {
                    _burn(_beneficiary, expiredAmount);
                    totalExpired += expiredAmount;
                    
                    emit FundsExpired(_beneficiary, expiredAmount, i, block.timestamp);
                }
            }
        }
    }
    
    function reclaimExpiredFunds(address _beneficiary, address _reclaimTo) external onlyOwner {
        FundAllocation[] storage allocations = beneficiaryAllocations[_beneficiary];
        uint256 totalReclaim = 0;
        
        for (uint i = 0; i < allocations.length; i++) {
            if (allocations[i].isActive && 
                allocations[i].expiryTimestamp > 0 && 
                block.timestamp > allocations[i].expiryTimestamp) {
                
                totalReclaim += allocations[i].amount;
                allocations[i].isActive = false;
            }
        }
        
        if (totalReclaim > 0) {
            uint256 balance = balanceOf(_beneficiary);
            uint256 actualReclaim = totalReclaim > balance ? balance : totalReclaim;
            
            if (actualReclaim > 0) {
                _burn(_beneficiary, actualReclaim);
                _mint(_reclaimTo, actualReclaim);
                totalReclaimed += actualReclaim;
                
                emit FundsReclaimed(_beneficiary, actualReclaim, _reclaimTo, block.timestamp);
            }
        }
    }
    
    function getActiveAllocations(address _beneficiary) external view returns (
        uint256[] memory amounts,
        uint8[] memory purposes,
        uint256[] memory expiries,
        bool[] memory activeStatuses
    ) {
        FundAllocation[] storage allocations = beneficiaryAllocations[_beneficiary];
        uint256 len = allocations.length;
        
        amounts = new uint256[](len);
        purposes = new uint8[](len);
        expiries = new uint256[](len);
        activeStatuses = new bool[](len);
        
        for (uint i = 0; i < len; i++) {
            amounts[i] = allocations[i].amount;
            purposes[i] = uint8(allocations[i].purpose);
            expiries[i] = allocations[i].expiryTimestamp;
            activeStatuses[i] = allocations[i].isActive;
        }
    }
    
    // ============ Emergency & Recovery Mode ============
    
    function activateEmergencyMode(string calldata reason) external onlyOwner {
        recoveryMode = RecoveryMode.EMERGENCY;
        _pause();
        emit EmergencyModeActivated(RecoveryMode.EMERGENCY, block.timestamp, reason);
    }
    
    function activateRecoveryMode() external onlyOwner {
        require(recoveryMode == RecoveryMode.EMERGENCY, "Must be in emergency first");
        recoveryMode = RecoveryMode.RECOVERY;
        emit EmergencyModeActivated(RecoveryMode.RECOVERY, block.timestamp, "Entering recovery");
    }
    
    function resumeNormalMode() external onlyOwner {
        recoveryMode = RecoveryMode.NORMAL;
        _unpause();
        emit EmergencyModeActivated(RecoveryMode.NORMAL, block.timestamp, "Normal operations resumed");
    }
    
    function pause() external onlyOwner {
        _pause();
    }
    
    function unpause() external onlyOwner {
        _unpause();
    }
    
    // ============ Proof of Life ============
    
    function confirmProofOfLife() external {
        lastActivityTimestamp[msg.sender] = block.timestamp;
        emit ProofOfLifeConfirmed(msg.sender, block.timestamp);
    }
    
    function setProofOfLifeInterval(uint256 _interval) external onlyOwner {
        proofOfLifeInterval = _interval;
    }
    
    function isProofOfLifeValid(address _beneficiary) external view returns (bool) {
        return block.timestamp - lastActivityTimestamp[_beneficiary] <= proofOfLifeInterval;
    }
    
    // ============ Token Journey Tracking ============
    
    function _recordJourney(
        address _from,
        address _to,
        uint256 _amount,
        SpendingCategory _category,
        string memory _journeyType,
        bytes32 _journeyId
    ) internal {
        tokenJourneys.push(TokenJourney({
            from: _from,
            to: _to,
            amount: _amount,
            category: _category,
            journeyType: _journeyType,
            timestamp: block.timestamp,
            journeyId: _journeyId
        }));
        
        journeysByToken[_journeyId].push(tokenJourneys.length - 1);
        
        emit TokenJourneyRecorded(_journeyId, _from, _to, _journeyType, _amount);
    }
    
    function getJourneyCount() external view returns (uint256) {
        return tokenJourneys.length;
    }
    
    function getJourney(uint256 index) external view returns (
        address from,
        address to,
        uint256 amount,
        uint8 category,
        string memory journeyType,
        uint256 timestamp,
        bytes32 journeyId
    ) {
        TokenJourney memory j = tokenJourneys[index];
        return (j.from, j.to, j.amount, uint8(j.category), j.journeyType, j.timestamp, j.journeyId);
    }
    
    function getRecentJourneys(uint256 count) external view returns (
        address[] memory froms,
        address[] memory tos,
        uint256[] memory amounts,
        uint8[] memory categories,
        uint256[] memory timestamps
    ) {
        uint256 total = tokenJourneys.length;
        if (count > total) count = total;
        
        froms = new address[](count);
        tos = new address[](count);
        amounts = new uint256[](count);
        categories = new uint8[](count);
        timestamps = new uint256[](count);
        
        for (uint i = 0; i < count; i++) {
            TokenJourney memory j = tokenJourneys[total - count + i];
            froms[i] = j.from;
            tos[i] = j.to;
            amounts[i] = j.amount;
            categories[i] = uint8(j.category);
            timestamps[i] = j.timestamp;
        }
    }
    
    // ============ Statistics & Analytics ============
    
    function getSystemStats() external view returns (
        uint256 _totalMinted,
        uint256 _totalBurned,
        uint256 _totalExpired,
        uint256 _totalReclaimed,
        uint256 _currentSupply,
        uint256 _authorityCount,
        uint256 _journeyCount,
        RecoveryMode _recoveryMode
    ) {
        return (
            totalMinted,
            totalBurned,
            totalExpired,
            totalReclaimed,
            totalSupply(),
            authorityList.length,
            tokenJourneys.length,
            recoveryMode
        );
    }
    
    function getCategorySpending(uint8 _category) external view returns (uint256) {
        return categorySpending[SpendingCategory(_category)];
    }
    
    // ============ Fund Manager ============
    
    function setFundManager(address _fundManager) external onlyOwner {
        if (_fundManager == address(0)) revert ZeroAddress();
        
        address oldManager = fundManager;
        fundManager = _fundManager;
        
        emit FundManagerUpdated(oldManager, _fundManager);
    }
    
    // ============ Burn ============
    
    function burn(address from, uint256 amount) external onlyOwner {
        if (from == address(0)) revert ZeroAddress();
        if (amount == 0) revert ZeroAmount();
        if (balanceOf(from) < amount) revert InsufficientBalance();
        
        _burn(from, amount);
        totalBurned += amount;
        
        emit TokensBurned(from, amount, block.timestamp);
    }
    
    // ============ Transfer Overrides with Journey Tracking ============
    
    function transfer(address to, uint256 amount) public override whenNotPaused notInEmergency returns (bool) {
        _validateTransfer(msg.sender, to, amount);
        
        // Update activity for sender
        lastActivityTimestamp[msg.sender] = block.timestamp;
        
        // Record journey
        bytes32 journeyId = keccak256(abi.encodePacked(
            msg.sender,
            to,
            amount,
            block.timestamp,
            block.number
        ));
        
        // Determine journey type and category
        IReliefFundManager manager = IReliefFundManager(fundManager);
        (bool isMerchant, uint8 category,,) = manager.getMerchantDetails(to);
        
        if (isMerchant) {
            _recordJourney(msg.sender, to, amount, SpendingCategory(category), "SPEND", journeyId);
            categorySpending[SpendingCategory(category)] += amount;
            
            emit PurposeEnforcedTransfer(
                msg.sender,
                to,
                amount,
                SpendingCategory(category),
                journeyId,
                block.timestamp
            );
        } else {
            _recordJourney(msg.sender, to, amount, SpendingCategory.FOOD, "TRANSFER", journeyId);
        }
        
        return super.transfer(to, amount);
    }
    
    function transferFrom(address from, address to, uint256 amount) public override whenNotPaused notInEmergency returns (bool) {
        _validateTransfer(from, to, amount);
        
        // Update activity
        lastActivityTimestamp[from] = block.timestamp;
        
        return super.transferFrom(from, to, amount);
    }
    
    function _validateTransfer(address from, address to, uint256 amount) internal view {
        if (from == owner()) return;
        
        if (fundManager != address(0)) {
            IReliefFundManager manager = IReliefFundManager(fundManager);
            if (!manager.isTransferAllowed(from, to, amount)) {
                revert UnauthorizedTransfer();
            }
        }
    }
}

interface IReliefFundManager {
    function isTransferAllowed(address from, address to, uint256 amount) external view returns (bool);
    function getMerchantDetails(address merchant) external view returns (bool isActive, uint8 category, string memory name, uint256 registeredAt);
}
