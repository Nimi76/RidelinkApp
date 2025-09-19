import React, { useState } from 'react';
import { useAppContext } from '../../hooks/useAppContext';
import { UserRole } from '../../types';
import { CarIcon, UserIcon } from '../../constants';
import Button from '../shared/Button';
import { handleGoogleSignIn } from '../../services/firebaseService';

const Login: React.FC = () => {
  const { dispatch } = useAppContext();
  const [error, setError] = useState('');

  const handleLogin = async (role: UserRole) => {
    setError('');
    try {
        await handleGoogleSignIn(role);
        // The AppContext observer will handle setting the user state
    } catch (err) {
        console.error("Login failed:", err);
        const message = err instanceof Error ? err.message : 'Failed to sign in. Please try again.';
        setError(message);
        dispatch({ type: 'SET_ERROR', payload: message});
    }
  };

  return (
    <div className="flex items-center justify-center min-h-screen bg-slate-900">
      <div className="w-full max-w-md p-8 space-y-8 bg-slate-800 rounded-2xl shadow-lg">
        <div className="text-center">
          <h1 className="text-4xl font-bold text-sky-400">Welcome to RideLink</h1>
          <p className="mt-2 text-slate-400">Your real-time ride-hailing connection.</p>
        </div>
        {error && (
            <div className="bg-red-500/10 border border-red-500/30 text-red-400 text-sm rounded-lg p-3 text-center">
                {error}
            </div>
        )}
        <div className="flex flex-col space-y-4">
          <Button
            onClick={() => handleLogin(UserRole.PASSENGER)}
            className="w-full flex items-center justify-center space-x-3"
          >
            <UserIcon className="w-6 h-6" />
            <span>Sign In as a Passenger</span>
          </Button>
          <Button
            onClick={() => handleLogin(UserRole.DRIVER)}
            className="w-full flex items-center justify-center space-x-3 bg-emerald-500 hover:bg-emerald-600"
          >
            <CarIcon className="w-6 h-6" />
            <span>Sign In as a Driver</span>
          </Button>
        </div>
        <p className="text-xs text-center text-slate-500">
            Sign in with your Google account. By signing in, you agree to our terms of service.
        </p>
      </div>
    </div>
  );
};

export default Login;