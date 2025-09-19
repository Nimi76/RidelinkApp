import React, { useState, useEffect } from 'react';
import { User, RideRequest, UserRole } from '../../types';
import { 
    listenForAllUsers, 
    listenForAllRideRequests,
    updateDriverVerification
} from '../../services/firebaseService';
import Spinner from '../shared/Spinner';
import Button from '../shared/Button';
import { UsersIcon, CarIcon, ShieldCheckIcon, CheckBadgeIcon } from '../../constants';

const StatCard: React.FC<{ title: string; value: number | string; icon: React.ReactNode }> = ({ title, value, icon }) => (
    <div className="bg-slate-800 p-5 rounded-lg shadow-lg flex items-center space-x-4">
        <div className="bg-slate-700 p-3 rounded-full">{icon}</div>
        <div>
            <p className="text-slate-400 text-sm font-medium">{title}</p>
            <p className="text-2xl font-bold">{value}</p>
        </div>
    </div>
);

const UserDetailsModal: React.FC<{ user: User; onClose: () => void; onVerify: (user: User) => void; }> = ({ user, onClose, onVerify }) => (
    <div className="fixed inset-0 bg-black/70 flex items-center justify-center z-50 p-4" onClick={onClose}>
        <div className="bg-slate-800 rounded-lg shadow-lg w-full max-w-lg overflow-hidden" onClick={e => e.stopPropagation()}>
            <div className="p-6">
                <div className="flex items-start space-x-4">
                    <img src={user.avatarUrl} alt={user.name} className="w-24 h-24 rounded-full border-4 border-slate-700" />
                    <div>
                        <h3 className="text-2xl font-bold">{user.name}</h3>
                        <p className="text-slate-400">{user.email}</p>
                         {user.isVerified ? (
                            <span className="mt-2 inline-flex items-center space-x-1.5 text-emerald-400 bg-emerald-500/10 px-2 py-1 rounded-full text-sm">
                                <CheckBadgeIcon className="w-5 h-5" />
                                <span>Verified</span>
                            </span>
                        ) : (
                            <span className="mt-2 inline-flex items-center text-yellow-400 bg-yellow-500/10 px-2 py-1 rounded-full text-sm">
                                Not Verified
                            </span>
                        )}
                    </div>
                </div>

                {user.carDetails && (
                    <div className="mt-6 space-y-2">
                        <h4 className="font-bold text-slate-300">Vehicle Information</h4>
                        <div className="text-sm bg-slate-700/50 p-3 rounded-lg border border-slate-700 space-y-2">
                            <div className="flex justify-between"><span className="text-slate-400">Make:</span> <span className="font-semibold">{user.carDetails.make}</span></div>
                            <div className="flex justify-between"><span className="text-slate-400">Model:</span> <span className="font-semibold">{user.carDetails.model}</span></div>
                            <div className="flex justify-between"><span className="text-slate-400">Color:</span> <span className="font-semibold">{user.carDetails.color}</span></div>
                            <div className="flex justify-between items-center"><span className="text-slate-400">License Plate:</span> <span className="font-mono bg-slate-900 px-2 py-1 rounded text-sky-300 tracking-widest">{user.carDetails.licensePlate.toUpperCase()}</span></div>
                        </div>
                    </div>
                )}
                 {user.licenseUrl && (
                    <div className="mt-4">
                        <h4 className="font-bold text-slate-300 mb-2">Driver's License</h4>
                        <a href={user.licenseUrl} target="_blank" rel="noopener noreferrer">
                            <img src={user.licenseUrl} alt="Driver's License" className="rounded-lg border-2 border-slate-600 max-h-64 w-full object-contain bg-slate-900 cursor-pointer" />
                        </a>
                    </div>
                 )}
            </div>
            <div className="bg-slate-700/50 p-4 flex justify-end space-x-3">
                <Button onClick={onClose} className="bg-slate-600 hover:bg-slate-700">Close</Button>
                <Button onClick={() => onVerify(user)} className={user.isVerified ? 'bg-yellow-600 hover:bg-yellow-700' : 'bg-emerald-600 hover:bg-emerald-700'}>
                    {user.isVerified ? 'Un-verify Driver' : 'Verify Driver'}
                </Button>
            </div>
        </div>
    </div>
);


