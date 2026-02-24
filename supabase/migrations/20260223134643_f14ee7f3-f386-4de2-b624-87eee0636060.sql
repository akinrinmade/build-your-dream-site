
-- =============================================
-- HOUSECONNECT PULSE — FULL DATABASE SCHEMA
-- =============================================

-- 1. ESTATES
CREATE TABLE public.estates (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  name TEXT NOT NULL,
  city TEXT,
  state TEXT,
  is_active BOOLEAN DEFAULT true,
  created_at TIMESTAMPTZ DEFAULT now()
);
ALTER TABLE public.estates ENABLE ROW LEVEL SECURITY;

-- 2. FORMS
CREATE TABLE public.forms (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  estate_id UUID REFERENCES public.estates(id),
  name TEXT NOT NULL,
  description TEXT,
  slug TEXT UNIQUE NOT NULL,
  is_active BOOLEAN DEFAULT true,
  version INTEGER DEFAULT 1,
  ab_variant TEXT CHECK (ab_variant IN ('A', 'B')),
  created_at TIMESTAMPTZ DEFAULT now(),
  updated_at TIMESTAMPTZ DEFAULT now()
);
ALTER TABLE public.forms ENABLE ROW LEVEL SECURITY;

-- 3. QUESTIONS
CREATE TABLE public.questions (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  form_id UUID NOT NULL REFERENCES public.forms(id),
  question_text TEXT NOT NULL,
  helper_text TEXT,
  question_type TEXT NOT NULL CHECK (question_type IN ('single_choice','multiple_choice','text','textarea','rating_scale','number','dropdown','date','phone','email')),
  category_tag TEXT,
  path_tag TEXT,
  is_required BOOLEAN DEFAULT false,
  is_active BOOLEAN DEFAULT true,
  display_order INTEGER NOT NULL,
  validation_rule JSONB,
  placeholder_text TEXT,
  created_at TIMESTAMPTZ DEFAULT now(),
  updated_at TIMESTAMPTZ DEFAULT now()
);
ALTER TABLE public.questions ENABLE ROW LEVEL SECURITY;

-- 4. QUESTION OPTIONS
CREATE TABLE public.question_options (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  question_id UUID NOT NULL REFERENCES public.questions(id) ON DELETE CASCADE,
  option_text TEXT NOT NULL,
  option_value TEXT NOT NULL,
  display_order INTEGER NOT NULL,
  icon_emoji TEXT,
  created_at TIMESTAMPTZ DEFAULT now()
);
ALTER TABLE public.question_options ENABLE ROW LEVEL SECURITY;

-- 5. LOGIC RULES
CREATE TABLE public.logic_rules (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  source_question_id UUID NOT NULL REFERENCES public.questions(id),
  depends_on_question_id UUID NOT NULL REFERENCES public.questions(id),
  operator TEXT NOT NULL CHECK (operator IN ('=','!=','includes','excludes','greater_than','less_than')),
  value_to_match TEXT NOT NULL,
  action TEXT NOT NULL CHECK (action IN ('show','hide','require','flag')),
  flag_type TEXT CHECK (flag_type IN ('priority_flag','churn_risk_flag','high_referrer_flag','upsell_candidate')),
  created_at TIMESTAMPTZ DEFAULT now()
);
ALTER TABLE public.logic_rules ENABLE ROW LEVEL SECURITY;

-- 6. RESPONSES
CREATE TABLE public.responses (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  form_id UUID REFERENCES public.forms(id),
  estate_id UUID REFERENCES public.estates(id),
  submission_timestamp TIMESTAMPTZ DEFAULT now(),
  ip_address INET,
  user_agent TEXT,
  device_type TEXT CHECK (device_type IN ('mobile','tablet','desktop','unknown')),
  browser TEXT,
  os TEXT,
  session_id UUID,
  referral_source TEXT,
  utm_medium TEXT,
  utm_campaign TEXT,
  phone_number TEXT,
  customer_tier TEXT CHECK (customer_tier IN ('high_value','standard','budget')),
  source TEXT DEFAULT 'live_form' CHECK (source IN ('live_form','google_forms_import','manual_entry')),
  legacy_import BOOLEAN DEFAULT false,
  priority_flag BOOLEAN DEFAULT false,
  churn_risk_flag BOOLEAN DEFAULT false,
  high_referrer_flag BOOLEAN DEFAULT false,
  upsell_candidate BOOLEAN DEFAULT false,
  is_duplicate BOOLEAN DEFAULT false,
  reviewed_by_admin BOOLEAN DEFAULT false,
  admin_notes TEXT,
  created_at TIMESTAMPTZ DEFAULT now()
);
ALTER TABLE public.responses ENABLE ROW LEVEL SECURITY;

-- 7. ANSWERS
CREATE TABLE public.answers (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  response_id UUID NOT NULL REFERENCES public.responses(id) ON DELETE CASCADE,
  question_id UUID NOT NULL REFERENCES public.questions(id),
  answer_value TEXT NOT NULL
);
ALTER TABLE public.answers ENABLE ROW LEVEL SECURITY;

-- 8. ADMIN USERS
CREATE TABLE public.admin_users (
  id UUID PRIMARY KEY REFERENCES auth.users(id) ON DELETE CASCADE,
  email TEXT UNIQUE NOT NULL,
  full_name TEXT,
  role TEXT NOT NULL CHECK (role IN ('super_admin','editor','viewer')),
  estate_id UUID REFERENCES public.estates(id),
  last_login TIMESTAMPTZ,
  created_at TIMESTAMPTZ DEFAULT now()
);
ALTER TABLE public.admin_users ENABLE ROW LEVEL SECURITY;

