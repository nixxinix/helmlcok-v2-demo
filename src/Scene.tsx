import * as THREE from 'three';
import { useEffect, useMemo, useRef } from 'react';
import { Canvas, useFrame, useThree, MeshProps } from '@react-three/fiber';
import { OrbitControls, Environment, Lightformer, ContactShadows, MeshReflectorMaterial, Html } from '@react-three/drei';
import gsap from 'gsap';
import { useStore, viewId } from './store';
import { CONFIG, sanitationAt } from './config';
import { TX, KX, FZ, Y, COIN_SLOT, viewFor } from './layout';
import { sfx } from './Sound';

const T = CONFIG.timing;
const TEAL = '#2ee6d0';
const cursor = (on: boolean) => { document.body.style.cursor = on ? 'pointer' : 'auto'; };

/* ---------- procedural textures (no network assets) ---------- */
function canvasTex(w: number, h: number, draw: (x: CanvasRenderingContext2D) => void) {
  const c = document.createElement('canvas'); c.width = w; c.height = h;
  draw(c.getContext('2d')!);
  const t = new THREE.CanvasTexture(c); t.colorSpace = THREE.SRGBColorSpace; t.anisotropy = 8; return t;
}
const labelTex = (text: string, fg = '#dffcf8', size = 64) => canvasTex(512, 128, (x) => {
  x.fillStyle = fg; x.font = `700 ${size}px system-ui, sans-serif`; x.textAlign = 'center'; x.textBaseline = 'middle'; x.fillText(text, 256, 64);
});
const screenTex = (a: string, b: string) => canvasTex(640, 400, (x) => {
  const g = x.createLinearGradient(0, 0, 640, 400); g.addColorStop(0, '#0d1d33'); g.addColorStop(1, '#0a3a44');
  x.fillStyle = g; x.fillRect(0, 0, 640, 400);
  x.strokeStyle = TEAL; x.lineWidth = 4; x.strokeRect(14, 14, 612, 372);
  x.textAlign = 'center'; x.fillStyle = '#e8fffb'; x.font = '700 64px system-ui'; x.fillText(a, 320, 180);
  x.fillStyle = TEAL; x.font = '500 34px system-ui'; x.fillText(b, 320, 250);
});
const cardTex = () => canvasTex(512, 320, (x) => {
  const g = x.createLinearGradient(0, 0, 512, 320); g.addColorStop(0, '#0f2a44'); g.addColorStop(1, '#13867c');
  x.fillStyle = g; x.fillRect(0, 0, 512, 320);
  x.fillStyle = '#e8fffb'; x.font = '700 50px system-ui'; x.fillText('HelmLock V2', 36, 100);
  x.fillStyle = TEAL; x.font = '500 28px system-ui'; x.fillText('ACCESS CARD · DEMO', 36, 150);
  x.fillStyle = '#f0c75e'; x.fillRect(36, 220, 80, 60);
});

/* ---------- small helpers ---------- */
type BP = { p: [number, number, number]; a: [number, number, number]; c?: string; m?: number; r?: number; e?: string; ei?: number } & Omit<MeshProps, 'position' | 'args'>;
function B({ p, a, c = '#2a3039', m = 0.55, r = 0.42, e, ei = 0, ...rest }: BP) {
  return (
    <mesh position={p} castShadow receiveShadow {...rest}>
      <boxGeometry args={a} />
      <meshStandardMaterial color={c} metalness={m} roughness={r} emissive={e ?? '#000000'} emissiveIntensity={ei} />
    </mesh>
  );
}

/* ---------- cabinet ---------- */
function Fan({ i }: { i: number }) {
  const g = useRef<THREE.Group>(null);
  const idx = useStore((s) => (s.stage === 'sanitation' && s.locker === i ? sanitationAt(s.sanitize).index : -1));
  useFrame((_, d) => { const sp = idx === 3 ? 18 : idx === 2 ? 3 : 0; if (g.current) g.current.rotation.z += d * sp; });
  return (
    <group ref={g} position={[TX, Y[i] + 0.05, -0.2]}>
      {[0, 1, 2, 3].map((k) => <mesh key={k} rotation={[0, 0, (k * Math.PI) / 2]}><boxGeometry args={[0.012, 0.09, 0.004]} /><meshStandardMaterial color="#111820" /></mesh>)}
      <mesh><cylinderGeometry args={[0.014, 0.014, 0.01, 12]} /><meshStandardMaterial color="#556" /></mesh>
    </group>
  );
}

