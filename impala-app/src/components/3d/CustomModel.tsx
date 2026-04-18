import { useEffect } from 'react';
import * as THREE from 'three';
import { useGLTF } from '@react-three/drei';
import { useStore } from '../../store';

export const CustomModel = ({ url }: { url: string }) => {
    const { scene } = useGLTF(url);
    const { matRoughness, matMetallic } = useStore();

    // Apply material properties
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

    // Compute bounding box to expose objBounds (used by shadow-catcher floor offset)
    // and center the model so TransformControls pivot at its visual center.
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

        // Offset the scene so its visual center is at [0,0,0]
        scene.position.set(-center.x, -center.y, -center.z);
    }, [scene]);

    return (
        <primitive object={scene} castShadow receiveShadow />
    );
};