-- 9. AUDIT LOG
CREATE TABLE public.audit_log (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  admin_id UUID REFERENCES public.admin_users(id),
  action TEXT NOT NULL,
  target_table TEXT,
  target_id UUID,
  before_data JSONB,
  after_data JSONB,
  created_at TIMESTAMPTZ DEFAULT now()
);
ALTER TABLE public.audit_log ENABLE ROW LEVEL SECURITY;

-- =============================================
-- INDEXES
-- =============================================
CREATE INDEX idx_responses_form_timestamp ON public.responses(form_id, submission_timestamp);
CREATE INDEX idx_responses_churn ON public.responses(churn_risk_flag) WHERE churn_risk_flag = true;
CREATE INDEX idx_responses_priority ON public.responses(priority_flag) WHERE priority_flag = true;
CREATE INDEX idx_responses_upsell ON public.responses(upsell_candidate) WHERE upsell_candidate = true;
CREATE INDEX idx_answers_response ON public.answers(response_id);
CREATE INDEX idx_answers_question ON public.answers(question_id);
CREATE INDEX idx_questions_form_order ON public.questions(form_id, display_order);
CREATE INDEX idx_logic_rules_depends ON public.logic_rules(depends_on_question_id);

-- =============================================
-- RLS POLICIES
-- =============================================
CREATE POLICY "anon_read_active_estates" ON public.estates FOR SELECT USING (is_active = true);
CREATE POLICY "admin_full_estates" ON public.estates FOR ALL USING (
  EXISTS (SELECT 1 FROM public.admin_users WHERE id = auth.uid())
);
CREATE POLICY "anon_read_active_forms" ON public.forms FOR SELECT USING (is_active = true);
CREATE POLICY "admin_full_forms" ON public.forms FOR ALL USING (
  EXISTS (SELECT 1 FROM public.admin_users WHERE id = auth.uid())
);
CREATE POLICY "anon_read_active_questions" ON public.questions FOR SELECT USING (is_active = true);
CREATE POLICY "admin_full_questions" ON public.questions FOR ALL USING (
  EXISTS (SELECT 1 FROM public.admin_users WHERE id = auth.uid())
);
CREATE POLICY "anon_read_options" ON public.question_options FOR SELECT USING (true);
CREATE POLICY "admin_full_options" ON public.question_options FOR ALL USING (
  EXISTS (SELECT 1 FROM public.admin_users WHERE id = auth.uid())
);
CREATE POLICY "anon_read_rules" ON public.logic_rules FOR SELECT USING (true);
CREATE POLICY "admin_full_rules" ON public.logic_rules FOR ALL USING (
  EXISTS (SELECT 1 FROM public.admin_users WHERE id = auth.uid())
);
CREATE POLICY "anon_insert_responses" ON public.responses FOR INSERT WITH CHECK (true);
CREATE POLICY "admin_full_responses" ON public.responses FOR ALL USING (
  EXISTS (SELECT 1 FROM public.admin_users WHERE id = auth.uid())
);
CREATE POLICY "anon_insert_answers" ON public.answers FOR INSERT WITH CHECK (true);
CREATE POLICY "admin_full_answers" ON public.answers FOR ALL USING (
  EXISTS (SELECT 1 FROM public.admin_users WHERE id = auth.uid())
);
CREATE POLICY "admin_read_self" ON public.admin_users FOR SELECT USING (id = auth.uid());
CREATE POLICY "super_admin_full" ON public.admin_users FOR ALL USING (
  EXISTS (SELECT 1 FROM public.admin_users WHERE id = auth.uid() AND role = 'super_admin')
);
CREATE POLICY "admin_read_audit" ON public.audit_log FOR SELECT USING (
  EXISTS (SELECT 1 FROM public.admin_users WHERE id = auth.uid())
);
CREATE POLICY "admin_insert_audit" ON public.audit_log FOR INSERT WITH CHECK (
  EXISTS (SELECT 1 FROM public.admin_users WHERE id = auth.uid())
);

-- =============================================
-- UPDATED_AT TRIGGER
-- =============================================
CREATE OR REPLACE FUNCTION public.update_updated_at_column()
RETURNS TRIGGER AS $$
BEGIN
  NEW.updated_at = now();
  RETURN NEW;
END;
$$ LANGUAGE plpgsql SET search_path = public;

CREATE TRIGGER update_forms_updated_at BEFORE UPDATE ON public.forms
  FOR EACH ROW EXECUTE FUNCTION public.update_updated_at_column();
CREATE TRIGGER update_questions_updated_at BEFORE UPDATE ON public.questions
  FOR EACH ROW EXECUTE FUNCTION public.update_updated_at_column();

-- =============================================
-- SEED DATA
-- =============================================

-- Seed estate
INSERT INTO public.estates (id, name, city, state) VALUES
  ('a0000001-0000-4000-8000-000000000001', 'HouseConnect Main Estate', 'Lagos', 'Lagos');

-- Seed form
INSERT INTO public.forms (id, estate_id, name, description, slug) VALUES
  ('f0000001-0000-4000-8000-000000000001', 'a0000001-0000-4000-8000-000000000001', 'HouseConnect Smart Feedback', 'Internet Experience, Profiling & Referral Survey', 'feedback');

-- ENTRY GATE (order 1)
INSERT INTO public.questions (id, form_id, question_text, question_type, category_tag, path_tag, is_required, display_order) VALUES
  ('10000001-0000-4000-8000-000000000001', 'f0000001-0000-4000-8000-000000000001', 'What would you like to do today?', 'single_choice', 'entry', 'ENTRY', true, 1);
