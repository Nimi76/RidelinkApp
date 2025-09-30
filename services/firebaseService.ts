import { 
    GoogleAuthProvider, 
    signInWithPopup,
    signOut,
    User as FirebaseUser,
} from "firebase/auth";
import { 
    doc,
    getDoc,
    getDocs,
    setDoc,
    addDoc,
    updateDoc,
    collection,
    query,
    where,
    onSnapshot,
    serverTimestamp,
    orderBy,
    limit,
    deleteDoc,
    runTransaction,
} from "firebase/firestore";
import { 
    ref,
    uploadBytes,
    getDownloadURL
} from 'firebase/storage';
import { logEvent } from "firebase/analytics";
import { auth, db, analytics, storage } from '../firebase';
import { User, UserRole, RideRequest, Bid, Message, CarDetails, FareConfig } from '../types';

const provider = new GoogleAuthProvider();

// IMPORTANT: Replace this with the email you want to use for administration.
export const ADMIN_EMAIL = 'basoeneoruye@gmail.com';


// --- Authentication ---

export const handleGoogleSignIn = async (role: UserRole): Promise<void> => {
    const result = await signInWithPopup(auth, provider);
    const user = result.user;
    if (user.email === ADMIN_EMAIL) {
        await handleSignOut();
        throw new Error("Admin accounts must use the /admin login page.");
    }
    await createUserProfile(user, role);
    logEvent(analytics, 'login', { method: 'google', role });
};

export const handleSignOut = (): Promise<void> => {
    return signOut(auth);
};

// --- File Management ---
export const uploadFile = async (file: File, path: string): Promise<string> => {
    const storageRef = ref(storage, path);
    const snapshot = await uploadBytes(storageRef, file);
    return await getDownloadURL(snapshot.ref);
};

// --- User Profile Management ---

export const createUserProfile = async (firebaseUser: FirebaseUser, role: UserRole): Promise<void> => {
    const userRef = doc(db, "users", firebaseUser.uid);
    const isUserAdmin = firebaseUser.email === ADMIN_EMAIL;
    // If the user is an admin, their role should always be ADMIN.
    const actualRole = isUserAdmin ? UserRole.ADMIN : role;

    // Firebase User objects from email link may not have displayName or photoURL.
    // We get the existing doc to preserve the name/avatar if they already exist.
    const userSnap = await getDoc(userRef);
    const existingData = userSnap.exists() ? userSnap.data() : {};

    const userData: Partial<User> = { // Use Partial<User> to handle different user types
        name: firebaseUser.displayName || existingData.name || 'Anonymous Admin',
        email: firebaseUser.email || '',
        avatarUrl: firebaseUser.photoURL || existingData.avatarUrl || `https://ui-avatars.com/api/?name=${(firebaseUser.displayName || 'Admin').replace(' ','+')}&background=0ea5e9&color=fff`,
        role: actualRole,
        isVerified: isUserAdmin, // Admins are always verified
    };

    // Add driver-specific fields only for brand new driver accounts
    if (actualRole === UserRole.DRIVER && !userSnap.exists()) {
        userData.isAvailable = false;
        userData.rating = { average: 0, count: 0 };
    }


    // Use setDoc with merge to create or update. This is crucial.
    // It prevents overwriting fields like carDetails if an admin was previously a driver
    // and ensures the role is updated to ADMIN.
    await setDoc(userRef, userData, { merge: true });

    // Log sign_up event only for non-admin new users
    if (!userSnap.exists() && !isUserAdmin) {
        logEvent(analytics, 'sign_up', { method: 'google', role: actualRole });
    }
};

export const getUserProfile = async (uid: string): Promise<User | null> => {
    const userRef = doc(db, "users", uid);
    const userSnap = await getDoc(userRef);
    if (userSnap.exists()) {
        return { id: userSnap.id, ...userSnap.data() } as User;
    }
    return null;
};

export const updateDriverVerification = (uid: string, isVerified: boolean): Promise<void> => {
    const userRef = doc(db, "users", uid);
    logEvent(analytics, isVerified ? 'driver_verified' : 'driver_unverified', { admin_action: true, driver_id: uid });
    return updateDoc(userRef, { isVerified });
};

export const updateDriverProfile = (uid: string, data: { carDetails: CarDetails, avatarUrl: string, licenseUrl: string }): Promise<void> => {
    const userRef = doc(db, "users", uid);
    return updateDoc(userRef, data);
};

export const updateDriverAvailability = (uid: string, isAvailable: boolean): Promise<void> => {
    const userRef = doc(db, "users", uid);
    logEvent(analytics, 'driver_availability_toggled', { driver_id: uid, is_available: isAvailable });
    return updateDoc(userRef, { isAvailable });
};


// --- Ride Request Management ---

