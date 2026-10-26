import { ReactNode, useEffect, useMemo, useState } from 'react';
import { useStore, viewId, balanceAfter } from './store';
import { CONFIG, Wallet, sanitationAt, SAN_TOTAL, coinsOf, priceOf } from './config';
import { sfx } from './Sound';

const peso = (n: number) => `${CONFIG.currency}${n}`;
const money = (n: number) => `${CONFIG.currency}${n.toLocaleString('en-PH', { minimumFractionDigits: 2, maximumFractionDigits: 2 })}`;
const Btn = ({ children, onClick, ghost, disabled }: { children: ReactNode; onClick: () => void; ghost?: boolean; disabled?: boolean }) => (
  <button className={ghost ? 'btn ghost' : 'btn'} onClick={onClick} disabled={disabled}>{children}</button>
);

/** Brand badge. Set `logo` on a wallet in config.ts to use an official image instead. */
function Logo({ w }: { w: Wallet }) {
  if (w.logo) return <img className="logo-img" src={w.logo} alt={w.name} />;
  return <span className="logo" style={{ background: w.bg, color: w.fg }}>{w.name}</span>;
}

function QR({ seed }: { seed: number }) {
  const cells = useMemo(() => {
    let x = seed; const rnd = () => { x = (x * 1664525 + 1013904223) >>> 0; return x / 4294967296; };
    const n = 25, out: [number, number][] = [];
    for (let y = 0; y < n; y++) for (let c = 0; c < n; c++) {
      if ((c < 8 && y < 8) || (c >= n - 8 && y < 8) || (c < 8 && y >= n - 8)) continue;
      if (rnd() > 0.5) out.push([c, y]);
    }
    return out;
  }, [seed]);
  return (
    <svg viewBox="-1 -1 27 27" className="qr" aria-label="Simulated payment QR code">
      <rect x="-1" y="-1" width="27" height="27" fill="#fff" />
      {cells.map(([c, y]) => <rect key={c + '-' + y} x={c} y={y} width="1" height="1" fill="#0b1626" />)}
      {[[0, 0], [18, 0], [0, 18]].map(([ox, oy]) => (
        <g key={ox + '' + oy}><rect x={ox} y={oy} width="7" height="7" fill="#0b1626" /><rect x={ox + 1} y={oy + 1} width="5" height="5" fill="#fff" /><rect x={ox + 2} y={oy + 2} width="3" height="3" fill="#0b1626" /></g>
      ))}
    </svg>
  );
}

/** Full-screen zoomed phone: payment processing, then a demo receipt showing the deducted amount. */
function PhoneOverlay() {
  const s = useStore();
  const price = priceOf(s.service);
  const w = CONFIG.wallets.find((x) => x.id === s.wallet) ?? CONFIG.wallets[0];
  if (s.method !== 'qr' || (s.qr !== 'processing' && s.qr !== 'receipt')) return null;
  return (
    <div className="zoom" role="dialog" aria-label="Simulated phone payment">
      <div className="bigphone"><div className="notch" />
        <div className="appbar" style={{ background: w.bg, color: w.fg }}>{w.name}</div>
        {s.qr === 'processing' ? (
          <div className="appbody center"><div className="spin" /><h3>Paying HelmLock V2</h3><p>{money(price)}</p><small>Processing payment…</small></div>
        ) : (
          <div className="appbody">
            <div className="rhead"><div className="check">✓</div><h3>Payment Successful</h3><div className="amt">{money(price)}</div></div>
            <dl className="rcpt">
              <dt>Merchant</dt><dd>HelmLock V2 (demo)</dd>
              <dt>Paid via</dt><dd>{w.name}</dd>
              <dt>Reference No.</dt><dd>{s.qrRef}</dd>
              <dt>Date</dt><dd>{s.qrAt ? new Date(s.qrAt).toLocaleString('en-PH', { dateStyle: 'medium', timeStyle: 'short' }) : ''}</dd>
              <dt>Balance before</dt><dd>{money(CONFIG.walletBalance)}</dd>
              <dt>Amount deducted</dt><dd className="neg">−{money(price)}</dd>
              <dt>Balance after</dt><dd><b>{money(CONFIG.walletBalance - price)}</b></dd>
            </dl>
            <small>Demo receipt only. No real transaction occurred.</small>
            <button className="btn" onClick={s.finishQr}>Done</button>
          </div>
        )}
      </div>
    </div>
  );
}

