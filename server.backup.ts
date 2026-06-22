import express, { Request, Response, NextFunction } from "express";
import path from "path";
import { createServer as createViteServer } from "vite";
import { GoogleGenAI } from "@google/genai";
import { createClient } from "@supabase/supabase-js";
import Stripe from "stripe";
import crypto from "crypto";

// ==================== SECURITY & SCALABILITY CONFIGURATION ====================

// Rate limiting (in-memory for scalability - use Redis in production)
const rateLimitStore = new Map<string, { count: number; resetTime: number }>();
const RATE_LIMIT_WINDOW = 60000; // 1 minute
const RATE_LIMIT_MAX_REQUESTS = 100;

// Request tracking for monitoring and security
interface RequestLog {
  ip: string;
  endpoint: string;
  timestamp: number;
  statusCode?: number;
  userId?: string;
}
const requestLogs: RequestLog[] = [];
const MAX_LOGS = 10000; // Keep last 10k requests for analysis

// ==================== RATE LIMITING MIDDLEWARE ====================

const rateLimitMiddleware = (req: Request, res: Response, next: NextFunction) => {
  const clientIp = (req.headers['x-forwarded-for'] || req.socket.remoteAddress || '') as string;
  const key = clientIp.split(',')[0]; // Handle x-forwarded-for
  
  const now = Date.now();
  const limitData = rateLimitStore.get(key);

  if (limitData && limitData.resetTime > now) {
    if (limitData.count >= RATE_LIMIT_MAX_REQUESTS) {
      return res.status(429).json({ 
        error: 'Too many requests. Please try again later.' 
      });
    }
    limitData.count++;
  } else {
    rateLimitStore.set(key, { 
      count: 1, 
      resetTime: now + RATE_LIMIT_WINDOW 
    });
  }
  
  next();
};

// ==================== SECURITY HEADERS MIDDLEWARE ====================

const securityHeaders = (req: Request, res: Response, next: NextFunction) => {
  // Prevent clickjacking
  res.setHeader('X-Frame-Options', 'DENY');
  
  // Prevent MIME sniffing
  res.setHeader('X-Content-Type-Options', 'nosniff');
  
  // Enable XSS protection
  res.setHeader('X-XSS-Protection', '1; mode=block');
  
  // Content Security Policy
  res.setHeader(
    'Content-Security-Policy',
    "default-src 'self'; script-src 'self' https://js.paystack.co https://cdn.jsdelivr.net; style-src 'self' 'unsafe-inline'; img-src 'self' https:; font-src 'self'; connect-src 'self' https://api.paystack.co https://api.supabase.co https://api.revenuecat.com https://generativelanguage.googleapis.com"
  );
  
  // Referrer Policy
  res.setHeader('Referrer-Policy', 'strict-origin-when-cross-origin');
  
  // Permissions Policy
  res.setHeader(
    'Permissions-Policy',
    'geolocation=(), microphone=(), camera=(), payment=()'
  );
  
  next();
};

// ==================== CORS MIDDLEWARE ====================

const corsMiddleware = (req: Request, res: Response, next: NextFunction) => {
  const allowedOrigins = [
    'http://localhost:3000',
    'http://localhost:5173',
    process.env.VITE_FRONTEND_URL || ''
  ].filter(Boolean);

  const origin = req.headers.origin;
  
  if (allowedOrigins.includes(origin || '')) {
    res.setHeader('Access-Control-Allow-Origin', origin);
  }
  
  res.setHeader('Access-Control-Allow-Methods', 'GET, POST, PUT, DELETE, OPTIONS');
  res.setHeader('Access-Control-Allow-Headers', 'Content-Type, Authorization, X-Request-ID');
  res.setHeader('Access-Control-Max-Age', '3600');
  
  if (req.method === 'OPTIONS') {
    return res.sendStatus(200);
  }
  
  next();
};

// ==================== REQUEST LOGGING & MONITORING ====================

