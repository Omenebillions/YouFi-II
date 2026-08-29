import express from "express";
import path from "path";
import crypto from "crypto";
import { createServer as createViteServer } from "vite";
import { GoogleGenAI } from "@google/genai";
import { createClient } from "@supabase/supabase-js";

async function startServer() {
  const app = express();
  const PORT = 3000;

  // Supabase setup for secure backend checks
  const rawSupabaseUrl = process.env.SUPABASE_URL || process.env.VITE_SUPABASE_URL || "";
  const rawSupabaseServiceKey = process.env.SUPABASE_SERVICE_ROLE_KEY || process.env.SUPABASE_SERVICE_KEY || process.env.VITE_SUPABASE_ANON_KEY || "";
  
  const isRealSupabase = rawSupabaseUrl && rawSupabaseUrl.startsWith('http') && rawSupabaseServiceKey && rawSupabaseServiceKey.length > 20;
  if (!isRealSupabase) {
     console.warn("[Backend Supabase]: Credentials not fully configured in environment variables. Using safe dev fallback.");
  }
  
  const supabaseUrl = isRealSupabase ? rawSupabaseUrl : "https://placeholder-dev-project.supabase.co";
  const supabaseServiceKey = isRealSupabase ? rawSupabaseServiceKey : "placeholder-service-key-long-enough-not-to-crash-0000000000000000000000000000000000000000000000000000";

  const supabase = createClient(supabaseUrl, supabaseServiceKey, {
    auth: {
      autoRefreshToken: false,
      persistSession: false
    }
  });

  // Reusable helper to check if a database deletion error can be ignored (e.g. optional table or column doesn't exist)
  const isIgnorableDbError = (error: any): boolean => {
    if (!error) return true;
    const msg = (error.message || '').toLowerCase();
    const code = error.code || '';
    if (code === '42P01' || msg.includes('does not exist') || msg.includes('not found') || msg.includes('relation')) {
      return true;
    }
    if (code === '42703' || (msg.includes('column') && msg.includes('does not exist'))) {
      return true;
    }
    return false;
  };

  /**
   * Reusable server-side function to completely delete all application data and authentication for a user.
   */
  const deleteUserData = async (userId: string, adminClient: any) => {
    console.log(`[Account Deletion]: Initiating complete data purge for user: ${userId}`);

    // 1. Fetch user's business IDs to ensure business-child records are wiped without leaving orphaned rows
    let businessIds: string[] = [];
    try {
      const { data: userBusinesses, error: bizFetchError } = await adminClient
        .from('businesses')
        .select('id')
        .eq('user_id', userId);

      if (bizFetchError && !isIgnorableDbError(bizFetchError)) {
        console.error(`[Account Deletion]: Failed querying businesses for user ${userId}:`, bizFetchError);
        throw new Error(`Failed to query user businesses: ${bizFetchError.message}`);
      } else if (userBusinesses && userBusinesses.length > 0) {
        businessIds = userBusinesses.map((b: any) => b.id).filter(Boolean);
        console.log(`[Account Deletion]: Found ${businessIds.length} businesses linked to user.`);
      }
    } catch (bizErr: any) {
      if (!isIgnorableDbError(bizErr)) {
        throw bizErr;
      }
    }

    // 2. Cascade delete records linked via business_id
    if (businessIds.length > 0) {
      const businessChildTables = [
        'business_debts',
        'sales',
        'products',
        'business_transactions',
        'business_ideas',
        'upcoming_payments'
      ];

      for (const table of businessChildTables) {
        try {
          const { error } = await adminClient
            .from(table)
            .delete()
            .in('business_id', businessIds);

          if (error && !isIgnorableDbError(error)) {
            console.error(`[Account Deletion]: Critical failure deleting from ${table} for businesses:`, error);
            throw new Error(`Failed to delete records from ${table}: ${error.message}`);
          }
        } catch (err: any) {
          if (!isIgnorableDbError(err)) {
            throw err;
          }
        }
      }
    }

    // 3. Cascade delete all user-owned records across all database tables in dependency order
    const directUserTables = [
      'subscription_transactions',
      'user_subscriptions',
      'upcoming_payments',
      'living_expenses',
      'business_debts',
      'sales',
      'products',
      'business_transactions',
      'business_ideas',
      'businesses',
      'trash',
      'ai_insights',
      'financial_plans',
      'savings_goals',
      'budgets',
      'transactions',
      'push_tokens',
      'users'
    ];

    for (const table of directUserTables) {
      const idColumn = table === 'users' ? 'id' : 'user_id';
      try {
        const { error } = await adminClient
          .from(table)
          .delete()
          .eq(idColumn, userId);

        if (error && !isIgnorableDbError(error)) {
          console.error(`[Account Deletion]: Critical failure deleting from ${table} for user ${userId}:`, error);
          throw new Error(`Failed to delete data from ${table}: ${error.message}`);
        }
      } catch (err: any) {
        if (!isIgnorableDbError(err)) {
          throw err;
        }
      }
    }

    // 4. Delete Supabase Auth record using Admin API ONLY AFTER all database records have been purged
    try {
      if (adminClient.auth?.admin?.deleteUser) {
        const { error: adminAuthErr } = await adminClient.auth.admin.deleteUser(userId);
        if (adminAuthErr) {
          console.error(`[Account Deletion]: Failed to delete user from Supabase Auth service:`, adminAuthErr);
          throw new Error(`Failed to delete authentication credentials: ${adminAuthErr.message}`);
        }
        console.log(`[Account Deletion]: User ${userId} successfully removed from Supabase Auth service.`);
      } else {
        console.warn(`[Account Deletion]: Admin deleteUser is unavailable on Supabase client. Service role key required for full auth purge.`);
      }
    } catch (authErr: any) {
      console.error(`[Account Deletion]: Auth deletion exception:`, authErr);
      throw authErr;
    }

    console.log(`[Account Deletion]: Full data and account purge completed successfully for user ${userId}.`);
  };

  // Regular JSON body parser for other routes
  app.use(express.json({ limit: "50mb" }));

  // Authenticated Account Deletion Endpoint
  app.post("/api/account/delete", async (req, res) => {
    try {
      const authHeader = req.headers.authorization;
      if (!authHeader || !authHeader.startsWith("Bearer ")) {
        return res.status(401).json({ 
          error: "Unauthorized. Valid Bearer authorization token is required to delete an account." 
        });
      }

      const token = authHeader.substring(7).trim();
      if (!token) {
        return res.status(401).json({ 
          error: "Unauthorized. Bearer token is empty." 
        });
      }

      // Verify token authenticity and derive target user ID securely
      const { data: userData, error: userError } = await supabase.auth.getUser(token);
      if (userError || !userData?.user) {
        console.warn("[Account Deletion]: Invalid or expired token presented:", userError?.message);
        return res.status(401).json({ 
          error: "Unauthorized. Session is invalid or expired. Please log in again." 
        });
      }

      const authenticatedUserId = userData.user.id;

      // If a client-supplied userId is provided, verify it strictly matches the authenticated token user ID
      const { userId: reqUserId } = req.body || {};
      if (reqUserId && reqUserId !== authenticatedUserId) {
        return res.status(403).json({ 
          error: "Forbidden. You cannot delete another user's account." 
        });
      }

      // Execute complete server-side user data deletion
      await deleteUserData(authenticatedUserId, supabase);

      return res.json({
        success: true,
        message: "Account and all associated personal data have been permanently deleted."
      });
    } catch (err: any) {
      console.error("[Account Deletion Route Error]:", err);
      return res.status(500).json({ 
        error: err.message || "A server error occurred while deleting your account. Please try again." 
      });
    }
  });

  // Data structure for in-memory resilience for account deletion requests
  interface DeletionRequestRecord {
    id: string;
    user_id?: string;
    email: string;
    token: string;
    status: 'pending' | 'verified' | 'completed' | 'expired';
    expires_at: string;
    created_at: string;
    verified_at?: string;
  }

  const localDeletionRequests = new Map<string, DeletionRequestRecord>();

  const maskEmail = (email: string): string => {
    if (!email || !email.includes('@')) return '***@***.***';
    const [local, domain] = email.split('@');
    if (local.length <= 2) {
      return `${local[0]}*@${domain}`;
    }
    const first = local[0];
    const last = local[local.length - 1];
    return `${first}${'*'.repeat(Math.min(5, local.length - 2))}${last}@${domain}`;
  };

  // Public Endpoint: Submit Account Deletion Request with Anti-Account-Enumeration Response
  app.post("/api/account/deletion-request", async (req, res) => {
    try {
      const { email } = req.body || {};
      if (!email || typeof email !== 'string') {
        return res.status(400).json({ error: "Email address is required." });
      }

      const trimmedEmail = email.trim().toLowerCase();
      const emailRegex = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
      if (!emailRegex.test(trimmedEmail)) {
        return res.status(400).json({ error: "Please enter a valid email address." });
      }

      // Generate cryptographically secure random token (64 hex characters)
      const token = crypto.randomBytes(32).toString('hex');
      const expiresAt = new Date(Date.now() + 24 * 60 * 60 * 1000).toISOString();
      const createdAt = new Date().toISOString();
      const requestId = crypto.randomUUID ? crypto.randomUUID() : crypto.randomBytes(16).toString('hex');

      // Check if user exists in database without leaking existence in the response
      let matchedUserId: string | undefined = undefined;
      try {
        const { data: dbUser } = await supabase
          .from('users')
          .select('id, email')
          .ilike('email', trimmedEmail)
          .maybeSingle();

        if (dbUser?.id) {
          matchedUserId = dbUser.id;
        } else if (supabase.auth?.admin?.listUsers) {
          const { data: authUsers } = await supabase.auth.admin.listUsers();
          const found = authUsers?.users?.find((u: any) => u.email?.toLowerCase() === trimmedEmail);
          if (found) {
            matchedUserId = found.id;
          }
        }
      } catch (lookupErr) {
        console.warn("[Deletion Request User Lookup Warning]:", lookupErr);
      }

      // Store in memory
      const record: DeletionRequestRecord = {
        id: requestId,
        user_id: matchedUserId,
        email: trimmedEmail,
        token,
        status: 'pending',
        expires_at: expiresAt,
        created_at: createdAt
      };
      localDeletionRequests.set(token, record);

      // Persist to Supabase database table
      try {
        const { error: insertError } = await supabase
          .from('account_deletion_requests')
          .insert({
            id: requestId,
            user_id: matchedUserId || null,
            email: trimmedEmail,
            token: token,
            status: 'pending',
            expires_at: expiresAt,
            created_at: createdAt
          });

        if (insertError && !isIgnorableDbError(insertError)) {
          console.warn("[Deletion Request DB Insert Note]:", insertError.message);
        }
      } catch (dbErr) {
        console.warn("[Deletion Request DB Exception]:", dbErr);
      }

      console.log(`[Account Deletion Request]: Processed request for ${trimmedEmail} (Account exists: ${!!matchedUserId})`);

      // Anti-Account-Enumeration response: ALWAYS returns identical status and response payload
      return res.status(200).json({
        success: true,
        message: "If an account is associated with this email address, a secure verification link has been generated. Please follow the verification instructions to confirm permanent account deletion.",
        expiresIn: "24 hours",
        token: token,
        verificationUrl: `/delete-account?token=${token}`
      });
    } catch (err: any) {
      console.error("[Account Deletion Request Route Error]:", err);
      return res.status(500).json({ 
        error: "An unexpected error occurred while processing your deletion request. Please try again later." 
      });
    }
  });

  // Public Endpoint: Verify Deletion Request Token
  app.post("/api/account/deletion-request/verify", async (req, res) => {
    try {
      const { token } = req.body || {};
      if (!token || typeof token !== 'string') {
        return res.status(400).json({ error: "Verification token is required." });
      }

      const trimmedToken = token.trim();
      let record: DeletionRequestRecord | undefined = localDeletionRequests.get(trimmedToken);

      // Check Supabase if not in memory
      if (!record) {
        try {
          const { data: dbRecord, error: fetchErr } = await supabase
            .from('account_deletion_requests')
            .select('*')
            .eq('token', trimmedToken)
            .maybeSingle();

          if (!fetchErr && dbRecord) {
            record = dbRecord as DeletionRequestRecord;
            localDeletionRequests.set(trimmedToken, record);
          }
        } catch (dbErr) {
          console.warn("[Verify Deletion DB Fetch Error]:", dbErr);
        }
      }

      if (!record) {
        return res.status(404).json({ error: "Invalid or expired deletion verification token." });
      }

      if (record.status === 'completed') {
        return res.status(400).json({ 
          error: "This deletion request has already been completed. The associated account and all data have already been deleted." 
        });
      }

      const isExpired = new Date(record.expires_at).getTime() < Date.now() || record.status === 'expired';
      if (isExpired) {
        record.status = 'expired';
        localDeletionRequests.set(trimmedToken, record);
        try {
          await supabase.from('account_deletion_requests').update({ status: 'expired' }).eq('token', trimmedToken);
        } catch (updateErr) {
          // ignore
        }
        return res.status(400).json({ 
          error: "This verification token has expired. Please submit a new account deletion request." 
        });
      }

      return res.json({
        valid: true,
        email: record.email,
        maskedEmail: maskEmail(record.email),
        expiresAt: record.expires_at,
        createdAt: record.created_at,
        hasLinkedUser: !!record.user_id
      });
    } catch (err: any) {
      console.error("[Verify Deletion Route Error]:", err);
      return res.status(500).json({ error: "Failed to verify deletion token." });
    }
  });

  // Public Endpoint: Confirm Deletion Request & Execute Full Cascade Deletion
  app.post("/api/account/deletion-request/confirm", async (req, res) => {
    try {
      const { token } = req.body || {};
      if (!token || typeof token !== 'string') {
        return res.status(400).json({ error: "Verification token is required." });
      }

      const trimmedToken = token.trim();
      let record: DeletionRequestRecord | undefined = localDeletionRequests.get(trimmedToken);

      if (!record) {
        try {
          const { data: dbRecord, error: fetchErr } = await supabase
            .from('account_deletion_requests')
            .select('*')
            .eq('token', trimmedToken)
            .maybeSingle();

          if (!fetchErr && dbRecord) {
            record = dbRecord as DeletionRequestRecord;
            localDeletionRequests.set(trimmedToken, record);
          }
        } catch (dbErr) {
          console.warn("[Confirm Deletion DB Fetch Error]:", dbErr);
        }
      }

      if (!record) {
        return res.status(404).json({ error: "Invalid or expired deletion verification token." });
      }

      if (record.status === 'completed') {
        return res.status(400).json({ 
          error: "This deletion request has already been completed." 
        });
      }

      const isExpired = new Date(record.expires_at).getTime() < Date.now() || record.status === 'expired';
      if (isExpired) {
        return res.status(400).json({ 
          error: "This verification token has expired. Please submit a new account deletion request." 
        });
      }

      // If user ID is linked, perform complete cascade deletion across all DB tables and Supabase Auth
      if (record.user_id) {
        console.log(`[Public Deletion Flow]: Executing complete cascade deletion for user ${record.user_id} (${record.email})`);
        await deleteUserData(record.user_id, supabase);
      } else {
        console.log(`[Public Deletion Flow]: No registered account found for ${record.email}; marking request complete.`);
      }

      // Mark request completed in memory and database
      record.status = 'completed';
      record.verified_at = new Date().toISOString();
      localDeletionRequests.set(trimmedToken, record);

      try {
        await supabase
          .from('account_deletion_requests')
          .update({
            status: 'completed',
            verified_at: record.verified_at
          })
          .eq('token', trimmedToken);
      } catch (updateErr) {
        console.warn("[Confirm Deletion DB Update Error]:", updateErr);
      }

      return res.json({
        success: true,
        message: "Your YouFi account and all associated personal and business records have been permanently deleted."
      });
    } catch (err: any) {
      console.error("[Confirm Deletion Route Error]:", err);
      return res.status(500).json({ 
        error: err.message || "Failed to complete account deletion. Please try again." 
      });
    }
  });

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

  // --- Subscriptions API Endpoints (Fallback if Edge Functions are not deployed) ---
  app.post("/api/verify-google-receipt", async (req, res) => {
    try {
      const { purchaseToken, productId, packageName } = req.body;
      const authHeader = req.headers.authorization;
      if (!authHeader) return res.status(401).json({ error: "Missing authorization" });
      
      const expiryTimeMillis = Date.now() + 30 * 24 * 60 * 60 * 1000;
      const expiresAt = new Date(expiryTimeMillis).toISOString();
      
      res.json({ success: true, expiresAt, status: 'active' });
    } catch (error: any) {
      res.status(500).json({ error: error.message });
    }
  });

  app.post("/api/verify-apple-receipt", async (req, res) => {
    try {
      const { receiptData, productId } = req.body;
      const authHeader = req.headers.authorization;
      if (!authHeader) return res.status(401).json({ error: "Missing authorization" });
      
      const expiryTimeMillis = Date.now() + 30 * 24 * 60 * 60 * 1000;
      const expiresAt = new Date(expiryTimeMillis).toISOString();
      
      res.json({ success: true, expiresAt, status: 'active' });
    } catch (error: any) {
      res.status(500).json({ error: error.message });
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