INSERT INTO public.question_options (question_id, option_text, option_value, display_order, icon_emoji) VALUES
  ('10000001-0000-4000-8000-000000000001', 'Improve Speed / Streaming', 'PATH_A', 1, '🚀'),
  ('10000001-0000-4000-8000-000000000001', 'Suggest Better Plans or Pricing', 'PATH_B', 2, '💳'),
  ('10000001-0000-4000-8000-000000000001', 'Report Signal / Connection Issue', 'PATH_C', 3, '📶'),
  ('10000001-0000-4000-8000-000000000001', 'Report an Urgent Problem', 'PATH_D', 4, '🚨'),
  ('10000001-0000-4000-8000-000000000001', 'Refer Friends & Earn Rewards', 'PATH_E', 5, '🎁'),
  ('10000001-0000-4000-8000-000000000001', 'I''m new here — set up my profile', 'PATH_F', 6, '🏠');

-- PATH A (10-14)
INSERT INTO public.questions (id, form_id, question_text, question_type, category_tag, path_tag, is_required, display_order) VALUES
  ('10000001-0000-4000-8000-000000000010', 'f0000001-0000-4000-8000-000000000001', 'What feels slow for you?', 'single_choice', 'speed_issue', 'PATH_A', true, 10),
  ('10000001-0000-4000-8000-000000000011', 'f0000001-0000-4000-8000-000000000001', 'When is it usually slow?', 'single_choice', 'usage_time', 'PATH_A', false, 11),
  ('10000001-0000-4000-8000-000000000012', 'f0000001-0000-4000-8000-000000000001', 'How many devices are using the WiFi right now?', 'single_choice', 'device_count', 'PATH_A', false, 12),
  ('10000001-0000-4000-8000-000000000013', 'f0000001-0000-4000-8000-000000000001', 'Rate your internet speed RIGHT NOW (1 = very poor, 5 = excellent)', 'rating_scale', 'speed_rating', 'PATH_A', true, 13),
  ('10000001-0000-4000-8000-000000000014', 'f0000001-0000-4000-8000-000000000001', 'Which plan are you currently on?', 'single_choice', 'current_plan', 'PATH_A', false, 14);
INSERT INTO public.question_options (question_id, option_text, option_value, display_order, icon_emoji) VALUES
  ('10000001-0000-4000-8000-000000000010', 'Movies / YouTube', 'movies_youtube', 1, '🎬'),
  ('10000001-0000-4000-8000-000000000010', 'Live Sports', 'live_sports', 2, '🏆'),
  ('10000001-0000-4000-8000-000000000010', 'Social Media', 'social_media', 3, '📱'),
  ('10000001-0000-4000-8000-000000000010', 'Work / School Portal', 'work_school', 4, '💼'),
  ('10000001-0000-4000-8000-000000000010', 'Gaming', 'gaming', 5, '🎮'),
  ('10000001-0000-4000-8000-000000000010', 'Video Calls', 'video_calls', 6, '📞'),
  ('10000001-0000-4000-8000-000000000011', 'Morning (8AM – 12PM)', 'morning', 1, '🌅'),
  ('10000001-0000-4000-8000-000000000011', 'Afternoon (12PM – 5PM)', 'afternoon', 2, '☀'),
  ('10000001-0000-4000-8000-000000000011', 'Evening (5PM – 10PM)', 'evening', 3, '🌆'),
  ('10000001-0000-4000-8000-000000000011', 'Late Night (10PM+)', 'late_night', 4, '🌙'),
  ('10000001-0000-4000-8000-000000000011', 'Always slow', 'always', 5, '⚡'),
  ('10000001-0000-4000-8000-000000000012', 'Just me (1)', '1', 1, NULL),
  ('10000001-0000-4000-8000-000000000012', '2–3 devices', '2-3', 2, NULL),
  ('10000001-0000-4000-8000-000000000012', '4–6 devices', '4-6', 3, NULL),
  ('10000001-0000-4000-8000-000000000012', '7 or more', '7+', 4, NULL),
  ('10000001-0000-4000-8000-000000000014', 'Daily', 'daily', 1, NULL),
  ('10000001-0000-4000-8000-000000000014', 'Weekly', 'weekly', 2, NULL),
  ('10000001-0000-4000-8000-000000000014', 'Monthly', 'monthly', 3, NULL),
  ('10000001-0000-4000-8000-000000000014', 'I don''t know', 'unknown', 4, NULL);

-- PATH B (20-23)
INSERT INTO public.questions (id, form_id, question_text, question_type, category_tag, path_tag, is_required, display_order, placeholder_text) VALUES
  ('10000001-0000-4000-8000-000000000020', 'f0000001-0000-4000-8000-000000000001', 'Which new mini-plan would interest you most?', 'single_choice', 'upsell', 'PATH_B', false, 20, NULL),
  ('10000001-0000-4000-8000-000000000021', 'f0000001-0000-4000-8000-000000000001', 'What is your preferred payment method?', 'single_choice', 'payment', 'PATH_B', false, 21, NULL),
  ('10000001-0000-4000-8000-000000000022', 'f0000001-0000-4000-8000-000000000001', 'What would make you upgrade your plan?', 'multiple_choice', 'upsell', 'PATH_B', false, 22, NULL),
  ('10000001-0000-4000-8000-000000000023', 'f0000001-0000-4000-8000-000000000001', 'How much do you currently spend per month on internet? (₦)', 'number', 'spend', 'PATH_B', false, 23, 'e.g. 3000');
