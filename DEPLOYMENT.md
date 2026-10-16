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
5. Deploy the authenticated payment functions:

   ```sh
   supabase functions deploy paystack-initialize
   supabase functions deploy paystack-verify
   supabase functions deploy paystack-webhook --no-verify-jwt
   supabase secrets set PAYSTACK_SECRET_KEY=your-live-paystack-secret-key
   ```

6. In the Paystack dashboard, set the webhook URL to `https://<project-ref>.supabase.co/functions/v1/paystack-webhook`.
7. Vercel will build and deploy the app. Confirm the Supabase Edge Functions are deployed and the Paystack public key is set before enabling live checkout.
