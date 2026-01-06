# 🏥 Disaster Relief Stablecoin System

### IIT EBIS 2.0 Hackathon | Bybit – Real World Assets & DeFi Track

> **"Funds are programmable and restricted by purpose"**

A transparent, permissioned blockchain system for disaster relief fund distribution that eliminates corruption, enables instant aid delivery, and provides full public auditability.

---

## 🎯 Problem Statement

Traditional disaster relief funding systems suffer from:

| Problem | Impact |
|---------|--------|
| 🐌 **Delays** | Funds take weeks to reach victims due to intermediaries |
| 💸 **Leakage** | 20-40% of funds lost to corruption and mismanagement |
| 🔒 **Opacity** | Donors can't track how their money is used |
| ❌ **No Enforcement** | No control over how aid money is spent |

---

## ✨ Solution

A **stablecoin-based, permissioned relief fund system** where:

- ✅ Only **verified beneficiaries** receive funds
- ✅ Funds can only be spent on **approved categories** (Food, Medical, Shelter, etc.)
- ✅ Every transaction is **permanently auditable** on-chain
- ✅ Instant fund distribution with **no intermediaries**

### Key Value Propositions

```
"Blockchain removes intermediaries"
"Every transaction is publicly auditable"
"This system reduces leakage and corruption"
"Can be deployed instantly in emergencies"
```

---

## 🏗️ Architecture

```
┌─────────────────────────────────────────────────────────────────┐
│                     DISASTER RELIEF SYSTEM                       │
├─────────────────────────────────────────────────────────────────┤
│                                                                  │
│   ┌─────────────────┐         ┌─────────────────────────────┐   │
│   │  ReliefUSD      │         │    ReliefFundManager        │   │
│   │  (RUSD Token)   │◄───────►│                             │   │
│   │                 │         │  • Beneficiary Whitelist    │   │
│   │  • ERC-20       │         │  • Merchant Whitelist       │   │
│   │  • Mint/Burn    │         │  • Category Controls        │   │
│   │  • Pausable     │         │  • Audit Trail              │   │
│   └─────────────────┘         └─────────────────────────────┘   │
│            │                               │                     │
│            ▼                               ▼                     │
│   ┌─────────────────────────────────────────────────────────┐   │
│   │                    SPENDING RULES                        │   │
│   │                                                          │   │
│   │   ✅ Beneficiary → Active Merchant     ALLOWED           │   │
│   │   ❌ Beneficiary → Random Wallet       BLOCKED           │   │
│   │   ❌ Beneficiary → Inactive Merchant   BLOCKED           │   │
│   │   ✅ Admin → Anyone                    ALLOWED           │   │
│   └─────────────────────────────────────────────────────────┘   │
│                                                                  │
└─────────────────────────────────────────────────────────────────┘
```

### Spending Categories

| Category | Icon | Use Case |
|----------|------|----------|
| FOOD | 🍎 | Grocery stores, food suppliers |
| MEDICAL | 💊 | Pharmacies, hospitals, clinics |
| SHELTER | 🏠 | Hotels, temporary housing |
| EDUCATION | 📚 | Schools, educational supplies |
| UTILITIES | ⚡ | Electricity, water, gas |

---

## 📁 Project Structure

```
disaster-relief-system/
├── contracts/
│   ├── ReliefStablecoin.sol    # ERC-20 token (ReliefUSD)
│   └── ReliefFundManager.sol   # Admin & spending controls
├── scripts/
│   └── deploy.js               # Deployment script
├── test/
│   └── ReliefSystem.test.js    # Comprehensive test suite
├── frontend/
│   ├── index.html              # Main dashboard
│   ├── styles.css              # Styling
│   ├── app.js                  # Frontend logic
│   ├── abi.js                  # Contract ABIs
│   └── config.js               # Deployment config
├── hardhat.config.js           # Hardhat configuration
├── package.json                # Dependencies
└── README.md                   # This file
```

---

## 🚀 Quick Start

### Prerequisites

- Node.js v18+
- MetaMask browser extension
- Git

### Installation

```bash
# Clone and enter project
cd disaster-relief-system

# Install dependencies
npm install

# Compile contracts
npm run compile
```

### Run Tests

```bash
npm run test
```

Expected output:
```
  Disaster Relief Stablecoin System
    ReliefStablecoin - Basic Functionality
      ✓ Should have correct name and symbol
      ✓ Should mint tokens to beneficiary
      ✓ Should block transfers to non-merchants
    ...
    Full Demo Flow
      ✓ Should complete full demo scenario
```

### Local Deployment

**Terminal 1 - Start Local Blockchain:**
```bash
npm run node
```

**Terminal 2 - Deploy Contracts:**
```bash
npm run deploy:local
```

### Start Frontend

```bash
npm run frontend
```

Open `http://localhost:3000` in your browser.

---

## 🎬 Demo Flow (3-Minute Judge Demo)

