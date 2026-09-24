import { applyTestEnv } from './testEnv';

// Must run before any application module reads configuration.
applyTestEnv();
