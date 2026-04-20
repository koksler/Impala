import { Suspense, useState, useEffect, useRef, useCallback, useMemo } from 'react';
import { Canvas, useFrame } from '@react-three/fiber';
import { OrbitControls, Environment, TransformControls, Grid, PerformanceMonitor, AdaptiveDpr } from '@react-three/drei';
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
    activeTool, brushSize, objPos, objRot, objScale, setObjPos, setObjRot, setObjScale,
    transformTarget, scenePos, sceneRot, sceneScale, setScenePos, setSceneRot, setSceneScale,
    shadowOpacity, shadowBlur, shadowColor,
    envIntensity, envRotation, envTint, lightElevation, snapToGrid,
    cropBox, setCropBox, isCropping, customModelUrl,
    bakedEnvTexture, isExporting,
    currentFrame, totalFrames, setPlaying, updateToast, preExportState,
    pushToHistory, objBounds, splatViewer, threeContext, setThreeContext, setCameraEnabled
  } = useStore();

  const [cube, setCube] = useState<THREE.Object3D | null>(null);
  const [sceneGroupWrapper, setSceneGroupWrapper] = useState<THREE.Group | null>(null);
  const [cropCube, setCropCube] = useState<THREE.Mesh | null>(null);

  const lightTarget = useMemo(() => new THREE.Object3D(), []);

  // Selection state
  const [drawPoints, setDrawPoints] = useState<THREE.Vector2[]>([]);
  const isDrawing = useRef(false);

  const handlePointerDown = useCallback((e: React.PointerEvent<SVGSVGElement>) => {
    if (activeTool === 'lasso' || activeTool === 'brush' || activeTool === 'eraser') {
      isDrawing.current = true;
      const rect = e.currentTarget.getBoundingClientRect();
      setDrawPoints([new THREE.Vector2(e.clientX - rect.left, e.clientY - rect.top)]);
      setCameraEnabled(true);
    }
  }, [activeTool, setCameraEnabled]);

  const handlePointerMove = useCallback((e: React.PointerEvent<SVGSVGElement>) => {
    if (!isDrawing.current) return;
    if (activeTool === 'lasso' || activeTool === 'brush' || activeTool === 'eraser') {
      const rect = e.currentTarget.getBoundingClientRect();
      setDrawPoints(prev => [...prev, new THREE.Vector2(e.clientX - rect.left, e.clientY - rect.top)]);
    }
  }, [activeTool]);

  const handlePointerUp = useCallback((e: React.PointerEvent<SVGSVGElement>) => {
    if (!isDrawing.current) return;
    isDrawing.current = false;

    const store = useStore.getState();
    const splatViewer = store.splatViewer;
    const camera = store.threeContext?.camera;

    if (splatViewer && splatViewer.splatMesh && camera) {
      // Legacy
    }

    setDrawPoints([]);
    // Restore camera state
    setCameraEnabled(false);
  }, [activeTool, setCameraEnabled]);

  // Spherical coordinate light position: azimuth (envRotation) + elevation (lightElevation)
  const lightPos = useMemo(() => {
    const theta = envRotation * (Math.PI / 180); // azimuth around Y
    const phi = lightElevation * (Math.PI / 180); // elevation from horizon
    return [
      Math.sin(theta) * Math.cos(phi) * 10,
      Math.max(0.5, Math.sin(phi) * 10), // never go below scene floor
      Math.cos(theta) * Math.cos(phi) * 10,
    ] as [number, number, number];
  }, [envRotation, lightElevation]);

  // Dynamic shadow frustum half-extent — covers the model regardless of scale
  const shadowHalf = Math.max(12, Math.max(objBounds[0], objBounds[2]) * 2);
  const shadowFar = Math.max(30, objBounds[1] * 4);

  return (
    <div className="main-canvas-wrapper w-full h-full relative">
      {/* Visual Overlay for Spatial Tools */}
      {(activeTool === 'lasso' || activeTool === 'brush' || activeTool === 'eraser') && (
        <svg
          className="absolute inset-0 z-50 pointer-events-auto"
          onPointerDown={handlePointerDown}
          onPointerMove={handlePointerMove}
          onPointerUp={handlePointerUp}
          style={{ touchAction: 'none' }} // Prevent browser scrolling
        >
          {drawPoints.length > 1 && (
            <polyline
              points={drawPoints.map(p => `${p.x},${p.y}`).join(' ')}
              fill={activeTool === 'lasso' ? "rgba(255, 118, 59, 0.2)" : "none"}
              stroke="#FF763B"
              strokeWidth={activeTool === 'brush' || activeTool === 'eraser' ? brushSize : 2}
              strokeDasharray={activeTool === 'lasso' ? "5,5" : "none"}
              strokeLinecap="round"
              strokeLinejoin="round"
            />
          )}
        </svg>
      )}

      <Canvas
        className="w-full h-full absolute inset-0 z-10 pointer-events-auto"
        camera={{ position: [0, 2, 5], fov: 45 }}
        gl={{ alpha: true, preserveDrawingBuffer: true, antialias: true, stencil: true }}
        shadows={{ type: THREE.PCFShadowMap }}
        dpr={[1, 2]}
        onCreated={({ scene, gl, camera }) => {
          scene.add(lightTarget);
          setThreeContext(gl, scene, camera as any);
        }}
      >
        <PerformanceMonitor onDecline={() => {}} onIncline={() => {}}>
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
            shadow-mapSize={[4096, 4096]}
            shadow-camera-left={-shadowHalf}
            shadow-camera-right={shadowHalf}
            shadow-camera-top={shadowHalf}
            shadow-camera-bottom={-shadowHalf}
            shadow-camera-near={0.1}
            shadow-camera-far={shadowFar}

            shadow-bias={-0.0001}
            shadow-normalBias={0.005}

            shadow-radius={Math.min(4, shadowBlur * 2)}
          />

          <Suspense fallback={null}>
            <group ref={(node) => setSceneGroupWrapper(node)} position={scenePos} rotation={sceneRot} scale={sceneScale}>
              <GaussianScene url={splatUrl} visible={showSplat} />
              <ProxyMesh url={proxyUrl} isExporting={isExporting} />
              {showCameraPath && !isExporting && !cameraEnabled && <CameraPath />}
            </group>

            {showModels && <DynamicShadowBox cube={cube} />}

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

            </group>

            {showModels && customModelUrl && (
              <group name="custom-model-group" ref={(node) => setCube(node)} position={objPos} rotation={objRot} scale={objScale}>
                <group renderOrder={10}>
                  <Suspense fallback={null}>
                    <CustomModel url={customModelUrl} />
                  </Suspense>
                </group>
              </group>
            )}

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
            onChange={() => {
              const context = useStore.getState().threeContext;
              if (context && (context.gl as any).performance) {
                (context.gl as any).performance.regress();
              }
            }}
          />
        </PerformanceMonitor>
      </Canvas>
    </div>
  );
};