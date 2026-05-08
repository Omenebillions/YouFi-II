# Deployment Guide (Vercel)

To deploy this application to Vercel, you need to configure the following Environment Variables:

## Required Keys

1. `GEMINI_API_KEY`: Your Google AI SDK key from Google AI Studio.
2. `VITE_FIREBASE_API_KEY`: The `apiKey` from your `firebase-applet-config.json`.
3. `VITE_FIREBASE_AUTH_DOMAIN`: The `authDomain` from your `firebase-applet-config.json`.
4. `VITE_FIREBASE_PROJECT_ID`: The `projectId` from your `firebase-applet-config.json`.
5. `VITE_FIREBASE_STORAGE_BUCKET`: The `storageBucket` from your `firebase-applet-config.json`.
6. `VITE_FIREBASE_MESSAGING_SENDER_ID`: The `messagingSenderId` from your `firebase-applet-config.json`.
7. `VITE_FIREBASE_APP_ID`: The `appId` from your `firebase-applet-config.json`.
8. `VITE_FIREBASE_DATABASE_ID`: (Optional) The `firestoreDatabaseId` if you are using a specific database instance.

## Deployment Steps

1. Push your code to a GitHub repository.
2. Connect the repository to Vercel.
3. Add the environment variables listed above in the Vercel project settings.
4. Vercel will automatically build and deploy your app.

---

# Supabase Migration Path

Moving from Firebase/Firestore to Supabase involves the following changes:

## 1. Database Schema
Firestore is NoSQL (Documents). Supabase is SQL (PostgreSQL).
- You will need to create tables for `businesses`, `transactions`, `sales`, `products`, `businessIdeas`, and `upcomingPayments`.
- Relationships (e.g., `business_id` in `sales`) will be handled via Foreign Keys.

## 2. Authentication
- Replace `firebase/auth` with `@supabase/auth-helpers-react` or `@supabase/supabase-js`.
- Supabase also supports Google OAuth.

## 3. Data Fetching
- Replace `onSnapshot` (Firebase) with Supabase Realtime subscriptions `supabase.channel().on('postgres_changes', ...)`.
- Replace `getDocs` and `query` with `supabase.from('table').select('*').eq(...)`.

## 4. Security Rules
- Replace Firestore Security Rules with **PostgreSQL Row Level Security (RLS)**.

## 5. Implementation Effort
- Estimated effort: 2-3 days of focused development to rewrite the service layer and update all components.
