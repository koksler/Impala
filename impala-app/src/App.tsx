import { Suspense, useState } from 'react';
import { Canvas } from '@react-three/fiber';
import { OrbitControls, useGLTF, Environment, ContactShadows } from '@react-three/drei';
import { Header } from './components/header';
import { ObjectSettingsPanel } from './components/ui/menus/objectSettingsPanel'
import { SceneSettingsPanel } from './components/ui/menus/sceneSettingsPanel';
import { FloatingToolbar } from './components/ui/menus/floatingToolbar';
import { TimelinePanel } from './components/ui/menus/timelinePanel';

function PreloadedModel() {
  const { scene } = useGLTF('/model.glb');
  return <primitive object={scene} scale={1} position={[0, 0, 0]} />;
}

export default function App() {
  const [currentPage, setCurrentPage] = useState<'project' | 'home'>('project');
  const [panelsMinimized, setPanelsMinimized] = useState(false); // Change it to useStore later, sometime. :D

  return (
    <div className="w-screen h-screen overflow-hidden flex flex-col bg-white">

        <div className="flex-none w-full z-50">
        <Header 
          variant={currentPage} 
          projectName="teto_car_scene" 
          serverStatus="online" 
        />
        </div>
        
        <div className="relative flex-1 w-full">
        
        {/* UI Overlay Layer */}
        <div className="absolute inset-0 pointer-events-none z-40 p-4 flex justify-between">
          
          {/* Position the panel top-left with auto-pointer events */}
          <div className="pointer-events-auto h-full">
            <ObjectSettingsPanel 
                isMinimized={panelsMinimized} 
                onToggleMinimize={() => setPanelsMinimized(!panelsMinimized)} 
            />
          </div>

          <div className="pointer-events-auto h-full">
            <SceneSettingsPanel isMinimized={panelsMinimized} />
          </div>

          <div className="absolute bottom-4 left-1/2 -translate-x-1/2">
            <FloatingToolbar/>
            <TimelinePanel/>
          </div>

          <button 
            onClick={() => setCurrentPage(prev => prev === 'project' ? 'home' : 'project')}
            className="absolute bottom-4 right-4 z-50 bg-bg-item p-2 rounded shadow pointer-events-auto font-sans text-[12px]"
          >
            Toggle Header Variant
          </button>
        </div>

        <Canvas className="w-full h-full absolute inset-0" camera={{ position:[3, 2, 5], fov: 45 }}>
          <color attach="background" args={['white']} />
          <Suspense fallback={null}>
            <PreloadedModel />
            <Environment preset="city" />
            <ContactShadows position={[0, -0.5, 0]} opacity={0.6} scale={10} blur={2} far={4} />
          </Suspense>
          <OrbitControls makeDefault minPolarAngle={0} maxPolarAngle={Math.PI / 2 + 0.1} />
        </Canvas>
      </div>
    </div>
  );
}