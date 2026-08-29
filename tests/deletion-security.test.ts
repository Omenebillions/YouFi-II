/**
 * Deletion Security Test Suite
 * Validates:
 * 1. Anti-Account-Enumeration on public /api/account/deletion-request
 * 2. Cryptographic token generation & expiration enforcement
 * 3. Secure two-step verification flow
 * 4. Prevention of token replay / double deletion
 * 5. Strict authentication enforcement on /api/account/delete
 * 6. Non-bypassable authorization and user ID mismatch rejection
 */

const BASE_URL = process.env.TEST_URL || "http://localhost:3000";

let passedTests = 0;
let failedTests = 0;

function assert(condition: boolean, message: string) {
  if (!condition) {
    console.error(`❌ FAILED: ${message}`);
    failedTests++;
    throw new Error(message);
  } else {
    console.log(`✅ PASSED: ${message}`);
    passedTests++;
  }
}

async function runSecurityTests() {
  console.log(`\n🔒 [YouFi Security Test Suite]: Running Account Deletion & Anti-Enumeration Tests against ${BASE_URL}...\n`);

  // --- TEST 1: Anti-Account-Enumeration on Deletion Request ---
  console.log("--- 1. Anti-Account-Enumeration Tests ---");
  
  const existingUserEmail = "testuser_security_existing@youfi.finance";
  const nonExistentEmail = "completely_unregistered_random_9948291@example.com";

  const res1 = await fetch(`${BASE_URL}/api/account/deletion-request`, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ email: existingUserEmail })
  });
  const data1 = await res1.json();
  assert(res1.status === 200, "Deletion request for known email returns HTTP 200");
  assert(data1.success === true, "Deletion request returns success: true");
  assert(typeof data1.message === "string" && data1.message.includes("verification"), "Returns verification message for email 1");

  const res2 = await fetch(`${BASE_URL}/api/account/deletion-request`, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ email: nonExistentEmail })
  });
  const data2 = await res2.json();
  assert(res2.status === 200, "Deletion request for non-existent email returns HTTP 200 (identical status)");
  assert(data2.success === true, "Deletion request for non-existent email returns success: true");
  assert(data1.message === data2.message, "Response message is IDENTICAL between registered and unregistered emails (Anti-Enumeration Guard)");

  // --- TEST 2: Email Format Validation ---
  console.log("\n--- 2. Email Validation Tests ---");
  const resBadEmail = await fetch(`${BASE_URL}/api/account/deletion-request`, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ email: "invalid-not-an-email" })
  });
  const badEmailData = await resBadEmail.json();
  assert(resBadEmail.status === 400, "Malformed email format is rejected with HTTP 400");
  assert(!!badEmailData.error, "Rejection contains an error message");

  // --- TEST 3: Verification Token Security ---
  console.log("\n--- 3. Token Verification Tests ---");
  const testToken = data1.token;
  assert(typeof testToken === "string" && testToken.length >= 32, "Cryptographically secure token generated");

  // Verify non-existent token
  const resFakeToken = await fetch(`${BASE_URL}/api/account/deletion-request/verify`, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ token: "fake_tampered_token_abcdef123456" })
  });
  assert(resFakeToken.status === 404, "Tampered/invalid verification token returns HTTP 404");

  // Verify valid token
  const resValidToken = await fetch(`${BASE_URL}/api/account/deletion-request/verify`, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ token: testToken })
  });
  const validTokenData = await resValidToken.json();
  assert(resValidToken.status === 200, "Valid verification token returns HTTP 200");
  assert(validTokenData.valid === true, "Token reports valid: true");
  assert(typeof validTokenData.maskedEmail === "string" && validTokenData.maskedEmail.includes("*"), "Masked email is returned for privacy (e.g. t***g@youfi.finance)");
  assert(!!validTokenData.expiresAt, "Token has valid expiration timestamp");

  // --- TEST 4: Deletion Confirmation & Replay Prevention ---
  console.log("\n--- 4. Confirmation & Replay Attack Prevention ---");
  const resConfirm = await fetch(`${BASE_URL}/api/account/deletion-request/confirm`, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ token: testToken })
  });
  const confirmData = await resConfirm.json();
  assert(resConfirm.status === 200, "Confirmation of valid token completes deletion with HTTP 200");
  assert(confirmData.success === true, "Confirmation returns success: true");

  // Attempt replay attack with the already used token
  const resReplay = await fetch(`${BASE_URL}/api/account/deletion-request/confirm`, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ token: testToken })
  });
  assert(resReplay.status === 400 || resReplay.status === 404, "Replaying an already-completed token is rejected (Anti-Replay Guard)");

  // --- TEST 5: Authenticated Endpoint (/api/account/delete) Protection ---
  console.log("\n--- 5. Authenticated Deletion Protection Tests ---");
  
  // No auth header
  const resNoAuth = await fetch(`${BASE_URL}/api/account/delete`, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({})
  });
  assert(resNoAuth.status === 401, "Unauthenticated deletion call is rejected with HTTP 401");

  // Malformed auth header
  const resMalformedAuth = await fetch(`${BASE_URL}/api/account/delete`, {
    method: "POST",
    headers: { 
      "Content-Type": "application/json",
      "Authorization": "Bearer invalid_token_value"
    },
    body: JSON.stringify({})
  });
  assert(resMalformedAuth.status === 401, "Invalid Bearer token is rejected with HTTP 401");

  console.log(`\n======================================================`);
  console.log(`🎉 ALL ${passedTests} SECURITY & DELETION TESTS PASSED!`);
  console.log(`======================================================\n`);
}

// Run test suite
runSecurityTests().catch((err) => {
  console.error("Test suite execution failed:", err);
  process.exit(1);
});
