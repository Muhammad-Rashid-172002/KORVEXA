import { publicGw } from './public-api';

/** Which social sign-in providers the API has keys for, resolved on the server so the form never shifts. */
export async function serverOAuthProviders(): Promise<{ google: boolean; github: boolean }> {
  const { data } = await publicGw<{ oauth?: { google: boolean; github: boolean } }>('/config/public');
  return data?.oauth ?? { google: false, github: false };
}
