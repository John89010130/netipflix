import { createContext, useContext, useEffect, useState, useCallback, ReactNode } from 'react';
import { supabase } from '@/integrations/supabase/client';
import { useAuth } from './AuthContext';

interface SessionInfo {
  available: boolean;
  active_count: number;
  max_screens: number;
  is_active: boolean;
}

interface ActiveSession {
  id: string;
  user_id: string;
  profile_id: string | null;
  device_info: string | null;
  started_at: string;
  last_activity: string;
}

interface ClientProfile {
  id: string;
  parent_user_id: string;
  name: string;
  avatar_url: string | null;
  pin: string | null;
  is_kids_profile: boolean;
  created_at: string;
}

interface ClientSubscription {
  id: string;
  user_id: string;
  max_screens: number;
  price_per_screen: number;
  is_active: boolean;
  expires_at: string | null;
}

interface SessionContextType {
  sessionInfo: SessionInfo | null;
  currentSession: ActiveSession | null;
  selectedProfile: ClientProfile | null;
  profiles: ClientProfile[];
  subscription: ClientSubscription | null;
  loading: boolean;
  showLimitModal: boolean;
  setShowLimitModal: (show: boolean) => void;
  selectProfile: (profile: ClientProfile | null) => Promise<boolean>;
  createSession: (profileId?: string) => Promise<boolean>;
  endSession: () => Promise<void>;
  refreshSessionInfo: () => Promise<void>;
  fetchProfiles: () => Promise<void>;
}

const SessionContext = createContext<SessionContextType | undefined>(undefined);

// HEARTBEAT DESABILITADO
const HEARTBEAT_DISABLED = true;
const HEARTBEAT_INTERVAL = 30000; // 30 seconds

