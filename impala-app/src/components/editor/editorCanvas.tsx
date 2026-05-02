import { Suspense, useState, useMemo } from 'react';
import { Canvas } from '@react-three/fiber';
import { OrbitControls, Environment, TransformControls, Grid, AdaptiveDpr } from '@react-three/drei';
import { GaussianScene } from '../3d/GaussianScene';
import { useStore } from '../../store';
import * as THREE from 'three';
import { CameraSync } from '../3d/CameraSync';
import { CameraPath } from '../3d/CameraPath';
import { CustomModel } from '../3d/CustomModel';
import { ProxyMesh } from '../3d/ProxyMesh';
import { EnvironmentBaker } from '../3d/EnvironmentBaker';
import { VideoLightSampler } from '../3d/VideoLightSampler';
import { DynamicShadowBox } from './DynamicShadowBox';

export const EditorCanvas = ({ splatUrl, proxyUrl }: { splatUrl?: string, proxyUrl?: string }) => {
  const {
    showModels, showGrid, showSplat, showCameraPath, cameraEnabled, isPlaying,
    activeTool, objPos, objRot, objScale, setObjPos, setObjRot, setObjScale,
    transformTarget, scenePos, sceneRot, sceneScale, setScenePos, setSceneRot, setSceneScale,
    shadowOpacity, shadowBlur, shadowColor, shadowResolution,
    envIntensity, envRotation, envTint, lightElevation, snapToGrid,
    cropBox, setCropBox, isCropping, customModels, activeModelId, setActiveModelId,
    bakedEnvTexture, isExporting,
    pushToHistory, objBounds, setThreeContext
  } = useStore();

  const [cube, setCube] = useState<THREE.Object3D | null>(null);
  const [sceneGroupWrapper, setSceneGroupWrapper] = useState<THREE.Group | null>(null);
  const [cropCube, setCropCube] = useState<THREE.Mesh | null>(null);

  const lightTarget = useMemo(() => new THREE.Object3D(), []);

  // Spherical coordinate light position: azimuth (envRotation) + elevation (lightElevation)
  const lightPos = useMemo(() => {
    const theta = envRotation * (Math.PI / 180);
    const phi = lightElevation * (Math.PI / 180);
    return [
      Math.sin(theta) * Math.cos(phi) * 10,
      Math.max(0.5, Math.sin(phi) * 10),
      Math.cos(theta) * Math.cos(phi) * 10,
    ] as [number, number, number];
  }, [envRotation, lightElevation]);

  // Dynamic shadow frustum half-extent — covers the model regardless of scale
  const shadowHalf = Math.max(12, Math.max(objBounds[0], objBounds[2]) * 2);
  const shadowFar = Math.max(30, objBounds[1] * 4);
  const shadowMapSize = shadowResolution ?? 512;

  return (
    <div className="main-canvas-wrapper w-full h-full relative">
      <Canvas
        className="w-full h-full absolute inset-0 z-10 pointer-events-auto"
        camera={{ position: [0, 2, 5], fov: 45 }}
        gl={{ alpha: true, preserveDrawingBuffer: true, antialias: true, stencil: true }}
        shadows={{ type: THREE.PCFSoftShadowMap }}
        dpr={[1, 2]}
        onCreated={({ scene, gl, camera }) => {
          scene.add(lightTarget);
          setThreeContext(gl, scene, camera as any);
        }}
      >
        <AdaptiveDpr pixelated={false} />

        <primitive object={lightTarget} position={objPos} />

        <hemisphereLight color={envTint !== '#ffffff' && envTint !== '#FFFFFF' ? envTint : '#b0ceff'} groundColor="#404040" intensity={envIntensity * 0.35} />
        <ambientLight intensity={envIntensity * 0.15} />

        <directionalLight
          position={[objPos[0] + lightPos[0], objPos[1] + lightPos[1], objPos[2] + lightPos[2]]}
          target={lightTarget}
          intensity={envIntensity}
          color={envTint !== '#ffffff' && envTint !== '#FFFFFF' ? envTint : undefined}
          castShadow
          shadow-mapSize={[shadowMapSize, shadowMapSize]}
          shadow-camera-left={-shadowHalf}
          shadow-camera-right={shadowHalf}
          shadow-camera-top={shadowHalf}
          shadow-camera-bottom={-shadowHalf}
          shadow-camera-near={0.1}
          shadow-camera-far={shadowFar}
          shadow-bias={-0.0001}
          shadow-normalBias={0.005}
          shadow-radius={Math.max(1, shadowBlur * 2)}
        />

        <Suspense fallback={null}>
          <group ref={(node) => setSceneGroupWrapper(node)} position={scenePos} rotation={sceneRot} scale={sceneScale}>
            <GaussianScene url={splatUrl} visible={showSplat} />
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

          {!isExporting && transformTarget === 'object' && showModels && !isCropping && (activeTool === 'translate' || activeTool === 'rotate' || activeTool === 'scale') && cube && cube.userData.modelId === activeModelId && (
            <TransformControls
              key={activeModelId || 'none'}
              object={cube}
              mode={activeTool}
              translationSnap={snapToGrid ? 1 : null}
              rotationSnap={snapToGrid ? Math.PI / 8 : null}
              scaleSnap={snapToGrid ? 0.25 : null}
              onMouseUp={pushToHistory}
              onChange={() => {
                if (cube) {
                  const id = cube.userData?.modelId;
                  if (id) {
                    useStore.getState().updateCustomModel(id, {
                      pos: [cube.position.x, cube.position.y, cube.position.z],
                      rot: [cube.rotation.x, cube.rotation.y, cube.rotation.z],
                      scale: [cube.scale.x, cube.scale.y, cube.scale.z]
                    });
                  } else {
                    setObjPos([cube.position.x, cube.position.y, cube.position.z]);
                    setObjRot([cube.rotation.x, cube.rotation.y, cube.rotation.z]);
                    setObjScale([cube.scale.x, cube.scale.y, cube.scale.z]);
                  }
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
          </group>

          {showModels && (
            <group name="custom-models-container">
              {customModels.map(model => (
                <group
                  key={model.id}
                  name={`custom-model-${model.id}`}
                  ref={(node) => {
                    if (node) node.userData.modelId = model.id;
                    if (activeModelId === model.id) setCube(node);
                  }}
                  position={activeModelId === model.id ? objPos : model.pos}
                  rotation={activeModelId === model.id ? objRot : model.rot}
                  scale={activeModelId === model.id ? objScale : model.scale}
                >
                  <group renderOrder={10} onPointerDown={(e) => { e.stopPropagation(); setActiveModelId(model.id); }}>
                    <Suspense fallback={null}>
                      <CustomModel url={model.url} />
                    </Suspense>
                  </group>
                </group>
              ))}
            </group>
          )}

          {showModels && customModels.map(model => (
            <DynamicShadowBox key={`shadow-${model.id}`} modelId={model.id} />
          ))}

          <VideoLightSampler />

          {bakedEnvTexture ? (
            <Environment map={bakedEnvTexture} background={false} environmentIntensity={envIntensity} environmentRotation={[0, envRotation * (Math.PI / 180), 0]} />
          ) : (
            <Environment files="/hdri/potsdamer_platz_1k.hdr" environmentIntensity={envIntensity * 0.5} environmentRotation={[0, envRotation * (Math.PI / 180), 0]} />
          )}
          <EnvironmentBaker />
        </Suspense>

        <CameraSync />
        <OrbitControls
          makeDefault={!cameraEnabled && !isPlaying}
          enabled={!cameraEnabled && !isPlaying}
        />
      </Canvas>
    </div>
  );
};