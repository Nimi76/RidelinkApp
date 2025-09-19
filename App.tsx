import React from 'react';
import { useAppContext } from './hooks/useAppContext';
import Login from './components/auth/Login';
import PassengerDashboard from './components/passenger/PassengerDashboard';
import DriverDashboard from './components/driver/DriverDashboard';
import AdminDashboard from './components/admin/AdminDashboard';
import { UserRole } from './types';
import Header from './components/shared/Header';
import Spinner from './components/shared/Spinner';
import AdminLogin from './components/admin/AdminLogin';

const App: React.FC = () => {
  const { state } = useAppContext();
  const { user, isLoading } = state;
  const isAdminRoute = window.location.pathname === '/admin';

  if (isLoading) {
    return (
      <div className="flex items-center justify-center min-h-screen">
        <Spinner className="w-10 h-10" />
      </div>
    );
  }

  if (isAdminRoute) {
    if (user && user.role === UserRole.ADMIN) {
       return (
         <div className="min-h-screen bg-slate-900 text-white font-sans">
            <Header />
            <main className="p-4 sm:p-6 md:p-8">
                <AdminDashboard />
            </main>
         </div>
       );
    }
    return <AdminLogin />;
  }

  return (
    <div className="min-h-screen bg-slate-900 text-white font-sans">
      {!user ? (
        <Login />
      ) : (
        <>
          <Header />
          <main className="p-4 sm:p-6 md:p-8">
            {user.role === UserRole.PASSENGER && <PassengerDashboard />}
            {user.role === UserRole.DRIVER && <DriverDashboard />}
            {user.role === UserRole.ADMIN && <AdminDashboard />}
          </main>
        </>
      )}
    </div>
  );
};

export default App;