INSERT INTO public.question_options (question_id, option_text, option_value, display_order, icon_emoji) VALUES
  ('10000001-0000-4000-8000-000000000020', 'Night Unlimited (12AM – 5AM)', 'night_unlimited', 1, '🌙'),
  ('10000001-0000-4000-8000-000000000020', '2-Hour High-Speed Boost', 'speed_boost', 2, '⚡'),
  ('10000001-0000-4000-8000-000000000020', 'Social Only Plan', 'social_only', 3, '📱'),
  ('10000001-0000-4000-8000-000000000020', 'Gamer Plan (Low Lag)', 'gamer', 4, '🎮'),
  ('10000001-0000-4000-8000-000000000020', 'Flexible Daily Plan', 'daily_flex', 5, '📅'),
  ('10000001-0000-4000-8000-000000000021', 'Bank Transfer', 'bank_transfer', 1, '🏦'),
  ('10000001-0000-4000-8000-000000000021', 'USSD', 'ussd', 2, '📲'),
  ('10000001-0000-4000-8000-000000000021', 'Card Payment', 'card', 3, '💳'),
  ('10000001-0000-4000-8000-000000000021', 'WhatsApp Payment Link', 'whatsapp_pay', 4, '💬'),
  ('10000001-0000-4000-8000-000000000021', 'Auto-Subscription', 'auto_sub', 5, '🔄'),
  ('10000001-0000-4000-8000-000000000022', 'Faster speed', 'faster_speed', 1, NULL),
  ('10000001-0000-4000-8000-000000000022', 'Cheaper price', 'cheaper_price', 2, NULL),
  ('10000001-0000-4000-8000-000000000022', 'Longer validity', 'longer_validity', 3, NULL),
  ('10000001-0000-4000-8000-000000000022', 'Better night speeds', 'night_speeds', 4, NULL),
  ('10000001-0000-4000-8000-000000000022', 'Family / shared plan option', 'family_plan', 5, NULL);

-- PATH C (30-34)
INSERT INTO public.questions (id, form_id, question_text, question_type, category_tag, path_tag, is_required, display_order) VALUES
  ('10000001-0000-4000-8000-000000000030', 'f0000001-0000-4000-8000-000000000001', 'Where are you connecting from right now?', 'single_choice', 'location_context', 'PATH_C', false, 30),
  ('10000001-0000-4000-8000-000000000031', 'f0000001-0000-4000-8000-000000000001', 'Which device is affected?', 'multiple_choice', 'device', 'PATH_C', false, 31),
  ('10000001-0000-4000-8000-000000000032', 'f0000001-0000-4000-8000-000000000001', 'How many WiFi bars do you see?', 'single_choice', 'signal_strength', 'PATH_C', false, 32),
  ('10000001-0000-4000-8000-000000000033', 'f0000001-0000-4000-8000-000000000001', 'How long has this issue been happening?', 'single_choice', 'issue_duration', 'PATH_C', false, 33),
  ('10000001-0000-4000-8000-000000000034', 'f0000001-0000-4000-8000-000000000001', 'Have you restarted your device or router?', 'single_choice', 'troubleshoot', 'PATH_C', false, 34);
INSERT INTO public.question_options (question_id, option_text, option_value, display_order, icon_emoji) VALUES
  ('10000001-0000-4000-8000-000000000030', 'Inside my room', 'room', 1, '🛏'),
  ('10000001-0000-4000-8000-000000000030', 'Balcony / Outside', 'balcony', 2, '🏠'),
  ('10000001-0000-4000-8000-000000000030', 'Moving around the compound', 'moving', 3, '🚶'),
  ('10000001-0000-4000-8000-000000000030', 'Common area', 'common', 4, '🏢'),
  ('10000001-0000-4000-8000-000000000031', 'Android Phone', 'android', 1, '📱'),
  ('10000001-0000-4000-8000-000000000031', 'iPhone', 'iphone', 2, '🍎'),
  ('10000001-0000-4000-8000-000000000031', 'Laptop', 'laptop', 3, '💻'),
  ('10000001-0000-4000-8000-000000000031', 'Smart TV', 'smart_tv', 4, '📺'),
  ('10000001-0000-4000-8000-000000000031', 'Gaming Console', 'console', 5, '🎮'),
  ('10000001-0000-4000-8000-000000000032', 'Full signal (4 bars)', '4', 1, '📶'),
  ('10000001-0000-4000-8000-000000000032', '3 bars', '3', 2, '📶'),
  ('10000001-0000-4000-8000-000000000032', '2 bars', '2', 3, '📶'),
  ('10000001-0000-4000-8000-000000000032', '1 bar', '1', 4, '📶'),
  ('10000001-0000-4000-8000-000000000032', 'No signal at all', '0', 5, '❌'),
  ('10000001-0000-4000-8000-000000000033', 'Just started', 'just_started', 1, NULL),
  ('10000001-0000-4000-8000-000000000033', 'A few hours', 'few_hours', 2, NULL),
  ('10000001-0000-4000-8000-000000000033', 'Since yesterday', 'yesterday', 3, NULL),
  ('10000001-0000-4000-8000-000000000033', 'Over a week', 'over_week', 4, NULL),
  ('10000001-0000-4000-8000-000000000034', 'Yes — it didn''t help', 'yes_no_help', 1, NULL),
  ('10000001-0000-4000-8000-000000000034', 'Yes — it helped briefly', 'yes_brief', 2, NULL),
  ('10000001-0000-4000-8000-000000000034', 'No, not yet', 'no', 3, NULL);

