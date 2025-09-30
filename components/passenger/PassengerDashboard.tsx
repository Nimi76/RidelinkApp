import React, { useState, useEffect } from 'react';
import { useAppContext } from '../../hooks/useAppContext';
import { RideRequest, Bid, FareConfig, User } from '../../types';
import Button from '../shared/Button';
import ChatView from '../shared/ChatView';
import { LocationMarkerIcon, CheckBadgeIcon, StarIcon } from '../../constants';
import Spinner from '../shared/Spinner';
import { 
    createRideRequest, 
    getActiveRideRequestForPassenger, 
    listenForBids, 
    acceptBid,
    cancelRideRequest,
    getRideToRateForPassenger,
    submitRating
} from '../../services/firebaseService';
import { getRideEstimate } from '../../services/api';

const FareEstimate: React.FC<{
    isCalculating: boolean;
    error: string;
    fare: number | null;
}> = ({ isCalculating, error, fare }) => {
    // Hide if nothing is happening and there's no result
    if (!isCalculating && !error && fare === null) {
        return null;
    }

    return (
        <div className="mt-4 p-4 bg-slate-700/50 rounded-lg text-center transition-all duration-300">
            {isCalculating && (
                <div className="flex items-center justify-center space-x-2 text-slate-400">
                    <Spinner className="w-4 h-4" />
                    <span>Calculating estimated fare...</span>
                </div>
            )}
            {error && !isCalculating && (
                <p className="text-yellow-400 text-sm">{error}</p>
            )}
            {fare !== null && !isCalculating && !error && (
                <div>
                    <p className="text-sm text-slate-400">Estimated Fare</p>
                    <p className="text-2xl font-bold text-emerald-400">~₦{fare.toLocaleString()}</p>
                    <p className="text-xs text-slate-500 mt-1">This is an estimate. Drivers will bid with their final price.</p>
                </div>
            )}
        </div>
    );
};


