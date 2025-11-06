import { useEffect, useState } from 'react';
import { useNavigate, useSearchParams } from 'react-router-dom';
import { toast } from 'sonner';
import socialAuthService from '../services/socialAuthService';

/**
 * OAuth Callback Handler Page
 * Handles redirects from OAuth providers (Twitter, Discord, etc.)
 */
export default function AuthCallback() {
  const [searchParams] = useSearchParams();
  const navigate = useNavigate();
  const [status, setStatus] = useState('processing');
  const [message, setMessage] = useState('Processing authentication...');

  useEffect(() => {
    handleCallback();
  }, []);

  const handleCallback = async () => {
    try {
      // Get OAuth parameters from URL
      const code = searchParams.get('code');
      const state = searchParams.get('state');
      const error = searchParams.get('error');
      const errorDescription = searchParams.get('error_description');

      // Check for errors from OAuth provider
      if (error) {
        setStatus('error');
        setMessage(`Authentication failed: ${errorDescription || error}`);
        toast.error(`Authentication failed: ${errorDescription || error}`);
        setTimeout(() => {
          window.close(); // Try to close popup
          navigate('/'); // Fallback navigation
        }, 3000);
        return;
      }

      // Validate required parameters
      if (!code || !state) {
        setStatus('error');
        setMessage('Missing authorization code or state parameter');
        toast.error('Invalid callback parameters');
        setTimeout(() => {
          window.close();
          navigate('/');
        }, 3000);
        return;
      }

      // Decode state to get wallet address and platform
      let stateData;
      try {
        stateData = JSON.parse(atob(state));
      } catch (e) {
        setStatus('error');
        setMessage('Invalid state parameter');
        toast.error('Invalid authentication state');
        setTimeout(() => {
          window.close();
          navigate('/');
        }, 3000);
        return;
      }

      const { wallet_address } = stateData;

      if (!wallet_address) {
        setStatus('error');
        setMessage('Missing wallet address in state');
        toast.error('Invalid authentication state');
        setTimeout(() => {
          window.close();
          navigate('/');
        }, 3000);
        return;
      }

      // Determine platform from URL path
      const path = window.location.pathname;
      let platform = 'twitter'; // default
      if (path.includes('/discord')) {
        platform = 'discord';
      } else if (path.includes('/telegram')) {
        platform = 'telegram';
      }

      setMessage(`Completing ${platform} authentication...`);

      // Call the appropriate callback handler
      let result;
      switch (platform) {
        case 'twitter':
          result = await socialAuthService.handleTwitterCallback(code, state, wallet_address);
          break;
        case 'discord':
          result = await socialAuthService.handleDiscordCallback(code, state, wallet_address);
          break;
        default:
          throw new Error(`Unsupported platform: ${platform}`);
      }

      if (result.success) {
        setStatus('success');
        setMessage(`${platform.charAt(0).toUpperCase() + platform.slice(1)} account connected successfully!`);
        toast.success(`${platform.charAt(0).toUpperCase() + platform.slice(1)} account connected!`);
        
        // Store success in localStorage so parent window can detect it
        localStorage.setItem('oauth_success', JSON.stringify({
          platform,
          timestamp: Date.now()
        }));

        // Close popup after short delay
        setTimeout(() => {
          window.close();
        }, 2000);
      } else {
        setStatus('error');
        setMessage(result.error || 'Authentication failed');
        toast.error(result.error || 'Authentication failed');
        setTimeout(() => {
          window.close();
          navigate('/');
        }, 3000);
      }
    } catch (error) {
      console.error('Callback error:', error);
      setStatus('error');
      setMessage(error.message || 'An unexpected error occurred');
      toast.error('Authentication failed');
      setTimeout(() => {
        window.close();
        navigate('/');
      }, 3000);
    }
  };

  return (
    <div className="min-h-screen flex items-center justify-center bg-gray-50">
      <div className="max-w-md w-full bg-white shadow-lg rounded-lg p-8">
        <div className="text-center">
          {status === 'processing' && (
            <>
              <div className="animate-spin rounded-full h-16 w-16 border-b-2 border-blue-600 mx-auto mb-4"></div>
              <h2 className="text-2xl font-bold text-gray-900 mb-2">Processing...</h2>
              <p className="text-gray-600">{message}</p>
            </>
          )}

          {status === 'success' && (
            <>
              <div className="text-green-600 mb-4">
                <svg className="h-16 w-16 mx-auto" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M5 13l4 4L19 7" />
                </svg>
              </div>
              <h2 className="text-2xl font-bold text-gray-900 mb-2">Success!</h2>
              <p className="text-gray-600">{message}</p>
              <p className="text-sm text-gray-500 mt-4">This window will close automatically...</p>
            </>
          )}

          {status === 'error' && (
            <>
              <div className="text-red-600 mb-4">
                <svg className="h-16 w-16 mx-auto" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" />
                </svg>
              </div>
              <h2 className="text-2xl font-bold text-gray-900 mb-2">Error</h2>
              <p className="text-gray-600">{message}</p>
              <p className="text-sm text-gray-500 mt-4">This window will close automatically...</p>
            </>
          )}
        </div>
      </div>
    </div>
  );
}