function Interior({ i }: { i: number }) {
  const light = useRef<THREE.PointLight>(null);
  const uv = useRef<THREE.MeshStandardMaterial>(null);
  const mist = useRef<THREE.MeshStandardMaterial>(null);
  const open = useStore((s) => s.doorOpen[i]);
  const idx = useStore((s) => (s.stage === 'sanitation' && s.locker === i ? sanitationAt(s.sanitize).index : -1));
  useFrame(() => {
    if (light.current) light.current.intensity += ((open ? 1.4 : idx >= 0 ? 0.35 : 0.03) - light.current.intensity) * 0.1;
    if (uv.current) uv.current.emissiveIntensity += ((idx === 0 ? 5 : 1.2) - uv.current.emissiveIntensity) * 0.1;
    if (mist.current) mist.current.emissiveIntensity += ((idx === 1 ? 2.2 : 0.5) - mist.current.emissiveIntensity) * 0.1;
  });
  return (
    <group>
      <mesh position={[TX, Y[i] + 0.27, 0]}><boxGeometry args={[0.26, 0.008, 0.03]} /><meshStandardMaterial ref={uv} color="#6b4bd6" emissive="#8b5cff" emissiveIntensity={1.2} metalness={0} /></mesh>
      <mesh position={[TX, Y[i] - 0.28, -0.05]}><boxGeometry args={[0.2, 0.012, 0.2]} /><meshStandardMaterial ref={mist} color="#0b4a52" emissive={TEAL} emissiveIntensity={0.5} metalness={0.2} /></mesh>
      <Fan i={i} />
      <pointLight ref={light} position={[TX, Y[i] + 0.12, 0.12]} color="#cffffa" distance={1.2} intensity={0.03} />
    </group>
  );
}

function Door({ i }: { i: number }) {
  const g = useRef<THREE.Group>(null);
  const mat = useRef<THREE.MeshStandardMaterial>(null);
  const edge = useRef<THREE.LineBasicMaterial>(null);
  const open = useStore((s) => s.doorOpen[i]);
  const shake = useStore((s) => s.shake);
  const glassy = useStore((s) => s.stage === 'sanitation' && s.locker === i);
  const hl = useStore((s) => (s.stage === 'locker' && s.hover === i) || (s.locker === i && ['service', 'payment', 'card', 'placement', 'sanitation'].includes(s.stage)));
  const occ = useStore((s) => s.rentals[i] !== undefined);
  const edges = useMemo(() => new THREE.EdgesGeometry(new THREE.BoxGeometry(0.33, 0.58, 0.04)), []);
  const num = useMemo(() => labelTex(String(i + 1), '#cfe8ff', 90), [i]);
  const HX = TX + 0.175;

  useEffect(() => { if (g.current) gsap.to(g.current.rotation, { y: open ? 1.95 : 0, duration: T.door, ease: 'power2.inOut' }); }, [open]);
  useEffect(() => {
    if (!g.current || shake.locker !== i) return;
    gsap.fromTo(g.current.position, { x: HX }, { x: HX + 0.012, duration: T.shake, repeat: 7, yoyo: true, ease: 'sine.inOut', onComplete: () => { if (g.current) g.current.position.x = HX; } });
  }, [shake]);
  useFrame(({ clock }) => {
    if (mat.current) { mat.current.opacity += ((glassy ? 0.14 : 1) - mat.current.opacity) * 0.08; mat.current.depthWrite = mat.current.opacity > 0.9; }
    if (edge.current) edge.current.opacity = hl ? 0.55 + 0.45 * Math.sin(clock.elapsedTime * 5) : 0;
  });

  return (
    <group ref={g} position={[HX, Y[i], FZ + 0.012]}>
      <mesh position={[-0.158, 0, 0]} castShadow receiveShadow
        onClick={(e) => { e.stopPropagation(); useStore.getState().doorClick(i); }}
        onPointerOver={(e) => { e.stopPropagation(); if (!open) cursor(true); }} onPointerOut={() => cursor(false)}>
        <boxGeometry args={[0.31, 0.54, 0.024]} />
        <meshStandardMaterial ref={mat} color="#6f7b8a" metalness={0.85} roughness={0.32} transparent />
      </mesh>
      <B p={[-0.275, 0, 0.02]} a={[0.026, 0.1, 0.014]} c="#1d3fb8" e="#3b6bff" ei={0.6} m={0.2} />
      {[0.2, 0.17].map((y) => <B key={y} p={[-0.158, y, 0.016]} a={[0.1, 0.014, 0.008]} c="#cfd6df" m={0.9} r={0.25} />)}
      <mesh position={[-0.158, -0.2, 0.0135]}><planeGeometry args={[0.07, 0.07]} /><meshBasicMaterial map={num} transparent toneMapped={false} /></mesh>
      <mesh position={[-0.04, 0.23, 0.0135]}><circleGeometry args={[0.01, 16]} /><meshBasicMaterial color={occ ? '#ff5c5c' : '#3dff9a'} toneMapped={false} /></mesh>
      <lineSegments geometry={edges} position={[-0.158, 0, 0.01]}><lineBasicMaterial ref={edge} color={TEAL} transparent opacity={0} toneMapped={false} /></lineSegments>
    </group>
  );
}

