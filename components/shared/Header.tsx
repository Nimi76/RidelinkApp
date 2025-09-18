import React from 'react';
import { useAppContext } from '../../hooks/useAppContext';
import { LogoutIcon, CheckBadgeIcon } from '../../constants';
import Button from './Button';
import { handleSignOut } from '../../services/firebaseService';

const Header: React.FC = () => {
  const { state } = useAppContext();
  const { user } = state;

  if (!user) return null;

  return (
    <header className="bg-slate-800/50 backdrop-blur-sm sticky top-0 z-40">
      <div className="max-w-7xl mx-auto px-4 sm:px-6 md:px-8">
        <div className="flex items-center justify-between h-16">
          <div className="flex items-center space-x-4">
            <div className="text-2xl font-bold text-sky-400">RideLink</div>
             <div className="hidden sm:block text-sm bg-slate-700 px-3 py-1 rounded-full text-slate-300">{user.role}</div>
          </div>
          <div className="flex items-center space-x-4">
            <div className="flex items-center space-x-3">
              <img className="w-10 h-10 rounded-full" src={user.avatarUrl} alt={user.name} />
              <div className="text-right">
                <p className="font-semibold leading-tight">{user.name}</p>
                {user.isVerified && (
                  <div className="flex items-center space-x-1 text-xs text-emerald-400">
                    <CheckBadgeIcon className="w-3.5 h-3.5" />
                    <span>Verified</span>
                  </div>
                )}
              </div>
            </div>
            <Button onClick={handleSignOut} className="!p-2 bg-slate-700 hover:bg-slate-600">
                <LogoutIcon className="w-5 h-5" />
                <span className="sr-only">Logout</span>
            </Button>
          </div>
        </div>
      </div>
    </header>
  );
};

export default Header;