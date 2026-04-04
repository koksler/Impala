import { Suspense, useState, useEffect, useRef } from 'react';
import * as THREE from 'three';
import { Canvas, useThree, useFrame } from '@react-three/fiber';
import { OrbitControls, Environment, ContactShadows, TransformControls, Grid } from '@react-three/drei'; 
import { Header } from './components/header';
import { ObjectSettingsPanel } from './components/ui/menus/objectSettingsPanel';
import { SceneSettingsPanel } from './components/ui/menus/sceneSettingsPanel';
import { HomePage } from './components/ui/menus/homePage';
import { FloatingToolbar } from './components/ui/menus/floatingToolbar';
import type { Project } from './components/ui/menus/homePage';
import { useStore } from './store';

import * as GaussianSplats3D from '@mkkellogg/gaussian-splats-3d';
import { TimelinePanel } from './components/ui/menus/timelinePanel';

function GaussianScene({ url, visible }: { url?: string; visible: boolean }) {
  const groupRef = useRef<THREE.Group>(null);

  useEffect(() => {
    if (!url || !groupRef.current) return;
    groupRef.current.clear();
    const viewer = new GaussianSplats3D.DropInViewer({ dynamicScene: true, sphericalHarmonicsDegree: 2 });
    viewer.addSplatScene(url, { showLoadingUI: false });
    groupRef.current.add(viewer);
    return () => { if (groupRef.current) groupRef.current.clear(); };
  }, [url]);

  return (
    <group position={[0, 0, 0]} rotation={[Math.PI / 2, 0, 0]} ref={groupRef} visible={visible} />
  );
}

function CameraSync() {
  const { camera } = useThree();
  const { cameraData, currentFrame, isPlaying, setCurrentFrame, totalFrames } = useStore();
  const clockRef = useRef(0);

  useFrame((state, delta) => {
    if (isPlaying && totalFrames > 0) {
      clockRef.current += delta;
      if (clockRef.current > (1 / 24)) { 
        setCurrentFrame((currentFrame + 1) % totalFrames);
        clockRef.current = 0;
      }
    }
  });

  useEffect(() => {
    if (!cameraData || !cameraData[currentFrame]) return;

    const matrixValues = cameraData[currentFrame].transform_matrix.flat();
    const matrix = new THREE.Matrix4().fromArray(matrixValues).transpose();

    const convertMatrix = new THREE.Matrix4().makeScale(1, -1, -1);
    matrix.multiply(convertMatrix);

    const globalRotate = new THREE.Matrix4().makeRotationX(Math.PI / 2);
    matrix.premultiply(globalRotate);

    matrix.decompose(camera.position, camera.quaternion, new THREE.Vector3());
  }, [currentFrame, cameraData, camera]);

  return null;
}

export default function App() {
  const [currentPage, setCurrentPage] = useState<'project' | 'home'>('home');
  const[activeProject, setActiveProject] = useState<Project | null>(null);
  const[panelsMinimized, setPanelsMinimized] = useState(false);

  const { 
    serverStatus, checkServerStatus, setCameraData, 
    isPlaying, showVideo, showModels, showGrid, showSplat 
  } = useStore();

  const videoRef = useRef<HTMLVideoElement>(null);
  const currentFrame = useStore(state => state.currentFrame);
  const totalFrames = useStore(state => state.totalFrames);

  useEffect(() => { 
    checkServerStatus();
    const intervalId = setInterval(() => checkServerStatus(), 5000);
    return () => clearInterval(intervalId);
  },[checkServerStatus]);

  useEffect(() => {
    if (videoRef.current && totalFrames > 0) {
      const targetTime = currentFrame / 24;
      
      if (isPlaying) {
        if (videoRef.current.paused) videoRef.current.play();
      } else {
        videoRef.current.pause();
        videoRef.current.currentTime = targetTime;
      }
    }
  }, [currentFrame, isPlaying, totalFrames]);

  const handleOpenProject = (project: Project) => {
    setActiveProject(project);
    setCurrentPage('project');

    const trackingUrl = project.transforms_url || `http://localhost:8000/api/projects/${project.id}/tracking`;
    
    fetch(trackingUrl)
      .then(res => res.json())
      .then(data => {
        const frames = Array.isArray(data) ? data : data.frames;
        if (frames) setCameraData(frames);
      })
      .catch(err => console.error('Failed to load transforms:', err));
  };

  const handleGoHome = () => {
    setCurrentPage('home');
    setActiveProject(null);
  };

  return (
    <div className="flex flex-col w-full h-screen bg-neutral-900 overflow-hidden">

        <div className="flex-none w-full z-50">
          <Header 
            variant={currentPage} 
            projectName={activeProject?.title}
            serverStatus={serverStatus} 
            onGoHome={handleGoHome}
          />
        </div>

        {currentPage === 'home' ? (
          <div className="flex-1 min-h-0 bg-bg">
            <HomePage onOpenProject={handleOpenProject} />
          </div>
      ) : (
        
      <div className="relative flex-1 w-full bg-neutral-900 overflow-hidden">
        
        <div className={`absolute inset-0 z-0 flex items-center justify-center transition-opacity duration-300 ${showVideo ? 'opacity-100' : 'opacity-0'}`}>
           <video 
             ref={videoRef}
             src={activeProject?.video_url} 
             className="w-full h-full object-contain opacity-50"
             crossOrigin="anonymous"
             muted playsInline 
           />
        </div>

        <Canvas className="w-full h-full absolute inset-0 z-10 pointer-events-auto" camera={{ position:[0, 5, 20], fov: 45 }} gl={{ alpha: true }}>
          <Suspense fallback={null}>
            
            <GaussianScene url={activeProject?.splat_url} visible={showSplat} />
            
            {showGrid && <Grid infiniteGrid fadeDistance={50} sectionColor="#FF763B" cellColor="#666666" />}
            
            {showModels && (
              <TransformControls 
                  mode="translate" 
                  position={[0, 0, -5]} 
                  showX={showModels} showY={showModels} showZ={showModels} enabled={showModels}
              >
                  <mesh visible={showModels}>
                      <boxGeometry args={[1, 1, 1]} />
                      <meshStandardMaterial color="#FF763B" />
                  </mesh>
              </TransformControls>
            )}

            <Environment files="/hdri/potsdamer_platz_1k.hdr" />
            <ContactShadows frames={1} position={[0, -2, 0]} opacity={0.6} scale={50} blur={2} far={10} />
          </Suspense>
          
          <CameraSync />
          <OrbitControls makeDefault enabled={!useStore.getState().cameraData} />
        </Canvas>

          <div className="absolute inset-0 pointer-events-none z-40 p-4 flex justify-between items-start">
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

          <div className="absolute inset-0 pointer-events-none z-40 flex flex-col justify-end items-center mb-5 gap-2">
            <div className="pointer-events-auto">
              <FloatingToolbar />
            </div>
            <div className="pointer-events-auto">
              <TimelinePanel />
            </div>
          </div>
        </div>

      )}
    </div>
  );
}