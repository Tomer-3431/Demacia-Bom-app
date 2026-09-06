import dotenv from 'dotenv';
import mongoose from 'mongoose';

dotenv.config();

const mongoUri = process.env.MONGODB_URI || "mongodb://127.0.0.1:27017";

export async function connect() {
    mongoose.connection.on('connected', () => console.log('MongoDB connected'));
    mongoose.connection.on('error', (err) => console.error('MongoDB connection error:', err));
    mongoose.connection.on('disconnected', () => console.warn('MongoDB disconnected'));

    await mongoose.connect(mongoUri, {
        serverSelectionTimeoutMS: 5000
    });
    return isConnected();
}

export function isConnected() {
    return mongoose.connection.readyState === 1;
}
