import React, { useState, useEffect } from 'react';
import { useAppContext } from '../../hooks/useAppContext';
import { RideRequest, Bid, CarDetails } from '../../types';
import Button from '../shared/Button';
import ChatView from '../shared/ChatView';
import Spinner from '../shared/Spinner';
import { CheckBadgeIcon, LocationMarkerIcon, CarIcon } from '../../constants';
import { 
    setDriverVerified, 
    listenForAvailableRequests, 
    addBidToRequest,
    getAcceptedRideForDriver,
    updateDriverProfile
} from '../../services/firebaseService';

const Verification: React.FC = () => {
    const { state } = useAppContext();
    const [isVerifying, setIsVerifying] = useState(false);

    const handleVerification = async () => {
        if (!state.user?.id) return;
        setIsVerifying(true);
        try {
            await setDriverVerified(state.user.id);
            // The AppContext listener will handle the state update
        } catch (error) {
            console.error("Verification failed:", error);
        } finally {
            setIsVerifying(false);
        }
    };

    return (
        <div className="max-w-md mx-auto text-center bg-slate-800 p-8 rounded-lg shadow-lg">
            <CheckBadgeIcon className="w-16 h-16 mx-auto text-sky-400" />
            <h2 className="text-2xl font-bold mt-4">Become a Verified Driver</h2>
            <p className="text-slate-400 mt-2">Complete a quick check to start accepting rides and earning.</p>
            <div className="mt-6">
                {isVerifying ? (
                    <div className="flex items-center justify-center space-x-2">
                        <Spinner />
                        <span>Verifying your details...</span>
                    </div>
                ) : (
                    <Button onClick={handleVerification} className="w-full">Start Verification</Button>
                )}
            </div>
        </div>
    );
};

const DriverProfileSetup: React.FC = () => {
    const { state } = useAppContext();
    const [carDetails, setCarDetails] = useState<CarDetails>({ make: '', model: '', color: '', licensePlate: '' });
    const [isSubmitting, setIsSubmitting] = useState(false);
    const [error, setError] = useState('');

    const handleChange = (e: React.ChangeEvent<HTMLInputElement>) => {
        setCarDetails({ ...carDetails, [e.target.name]: e.target.value });
    };

    const handleSubmit = async (e: React.FormEvent) => {
        e.preventDefault();
        if (!state.user?.id) return;
        
        if (!carDetails.make || !carDetails.model || !carDetails.color || !carDetails.licensePlate) {
            setError('All fields are required.');
            return;
        }
        setIsSubmitting(true);
        setError('');
        try {
            await updateDriverProfile(state.user.id, carDetails);
            // AppContext listener will update the user state automatically, transitioning the view
        } catch (err) {
            console.error("Failed to update profile:", err);
            setError('Could not save details. Please try again.');
            setIsSubmitting(false);
        }
    };

    return (
        <div className="max-w-md mx-auto bg-slate-800 p-8 rounded-lg shadow-lg">
             <div className="text-center">
                <CarIcon className="w-16 h-16 mx-auto text-sky-400" />
                <h2 className="text-2xl font-bold mt-4">Complete Your Driver Profile</h2>
                <p className="text-slate-400 mt-2">Add your vehicle details so passengers can identify you.</p>
            </div>
            <form onSubmit={handleSubmit} className="mt-8 space-y-4">
                <div>
                    <label htmlFor="make" className="block text-sm font-medium text-slate-300 mb-1">Car Make</label>
                    <input id="make" name="make" type="text" value={carDetails.make} onChange={handleChange} placeholder="e.g., Toyota" required className="w-full bg-slate-700 border border-slate-600 rounded-md px-3 py-2 text-white placeholder-slate-400 focus:ring-sky-500 focus:border-sky-500"/>
                </div>
                 <div>
                    <label htmlFor="model" className="block text-sm font-medium text-slate-300 mb-1">Car Model</label>
                    <input id="model" name="model" type="text" value={carDetails.model} onChange={handleChange} placeholder="e.g., Camry" required className="w-full bg-slate-700 border border-slate-600 rounded-md px-3 py-2 text-white placeholder-slate-400 focus:ring-sky-500 focus:border-sky-500"/>
                </div>
                 <div>
                    <label htmlFor="color" className="block text-sm font-medium text-slate-300 mb-1">Color</label>
                    <input id="color" name="color" type="text" value={carDetails.color} onChange={handleChange} placeholder="e.g., Silver" required className="w-full bg-slate-700 border border-slate-600 rounded-md px-3 py-2 text-white placeholder-slate-400 focus:ring-sky-500 focus:border-sky-500"/>
                </div>
                 <div>
                    <label htmlFor="licensePlate" className="block text-sm font-medium text-slate-300 mb-1">License Plate</label>
                    <input id="licensePlate" name="licensePlate" type="text" value={carDetails.licensePlate} onChange={handleChange} placeholder="e.g., ABC-123" required className="w-full bg-slate-700 border border-slate-600 rounded-md px-3 py-2 text-white placeholder-slate-400 focus:ring-sky-500 focus:border-sky-500"/>
                </div>

                {error && <p className="text-red-400 text-sm">{error}</p>}

                <Button type="submit" className="w-full" disabled={isSubmitting}>
                    {isSubmitting ? <Spinner /> : 'Save and Continue'}
                </Button>
            </form>
        </div>
    );
};

