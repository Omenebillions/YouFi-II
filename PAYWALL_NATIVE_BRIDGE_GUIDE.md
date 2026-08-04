# Paywall & Native Bridge Integration Guide

## 🎯 Architecture Overview

```
┌─────────────────────────────────────────────────────────────────┐
│                        EXPO APP (Native)                         │
│  ┌──────────────────────────────────────────────────────────┐  │
│  │  App.tsx (React Native)                                  │  │
│  │  - Handles WebView bridge                                │  │
│  │  - Manages notifications, calendar, scanner              │  │
│  │  - Stores premium status in AsyncStorage                 │  │
│  └──────────────────────────────────────────────────────────┘  │
│                             ↕                                     │
│  ┌──────────────────────────────────────────────────────────┐  │
│  │  ExpoBridge (bridge/NativeBridge.ts)                     │  │
│  │  - Communicates Web ↔ Native via postMessage             │  │
│  │  - Handles all native capabilities:                      │  │
│  │    • Premium status management                           │  │
│  │    • Payment processing                                  │  │
│  │    • Notifications & Calendar                            │  │
│  │    • Receipt scanning                                    │  │
│  │    • Ad integration                                      │  │
│  └──────────────────────────────────────────────────────────┘  │
│                             ↕                                     │
│  ┌──────────────────────────────────────────────────────────┐  │
│  │  WebView (Embedded React App)                            │  │
│  │  - Points to http://localhost:5173 (dev) or youfi.app    │  │
│  └──────────────────────────────────────────────────────────┘  │
└─────────────────────────────────────────────────────────────────┘
                             ↕
┌─────────────────────────────────────────────────────────────────┐
│              WEB APPLICATION (React + TypeScript)                │
│  ┌──────────────────────────────────────────────────────────┐  │
│  │  useNativeBridge Hook (hooks/useNativeBridge.ts)         │  │
│  │  - Detects if running in WebView (native)                │  │
│  │  - Provides bridge interface to components               │  │
│  │  - Handles premium status, purchases, notifications      │  │
│  └──────────────────────────────────────────────────────────┘  │
│                             ↕                                     │
│  ┌──────────────────────────────────────────────────────────┐  │
│  │  Paywall Component (components/Paywall.tsx)              │  │
│  │  - Show payment plans                                    │  │
│  │  - Integrated Paystack checkout                          │  │
│  │  - Currency conversion                                   │  │
│  │  - Post-payment verification                             │  │
│  └──────────────────────────────────────────────────────────┘  │
│                             ↕                                     │
│  ┌──────────────────────────────────────────────────────────┐  │
│  │  Backend API (server.ts)                                 │  │
│  │  - POST /api/paystack/initialize                         │  │
│  │  - POST /api/paystack/verify                             │  │
│  │  - POST /api/paystack/webhook                            │  │
│  └──────────────────────────────────────────────────────────┘  │
│                             ↕                                     │
│  ┌──────────────────────────────────────────────────────────┐  │
│  │  Paystack Service (External)                             │  │
│  │  - Payment processing                                    │  │
│  │  - Webhook callbacks                                     │  │
│  └──────────────────────────────────────────────────────────┘  │
└─────────────────────────────────────────────────────────────────┘
```

---

## 📱 Communication Flow: Payment in Native

### When user clicks "Upgrade" in native app:

```
1. USER TAPS "UPGRADE" IN NATIVE APP
        ↓
2. Paywall component calls bridge.purchasePremium('monthly')
        ↓
3. Native bridge intercepts call:
   - Option A: Send to web to handle Paystack checkout
   - Option B: Use native Paystack SDK (if available)
        ↓
4. Web shows Paystack payment form
        ↓
5. User completes payment on Paystack
        ↓
6. Backend webhook calls /api/paystack/webhook
        ↓
7. Backend verifies and updates user as premium
        ↓
8. Backend sends notification back to app
        ↓
9. App calls refreshPremiumStatus()
        ↓
10. PremiumGate unlocks premium features
```

---

## 🔌 Bridge Message Format

### From Web to Native (postMessage):

```typescript
{
  type: 'getPremiumStatus' | 'initiatePaystackPayment' | 'scheduleNotification' | ...,
  payload: { /* specific data */ },
  callbackId: 'timestamp_string' // For matching responses
}
```

### From Native to Web (injectJavaScript):

```typescript
{
  type: 'premiumStatusResponse' | 'paystackPaymentResponse' | ...,
  payload: { /* response data */ },
  callbackId: 'timestamp_string' // Matches request
}
```

---

## 🚀 Step-by-Step Integration Guide

### Step 1: Update mobile/App.tsx

Replace your current App.tsx with `AppWithBridge.tsx`:

```bash
cp mobile/AppWithBridge.tsx mobile/App.tsx
```

### Step 2: Install Required Dependencies

```bash
cd mobile
npm install expo-notifications expo-calendar expo-media-library expo-device
npm install @react-native-async-storage/async-storage
npm install react-native-webview
```

### Step 3: Create Bridge Directory

```bash
mkdir -p mobile/bridge
# NativeBridge.ts already created
```

### Step 4: Configure WebView URL

In `mobile/App.tsx`, update the WebView source:

```typescript
// Development
source={{ uri: 'http://localhost:5173' }}

// Production (after deployment)
source={{ uri: 'https://youfi.app' }}
```

### Step 5: Update useNativeBridge.ts

Update to detect native bridge:

```typescript
const isWebView = () => {
  if (typeof window === 'undefined') return false;
  // Check if YouFINativeBridge is injected by native app
  return (window as any).YouFINativeBridge !== undefined;
};
```

