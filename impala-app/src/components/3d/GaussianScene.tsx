import React, { useEffect, useRef } from 'react';
import * as THREE from 'three';
import { useStore } from '../../store';
import { useThree, useFrame } from '@react-three/fiber';
import * as GaussianSplats3D from '@mkkellogg/gaussian-splats-3d';

interface GaussianSceneProps {
  url?: string;
  visible: boolean;
}

const SPLAT_RENDER_ORDER = 100;

export const GaussianScene: React.FC<GaussianSceneProps> = React.memo(({ url, visible }) => {
  const groupRef = useRef<THREE.Group>(null);
  const viewerRef = useRef<any>(null);
  const { setSplatViewer } = useStore();

  const { gl, camera } = useThree();

  useEffect(() => {
    if (!url || !groupRef.current) return;

    groupRef.current.clear();

    const viewer = new GaussianSplats3D.DropInViewer({
      dynamicScene: true,
      sphericalHarmonicsDegree: 2,
      selfDrivenMode: false,
      renderer: gl,
      camera: camera,
      useBuiltInControls: false,
    });

    useStore.getState().updateToast('loading-project', {
      message: 'Loading Gaussian Splat...',
      progress: 60,
    });

    const attemptLoad = (targetUrl: string, isFallback = false) => {
      viewer
        .addSplatScene(targetUrl, { showLoadingUI: false })
        .then(() => {
          const splatMeshes = viewer.splatMeshes?.length ? viewer.splatMeshes : (viewer.splatMesh ? [viewer.splatMesh] : []);

          splatMeshes.forEach((mesh: any) => {
            mesh.renderOrder = SPLAT_RENDER_ORDER;
            if (mesh.material) {
              mesh.material.depthWrite = true;
            }
          });

          useStore.getState().updateToast('loading-project', {
            type: 'success',
            title: isFallback ? 'Project Ready (Fallback)' : 'Project Ready',
            message: isFallback
              ? 'Using original splat (cropped version not found).'
              : '3D scene has been synchronized.',
            progress: 100,
          });
        })
        .catch((err: any) => {
          if (!isFallback && targetUrl.includes('_cropped_')) {
            const parts = targetUrl.split('/');
            parts[parts.length - 1] = 'splat.ply';
            const fallbackUrl = parts.join('/');

            console.warn(`[GaussianScene] Cropped splat load failed. Retrying with original: ${fallbackUrl}`, err);
            attemptLoad(fallbackUrl, true);
          } else {
            console.error('Splat load error:', err);
            if (groupRef.current) groupRef.current.clear();
            setSplatViewer(null);

            useStore.getState().updateToast('loading-project', {
              type: 'error',
              title: 'Scene Load Failed',
              message: 'Failed to initialize Gaussian viewer. 3D object not found.',
            });
          }
        });
    };

    attemptLoad(url);

    groupRef.current.add(viewer);
    viewerRef.current = viewer;
    setSplatViewer(viewer);

    return () => {
      if (groupRef.current) groupRef.current.clear();
      viewerRef.current = null;
      setSplatViewer(null);
    };
  }, [url, gl, camera]);

  useFrame(() => {
    if (viewerRef.current?.update) {
      viewerRef.current.update();
    }
  });

  return (
    <group ref={groupRef} visible={visible} rotation={[-Math.PI / 2, 0, 0]} />
  );
});