const BidModal: React.FC<{ request: RideRequest; onClose: () => void; onBid: (amount: number, driverLocation?: { latitude: number; longitude: number; }) => void; isBidding: boolean }> = ({ request, onClose, onBid, isBidding }) => {
    const [amount, setAmount] = useState('');
    const [driverLocation, setDriverLocation] = useState<{ latitude: number; longitude: number; } | null>(null);
    const [locationLoading, setLocationLoading] = useState(true);
    const [locationError, setLocationError] = useState('');

    React.useEffect(() => {
        if (!navigator.geolocation) {
            setLocationError('Geolocation is not supported by your browser.');
            setLocationLoading(false);
            return;
        }

        setLocationLoading(true);
        setLocationError('');

        navigator.geolocation.getCurrentPosition(
            (position) => {
                setDriverLocation({
                    latitude: position.coords.latitude,
                    longitude: position.coords.longitude,
                });
                setLocationLoading(false);
            },
            () => {
                setLocationError('Could not get location. You can still bid.');
                setLocationLoading(false);
            }
        );
    }, []);

    const handleSubmit = (e: React.FormEvent) => {
        e.preventDefault();
        const bidAmount = parseInt(amount, 10);
        if (!isNaN(bidAmount) && bidAmount > 0 && !isBidding) {
            onBid(bidAmount, driverLocation ?? undefined);
        }
    };

    return (
        <div className="fixed inset-0 bg-black/70 flex items-center justify-center z-50 p-4">
            <div className="bg-slate-800 rounded-lg p-6 shadow-lg w-full max-w-sm">
                <h3 className="text-xl font-bold mb-2">Place Your Bid</h3>
                <p className="text-sm text-slate-400 mb-4">For ride from <span className="font-semibold">{request.location}</span> to <span className="font-semibold">{request.destination}</span></p>
                <form onSubmit={handleSubmit}>
                    <div className="relative">
                         <span className="absolute inset-y-0 left-0 flex items-center pl-3 text-slate-400">₦</span>
                        <input
                            type="number"
                            value={amount}
                            onChange={(e) => setAmount(e.target.value)}
                            placeholder="e.g. 2500"
                            className="w-full bg-slate-700 border border-slate-600 rounded-md pl-7 pr-3 py-2 text-white placeholder-slate-400 focus:ring-sky-500 focus:border-sky-500"
                            required
                            autoFocus
                        />
                    </div>
                    <div className="mt-2 text-sm h-5 flex items-center">
                        {locationLoading && (
                             <div className="flex items-center space-x-2 text-slate-400">
                                <Spinner className="h-4 w-4" />
                                <span>Getting your location for ETA...</span>
                            </div>
                        )}
                        {locationError && <p className="text-yellow-500 text-xs">{locationError}</p>}
                        {!locationLoading && !locationError && driverLocation && (
                             <p className="text-emerald-400 flex items-center space-x-1.5 text-xs">
                                 <LocationMarkerIcon className="w-3 h-3" />
                                 <span>Location captured for passenger ETA.</span>
                             </p>
                        )}
                    </div>
                    <div className="mt-4 flex justify-end space-x-3">
                        <Button type="button" onClick={onClose} className="bg-slate-600 hover:bg-slate-700" disabled={isBidding}>Cancel</Button>
                        <Button type="submit" disabled={isBidding}>
                            {isBidding ? <Spinner /> : 'Submit Bid'}
                        </Button>
                    </div>
                </form>
            </div>
        </div>
    );
};


