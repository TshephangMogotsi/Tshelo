-- Phase 8 public-launch hardening.
-- Keep historical grants and ledger entries intact, but remove every
-- client-accessible path to mint the internal beta test credit.
REVOKE ALL ON FUNCTION public.claim_beta_test_tokens() FROM PUBLIC, anon, authenticated;

COMMENT ON FUNCTION public.claim_beta_test_tokens() IS
  'Retired after pre-beta testing. Historical beta grant records are retained for audit only.';