export const SessionProvider = ({ children }: { children: ReactNode }) => {
  const { user, isAdmin, isAdminMaster } = useAuth();
  const [sessionInfo, setSessionInfo] = useState<SessionInfo | null>(null);
  const [currentSession, setCurrentSession] = useState<ActiveSession | null>(null);
  const [selectedProfile, setSelectedProfile] = useState<ClientProfile | null>(null);
  const [profiles, setProfiles] = useState<ClientProfile[]>([]);
  const [subscription, setSubscription] = useState<ClientSubscription | null>(null);
  const [loading, setLoading] = useState(true);
  const [showLimitModal, setShowLimitModal] = useState(false);

  const fetchSessionInfo = useCallback(async () => {
    if (!user) return;

    try {
      const { data, error } = await supabase.rpc('check_session_availability', {
        _user_id: user.id
      });

      if (error) throw error;
      setSessionInfo(data as unknown as SessionInfo);
    } catch (error) {
      console.error('Error fetching session info:', error);
    }
  }, [user]);

  const fetchProfiles = useCallback(async () => {
    if (!user) return;

    try {
      const { data, error } = await supabase
        .from('client_profiles')
        .select('*')
        .eq('parent_user_id', user.id)
        .order('created_at');

      if (error) throw error;
      setProfiles(data || []);
    } catch (error) {
      console.error('Error fetching profiles:', error);
    }
  }, [user]);

  const fetchSubscription = useCallback(async () => {
    if (!user) return;

    try {
      const { data, error } = await supabase
        .from('client_subscriptions')
        .select('*')
        .eq('user_id', user.id)
        .maybeSingle();

      if (error) throw error;
      setSubscription(data);
    } catch (error) {
      console.error('Error fetching subscription:', error);
    }
  }, [user]);

  const fetchCurrentSession = useCallback(async () => {
    if (!user) return;

    try {
      const { data, error } = await supabase
        .from('active_sessions')
        .select('*')
        .eq('user_id', user.id)
        .order('last_activity', { ascending: false })
        .limit(1)
        .maybeSingle();

      if (error) throw error;
      setCurrentSession(data);
    } catch (error) {
      console.error('Error fetching current session:', error);
    }
  }, [user]);

  const createSession = useCallback(async (profileId?: string): Promise<boolean> => {
    if (!user) return false;

    // Admins don't need session control
    if (isAdmin || isAdminMaster) return true;

    try {
      // First check availability
      await fetchSessionInfo();
      
      const { data: checkData, error: checkError } = await supabase.rpc('check_session_availability', {
        _user_id: user.id
      });

      if (checkError) throw checkError;
      
      const info = checkData as unknown as SessionInfo;
      
      if (!info.available) {
        setShowLimitModal(true);
        return false;
      }

      // Create new session
      const { data, error } = await supabase
        .from('active_sessions')
        .insert({
          user_id: user.id,
          profile_id: profileId || null,
          device_info: navigator.userAgent.substring(0, 200),
        })
        .select()
        .single();

      if (error) throw error;
      setCurrentSession(data);
      return true;
    } catch (error) {
      console.error('Error creating session:', error);
      return false;
    }
  }, [user, isAdmin, isAdminMaster, fetchSessionInfo]);

  const endSession = useCallback(async () => {
    if (!currentSession) return;

    try {
      await supabase
        .from('active_sessions')
        .delete()
        .eq('id', currentSession.id);
      
      setCurrentSession(null);
    } catch (error) {
      console.error('Error ending session:', error);
    }
  }, [currentSession]);

  const selectProfile = useCallback(async (profile: ClientProfile | null): Promise<boolean> => {
    setSelectedProfile(profile);
    return await createSession(profile?.id);
  }, [createSession]);

  const refreshSessionInfo = useCallback(async () => {
    await Promise.all([
      fetchSessionInfo(),
      fetchSubscription(),
      fetchCurrentSession(),
    ]);
  }, [fetchSessionInfo, fetchSubscription, fetchCurrentSession]);

  // Heartbeat to keep session alive
  useEffect(() => {
    if (HEARTBEAT_DISABLED || !currentSession || isAdmin || isAdminMaster) return;

    const heartbeat = async () => {
      try {
        await supabase
          .from('active_sessions')
          .update({ last_activity: new Date().toISOString() })
          .eq('id', currentSession.id);
      } catch (error) {
        console.error('Heartbeat error:', error);
      }
    };

    const interval = setInterval(heartbeat, HEARTBEAT_INTERVAL);
    return () => clearInterval(interval);
  }, [currentSession, isAdmin, isAdminMaster]);

  // Cleanup session on window close
  useEffect(() => {
    const handleBeforeUnload = () => {
      if (currentSession) {
        // Use sendBeacon for reliable cleanup
        const url = `${import.meta.env.VITE_SUPABASE_URL}/rest/v1/active_sessions?id=eq.${currentSession.id}`;
        navigator.sendBeacon(url);
      }
    };

    window.addEventListener('beforeunload', handleBeforeUnload);
    return () => window.removeEventListener('beforeunload', handleBeforeUnload);
  }, [currentSession]);

  // Initial fetch
  useEffect(() => {
    if (user) {
      setLoading(true);
      Promise.all([
        fetchSessionInfo(),
        fetchProfiles(),
        fetchSubscription(),
        fetchCurrentSession(),
      ]).finally(() => setLoading(false));
    } else {
      setSessionInfo(null);
      setCurrentSession(null);
      setSelectedProfile(null);
      setProfiles([]);
      setSubscription(null);
      setLoading(false);
    }
  }, [user, fetchSessionInfo, fetchProfiles, fetchSubscription, fetchCurrentSession]);

  return (
    <SessionContext.Provider
      value={{
        sessionInfo,
        currentSession,
        selectedProfile,
        profiles,
        subscription,
        loading,
        showLimitModal,
        setShowLimitModal,
        selectProfile,
        createSession,
        endSession,
        refreshSessionInfo,
        fetchProfiles,
      }}
    >
      {children}
    </SessionContext.Provider>
  );
};

export const useSession = () => {
  const context = useContext(SessionContext);
  if (context === undefined) {
    throw new Error('useSession must be used within a SessionProvider');
  }
  return context;
};
