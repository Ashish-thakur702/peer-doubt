export function authServiceMessage(issue) {
    if (issue === 'database_config_missing')
        return 'MongoDB is not configured for this app. Add MONGODB_URI and MONGODB_DB=Doubt to .env.local, then restart the server.';
    if (issue === 'database_uri_invalid')
        return 'MONGODB_URI could not be parsed. Copy the Atlas driver connection string and URL-encode special characters in the username or password.';
    if (issue === 'database_auth_failed')
        return 'MongoDB rejected the app credentials. Check the Atlas database username and password, then URL-encode special characters in the URI.';
    if (issue === 'database_dns_failed')
        return 'The MongoDB Atlas hostname could not be resolved. Verify the cluster host and allow DNS SRV lookups on this network. Atlas also provides a standard mongodb:// connection string if SRV is blocked.';
    if (issue === 'database_connection_timeout')
        return 'MongoDB did not respond within 12 seconds. In Atlas Network Access, allow this app’s public IP; also check that the cluster is active and outbound DNS and port 27017 are available.';
    if (issue === 'auth_config_missing')
        return 'Authentication is missing its production settings. Set NEXTAUTH_SECRET and NEXTAUTH_URL in the app environment.';
    if (issue === 'database_unavailable')
        return 'The app cannot reach MongoDB. Check the Atlas IP access list, cluster status, and this app host’s DNS and outbound port 27017 access.';
    return 'The sign-in service could not be reached. Check your connection and try again.';
}
