#!/bin/bash
# Verification Script for YouFi-II Security & Scalability Implementation
# Run this to verify all changes are in place

echo "=========================================="
echo "YouFi-II Implementation Verification"
echo "=========================================="
echo ""

# Colors
GREEN='\033[0;32m'
RED='\033[0;31m'
NC='\033[0m' # No Color

# Check 1: Paystack Service
echo -n "✓ Checking Paystack Service... "
if [ -f "src/services/paystack.ts" ]; then
  echo -e "${GREEN}OK${NC}"
else
  echo -e "${RED}MISSING${NC}"
fi

# Check 2: Encryption Service
echo -n "✓ Checking Encryption Service... "
if [ -f "src/services/encryption.ts" ]; then
  echo -e "${GREEN}OK${NC}"
else
  echo -e "${RED}MISSING${NC}"
fi

# Check 3: Server.ts Updated
echo -n "✓ Checking Updated Server... "
if grep -q "verifyPaystackSignature" server.ts; then
  echo -e "${GREEN}OK${NC}"
else
  echo -e "${RED}MISSING${NC}"
fi

# Check 4: Database Migration
echo -n "✓ Checking Database Migration... "
if [ -f "migrations/001_security_scalability.sql" ]; then
  echo -e "${GREEN}OK${NC}"
else
  echo -e "${RED}MISSING${NC}"
fi

# Check 5: Security Documentation
echo -n "✓ Checking Security Documentation... "
if [ -f "SECURITY_IMPLEMENTATION.md" ]; then
  echo -e "${GREEN}OK${NC}"
else
  echo -e "${RED}MISSING${NC}"
fi

# Check 6: Scalability Documentation
echo -n "✓ Checking Scalability Documentation... "
if [ -f "SCALABILITY.md" ]; then
  echo -e "${GREEN}OK${NC}"
else
  echo -e "${RED}MISSING${NC}"
fi

# Check 7: Implementation Summary
echo -n "✓ Checking Implementation Summary... "
if [ -f "IMPLEMENTATION_SUMMARY.md" ]; then
  echo -e "${GREEN}OK${NC}"
else
  echo -e "${RED}MISSING${NC}"
fi

# Check 8: Environment Configuration
echo -n "✓ Checking Environment Configuration... "
if [ -f ".env.example" ]; then
  if grep -q "PAYSTACK_SECRET_KEY" .env.example; then
    echo -e "${GREEN}OK${NC}"
  else
    echo -e "${RED}OUTDATED${NC}"
  fi
else
  echo -e "${RED}MISSING${NC}"
fi

# Check 9: Backup of original server
echo -n "✓ Checking Server Backup... "
if [ -f "server.backup.ts" ]; then
  echo -e "${GREEN}OK${NC}"
else
  echo -e "${RED}NOT FOUND${NC}"
fi

echo ""
echo "=========================================="
echo "Security Features Verification"
echo "=========================================="
echo ""

# Check Security Features in server.ts
echo -n "✓ Rate Limiting Middleware... "
if grep -q "rateLimitMiddleware" server.ts; then
  echo -e "${GREEN}IMPLEMENTED${NC}"
else
  echo -e "${RED}MISSING${NC}"
fi

echo -n "✓ Security Headers Middleware... "
if grep -q "securityHeaders" server.ts; then
  echo -e "${GREEN}IMPLEMENTED${NC}"
else
  echo -e "${RED}MISSING${NC}"
fi

echo -n "✓ CORS Middleware... "
if grep -q "corsMiddleware" server.ts; then
  echo -e "${GREEN}IMPLEMENTED${NC}"
else
  echo -e "${RED}MISSING${NC}"
fi

echo -n "✓ Request Logging... "
if grep -q "requestLogger" server.ts; then
  echo -e "${GREEN}IMPLEMENTED${NC}"
else
  echo -e "${RED}MISSING${NC}"
fi

