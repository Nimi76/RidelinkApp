import React, { createContext, useReducer, Dispatch, useEffect } from 'react';
import { User, FareConfig } from '../types';
import { onAuthStateChanged, User as FirebaseUser } from 'firebase/auth';
import { doc, onSnapshot } from 'firebase/firestore';
import { auth, db } from '../firebase';
import { listenForFareConfig } from '../services/firebaseService';


interface AppState {
  user: User | null;
  isLoading: boolean;
  error: string | null;
  fareConfig: FareConfig | null;
}

type Action =
  | { type: 'SET_LOADING'; payload: boolean }
  | { type: 'SET_USER'; payload: User | null }
  | { type: 'SET_VERIFIED' }
  | { type: 'LOGOUT' }
  | { type: 'SET_ERROR'; payload: string | null }
  | { type: 'SET_FARE_CONFIG'; payload: FareConfig | null };


const initialState: AppState = {
  user: null,
  isLoading: true,
  error: null,
  fareConfig: null,
};


const appReducer = (state: AppState, action: Action): AppState => {
  switch (action.type) {
    case 'SET_LOADING':
      return { ...state, isLoading: action.payload };
    case 'SET_USER':
      return { ...state, user: action.payload, isLoading: false };
    case 'LOGOUT':
        return { ...initialState, isLoading: false };
    case 'SET_VERIFIED': // This is now handled by the real-time listener, but kept for potential future use.
      if (state.user) {
        return { ...state, user: { ...state.user, isVerified: true } };
      }
      return state;
    case 'SET_ERROR':
        return { ...state, error: action.payload, isLoading: false };
    case 'SET_FARE_CONFIG':
      return { ...state, fareConfig: action.payload };
    default:
      return state;
  }
};

export const AppContext = createContext<{
  state: AppState;
  dispatch: Dispatch<Action>;
}>({
  state: initialState,
  dispatch: () => null,
});

export const AppProvider: React.FC<{ children: React.ReactNode }> = ({ children }) => {
  const [state, dispatch] = useReducer(appReducer, initialState);

  useEffect(() => {
    let unsubscribeProfile = () => {};

    const unsubscribeAuth = onAuthStateChanged(auth, (firebaseUser: FirebaseUser | null) => {
        // Unsubscribe from any previous profile listener
        unsubscribeProfile();

        if (firebaseUser) {
            // User is signed in, listen for their profile changes in real-time
            const userDocRef = doc(db, 'users', firebaseUser.uid);
            unsubscribeProfile = onSnapshot(userDocRef, 
                (docSnap) => {
                    if (docSnap.exists()) {
                        const userProfile = { id: docSnap.id, ...docSnap.data() } as User;
                        dispatch({ type: 'SET_USER', payload: userProfile });
                    } else {
                        // This case is handled in Login.tsx where the profile is created
                        // If they land here without a profile, it's an edge case. Log them out.
                        console.warn("User logged in but profile not found. Forcing logout.");
                        dispatch({ type: 'LOGOUT' });
                    }
                }, 
                (error) => {
                    console.error("Error listening to user profile:", error);
                    dispatch({ type: 'SET_ERROR', payload: 'Failed to load user data.'});
                }
            );
        } else {
            // User is signed out
            dispatch({ type: 'SET_USER', payload: null });
        }
    });

    const unsubscribeFareConfig = listenForFareConfig((config) => {
        dispatch({ type: 'SET_FARE_CONFIG', payload: config });
    });


    return () => {
        unsubscribeAuth();
        unsubscribeProfile();
        unsubscribeFareConfig();
    };
  }, []);


  return (
    <AppContext.Provider value={{ state, dispatch }}>
      {children}
    </AppContext.Provider>
  );
};