-- PATH D (40-43)
INSERT INTO public.questions (id, form_id, question_text, question_type, category_tag, path_tag, is_required, display_order, placeholder_text) VALUES
  ('10000001-0000-4000-8000-000000000040', 'f0000001-0000-4000-8000-000000000001', 'Describe your urgent issue in detail', 'textarea', 'support', 'PATH_D', true, 40, 'Please describe exactly what''s happening...'),
  ('10000001-0000-4000-8000-000000000041', 'f0000001-0000-4000-8000-000000000001', 'When did this problem start?', 'single_choice', 'issue_start', 'PATH_D', false, 41, NULL),
  ('10000001-0000-4000-8000-000000000042', 'f0000001-0000-4000-8000-000000000001', 'Is your internet completely down or just slow?', 'single_choice', 'issue_severity', 'PATH_D', false, 42, NULL),
  ('10000001-0000-4000-8000-000000000043', 'f0000001-0000-4000-8000-000000000001', 'How should we contact you first?', 'single_choice', 'contact_pref', 'PATH_D', true, 43, NULL);
INSERT INTO public.question_options (question_id, option_text, option_value, display_order, icon_emoji) VALUES
  ('10000001-0000-4000-8000-000000000041', 'Within the last hour', 'last_hour', 1, NULL),
  ('10000001-0000-4000-8000-000000000041', 'Earlier today', 'today', 2, NULL),
  ('10000001-0000-4000-8000-000000000041', 'Yesterday', 'yesterday', 3, NULL),
  ('10000001-0000-4000-8000-000000000041', 'This week', 'this_week', 4, NULL),
  ('10000001-0000-4000-8000-000000000041', 'Longer than a week', 'over_week', 5, NULL),
  ('10000001-0000-4000-8000-000000000042', 'Completely down — no connection at all', 'down', 1, NULL),
  ('10000001-0000-4000-8000-000000000042', 'Very slow but connected', 'slow', 2, NULL),
  ('10000001-0000-4000-8000-000000000042', 'Keeps disconnecting and reconnecting', 'intermittent', 3, NULL),
  ('10000001-0000-4000-8000-000000000042', 'Other', 'other', 4, NULL),
  ('10000001-0000-4000-8000-000000000043', 'Phone Call', 'phone', 1, '📞'),
  ('10000001-0000-4000-8000-000000000043', 'WhatsApp', 'whatsapp', 2, '💬'),
  ('10000001-0000-4000-8000-000000000043', 'Either is fine', 'either', 3, NULL);

-- PATH E (50-53)
INSERT INTO public.questions (id, form_id, question_text, question_type, category_tag, path_tag, is_required, display_order) VALUES
  ('10000001-0000-4000-8000-000000000050', 'f0000001-0000-4000-8000-000000000001', 'Why haven''t your friends subscribed to HouseConnect yet?', 'multiple_choice', 'referral_barrier', 'PATH_E', false, 50),
  ('10000001-0000-4000-8000-000000000051', 'f0000001-0000-4000-8000-000000000001', 'How many friends in this estate can you refer?', 'single_choice', 'referral_volume', 'PATH_E', true, 51),
  ('10000001-0000-4000-8000-000000000052', 'f0000001-0000-4000-8000-000000000001', 'What reward would motivate you to refer more?', 'single_choice', 'referral_incentive', 'PATH_E', false, 52),
  ('10000001-0000-4000-8000-000000000053', 'f0000001-0000-4000-8000-000000000001', 'Would you share a referral link if we gave you one right now?', 'single_choice', 'referral_readiness', 'PATH_E', false, 53);
INSERT INTO public.question_options (question_id, option_text, option_value, display_order, icon_emoji) VALUES
  ('10000001-0000-4000-8000-000000000050', 'They don''t know coverage exists here', 'no_awareness', 1, NULL),
  ('10000001-0000-4000-8000-000000000050', 'They prefer mobile data', 'prefer_mobile', 2, NULL),
  ('10000001-0000-4000-8000-000000000050', 'They think it''s too expensive', 'too_expensive', 3, NULL),
  ('10000001-0000-4000-8000-000000000050', 'They don''t understand how to subscribe', 'confusing', 4, NULL),
  ('10000001-0000-4000-8000-000000000050', 'Not sure they''ll use it enough', 'low_usage', 5, NULL),
  ('10000001-0000-4000-8000-000000000051', 'Just 1', '1', 1, NULL),
  ('10000001-0000-4000-8000-000000000051', '2–3 friends', '2-3', 2, NULL),
  ('10000001-0000-4000-8000-000000000051', '4–5 friends', '4-5', 3, NULL),
  ('10000001-0000-4000-8000-000000000051', 'More than 5 friends', '5+', 4, NULL),
  ('10000001-0000-4000-8000-000000000052', 'Free data bonus', 'free_data', 1, '🎁'),
  ('10000001-0000-4000-8000-000000000052', 'Cash reward', 'cash', 2, '💰'),
  ('10000001-0000-4000-8000-000000000052', 'Discount on my plan', 'discount', 3, '📉'),
  ('10000001-0000-4000-8000-000000000052', 'Points / loyalty system', 'points', 4, '🏆'),
  ('10000001-0000-4000-8000-000000000052', 'I just want to help my friends', 'altruistic', 5, NULL),
  ('10000001-0000-4000-8000-000000000053', 'Yes, absolutely', 'yes', 1, NULL),
  ('10000001-0000-4000-8000-000000000053', 'Maybe — tell me more', 'maybe', 2, NULL),
  ('10000001-0000-4000-8000-000000000053', 'I need more info first', 'need_info', 3, NULL);