export default function UI() {
  const s = useStore();
  const view = viewId(s);
  const side = view.startsWith('locker') || view.startsWith('close');
  const compact = !side && (!['screen', 'showcase'].includes(view) || ['stored', 'completed'].includes(s.stage));
  const [muted, setMuted] = useState(sfx.isMuted());
  const [volume, setVolume] = useState(sfx.getVolume());
  const inFlow = !['idle', 'completed', 'stored'].includes(s.stage);
  const price = priceOf(s.service);
  const serviceCoins = coinsOf(s.service);
  const next = serviceCoins[s.coins];
  const rented = Object.keys(s.rentals).length;
  const san = sanitationAt(s.sanitize);
  const stages = CONFIG.sanitationStages;
  useEffect(() => {
    const onKeyDown = (event: KeyboardEvent) => {
      if (event.key.toLowerCase() !== 'h' || event.repeat || s.stage !== 'idle') return;
      const target = event.target;
      if (target instanceof HTMLElement && (target.isContentEditable || ['INPUT', 'TEXTAREA', 'SELECT'].includes(target.tagName))) return;
      s.toggleHotspots();
    };
    window.addEventListener('keydown', onKeyDown);
    return () => window.removeEventListener('keydown', onKeyDown);
  }, [s.stage, s.toggleHotspots]);
  const sanTitle = s.sanitize <= 0 ? 'Preparing the compartment' : s.sanitize >= 1 ? 'Cycle completed' : `${stages[san.index].label} (${san.index + 1} of ${stages.length})`;
  const qrText: Record<string, string> = {
    show: 'Click the QR code to scan it with your phone.', phone: 'Phone approaching…', scanning: 'Scanning code…',
    processing: 'Opening payment app…', receipt: 'Payment confirmed on phone.', done: '✓ Payment Successful',
  };

  let body: ReactNode = null;
  switch (s.stage) {
    case 'welcome':
      body = (<><h1>Welcome to {CONFIG.brand}</h1>
        <p>{rented === 0 ? `Secure helmet storage with optional sanitation. Choose a service, get an access card, and pick up your helmet anytime.` : `${rented} of 3 lockers in use. Rent another locker or retrieve a stored helmet.`}</p>
        {rented === 0 ? <Btn onClick={s.begin}>Begin</Btn>
          : <div className="row"><Btn onClick={s.begin} disabled={rented >= 3}>{rented >= 3 ? 'All lockers in use' : 'Rent a locker'}</Btn><Btn ghost onClick={s.startRetrieval}>Retrieve Helmet</Btn></div>}</>);
      break;
    case 'locker':
      body = (<><h2>Choose a locker</h2><p>The selected compartment lights up on the cabinet. Red lockers are in use.</p>
        <div className="grid3">{[0, 1, 2].map((i) => {
          const busy = s.rentals[i] !== undefined;
          return (<button key={i} className={`tile ${busy ? 'busy' : ''}`} disabled={busy} onMouseEnter={() => s.setHover(i)} onMouseLeave={() => s.setHover(null)} onFocus={() => s.setHover(i)} onBlur={() => s.setHover(null)} onClick={() => s.selectLocker(i)}>
            <b>Locker {i + 1}</b><span><i className={`dot ${busy ? 'red' : ''}`} />{busy ? 'In use' : 'Available'}</span></button>);
        })}</div>
        <Btn ghost onClick={s.back}>Back</Btn></>);
      break;
    case 'service':
      body = (<><h2>Choose a service</h2>
        <div className="grid2">{(['locker', 'sanitize'] as const).map((k) => (
          <button key={k} className="tile wide" onClick={() => s.selectService(k)}><b>{CONFIG.services[k].label}</b><span>{CONFIG.services[k].desc}</span><em>{peso(CONFIG.services[k].price)}</em></button>))}</div>
        <Btn ghost onClick={s.back}>Back</Btn></>);
      break;
    case 'payment':
      if (!s.method) body = (<><h2>Pay {peso(price)}</h2><p>Both methods are simulated. No real payment is made.</p>
        <div className="grid2"><button className="tile" onClick={() => s.chooseMethod('coin')}><b>Coin Payment</b><span>Insert {serviceCoins.length} coins into the slot</span></button>
          <button className="tile" onClick={() => s.chooseMethod('qr')}><b>Online Payment via QR Code</b><span>GCash, Maya and online banking</span></button></div>
        <Btn ghost onClick={s.back}>Back</Btn></>);
      else if (s.method === 'coin') body = (<><h2>Insert coins</h2>
        <div className="balance"><strong>{peso(balanceAfter(s.coins, s.service))}</strong> / {peso(price)}</div>
        <div className="dots">{serviceCoins.map((v, i) => <i key={i} className={i < s.coins ? 'on' : ''}>{i < s.coins ? peso(v) : ''}</i>)}</div>
        {s.paid ? <p className="ok">✓ Payment received</p> : <Btn onClick={s.insertCoin} disabled={s.coinBusy || next === undefined}>Insert {next !== undefined ? peso(next) : ''} coin</Btn>}
        {!s.paid && s.coins === 0 && <Btn ghost onClick={s.back}>Change method</Btn>}</>);
      else body = (<><h2>Scan to pay {peso(price)}</h2>
        <div className="qrlayout">
          <div className="qrbox">
            <button className="qrbtn" onClick={s.scanQr} disabled={s.qr !== 'show'} aria-label="Click the QR code to scan with a phone">
              <QR seed={42} />{s.qr === 'show' && <span className="qrtag">Click to scan</span>}
            </button>
            {(s.qr === 'phone' || s.qr === 'scanning') && <div className={`phone ${s.qr}`}><div className="scan" /></div>}
          </div>
          <div className="wallets"><h3>Supported payment apps</h3>
            <div className="wgrid">{CONFIG.wallets.map((w) => (
              <button key={w.id} style={w.id === 'other' ? { gridColumn: '1 / -1' } : undefined} className={`wbtn ${s.wallet === w.id ? 'sel' : ''}`} disabled={s.qr !== 'show'} aria-pressed={s.wallet === w.id} onClick={() => s.setWallet(w.id)}><Logo w={w} /></button>))}</div>
            <small>E-wallets and online banking. Tap one to choose the app used in this demo.</small></div>
        </div>
        <p className={s.qr === 'done' ? 'ok' : ''}>{qrText[s.qr]}</p>
        <small>Simulated demo QR. No payment gateway is connected.</small>
        {s.qr === 'show' && <Btn ghost onClick={s.back}>Change method</Btn>}</>);
      break;
    case 'card':
      body = s.card === 'collected'
        ? (<><h2>Card collected</h2><p>Keep card <b>{s.cardId}</b>. You will tap it at this kiosk to retrieve your helmet from Locker {(s.locker ?? 0) + 1}.</p><Btn onClick={s.continueToPlacement}>Go to my locker</Btn></>)
        : (<><h2>{s.card === 'out' ? 'Take your access card' : 'Payment successful'}</h2><p>{s.card === 'out' ? 'Click the card sticking out of the dispenser.' : 'Issuing your access card…'}</p></>);
      break;
    case 'placement':
      body = (<><h2>Store your helmet</h2><p>{s.helmet === 'offered' ? 'Click the helmet or press the button to place it in the locker.' : s.helmet === 'placing' ? 'Placing helmet…' : s.helmet === 'inside' ? 'Helmet stored. Closing the door…' : 'Opening the locker door…'}</p>
        {s.helmet === 'offered' && <Btn onClick={s.placeHelmet}>Place Helmet</Btn>}</>);
      break;
    case 'sanitation':
      body = (<><h2>{sanTitle}</h2>
        <ol className="stages">{stages.map((st, i) => {
          const state = s.sanitize >= 1 || i < san.index ? 'done' : i === san.index && s.sanitize > 0 ? 'on' : '';
          return <li key={st.key} className={state}><i style={{ width: state === 'done' ? '100%' : state === 'on' ? `${san.within * 100}%` : '0%' }} />{st.label}</li>;
        })}</ol>
        <p>{s.sanitize > 0 && s.sanitize < 1 ? stages[san.index].detail : ' '}{' '}{Math.max(0, Math.ceil((1 - s.sanitize) * SAN_TOTAL))}s remaining · <b>Simulated sanitation cycle</b></p>
        <small>Visual demonstration only. It does not show real disinfection performance.</small>
        {s.sanitize > 0 && s.sanitize < 1 && <Btn ghost onClick={s.skipSanitation}>Skip cycle</Btn>}</>);
      break;
    case 'stored':
      body = (<><h2>Helmet stored in Locker {(s.locker ?? 0) + 1}</h2><p>{s.service === 'sanitize' ? 'The simulated sanitation cycle is complete. ' : ''}Returning to the home screen…</p></>);
      break;
    case 'retrieval':
      if (s.ret === 'prompt' || s.ret === 'invalid') body = (<><h2>{s.ret === 'invalid' ? 'Card not recognized' : 'Present your access card'}</h2>
        <p className={s.ret === 'invalid' ? 'err' : ''}>{s.ret === 'invalid' ? 'This card does not match any active rental. No locker was opened.' : 'Choose a card to tap on the reader.'}</p>
        <div className="grid2">
          {Object.entries(s.rentals).map(([k, r]) => (<button key={k} className="tile" onClick={() => s.presentCard(r.cardId)}><b>Locker {Number(k) + 1} card</b><span>{r.cardId}</span></button>))}
          <button className="tile" onClick={() => s.presentCard('HL-0000')}><b>Another card</b><span>HL-0000 (not issued)</span></button></div>
        {s.ret === 'invalid' ? <Btn onClick={s.retry}>Try again</Btn> : <Btn ghost onClick={s.back}>Back</Btn>}</>);
      else if (s.ret === 'validating') body = (<><h2>Validating card…</h2><div className="bar"><i className="indet" /></div></>);
      else body = (<><h2>{s.ret === 'ready' ? 'Take your helmet' : s.ret === 'taking' ? 'Removing helmet…' : '✓ Access granted'}</h2><p>{s.ret === 'ready' ? 'Click the helmet to remove it.' : `Opening Locker ${(s.locker ?? 0) + 1}…`}</p></>);
      break;
    case 'completed':
      body = (<><h1>Thanks for riding with {CONFIG.brand}</h1><p>Demo complete: storage{s.service === 'sanitize' ? ', sanitation' : ''} and card retrieval were all simulated.{rented > 0 ? ` ${rented} other locker${rented > 1 ? 's are' : ' is'} still in use.` : ''}</p>
        <div className="row"><Btn onClick={() => s.reset('idle')}>Restart</Btn><Btn ghost onClick={() => s.home('welcome')}>Welcome screen</Btn><Btn ghost onClick={() => s.reset('idle', true)}>Replay guided intro</Btn></div></>);
      break;
  }

  return (
    <div className="ui">
      <header><div className="brand"><b>HelmLock V2</b><span>Smart helmet storage and sanitation kiosk</span></div>
        <div className="top"><span className="badge">Simulation: no hardware, no real payments</span>
          <button className="btn ghost sm" data-silent aria-pressed={!muted} onClick={() => setMuted(sfx.toggleMute())}>{muted ? '🔇 Sound off' : '🔊 Sound on'}</button>
          <label className="volume-control">Volume <input type="range" min="0" max="1" step="0.05" value={volume} aria-label="Sound volume" onChange={(event) => { const value = Number(event.target.value); setVolume(value); sfx.setVolume(value); }} /></label>
          <div className="speed-control" aria-label="Animation speed">
            {[0.5, 1, 2].map((speed) => <button key={speed} className={`btn ghost sm ${s.speed === speed ? 'selected' : ''}`} aria-pressed={s.speed === speed} onClick={() => s.setSpeed(speed)}>{speed}×</button>)}
          </div>
          {s.stage === 'idle' && <button className="btn ghost sm" aria-pressed={s.hotspots} onClick={s.toggleHotspots}>Hotspots (H)</button>}
          {inFlow && <Btn ghost onClick={() => s.home()}>Exit demo</Btn>}</div></header>
      {s.stage === 'idle' && <div className="hint">{s.hotspots ? 'Click a specification marker to inspect it · Press H to hide hotspots' : rented > 0 ? 'Click the touchscreen to rent another locker or retrieve a helmet' : 'Drag to rotate · Click the touchscreen to begin · Try clicking a locker door'}</div>}
      <div className={`warn ${s.warning ? 'show' : ''}`} role="alert">Unauthorized Access Prohibited.</div>
      {body && (
        <section key={s.stage + s.method + s.ret + s.card} className={`panel ${compact ? 'compact' : ''} ${side ? 'side' : ''} ${s.stage === 'payment' && s.method === 'qr' ? 'wide' : ''}`}>
          {['service', 'payment', 'card', 'placement', 'sanitation', 'stored'].includes(s.stage) && s.locker !== null && (
            <div className="chips"><span>Locker {s.locker + 1}</span>{s.service && <span>{CONFIG.services[s.service].label}</span>}
              {s.paid && <span>Paid {peso(price)}</span>}{s.cardId && <span>Card {s.cardId}</span>}</div>)}
          {body}
        </section>)}
      <PhoneOverlay />
    </div>
  );
}