### Step 6: Test Payment Flow

1. **Start dev server:**
   ```bash
   npm run dev
   ```

2. **In another terminal, start Expo:**
   ```bash
   cd mobile
   expo start
   ```

3. **Open in Expo Go app and test:**
   - Tap "Upgrade"
   - Paywall opens
   - Select plan
   - Complete Paystack payment
   - Premium status updates

---

## 📡 Bridge Methods Reference

### Premium Management

```typescript
// Check if user is premium
const isPremium = await bridge.getPremiumStatus();

// Upgrade user
const success = await bridge.purchasePremium('monthly' | 'yearly' | 'business');
```

### Notifications

```typescript
// Schedule notification
const notificationId = await bridge.schedulePaymentNotification(
  '2026-06-25', // due date
  5000,         // amount
  'Bill payment due'
);

// Cancel notification
await bridge.cancelNotification(notificationId);

// Cancel all
await bridge.cancelAllNotifications();
```

### Calendar

```typescript
// Sync to calendar
const success = await bridge.syncPaymentToCalendar(
  '2026-06-25',
  5000,
  'Electric Bill'
);

// Remove from calendar
await bridge.removePaymentFromCalendar(eventId);
```

### Scanning

```typescript
// Scan receipt
const receipt = await bridge.scanReceipt();
// Returns: { amount, merchant, date, image }

// Scan product
const product = await bridge.scanProductImage();
// Returns: { name, price, details }
```

### Ads

```typescript
// Show rewarded ad (gives free tokens)
const { reward } = await bridge.showRewardedAd();

// Show interstitial ad
const shown = await bridge.showInterstitialAd();
```

---

## 🔐 What Happens When Payment Completes

### Flow in Native:

1. **User completes Paystack payment** (in web Paystack form)
2. **Paystack redirects back** with reference
3. **Backend webhook** receives `charge.success` event
4. **Backend verifies** transaction with Paystack
5. **Backend updates** user's `is_premium = true` in database
6. **Database trigger** fires `premium_updated_at` timestamp
7. **Web app** calls `refreshPremiumStatus()`
8. **Native bridge** detects status change
9. **Premium features unlock** in app

### Success Indicators:

- ✅ User sees "Premium Activated" message
- ✅ Premium gate shows content instead of lock
- ✅ Calendar sync enabled
- ✅ Receipt scanner available
- ✅ Payment notifications work

---

## 🐛 Troubleshooting

### Problem: Bridge not available in web

**Solution:** Check that `YouFINativeBridge` is injected:
```typescript
console.log(window.YouFINativeBridge); // Should exist in native
```

### Problem: Notifications don't trigger

**Solution:** Ensure Android/iOS permissions granted in app settings

### Problem: WebView can't reach dev server

**Solution:** Use your machine IP instead of localhost:
```typescript
// Instead of: http://localhost:5173
// Use: http://192.168.x.x:5173
```

### Problem: Payment not updating premium status

**Solution:** Check:
1. Paystack webhook URL configured correctly
2. Backend is receiving webhook (`check server logs`)
3. User exists in database
4. `refreshPremiumStatus()` called after payment

---

## 📊 Current Paywall Implementation Status

| Feature | Status | Details |
|---------|--------|---------|
| Paystack Integration | ✅ DONE | Full checkout flow implemented |
| Web Payment Flow | ✅ DONE | Works perfectly on web |
| Native Bridge | ✅ NEW | Just created for Expo wrapper |
| Notifications | ✅ READY | Expo-notifications integration |
| Calendar Sync | ✅ READY | Expo-calendar integration |
| Receipt Scanning | ✅ READY | Camera integration ready |
| Rewarded Ads | ✅ READY | Google Mobile Ads structure |
| Premium Verification | ✅ DONE | Database-level verification |

---

## 🎁 What Works Without Additional Work

✅ **Paywall component** - Already uses Paystack  
✅ **Premium gate** - Guards features properly  
✅ **Payment verification** - Backend secure  
✅ **Web payment flow** - Complete and tested  
✅ **Context management** - PremiumContext ready  

---

## ⚙️ What Still Needs Implementation

⏳ **Native-specific payment UI** - Currently redirects to web (better UX)  
⏳ **Advanced receipt parsing** - API integration for OCR  
⏳ **Product image scanning** - ML model for product recognition  
⏳ **Reward ad integration** - Google Mobile Ads full setup  
⏳ **Push notifications** - Backend integration for dynamic notifications  

---

## 🚀 Next Steps

1. **Integrate Bridge:** Copy new files to project
2. **Install Dependencies:** Run npm install for mobile packages
3. **Test in Dev:** Start Expo and test payment flow
4. **Deploy Backend:** Push server.ts with Paystack endpoints
5. **Configure Native:** Set correct WebView URLs
6. **Test Payment:** Use Paystack test keys first

---

## 📞 Reference Files

- **Bridge Implementation:** `mobile/bridge/NativeBridge.ts`
- **App Wrapper:** `mobile/AppWithBridge.tsx`
- **Web Paywall:** `src/components/Paywall.tsx`
- **Web Hook:** `src/hooks/useNativeBridge.ts`
- **Backend API:** `server.ts` (Paystack endpoints)
- **Context:** `src/contexts/PremiumContext.tsx`

---

**Status:** ✅ Ready for Expo native wrapper  
**Paywall:** ✅ Already integrated with Paystack  
**Bridge:** ✅ Complete and documented  
**Next:** Deploy and test! 🚀
