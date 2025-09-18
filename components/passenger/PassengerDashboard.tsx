import React, { useState, useEffect } from 'react';
import { useAppContext } from '../../hooks/useAppContext';
import { RideRequest, Bid } from '../../types';
import Button from '../shared/Button';
import ChatView from '../shared/ChatView';
import { LocationMarkerIcon, CheckBadgeIcon } from '../../constants';
import Spinner from '../shared/Spinner';
import { 
    createRideRequest, 
    getActiveRideRequestForPassenger, 
    listenForBids, 
    acceptBid,
    cancelRideRequest 
} from '../../services/firebaseService';

const RideRequestForm: React.FC<{ onSubmit: (location: string, destination: string) => void; isSubmitting: boolean }> = ({ onSubmit, isSubmitting }) => {
    const [location, setLocation] = useState('');
    const [destination, setDestination] = useState('');
    const [locationLoading, setLocationLoading] = useState(false);
    const [locationError, setLocationError] = useState('');

    const handleGetLocation = () => {
        if (!navigator.geolocation) {
            setLocationError('Geolocation is not supported by your browser.');
            return;
        }

        setLocationLoading(true);
        setLocationError('');

        navigator.geolocation.getCurrentPosition(
            (position) => {
                const { latitude, longitude } = position.coords;
                setLocation(`Lat: ${latitude.toFixed(4)}, Lon: ${longitude.toFixed(4)}`);
                setLocationLoading(false);
            },
            (error) => {
                let message = 'An unknown error occurred.';
                switch (error.code) {
                    case error.PERMISSION_DENIED:
                        message = 'Location permission denied. Please enter manually.';
                        break;
                    case error.POSITION_UNAVAILABLE:
                        message = 'Location information is unavailable.';
                        break;
                    case error.TIMEOUT:
                        message = 'The request to get user location timed out.';
                        break;
                }
                setLocationError(message);
                setLocationLoading(false);
            }
        );
    };


    const handleSubmit = (e: React.FormEvent) => {
        e.preventDefault();
        if (location && destination && !isSubmitting) {
            onSubmit(location, destination);
        }
    };

    return (
        <div className="bg-slate-800 rounded-lg p-6 shadow-lg">
            <h2 className="text-2xl font-bold mb-4 text-sky-400">Request a Ride</h2>
            <form onSubmit={handleSubmit} className="space-y-4">
                <div>
                    <label htmlFor="location" className="block text-sm font-medium text-slate-300 mb-1">Pickup Location</label>
                    <div className="flex space-x-2">
                         <input
                            id="location"
                            type="text"
                            value={location}
                            onChange={(e) => setLocation(e.target.value)}
                            placeholder="Click icon or enter manually"
                            className="flex-grow bg-slate-700 border border-slate-600 rounded-md px-3 py-2 text-white placeholder-slate-400 focus:ring-sky-500 focus:border-sky-500"
                            required
                        />
                         <Button
                            type="button"
                            onClick={handleGetLocation}
                            disabled={locationLoading}
                            className="!p-2.5 flex-shrink-0"
                            aria-label="Get current location"
                        >
                            {locationLoading ? <Spinner /> : <LocationMarkerIcon className="w-5 h-5" />}
                        </Button>
                    </div>
                     {locationError && <p className="text-red-400 text-xs mt-1">{locationError}</p>}
                </div>
                <div>
                    <label htmlFor="destination" className="block text-sm font-medium text-slate-300 mb-1">Destination</label>
                    <input
                        id="destination"
                        type="text"
                        value={destination}
                        onChange={(e) => setDestination(e.target.value)}
                        placeholder="e.g., Murtala Muhammed Airport"
                        className="w-full bg-slate-700 border border-slate-600 rounded-md px-3 py-2 text-white placeholder-slate-400 focus:ring-sky-500 focus:border-sky-500"
                        required
                    />
                </div>
                <Button type="submit" className="w-full" disabled={isSubmitting}>
                    {isSubmitting ? <Spinner/> : 'Broadcast Ride Request'}
                </Button>
            </form>
        </div>
    );
};

