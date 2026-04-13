import { Suspense, useState, useEffect } from 'react';
import { Canvas } from '@react-three/fiber';
import { OrbitControls, Environment, TransformControls, Grid } from '@react-three/drei';
import { GaussianScene } from '../3d/GaussianScene';
import { useStore } from '../../store';
import * as THREE from 'three';
import { CameraSync } from '../3d/CameraSync';
import { CameraPath } from '../3d/CameraPath';
import { CustomModel } from '../3d/CustomModel';
import { ProxyMesh } from '../3d/ProxyMesh';
import { EnvironmentBaker } from '../3d/EnvironmentBaker';
import { useMemo } from 'react';

export const EditorCanvas = ({ splatUrl, proxyUrl }: { splatUrl?: string, proxyUrl?: string }) => {
  const { 
    showModels, showGrid, showSplat, showCameraPath, cameraEnabled, isPlaying,
    activeTool, objPos, objRot, objScale, setObjPos, setObjRot, setObjScale,
    transformTarget, scenePos, sceneRot, sceneScale, setScenePos, setSceneRot, setSceneScale,
    shadowOpacity, shadowBlur, shadowColor,
    envIntensity, envRotation, envTint, snapToGrid,
    cropBox, setCropBox, isCropping, customModelUrl,
    bakedEnvTexture, isExporting,
    // Add export pipeline dependencies
    currentFrame, totalFrames, setPlaying, updateToast, preExportState
  } = useStore();
  
  const [cube, setCube] = useState<THREE.Object3D | null>(null);
  const [sceneGroupWrapper, setSceneGroupWrapper] = useState<THREE.Group | null>(null);
  const [localModelLowestY, setLocalModelLowestY] = useState<number>(0);
  const [cropCube, setCropCube] = useState<THREE.Mesh | null>(null);
  const lightTarget = useMemo(() => new THREE.Object3D(), []);
  const videoElement = useStore(state => state.videoElement);

  const videoEnvTexture = useMemo(() => {
    if (!videoElement) return null;
    const tex = new THREE.VideoTexture(videoElement);
    tex.mapping = THREE.EquirectangularReflectionMapping;
    tex.colorSpace = THREE.SRGBColorSpace;
    return tex;
  }, [videoElement]);

  return (
    <Canvas 
      className="w-full h-full absolute inset-0 z-10 pointer-events-auto" 
      camera={{ position: [0, 2, 5], fov: 45 }} 
      gl={{ alpha: true, preserveDrawingBuffer: true }}
      shadows={{ type: THREE.PCFSoftShadowMap }}
      onCreated={({ scene }) => {
        scene.add(lightTarget);
      }}
    >
      <primitive object={lightTarget} position={objPos} />
      <ambientLight intensity={0.5} />
      <directionalLight 
        position={[objPos[0] + 5, objPos[1] + 10, objPos[2] + 5]} 
        target={lightTarget}
        intensity={envIntensity} 
        color={envTint !== '#ffffff' && envTint !== '#FFFFFF' ? envTint : undefined} 
        castShadow 
        shadow-mapSize={[2048, 2048]} 
        shadow-camera-left={-2}
        shadow-camera-right={2}
        shadow-camera-top={2}
        shadow-camera-bottom={-2}
        shadow-camera-near={0.5}
        shadow-camera-far={50}
        shadow-bias={-0.001}
        shadow-normalBias={0.02}
        shadow-radius={shadowBlur * 15}
      />

      <Suspense fallback={null}>
        <group ref={(node) => setSceneGroupWrapper(node)} position={scenePos} rotation={sceneRot} scale={sceneScale}>
          <GaussianScene url={splatUrl} visible={showSplat} />
          {/* Real-world geometry proxy handling shadows and occlusion mask! */}
          <ProxyMesh url={proxyUrl} isExporting={isExporting} />
          {showCameraPath && <CameraPath />}
        </group>

        {!isExporting && transformTarget === 'scene' && !isCropping && (activeTool === 'translate' || activeTool === 'rotate' || activeTool === 'scale') && sceneGroupWrapper && (
          <TransformControls 
            object={sceneGroupWrapper}
            mode={activeTool} 
            translationSnap={snapToGrid ? 1 : null}
            rotationSnap={snapToGrid ? Math.PI / 8 : null}
            scaleSnap={snapToGrid ? 0.25 : null}
            onChange={() => {
              if (sceneGroupWrapper) {
                setScenePos([sceneGroupWrapper.position.x, sceneGroupWrapper.position.y, sceneGroupWrapper.position.z]);
                setSceneRot([sceneGroupWrapper.rotation.x, sceneGroupWrapper.rotation.y, sceneGroupWrapper.rotation.z]);
                setSceneScale([sceneGroupWrapper.scale.x, sceneGroupWrapper.scale.y, sceneGroupWrapper.scale.z]);
              }
            }}
          />
        )}

        {!isExporting && transformTarget === 'object' && showModels && !isCropping && (activeTool === 'translate' || activeTool === 'rotate' || activeTool === 'scale') && cube && (
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
          
          {!isExporting && isCropping && (
            <>
              <mesh ref={(node) => setCropCube(node)} position={cropBox.position} rotation={cropBox.rotation} scale={cropBox.scale} renderOrder={999}>
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

          {!isExporting && !cameraEnabled && showGrid && (
            <Grid infiniteGrid fadeDistance={50} sectionColor="#FF763B" cellColor="#666666" />
          )}

          {showModels && customModelUrl && (
            <group name="custom-model-group" ref={(node) => setCube(node)} position={objPos} rotation={objRot} scale={objScale}>
              <Suspense fallback={null}>
                <CustomModel url={customModelUrl} onLowestPoint={setLocalModelLowestY} />
              </Suspense>
            </group>
          )}

          {/* Improved Shadow Catcher: Now a circle with explicit renderOrder for better occlusion by proxies */}
          <mesh 
            renderOrder={0} // Render at the same level as models
            rotation={[-Math.PI / 2, 0, 0]} 
            position={[objPos[0], objPos[1] + (localModelLowestY * objScale[1]) + 0.001, objPos[2]]} 
            receiveShadow
          >
              <circleGeometry args={[15, 64]} />
              <shadowMaterial transparent opacity={shadowOpacity} color={shadowColor} />
            </mesh>
        </group>

        {bakedEnvTexture ? (
             <Environment map={bakedEnvTexture} environmentIntensity={envIntensity} environmentRotation={[0, envRotation * (Math.PI / 180), 0]} />
        ) : videoEnvTexture ? (
             <Environment map={videoEnvTexture} environmentIntensity={envIntensity} environmentRotation={[0, envRotation * (Math.PI / 180), 0]} />
        ) : (
             <Environment files="/hdri/potsdamer_platz_1k.hdr" environmentIntensity={envIntensity} environmentRotation={[0, envRotation * (Math.PI / 180), 0]} />
        )}
        <EnvironmentBaker />
      </Suspense>

      <CameraSync />
      <OrbitControls makeDefault={!cameraEnabled && !isPlaying} enabled={!cameraEnabled && !isPlaying} />
    </Canvas>
  );
};