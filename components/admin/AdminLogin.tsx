import React, { useState, useEffect } from 'react';
import { ShieldCheckIcon } from '../../constants';
import Button from '../shared/Button';
import Spinner from '../shared/Spinner';
import { ADMIN_EMAIL, handleSignOut, createUserProfile } from '../../services/firebaseService';
import { UserRole } from '../../types';
import { auth } from '../../firebase';
import { 
    sendSignInLinkToEmail,
    isSignInWithEmailLink,
    signInWithEmailLink 
} from 'firebase/auth';

const AdminLogin: React.FC = () => {
    const [email, setEmail] = useState('');
    const [isLoading, setIsLoading] = useState(false);
    const [error, setError] = useState('');
    const [emailSent, setEmailSent] = useState(false);
    const [isVerifying, setIsVerifying] = useState(true); // Start with verifying state

    useEffect(() => {
        // This effect runs on mount to check if the user is returning from the email link
        const processSignInLink = async () => {
            if (isSignInWithEmailLink(auth, window.location.href)) {
                let storedEmail = window.localStorage.getItem('emailForSignIn');
                if (!storedEmail) {
                    setError("Your sign-in session has expired or is invalid. Please enter your email again.");
                    setIsVerifying(false);
                    return;
                }

                setIsLoading(true);
                try {
                    const result = await signInWithEmailLink(auth, storedEmail, window.location.href);

                    // FIX: Create/update the user profile in Firestore to prevent "profile not found" error.
                    // This is essential for the AppContext to find the user data.
                    await createUserProfile(result.user, UserRole.ADMIN);
                    
                    if (result.user.email?.toLowerCase() !== ADMIN_EMAIL.toLowerCase()) {
                        await handleSignOut();
                        setError("Access denied. This account is not authorized for admin access.");
                    }
                    
                    window.localStorage.removeItem('emailForSignIn');
                } catch (err) {
                    const firebaseError = err as { code?: string };
                    if (firebaseError.code === 'auth/invalid-action-code') {
                        setError("The sign-in link is invalid. It may have expired or been used already. Please request a new one.");
                    } else {
                        console.error("Sign in with email link error:", err);
                        setError("An unexpected error occurred during sign-in. Please try again.");
                    }
                } finally {
                    setIsLoading(false);
                    setIsVerifying(false);
                }
            } else {
                setIsVerifying(false); // Not a sign-in link, so show the login form
            }
        };

        processSignInLink();
    }, []);

    const handleEmailSubmit = async (e: React.FormEvent) => {
        e.preventDefault();
        setError('');

        if (email.toLowerCase() !== ADMIN_EMAIL.toLowerCase()) {
            setError('This email is not authorized for admin access.');
            return;
        }

        setIsLoading(true);
        const actionCodeSettings = {
            url: window.location.href, // Redirect back to this same admin page
            handleCodeInApp: true,
        };

        try {
            await sendSignInLinkToEmail(auth, email, actionCodeSettings);
            window.localStorage.setItem('emailForSignIn', email);
            setEmailSent(true);
        } catch (err) {
            console.error("Error sending sign-in link:", err);
            setError('Could not send sign-in link. Please try again.');
        } finally {
            setIsLoading(false);
        }
    };
    
    if (isVerifying) {
         return (
            <div className="flex items-center justify-center min-h-screen bg-slate-900">
                <div className="text-center space-y-4">
                    <Spinner className="w-10 h-10 mx-auto" />
                    <p className="text-slate-400">Verifying sign-in link...</p>
                </div>
            </div>
        );
    }

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
                
                {emailSent ? (
                     <div className="text-center bg-emerald-500/10 p-4 rounded-lg">
                        <h3 className="font-bold text-emerald-300">Check Your Email</h3>
                        <p className="text-slate-300 mt-1 text-sm">A sign-in link has been sent to <span className="font-semibold">{email}</span>. Click the link to complete your login.</p>
                    </div>
                ) : (
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
                                disabled={isLoading}
                            />
                        </div>
                        <Button type="submit" className="w-full" disabled={isLoading}>
                            {isLoading ? <Spinner /> : 'Send Sign-In Link'}
                        </Button>
                    </form>
                )}
            </div>
        </div>
    );
};

export default AdminLogin;