### Setup (30 seconds)
1. Start local node: `npm run node`
2. Deploy contracts: `npm run deploy:local`
3. Start frontend: `npm run frontend`
4. Open browser and connect MetaMask

### Demo Script (2.5 minutes)

#### Step 1: Admin View
- Connect MetaMask (Admin wallet - Account #0)
- Show the Admin Dashboard with stats
- **"This is the relief agency control panel"**

#### Step 2: Whitelist Beneficiary
- Add a beneficiary (Account #1 address)
- **"We verify disaster victims before adding them"**

#### Step 3: Whitelist Merchant
- Add a FOOD merchant (Account #2 address, name: "City Grocery")
- **"Only approved vendors can accept relief funds"**

#### Step 4: Mint Relief Tokens
- Mint 1000 RUSD to the beneficiary
- **"Funds are instantly distributed - no intermediaries"**

#### Step 5: Switch to Beneficiary
- Switch MetaMask to Account #1
- Refresh page, go to Beneficiary tab
- **"The victim sees their balance and can only spend at approved merchants"**

#### Step 6: Make Valid Purchase ✅
- Select "City Grocery" merchant
- Transfer 200 RUSD
- **"Transaction succeeds - funds used for intended purpose"**

#### Step 7: Attempt Invalid Transfer ❌
- Try to send to a random address (or use console)
- **"Transaction BLOCKED - funds cannot be sent to unauthorized recipients"**

#### Step 8: Show Transparency
- Go to Transparency tab
- **"Every transaction is publicly auditable on the blockchain"**
- Show contract addresses for verification

### Key Talking Points

> **"Funds are programmable and restricted by purpose"**
> - Unlike cash, RUSD tokens can only be spent on approved categories

> **"Blockchain removes intermediaries"**
> - Direct transfer from agency to victim to merchant

> **"Every transaction is publicly auditable"**
> - Anyone can verify the transaction history

> **"This system reduces leakage and corruption"**
> - No way to divert funds to unauthorized recipients

> **"Can be deployed instantly in emergencies"**
> - Smart contracts deploy in minutes

---

## 🌐 Sepolia Testnet Deployment

### Configure Environment

Create `.env` file:
```env
SEPOLIA_RPC_URL=https://rpc.sepolia.org
PRIVATE_KEY=your_private_key_here
ETHERSCAN_API_KEY=your_etherscan_api_key
```

### Deploy

```bash
npm run deploy:sepolia
```

### Verify Contracts

```bash
npx hardhat verify --network sepolia <STABLECOIN_ADDRESS>
npx hardhat verify --network sepolia <FUND_MANAGER_ADDRESS>
```

---

## 📊 Smart Contract Details

### ReliefStablecoin (RUSD)

| Function | Description | Access |
|----------|-------------|--------|
| `mint(address, amount)` | Create new tokens | Admin only |
| `burn(address, amount)` | Destroy tokens | Admin only |
| `transfer(to, amount)` | Transfer with restrictions | Anyone |
| `pause() / unpause()` | Emergency controls | Admin only |

### ReliefFundManager

| Function | Description | Access |
|----------|-------------|--------|
| `addBeneficiary(address)` | Whitelist victim | Admin only |
| `removeBeneficiary(address)` | Remove victim | Admin only |
| `addMerchant(address, category, name)` | Whitelist vendor | Admin only |
| `removeMerchant(address)` | Remove vendor | Admin only |
| `isTransferAllowed(from, to, amount)` | Check transfer validity | View |
| `recordTransfer(from, to, amount)` | Log transaction | Anyone |

---

## 🔒 Security Features

1. **Permissioned Access**: Only admin can modify whitelists
2. **Transfer Restrictions**: Beneficiaries can only pay merchants
3. **Pausable**: Emergency stop for all operations
4. **Event Logging**: Complete audit trail on-chain
5. **No External Dependencies**: No oracles or cross-chain complexity

---

## 📈 Future Enhancements (Post-Hackathon)

- [ ] Multi-signature admin control
- [ ] Spending limits per beneficiary
- [ ] Time-locked distributions
- [ ] Mobile wallet integration
- [ ] Government agency dashboard
- [ ] Real-time reporting API

---

## 🏆 Hackathon Checklist

- [x] Smart contracts (Solidity)
- [x] Hardhat development framework
- [x] ERC-20 custom stablecoin
- [x] Beneficiary whitelisting
- [x] Merchant whitelisting with categories
- [x] Transfer restrictions
- [x] Full event logging
- [x] Comprehensive tests
- [x] Frontend dashboard
- [x] Local deployment
- [x] Sepolia testnet ready
- [x] Demo-ready in under 3 minutes

---

## 👥 Team

**IIT EBIS 2.0 Hackathon Entry**

Track: Bybit – Real World Assets & DeFi

---

## 📄 License

MIT License

---

<div align="center">

**Built with ❤️ for disaster victims worldwide**

*"Because every rupee of relief should reach those who need it"*

</div>
