import { useEffect, useRef } from 'react';
import * as THREE from 'three';
import { useThree, useFrame } from '@react-three/fiber';
import { useStore } from '../../store';

const WORLD_ROTATION = new THREE.Matrix4().makeRotationX(-Math.PI / 2);

export const CameraSync = () => {
  const { camera } = useThree();
  const {
    cameraData, cameraEnabled,
    cameraFov, videoDimensions,
    scenePos, sceneRot, sceneScale
  } = useStore();

  // 1. Pre-allocate EVERYTHING to avoid Garbage Collection stutters
  const matA = useRef(new THREE.Matrix4());
  const matB = useRef(new THREE.Matrix4());
  
  const posA = useRef(new THREE.Vector3());
  const quatA = useRef(new THREE.Quaternion());
  const scaleA = useRef(new THREE.Vector3());
  
  const posB = useRef(new THREE.Vector3());
  const quatB = useRef(new THREE.Quaternion());
  const scaleB = useRef(new THREE.Vector3());
  
  const interpPos = useRef(new THREE.Vector3());
  const interpQuat = useRef(new THREE.Quaternion());
  const interpScale = useRef(new THREE.Vector3());
  const finalMat = useRef(new THREE.Matrix4());
  const worldMatrixPool = useRef(new THREE.Matrix4());

  // Scene transform pooling
  const sPos = useRef(new THREE.Vector3());
  const sQuat = useRef(new THREE.Quaternion());
  const sEuler = useRef(new THREE.Euler());
  const sScale = useRef(new THREE.Vector3());
  const sceneTransform = useRef(new THREE.Matrix4());

  // Handle Projection (FOV / Aspect)
  useEffect(() => {
    if (!cameraEnabled) {
      camera.matrixAutoUpdate = true;
      return;
    }

    const perspCam = camera as THREE.PerspectiveCamera;
    perspCam.fov = cameraFov;
    if (videoDimensions) {
      perspCam.aspect = videoDimensions.width / videoDimensions.height;
    }
    perspCam.updateProjectionMatrix();

    const handleResize = () => {
      perspCam.fov = cameraFov;
      if (videoDimensions) {
        perspCam.aspect = videoDimensions.width / videoDimensions.height;
      }
      perspCam.updateProjectionMatrix();
    };

    window.addEventListener('resize', handleResize);
    return () => window.removeEventListener('resize', handleResize);
  }, [camera, cameraEnabled, cameraFov, videoDimensions]);

  // Handle Animation / Hot Sync (Pose)
  useFrame(() => {
    const { cameraData, currentFrameFractional, totalFrames } = useStore.getState();
    if (!cameraEnabled || !cameraData || totalFrames === 0) return;

    // 2. Calculate Sub-Frame Indices
    const indexA = Math.floor(currentFrameFractional);
    // Clamp indexB so we don't crash at the end of the video
    const indexB = Math.min(indexA + 1, totalFrames - 1); 
    const alpha = currentFrameFractional - indexA; // The fractional remainder (0.0 to 0.999)

    // 3. Extract Raw Matrices
    const rawA = cameraData[indexA]?.transform || cameraData[indexA]?.transform_matrix || cameraData[indexA]?.camera_to_world;
    const rawB = cameraData[indexB]?.transform || cameraData[indexB]?.transform_matrix || cameraData[indexB]?.camera_to_world;
    
    if (!rawA || !rawB) return;

    const fA = Array.isArray(rawA[0]) ? rawA.flat() : rawA;
    const fB = Array.isArray(rawB[0]) ? rawB.flat() : rawB;

    if (fA.length < 12 || fB.length < 12) return;

    matA.current.set(
        fA[0], fA[1], fA[2], fA[3],
        fA[4], fA[5], fA[6], fA[7],
        fA[8], fA[9], fA[10], fA[11],
        0, 0, 0, 1
    );
    matB.current.set(
        fB[0], fB[1], fB[2], fB[3],
        fB[4], fB[5], fB[6], fB[7],
        fB[8], fB[9], fB[10], fB[11],
        0, 0, 0, 1
    );

    // 4. Decompose
    matA.current.decompose(posA.current, quatA.current, scaleA.current);
    matB.current.decompose(posB.current, quatB.current, scaleB.current);

    // 5. Interpolate
    interpPos.current.lerpVectors(posA.current, posB.current, alpha);
    interpQuat.current.slerpQuaternions(quatA.current, quatB.current, alpha); // SLERP for rotations!
    interpScale.current.lerpVectors(scaleA.current, scaleB.current, alpha);

    // 6. Recompose
    finalMat.current.compose(interpPos.current, interpQuat.current, interpScale.current);

    // 7. Apply World Rotation and Scene Transforms
    sPos.current.set(scenePos[0], scenePos[1], scenePos[2]);
    sEuler.current.set(sceneRot[0], sceneRot[1], sceneRot[2]);
    sQuat.current.setFromEuler(sEuler.current);
    sScale.current.set(sceneScale[0], sceneScale[1], sceneScale[2]);
    sceneTransform.current.compose(sPos.current, sQuat.current, sScale.current);

    // Final application to camera: sceneTransform * (WORLD_ROTATION * interpolatedMatrix)
    worldMatrixPool.current.multiplyMatrices(WORLD_ROTATION, finalMat.current);
    worldMatrixPool.current.premultiply(sceneTransform.current);

    camera.matrixAutoUpdate = false;
    camera.matrix.copy(worldMatrixPool.current);
    camera.matrixWorldNeedsUpdate = true;

    // Projection sync
    (camera as THREE.PerspectiveCamera).fov = cameraFov;
    camera.updateProjectionMatrix();
  });

  return null;
};