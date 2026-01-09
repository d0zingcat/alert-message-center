import { useEffect, useState, useRef } from 'react';
import { useAuth } from '../contexts/AuthContext';
import { client } from '../lib/client';

export default function AuthCallback() {
  const [error, setError] = useState<string | null>(null);
  const { checkAuth } = useAuth();
  const processed = useRef(false);

  useEffect(() => {
    const handleCallback = async () => {
      if (processed.current) return;
      processed.current = true;

      const params = new URLSearchParams(window.location.search);
      const code = params.get('code');
      const state = params.get('state');

      if (!code) {
        setError('No authorization code received');
        return;
      }

      try {
        const res = await client.api.auth.callback.$get({
          query: {
            code,
            state: state || undefined
          }
        }, {
          init: { credentials: 'include' }
        });

        if (res.ok) {
          await checkAuth();
          // Redirect to home
          window.location.href = '/';
        } else {
          const data = await res.json();
          setError(data.error || 'Authentication failed');
        }
      } catch (err) {
        setError('Authentication failed');
        console.error(err);
      }
    };

    handleCallback();
  }, [checkAuth]);

  if (error) {
    return (
      <div className="min-h-screen flex items-center justify-center bg-gray-50">
        <div className="max-w-md w-full bg-white shadow-lg rounded-lg p-6">
          <h2 className="text-2xl font-bold text-red-600 mb-4">Authentication Error</h2>
          <p className="text-gray-700">{error}</p>
          <button
            onClick={() => window.location.href = '/'}
            className="mt-4 w-full bg-indigo-600 text-white py-2 px-4 rounded hover:bg-indigo-700"
          >
            Return to Home
          </button>
        </div>
      </div>
    );
  }

  return (
    <div className="min-h-screen flex items-center justify-center bg-gray-50">
      <div className="max-w-md w-full bg-white shadow-lg rounded-lg p-6">
        <h2 className="text-2xl font-bold text-gray-900 mb-4">Authenticating...</h2>
        <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-indigo-600 mx-auto"></div>
      </div>
    </div>
  );
}