export const createRideRequest = (passenger: User, location: string, destination: string): Promise<void> => {
    const requestsCol = collection(db, "rideRequests");
    const newRequest: Omit<RideRequest, 'id'> = {
        passenger: { // Store a denormalized passenger object
            id: passenger.id,
            name: passenger.name,
            avatarUrl: passenger.avatarUrl,
            email: passenger.email,
            role: UserRole.PASSENGER,
            isVerified: passenger.isVerified
        },
        location,
        destination,
        status: 'PENDING',
        timestamp: serverTimestamp(),
    };
    logEvent(analytics, 'ride_request_created');
    return addDoc(requestsCol, newRequest).then(() => {});
};

export const cancelRideRequest = (requestId: string): Promise<void> => {
    const requestRef = doc(db, 'rideRequests', requestId);
    logEvent(analytics, 'ride_request_cancelled', { request_id: requestId });
    return deleteDoc(requestRef);
};

export const getActiveRideRequestForPassenger = (passengerId: string, callback: (request: RideRequest | null) => void) => {
    const q = query(
        collection(db, "rideRequests"), 
        where("passenger.id", "==", passengerId),
        where("status", "in", ["PENDING", "ACCEPTED"]),
        limit(1)
    );
    
    return onSnapshot(q, (querySnapshot) => {
        if (!querySnapshot.empty) {
            const doc = querySnapshot.docs[0];
            callback({ id: doc.id, ...doc.data() } as RideRequest);
        } else {
            callback(null);
        }
    });
};

export const getAcceptedRideForDriver = (driverId: string, callback: (request: RideRequest | null) => void) => {
     const q = query(
        collection(db, "rideRequests"), 
        where("status", "==", "ACCEPTED"),
        where("acceptedBid.driver.id", "==", driverId),
        limit(1)
    );

     return onSnapshot(q, (querySnapshot) => {
        if (!querySnapshot.empty) {
            const doc = querySnapshot.docs[0];
            callback({ id: doc.id, ...doc.data() } as RideRequest);
        } else {
            callback(null);
        }
    });
};

export const listenForAvailableRequests = (driverId: string, callback: (requests: RideRequest[]) => void) => {
    const q = query(
        collection(db, "rideRequests"),
        where("status", "==", "PENDING")
    );

    return onSnapshot(q, (querySnapshot) => {
        const requests: RideRequest[] = [];
        querySnapshot.forEach((doc) => {
             requests.push({ id: doc.id, ...doc.data() } as RideRequest)
        });
        // This filtering should ideally be done in the query, but Firestore has limitations.
        // We fetch all pending and filter out ones the driver has already bid on.
        // For a large-scale app, a different data model or Cloud Function would be needed.
        // For this demo, we assume the driver doesn't bid on many simultaneously.
        callback(requests); // In a real app, you would pre-filter this
    });
};


// --- Bid Management ---

export const addBidToRequest = async (requestId: string, driver: User, amount: number, driverLocation?: { latitude: number; longitude: number; }) => {
    const bidsCol = collection(db, `rideRequests/${requestId}/bids`);
    const newBid: Omit<Bid, 'id'> = {
        driver: { // Denormalize driver info
             id: driver.id,
            name: driver.name,
            avatarUrl: driver.avatarUrl,
            email: driver.email,
            role: UserRole.DRIVER,
            isVerified: driver.isVerified,
            carDetails: driver.carDetails,
            rating: driver.rating,
        },
        amount,
        driverLocation,
        timestamp: serverTimestamp(),
    };
    await addDoc(bidsCol, newBid);
    logEvent(analytics, 'bid_submitted', { amount, request_id: requestId });
};

export const listenForBids = (requestId: string, callback: (bids: Bid[]) => void) => {
    const bidsCol = collection(db, `rideRequests/${requestId}/bids`);
    const q = query(bidsCol, orderBy("amount", "asc"));
    
    return onSnapshot(q, (querySnapshot) => {
        const bids: Bid[] = [];
        querySnapshot.forEach((doc) => {
            bids.push({ id: doc.id, ...doc.data() } as Bid);
        });
        callback(bids);
    });
};

export const acceptBid = async (requestId: string, bidId: string): Promise<void> => {
    const requestRef = doc(db, "rideRequests", requestId);
    const bidRef = doc(db, `rideRequests/${requestId}/bids`, bidId);

    const bidSnap = await getDoc(bidRef);
    if (bidSnap.exists()) {
        const bidData = bidSnap.data();
        await updateDoc(requestRef, {
            status: "ACCEPTED",
            acceptedBidId: bidId,
            acceptedBid: bidData // Denormalize accepted bid for easy lookup by driver
        });
        logEvent(analytics, 'ride_accepted', { amount: bidData.amount, request_id: requestId, bid_id: bidId });
    } else {
        throw new Error("Bid not found!");
    }
};

// --- Chat Management ---