const requestLogger = (req: Request, res: Response, next: NextFunction) => {
  const clientIp = (req.headers['x-forwarded-for'] || req.socket.remoteAddress || '') as string;
  const startTime = Date.now();

  res.on('finish', () => {
    const log: RequestLog = {
      ip: clientIp.split(',')[0],
      endpoint: `${req.method} ${req.path}`,
      timestamp: startTime,
      statusCode: res.statusCode,
      userId: (req as any).userId
    };

    requestLogs.push(log);
    if (requestLogs.length > MAX_LOGS) {
      requestLogs.shift();
    }

    // Log slow requests (> 1 second)
    if (Date.now() - startTime > 1000) {
      console.warn(
        `[Slow Request] ${log.endpoint} took ${Date.now() - startTime}ms`
      );
    }
  });

  next();
};

// ==================== PAYSTACK SIGNATURE VERIFICATION ====================

const verifyPaystackSignature = (req: Request, res: Response, next: NextFunction) => {
  const signature = req.headers['x-paystack-signature'] as string;
  const paystackSecret = process.env.PAYSTACK_SECRET_KEY || '';
  
  if (!signature || !paystackSecret) {
    return next(); // Skip if no signature or secret
  }

  const hmac = crypto.createHmac('sha512', paystackSecret);
  hmac.update(JSON.stringify(req.body));
  const computedSignature = hmac.digest('hex');

  if (computedSignature !== signature) {
    console.warn('[Security] Paystack webhook signature mismatch');
    return res.status(401).json({ error: 'Unauthorized' });
  }

  next();
};

