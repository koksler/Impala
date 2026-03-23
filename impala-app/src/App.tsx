import { Suspense } from 'react';
import { Canvas } from '@react-three/fiber';
import { OrbitControls, useGLTF, Environment, ContactShadows } from '@react-three/drei';
import { Button } from './components/ui/buttons/buttons'
import {ImportIcon} from './components/icons/index'

function PreloadedModel() {
  const { scene } = useGLTF('/model.glb');
  return <primitive object={scene} scale={1} position={[0, 0, 0]} />;
}

export default function App() {
  return (
    <div className="w-full h-full relative bg-white">
      
      <div className="absolute top-0 left-0 w-full h-full pointer-events-none p-6 flex flex-col justify-between z-10">

        <Button variant = 'full' onClick={() => alert("That's a test button, duh")} className="pointer-events-auto"> 
          I'm a Button 
        </Button>
        
        <Button variant='icon' className="pointer-events-auto"> 
          <ImportIcon className='w-6 h-6'/>  </Button>

        <Button variant='toggle' className="pointer-events-auto"> 
          <ImportIcon className='w-6 h-6 text-item-border'/> </Button>

        <Button variant='misc' className="pointer-events-auto"> 
          <ImportIcon className='w-6 h-6'/> </Button>

        <Button variant='accent' className="pointer-events-auto"> 
          Gex Manager </Button>

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