function Kiosk() {
  const stage = useStore((s) => s.stage);
  const idle = stage === 'idle';
  const m = useRef<THREE.MeshBasicMaterial>(null);
  const plate = useMemo(() => labelTex('HELMLOCK V2', '#2ee6d0', 56), []);
  const coinT = useMemo(() => labelTex('COIN', '#9fb2c8', 44), []);
  const cardT = useMemo(() => labelTex('CARD', '#9fb2c8', 44), []);
  const idleT = useMemo(() => screenTex('Touch to start', 'HelmLock V2'), []);
  const useT = useMemo(() => screenTex('HelmLock V2', 'Session in progress'), []);
  const insert = () => useStore.getState().insertCoin();
  const coinHint = useStore((s) => s.stage === 'payment' && s.method === 'coin' && !s.paid);
  useFrame(({ clock }) => { if (m.current) m.current.color.setScalar(idle ? 0.8 + 0.2 * Math.sin(clock.elapsedTime * 2.2) : 0.85); });
  return (
    <group>
      <B p={[KX, 0.5, 0]} a={[0.35, 1.0, 0.45]} c="#262c35" />
      <B p={[KX, 1.006, 0]} a={[0.36, 0.012, 0.46]} c="#8a95a3" m={0.9} r={0.3} />
      <mesh position={[KX, 0.945, FZ + 0.0015]}><planeGeometry args={[0.26, 0.065]} /><meshBasicMaterial map={plate} transparent toneMapped={false} /></mesh>
      {/* touchscreen */}
      <B p={[KX, 0.78, FZ + 0.006]} a={[0.3, 0.2, 0.014]} c="#0a0d12" m={0.3}
        onClick={(e) => { e.stopPropagation(); useStore.getState().screenClick(); }}
        onPointerOver={() => idle && cursor(true)} onPointerOut={() => cursor(false)} />
      <mesh position={[KX, 0.78, FZ + 0.0135]}><planeGeometry args={[0.27, 0.168]} /><meshBasicMaterial ref={m} map={idle ? idleT : useT} toneMapped={false} /></mesh>
      {/* coin acceptor */}
      <B p={[KX, 0.58, FZ + 0.01]} a={[0.1, 0.14, 0.03]} c="#1a1f27" />
      <B p={COIN_SLOT} a={[0.006, 0.04, 0.006]} c="#000" e={TEAL} ei={1.6} />
      <mesh position={[KX, 0.52, FZ + 0.0261]}><planeGeometry args={[0.07, 0.02]} /><meshBasicMaterial map={coinT} transparent toneMapped={false} /></mesh>
      <mesh position={[KX, 0.58, 0.28]} onClick={(e) => { e.stopPropagation(); insert(); }} onPointerOver={() => coinHint && cursor(true)} onPointerOut={() => cursor(false)}>
        <boxGeometry args={[0.13, 0.17, 0.1]} /><meshBasicMaterial visible={false} />
      </mesh>
      {coinHint && <Html position={[KX, 0.47, 0.3]} center style={{ pointerEvents: 'none' }}><div className="finger"><span>👆</span>Insert coins here</div></Html>}
      {/* card dispenser */}
      <B p={[KX, 0.36, FZ + 0.01]} a={[0.13, 0.05, 0.03]} c="#1a1f27" />
      <B p={[KX, 0.36, FZ + 0.0265]} a={[0.1, 0.008, 0.004]} c="#000" e={TEAL} ei={1.6} />
      <mesh position={[KX, 0.31, FZ + 0.0261]}><planeGeometry args={[0.07, 0.02]} /><meshBasicMaterial map={cardT} transparent toneMapped={false} /></mesh>
    </group>
  );
}