const ActiveRequestView: React.FC<{ request: RideRequest }> = ({ request }) => {
    const [bids, setBids] = useState<Bid[]>([]);
    const [isLoadingBids, setIsLoadingBids] = useState(true);

    useEffect(() => {
        const unsubscribe = listenForBids(request.id, (newBids) => {
            setBids(newBids);
            setIsLoadingBids(false);
        });

        return () => unsubscribe();
    }, [request.id]);

    const handleAcceptBid = (bidId: string) => {
        acceptBid(request.id, bidId);
    };

    const handleCancelRide = () => {
        if (window.confirm("Are you sure you want to cancel this ride request?")) {
            cancelRideRequest(request.id);
        }
    };
    
    const parseLocation = (locationStr: string): { latitude: number; longitude: number } | null => {
        const match = locationStr.match(/Lat: ([-]?\d+\.?\d*), Lon: ([-]?\d+\.?\d*)/);
        if (match && match[1] && match[2]) {
            return { latitude: parseFloat(match[1]), longitude: parseFloat(match[2]) };
        }
        return null;
    };

    const getDistanceFromLatLonInKm = (lat1: number, lon1: number, lat2: number, lon2: number): number => {
        const R = 6371; // Radius of the earth in km
        const dLat = (lat2 - lat1) * (Math.PI / 180);
        const dLon = (lon2 - lon1) * (Math.PI / 180);
        const a =
            Math.sin(dLat / 2) * Math.sin(dLat / 2) +
            Math.cos(lat1 * (Math.PI / 180)) * Math.cos(lat2 * (Math.PI / 180)) *
            Math.sin(dLon / 2) * Math.sin(dLon / 2);
        const c = 2 * Math.atan2(Math.sqrt(a), Math.sqrt(1 - a));
        return R * c;
    };

    const calculateEtaInMinutes = (distanceInKm: number): number => {
        const AVERAGE_SPEED_KMH = 30;
        const timeInHours = distanceInKm / AVERAGE_SPEED_KMH;
        const eta = Math.round(timeInHours * 60);
        return eta < 1 ? 1 : eta;
    };

    const passengerCoords = parseLocation(request.location);
    const sortedBids = [...bids].sort((a, b) => a.amount - b.amount);


    return (
        <div className="bg-slate-800 rounded-lg p-6 shadow-lg">
            <div className="flex justify-between items-start">
                <div>
                    <h2 className="text-2xl font-bold text-sky-400">Ride Request Pending</h2>
                    <div className="text-slate-400 mt-2 space-y-1">
                        <p><strong>From:</strong> {request.location}</p>
                        <p><strong>To:</strong> {request.destination}</p>
                    </div>
                </div>
                 <Button onClick={handleCancelRide} className="bg-red-600 hover:bg-red-700 text-sm">Cancel Ride</Button>
            </div>
           
            <div className="mt-6">
                <h3 className="text-lg font-semibold mb-2 flex items-center space-x-2">
                    <span>Driver Bids</span>
                </h3>
                {isLoadingBids ? (
                     <div className="text-center py-8"><Spinner /></div>
                ) : sortedBids.length === 0 ? (
                    <div className="text-center py-8 bg-slate-700/50 rounded-md">
                        <p className="text-slate-400">Waiting for drivers to bid...</p>
                         <div className="flex justify-center mt-2">
                           <Spinner />
                        </div>
                    </div>
                ) : (
                    <ul className="space-y-3">
                        {sortedBids.map((bid) => {
                            let distance: number | null = null;
                            let eta: number | null = null;

                            if (passengerCoords && bid.driverLocation) {
                                distance = getDistanceFromLatLonInKm(
                                    passengerCoords.latitude, passengerCoords.longitude,
                                    bid.driverLocation.latitude, bid.driverLocation.longitude
                                );
                                eta = calculateEtaInMinutes(distance);
                            }

                            return (
                                <li key={bid.id} className="flex items-center justify-between bg-slate-700 p-3 rounded-md">
                                    <div className="flex items-center space-x-3">
                                        <img src={bid.driver.avatarUrl} alt={bid.driver.name} className="w-10 h-10 rounded-full" />
                                        <div>
                                            <div className="flex items-center space-x-2">
                                                <p className="font-semibold">{bid.driver.name}</p>
                                                {bid.driver.isVerified && <CheckBadgeIcon className="w-5 h-5 text-sky-400" title="Verified Driver" />}
                                            </div>
                                            {bid.driver.carDetails ? (
                                                <p className="text-xs text-slate-400">
                                                    {bid.driver.carDetails.make} {bid.driver.carDetails.model}
                                                </p>
                                            ) : (
                                                 <p className="text-xs text-slate-500">Verified Driver</p>
                                            )}
                                            {distance !== null && eta !== null ? (
                                                <div className="text-xs text-slate-400 flex items-center space-x-1.5">
                                                    <span>{distance.toFixed(1)} km away</span>
                                                    <span className="font-bold">&middot;</span>
                                                    <span>~{eta} min ETA</span>
                                                </div>
                                            ) : null}
                                        </div>
                                    </div>
                                    <div className="text-right">
                                        <p className="text-lg font-bold text-emerald-400">₦{bid.amount.toLocaleString()}</p>
                                        <Button onClick={() => handleAcceptBid(bid.id)} className="mt-1 text-xs px-2 py-1">Accept</Button>
                                    </div>
                                </li>
                            );
                        })}
                    </ul>
                )}
            </div>
        </div>
    );
};


