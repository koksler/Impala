import { useEffect } from 'react';
import * as THREE from 'three';
import { useGLTF } from '@react-three/drei';
import { useStore } from '../../store';

export const CustomModel = ({ url, onLowestPoint }: { url: string, onLowestPoint?: (y: number) => void }) => {
    const { scene } = useGLTF(url);
    const { matRoughness, matMetallic } = useStore();

    useEffect(() => {
        scene.traverse((child: any) => {
            if (child.isMesh) {
                child.castShadow = true;
                child.receiveShadow = true;
                if (child.material) {
                    child.material.roughness = matRoughness;
                    child.material.metalness = matMetallic;
                    child.material.needsUpdate = true;
                }
            }
        });
    }, [scene, matRoughness, matMetallic]);

    useEffect(() => {
        if (onLowestPoint) {
            const box = new THREE.Box3().setFromObject(scene);
            // Since scene is placed at [0,0,0] in the custom-model-group local space,
            // the box.min.y in world space corresponds to its lowest extent. 
            // Wait, we need its purely local lowest point.
            // But scene.position is natively locally offset.
            
            // To be perfectly safe, let's just supply the raw local boundary natively 
            // without global bleeding by cloning and isolating it.
            const cloned = scene.clone();
            cloned.position.set(0, 0, 0);
            cloned.rotation.set(0, 0, 0);
            cloned.scale.set(1, 1, 1);
            cloned.updateMatrixWorld(true);
            const rawBox = new THREE.Box3().setFromObject(cloned);
            onLowestPoint(rawBox.min.y);
        }
    }, [scene, onLowestPoint]);

    return (
        <primitive object={scene} castShadow receiveShadow />
    );
};