export const sendMessage = (requestId: string, senderId: string, text: string) => {
    const messagesCol = collection(db, `rideRequests/${requestId}/messages`);
    const newMessage: Omit<Message, 'id'> = {
        senderId,
        text,
        timestamp: serverTimestamp(),
    };
    return addDoc(messagesCol, newMessage);
};

export const listenForMessages = (requestId: string, callback: (messages: Message[]) => void) => {
    const messagesCol = collection(db, `rideRequests/${requestId}/messages`);
    const q = query(messagesCol, orderBy("timestamp", "asc"));

    return onSnapshot(q, (querySnapshot) => {
        const messages: Message[] = [];
        querySnapshot.forEach((doc) => {
            messages.push({ id: doc.id, ...doc.data() } as Message);
        });
        callback(messages);
    });
};

// --- Rating System ---

export const completeRide = (requestId: string): Promise<void> => {
    const requestRef = doc(db, "rideRequests", requestId);
    logEvent(analytics, 'ride_completed', { request_id: requestId });
    return updateDoc(requestRef, { status: 'COMPLETED' });
};

export const submitRating = async (driverId: string, rideRequestId: string, passengerId: string, rating: number, review: string): Promise<void> => {
    const driverRef = doc(db, "users", driverId);
    const ratingCol = collection(db, "ratings");

    await runTransaction(db, async (transaction) => {
        const driverDoc = await transaction.get(driverRef);
        if (!driverDoc.exists()) {
            throw "Driver does not exist!";
        }

        const currentData = driverDoc.data() as User;
        const currentRating = currentData.rating || { average: 0, count: 0 };

        const newCount = currentRating.count + 1;
        const newAverage = ((currentRating.average * currentRating.count) + rating) / newCount;

        transaction.update(driverRef, {
            rating: {
                average: newAverage,
                count: newCount
            }
        });
        
        const newRatingRef = doc(ratingCol);
        transaction.set(newRatingRef, {
            driverId,
            rideRequestId,
            passengerId,
            rating,
            review,
            timestamp: serverTimestamp(),
        });
    });

    logEvent(analytics, 'rating_submitted', { rating, has_review: review.length > 0 });
};

export const getRideToRateForPassenger = (passengerId: string, callback: (request: RideRequest | null, driver: User | null) => void) => {
    const rideQuery = query(
        collection(db, "rideRequests"),
        where("passenger.id", "==", passengerId),
        where("status", "==", "COMPLETED"),
        orderBy("timestamp", "desc"),
        limit(1)
    );

    return onSnapshot(rideQuery, (rideSnapshot) => {
        if (rideSnapshot.empty) {
            callback(null, null);
            return;
        }

        const rideDoc = rideSnapshot.docs[0];
        const rideData = { id: rideDoc.id, ...rideDoc.data() } as RideRequest;
        
        const driver = rideData.acceptedBid?.driver ?? null;

        const ratingQuery = query(
            collection(db, "ratings"),
            where("rideRequestId", "==", rideData.id),
            limit(1)
        );

        getDocs(ratingQuery).then(ratingSnapshot => {
            if (ratingSnapshot.empty) {
                callback(rideData, driver);
            } else {
                callback(null, null);
            }
        });
    });
};


// --- App Settings ---

export const listenForFareConfig = (callback: (config: FareConfig | null) => void) => {
    const configRef = doc(db, "settings", "fareConfig");
    return onSnapshot(configRef, (docSnap) => {
        if (docSnap.exists()) {
            callback(docSnap.data() as FareConfig);
        } else {
            // If config is not set in Firestore, return null so the app can handle it
            callback(null);
        }
    });
};

export const updateFareConfig = (config: Partial<FareConfig>): Promise<void> => {
    const configRef = doc(db, "settings", "fareConfig");
    logEvent(analytics, 'fare_config_updated', { admin_action: true });
    // Use setDoc with merge to create or update, preventing accidental deletion of fields
    return setDoc(configRef, config, { merge: true });
};


// --- Admin Functions ---

export const listenForAllUsers = (callback: (users: User[]) => void) => {
    const q = query(collection(db, "users"), orderBy("name", "asc"));
    return onSnapshot(q, (querySnapshot) => {
        const users: User[] = [];
        querySnapshot.forEach((doc) => {
            users.push({ id: doc.id, ...doc.data() } as User);
        });
        callback(users);
    });
};

export const listenForAllRideRequests = (callback: (requests: RideRequest[]) => void) => {
    const q = query(
        collection(db, "rideRequests"), 
        orderBy("timestamp", "desc"),
        limit(50) // Limit to last 50 requests for performance
    );
    return onSnapshot(q, (querySnapshot) => {
        const requests: RideRequest[] = [];
        querySnapshot.forEach((doc) => {
            requests.push({ id: doc.id, ...doc.data() } as RideRequest);
        });
        callback(requests);
    });
};
