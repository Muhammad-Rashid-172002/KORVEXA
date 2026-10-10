import { createApiClient } from '@glasswork/shared/api';
import { API_URL } from './config';

/** Typed REST client (generated from the API's OpenAPI spec) for client components. */
export const api = createApiClient(API_URL);
