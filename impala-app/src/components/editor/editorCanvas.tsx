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
    envIntensity, envRotation, envTint, lightElevation, snapToGrid,
    cropBox, setCropBox, isCropping, customModelUrl,
    bakedEnvTexture, isExporting,
    // Add export pipeline dependencies
    currentFrame, totalFrames, setPlaying, updateToast, preExportState,
    pushToHistory, objBounds
  } = useStore();
  
  const [cube, setCube] = useState<THREE.Object3D | null>(null);
  const [sceneGroupWrapper, setSceneGroupWrapper] = useState<THREE.Group | null>(null);
  const [cropCube, setCropCube] = useState<THREE.Mesh | null>(null);
  const lightTarget = useMemo(() => new THREE.Object3D(), []);
  const videoElement = useStore(state => state.videoElement);
  const setThreeContext = useStore(state => state.setThreeContext);  

  // Spherical coordinate light position: azimuth (envRotation) + elevation (lightElevation)
  const lightPos = useMemo(() => {
    const theta = envRotation * (Math.PI / 180); // azimuth around Y
    const phi   = lightElevation * (Math.PI / 180); // elevation from horizon
    return [
      Math.sin(theta) * Math.cos(phi) * 10,
      Math.max(0.5, Math.sin(phi) * 10), // never go below scene floor
      Math.cos(theta) * Math.cos(phi) * 10,
    ] as [number, number, number];
  }, [envRotation, lightElevation]);

  // Dynamic shadow frustum half-extent — covers the model regardless of scale
  const shadowHalf = Math.max(12, Math.max(objBounds[0], objBounds[2]) * 2);
  const shadowFar  = Math.max(30, objBounds[1] * 4);

  const videoEnvTexture = useMemo(() => {
    if (!videoElement) return null;
    const tex = new THREE.VideoTexture(videoElement);
    tex.mapping = THREE.EquirectangularReflectionMapping;
    tex.colorSpace = THREE.SRGBColorSpace;
    return tex;
  }, [videoElement]);

  return (
    <div className="main-canvas-wrapper w-full h-full">
      <Canvas 
        className="w-full h-full absolute inset-0 z-10 pointer-events-auto" 
        camera={{ position: [0, 2, 5], fov: 45 }} 
        gl={{ alpha: true, preserveDrawingBuffer: true }}
        shadows={{ type: THREE.PCFSoftShadowMap }}
        onCreated={({ scene, gl, camera }) => {
          scene.add(lightTarget);
          // ADD THIS:
          setThreeContext(gl, scene, camera);
        }}
      >
      <primitive object={lightTarget} position={objPos} />
      
      {/* Hemispherelight gives realistic sky/ground fill — breaks up flat lighting */}
      <hemisphereLight skyColor={envTint !== '#ffffff' && envTint !== '#FFFFFF' ? envTint : '#b0ceff'} groundColor="#404040" intensity={envIntensity * 0.35} />
      {/* Reduced ambient — hemisphere handles soft fill */}
      <ambientLight intensity={envIntensity * 0.15} />
      
      <directionalLight 
        position={lightPos} 
        target={lightTarget}
        intensity={envIntensity} 
        color={envTint !== '#ffffff' && envTint !== '#FFFFFF' ? envTint : undefined} 
        castShadow 
        shadow-mapSize={[4096, 4096]} 
        shadow-camera-left={-shadowHalf}
        shadow-camera-right={shadowHalf}
        shadow-camera-top={shadowHalf}
        shadow-camera-bottom={-shadowHalf}
        shadow-camera-near={0.1}
        shadow-camera-far={shadowFar}
        shadow-bias={-0.0005}
        shadow-normalBias={0.02}
        shadow-radius={shadowBlur * 6}
      />

      <Suspense fallback={null}>
        <group ref={(node) => setSceneGroupWrapper(node)} position={scenePos} rotation={sceneRot} scale={sceneScale}>
          <GaussianScene url={splatUrl} visible={showSplat} />
          {/* Real-world geometry proxy handling shadows and occlusion mask! */}
          <ProxyMesh url={proxyUrl} isExporting={isExporting} />
          {showCameraPath && !isExporting && !cameraEnabled && <CameraPath />}
        </group>

        {!isExporting && transformTarget === 'scene' && !isCropping && (activeTool === 'translate' || activeTool === 'rotate' || activeTool === 'scale') && sceneGroupWrapper && (
          <TransformControls 
            object={sceneGroupWrapper}
            mode={activeTool} 
            translationSnap={snapToGrid ? 1 : null}
            rotationSnap={snapToGrid ? Math.PI / 8 : null}
            scaleSnap={snapToGrid ? 0.25 : null}
            onMouseUp={pushToHistory}
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
            onMouseUp={pushToHistory}
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
            <group name="editor-grid">
              <Grid infiniteGrid fadeDistance={50} sectionColor="#FF763B" cellColor="#666666" />
            </group>
          )}

          {showModels && customModelUrl && (
            <group name="custom-model-group" ref={(node) => setCube(node)} position={objPos} rotation={objRot} scale={objScale}>
              <Suspense fallback={null}>
                <CustomModel url={customModelUrl} />
              </Suspense>
            </group>
          )}

          {/* Shadow-catcher plane — decoupled from objRot so it always faces world-up.
              renderOrder=9999 ensures it paints over the Gaussian splat renderer.
              depthTest=false + depthWrite=false + polygonOffset prevent Z-fighting with the splat depth buffer. */}
          <group position={objPos}>
            <mesh 
                name="shadow-catcher"
                renderOrder={9999}
                rotation={[-Math.PI / 2, 0, 0]} 
                position={[0, -objBounds[1] / 2 + 0.001, 0]} 
                receiveShadow
            >
                <circleGeometry args={[15, 64]} />
                <shadowMaterial 
                    transparent 
                    opacity={shadowOpacity} 
                    color={shadowColor} 
                    depthTest={false}
                    depthWrite={false}
                    polygonOffset
                    polygonOffsetFactor={-1}
                    polygonOffsetUnits={-1}
                />
            </mesh>
          </group>
        </group>

        {bakedEnvTexture ? (
             <Environment map={bakedEnvTexture} background={false} environmentIntensity={envIntensity} environmentRotation={[0, envRotation * (Math.PI / 180), 0]} />
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
    </div>
  );
};