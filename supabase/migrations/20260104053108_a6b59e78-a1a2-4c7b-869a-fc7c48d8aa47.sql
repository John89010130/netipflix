-- =============================================
-- FASE 1: Estrutura de Perfis e Assinaturas
-- =============================================

-- Tabela de assinaturas de clientes (controle de telas)
CREATE TABLE public.client_subscriptions (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id UUID NOT NULL UNIQUE,
  max_screens INTEGER NOT NULL DEFAULT 1,
  price_per_screen NUMERIC(10,2) NOT NULL DEFAULT 5.00,
  is_active BOOLEAN NOT NULL DEFAULT true,
  expires_at TIMESTAMP WITH TIME ZONE,
  created_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now(),
  updated_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now()
);

-- Tabela de sub-perfis (estilo Netflix)
CREATE TABLE public.client_profiles (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  parent_user_id UUID NOT NULL,
  name TEXT NOT NULL,
  avatar_url TEXT,
  pin TEXT, -- 4 dígitos opcional
  is_kids_profile BOOLEAN NOT NULL DEFAULT false,
  created_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now(),
  updated_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now()
);

-- Tabela de sessões ativas
CREATE TABLE public.active_sessions (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id UUID NOT NULL, -- usuário pai
  profile_id UUID, -- pode ser sub-perfil ou null se for o pai
  device_info TEXT,
  ip_address TEXT,
  started_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now(),
  last_activity TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now()
);

-- =============================================
-- FASE 2: Sistema de Chat de Suporte
-- =============================================

-- Tabela de conversas de suporte
CREATE TABLE public.support_conversations (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id UUID NOT NULL,
  subject TEXT NOT NULL,
  status TEXT NOT NULL DEFAULT 'open', -- open, closed
  created_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now(),
  updated_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now()
);

-- Tabela de mensagens de suporte
CREATE TABLE public.support_messages (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  conversation_id UUID NOT NULL REFERENCES public.support_conversations(id) ON DELETE CASCADE,
  sender_id UUID NOT NULL,
  sender_type TEXT NOT NULL, -- 'user' ou 'admin'
  message TEXT NOT NULL,
  read_at TIMESTAMP WITH TIME ZONE,
  created_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now()
);

-- =============================================
-- FASE 3: Funções de Banco de Dados
-- =============================================

-- Função para verificar disponibilidade de sessão
CREATE OR REPLACE FUNCTION public.check_session_availability(_user_id UUID)
RETURNS JSON
LANGUAGE plpgsql
STABLE
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  _max_screens INTEGER;
  _active_count INTEGER;
  _is_active BOOLEAN;
BEGIN
  -- Buscar limite de telas do usuário
  SELECT max_screens, is_active INTO _max_screens, _is_active
  FROM public.client_subscriptions
  WHERE user_id = _user_id;
  
  -- Se não tem subscription, permitir 1 tela por padrão
  IF _max_screens IS NULL THEN
    _max_screens := 1;
    _is_active := true;
  END IF;
  
  -- Contar sessões ativas (últimos 2 minutos)
  SELECT COUNT(*) INTO _active_count
  FROM public.active_sessions
  WHERE user_id = _user_id
    AND last_activity > now() - interval '2 minutes';
  
  RETURN json_build_object(
    'available', _is_active AND (_active_count < _max_screens),
    'active_count', _active_count,
    'max_screens', _max_screens,
    'is_active', _is_active
  );
END;
$$;

-- Função para limpar sessões inativas
CREATE OR REPLACE FUNCTION public.cleanup_inactive_sessions()
RETURNS INTEGER
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  _deleted INTEGER;
BEGIN
  DELETE FROM public.active_sessions
  WHERE last_activity < now() - interval '5 minutes';
  
  GET DIAGNOSTICS _deleted = ROW_COUNT;
  RETURN _deleted;
END;
$$;

-- Função para verificar se é usuário pai
CREATE OR REPLACE FUNCTION public.is_parent_user(_user_id UUID)
RETURNS BOOLEAN
LANGUAGE sql
STABLE
SECURITY DEFINER
SET search_path = public
AS $$
  SELECT EXISTS (
    SELECT 1 FROM public.profiles WHERE id = _user_id
  ) AND NOT EXISTS (
    SELECT 1 FROM public.client_profiles WHERE id = _user_id
  )
$$;

-- Função para contar perfis de um usuário
CREATE OR REPLACE FUNCTION public.count_user_profiles(_parent_user_id UUID)
RETURNS INTEGER
LANGUAGE sql
STABLE
SECURITY DEFINER
SET search_path = public
AS $$
  SELECT COUNT(*)::INTEGER FROM public.client_profiles WHERE parent_user_id = _parent_user_id
$$;

-- =============================================
-- FASE 4: Triggers
-- =============================================

