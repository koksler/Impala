import React, { useEffect, useState, useRef } from 'react';
import * as THREE from 'three';
import { GLTFLoader } from 'three/examples/jsm/loaders/GLTFLoader';
import { useStore } from '../../store';

export const CustomModel = ({ url }: { url: string }) => {
    const [scene, setScene] = useState<THREE.Group | null>(null);
    const { matRoughness, matMetallic } = useStore();
    const abortControllerRef = useRef<AbortController | null>(null);

    useEffect(() => {
        if (!url) return;

        // Cancel previous load if any
        if (abortControllerRef.current) {
            abortControllerRef.current.abort();
        }
        abortControllerRef.current = new AbortController();

        const loader = new GLTFLoader();
        
        loader.load(
            url,
            (gltf) => {
                setScene(gltf.scene);
            },
            undefined,
            (error) => {
                console.error(`[CustomModel] Failed to load 3D model: ${url}`, error);
                setScene(null);
                useStore.getState().addToast(
                    'Model Load Failed',
                    `Could not load 3D object from ${url}. Check if the file exists.`,
                    'error'
                );
            }
        );

        return () => {
            if (abortControllerRef.current) {
                abortControllerRef.current.abort();
            }
            setScene(null);
        };
    }, [url]);

    // Apply material properties
    useEffect(() => {
        if (!scene) return;
        scene.traverse((child: any) => {
            if (child.isMesh) {
                child.castShadow = true;
                child.receiveShadow = true;
                if (child.material) {
                    child.material.shadowSide = THREE.DoubleSide;
                    child.material.roughness = matRoughness;
                    child.material.metalness = matMetallic;
                    child.material.needsUpdate = true;
                }
            }
        });
    }, [scene, matRoughness, matMetallic]);

    // Compute bounding box
    useEffect(() => {
        if (!scene) return;

        const cloned = scene.clone();
        cloned.position.set(0, 0, 0);
        cloned.rotation.set(0, 0, 0);
        cloned.scale.set(1, 1, 1);
        cloned.updateMatrixWorld(true);

        const box = new THREE.Box3().setFromObject(cloned);
        const center = new THREE.Vector3();
        box.getCenter(center);

        const size = new THREE.Vector3();
        box.getSize(size);
        useStore.getState().setObjBounds([size.x, size.y, size.z]);

        scene.position.set(-center.x, -center.y, -center.z);
    }, [scene]);

    if (!scene) return null;

    return <primitive object={scene} castShadow receiveShadow />;
};

