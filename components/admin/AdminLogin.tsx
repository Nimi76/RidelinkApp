import React, { useState } from 'react';
import { ShieldCheckIcon } from '../../constants';
import Button from '../shared/Button';
import Spinner from '../shared/Spinner';
import { ADMIN_EMAIL, handleAdminGoogleSignIn } from '../../services/firebaseService';

// For demonstration, the OTP is hardcoded and logged to the console.
const FAKE_OTP = '123456';

const AdminLogin: React.FC = () => {
    const [email, setEmail] = useState('');
    const [otp, setOtp] = useState('');
    const [step, setStep] = useState<'email' | 'otp'>('email');
    const [error, setError] = useState('');
    const [isLoading, setIsLoading] = useState(false);

    const handleEmailSubmit = (e: React.FormEvent) => {
        e.preventDefault();
        setError('');
        if (email.toLowerCase() !== ADMIN_EMAIL.toLowerCase()) {
            setError('This email is not authorized for admin access.');
            return;
        }
        
        // Simulate sending OTP
        console.log(`%cADMIN OTP: ${FAKE_OTP}`, "color: #0ea5e9; font-size: 16px; font-weight: bold;");
        setStep('otp');
    };
    
    const handleOtpSubmit = async (e: React.FormEvent) => {
        e.preventDefault();
        setError('');
        if (otp !== FAKE_OTP) {
            setError('Invalid OTP. Check the console for the correct code.');
            return;
        }
        
        setIsLoading(true);
        try {
            await handleAdminGoogleSignIn();
            // On success, the AppContext listener will redirect to the dashboard
        } catch (err) {
            const message = err instanceof Error ? err.message : 'An unknown error occurred during sign-in.';
            setError(message);
        } finally {
            setIsLoading(false);
        }
    };

    return (
        <div className="flex items-center justify-center min-h-screen bg-slate-900">
            <div className="w-full max-w-md p-8 space-y-6 bg-slate-800 rounded-2xl shadow-lg">
                <div className="text-center">
                    <ShieldCheckIcon className="w-16 h-16 mx-auto text-sky-400" />
                    <h1 className="text-3xl font-bold mt-4 text-sky-400">Admin Portal</h1>
                    <p className="mt-2 text-slate-400">Secure sign-in for administrators.</p>
                </div>

                {error && (
                    <div className="bg-red-500/10 border border-red-500/30 text-red-400 text-sm rounded-lg p-3 text-center">
                        {error}
                    </div>
                )}
                
                {step === 'email' ? (
                    <form onSubmit={handleEmailSubmit} className="space-y-4">
                        <div>
                            <label htmlFor="email" className="block text-sm font-medium text-slate-300 mb-1">Admin Email</label>
                            <input
                                id="email"
                                name="email"
                                type="email"
                                value={email}
                                onChange={(e) => setEmail(e.target.value)}
                                placeholder="Enter your admin email"
                                required
                                className="w-full bg-slate-700 border border-slate-600 rounded-md px-3 py-2 text-white placeholder-slate-400 focus:ring-sky-500 focus:border-sky-500"
                            />
                        </div>
                        <Button type="submit" className="w-full" disabled={isLoading}>
                            {isLoading ? <Spinner /> : 'Send OTP'}
                        </Button>
                    </form>
                ) : (
                    <form onSubmit={handleOtpSubmit} className="space-y-4">
                         <div>
                            <p className="text-center text-sm text-slate-400 mb-2">An OTP has been logged to your browser's console. Enter it below to proceed.</p>
                            <label htmlFor="otp" className="block text-sm font-medium text-slate-300 mb-1">One-Time Password</label>
                            <input
                                id="otp"
                                name="otp"
                                type="text"
                                value={otp}
                                onChange={(e) => setOtp(e.target.value)}
                                placeholder="Enter 6-digit code"
                                required
                                className="w-full bg-slate-700 border border-slate-600 rounded-md px-3 py-2 text-white placeholder-slate-400 focus:ring-sky-500 focus:border-sky-500 tracking-widest text-center"
                            />
                        </div>
                        <Button type="submit" className="w-full" disabled={isLoading}>
                            {isLoading ? <Spinner /> : 'Verify & Sign In with Google'}
                        </Button>
                    </form>
                )}
            </div>
        </div>
    );
};

export default AdminLogin;