-- Trigger para atualizar updated_at
CREATE TRIGGER update_client_subscriptions_updated_at
  BEFORE UPDATE ON public.client_subscriptions
  FOR EACH ROW
  EXECUTE FUNCTION public.update_updated_at_column();

CREATE TRIGGER update_client_profiles_updated_at
  BEFORE UPDATE ON public.client_profiles
  FOR EACH ROW
  EXECUTE FUNCTION public.update_updated_at_column();

CREATE TRIGGER update_support_conversations_updated_at
  BEFORE UPDATE ON public.support_conversations
  FOR EACH ROW
  EXECUTE FUNCTION public.update_updated_at_column();

-- =============================================
-- FASE 5: RLS Policies
-- =============================================

-- Habilitar RLS
ALTER TABLE public.client_subscriptions ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.client_profiles ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.active_sessions ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.support_conversations ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.support_messages ENABLE ROW LEVEL SECURITY;

-- Policies para client_subscriptions
CREATE POLICY "Users can view own subscription"
  ON public.client_subscriptions FOR SELECT
  USING (auth.uid() = user_id);

CREATE POLICY "Admin master can manage all subscriptions"
  ON public.client_subscriptions FOR ALL
  USING (has_role(auth.uid(), 'ADMIN_MASTER'));

-- Policies para client_profiles
CREATE POLICY "Parent can view own profiles"
  ON public.client_profiles FOR SELECT
  USING (auth.uid() = parent_user_id);

CREATE POLICY "Parent can create profiles (max 10)"
  ON public.client_profiles FOR INSERT
  WITH CHECK (
    auth.uid() = parent_user_id 
    AND count_user_profiles(parent_user_id) < 10
  );

CREATE POLICY "Parent can update own profiles"
  ON public.client_profiles FOR UPDATE
  USING (auth.uid() = parent_user_id);

CREATE POLICY "Parent can delete own profiles"
  ON public.client_profiles FOR DELETE
  USING (auth.uid() = parent_user_id);

CREATE POLICY "Admins can view all profiles"
  ON public.client_profiles FOR SELECT
  USING (is_admin(auth.uid()));

-- Policies para active_sessions
CREATE POLICY "Users can view own sessions"
  ON public.active_sessions FOR SELECT
  USING (auth.uid() = user_id);

CREATE POLICY "Users can manage own sessions"
  ON public.active_sessions FOR ALL
  USING (auth.uid() = user_id);

CREATE POLICY "Admins can view all sessions"
  ON public.active_sessions FOR SELECT
  USING (is_admin(auth.uid()));

CREATE POLICY "Admins can delete any session"
  ON public.active_sessions FOR DELETE
  USING (is_admin(auth.uid()));

-- Policies para support_conversations
CREATE POLICY "Users can view own conversations"
  ON public.support_conversations FOR SELECT
  USING (auth.uid() = user_id);

CREATE POLICY "Users can create conversations"
  ON public.support_conversations FOR INSERT
  WITH CHECK (auth.uid() = user_id);

CREATE POLICY "Users can update own conversations"
  ON public.support_conversations FOR UPDATE
  USING (auth.uid() = user_id);

CREATE POLICY "Admins can view all conversations"
  ON public.support_conversations FOR SELECT
  USING (is_admin(auth.uid()));

CREATE POLICY "Admins can update any conversation"
  ON public.support_conversations FOR UPDATE
  USING (is_admin(auth.uid()));

-- Policies para support_messages
CREATE POLICY "Users can view messages in own conversations"
  ON public.support_messages FOR SELECT
  USING (
    EXISTS (
      SELECT 1 FROM public.support_conversations 
      WHERE id = conversation_id AND user_id = auth.uid()
    )
  );

CREATE POLICY "Users can send messages in own conversations"
  ON public.support_messages FOR INSERT
  WITH CHECK (
    sender_id = auth.uid() AND
    sender_type = 'user' AND
    EXISTS (
      SELECT 1 FROM public.support_conversations 
      WHERE id = conversation_id AND user_id = auth.uid()
    )
  );

CREATE POLICY "Admins can view all messages"
  ON public.support_messages FOR SELECT
  USING (is_admin(auth.uid()));

CREATE POLICY "Admins can send messages"
  ON public.support_messages FOR INSERT
  WITH CHECK (
    is_admin(auth.uid()) AND sender_type = 'admin'
  );

CREATE POLICY "Admins can update messages (mark as read)"
  ON public.support_messages FOR UPDATE
  USING (is_admin(auth.uid()));

-- =============================================
-- FASE 6: Habilitar Realtime para Chat
-- =============================================

ALTER PUBLICATION supabase_realtime ADD TABLE public.support_messages;
ALTER PUBLICATION supabase_realtime ADD TABLE public.support_conversations;
ALTER PUBLICATION supabase_realtime ADD TABLE public.active_sessions;