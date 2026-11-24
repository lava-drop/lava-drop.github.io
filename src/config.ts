// Public values: the publishable key only allows what row security and the functions allow.
export const SUPABASE_URL = 'https://htvuzvtylujcnffifrxl.supabase.co';
export const SUPABASE_KEY = 'sb_publishable_41RtpeSYl_XaE9yaGGutvw_eAZEmYb5';

// Accounts are username + password. Supabase needs an email, so each username gets a made-up
// one on a reserved domain that can never receive mail. Email confirmation is off.
export const emailFor = (username: string) => `${username.trim().toLowerCase()}@players.popquiz.invalid`;

// Web push: the public half of the VAPID key pair (the private half is a Supabase function secret).
export const VAPID_PUBLIC = 'BMXEk-EELtjR9Jml8wh_yBvs2ZPSKUevgTcXBhz4KBfUFlP5HoqflWfewVH9Z2CUHuF_1LMeLAuDSkgyC_yWnhw';

// Points taken off for New tiles. Must match public.swap_cost() in the database.
export const SWAP_COST = 5;
