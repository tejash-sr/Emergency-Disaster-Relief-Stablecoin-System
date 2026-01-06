# Old Frontend Files

This folder contains the **original version** of the frontend where all views (Admin, Beneficiary, Transparency) were combined together in a single tabbed interface.

## Files

- `index.html` - Main HTML with tab navigation for all three panels
- `styles.css` - Light theme CSS with tab-based navigation
- `app.js` - JavaScript without role-based login

## How It Worked

The original design used a simple **tab-based navigation** where users could freely switch between:

1. **Admin Dashboard** - Mint tokens, add beneficiaries, add merchants
2. **Beneficiary View** - Check balance, make payments
3. **Transparency View** - View all transactions, category breakdown

There was **no login system** - anyone could access all tabs regardless of their actual role.

## Why It Was Changed

For the hackathon presentation, we needed:
- ✅ Proper role separation (Admin vs Beneficiary vs Public)
- ✅ Secure login flow with wallet authentication
- ✅ Professional UI with dark theme
- ✅ Smoother animations and transitions
- ✅ Better visual feedback (modals, toasts)

## To Use These Files

If you want to test the old version:
1. Copy these files to the `frontend/` folder
2. Also copy `config.js` and `abi.js` from `frontend/`
3. Open in browser with MetaMask

---
*Kept for reference - IIT EBIS 2.0 Hackathon*
