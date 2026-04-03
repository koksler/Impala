import { Suspense, useState, useEffect, useRef } from 'react';
import * as THREE from 'three';
import { Canvas } from '@react-three/fiber';
import { OrbitControls, Environment, ContactShadows } from '@react-three/drei'; 
import { Header } from './components/header';
import { ObjectSettingsPanel } from './components/ui/menus/objectSettingsPanel';
import { SceneSettingsPanel } from './components/ui/menus/sceneSettingsPanel';
import { HomePage } from './components/ui/menus/homePage';
import type { Project } from './components/ui/menus/homePage';
import { useStore } from './store';

import * as GaussianSplats3D from '@mkkellogg/gaussian-splats-3d';

function GaussianScene({ url }: { url?: string }) {
  const groupRef = useRef<THREE.Group>(null);

  useEffect(() => {
    if (!url || !groupRef.current) return;

    groupRef.current.clear();

    const viewer = new GaussianSplats3D.DropInViewer({
        dynamicScene: true, 
        sphericalHarmonicsDegree: 2 
    });

    viewer.addSplatScene(url, {
        showLoadingUI: false, 
    });

    groupRef.current.add(viewer);

    return () => {
        if (groupRef.current) groupRef.current.clear();
    };
  }, [url]);

  return (
    <group position={[0, 0, 0]} rotation={[0, 0, 0]} scale={0.1} ref={groupRef} />
  );
}

export default function App() {
  const [currentPage, setCurrentPage] = useState<'project' | 'home'>('home');
  const [activeProject, setActiveProject] = useState<Project | null>(null);
  const[panelsMinimized, setPanelsMinimized] = useState(false);

  const serverStatus = useStore((state) => state.serverStatus);
  const checkServerStatus = useStore((state) => state.checkServerStatus);

  useEffect(() => { 
    checkServerStatus();

    const intervalId = setInterval(() => {
        checkServerStatus();
    }, 5000);

    return () => clearInterval(intervalId)
  }, [checkServerStatus]);

  const handleOpenProject = (project: Project) => {
    setActiveProject(project);
    setCurrentPage('project');
  };

  const handleGoHome = () => {
    setCurrentPage('home');
    setActiveProject(null);
  };

  return (
    <div className="flex flex-col w-full h-screen bg-bg overflow-hidden">

        <div className="flex-none w-full z-50">
        <Header 
          variant={currentPage} 
          projectName={activeProject?.title}
          serverStatus={serverStatus} 
          onGoHome={handleGoHome}
        />
        </div>

        {currentPage === 'home' ? (
          <div className="flex-1 min-h-0">
            <HomePage onOpenProject={handleOpenProject} />
          </div>
      ) : (
        
        <div className="relative flex-1 w-full">
        
        <Canvas className="w-full h-full absolute inset-0" camera={{ position: [0, 5, 20], fov: 45 }}>
          <color attach="background" args={['#d4d4d8']} />
          
          <Suspense fallback={null}>
            <GaussianScene url={activeProject?.splat_url} />
            <Environment preset="city" />
            
            <ContactShadows frames={1} position={[0, -2, 0]} opacity={0.6} scale={50} blur={2} far={10} />
          </Suspense>
          
          <OrbitControls makeDefault />
        </Canvas>

        <div className="absolute inset-0 pointer-events-none z-40 p-4 flex justify-between">
          
          <div className="pointer-events-auto h-full">
            <ObjectSettingsPanel 
                isMinimized={panelsMinimized} 
                onToggleMinimize={() => setPanelsMinimized(!panelsMinimized)} 
            />
          </div>

          <div className="pointer-events-auto h-full">
            <SceneSettingsPanel isMinimized={panelsMinimized} />
          </div>

        </div>
        </div>

      )}
    </div>
  );
}