import { Suspense, useState } from 'react';
import { Canvas } from '@react-three/fiber';
import { OrbitControls, useGLTF, Environment, ContactShadows } from '@react-three/drei';
import { Header } from './components/header';
import { ObjectSettingsPanel } from './components/ui/menus/objectSettingsPanel'
import { SceneSettingsPanel } from './components/ui/menus/sceneSettingsPanel';
import { HomePage } from './components/ui/menus/homePage';
import type { Project } from './components/ui/menus/homePage';

function PreloadedModel() {
  const { scene } = useGLTF('/model.glb');
  return <primitive object={scene} scale={1} position={[0, 0, 0]} />;
}

export default function App() {
  const [currentPage, setCurrentPage] = useState<'project' | 'home'>('home');
  const [activeProject, setActiveProject] = useState<Project | null>(null);
  const [panelsMinimized, setPanelsMinimized] = useState(false); // Change it to useStore later, sometime. :D

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
          serverStatus="online"
          onGoHome={handleGoHome}
        />
        </div>

        {currentPage === 'home' ? (
          <div className="flex-1 min-h-0">
            <HomePage onOpenProject={handleOpenProject} />
          </div>
      ) : (
        
        <div className="relative flex-1 w-full">
        
        <Canvas className="w-full h-full absolute inset-0" camera={{ position:[3, 2, 5], fov: 45 }}>
          <color attach="background" args={['white']} />
          <Suspense fallback={null}>
            <PreloadedModel />
            <Environment preset="city" />
            <ContactShadows position={[0, -0.5, 0]} opacity={0.6} scale={10} blur={2} far={4} />
          </Suspense>
          <OrbitControls makeDefault minPolarAngle={0} maxPolarAngle={Math.PI / 2 + 0.1} />
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