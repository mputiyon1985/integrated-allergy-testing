import * as Sentry from '@sentry/nextjs';

Sentry.init({
  dsn: process.env.NEXT_PUBLIC_SENTRY_DSN,
  environment: process.env.NODE_ENV,
  tracesSampleRate: 0.1, // 10% of transactions for performance monitoring
  enabled: process.env.NODE_ENV === 'production',
  // Don't capture auth errors — too noisy
  ignoreErrors: [
    'Session expired',
    'Unauthorized',
    'No valid session',
  ],
});
