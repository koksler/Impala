import React, { useMemo, useState, useEffect, useRef } from 'react';
import { OBJLoader } from 'three-stdlib';
import * as THREE from 'three';
import { useStore } from '../../store';

interface ProxyMeshProps {
    url?: string;
    isExporting: boolean;
}

export const ProxyMesh: React.FC<ProxyMeshProps> = ({ url, isExporting }) => {
    const [obj, setObj] = useState<THREE.Group | null>(null);
    const { shadowOpacity, shadowColor } = useStore();
    const abortControllerRef = useRef<AbortController | null>(null);

    useEffect(() => {
        if (!url) {
            setObj(null);
            return;
        }

        const loader = new OBJLoader();
        loader.load(
            url,
            (loaded) => {
                setObj(loaded);
            },
            undefined,
            (error) => {
                console.warn(`[ProxyMesh] Failed to load proxy obj from: ${url}`, error);
                setObj(null);
            }
        );

        return () => {
            setObj(null);
        };
    }, [url]);

    const clonedObj = useMemo(() => {
        if (!obj) return null;
        
        const holdoutGroup = new THREE.Group();

        obj.traverse((child) => {
            if (child instanceof THREE.Mesh) {
                // 1. Depth Occluder
                const depthMesh = child.clone();
                depthMesh.receiveShadow = false;
                depthMesh.castShadow = false;
                depthMesh.material = new THREE.MeshBasicMaterial({
                    colorWrite: false, 
                    depthWrite: true,
                });
                depthMesh.renderOrder = -1; 
                holdoutGroup.add(depthMesh);

                // 2. Shadow Catcher
                const shadowMesh = child.clone();
                shadowMesh.receiveShadow = true;
                shadowMesh.castShadow = false;
                shadowMesh.renderOrder = 9;
                shadowMesh.material = new THREE.ShadowMaterial({
                    opacity: shadowOpacity,
                    color: new THREE.Color(shadowColor),
                    transparent: true,
                    depthWrite: false, 
                    depthTest: true,
                    side: THREE.DoubleSide, 
                    polygonOffset: true,
                    polygonOffsetFactor: -1.0, 
                    polygonOffsetUnits: -1.0
                });
                
                holdoutGroup.add(shadowMesh);
            }
        });

        holdoutGroup.name = "proxy-occluder-group";
        return holdoutGroup;
    }, [obj, shadowOpacity, shadowColor]);

    if (!clonedObj) return null;

    return <primitive object={clonedObj} visible={isExporting || true} />;
};