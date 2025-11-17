import { useState, useEffect, useCallback } from 'react';
import { supabase } from '@/lib/supabase';
import { useAuthContext } from '@/contexts/AuthContext';

export const useFirstTimeUser = () => {
  const { user } = useAuthContext();
  const [isFirstTime, setIsFirstTime] = useState<boolean | null>(null);
  const [loading, setLoading] = useState(true);

  const getFirstLoginFlag = useCallback(async () => {
    if (!user) return false;
    const metadata = (user.user_metadata || {}) as Record<string, any>;
    if (metadata.onboarding_tutorial_dismissed) return false;

    try {
      const { data, error } = await supabase
        .from('profiles')
        .select('onboarding_tutorial_seen')
        .eq('id', user.id)
        .maybeSingle();

      if (error) {
        console.warn('useFirstTimeUser: error leyendo onboarding flag', error);
        return false;
      }

      return !(data?.onboarding_tutorial_seen);
    } catch (err) {
      console.error('useFirstTimeUser: error inesperado', err);
      return false;
    }
  }, [user]);

  useEffect(() => {
    if (!user) {
      setIsFirstTime(null);
      setLoading(false);
      return;
    }

    const dismissedTutorial = Boolean((user.user_metadata as any)?.onboarding_tutorial_dismissed);
    if (dismissedTutorial) {
      setIsFirstTime(false);
      setLoading(false);
      return;
    }

    getFirstLoginFlag().then(setIsFirstTime).finally(() => setLoading(false));
  }, [user, getFirstLoginFlag]);

  return { isFirstTime, loading, refetch: getFirstLoginFlag };
};