function Tower() {
  return (
    <group>
      {[0, 1, 2, 3].map((k) => <B key={k} p={[TX, k * 0.6 + (k === 3 ? -0.01 : k === 0 ? 0.01 : 0), 0]} a={[0.35, 0.02, 0.45]} c="#222831" />)}
      <B p={[TX - 0.165, 0.9, 0]} a={[0.02, 1.8, 0.45]} c="#2a3039" />
      <B p={[TX + 0.165, 0.9, 0]} a={[0.02, 1.8, 0.45]} c="#2a3039" />
      <B p={[TX, 0.9, -0.215]} a={[0.35, 1.8, 0.02]} c="#1b2028" />
      {[0, 1, 2].map((i) => <Interior key={i} i={i} />)}
    </group>
  );
}

/* ---------- animated props ---------- */
function Coins() {
  const coins = useStore((s) => s.coins);
  const refs = useRef<(THREE.Group | null)[]>([]);
  const prev = useRef(0);
  useEffect(() => {
    if (coins === 0) { refs.current.forEach((g) => g && (g.visible = false)); prev.current = 0; return; }
    if (coins > prev.current) {
      const g = refs.current[coins - 1];
      if (g) {
        g.visible = true; g.position.set(KX, 0.68, 0.6); g.rotation.set(0, 0, 0);
        gsap.timeline({ onComplete: () => { g.visible = false; } })
          .to(g.position, { y: COIN_SLOT[1], z: COIN_SLOT[2] + 0.015, duration: T.coin * 0.75, ease: 'power2.in' }, 0)
          .to(g.rotation, { x: Math.PI * 5, duration: T.coin * 0.75, ease: 'none' }, 0)
          .to(g.position, { z: COIN_SLOT[2] - 0.03, duration: T.coin * 0.25, ease: 'power1.out' });
      }
    }
    prev.current = coins;
  }, [coins]);
  return (
    <>
      {CONFIG.coins.map((v, i) => (
        <group key={i} ref={(el) => { refs.current[i] = el; }} visible={false}>
          <mesh rotation={[0, 0, Math.PI / 2]} castShadow>
            <cylinderGeometry args={[v >= 10 ? 0.014 : 0.011, v >= 10 ? 0.014 : 0.011, 0.003, 28]} />
            <meshStandardMaterial color={v >= 10 ? '#e0b64a' : '#c9ced6'} metalness={1} roughness={0.25} />
          </mesh>
        </group>
      ))}
    </>
  );
}

