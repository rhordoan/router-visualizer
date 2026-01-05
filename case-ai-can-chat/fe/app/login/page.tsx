'use client';

import { useState } from 'react';
import { useRouter } from 'next/navigation';
import { Mail, Sparkles, AlertCircle, HeartPulse } from 'lucide-react';
import { apiClient } from '@/lib/api';

export default function LoginPage() {
  const [email, setEmail] = useState('');
  const [isLoading, setIsLoading] = useState(false);
  const [error, setError] = useState('');
  const router = useRouter();

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setError('');

    if (!email.trim()) {
      setError('Please enter your email address');
      return;
    }

    if (!email.endsWith('@computacenter.com')) {
      setError('Only @computacenter.com email addresses are allowed');
      return;
    }

    setIsLoading(true);

    try {
      const response = await apiClient.login(email);
      
      // Token and user are automatically stored by apiClient
      // Redirect to main chat page
      router.push('/');
    } catch (err: any) {
      console.error('Login error:', err);
      setError(
        err.response?.data?.detail || 
        'Login failed. Please check your email and try again.'
      );
    } finally {
      setIsLoading(false);
    }
  };

  return (
    <div className="flex flex-col min-h-screen bg-gradient-to-br from-white via-health-gray-beige to-health-gray-light relative overflow-hidden">
      {/* Animated background elements */}
      <div className="absolute inset-0 overflow-hidden pointer-events-none">
        <div className="absolute w-96 h-96 bg-health-purple/5 rounded-full blur-3xl -top-48 -left-48 animate-pulse-slow"></div>
        <div className="absolute w-96 h-96 bg-health-purple/5 rounded-full blur-3xl -bottom-48 -right-48 animate-pulse-slow" style={{animationDelay: '1s'}}></div>
      </div>

      {/* Login Card */}
      <div className="flex-1 flex items-center justify-center px-4 relative z-10">
        <div className="w-full max-w-md">
          <div className="bg-white/80 backdrop-blur-lg rounded-2xl shadow-2xl border border-gray-200 p-8 animate-in slide-in-from-bottom duration-500">
            {/* Logo and Title */}
            <div className="text-center mb-8">
              <div className="flex justify-center mb-4">
                <div className="inline-flex items-center justify-center w-24 h-24 bg-purple-50 rounded-xl shadow-lg border-2 border-health-purple">
                  <HeartPulse className="w-12 h-12 text-health-purple" />
                </div>
              </div>
              <h1 className="text-3xl font-bold text-health-gray-text flex items-center justify-center gap-2">
                Welcome to HealthChat
                <Sparkles className="w-6 h-6 text-health-purple animate-pulse" />
              </h1>
              <p className="text-gray-600 mt-2">
                Sign in with your Computacenter email
              </p>
            </div>

            {/* Login Form */}
            <form onSubmit={handleSubmit} className="space-y-6">
              <div>
                <label htmlFor="email" className="block text-sm font-medium text-gray-700 mb-2">
                  Email Address
                </label>
                <div className="relative">
                  <div className="absolute inset-y-0 left-0 pl-3 flex items-center pointer-events-none">
                    <Mail className="h-5 w-5 text-gray-400" />
                  </div>
                  <input
                    id="email"
                    type="email"
                    value={email}
                    onChange={(e) => setEmail(e.target.value)}
                    placeholder="your.name@computacenter.com"
                    className="block w-full pl-10 pr-3 py-3 border border-health-purple/30 rounded-lg text-health-gray-text placeholder-gray-400 focus:outline-none focus:ring-2 focus:ring-health-purple/50 focus:border-health-purple transition-all duration-200"
                    disabled={isLoading}
                  />
                </div>
              </div>

              {error && (
                <div className="bg-red-50 border border-red-200 text-red-700 px-4 py-3 rounded-lg flex items-start gap-2 animate-in slide-in-from-top">
                  <AlertCircle className="w-5 h-5 flex-shrink-0 mt-0.5" />
                  <p className="text-sm">{error}</p>
                </div>
              )}

              <button
                type="submit"
                disabled={isLoading}
                className={`w-full py-3 px-4 bg-gradient-to-r from-health-gradient-start via-health-gradient-mid to-health-gradient-end text-white font-bold rounded-lg shadow-lg transition-all duration-200 flex items-center justify-center gap-2 ${
                  isLoading
                    ? 'opacity-70 cursor-not-allowed'
                    : 'hover:shadow-health-purple/40 transform hover:scale-105 active:scale-95'
                }`}
              >
                {isLoading ? (
                  <>
                    <div className="flex space-x-1">
                      <div className="w-2 h-2 bg-white rounded-full animate-bounce" style={{animationDelay: '0ms'}}></div>
                      <div className="w-2 h-2 bg-white rounded-full animate-bounce" style={{animationDelay: '150ms'}}></div>
                      <div className="w-2 h-2 bg-white rounded-full animate-bounce" style={{animationDelay: '300ms'}}></div>
                    </div>
                    <span>Signing In...</span>
                  </>
                ) : (
                  <span>Sign In</span>
                )}
              </button>
            </form>

            {/* Footer */}
            <div className="mt-6 pt-6 border-t border-gray-200">
              <p className="text-xs text-gray-600 text-center">
                Powered by NVIDIA NeMo & NIM • Private & Secure
              </p>
            </div>
          </div>

        </div>
      </div>
    </div>
  );
}

