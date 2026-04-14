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

    // Center the model and notify parent of the floor level
    useEffect(() => {
        if (!scene) return;

        // Use a temporary clone to calculate the intrinsic bounding box 
        // without current position/rotation/scale interference
        const cloned = scene.clone();
        cloned.position.set(0, 0, 0);
        cloned.rotation.set(0, 0, 0);
        cloned.scale.set(1, 1, 1);
        cloned.updateMatrixWorld(true);

        const box = new THREE.Box3().setFromObject(cloned);
        const center = new THREE.Vector3();
        box.getCenter(center);
        
        // Offset the scene so its visual center is at [0,0,0]
        // This ensures TransformControls (attached to the parent group) are centered on the model
        scene.position.set(-center.x, -center.y, -center.z);

        if (onLowestPoint) {
            // Report the lowest point relative to the new center
            onLowestPoint(box.min.y - center.y);
        }
    }, [scene, onLowestPoint]);

    return (
        <primitive object={scene} castShadow receiveShadow />
    );
};
