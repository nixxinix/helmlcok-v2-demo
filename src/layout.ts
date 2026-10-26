/** Scene geometry (metres) and camera views. Cabinet: 70 cm wide x 180 cm tall x 45 cm deep. */
export const TX = 0.175; // locker tower centre x
export const KX = -0.175; // kiosk centre x
export const FZ = 0.225; // front plane z
export const Y = [0.3, 0.9, 1.5]; // locker centre heights (bottom -> top)
export const COIN_SLOT: [number, number, number] = [KX, 0.6, 0.25];

export interface View { pos: [number, number, number]; target: [number, number, number]; free: boolean }

export function viewFor(id: string): View {
  const [k, n] = id.split(':');
  const yc = Y[Number(n) || 0];
  switch (k) {
    case 'coin': return { pos: [-0.33, 0.64, 0.95], target: [-0.35, 0.56, 0.2], free: false };
    case 'card': return { pos: [-0.33, 0.62, 0.9], target: [-0.35, 0.4, 0.2], free: false };
    case 'locker': return { pos: [0.2, yc + 0.08, 1.35], target: [0.2, yc - 0.02, 0.1], free: false };
    case 'close': return { pos: [0.18, yc + 0.03, 0.95], target: [0.175, yc - 0.02, 0.1], free: false };
    case 'screen': return { pos: [-0.2, 0.95, 2.5], target: [-0.45, 0.9, 0], free: false };
    default: return { pos: [1.5, 1.45, 2.9], target: [0, 0.9, 0], free: true };
  }
}