function AccessCard() {
  const card = useStore((s) => s.card);
  const g = useRef<THREE.Group>(null);
  const tex = useMemo(cardTex, []);
  useEffect(() => {
    const o = g.current; if (!o) return;
    gsap.killTweensOf([o.position, o.rotation, o.scale]);
    if (card === 'hidden' || card === 'collected') { o.visible = false; o.position.set(KX, 0.36, 0.215); o.rotation.set(0, 0, 0); o.scale.setScalar(1); }
    if (card === 'out') { o.visible = true; gsap.to(o.position, { z: 0.34, duration: T.card, ease: 'power2.out' }); }
    if (card === 'collecting') {
      gsap.timeline({ onComplete: () => { o.visible = false; useStore.getState().cardCollected(); } })
        .to(o.position, { x: -0.31, y: 0.58, z: 0.7, duration: 0.9, ease: 'power2.inOut' }, 0)
        .to(o.rotation, { x: Math.PI / 2, duration: 0.9, ease: 'power2.inOut' }, 0)
        .to(o.scale, { x: 2.4, y: 2.4, z: 2.4, duration: 0.9 }, 0)
        .to(o.position, { z: 0.8, duration: 0.3 });
    }
  }, [card]);
  return (
    <group ref={g} visible={false} position={[KX, 0.36, 0.215]}>
      <mesh castShadow onClick={(e) => { e.stopPropagation(); useStore.getState().collectCard(); }} onPointerOver={() => cursor(true)} onPointerOut={() => cursor(false)}>
        <boxGeometry args={[0.086, 0.002, 0.054]} />
        {[0, 1, 3, 4, 5].map((k) => <meshStandardMaterial key={k} attach={`material-${k}`} color="#1c6f69" />)}
        <meshStandardMaterial attach="material-2" map={tex} roughness={0.35} />
      </mesh>
      {card === 'out' && <Html position={[0, 0.04, 0.05]} center style={{ pointerEvents: 'none' }}><div className="finger"><span>👆</span>Click to collect</div></Html>}
    </group>
  );
}

function Helmet() {
  const helmet = useStore((s) => s.helmet);
  const locker = useStore((s) => s.locker);
  const g = useRef<THREE.Group>(null);
  useEffect(() => {
    const o = g.current; if (!o || locker === null) return;
    const yc = Y[locker];
    gsap.killTweensOf([o.position, o.scale]);
    if (helmet === 'offered') { o.position.set(TX, yc - 0.02, 0.8); o.scale.setScalar(0.01); gsap.to(o.scale, { x: 1, y: 1, z: 1, duration: 0.5, ease: 'back.out(2)' }); }
    if (helmet === 'inside') { o.position.set(TX, yc - 0.145, 0.02); o.scale.setScalar(1); }
    if (helmet === 'placing') {
      gsap.timeline()
        .to(o.position, { y: yc - 0.03, z: 0.3, duration: T.helmet * 0.5, ease: 'power2.inOut' })
        .to(o.position, { y: yc - 0.145, z: 0.02, duration: T.helmet * 0.5, ease: 'power2.out', onComplete: () => useStore.getState().helmetPlaced() });
    }
    if (helmet === 'removing') {
      gsap.timeline({ onComplete: () => useStore.getState().helmetRemoved() })
        .to(o.position, { y: yc, z: 0.35, duration: T.helmet * 0.45, ease: 'power2.inOut' })
        .to(o.position, { x: 0.2, y: yc + 0.1, z: 1.0, duration: T.helmet * 0.7, ease: 'power2.inOut' })
        .to(o.scale, { x: 1.6, y: 1.6, z: 1.6, duration: T.helmet * 0.7 }, '<');
    }
  }, [helmet, locker]);
  const click = useStore((s) => (s.helmet === 'offered' || (s.helmet === 'inside' && s.ret === 'ready' && s.stage === 'retrieval')));
  const visible = helmet !== 'hidden' && helmet !== 'gone';
  return (
    <group ref={g} visible={visible} position={[TX, 0.9, 0.02]}
      onClick={(e) => { e.stopPropagation(); const s = useStore.getState(); if (s.helmet === 'offered') s.placeHelmet(); else s.takeHelmet(); }}
      onPointerOver={() => click && cursor(true)} onPointerOut={() => cursor(false)}>
      <mesh scale={[1, 0.95, 1.12]} castShadow><sphereGeometry args={[0.13, 32, 24]} /><meshStandardMaterial color="#10192b" metalness={0.5} roughness={0.2} /></mesh>
      <mesh scale={[1, 0.95, 1.12]} rotation={[0, 0, 0]}><sphereGeometry args={[0.134, 32, 16, Math.PI / 2 - 0.75, 1.5, 1.05, 0.6]} /><meshStandardMaterial color="#38e6d2" metalness={0.9} roughness={0.08} emissive="#0b6f66" emissiveIntensity={0.5} /></mesh>
      <B p={[0, -0.1, 0.1]} a={[0.1, 0.04, 0.06]} c="#0c1220" m={0.3} />
      {click && helmet === 'offered' && <Html position={[0, 0.24, 0]} center style={{ pointerEvents: 'none' }}><div className="finger"><span>👆</span>Click to place</div></Html>}
      {click && helmet === 'inside' && <Html position={[0, 0.24, 0]} center style={{ pointerEvents: 'none' }}><div className="finger"><span>👆</span>Click to take</div></Html>}
    </group>
  );
}

