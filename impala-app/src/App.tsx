import { Suspense, useState } from 'react';
import { Canvas } from '@react-three/fiber';
import { OrbitControls, useGLTF, Environment, ContactShadows } from '@react-three/drei';
// import { Button } from './components/ui/buttons/buttons';
// import {ImportIcon} from './components/icons/index';
import { Header } from './components/header';

function PreloadedModel() {
  const { scene } = useGLTF('/model.glb');
  return <primitive object={scene} scale={1} position={[0, 0, 0]} />;
}

export default function App() {
  const [currentPage, setCurrentPage] = useState<'project' | 'home'>('project');

  return (
    <div className="w-full h-full relative bg-white">
      <Header 
        variant={currentPage} 
        projectName="teto_car_scene" 
        serverStatus="online" 
      />
      <div className="absolute top-0 left-0 w-full h-full pointer-events-none p-6 flex flex-col justify-between z-10">

      <button 
        onClick={() => setCurrentPage(prev => prev === 'project' ? 'home' : 'project')}
        className="absolute bottom-4 left-4 z-50 bg-bg-item p-2 rounded shadow pointer-events-auto"
      >
        Toggle Header Variant
      </button>

      </div>

      <Canvas camera={{ position:[3, 2, 5], fov: 45 }}>
        <color attach="background" args={['white']} />
        <Suspense fallback={null}>
          <PreloadedModel />
          <Environment preset="city" />
          <ContactShadows position={[0, -0.5, 0]} opacity={0.6} scale={10} blur={2} far={4} />
        </Suspense>
        <OrbitControls makeDefault minPolarAngle={0} maxPolarAngle={Math.PI / 2 + 0.1} />
      </Canvas>
    </div>
  );
}