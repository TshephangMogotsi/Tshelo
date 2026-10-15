-- The encryption migration is already deployed. Close its inherited
-- authenticated EXECUTE grant with a separate, auditable migration.
REVOKE ALL ON FUNCTION public.get_payment_identifiers_for_service(uuid)
  FROM PUBLIC, anon, authenticated;
GRANT EXECUTE ON FUNCTION public.get_payment_identifiers_for_service(uuid)
  TO service_role;

DO $$
BEGIN
  IF has_function_privilege('anon', 'public.get_payment_identifiers_for_service(uuid)', 'EXECUTE')
    OR has_function_privilege('authenticated', 'public.get_payment_identifiers_for_service(uuid)', 'EXECUTE')
    OR NOT has_function_privilege('service_role', 'public.get_payment_identifiers_for_service(uuid)', 'EXECUTE')
  THEN
    RAISE EXCEPTION 'PAYMENT_IDENTIFIER_SERVICE_GRANTS_INVALID';
  END IF;
END;
$$;
