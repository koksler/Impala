import { Suspense } from 'react';
import { Canvas } from '@react-three/fiber';
import { OrbitControls, Environment, TransformControls, Grid } from '@react-three/drei';
import { GaussianScene } from '../3d/GaussianScene';
import { useStore } from '../../store';
import * as THREE from 'three';
import { CameraSync } from '../3d/CameraSync';
import { CameraPath } from '../3d/CameraPath';

export const EditorCanvas = ({ splatUrl }: { splatUrl?: string }) => {
  const { showModels, showGrid, showSplat, cameraEnabled, isPlaying } = useStore();

  return (
    <Canvas 
      className="w-full h-full absolute inset-0 z-10 pointer-events-auto" 
      camera={{ position: [0, 2, 5], fov: 45 }} 
      gl={{ alpha: true }}
      shadows
    >
      <ambientLight intensity={0.5} />
      <directionalLight position={[5, 10, 5]} intensity={1} castShadow shadow-mapSize={[1024, 1024]} />

      <Suspense fallback={null}>
        <GaussianScene url={splatUrl} visible={showSplat} />
        <CameraPath />

        <group position={[0, -1.5, 0]}>
          
          {!cameraEnabled && showGrid && (
            <Grid infiniteGrid fadeDistance={50} sectionColor="#FF763B" cellColor="#666666" />
          )}

          {showModels && (
            <TransformControls mode="translate">
              <mesh position={[0, 0.5, 0]} castShadow receiveShadow>
                <boxGeometry args={[1, 1, 1]} />
                <meshStandardMaterial color="#FF763B" roughness={0.2} metalness={0.8} />
              </mesh>
            </TransformControls>
          )}

          {/* Shadow Catcher */}
          <mesh rotation={[-Math.PI / 2, 0, 0]} position={[0, 0, 0]} receiveShadow>
            <planeGeometry args={[100, 100]} />
            <shadowMaterial transparent opacity={0.4} />
          </mesh>
        </group>

        <Environment files="/hdri/potsdamer_platz_1k.hdr" />
      </Suspense>

      <CameraSync />
      <OrbitControls makeDefault enabled={!cameraEnabled && !isPlaying} />
    </Canvas>
  );
};