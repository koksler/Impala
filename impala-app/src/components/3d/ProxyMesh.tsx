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

    // We catch the error safely if the mesh doesn't exist yet (e.g. older project)
    let obj: THREE.Group | null = null;
    try {
        obj = useLoader(OBJLoader, url);
    } catch (e) {
        console.warn("[ProxyMesh] Failed to load proxy obj", e);
        return null;
    }

    const clonedObj = useMemo(() => {
        if (!obj) return null;
        
        // We create a Group to hold both the shadow catcher and the depth-occluder
        const holdoutGroup = new THREE.Group();

        obj.traverse((child) => {
            if (child instanceof THREE.Mesh) {
                // 1. Shadow Catcher (Transparent, blends with video! Does not occlude Teto reliably due to transparency pass)
                const shadowMesh = child.clone();
                shadowMesh.receiveShadow = true;
                shadowMesh.castShadow = false;
                shadowMesh.material = new THREE.ShadowMaterial({
                    opacity: shadowOpacity,
                    color: new THREE.Color(shadowColor),
                    transparent: true,
                    depthWrite: false, 
                    colorWrite: true
                });
                shadowMesh.renderOrder = 1; // Render after Teto (0) but respect depth buffer
                holdoutGroup.add(shadowMesh);

                // 2. Depth Occluder (Invisible, perfectly writes depth BEFORE anything else so Teto is blocked)
                const depthMesh = child.clone();
                depthMesh.receiveShadow = false;
                depthMesh.castShadow = false;
                depthMesh.material = new THREE.MeshBasicMaterial({
                    colorWrite: false, // Invisible
                    depthWrite: true,  // Writes to depth buffer!
                });
                depthMesh.renderOrder = -1; // Force draw BEFORE Teto (who defaults to 0)
                holdoutGroup.add(depthMesh);
            }
        });

        return holdoutGroup;
    }, [obj, shadowOpacity, shadowColor]);

    if (!clonedObj) return null;

    // Even if isExporting is true, we must actively RENDER the proxy mesh 
    return <primitive object={clonedObj} visible={isExporting || true} />;
};