const DriverDashboard: React.FC = () => {
    const { state } = useAppContext();
    const { user } = state;
    const [availableRequests, setAvailableRequests] = useState<RideRequest[]>([]);
    const [myAcceptedRide, setMyAcceptedRide] = useState<RideRequest | null>(null);
    const [isLoading, setIsLoading] = useState(true);
    const [selectedRequest, setSelectedRequest] = useState<RideRequest | null>(null);
    const [isBidding, setIsBidding] = useState(false);

    useEffect(() => {
        if (!user || !user.isVerified) {
             setIsLoading(false);
             return;
        };

        const unsubscribeAvailable = listenForAvailableRequests(user.id!, (requests) => {
            setAvailableRequests(requests);
            setIsLoading(false);
        });

        const unsubscribeAccepted = getAcceptedRideForDriver(user.id!, (ride) => {
            setMyAcceptedRide(ride);
        });

        return () => {
            unsubscribeAvailable();
            unsubscribeAccepted();
        };
    }, [user]);
    
    if (!user) return null;
    
    if (!user.isVerified) {
        return <Verification />;
    }

    if (!user.carDetails) {
        return <DriverProfileSetup />;
    }

    if (myAcceptedRide) {
        return (
            <div className="max-w-2xl mx-auto">
                 <div className="bg-slate-800 rounded-lg p-4 mb-4 text-center shadow-lg">
                    <h2 className="text-xl font-bold text-emerald-400">Ride Accepted!</h2>
                    <p className="text-slate-300">Please proceed to pick up <span className="font-semibold">{myAcceptedRide.passenger.name}</span> at <span className="font-semibold">{myAcceptedRide.location}</span>.</p>
                </div>
                <ChatView rideRequestId={myAcceptedRide.id} recipient={myAcceptedRide.passenger} />
            </div>
        );
    }
    
    const handleBidSubmit = async (amount: number, driverLocation?: { latitude: number; longitude: number; }) => {
        if (!selectedRequest || !user) return;
        setIsBidding(true);
        try {
            await addBidToRequest(selectedRequest.id, user, amount, driverLocation);
            setSelectedRequest(null);
        } catch (error) {
            console.error("Failed to submit bid:", error);
            // Optionally show an error to the user
        } finally {
            setIsBidding(false);
        }
    };

    return (
        <div className="max-w-4xl mx-auto">
            <h2 className="text-3xl font-bold mb-6 text-sky-400">Available Ride Requests</h2>
            {isLoading ? (
                 <div className="text-center py-16 bg-slate-800 rounded-lg">
                    <div className="flex justify-center items-center space-x-3">
                        <Spinner />
                        <p className="text-slate-400">Checking for new requests...</p>
                    </div>
                </div>
            ) : availableRequests.length === 0 ? (
                 <div className="text-center py-16 bg-slate-800 rounded-lg">
                    <p className="text-slate-400">No new ride requests at the moment.</p>
                    <p className="text-slate-500 text-sm mt-2">Waiting for passengers...</p>
                </div>
            ) : (
                <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
                    {availableRequests.map(req => (
                        <div key={req.id} className="bg-slate-800 p-5 rounded-lg shadow-lg flex flex-col justify-between">
                            <div className="flex items-start space-x-4">
                               <img src={req.passenger.avatarUrl} alt={req.passenger.name} className="w-12 h-12 rounded-full border-2 border-slate-600" />
                                <div>
                                    <p className="font-bold">{req.passenger.name}</p>
                                    <p className="text-xs text-slate-400">Request received</p>
                                </div>
                            </div>
                            <div className="mt-4 space-y-2 text-sm">
                                <p className="flex items-start"><LocationMarkerIcon className="w-4 h-4 mr-2 mt-0.5 text-slate-400 flex-shrink-0"/> <strong>From:</strong> &nbsp;{req.location}</p>
                                <p className="flex items-start"><LocationMarkerIcon className="w-4 h-4 mr-2 mt-0.5 text-sky-400 flex-shrink-0"/> <strong>To:</strong> &nbsp;{req.destination}</p>
                            </div>
                            <Button onClick={() => setSelectedRequest(req)} className="w-full mt-4">Place Bid</Button>
                        </div>
                    ))}
                </div>
            )}
            {selectedRequest && <BidModal request={selectedRequest} onClose={() => setSelectedRequest(null)} onBid={handleBidSubmit} isBidding={isBidding}/>}
        </div>
    );
};

export default DriverDashboard;