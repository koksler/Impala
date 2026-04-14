import React, { useMemo } from 'react';
import { useLoader } from '@react-three/fiber';
import { OBJLoader } from 'three-stdlib';
import * as THREE from 'three';
import { useStore } from '../../store';

interface ProxyMeshProps {
    url?: string;
    isExporting: boolean;
}

export const ProxyMesh: React.FC<ProxyMeshProps> = ({ url, isExporting }) => {
    const { shadowOpacity, shadowColor } = useStore();

    if (!url) return null;

    let obj: THREE.Group | null = null;
    try {
        obj = useLoader(OBJLoader, url);
    } catch (e) {
        console.warn("[ProxyMesh] Failed to load proxy obj", e);
        return null;
    }

    const clonedObj = useMemo(() => {
        if (!obj) return null;
        
        const holdoutGroup = new THREE.Group();

        obj.traverse((child) => {
            if (child instanceof THREE.Mesh) {
                // 1. Depth Occluder (Invisible, writes depth to hide Teto when she goes behind things)
                const depthMesh = child.clone();
                depthMesh.receiveShadow = false;
                depthMesh.castShadow = false;
                depthMesh.material = new THREE.MeshBasicMaterial({
                    colorWrite: false, 
                    depthWrite: true,
                });
                depthMesh.renderOrder = -1; // Draw BEFORE Teto
                holdoutGroup.add(depthMesh);

                // 2. Shadow Catcher (Wraps shadows cleanly over the real-world geometry)
                const shadowMesh = child.clone();
                shadowMesh.receiveShadow = true;
                shadowMesh.castShadow = false;
                shadowMesh.material = new THREE.ShadowMaterial({
                    opacity: shadowOpacity,
                    color: new THREE.Color(shadowColor),
                    transparent: true,
                    depthWrite: false,
                    depthTest: true,
                    // FIX 1: Force shadow to catch on both sides of the messy proxy geometry
                    side: THREE.DoubleSide, 
                    // FIX 2: Stronger polygon offset to aggressively pull the shadow 
                    // through the Gaussian Splat depth buffer and the Depth Occluder
                    polygonOffset: true,
                    polygonOffsetFactor: -4, 
                    polygonOffsetUnits: -4
                });
                // FIX 3: Render extremely late to ensure it paints over the splats
                shadowMesh.renderOrder = 999; 
                holdoutGroup.add(shadowMesh);
            }
        });

        return holdoutGroup;
    }, [obj, shadowOpacity, shadowColor]);

    if (!clonedObj) return null;

    return <primitive object={clonedObj} visible={isExporting || true} />;
};