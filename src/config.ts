/** Single place to tune the demo. All values are simulated. */
export type SanKey = 'uv' | 'fog' | 'ozone' | 'dry';
export type ServiceKey = 'locker' | 'sanitize';
export interface Wallet { id: string; name: string; bg: string; fg: string; kind: 'wallet' | 'bank'; /** optional: path/URL to an official logo image (overrides the text badge) */ logo?: string }

export const CONFIG = {
  brand: 'HelmLock V2',
  currency: '₱',
  /** Demo balance shown on the simulated phone before paying. */
  walletBalance: 500,
  /** Supported online payment apps shown next to the QR code. Put official logos in /public and set `logo: '/logos/gcash.png'`. */
  wallets: [
    { id: 'gcash', name: 'GCash', bg: '#0a63f2', fg: '#ffffff', kind: 'wallet' },
    { id: 'maya', name: 'Maya', bg: '#0b0f0d', fg: '#2dff8a', kind: 'wallet' },
    { id: 'bdo', name: 'BDO', bg: '#0b3d91', fg: '#ffd23f', kind: 'bank' },
    { id: 'bpi', name: 'BPI', bg: '#b3151c', fg: '#ffffff', kind: 'bank' },
    { id: 'unionbank', name: 'UnionBank', bg: '#f26b21', fg: '#ffffff', kind: 'bank' },
    { id: 'landbank', name: 'Landbank', bg: '#0e7a3b', fg: '#ffffff', kind: 'bank' },
    { id: 'other', name: 'Other Bank', bg: '#334155', fg: '#e8fffb', kind: 'bank' },
  ] as Wallet[],
  /** Simulated sanitation cycle: stages run in this order, each for `seconds`. */
  sanitationStages: [
    { key: 'uv', label: 'UV light', detail: 'UV lamp sweeps the compartment.', seconds: 4 },
    { key: 'fog', label: 'Fogging', detail: 'Ultrasonic mist fills the compartment.', seconds: 4 },
    { key: 'ozone', label: 'Ozone', detail: 'Ozone treatment circulates.', seconds: 4 },
    { key: 'dry', label: 'Drying', detail: 'Heated airflow dries the interior.', seconds: 4 },
  ] as { key: SanKey; label: string; detail: string; seconds: number }[],
  /** Animation timing: seconds for GSAP tweens, *Ms keys in milliseconds. */
  timing: {
    camera: 1.4, door: 0.9, coin: 0.8, card: 0.9, helmet: 1.1, shake: 0.05,
    warningMs: 2200, qrPhoneMs: 1100, qrScanMs: 1500, qrProcessMs: 1800, receiptAutoMs: 7000, validateMs: 1100, storedMs: 3000,
  },
  services: {
    locker: { label: 'Locker Only', desc: 'Secure storage for your helmet behind a locked front door.', price: 20, coins: [5, 5, 5, 5] },
    sanitize: { label: 'Locker + Sanitation', desc: 'Secure storage plus a simulated 4-stage sanitation cycle while you are away.', price: 30, coins: [10, 10, 5, 5] },
  } as Record<ServiceKey, { label: string; desc: string; price: number; coins: number[] }>,
};

export const priceOf = (service: ServiceKey | null) => CONFIG.services[service ?? 'locker'].price;
export const coinsOf = (service: ServiceKey | null) => CONFIG.services[service ?? 'locker'].coins;

export const SAN_TOTAL = CONFIG.sanitationStages.reduce((a, b) => a + b.seconds, 0);

/** Which sanitation stage a 0..1 progress value falls in, and progress inside that stage. */
export function sanitationAt(p: number) {
  const st = CONFIG.sanitationStages;
  let t = Math.min(1, Math.max(0, p)) * SAN_TOTAL;
  for (let i = 0; i < st.length; i++) {
    if (t < st[i].seconds || i === st.length - 1) return { index: i, within: Math.min(1, t / st[i].seconds) };
    t -= st[i].seconds;
  }
  return { index: 0, within: 0 };
}

(Object.keys(CONFIG.services) as ServiceKey[]).forEach((key) => {
  const service = CONFIG.services[key];
  const sum = service.coins.reduce((a, b) => a + b, 0);
  if (sum !== service.price || service.coins.length !== 4) {
    console.warn(`[HelmLock] ${key}: 4 coins must add up to ${service.price} (got ${sum}).`);
  }
});