'use client';

import { useState, useRef, useEffect } from 'react';
import { useRouter } from 'next/navigation';
import { User, LogOut, ChevronDown } from 'lucide-react';
import { apiClient } from '@/lib/api';

interface UserMenuProps {
  userName: string;
  userEmail: string;
}

export default function UserMenu({ userName, userEmail }: UserMenuProps) {
  const [isOpen, setIsOpen] = useState(false);
  const [shouldRender, setShouldRender] = useState(false);
  const [isAnimating, setIsAnimating] = useState(false);
  const menuRef = useRef<HTMLDivElement>(null);
  const router = useRouter();

  useEffect(() => {
    if (isOpen) {
      // Reset animation state first
      setIsAnimating(false);
      setShouldRender(true);
    } else {
      setIsAnimating(false);
      // Delay unmounting to allow close animation
      const timer = setTimeout(() => setShouldRender(false), 200);
      return () => clearTimeout(timer);
    }
  }, [isOpen]);

  // Separate effect to trigger animation after render
  useEffect(() => {
    if (shouldRender && isOpen) {
      // Use requestAnimationFrame to ensure DOM is updated before animating
      const frame = requestAnimationFrame(() => {
        setIsAnimating(true);
      });
      return () => cancelAnimationFrame(frame);
    }
  }, [shouldRender, isOpen]);

  useEffect(() => {
    const handleClickOutside = (event: MouseEvent) => {
      if (menuRef.current && !menuRef.current.contains(event.target as Node)) {
        setIsOpen(false);
      }
    };

    document.addEventListener('mousedown', handleClickOutside);
    return () => document.removeEventListener('mousedown', handleClickOutside);
  }, []);

  const handleLogout = async () => {
    try {
      await apiClient.logout();
      router.push('/login');
    } catch (err) {
      console.error('Logout error:', err);
      // Force logout even if API call fails
      apiClient.clearAuth();
      router.push('/login');
    }
  };

  return (
    <div className="relative" ref={menuRef}>
      <button
        onClick={() => setIsOpen(!isOpen)}
        className="flex items-center space-x-2 px-3 py-2 bg-white border border-gray-300 rounded-lg hover:bg-gray-100 hover:border-gray-400 transition-all duration-200"
      >
        <div className="w-8 h-8 bg-gradient-to-r from-health-gradient-start to-health-gradient-end rounded-full flex items-center justify-center">
          <User className="w-4 h-4 text-white" />
        </div>
        <span className="text-sm font-medium text-gray-700 hidden sm:inline">
          {userName}
        </span>
        <ChevronDown className={`w-4 h-4 text-gray-500 transition-transform duration-200 ${isOpen ? 'rotate-180' : ''}`} />
      </button>

      {shouldRender && (
        <div 
          className={`absolute right-0 mt-2 w-64 bg-white rounded-lg shadow-lg border border-gray-200 z-50 transition-all duration-200 origin-top ${
            isAnimating 
              ? 'opacity-100 scale-100 translate-y-0' 
              : 'opacity-0 scale-95 -translate-y-2 pointer-events-none'
          }`}
        >
          <div className="px-4 py-3 border-b border-gray-200">
            <span className="text-sm font-medium text-gray-900">{userName}</span>
            <div className="text-xs text-gray-500 mt-1">{userEmail}</div>
          </div>
          
          <button
            onClick={handleLogout}
            className="w-full px-4 py-2 text-left text-sm text-red-600 hover:bg-red-50 transition-colors duration-150 flex items-center space-x-2"
          >
            <LogOut className="w-4 h-4" />
            <span>Sign Out</span>
          </button>
        </div>
      )}
    </div>
  );
}

