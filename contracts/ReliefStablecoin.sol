// SPDX-License-Identifier: MIT
pragma solidity ^0.8.24;

import "@openzeppelin/contracts/token/ERC20/ERC20.sol";
import "@openzeppelin/contracts/access/Ownable.sol";
import "@openzeppelin/contracts/utils/Pausable.sol";

/**
 * @title ReliefStablecoin (ReliefUSD - RUSD)
 * @author EBIS 2.0 Team
 * @notice Custom ERC-20 stablecoin for transparent disaster relief fund distribution
 * @dev "Funds are programmable and restricted by purpose"
 * 
 * KEY FEATURES:
 * - Represents disaster relief funds (1 RUSD = 1 aid unit)
 * - Admin-controlled minting and burning
 * - Integrated with ReliefFundManager for spending controls
 * - Full audit trail via events
 * 
 * WHY BLOCKCHAIN?
 * - "Blockchain removes intermediaries"
 * - "Every transaction is publicly auditable"
 * - "This system reduces leakage and corruption"
 */
contract ReliefStablecoin is ERC20, Ownable, Pausable {
    
    // ============ State Variables ============
    
    /// @notice Address of the ReliefFundManager contract
    address public fundManager;
    
    // ============ Events ============
    
    /// @notice Emitted when tokens are minted to a beneficiary
    event TokensMinted(address indexed to, uint256 amount, uint256 timestamp);
    
    /// @notice Emitted when tokens are burned
    event TokensBurned(address indexed from, uint256 amount, uint256 timestamp);
    
    /// @notice Emitted when the fund manager is updated
    event FundManagerUpdated(address indexed oldManager, address indexed newManager);
    
    // ============ Errors ============
    
    error ZeroAddress();
    error ZeroAmount();
    error InsufficientBalance();
    error UnauthorizedTransfer();
    
    // ============ Constructor ============
    
    /**
     * @notice Deploys the ReliefUSD stablecoin
     * @dev Sets deployer as initial owner/admin
     * 
     * "Can be deployed instantly in emergencies"
     */
    constructor() ERC20("ReliefUSD", "RUSD") Ownable(msg.sender) {
        // Initial setup complete - ready for emergency deployment
    }
    
    // ============ Admin Functions ============
    
    /**
     * @notice Set the ReliefFundManager contract address
     * @param _fundManager Address of the fund manager contract
     * @dev Only owner can set this. Required for transfer restrictions.
     */
    function setFundManager(address _fundManager) external onlyOwner {
        if (_fundManager == address(0)) revert ZeroAddress();
        
        address oldManager = fundManager;
        fundManager = _fundManager;
        
        emit FundManagerUpdated(oldManager, _fundManager);
    }
    
    /**
     * @notice Mint relief tokens to a beneficiary
     * @param to Address of the beneficiary receiving funds
     * @param amount Amount of RUSD to mint (in wei, 18 decimals)
     * @dev Only admin can mint. "Funds are programmable and restricted by purpose"
     * 
     * Use Case: Admin allocates 1000 RUSD to verified flood victim
     */
    function mint(address to, uint256 amount) external onlyOwner whenNotPaused {
        if (to == address(0)) revert ZeroAddress();
        if (amount == 0) revert ZeroAmount();
        
        _mint(to, amount);
        
        emit TokensMinted(to, amount, block.timestamp);
    }
    
    /**
     * @notice Burn relief tokens from an address
     * @param from Address to burn tokens from
     * @param amount Amount of RUSD to burn
     * @dev Only admin can burn. Used for fund reconciliation.
     */
    function burn(address from, uint256 amount) external onlyOwner {
        if (from == address(0)) revert ZeroAddress();
        if (amount == 0) revert ZeroAmount();
        if (balanceOf(from) < amount) revert InsufficientBalance();
        
        _burn(from, amount);
        
        emit TokensBurned(from, amount, block.timestamp);
    }
    
    /**
     * @notice Pause all token transfers
     * @dev Emergency control for admin. Stops all fund movement.
     */
    function pause() external onlyOwner {
        _pause();
    }
    
    /**
     * @notice Unpause token transfers
     * @dev Resume normal operations after emergency
     */
    function unpause() external onlyOwner {
        _unpause();
    }
    
    // ============ Transfer Overrides ============
    
    /**
     * @notice Override transfer to enforce spending rules and record transactions
     * @dev Delegates validation to ReliefFundManager and records successful transfers
     * 
     * "This system reduces leakage and corruption" - transfers are controlled
     */
    function transfer(address to, uint256 amount) public override whenNotPaused returns (bool) {
        _validateTransfer(msg.sender, to, amount);
        bool success = super.transfer(to, amount);
        
        // Record the transfer in FundManager for audit trail
        if (success && fundManager != address(0)) {
            IReliefFundManager(fundManager).recordTransfer(msg.sender, to, amount);
        }
        
        return success;
    }
    
    /**
     * @notice Override transferFrom to enforce spending rules and record transactions
     * @dev Delegates validation to ReliefFundManager and records successful transfers
     */
    function transferFrom(address from, address to, uint256 amount) public override whenNotPaused returns (bool) {
        _validateTransfer(from, to, amount);
        bool success = super.transferFrom(from, to, amount);
        
        // Record the transfer in FundManager for audit trail
        if (success && fundManager != address(0)) {
            IReliefFundManager(fundManager).recordTransfer(from, to, amount);
        }
        
        return success;
    }
    
    // ============ Internal Functions ============
    
    /**
     * @notice Validate transfer against fund manager rules
     * @param from Sender address
     * @param to Recipient address
     * @param amount Transfer amount
     * @dev Calls fund manager to check if transfer is allowed
     */
    function _validateTransfer(address from, address to, uint256 amount) internal view {
        // Owner (admin) can transfer freely for fund distribution
        if (from == owner()) return;
        
        // If fund manager is set, validate through it
        if (fundManager != address(0)) {
            IReliefFundManager manager = IReliefFundManager(fundManager);
            if (!manager.isTransferAllowed(from, to, amount)) {
                revert UnauthorizedTransfer();
            }
        }
    }
}

/**
 * @title IReliefFundManager
 * @notice Interface for the ReliefFundManager contract
 */
interface IReliefFundManager {
    function isTransferAllowed(address from, address to, uint256 amount) external view returns (bool);
    function recordTransfer(address from, address to, uint256 amount) external;
}