const RideRequestForm: React.FC<{ 
    onSubmit: (location: string, destination: string) => void; 
    isSubmitting: boolean;
    fareConfig: FareConfig | null;
}> = ({ onSubmit, isSubmitting, fareConfig }) => {
    const [location, setLocation] = useState('');
    const [destination, setDestination] = useState('');
    const [locationLoading, setLocationLoading] = useState(false);
    const [locationError, setLocationError] = useState('');

    // New state for fare estimation
    const [estimatedFare, setEstimatedFare] = useState<number | null>(null);
    const [isCalculatingFare, setIsCalculatingFare] = useState(false);
    const [fareError, setFareError] = useState('');

    // Debounce effect for fare calculation
    useEffect(() => {
        // Only calculate if both fields are reasonably filled and fareConfig is loaded
        if (location.trim().length > 3 && destination.trim().length > 3 && fareConfig) {
            const handler = setTimeout(() => {
                const calculateFare = async () => {
                    setIsCalculatingFare(true);
                    setFareError('');
                    setEstimatedFare(null);

                    const estimate = await getRideEstimate(location, destination);

                    if (estimate) {
                        const { distance, duration } = estimate;
                        const calculatedFare = fareConfig.baseFare + (distance * fareConfig.ratePerKm) + (duration * fareConfig.ratePerMinute);
                        // Round to nearest 50 for a cleaner look
                        setEstimatedFare(Math.round(calculatedFare / 50) * 50);
                    } else {
                        setFareError('Could not calculate a fare. Please enter more specific locations.');
                    }
                    setIsCalculatingFare(false);
                };
                calculateFare();
            }, 750); // 750ms debounce delay

            return () => {
                clearTimeout(handler);
            };
        } else {
            // Reset if inputs are cleared or too short
            setEstimatedFare(null);
            setFareError('');
            setIsCalculatingFare(false);
        }
    }, [location, destination, fareConfig]);


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

                {!fareConfig && (
                    <div className="text-center p-3 bg-slate-700/50 rounded-lg text-slate-400 text-sm">
                        Loading fare information...
                    </div>
                )}
                
                <FareEstimate 
                    isCalculating={isCalculatingFare}
                    error={fareError}
                    fare={estimatedFare}
                />

                <Button type="submit" className="w-full" disabled={isSubmitting || !fareConfig}>
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
                                                {bid.driver.rating && bid.driver.rating.count > 0 && (
                                                    <div className="flex items-center space-x-1 text-xs text-amber-400">
                                                        <StarIcon className="w-4 h-4" />
                                                        <span>{bid.driver.rating.average.toFixed(1)}</span>
                                                    </div>
                                                )}
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

const RatingForm: React.FC<{ ride: RideRequest; driver: User; onComplete: () => void }> = ({ ride, driver, onComplete }) => {
    const { state } = useAppContext();
    const { user: passenger } = state;
    const [rating, setRating] = useState(0);
    const [hoverRating, setHoverRating] = useState(0);
    const [review, setReview] = useState('');
    const [isSubmitting, setIsSubmitting] = useState(false);
    const [error, setError] = useState('');

    const handleSubmit = async (e: React.FormEvent) => {
        e.preventDefault();
        if (rating === 0) {
            setError('Please select a star rating.');
            return;
        }
        if (!passenger?.id || !driver?.id) return;
        
        setIsSubmitting(true);
        setError('');
        try {
            await submitRating(driver.id, ride.id, passenger.id, rating, review);
            onComplete();
        } catch (err) {
            console.error("Failed to submit rating:", err);
            setError('Could not submit your rating. Please try again.');
        } finally {
            setIsSubmitting(false);
        }
    };

    return (
        <div className="bg-slate-800 rounded-lg p-6 shadow-lg">
            <h2 className="text-2xl font-bold mb-2 text-sky-400">Rate your ride with {driver.name}</h2>
            <p className="text-slate-400 mb-6 text-sm">Trip from {ride.location} to {ride.destination}</p>
            
            <form onSubmit={handleSubmit} className="space-y-6">
                <div>
                    <label className="block text-sm font-medium text-slate-300 mb-2">Your Rating</label>
                    <div className="flex items-center space-x-1">
                        {[1, 2, 3, 4, 5].map((star) => (
                            <StarIcon
                                key={star}
                                className={`w-8 h-8 cursor-pointer transition-colors ${
                                    (hoverRating || rating) >= star ? 'text-amber-400' : 'text-slate-600'
                                }`}
                                onClick={() => setRating(star)}
                                onMouseEnter={() => setHoverRating(star)}
                                onMouseLeave={() => setHoverRating(0)}
                            />
                        ))}
                    </div>
                </div>

                <div>
                    <label htmlFor="review" className="block text-sm font-medium text-slate-300 mb-1">
                        Add a review (optional)
                    </label>
                    <textarea
                        id="review"
                        value={review}
                        onChange={(e) => setReview(e.target.value)}
                        rows={3}
                        placeholder={`How was your trip? Praising ${driver.name} or leaving tips can help other riders.`}
                        className="w-full bg-slate-700 border border-slate-600 rounded-md px-3 py-2 text-white placeholder-slate-400 focus:ring-sky-500 focus:border-sky-500"
                    />
                </div>
                 {error && <p className="text-red-400 text-sm text-center">{error}</p>}
                <Button type="submit" className="w-full" disabled={isSubmitting}>
                    {isSubmitting ? <Spinner /> : 'Submit Rating'}
                </Button>
            </form>
        </div>
    );
};


const PassengerDashboard: React.FC = () => {
    const { state } = useAppContext();
    const { user, fareConfig } = state;
    const [myActiveRequest, setMyActiveRequest] = useState<RideRequest | null>(null);
    const [bidsForAcceptedRequest, setBidsForAcceptedRequest] = useState<Bid[]>([]);
    const [isLoading, setIsLoading] = useState(true);
    const [isSubmitting, setIsSubmitting] = useState(false);
    const [rideToRate, setRideToRate] = useState<RideRequest | null>(null);
    const [driverToRate, setDriverToRate] = useState<User | null>(null);

    useEffect(() => {
        if (!user || !user.id) return;

        const unsubscribeActive = getActiveRideRequestForPassenger(user.id, (request) => {
            setMyActiveRequest(request);
            setIsLoading(false);
        });

        const unsubscribeRidesToRate = getRideToRateForPassenger(user.id, (ride, driver) => {
            setRideToRate(ride);
            setDriverToRate(driver);
        });

        return () => {
            unsubscribeActive();
            unsubscribeRidesToRate();
        };
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

    if (rideToRate && driverToRate) {
        return (
            <div className="max-w-2xl mx-auto">
                <RatingForm 
                    ride={rideToRate}
                    driver={driverToRate}
                    onComplete={() => {
                        setRideToRate(null);
                        setDriverToRate(null);
                    }}
                />
            </div>
        );
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
                <RideRequestForm 
                    onSubmit={handleRequestSubmit} 
                    isSubmitting={isSubmitting}
                    fareConfig={fareConfig}
                />
            ) : (
                <ActiveRequestView request={myActiveRequest} />
            )}
        </div>
    );
};

export default PassengerDashboard;