/** Per-stage look of the sanitation cycle: 0 UV light, 1 fogging, 2 ozone, 3 drying. */
const FX = [
  { color: '#b99bff', size: 0.006, op: 0, speed: 0.02, drift: 0, light: '#8b5cff', li: 3.5, beam: 0.2 },
  { color: '#e9fbff', size: 0.034, op: 0.5, speed: 0.07, drift: 0.03, light: '#7fe9ff', li: 1.0, beam: 0 },
  { color: '#a9ffd0', size: 0.016, op: 0.85, speed: 0.03, drift: 0.22, light: '#6dffb8', li: 1.6, beam: 0 },
  { color: '#ffb36b', size: 0.009, op: 0.85, speed: 0.5, drift: 0, light: '#ff8a3d', li: 2.2, beam: 0 },
];
function SanitizeFX() {
  const idx = useStore((s) => (s.stage === 'sanitation' ? sanitationAt(s.sanitize).index : -1));
  const l = useStore((s) => s.locker);
  const pts = useRef<THREE.Points>(null);
  const mat = useRef<THREE.PointsMaterial>(null);
  const beam = useRef<THREE.MeshBasicMaterial>(null);
  const light = useRef<THREE.PointLight>(null);
  const N = 220;
  const data = useMemo(() => {
    const a = new Float32Array(N * 3);
    for (let i = 0; i < N; i++) { a[i * 3] = (Math.random() - 0.5) * 0.28; a[i * 3 + 1] = Math.random() * 0.5; a[i * 3 + 2] = (Math.random() - 0.5) * 0.38; }
    return a;
  }, []);
  const cur = useRef({ size: 0.006, op: 0, li: 0, beam: 0, color: new THREE.Color('#b99bff'), lcolor: new THREE.Color('#8b5cff') });
  const tc = useMemo(() => new THREE.Color(), []);
  useFrame((st, d) => {
    const on = idx >= 0, p = FX[Math.max(0, idx)], c = cur.current, k = Math.min(1, d * 3);
    c.size += (p.size - c.size) * k; c.op += ((on ? p.op : 0) - c.op) * k; c.li += ((on ? p.li : 0) - c.li) * k; c.beam += ((on ? p.beam : 0) - c.beam) * k;
    c.color.lerp(tc.set(p.color), k); c.lcolor.lerp(tc.set(p.light), k);
    if (mat.current) { mat.current.size = c.size; mat.current.opacity = c.op; mat.current.color.copy(c.color); }
    if (beam.current) beam.current.opacity = c.beam;
    if (light.current) { light.current.intensity = c.li; light.current.color.copy(c.lcolor); }
    const pp = pts.current; if (!pp) return;
    const arr = pp.geometry.attributes.position.array as Float32Array, t = st.clock.elapsedTime;
    for (let i = 0; i < N; i++) {
      arr[i * 3 + 1] += d * p.speed * (0.6 + (i % 5) * 0.2);
      if (arr[i * 3 + 1] > 0.52) arr[i * 3 + 1] = 0;
      arr[i * 3] += Math.sin(t * 1.5 + i) * p.drift * d;
      arr[i * 3] = ((((arr[i * 3] + 0.14) % 0.28) + 0.28) % 0.28) - 0.14;
    }
    pp.geometry.attributes.position.needsUpdate = true;
  });
  if (l === null) return null;
  return (
    <group position={[TX, Y[l] - 0.27, 0]}>
      <points ref={pts}>
        <bufferGeometry><bufferAttribute attach="attributes-position" args={[data, 3]} /></bufferGeometry>
        <pointsMaterial ref={mat} color="#b99bff" size={0.006} transparent opacity={0} depthWrite={false} />
      </points>
      <mesh position={[0, 0.27, 0]}><boxGeometry args={[0.25, 0.52, 0.38]} /><meshBasicMaterial ref={beam} color="#8b5cff" transparent opacity={0} depthWrite={false} side={THREE.DoubleSide} /></mesh>
      <pointLight ref={light} position={[0, 0.5, 0.05]} color="#8b5cff" intensity={0} distance={1} />
    </group>
  );
}

