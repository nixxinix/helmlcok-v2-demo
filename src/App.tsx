import { lazy, Suspense } from 'react';
import UI from './UI';

const Scene = lazy(() => import('./Scene'));

export default function App() {
  return (
    <>
      <div className="stage">
        <Suspense fallback={<div className="loading">Loading 3D showroom…</div>}>
          <Scene />
        </Suspense>
      </div>
      <UI />
    </>
  );
}