echo -n "✓ Paystack Signature Verification... "
if grep -q "verifyPaystackSignature" server.ts; then
  echo -e "${GREEN}IMPLEMENTED${NC}"
else
  echo -e "${RED}MISSING${NC}"
fi

echo -n "✓ Premium Middleware... "
if grep -q "requirePremium" server.ts; then
  echo -e "${GREEN}IMPLEMENTED${NC}"
else
  echo -e "${RED}MISSING${NC}"
fi

echo ""
echo "=========================================="
echo "Paystack Integration Verification"
echo "=========================================="
echo ""

echo -n "✓ Paystack Initialize Endpoint... "
if grep -q "/api/paystack/initialize" server.ts; then
  echo -e "${GREEN}IMPLEMENTED${NC}"
else
  echo -e "${RED}MISSING${NC}"
fi

echo -n "✓ Paystack Verify Endpoint... "
if grep -q "/api/paystack/verify" server.ts; then
  echo -e "${GREEN}IMPLEMENTED${NC}"
else
  echo -e "${RED}MISSING${NC}"
fi

echo -n "✓ Paystack Webhook Endpoint... "
if grep -q "/api/paystack/webhook" server.ts; then
  echo -e "${GREEN}IMPLEMENTED${NC}"
else
  echo -e "${RED}MISSING${NC}"
fi

echo -n "✓ Paystack History Endpoint... "
if grep -q "/api/paystack/history" server.ts; then
  echo -e "${GREEN}IMPLEMENTED${NC}"
else
  echo -e "${RED}MISSING${NC}"
fi

echo ""
echo "=========================================="
echo "Encryption Features Verification"
echo "=========================================="
echo ""

echo -n "✓ AES-256 Encryption... "
if grep -q "AES.encrypt" src/services/encryption.ts 2>/dev/null; then
  echo -e "${GREEN}IMPLEMENTED${NC}"
else
  echo -e "${RED}MISSING${NC}"
fi

echo -n "✓ PBKDF2 Hashing... "
if grep -q "PBKDF2" src/services/encryption.ts 2>/dev/null; then
  echo -e "${GREEN}IMPLEMENTED${NC}"
else
  echo -e "${RED}MISSING${NC}"
fi

echo -n "✓ HMAC Signature... "
if grep -q "HmacSHA256" src/services/encryption.ts 2>/dev/null; then
  echo -e "${GREEN}IMPLEMENTED${NC}"
else
  echo -e "${RED}MISSING${NC}"
fi

echo ""
echo "=========================================="
echo "Environment Variables Required"
echo "=========================================="
echo ""
echo "Critical (Must Set):"
echo "  □ VITE_SUPABASE_URL"
echo "  □ VITE_SUPABASE_ANON_KEY"
echo "  □ SUPABASE_SERVICE_ROLE_KEY"
echo "  □ VITE_PAYSTACK_PUBLIC_KEY"
echo "  □ PAYSTACK_SECRET_KEY"
echo "  □ VITE_ENCRYPTION_KEY"
echo "  □ ADMIN_KEY"
echo "  □ GEMINI_API_KEY"
echo ""
echo "Optional:"
echo "  □ STRIPE_SECRET_KEY (for backup provider)"
echo "  □ STRIPE_WEBHOOK_SECRET"
echo ""

echo "=========================================="
echo "Database Migration Required"
echo "=========================================="
echo ""
echo "Execute in Supabase SQL Editor:"
echo "1. Copy all content from: migrations/001_security_scalability.sql"
echo "2. Go to Supabase Dashboard → SQL Editor"
echo "3. Paste and execute"
echo ""

echo "=========================================="
echo "✅ Verification Complete!"
echo "=========================================="
echo ""
echo "Next Steps:"
echo "1. Review IMPLEMENTATION_SUMMARY.md"
echo "2. Set environment variables in Vercel"
echo "3. Run database migration in Supabase"
echo "4. Configure Paystack webhook"
echo "5. Test with Paystack test keys"
echo ""