/* ---------- camera ---------- */
function Rig() {
  const camera = useThree((s) => s.camera);
  const controls = useThree((s) => s.controls) as unknown as { target: THREE.Vector3; enabled: boolean; update: () => void } | null;
  const id = useStore(viewId);
  const intro = useStore((s) => s.intro);
  const prev = useRef('');
  useEffect(() => {
    if (!controls) return;
    camera.position.set(3.4, 2.4, 6.2); controls.target.set(0, 0.9, 0); controls.update(); sfx.whoosh();
  }, [intro, controls]);
  useEffect(() => {
    if (!controls) return;
    if (prev.current && prev.current !== id) sfx.whoosh();
    prev.current = id;
    const v = viewFor(id);
    gsap.killTweensOf([camera.position, controls.target]);
    controls.enabled = false;
    const d = id === 'showcase' ? 2.8 : T.camera;
    gsap.to(camera.position, { x: v.pos[0], y: v.pos[1], z: v.pos[2], duration: d, ease: 'power3.inOut' });
    gsap.to(controls.target, { x: v.target[0], y: v.target[1], z: v.target[2], duration: d, ease: 'power3.inOut', onUpdate: () => controls.update(), onComplete: () => { controls.enabled = v.free; } });
  }, [id, controls, intro]);
  return null;
}

export default function Scene() {
  return (
    <Canvas shadows dpr={[1, 2]} camera={{ fov: 40, position: [3.4, 2.4, 6.2], near: 0.05, far: 60 }}>
      <color attach="background" args={['#06090f']} />
      <fog attach="fog" args={['#06090f', 8, 18]} />
      <ambientLight intensity={0.35} />
      <spotLight position={[2.5, 4.5, 3.5]} angle={0.55} penumbra={1} intensity={160} castShadow shadow-mapSize={[2048, 2048]} shadow-bias={-0.0004} />
      <directionalLight position={[-3, 2, 2.5]} intensity={0.6} color="#7fe9ff" />
      <Environment resolution={256}>
        <Lightformer form="rect" intensity={2.2} position={[0, 4, 3]} scale={[9, 2, 1]} />
        <Lightformer form="rect" intensity={1.2} color="#2ee6d0" position={[-4, 1.5, 1]} rotation-y={Math.PI / 2} scale={[6, 2, 1]} />
        <Lightformer form="rect" intensity={0.8} color="#6b8cff" position={[4, 2, -2]} rotation-y={-Math.PI / 2} scale={[6, 2, 1]} />
      </Environment>
      <mesh rotation-x={-Math.PI / 2} receiveShadow>
        <planeGeometry args={[40, 40]} />
        <MeshReflectorMaterial blur={[300, 100]} resolution={512} mixBlur={1} mixStrength={35} roughness={1} depthScale={1.1} minDepthThreshold={0.4} maxDepthThreshold={1.3} color="#0b1018" metalness={0.5} mirror={0} />
      </mesh>
      <ContactShadows position={[0, 0.002, 0]} opacity={0.6} scale={4} blur={2.4} far={1.5} />
      <group>
        <Tower /><Kiosk />
        {[0, 1, 2].map((i) => <Door key={i} i={i} />)}
        <Helmet /><AccessCard /><Coins /><SanitizeFX />
      </group>
      <OrbitControls makeDefault enablePan={false} enableDamping minDistance={0.8} maxDistance={7} maxPolarAngle={Math.PI / 2 - 0.04} />
      <Rig />
    </Canvas>
  );
}