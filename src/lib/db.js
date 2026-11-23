import dns from 'node:dns';
import mongoose from 'mongoose';
import { cleanEnvironmentValue } from './url-config.mjs';

function applyDnsConfiguration() {
    const raw = process.env.MONGODB_DNS_SERVERS || '8.8.8.8,1.1.1.1';
    try {
        const configuredDnsServers = raw
            .split(',')
            .map((server) => server.trim())
            .filter(Boolean);
        if (configuredDnsServers.length) {
            dns.setServers(configuredDnsServers);
        }
    } catch {
        // Keep environment default if setting servers fails
    }
}

applyDnsConfiguration();

const CACHE_KEY = '__unstuckMongoose';
const connectionCache = globalThis[CACHE_KEY] || (globalThis[CACHE_KEY] = {
    connection: null,
    promise: null,
    uri: null,
    listenerConnection: null,
});

function configurationError(code, message) {
    const error = new Error(message);
    error.code = code;
    return error;
}

function readMongoConfig() {
    const uri = cleanEnvironmentValue(process.env.MONGODB_URI);
    if (!uri)
        throw configurationError('MONGODB_CONFIG_MISSING', 'Set MONGODB_URI in the application environment.');
    if (uri.includes('YOUR_CLUSTER') || /\/\/USERNAME:PASSWORD@/i.test(uri))
        throw configurationError('MONGODB_CONFIG_MISSING', 'Replace the example MongoDB URI with the application connection string.');

    let parsed;
    try {
        parsed = new URL(uri);
    } catch {
        throw configurationError('MONGODB_URI_INVALID', 'MONGODB_URI is not a valid MongoDB connection string.');
    }
    if (!['mongodb:', 'mongodb+srv:'].includes(parsed.protocol) || !parsed.hostname)
        throw configurationError('MONGODB_URI_INVALID', 'MONGODB_URI must use mongodb:// or mongodb+srv:// and include a host.');

    const configuredName = process.env.MONGODB_DB?.trim();
    let pathName = '';
    try {
        pathName = decodeURIComponent(parsed.pathname.replace(/^\/+/, '').split('/')[0] || '');
    } catch {
        throw configurationError('MONGODB_URI_INVALID', 'The database path in MONGODB_URI contains invalid URL encoding.');
    }

    return { uri, dbName: configuredName || pathName || 'Doubt' };
}

function attachConnectionDiagnostics(connection) {
    if (connectionCache.listenerConnection === connection) return;
    connectionCache.listenerConnection = connection;

    connection.on('error', (error) => {
        console.error('MONGODB_CONNECTION_ERROR', {
            name: error?.name || 'Error',
            code: error?.code || error?.cause?.code || 'UNKNOWN',
        });
    });
    connection.on('disconnected', () => {
        if (connectionCache.connection === connection && connection.readyState !== 1) {
            connectionCache.connection = null;
            connectionCache.promise = null;
            connectionCache.uri = null;
        }
    });
}

export default async function connectDB() {
    applyDnsConfiguration();
    const { uri, dbName } = readMongoConfig();

    if (connectionCache.connection?.readyState === 1 && connectionCache.uri === uri)
        return connectionCache.connection;
    if (connectionCache.promise && connectionCache.uri === uri)
        return connectionCache.promise;

    if (connectionCache.uri && connectionCache.uri !== uri) {
        connectionCache.connection = null;
        connectionCache.promise = null;
        connectionCache.uri = null;
        if (mongoose.connection.readyState !== 0)
            await mongoose.disconnect();
    }

    connectionCache.uri = uri;
    connectionCache.promise = mongoose.connect(uri, {
        dbName,
        serverSelectionTimeoutMS: 10_000,
        connectTimeoutMS: 10_000,
        socketTimeoutMS: 30_000,
        waitQueueTimeoutMS: 10_000,
        maxPoolSize: 10,
        minPoolSize: 0,
        autoIndex: process.env.NODE_ENV !== 'production',
    }).then(() => {
        const connection = mongoose.connection;
        connectionCache.connection = connection;
        connectionCache.promise = null;
        attachConnectionDiagnostics(connection);
        return connection;
    }).catch((error) => {
        connectionCache.connection = null;
        connectionCache.promise = null;
        connectionCache.uri = null;
        throw error;
    });

    return connectionCache.promise;
}
