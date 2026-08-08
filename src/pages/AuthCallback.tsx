import { useEffect } from 'react';
import { useNavigate } from 'react-router-dom';
import { supabase } from '../services/supabase';

export default function AuthCallback() {
  const navigate = useNavigate();

  useEffect(() => {
    const handleSuccess = () => {
      if (window.opener && window.opener !== window) {
        try {
          window.opener.postMessage({ type: 'OAUTH_AUTH_SUCCESS' }, '*');
          window.close();
          return;
        } catch (e) {
          console.warn('Popup close warning:', e);
        }
      }
      navigate('/', { replace: true });
    };

    const { data: { subscription } } = supabase.auth.onAuthStateChange((event, session) => {
      if (event === 'SIGNED_IN' || session) {
        handleSuccess();
      } else if (event === 'SIGNED_OUT') {
        navigate('/login', { replace: true });
      }
    });

    // Also check current session just in case it was already loaded
    supabase.auth.getSession().then(({ data: { session } }) => {
      if (session) {
        handleSuccess();
      }
    });

    return () => {
      subscription.unsubscribe();
    };
  }, [navigate]);

  return (
    <div className="min-h-screen flex items-center justify-center bg-gray-50">
      <div className="text-center">
        <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-brand-600 mx-auto mb-4"></div>
        <p className="text-gray-600 font-medium">Processing login...</p>
      </div>
    </div>
  );
}
