import { create } from 'zustand';
import gsap from 'gsap';
import { CONFIG, SAN_TOTAL, sanitationAt, coinsOf, priceOf } from './config';
import { sfx } from './Sound';

export type Stage = 'idle' | 'welcome' | 'locker' | 'service' | 'payment' | 'card' | 'placement' | 'sanitation' | 'stored' | 'retrieval' | 'completed';
export type Service = 'locker' | 'sanitize';
export type Method = 'coin' | 'qr';
export type HelmetState = 'hidden' | 'offered' | 'placing' | 'inside' | 'removing' | 'gone';
export type CardState = 'hidden' | 'out' | 'collecting' | 'collected';
export type Ret = 'prompt' | 'validating' | 'invalid' | 'valid' | 'opening' | 'ready' | 'taking' | 'done';
export type Qr = 'show' | 'phone' | 'scanning' | 'processing' | 'receipt' | 'done';
export interface Rental { cardId: string; service: Service }

const T = CONFIG.timing;
const ms = (s: number) => s * 1000;
let timers: number[] = [];
let ticker: number | undefined;
let session = 0;
let speedMul = 1;
function later(fn: () => void, delay: number) {
  const s = session;
  timers.push(window.setTimeout(() => { if (s === session) fn(); }, delay / speedMul));
}
function clearAll() {
  session++;
  timers.forEach((t) => window.clearTimeout(t));
  timers = [];
  if (ticker !== undefined) window.clearInterval(ticker);
  ticker = undefined;
  sfx.ambient(null);
}
export const balanceAfter = (n: number, service: Service | null) => coinsOf(service).slice(0, n).reduce((a, b) => a + b, 0);
const newId = () => 'HL-' + Math.floor(Math.random() * 0xffff).toString(16).toUpperCase().padStart(4, '0');

/** Everything belonging to the current (in-progress) transaction. Rentals live outside so they survive a return to the home screen. */
const txFresh = () => ({
  stage: 'idle' as Stage, locker: null as number | null, service: null as Service | null, method: null as Method | null,
  coins: 0, coinBusy: false, paid: false, qr: 'show' as Qr, wallet: CONFIG.wallets[0].id, qrRef: null as string | null, qrAt: null as number | null,
  cardId: null as string | null, card: 'hidden' as CardState, doorOpen: [false, false, false], helmet: 'hidden' as HelmetState,
  sanitize: 0, ret: 'prompt' as Ret, warning: false, hover: null as number | null,
});

interface Actions {
  reset: (stage?: Stage, replay?: boolean) => void; home: (stage?: Stage) => void;
  screenClick: () => void; begin: () => void; back: () => void;
  selectLocker: (i: number) => void; selectService: (s: Service) => void; chooseMethod: (m: Method) => void;
  setWallet: (id: string) => void; scanQr: () => void; finishQr: () => void;
  insertCoin: () => void; completePayment: () => void;
  collectCard: () => void; cardCollected: () => void; continueToPlacement: () => void;
  placeHelmet: () => void; helmetPlaced: () => void; finishStorage: () => void;
  startRetrieval: () => void; presentCard: (id: string) => void; retry: () => void;
  takeHelmet: () => void; helmetRemoved: () => void; doorClick: (i: number) => void; setHover: (i: number | null) => void;
  toggleHotspots: () => void; setSpeed: (v: number) => void; skipSanitation: () => void;
}
export type State = ReturnType<typeof txFresh> & { rentals: Record<number, Rental>; intro: number; shake: { locker: number; n: number }; hotspots: boolean; speed: number } & Actions;

