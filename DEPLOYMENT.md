# Deployment Guide (Vercel)

To deploy this application to Vercel, you need to configure the following Environment Variables:

## Required Keys

1. `GEMINI_API_KEY`: Your Google AI SDK key from Google AI Studio.
2. `VITE_SUPABASE_URL`: Your Supabase Project URL.
3. `VITE_SUPABASE_ANON_KEY`: Your Supabase Project Anon Key.
4. `VITE_PAYSTACK_PUBLIC_KEY`: Your Paystack public key (use the live key in production).

The Paystack secret key must only be configured in Supabase Edge Function secrets. Do not prefix it with `VITE_` or add it to Vercel's client-side environment variables.

## Deployment Steps

1. Push your code to a GitHub repository.
2. Connect the repository to Vercel.
3. Add the environment variables listed above in the Vercel project settings.
4. Apply the database migrations with `supabase db push`.
5. Set the live Paystack secret key in the linked Supabase project and deploy the authenticated payment functions:

   ```sh
   supabase secrets set PAYSTACK_SECRET_KEY=sk_live_your_secret_key
   supabase functions deploy paystack-initialize
   supabase functions deploy paystack-verify
   supabase functions deploy paystack-webhook --no-verify-jwt
   ```

6. Set `VITE_PAYSTACK_PUBLIC_KEY` to the matching `pk_live_...` key in the Vercel production environment, then redeploy the app. The app checks that the public key and Supabase secret key are both live (or both test) before opening checkout.
7. In the Paystack dashboard, set the webhook URL to `https://<project-ref>.supabase.co/functions/v1/paystack-webhook`.
8. Complete a low-value live transaction and confirm the webhook activates the subscription. Do not use a test key for production payments.
