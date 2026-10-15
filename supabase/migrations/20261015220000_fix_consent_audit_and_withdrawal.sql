-- Record explicit consent, not a profile default. Do not backfill historical
-- acceptance or rewrite existing profile state/timestamps.
ALTER TABLE public.users ALTER COLUMN data_processing_consent SET DEFAULT false;
CREATE INDEX IF NOT EXISTS consent_log_user_type_created_idx
  ON public.consent_log(user_id, consent_type, created_at DESC);
REVOKE INSERT, UPDATE, DELETE ON public.consent_log FROM PUBLIC, anon, authenticated;
DROP POLICY IF EXISTS consent_log_insert ON public.consent_log;

CREATE OR REPLACE FUNCTION public.record_own_consents(p_consents jsonb)
RETURNS void
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = pg_catalog, public, pg_temp
AS $$
DECLARE
  caller_id uuid := auth.uid();
  profile public.users%ROWTYPE;
  field_name text;
  next_terms text;
  next_privacy text;
  next_marketing boolean;
  next_email boolean;
  next_sms boolean;
  next_push boolean;
  next_processing boolean;
  processing_event boolean := false;
  marketing_touched boolean;
  marketing_event boolean := false;
BEGIN
  IF caller_id IS NULL THEN RAISE EXCEPTION 'Authentication required' USING ERRCODE = '28000'; END IF;
  IF p_consents IS NULL OR jsonb_typeof(p_consents) <> 'object'
    OR p_consents - ARRAY['terms_version','privacy_version','marketing_consent','marketing_email_enabled','marketing_sms_enabled','marketing_push_enabled','data_processing_consent'] <> '{}'::jsonb
  THEN RAISE EXCEPTION 'CONSENT_INVALID'; END IF;
  FOREACH field_name IN ARRAY ARRAY['marketing_consent','marketing_email_enabled','marketing_sms_enabled','marketing_push_enabled','data_processing_consent'] LOOP
    IF p_consents ? field_name AND jsonb_typeof(p_consents->field_name) IS DISTINCT FROM 'boolean' THEN
      RAISE EXCEPTION 'CONSENT_INVALID';
    END IF;
  END LOOP;
  FOREACH field_name IN ARRAY ARRAY['terms_version','privacy_version'] LOOP
    IF p_consents ? field_name AND (jsonb_typeof(p_consents->field_name) IS DISTINCT FROM 'string'
      OR length(btrim(p_consents->>field_name)) NOT BETWEEN 1 AND 20) THEN
      RAISE EXCEPTION 'CONSENT_INVALID';
    END IF;
  END LOOP;

  -- Serialize consent decisions for one caller, including first-acceptance
  -- existence checks, so retries cannot create duplicate transition events.
  SELECT * INTO profile FROM public.users WHERE id=caller_id AND deleted_at IS NULL FOR UPDATE;
  IF profile.id IS NULL THEN RAISE EXCEPTION 'PROFILE_NOT_FOUND'; END IF;
  next_terms := CASE WHEN p_consents ? 'terms_version' THEN btrim(p_consents->>'terms_version') ELSE profile.terms_version END;
  next_privacy := CASE WHEN p_consents ? 'privacy_version' THEN btrim(p_consents->>'privacy_version') ELSE profile.privacy_version END;
  next_processing := CASE WHEN p_consents ? 'data_processing_consent' THEN (p_consents->>'data_processing_consent')::boolean ELSE profile.data_processing_consent END;
  IF p_consents ? 'data_processing_consent' THEN
    IF next_processing AND NULLIF(btrim(next_privacy),'') IS NULL THEN
      RAISE EXCEPTION 'CONSENT_POLICY_VERSION_REQUIRED';
    END IF;
    processing_event := next_processing IS DISTINCT FROM profile.data_processing_consent
      OR profile.data_processing_consent_at IS NULL
      OR NOT EXISTS(SELECT 1 FROM public.consent_log WHERE user_id=caller_id AND consent_type='data_processing'
        AND consent_version IS NOT DISTINCT FROM next_privacy
        AND action=CASE WHEN next_processing THEN 'granted' ELSE 'withdrawn' END);
  END IF;

  marketing_touched := p_consents ?| ARRAY['marketing_consent','marketing_email_enabled','marketing_sms_enabled','marketing_push_enabled'];
  next_marketing := profile.marketing_consent;
  next_email := profile.marketing_email_enabled;
  next_sms := profile.marketing_sms_enabled;
  next_push := profile.marketing_push_enabled;
  IF marketing_touched THEN
    next_email := CASE WHEN p_consents ? 'marketing_email_enabled' THEN (p_consents->>'marketing_email_enabled')::boolean ELSE coalesce(profile.marketing_email_enabled,false) END;
    next_sms := CASE WHEN p_consents ? 'marketing_sms_enabled' THEN (p_consents->>'marketing_sms_enabled')::boolean ELSE coalesce(profile.marketing_sms_enabled,false) END;
    next_push := CASE WHEN p_consents ? 'marketing_push_enabled' THEN (p_consents->>'marketing_push_enabled')::boolean ELSE coalesce(profile.marketing_push_enabled,false) END;
    IF p_consents->'marketing_consent' = 'false'::jsonb THEN
      -- Withdrawal wins even if the same payload attempts to enable a channel.
      next_marketing := false; next_email := false; next_sms := false; next_push := false;
    ELSIF p_consents ? 'marketing_consent' THEN
      next_marketing := (p_consents->>'marketing_consent')::boolean OR next_email OR next_sms OR next_push;
    ELSE
      -- Channel-only changes derive aggregate consent from the resulting channels;
      -- disabling the last channel must not preserve a stale aggregate true.
      next_marketing := next_email OR next_sms OR next_push;
    END IF;
    marketing_event := next_marketing IS DISTINCT FROM profile.marketing_consent
      OR NOT EXISTS(SELECT 1 FROM public.consent_log WHERE user_id=caller_id AND consent_type='marketing');
  END IF;

  UPDATE public.users SET
    terms_version=next_terms,
    terms_accepted_at=CASE WHEN p_consents ? 'terms_version' THEN now() ELSE terms_accepted_at END,
    privacy_version=next_privacy,
    privacy_accepted_at=CASE WHEN p_consents ? 'privacy_version' THEN now() ELSE privacy_accepted_at END,
    data_processing_consent=next_processing,
    data_processing_consent_at=CASE WHEN processing_event THEN now() ELSE data_processing_consent_at END,
    marketing_consent=next_marketing,
    marketing_consent_at=CASE WHEN NOT next_marketing THEN NULL WHEN marketing_touched AND (profile.marketing_consent IS DISTINCT FROM true OR profile.marketing_consent_at IS NULL) THEN now() ELSE marketing_consent_at END,
    marketing_email_enabled=next_email, marketing_sms_enabled=next_sms, marketing_push_enabled=next_push,
    updated_at=now()
  WHERE id=caller_id;

  IF p_consents ? 'terms_version' THEN
    INSERT INTO public.consent_log(user_id,consent_type,consent_version,action) VALUES(caller_id,'terms',next_terms,'accepted');
  END IF;
  IF p_consents ? 'privacy_version' THEN
    INSERT INTO public.consent_log(user_id,consent_type,consent_version,action) VALUES(caller_id,'privacy',next_privacy,'accepted');
  END IF;
  IF processing_event THEN
    INSERT INTO public.consent_log(user_id,consent_type,consent_version,action)
    VALUES(caller_id,'data_processing',next_privacy,CASE WHEN next_processing THEN 'granted' ELSE 'withdrawn' END);
  END IF;
  IF marketing_event THEN
    INSERT INTO public.consent_log(user_id,consent_type,consent_version,action)
    VALUES(caller_id,'marketing',next_privacy,CASE WHEN next_marketing THEN 'granted' ELSE 'withdrawn' END);
  END IF;
  IF marketing_touched THEN
    FOREACH field_name IN ARRAY ARRAY['marketing_email_enabled','marketing_sms_enabled','marketing_push_enabled'] LOOP
      IF (CASE field_name WHEN 'marketing_email_enabled' THEN next_email WHEN 'marketing_sms_enabled' THEN next_sms ELSE next_push END)
           IS DISTINCT FROM (to_jsonb(profile)->>field_name)::boolean
        OR (p_consents ? field_name AND NOT EXISTS(SELECT 1 FROM public.consent_log WHERE user_id=caller_id AND consent_type=replace(field_name,'_enabled',''))) THEN
        INSERT INTO public.consent_log(user_id,consent_type,consent_version,action)
        VALUES(caller_id,replace(field_name,'_enabled',''),next_privacy,
          CASE WHEN (CASE field_name WHEN 'marketing_email_enabled' THEN next_email WHEN 'marketing_sms_enabled' THEN next_sms ELSE next_push END) THEN 'granted' ELSE 'withdrawn' END);
      END IF;
    END LOOP;
  END IF;
END;
$$;
REVOKE ALL ON FUNCTION public.record_own_consents(jsonb) FROM PUBLIC, anon;
GRANT EXECUTE ON FUNCTION public.record_own_consents(jsonb) TO authenticated, service_role;
