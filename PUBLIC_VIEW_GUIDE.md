# Public Viewer Mode - Quick Guide

## 🌐 For Third-Party Viewers (No MetaMask Required)

Your disaster relief system now has **PUBLIC VIEW MODE** for transparency!

### 📱 **How to Access as a Guest**

#### **Method 1: Click "View as Guest" Button**
1. Open the app at your Vercel URL
2. Click **"👁️ View as Guest (Read Only)"** button on login screen
3. Browse all public data without connecting a wallet!

#### **Method 2: Direct URL Parameter**
```
https://your-app.vercel.app/?view=public
```

### ✅ **What Guests Can View**

**Full Read Access to:**
- 📊 **Dashboard** - Real-time fund statistics
- 👥 **Beneficiaries** - List of registered recipients
- 🏪 **Merchants** - Approved merchant directory
- 💸 **Transactions** - Complete transaction history
- 📋 **Audit Trail** - Transparency records
- 🗺️ **Relief Map** - Geographic distribution
- 💰 **Donor Portal** - Public donation interface

### ❌ **What Guests CANNOT Do**

**Restricted Actions (Require Wallet):**
- Mint tokens (admin only)
- Add beneficiaries (admin only)
- Add merchants (admin only)
- Make payments (beneficiary only)
- Change blockchain data

### 🎯 **Perfect For:**

✅ Hackathon judges viewing your demo  
✅ News media checking transparency  
✅ Donors verifying fund usage  
✅ Public oversight and accountability  
✅ Mobile users without MetaMask  

### 🔐 **Security**

- Read-only blockchain data via public RPC
- No private keys needed
- No write access to contracts
- Safe for public sharing

---

## 🚀 **Share Your App**

**For Judges/Reviewers:**
```
📍 View our transparent disaster relief system:
https://your-app.vercel.app/?view=public

No wallet needed - full transparency view!
```

**For Demos:**
1. Open public view link
2. Show dashboard, transactions, map
3. Then connect MetaMask to show admin features
4. Perfect two-stage demo! 🎪

---

## 🔗 **URL Formats**

```bash
# Normal login (requires MetaMask)
https://your-app.vercel.app

# Public view (no wallet)
https://your-app.vercel.app/?view=public

# Direct to map page
https://your-app.vercel.app/?view=public#map

# Direct to donor portal
https://your-app.vercel.app/?view=public#donate
```

---

**💡 Tip:** Deploy this to Vercel NOW and share the `?view=public` link with judges immediately - they can explore your system while you finish testnet deployment!