const PassengerDashboard: React.FC = () => {
    const { state } = useAppContext();
    const { user } = state;
    const [myActiveRequest, setMyActiveRequest] = useState<RideRequest | null>(null);
    const [bidsForAcceptedRequest, setBidsForAcceptedRequest] = useState<Bid[]>([]);
    const [isLoading, setIsLoading] = useState(true);
    const [isSubmitting, setIsSubmitting] = useState(false);

    useEffect(() => {
        if (!user) return;

        const unsubscribe = getActiveRideRequestForPassenger(user.id!, (request) => {
            setMyActiveRequest(request);
            setIsLoading(false);
        });

        return () => unsubscribe();
    }, [user]);

     useEffect(() => {
        if (myActiveRequest?.status === 'ACCEPTED') {
            const unsubscribe = listenForBids(myActiveRequest.id, setBidsForAcceptedRequest);
            return () => unsubscribe();
        }
    }, [myActiveRequest]);

    const handleRequestSubmit = async (location: string, destination: string) => {
        if (!user) return;
        setIsSubmitting(true);
        try {
            await createRideRequest(user, location, destination);
        } catch (error) {
            console.error("Failed to create ride request:", error);
            // Show error to user
        } finally {
            setIsSubmitting(false);
        }
    };

    if (isLoading) {
        return <div className="text-center mt-8"><Spinner className="w-8 h-8"/></div>;
    }

    if (myActiveRequest?.status === 'ACCEPTED') {
        const acceptedBid = bidsForAcceptedRequest.find(b => b.id === myActiveRequest.acceptedBidId);
        if (!acceptedBid) return <div className="text-center">Loading driver details... <Spinner/></div>;
        
        const { driver } = acceptedBid;
        return (
             <div className="max-w-2xl mx-auto">
                <div className="bg-slate-800 rounded-lg p-6 mb-4 text-center shadow-lg">
                    <h2 className="text-xl font-bold text-emerald-400">Driver on the way!</h2>
                    <p className="text-slate-300 mt-1">You are connected with <span className="font-semibold">{driver.name}</span>.</p>
                    
                    {driver.carDetails && (
                        <div className="mt-4 text-sm bg-slate-700/50 p-3 rounded-lg border border-slate-700 text-left space-y-2">
                            <h3 className="font-bold text-center text-slate-300 mb-2">Look for this vehicle:</h3>
                            <div className="flex justify-between">
                                <span className="text-slate-400">Vehicle:</span>
                                <span className="font-semibold">{driver.carDetails.make} {driver.carDetails.model} ({driver.carDetails.color})</span>
                            </div>
                             <div className="flex justify-between items-center">
                                <span className="text-slate-400">License Plate:</span>
                                <span className="font-mono bg-slate-900 px-2 py-1 rounded text-sky-300 tracking-widest">{driver.carDetails.licensePlate.toUpperCase()}</span>
                            </div>
                        </div>
                    )}

                    <p className="text-slate-400 mt-4">Final price: <span className="font-semibold">₦{acceptedBid.amount.toLocaleString()}</span> (Pay driver directly)</p>
                </div>
                <ChatView rideRequestId={myActiveRequest.id} recipient={driver} />
            </div>
        );
    }
    

    return (
        <div className="max-w-2xl mx-auto">
            {!myActiveRequest ? (
                <RideRequestForm onSubmit={handleRequestSubmit} isSubmitting={isSubmitting} />
            ) : (
                <ActiveRequestView request={myActiveRequest} />
            )}
        </div>
    );
};

export default PassengerDashboard;