import React, { useEffect, useRef } from 'react';
import * as THREE from 'three';
import { useStore } from '../../store';
import * as GaussianSplats3D from '@mkkellogg/gaussian-splats-3d';

interface GaussianSceneProps {
  url?: string;
  visible: boolean;
}

export const GaussianScene: React.FC<GaussianSceneProps> = React.memo(({ url, visible }) => {
  const groupRef = useRef<THREE.Group>(null);
  const viewerRef = useRef<any>(null);
  
  const { setSplatViewer } = useStore(); // Backlog

  useEffect(() => {
    if (!url || !groupRef.current) return;
    groupRef.current.clear();

    const viewer = new GaussianSplats3D.DropInViewer({
      dynamicScene: true,
      sphericalHarmonicsDegree: 2,
    });

    useStore.getState().updateToast("loading-project", { message: "Loading Gaussian Splat...", progress: 60 });

    viewer.addSplatScene(url, { showLoadingUI: false })
      .then(() => {
        const { updateToast } = useStore.getState();
        updateToast("loading-project", { 
            type: 'success', 
            title: 'Project Ready', 
            message: '3D scene has been synchronized.',
            progress: 100 
        });
      })
      .catch((err: any) => {
        console.error("Splat load error:", err);
        const { updateToast } = useStore.getState();
        updateToast("loading-project", { 
            type: 'error', 
            title: 'Scene Load Failed', 
            message: 'Failed to initialize Gaussian viewer.' 
        });
      });

    groupRef.current.add(viewer);
    viewerRef.current = viewer;
    setSplatViewer(viewer);

    return () => {
      if (groupRef.current) groupRef.current.clear();
      viewerRef.current = null;
      setSplatViewer(null);
    };
  },[url]);

  return (
    <group ref={groupRef} visible={visible} rotation={[-Math.PI / 2, 0, 0]} />
  );
});