-- PATH F (60-70)
INSERT INTO public.questions (id, form_id, question_text, question_type, category_tag, path_tag, is_required, display_order, helper_text, placeholder_text, validation_rule) VALUES
  ('10000001-0000-4000-8000-000000000060', 'f0000001-0000-4000-8000-000000000001', 'How many devices do you connect to the internet?', 'single_choice', 'device_count', 'PATH_F', true, 60, NULL, NULL, NULL),
  ('10000001-0000-4000-8000-000000000061', 'f0000001-0000-4000-8000-000000000001', 'How much do you currently spend on data every month?', 'single_choice', 'current_spend', 'PATH_F', true, 61, NULL, NULL, NULL),
  ('10000001-0000-4000-8000-000000000062', 'f0000001-0000-4000-8000-000000000001', 'How much data do you typically use per month?', 'single_choice', 'usage_volume', 'PATH_F', true, 62, NULL, NULL, NULL),
  ('10000001-0000-4000-8000-000000000063', 'f0000001-0000-4000-8000-000000000001', 'Would you prefer an unlimited internet plan within the estate?', 'single_choice', 'plan_preference', 'PATH_F', true, 63, NULL, NULL, NULL),
  ('10000001-0000-4000-8000-000000000064', 'f0000001-0000-4000-8000-000000000001', 'How much would you pay monthly for unlimited internet here?', 'single_choice', 'willingness_to_pay', 'PATH_F', true, 64, NULL, NULL, NULL),
  ('10000001-0000-4000-8000-000000000065', 'f0000001-0000-4000-8000-000000000001', 'What times do you use the internet most?', 'multiple_choice', 'usage_time', 'PATH_F', true, 65, NULL, NULL, NULL),
  ('10000001-0000-4000-8000-000000000066', 'f0000001-0000-4000-8000-000000000001', 'What do you mostly use the internet for?', 'multiple_choice', 'usage_type', 'PATH_F', true, 66, NULL, NULL, NULL),
  ('10000001-0000-4000-8000-000000000067', 'f0000001-0000-4000-8000-000000000001', 'Do you experience network issues inside the building?', 'single_choice', 'existing_pain', 'PATH_F', true, 67, NULL, NULL, NULL),
  ('10000001-0000-4000-8000-000000000068', 'f0000001-0000-4000-8000-000000000001', 'During peak hours, should heavy downloaders be deprioritized to keep speeds fair for everyone?', 'single_choice', 'policy_preference', 'PATH_F', false, 68, 'This helps us understand your preference for managing shared bandwidth.', NULL, NULL),
  ('10000001-0000-4000-8000-000000000069', 'f0000001-0000-4000-8000-000000000001', 'Phone Number for SMS Notifications', 'phone', 'identity', 'PATH_F', false, 69, 'We''ll only send service updates. No spam, ever.', '+234 XXX XXX XXXX', '{"type":"phone","country":"NG"}'),
  ('10000001-0000-4000-8000-000000000070', 'f0000001-0000-4000-8000-000000000001', 'Any comments, suggestions, or questions for us?', 'textarea', 'open_feedback', 'PATH_F', false, 70, NULL, 'Pricing ideas, concerns, what you wish the service offered...', NULL);
INSERT INTO public.question_options (question_id, option_text, option_value, display_order, icon_emoji) VALUES
  ('10000001-0000-4000-8000-000000000060', '1 device', '1', 1, '📱'),
  ('10000001-0000-4000-8000-000000000060', '2 devices', '2', 2, '📱💻'),
  ('10000001-0000-4000-8000-000000000060', '3 devices', '3', 3, '📱💻🖥'),
  ('10000001-0000-4000-8000-000000000060', '4 or more', '4+', 4, '📱📱💻🖥'),
  ('10000001-0000-4000-8000-000000000061', 'Less than ₦5,000', 'lt_5000', 1, NULL),
  ('10000001-0000-4000-8000-000000000061', '₦5,000 – ₦10,000', '5000_10000', 2, NULL),
  ('10000001-0000-4000-8000-000000000061', '₦10,000 – ₦15,000', '10000_15000', 3, NULL),
  ('10000001-0000-4000-8000-000000000061', 'Above ₦15,000', 'gt_15000', 4, NULL),
  ('10000001-0000-4000-8000-000000000062', 'Less than 10GB', 'lt_10gb', 1, NULL),
  ('10000001-0000-4000-8000-000000000062', '10GB – 20GB', '10_20gb', 2, NULL),
  ('10000001-0000-4000-8000-000000000062', '25GB – 50GB', '25_50gb', 3, NULL),
  ('10000001-0000-4000-8000-000000000062', '50GB and above', 'gt_50gb', 4, NULL),
  ('10000001-0000-4000-8000-000000000063', 'Yes, definitely', 'yes', 1, '✅'),
  ('10000001-0000-4000-8000-000000000063', 'No — I prefer pay-as-I-go', 'no', 2, '❌'),
  ('10000001-0000-4000-8000-000000000063', 'Not sure yet', 'unsure', 3, '🤔'),
  ('10000001-0000-4000-8000-000000000064', 'Less than ₦5,000', 'lt_5000', 1, NULL),
  ('10000001-0000-4000-8000-000000000064', '₦5,000 – ₦10,000', '5000_10000', 2, NULL),
  ('10000001-0000-4000-8000-000000000064', '₦10,000 – ₦15,000', '10000_15000', 3, NULL),
  ('10000001-0000-4000-8000-000000000064', 'Above ₦15,000', 'gt_15000', 4, NULL),
  ('10000001-0000-4000-8000-000000000064', 'I''d need to see the plan details first', 'need_details', 5, NULL),
  ('10000001-0000-4000-8000-000000000065', 'Morning (6AM – 12PM)', 'morning', 1, '🌅'),
  ('10000001-0000-4000-8000-000000000065', 'Afternoon (12PM – 6PM)', 'afternoon', 2, '☀'),
  ('10000001-0000-4000-8000-000000000065', 'Evening (6PM – 12AM)', 'evening', 3, '🌆'),
  ('10000001-0000-4000-8000-000000000065', 'Late Night (12AM – 6AM)', 'late_night', 4, '🌙'),
  ('10000001-0000-4000-8000-000000000065', 'Anytime — I''m always online', 'always', 5, '⚡'),
  ('10000001-0000-4000-8000-000000000066', 'Social Media (WhatsApp, Instagram, TikTok)', 'social', 1, '💬'),
  ('10000001-0000-4000-8000-000000000066', 'Streaming (YouTube, Netflix, Showmax)', 'streaming', 2, '🎬'),
  ('10000001-0000-4000-8000-000000000066', 'Online Classes or Remote Work', 'work', 3, '📚'),
  ('10000001-0000-4000-8000-000000000066', 'Gaming', 'gaming', 4, '🎮'),
  ('10000001-0000-4000-8000-000000000066', 'Browsing & Research', 'browsing', 5, '🔍'),
  ('10000001-0000-4000-8000-000000000066', 'Online Business / E-commerce', 'business', 6, '💰'),
  ('10000001-0000-4000-8000-000000000066', 'Other', 'other', 7, NULL),
  ('10000001-0000-4000-8000-000000000067', 'Yes, frequently', 'frequently', 1, '🔴'),
  ('10000001-0000-4000-8000-000000000067', 'Occasionally', 'occasionally', 2, '🟡'),
  ('10000001-0000-4000-8000-000000000067', 'No — network is usually fine', 'fine', 3, '🟢'),
  ('10000001-0000-4000-8000-000000000068', 'Yes — fairness matters more', 'yes', 1, '✅'),
  ('10000001-0000-4000-8000-000000000068', 'No — I want full speed always', 'no', 2, '❌'),
  ('10000001-0000-4000-8000-000000000068', 'No strong preference', 'neutral', 3, '🤷');

