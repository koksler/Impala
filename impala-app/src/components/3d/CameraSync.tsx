import { useEffect, useRef } from 'react';
import * as THREE from 'three';
import { useThree, useFrame } from '@react-three/fiber';
import { useStore } from '../../store';

const WORLD_ROTATION = new THREE.Matrix4().makeRotationX(-Math.PI / 2);

export const CameraSync = () => {
    const { camera } = useThree();
    const {
      cameraData, currentFrame, isPlaying, cameraEnabled,
      setCurrentFrame, totalFrames, cameraFov, videoDimensions
    } = useStore();
    const clockRef = useRef(0);
  
    useFrame((_, delta) => {
      if (!cameraEnabled || !isPlaying || totalFrames === 0) return;
      clockRef.current += delta;
      if (clockRef.current >= 1 / 24) {
        setCurrentFrame((currentFrame + 1) % totalFrames);
        clockRef.current = 0;
      }
    });
  
    useEffect(() => {
        if (!cameraEnabled || !cameraData || !cameraData[currentFrame]) {
          camera.matrixAutoUpdate = true;
          return;
        }
    
        const frame = cameraData[currentFrame];
        const matrixRaw = frame.transform || frame.camera_to_world || frame.transform_matrix;
        if (!matrixRaw) return;
  
        const f = Array.isArray(matrixRaw[0]) ? matrixRaw.flat() : matrixRaw;
        if (f.length < 12) return;
  
        // Build the Raw Matrix (Nerfstudio Training Space)
        const mat = new THREE.Matrix4().set(
          f[0], f[1], f[2],  f[3],
          f[4], f[5], f[6],  f[7],
          f[8], f[9], f[10], f[11],
          0,    0,    0,     1
        );
  
        // Transform to World Space (Align with the [-PI/2, 0, 0] group rotation)
        const finalMatrix = new THREE.Matrix4().multiplyMatrices(WORLD_ROTATION, mat);
  
        // Force inject to camera
        camera.matrixAutoUpdate = false;
        camera.matrix.copy(finalMatrix);
        camera.matrixWorldNeedsUpdate = true;
        
        if (videoDimensions) {
            const aspect = videoDimensions.width / videoDimensions.height;
            if ((camera as THREE.PerspectiveCamera).aspect !== aspect) {
                (camera as THREE.PerspectiveCamera).aspect = aspect;
                (camera as THREE.PerspectiveCamera).updateProjectionMatrix();
            }
        }
    
      }, [currentFrame, cameraData, camera, cameraEnabled, cameraFov, videoDimensions]);
  
    return null;
};