const AdminDashboard: React.FC = () => {
    const [users, setUsers] = useState<User[]>([]);
    const [rideRequests, setRideRequests] = useState<RideRequest[]>([]);
    const [isLoading, setIsLoading] = useState(true);
    const [selectedUser, setSelectedUser] = useState<User | null>(null);

    useEffect(() => {
        const unsubscribeUsers = listenForAllUsers((allUsers) => {
            setUsers(allUsers);
            setIsLoading(false);
        });
        const unsubscribeRides = listenForAllRideRequests(setRideRequests);

        return () => {
            unsubscribeUsers();
            unsubscribeRides();
        };
    }, []);

    const handleToggleVerification = async (user: User) => {
        if (user.id && user.role === UserRole.DRIVER) {
             try {
                await updateDriverVerification(user.id, !user.isVerified);
                setSelectedUser(null); // Close modal on success
            } catch (error) {
                console.error("Failed to update verification:", error);
                // Optionally show an error toast to the admin
            }
        }
    };
    
    const verifiedDriversCount = users.filter(u => u.role === UserRole.DRIVER && u.isVerified).length;
    const activeRequestsCount = rideRequests.filter(r => r.status === 'PENDING' || r.status === 'ACCEPTED').length;

    if (isLoading) {
        return <div className="text-center"><Spinner className="w-10 h-10" /></div>;
    }

    return (
        <div className="max-w-7xl mx-auto space-y-8">
            <div>
                <h1 className="text-3xl font-bold text-sky-400">Admin Dashboard</h1>
                <p className="text-slate-400 mt-1">Platform overview and management tools.</p>
            </div>
            
            {/* Stats */}
            <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
                <StatCard title="Total Users" value={users.length} icon={<UsersIcon className="w-6 h-6 text-sky-400"/>} />
                <StatCard title="Verified Drivers" value={verifiedDriversCount} icon={<ShieldCheckIcon className="w-6 h-6 text-emerald-400"/>} />
                <StatCard title="Active Ride Requests" value={activeRequestsCount} icon={<CarIcon className="w-6 h-6 text-yellow-400"/>} />
            </div>

            <div className="grid grid-cols-1 lg:grid-cols-2 gap-8 items-start">
                {/* User Management */}
                <div className="bg-slate-800/50 rounded-lg shadow-lg">
                    <h2 className="text-xl font-bold p-4 border-b border-slate-700">User Management</h2>
                    <div className="overflow-x-auto max-h-[600px] overflow-y-auto">
                        <table className="w-full text-sm text-left">
                            <thead className="bg-slate-700/50 sticky top-0">
                                <tr>
                                    <th className="p-3">User</th>
                                    <th className="p-3">Role</th>
                                    <th className="p-3">Status</th>
                                    <th className="p-3">Action</th>
                                </tr>
                            </thead>
                            <tbody>
                                {users.map(user => (
                                    <tr key={user.id} className="border-b border-slate-700 hover:bg-slate-800">
                                        <td className="p-3 flex items-center space-x-3">
                                            <img src={user.avatarUrl} alt={user.name} className="w-8 h-8 rounded-full" />
                                            <div>
                                                <p className="font-semibold">{user.name}</p>
                                                <p className="text-xs text-slate-400">{user.email}</p>
                                            </div>
                                        </td>
                                        <td className="p-3">
                                            <span className={`px-2 py-1 text-xs rounded-full ${user.role === UserRole.DRIVER ? 'bg-emerald-500/20 text-emerald-400' : user.role === UserRole.ADMIN ? 'bg-sky-500/20 text-sky-400' : 'bg-slate-600/50 text-slate-300'}`}>
                                                {user.role}
                                            </span>
                                        </td>
                                        <td className="p-3">
                                            {user.isVerified ? (
                                                <span className="flex items-center space-x-1.5 text-emerald-400">
                                                    <CheckBadgeIcon className="w-4 h-4" />
                                                    <span>Verified</span>
                                                </span>
                                            ) : (
                                                 <span className={`text-slate-400 ${user.role === UserRole.DRIVER && user.licenseUrl ? 'text-yellow-400' : ''}`}>
                                                    {user.role === UserRole.DRIVER && user.licenseUrl ? 'Pending Review' : 'Not Verified'}
                                                 </span>
                                            )}
                                        </td>
                                        <td className="p-3">
                                            {user.role === UserRole.DRIVER && (
                                                <Button onClick={() => setSelectedUser(user)} className="text-xs px-2 py-1">
                                                    View & Verify
                                                </Button>
                                            )}
                                        </td>
                                    </tr>
                                ))}
                            </tbody>
                        </table>
                    </div>
                </div>

                {/* Ride Activity */}
                 <div className="bg-slate-800/50 rounded-lg shadow-lg">
                    <h2 className="text-xl font-bold p-4 border-b border-slate-700">Ride Activity</h2>
                    <div className="max-h-[600px] overflow-y-auto">
                        <ul className="divide-y divide-slate-700">
                           {rideRequests.length === 0 && <p className="p-4 text-slate-400">No ride requests found.</p>}
                            {rideRequests.map(req => (
                                <li key={req.id} className="p-3 space-y-2">
                                    <div className="flex justify-between items-center">
                                         <div className="flex items-center space-x-3">
                                            <img src={req.passenger.avatarUrl} alt={req.passenger.name} className="w-8 h-8 rounded-full" />
                                            <div>
                                                <p className="font-semibold">{req.passenger.name}</p>
                                                <p className="text-xs text-slate-400">Passenger</p>
                                            </div>
                                        </div>
                                        <span className={`px-2 py-1 text-xs rounded-full ${
                                            req.status === 'PENDING' ? 'bg-yellow-500/20 text-yellow-400' : 
                                            req.status === 'ACCEPTED' ? 'bg-sky-500/20 text-sky-400' :
                                            'bg-slate-600/50 text-slate-300'
                                        }`}>
                                            {req.status}
                                        </span>
                                    </div>
                                    <div className="text-xs text-slate-400 space-y-1 pl-11">
                                        <p><strong>From:</strong> {req.location}</p>
                                        <p><strong>To:</strong> {req.destination}</p>
                                    </div>
                                </li>
                            ))}
                        </ul>
                    </div>
                </div>
            </div>
            {selectedUser && <UserDetailsModal user={selectedUser} onClose={() => setSelectedUser(null)} onVerify={handleToggleVerification} />}
        </div>
    );
};

export default AdminDashboard;