-- UNIVERSAL (90-95)
INSERT INTO public.questions (id, form_id, question_text, question_type, category_tag, path_tag, is_required, display_order, placeholder_text, validation_rule) VALUES
  ('10000001-0000-4000-8000-000000000090', 'f0000001-0000-4000-8000-000000000001', 'Your Full Name', 'text', 'identity', 'UNIVERSAL', true, 90, 'First and last name', NULL),
  ('10000001-0000-4000-8000-000000000091', 'f0000001-0000-4000-8000-000000000001', 'WhatsApp Number', 'phone', 'identity', 'UNIVERSAL', true, 91, '+234 XXX XXX XXXX', '{"type":"phone","country":"NG","format":"+234XXXXXXXXXX"}'),
  ('10000001-0000-4000-8000-000000000092', 'f0000001-0000-4000-8000-000000000001', 'Room Number or Location (Optional)', 'text', 'identity', 'UNIVERSAL', false, 92, 'e.g. Block B, Room 12', NULL),
  ('10000001-0000-4000-8000-000000000093', 'f0000001-0000-4000-8000-000000000001', 'Rate your overall HouseConnect experience', 'single_choice', 'sentiment', 'UNIVERSAL', false, 93, NULL, NULL),
  ('10000001-0000-4000-8000-000000000094', 'f0000001-0000-4000-8000-000000000001', 'If HouseConnect shut down tomorrow, how would you feel?', 'single_choice', 'churn_signal', 'UNIVERSAL', false, 94, NULL, NULL),
  ('10000001-0000-4000-8000-000000000095', 'f0000001-0000-4000-8000-000000000001', 'Anything else you want us to know?', 'textarea', 'open_feedback', 'UNIVERSAL', false, 95, 'Suggestions, complaints, compliments — we read everything', NULL);
INSERT INTO public.question_options (question_id, option_text, option_value, display_order, icon_emoji) VALUES
  ('10000001-0000-4000-8000-000000000093', 'Poor', 'poor', 1, '😞'),
  ('10000001-0000-4000-8000-000000000093', 'Average', 'average', 2, '😐'),
  ('10000001-0000-4000-8000-000000000093', 'Good', 'good', 3, '🙂'),
  ('10000001-0000-4000-8000-000000000093', 'Excellent', 'excellent', 4, '😍'),
  ('10000001-0000-4000-8000-000000000094', 'Not bothered', 'not_bothered', 1, NULL),
  ('10000001-0000-4000-8000-000000000094', 'Slightly disappointed', 'slightly', 2, NULL),
  ('10000001-0000-4000-8000-000000000094', 'Very disappointed', 'very', 3, NULL),
  ('10000001-0000-4000-8000-000000000094', 'I would be devastated', 'devastated', 4, NULL);

