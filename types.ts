import { FieldValue } from 'firebase/firestore';

export enum UserRole {
  PASSENGER = 'PASSENGER',
  DRIVER = 'DRIVER',
  ADMIN = 'ADMIN',
}

export interface CarDetails {
  make: string;
  model: string;
  color: string;
  licensePlate: string;
}

export interface User {
  id?: string; // UID from Firebase Auth is the document ID
  name: string;
  avatarUrl: string;
  email: string;
  role: UserRole;
  isVerified: boolean;
  carDetails?: CarDetails;
  licenseUrl?: string;
}

export interface RideRequest {
  id: string;
  passenger: User;
  location: string;
  destination: string;
  timestamp: FieldValue;
  status: 'PENDING' | 'ACCEPTED' | 'COMPLETED' | 'CANCELLED';
  acceptedBidId?: string;
  // Bids and messages are now sub-collections in Firestore
}

export interface Bid {
  id: string;
  driver: User;
  amount: number;
  timestamp: FieldValue;
  driverLocation?: { latitude: number; longitude: number; };
}

export interface Message {
  id: string;
  senderId: string;
  text: string;
  timestamp: FieldValue;
}