import { 
    GoogleAuthProvider, 
    signInWithPopup,
    signOut,
    User as FirebaseUser,
} from "firebase/auth";
import { 
    doc,
    getDoc,
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
} from "firebase/firestore";
import { logEvent } from "firebase/analytics";
import { auth, db, analytics } from '../firebase';
import { User, UserRole, RideRequest, Bid, Message, CarDetails } from '../types';

const provider = new GoogleAuthProvider();

// IMPORTANT: Replace this with the email you want to use for administration.
export const ADMIN_EMAIL = 'basoeneoruye@gmail.com';


// --- Authentication ---

export const handleGoogleSignIn = async (role: UserRole): Promise<void> => {
    const result = await signInWithPopup(auth, provider);
    const user = result.user;
    await createUserProfile(user, role);
    logEvent(analytics, 'login', { method: 'google', role });
};

export const handleSignOut = (): Promise<void> => {
    return signOut(auth);
};

// --- User Profile Management ---

export const createUserProfile = async (firebaseUser: FirebaseUser, role: UserRole): Promise<void> => {
    const userRef = doc(db, "users", firebaseUser.uid);
    const userSnap = await getDoc(userRef);

    if (!userSnap.exists()) {
        const isUserAdmin = firebaseUser.email === ADMIN_EMAIL;
        const actualRole = isUserAdmin ? UserRole.ADMIN : role;

        const newUser: Omit<User, 'id'> = {
            name: firebaseUser.displayName || 'Anonymous',
            email: firebaseUser.email || '',
            avatarUrl: firebaseUser.photoURL || `https://picsum.photos/seed/${firebaseUser.uid}/100/100`,
            role: actualRole,
            isVerified: false,
        };
        await setDoc(userRef, newUser);
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

export const setDriverVerified = (uid: string): Promise<void> => {
    logEvent(analytics, 'driver_self_verified', { driver_id: uid });
    return updateDriverVerification(uid, true);
};

export const updateDriverProfile = (uid: string, carDetails: CarDetails): Promise<void> => {
    const userRef = doc(db, "users", uid);
    return updateDoc(userRef, { carDetails });
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
            carDetails: driver.carDetails
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