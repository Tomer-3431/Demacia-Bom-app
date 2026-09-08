import mongoose from 'mongoose';
import 'dotenv/config';

const mongoUri = process.env.MONGODB_URI;

export async function connect() {
    if (!mongoUri) throw new Error('Failed to connect to .env');

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
