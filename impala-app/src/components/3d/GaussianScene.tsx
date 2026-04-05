import React, { useEffect, useRef } from 'react';
import * as THREE from 'three';
import { useStore } from '../../store';
import * as GaussianSplats3D from '@mkkellogg/gaussian-splats-3d';

interface GaussianSceneProps {
  url?: string;
  visible: boolean;
}

export const GaussianScene: React.FC<GaussianSceneProps> = ({ url, visible }) => {
  const groupRef = useRef<THREE.Group>(null);
  const viewerRef = useRef<any>(null);
  
  const { splatLocation, splatRotation, splatScale } = useStore(); // Backlog

  useEffect(() => {
    if (!url || !groupRef.current) return;
    groupRef.current.clear();

    const viewer = new GaussianSplats3D.DropInViewer({
      dynamicScene: true,
      sphericalHarmonicsDegree: 2,
    });

    viewer.addSplatScene(url, { showLoadingUI: false });
    groupRef.current.add(viewer);
    viewerRef.current = viewer;

    return () => {
      if (groupRef.current) groupRef.current.clear();
      viewerRef.current = null;
    };
  },[url]);

  return (
    <group ref={groupRef} visible={visible} rotation={[-Math.PI / 2, 0, 0]} />
  );
};