export const useStore = create<State>((set, get) => {
  const door = (i: number, v: boolean) => get().doorOpen.map((d, k) => (k === i ? v : d));
  const setDoor = (i: number, v: boolean) => {
    set({ doorOpen: door(i, v) });
    sfx[v ? 'doorOpen' : 'doorClose']();
  };
  return {
    ...txFresh(), rentals: {}, intro: 0, shake: { locker: -1, n: 0 }, hotspots: false, speed: 1,
    /** Full restart: clears the transaction AND every rental. */
    reset: (stage = 'idle', replay = false) => { clearAll(); set({ ...txFresh(), stage, rentals: {}, intro: get().intro + (replay ? 1 : 0) }); },
    /** Back to the home screen: clears the transaction but keeps stored helmets (red lockers). */
    home: (stage = 'idle') => { clearAll(); set({ ...txFresh(), stage }); },
    screenClick: () => { if (get().stage === 'idle') { set({ stage: 'welcome' }); sfx.wake(); } },
    begin: () => { const s = get(); if (s.stage === 'welcome' && Object.keys(s.rentals).length < 3) set({ stage: 'locker' }); },
    back: () => {
      const s = get();
      if (s.stage === 'locker') set({ stage: 'welcome', hover: null });
      else if (s.stage === 'service') set({ stage: 'locker', locker: null });
      else if (s.stage === 'payment') {
        if (s.coins > 0 || s.paid) return;
        if (s.method === 'qr' && s.qr !== 'show') return;
        if (s.method) set({ method: null, qr: 'show' }); else set({ stage: 'service', service: null });
      } else if (s.stage === 'retrieval' && (s.ret === 'prompt' || s.ret === 'invalid')) set({ stage: 'welcome', ret: 'prompt' });
    },
    selectLocker: (i) => { const s = get(); if (s.stage !== 'locker' || s.rentals[i]) return; set({ locker: i, stage: 'service', hover: null }); sfx.select(); },
    selectService: (sv) => { if (get().stage === 'service') { set({ service: sv, stage: 'payment' }); sfx.select(); } },
    chooseMethod: (m) => { if (get().stage === 'payment' && !get().method) { set({ method: m, coins: 0, qr: 'show' }); sfx.select(); } },
    setWallet: (id) => { const s = get(); if (s.method === 'qr' && s.qr === 'show') set({ wallet: id }); },
    /** User clicked the QR: phone arrives, scans, zooms to its screen, shows a receipt, then pays. */
    scanQr: () => {
      const s = get();
      if (s.stage !== 'payment' || s.method !== 'qr' || s.qr !== 'show') return;
      let t = T.qrPhoneMs;
      set({ qr: 'phone' });
      sfx.whoosh();
      later(() => { set({ qr: 'scanning' }); sfx.scan(); }, t);
      t += T.qrScanMs; later(() => { set({ qr: 'processing' }); sfx.processing(); }, t);
      t += T.qrProcessMs;
      later(() => { set({ qr: 'receipt', qrRef: String(Math.floor(Math.random() * 1e12)).padStart(12, '0'), qrAt: Date.now() }); sfx.success(); }, t);
      t += T.receiptAutoMs; later(() => get().finishQr(), t);
    },
    finishQr: () => { if (get().qr !== 'receipt') return; set({ qr: 'done' }); get().completePayment(); },
    insertCoin: () => {
      const s = get();
      if (s.stage !== 'payment' || s.method !== 'coin' || s.coinBusy || s.paid || s.coins >= coinsOf(s.service).length) return;
      const n = s.coins + 1;
      set({ coins: n, coinBusy: true });
      sfx.coinToss();
      later(() => sfx.coin(), ms(T.coin) * 0.72);
      later(() => set({ coinBusy: false }), ms(T.coin));
      if (balanceAfter(n, s.service) >= priceOf(s.service)) later(() => get().completePayment(), ms(T.coin) + 300);
    },
    completePayment: () => {
      if (get().paid) return;
      set({ paid: true, cardId: newId() });
      sfx.paid();
      later(() => set({ stage: 'card' }), 1300);
      later(() => { set({ card: 'out' }); sfx.dispense(); }, 1300 + ms(T.camera) * 0.8);
    },
    collectCard: () => { if (get().card === 'out') { set({ card: 'collecting' }); sfx.cardPick(); } },
    cardCollected: () => { set({ card: 'collected' }); sfx.select(); },
    continueToPlacement: () => {
      const s = get();
      if (s.stage !== 'card' || s.card !== 'collected' || s.locker === null) return;
      const l = s.locker;
      set({ stage: 'placement' });
      later(() => setDoor(l, true), ms(T.camera));
      later(() => { set({ helmet: 'offered' }); sfx.pop(); }, ms(T.camera + T.door));
    },
    placeHelmet: () => { if (get().helmet === 'offered') { set({ helmet: 'placing' }); sfx.whoosh(); } },
    helmetPlaced: () => {
      const s = get();
      const l = s.locker;
      if (l === null || !s.cardId || !s.service) return;
      set({ helmet: 'inside', rentals: { ...s.rentals, [l]: { cardId: s.cardId, service: s.service } } });
      sfx.thump();
      later(() => setDoor(l, false), 400);
      later(() => {
        if (get().service === 'sanitize') {
          set({ stage: 'sanitation', sanitize: 0 });
          later(() => {
            const step = 100 / ms(SAN_TOTAL);
            let last = 0;
            sfx.stageChange();
            sfx.ambient(CONFIG.sanitationStages[0].key);
            ticker = window.setInterval(() => {
              const p = get().sanitize + step * speedMul;
              if (p >= 1) {
                window.clearInterval(ticker); ticker = undefined;
                set({ sanitize: 1 });
                sfx.ambient(null);
                sfx.complete();
                later(() => get().finishStorage(), 1100);
              } else {
                set({ sanitize: p });
                const index = sanitationAt(p).index;
                if (index !== last) {
                  last = index;
                  sfx.stageChange();
                  sfx.ambient(CONFIG.sanitationStages[index].key);
                }
              }
            }, 100);
          }, ms(T.camera) * 0.8);
        } else get().finishStorage();
      }, 400 + ms(T.door) + 300);
    },
    /** Helmet is stored: confirm briefly, then return to the home screen (idle) with the locker marked red. */
    finishStorage: () => {
      if (!['placement', 'sanitation'].includes(get().stage)) return;
      set({ stage: 'stored' });
      sfx.stored();
      later(() => get().home(), T.storedMs);
    },
    startRetrieval: () => { const s = get(); if (s.stage === 'welcome' && Object.keys(s.rentals).length > 0) set({ stage: 'retrieval', ret: 'prompt' }); },
    presentCard: (id) => {
      const s = get();
      if (s.stage !== 'retrieval' || (s.ret !== 'prompt' && s.ret !== 'invalid')) return;
      set({ ret: 'validating' });
      sfx.cardInsert();
      later(() => {
        const hit = Object.entries(get().rentals).find(([, r]) => r.cardId === id);
        if (!hit) { set({ ret: 'invalid' }); sfx.error(); return; }
        const l = Number(hit[0]);
        set({ ret: 'valid', locker: l, service: hit[1].service, cardId: id, helmet: 'inside' });
        sfx.success();
        later(() => set({ ret: 'opening' }), 900);
        later(() => setDoor(l, true), 900 + ms(T.camera));
        later(() => set({ ret: 'ready' }), 900 + ms(T.camera + T.door));
      }, T.validateMs);
    },
    retry: () => { if (get().ret === 'invalid') set({ ret: 'prompt' }); },
    takeHelmet: () => { const s = get(); if (s.ret === 'ready' && s.helmet === 'inside') { set({ ret: 'taking', helmet: 'removing' }); sfx.whoosh(); } },
    helmetRemoved: () => {
      const s = get();
      const l = s.locker;
      if (l === null) return;
      const rentals = { ...s.rentals }; delete rentals[l];
      set({ helmet: 'gone', rentals });
      sfx.success();
      setDoor(l, false);
      later(() => { set({ stage: 'completed', ret: 'done' }); sfx.fanfare(); }, ms(T.door) + 500);
    },
    doorClick: (i) => {
      const s = get();
      if (s.doorOpen[i]) return;
      if (['placement', 'sanitation', 'retrieval'].includes(s.stage) && s.locker === i) return;
      set({ shake: { locker: i, n: s.shake.n + 1 }, warning: true });
      sfx.denied();
      later(() => set({ warning: false }), T.warningMs);
    },
    setHover: (i) => { set({ hover: i }); if (i !== null) sfx.tick(); },
    toggleHotspots: () => set({ hotspots: !get().hotspots }),
    setSpeed: (v) => { speedMul = v; gsap.globalTimeline.timeScale(v); set({ speed: v }); },
    skipSanitation: () => {
      const s = get();
      if (s.stage === 'sanitation' && s.sanitize > 0 && s.sanitize < 1) set({ sanitize: 0.9999 });
    },
  };
});

/** Which camera view the current state needs. */
export function viewId(s: State): string {
  const L = s.locker ?? 0;
  switch (s.stage) {
    case 'idle': case 'stored': case 'completed': return 'showcase';
    case 'payment': return s.method === 'coin' ? 'coin' : 'screen';
    case 'card': return 'card';
    case 'placement': return 'locker:' + L;
    case 'sanitation': return 'close:' + L;
    case 'retrieval': return ['opening', 'ready', 'taking', 'done'].includes(s.ret) ? 'locker:' + L : 'screen';
    default: return 'screen';
  }
}