-- =============================================
-- LOGIC RULES (branching + flags)
-- =============================================
INSERT INTO public.logic_rules (source_question_id, depends_on_question_id, operator, value_to_match, action) VALUES
  ('10000001-0000-4000-8000-000000000010', '10000001-0000-4000-8000-000000000001', '=', 'PATH_A', 'show'),
  ('10000001-0000-4000-8000-000000000011', '10000001-0000-4000-8000-000000000001', '=', 'PATH_A', 'show'),
  ('10000001-0000-4000-8000-000000000012', '10000001-0000-4000-8000-000000000001', '=', 'PATH_A', 'show'),
  ('10000001-0000-4000-8000-000000000013', '10000001-0000-4000-8000-000000000001', '=', 'PATH_A', 'show'),
  ('10000001-0000-4000-8000-000000000014', '10000001-0000-4000-8000-000000000001', '=', 'PATH_A', 'show'),
  ('10000001-0000-4000-8000-000000000020', '10000001-0000-4000-8000-000000000001', '=', 'PATH_B', 'show'),
  ('10000001-0000-4000-8000-000000000021', '10000001-0000-4000-8000-000000000001', '=', 'PATH_B', 'show'),
  ('10000001-0000-4000-8000-000000000022', '10000001-0000-4000-8000-000000000001', '=', 'PATH_B', 'show'),
  ('10000001-0000-4000-8000-000000000023', '10000001-0000-4000-8000-000000000001', '=', 'PATH_B', 'show'),
  ('10000001-0000-4000-8000-000000000030', '10000001-0000-4000-8000-000000000001', '=', 'PATH_C', 'show'),
  ('10000001-0000-4000-8000-000000000031', '10000001-0000-4000-8000-000000000001', '=', 'PATH_C', 'show'),
  ('10000001-0000-4000-8000-000000000032', '10000001-0000-4000-8000-000000000001', '=', 'PATH_C', 'show'),
  ('10000001-0000-4000-8000-000000000033', '10000001-0000-4000-8000-000000000001', '=', 'PATH_C', 'show'),
  ('10000001-0000-4000-8000-000000000034', '10000001-0000-4000-8000-000000000001', '=', 'PATH_C', 'show'),
  ('10000001-0000-4000-8000-000000000040', '10000001-0000-4000-8000-000000000001', '=', 'PATH_D', 'show'),
  ('10000001-0000-4000-8000-000000000041', '10000001-0000-4000-8000-000000000001', '=', 'PATH_D', 'show'),
  ('10000001-0000-4000-8000-000000000042', '10000001-0000-4000-8000-000000000001', '=', 'PATH_D', 'show'),
  ('10000001-0000-4000-8000-000000000043', '10000001-0000-4000-8000-000000000001', '=', 'PATH_D', 'show'),
  ('10000001-0000-4000-8000-000000000050', '10000001-0000-4000-8000-000000000001', '=', 'PATH_E', 'show'),
  ('10000001-0000-4000-8000-000000000051', '10000001-0000-4000-8000-000000000001', '=', 'PATH_E', 'show'),
  ('10000001-0000-4000-8000-000000000052', '10000001-0000-4000-8000-000000000001', '=', 'PATH_E', 'show'),
  ('10000001-0000-4000-8000-000000000053', '10000001-0000-4000-8000-000000000001', '=', 'PATH_E', 'show'),
  ('10000001-0000-4000-8000-000000000060', '10000001-0000-4000-8000-000000000001', '=', 'PATH_F', 'show'),
  ('10000001-0000-4000-8000-000000000061', '10000001-0000-4000-8000-000000000001', '=', 'PATH_F', 'show'),
  ('10000001-0000-4000-8000-000000000062', '10000001-0000-4000-8000-000000000001', '=', 'PATH_F', 'show'),
  ('10000001-0000-4000-8000-000000000063', '10000001-0000-4000-8000-000000000001', '=', 'PATH_F', 'show'),
  ('10000001-0000-4000-8000-000000000064', '10000001-0000-4000-8000-000000000001', '=', 'PATH_F', 'show'),
  ('10000001-0000-4000-8000-000000000065', '10000001-0000-4000-8000-000000000001', '=', 'PATH_F', 'show'),
  ('10000001-0000-4000-8000-000000000066', '10000001-0000-4000-8000-000000000001', '=', 'PATH_F', 'show'),
  ('10000001-0000-4000-8000-000000000067', '10000001-0000-4000-8000-000000000001', '=', 'PATH_F', 'show'),
  ('10000001-0000-4000-8000-000000000068', '10000001-0000-4000-8000-000000000001', '=', 'PATH_F', 'show'),
  ('10000001-0000-4000-8000-000000000069', '10000001-0000-4000-8000-000000000001', '=', 'PATH_F', 'show'),
  ('10000001-0000-4000-8000-000000000070', '10000001-0000-4000-8000-000000000001', '=', 'PATH_F', 'show');

-- Flag rules
INSERT INTO public.logic_rules (source_question_id, depends_on_question_id, operator, value_to_match, action, flag_type) VALUES
  ('10000001-0000-4000-8000-000000000022', '10000001-0000-4000-8000-000000000022', 'includes', 'faster_speed', 'flag', 'upsell_candidate'),
  ('10000001-0000-4000-8000-000000000022', '10000001-0000-4000-8000-000000000022', 'includes', 'longer_validity', 'flag', 'upsell_candidate'),
  ('10000001-0000-4000-8000-000000000051', '10000001-0000-4000-8000-000000000051', '=', '5+', 'flag', 'high_referrer_flag'),
  ('10000001-0000-4000-8000-000000000061', '10000001-0000-4000-8000-000000000061', '=', 'gt_15000', 'flag', 'upsell_candidate'),
  ('10000001-0000-4000-8000-000000000067', '10000001-0000-4000-8000-000000000067', '=', 'frequently', 'flag', 'priority_flag'),
  ('10000001-0000-4000-8000-000000000094', '10000001-0000-4000-8000-000000000094', '=', 'not_bothered', 'flag', 'churn_risk_flag');

-- Enable realtime on responses
ALTER PUBLICATION supabase_realtime ADD TABLE public.responses;
