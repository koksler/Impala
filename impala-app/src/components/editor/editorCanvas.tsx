import { Suspense, useState } from 'react';
import { Canvas } from '@react-three/fiber';
import { OrbitControls, Environment, TransformControls, Grid } from '@react-three/drei';
import { GaussianScene } from '../3d/GaussianScene';
import { useStore } from '../../store';
import * as THREE from 'three';
import { CameraSync } from '../3d/CameraSync';
import { CameraPath } from '../3d/CameraPath';
import { CustomModel } from '../3d/CustomModel';
import { EnvironmentBaker } from '../3d/EnvironmentBaker';

export const EditorCanvas = ({ splatUrl }: { splatUrl?: string }) => {
  const { 
    showModels, showGrid, showSplat, cameraEnabled, isPlaying,
    activeTool, objPos, objRot, objScale, setObjPos, setObjRot, setObjScale,
    shadowOpacity, shadowBlur, shadowColor,
    envIntensity, envRotation, envTint, snapToGrid,
    cropBox, setCropBox, isCropping, customModelUrl,
    bakedEnvTexture
  } = useStore();
  
  const [cube, setCube] = useState<THREE.Object3D | null>(null);
  const [cropCube, setCropCube] = useState<THREE.Mesh | null>(null);

  return (
    <Canvas 
      className="w-full h-full absolute inset-0 z-10 pointer-events-auto" 
      camera={{ position: [0, 2, 5], fov: 45 }} 
      gl={{ alpha: true }}
      shadows
    >
      <ambientLight intensity={0.5} />
      <directionalLight 
        position={[5, 10, 5]} 
        intensity={envIntensity} 
        color={envTint !== '#ffffff' && envTint !== '#FFFFFF' ? envTint : undefined} 
        castShadow 
        shadow-mapSize={[1024, 1024]} 
        shadow-radius={shadowBlur * 15}
      />

      <Suspense fallback={null}>
        <GaussianScene url={splatUrl} visible={showSplat} />
        <CameraPath />

        {showModels && !isCropping && (activeTool === 'translate' || activeTool === 'rotate' || activeTool === 'scale') && cube && (
          <TransformControls 
            object={cube}
            mode={activeTool} 
            translationSnap={snapToGrid ? 1 : null}
            rotationSnap={snapToGrid ? Math.PI / 8 : null}
            scaleSnap={snapToGrid ? 0.25 : null}
            onChange={() => {
              if (cube) {
                setObjPos([cube.position.x, cube.position.y, cube.position.z]);
                setObjRot([cube.rotation.x, cube.rotation.y, cube.rotation.z]);
                setObjScale([cube.scale.x, cube.scale.y, cube.scale.z]);
              }
            }}
          />
        )}

        <group position={[0, -1.5, 0]}>
          
          {isCropping && (
            <>
              <mesh ref={setCropCube} position={cropBox.position} rotation={cropBox.rotation} scale={cropBox.scale} renderOrder={999}>
                <boxGeometry args={[1, 1, 1]} />
                <meshBasicMaterial color="#FF3B3B" wireframe transparent opacity={0.5} depthWrite={false} depthTest={false} />
              </mesh>
              {cropCube && (activeTool === 'translate' || activeTool === 'rotate' || activeTool === 'scale') && (
                <TransformControls 
                  object={cropCube}
                  mode={activeTool}
                  translationSnap={snapToGrid ? 1 : null}
                  rotationSnap={snapToGrid ? Math.PI / 8 : null}
                  scaleSnap={snapToGrid ? 0.25 : null}
                  onChange={() => {
                    if (cropCube) {
                      setCropBox({
                        position: [cropCube.position.x, cropCube.position.y, cropCube.position.z],
                        rotation: [cropCube.rotation.x, cropCube.rotation.y, cropCube.rotation.z],
                        scale: [cropCube.scale.x, cropCube.scale.y, cropCube.scale.z]
                      });
                    }
                  }}
                />
              )}
            </>
          )}

          {!cameraEnabled && showGrid && (
            <Grid infiniteGrid fadeDistance={50} sectionColor="#FF763B" cellColor="#666666" />
          )}

          {showModels && customModelUrl && (
            <group ref={setCube as any} position={objPos} rotation={objRot} scale={objScale}>
              <CustomModel url={customModelUrl} />
            </group>
          )}

          {/* Shadow Catcher */}
          <mesh rotation={[-Math.PI / 2, 0, 0]} position={[0, 0, 0]} receiveShadow>
            <planeGeometry args={[100, 100]} />
            <shadowMaterial transparent opacity={shadowOpacity} color={shadowColor} />
          </mesh>
        </group>

        {bakedEnvTexture ? (
             <Environment map={bakedEnvTexture} environmentIntensity={envIntensity} environmentRotation={[0, envRotation * (Math.PI / 180), 0]} />
        ) : (
             <Environment files="/hdri/potsdamer_platz_1k.hdr" environmentIntensity={envIntensity} environmentRotation={[0, envRotation * (Math.PI / 180), 0]} />
        )}
        <EnvironmentBaker />
      </Suspense>

      <CameraSync />
      <OrbitControls makeDefault enabled={!cameraEnabled && !isPlaying} />
    </Canvas>
  );
};