async function startServer() {
  const app = express();
  const PORT = process.env.PORT || 3000;

  // ==================== SUPABASE SETUP ====================
  const supabaseUrl = process.env.VITE_SUPABASE_URL;
  const supabaseKey = process.env.SUPABASE_SERVICE_ROLE_KEY || process.env.VITE_SUPABASE_ANON_KEY;
  if (!supabaseUrl || !supabaseKey) {
     console.error('CRITICAL: Supabase credentials missing');
  }
  const supabase = createClient(supabaseUrl || "", supabaseKey || "");

  // ==================== STRIPE SETUP ====================

  // Stripe setup for webhook
  const stripeSecretKey = process.env.STRIPE_SECRET_KEY || "";
  const stripe = stripeSecretKey ? new Stripe(stripeSecretKey) : null;
  const endpointSecret = process.env.STRIPE_WEBHOOK_SECRET || "";

  // ==================== STRIPE SETUP ====================
  const stripeSecretKey = process.env.STRIPE_SECRET_KEY || "";
  const stripe = stripeSecretKey ? new Stripe(stripeSecretKey) : null;
  const stripeEndpointSecret = process.env.STRIPE_WEBHOOK_SECRET || "";

  // ==================== PAYSTACK SETUP ====================
  const paystackSecretKey = process.env.PAYSTACK_SECRET_KEY || '';
  const paystackPublicKey = process.env.VITE_PAYSTACK_PUBLIC_KEY || '';

  if (!paystackSecretKey) {
    console.error('CRITICAL: PAYSTACK_SECRET_KEY not configured');
  }

  // ==================== MIDDLEWARE SETUP ====================
  
  // Apply security middleware FIRST
  app.use(rateLimitMiddleware);
  app.use(securityHeaders);
  app.use(corsMiddleware);
  app.use(requestLogger);

  // Raw body parser for webhook signatures (must be before JSON parser)
  app.post('/api/stripe/webhook', 
    express.raw({ type: 'application/json' }), 
    async (request, response) => {
      if (!stripe) {
        return response.status(400).send("Stripe is not configured");
      }
      
      const sig = request.headers['stripe-signature'];
      let event;

      try {
        event = stripe.webhooks.constructEvent(
          request.body, 
          sig as string, 
          stripeEndpointSecret
        );
      } catch (err: any) {
        console.error("[Stripe] Webhook signature verification failed", err.message);
        return response.status(400).send(`Webhook Error: ${err.message}`);
      }

      // Handle successful payment
      if (event.type === 'checkout.session.completed' || event.type === 'invoice.paid') {
        const dataObject = event.data.object as any;
        const userId = dataObject.client_reference_id || dataObject.metadata?.userId;
        
        if (userId) {
          console.log(`[Stripe] Payment verified for user ${userId}`);
          const { error } = await supabase
            .from('users')
            .update({ 
              is_premium: true,
              premium_updated_at: new Date().toISOString()
            })
            .eq('id', userId);
          
          if (error) {
            console.error("[Stripe] Failed to upgrade user:", error);
          }
        }
      }

      response.status(200).send('Webhook processed');
    }
  );

  // ==================== PAYSTACK WEBHOOKS ====================

  app.post('/api/paystack/webhook',
    express.json(),
    verifyPaystackSignature,
    async (request, response) => {
      try {
        const event = request.body;
        console.log(`[Paystack] Webhook event: ${event?.event}`);

        if (event && event.event === 'charge.success') {
          const reference = event.data?.reference;
          const email = event.data?.customer?.email;
          const metadataUserId = event.data?.metadata?.userId;
          const planType = event.data?.metadata?.planType || 'monthly';

          console.log(`[Paystack] Successful charge ${reference}`);

          if (metadataUserId) {
            // Update user premium status
            const { error } = await supabase
              .from('users')
              .update({ 
                is_premium: true,
                premium_plan: planType,
                premium_updated_at: new Date().toISOString()
              })
              .eq('id', metadataUserId);

            if (error) {
              console.error("[Paystack] Failed to update user:", error);
            }

            // Log the transaction for audit
            await supabase.from('payment_transactions').insert({
              user_id: metadataUserId,
              reference,
              amount: event.data?.amount,
              status: 'success',
              provider: 'paystack',
              plan_type: planType
            });

          } else if (email) {
            console.log(`[Paystack] Looking up user by email: ${email}`);
            const { data: userRecord, error: findError } = await supabase
              .from('users')
              .select('id')
              .eq('email', email)
              .maybeSingle();

            if (!findError && userRecord) {
              const { error } = await supabase
                .from('users')
                .update({ 
                  is_premium: true,
                  premium_plan: planType,
                  premium_updated_at: new Date().toISOString()
                })
                .eq('id', userRecord.id);

              if (error) {
                console.error("[Paystack] Failed to upgrade user by email:", error);
              }
            }
          }
        }

        response.status(200).json({ status: 'ok' });
      } catch (err) {
        console.error("[Paystack Webhook] Error:", err);
        response.status(200).json({ status: 'ok' }); // Always return 200 to prevent retries
      }
    }
  );

  // ==================== PAYSTACK INITIALIZATION ====================

  app.post('/api/paystack/initialize', express.json(), async (req, res) => {
    try {
      const { email, amount, planType, userId } = req.body;

      if (!email || !amount || !planType || !userId) {
        return res.status(400).json({ 
          error: 'Missing required fields: email, amount, planType, userId' 
        });
      }

      if (!paystackSecretKey) {
        return res.status(500).json({ 
          error: 'Paystack is not configured on the server' 
        });
      }

      const reference = `TXN_${userId}_${Date.now()}_${crypto.randomBytes(4).toString('hex')}`;

      const response = await fetch('https://api.paystack.co/transaction/initialize', {
        method: 'POST',
        headers: {
          Authorization: `Bearer ${paystackSecretKey}`,
          'Content-Type': 'application/json'
        },
        body: JSON.stringify({
          email,
          amount: Math.round(amount * 100), // Convert to kobo
          reference,
          metadata: {
            userId,
            planType
          }
        })
      });

      if (!response.ok) {
        throw new Error(`Paystack API error: ${response.status}`);
      }

      const data = await response.json();
      
      if (data.status) {
        res.json({
          status: 'success',
          data: {
            authorizationUrl: data.data.authorization_url,
            accessCode: data.data.access_code,
            reference: data.data.reference
          }
        });
      } else {
        res.status(400).json({ error: data.message });
      }

    } catch (err: any) {
      console.error("[Paystack Initialize] Error:", err);
      res.status(500).json({ 
        error: err.message || 'Failed to initialize payment' 
      });
    }
  });

  // ==================== PAYSTACK VERIFICATION ====================

  app.post('/api/paystack/verify', express.json(), async (req, res) => {
    try {
      const { reference, userId } = req.body;

      if (!reference) {
        return res.status(400).json({ error: "Reference is required" });
      }

      if (!paystackSecretKey) {
        return res.status(500).json({ 
          error: "PAYSTACK_SECRET_KEY not configured" 
        });
      }

      const response = await fetch(
        `https://api.paystack.co/transaction/verify/${encodeURIComponent(reference)}`,
        {
          headers: {
            Authorization: `Bearer ${paystackSecretKey}`,
            'Content-Type': 'application/json'
          }
        }
      );

      if (!response.ok) {
        throw new Error(`Paystack API error: ${response.status}`);
      }

      const data = await response.json();

      if (data.status && data.data?.status === 'success') {
        const verifiedUserId = data.data.metadata?.userId || userId;
        
        if (verifiedUserId) {
          // Ensure premium status is set
          await supabase
            .from('users')
            .update({ 
              is_premium: true,
              premium_plan: data.data.metadata?.planType || 'monthly',
              premium_updated_at: new Date().toISOString()
            })
            .eq('id', verifiedUserId);

          // Log transaction
          await supabase.from('payment_transactions').insert({
            user_id: verifiedUserId,
            reference,
            amount: data.data.amount / 100, // Convert from kobo back to main unit
            status: 'success',
            provider: 'paystack',
            plan_type: data.data.metadata?.planType || 'monthly'
          });
        }

        return res.json({ 
          status: "success", 
          data: data.data 
        });
      } else {
        return res.status(400).json({ 
          error: "Payment verification failed",
          data: data.data 
        });
      }

    } catch (err: any) {
      console.error("[Paystack Verify] Error:", err);
      res.status(500).json({ 
        error: err.message || "Failed to verify transaction" 
      });
    }
  });

  // ==================== PAYSTACK PAYMENT HISTORY ====================

  app.get('/api/paystack/history', express.json(), async (req, res) => {
    try {
      const userId = req.query.userId as string;

      if (!userId) {
        return res.status(400).json({ error: 'userId is required' });
      }

      const { data: transactions, error } = await supabase
        .from('payment_transactions')
        .select('*')
        .eq('user_id', userId)
        .eq('provider', 'paystack')
        .order('created_at', { ascending: false })
        .limit(50);

      if (error) {
        throw error;
      }

      res.json({ transactions: transactions || [] });

    } catch (err: any) {
      console.error("[Paystack History] Error:", err);
      res.status(500).json({ error: err.message });
    }
  });

  // ==================== GENERAL JSON PARSER ====================
  app.use(express.json({ limit: "50mb" }));

  // Initialize Gemini client
  let gemini: GoogleGenAI | null = null;
  const getGemini = () => {
    if (!gemini) {
      if (!process.env.GEMINI_API_KEY) {
        throw new Error("GEMINI_API_KEY is not set.");
      }
      gemini = new GoogleGenAI({ apiKey: process.env.GEMINI_API_KEY });
    }
    return gemini;
  };

  // Middleware to verify user premium status securely from Database
  const requirePremium = async (req: express.Request, res: express.Response, next: express.NextFunction) => {
     try {
        const { userId, isPremium: clientIsPremium } = req.body;
        if (!userId) {
           return res.status(403).json({ error: "Unauthorized. User ID is required to verify premium status." });
        }
        
        let isDbPremium = false;
        try {
           // Secure backend database check
           const { data: user, error } = await supabase
              .from('users')
              .select('is_premium')
              .eq('id', userId)
              .maybeSingle();
              
           if (!error && user && user.is_premium === true) {
              isDbPremium = true;
           }
        } catch (dbErr) {
           console.warn("DB is_premium check failed, falling back.", dbErr);
        }

        const isUserPremium = isDbPremium || (clientIsPremium === true && process.env.NODE_ENV !== "production");

        if (isUserPremium) {
           return next();
        }

        // Free User Welcome Tokens tracking inside general budgets ledger
        let { data: tokenRecord, error: fetchErr } = await supabase
           .from('budgets')
           .select('*')
           .eq('user_id', userId)
           .eq('category', '__AI_TOKENS__')
           .maybeSingle();

        if (fetchErr) {
           console.error("AI token retrieval query failed:", fetchErr);
        }

        if (!tokenRecord) {
           const { data: newRecord, error: insertErr } = await supabase
              .from('budgets')
              .insert({
                 user_id: userId,
                 category: '__AI_TOKENS__',
                 amount: 5,
                 period: 'all-time'
              })
              .select()
              .maybeSingle();
           
           if (insertErr) {
              console.error("Failed to initialize welcome tokens:", insertErr);
           }
           tokenRecord = newRecord;
        }

        const tokensRemaining = tokenRecord ? Math.max(0, Number(tokenRecord.amount)) : 5;

        if (tokensRemaining <= 0) {
           return res.status(403).json({ 
              error: "token_limit_reached", 
              message: "You’ve seen the magic. Upgrade to Pro for unlimited AI automated accounting." 
           });
        }

        (req as any).tokenRecordId = tokenRecord ? tokenRecord.id : null;
        (req as any).tokensRemaining = tokensRemaining;
        next();
     } catch (err: any) {
        res.status(500).json({ error: "Failed to verify payment status." });
     }
  };

  // API endpoints
  app.get("/api/health", (req, res) => {
    res.json({ status: "ok" });
  });

  app.post("/api/gemini/chat", requirePremium, async (req, res) => {
    try {
      const { userMessage, systemInstruction, userId } = req.body;
      const ai = getGemini();
      const response = await ai.models.generateContent({
        model: "gemini-3.5-flash",
        contents: userMessage,
        config: {
          systemInstruction,
          temperature: 0.7,
        },
      });

      // Decrement tokens upon successful generation
      if ((req as any).tokenRecordId) {
         const newAmount = Math.max(0, (req as any).tokensRemaining - 1);
         await supabase
            .from('budgets')
            .update({ amount: newAmount })
            .eq('id', (req as any).tokenRecordId);
         console.log(`[AI Tokens] User ${userId} consumed 1 welcome token. Remaining: ${newAmount}`);
      }

      res.json({ text: response.text });
    } catch (error: any) {
      console.error("Gemini Chat Error:", error);
      if (error.status === 401 || error.message?.includes('API key')) {
        res.status(401).json({ error: "Your Gemini API Key is invalid. Please update it in the AI Studio settings." });
      } else if (error.status === 429) {
        res.status(429).json({ error: "Our AI service is currently experiencing high demand. Please try again in a moment." });
      } else {
        res.status(500).json({ error: error.message || "Failed to communicate with AI" });
      }
    }
  });

  app.post("/api/gemini/generate", requirePremium, async (req, res) => {
    try {
      const { contents, config, userId } = req.body;
      const ai = getGemini();
      
      const response = await ai.models.generateContent({
        model: "gemini-3.5-flash",
        contents,
        config,
      });

      // Decrement tokens upon successful generation
      if ((req as any).tokenRecordId) {
         const newAmount = Math.max(0, (req as any).tokensRemaining - 1);
         await supabase
            .from('budgets')
            .update({ amount: newAmount })
            .eq('id', (req as any).tokenRecordId);
         console.log(`[AI Tokens] User ${userId} consumed 1 welcome token. Remaining: ${newAmount}`);
      }

      res.json({ text: response.text });
    } catch (error: any) {
      console.error("Gemini Generate Error:", error);
      if (error.status === 401 || error.message?.includes('API key')) {
        res.status(401).json({ error: "Your Gemini API Key is invalid. Please update it in the AI Studio settings." });
      } else if (error.status === 429) {
        res.status(429).json({ error: "Our AI service is currently experiencing high demand. Please try again in a moment." });
      } else {
        res.status(500).json({ error: error.message || "Failed to parse with AI" });
      }
    }
  });

  // Vite middleware for development
  if (process.env.NODE_ENV !== "production") {
    const vite = await createViteServer({
      server: { middlewareMode: true },
      appType: "spa",
    });
    app.use(vite.middlewares);
  } else {
    const distPath = path.join(process.cwd(), "dist");
    app.use(express.static(distPath));
    app.get("*", (req, res) => {
      res.sendFile(path.join(distPath, "index.html"));
    });
  }

  app.listen(PORT, "0.0.0.0", () => {
    console.log(`Server running on http://localhost:${PORT}`);
  });
}

startServer();
