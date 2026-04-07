import { useEffect } from 'react';
import { useGLTF, Center } from '@react-three/drei';
import { useStore } from '../../store';

export const CustomModel = ({ url }: { url: string }) => {
    const { scene } = useGLTF(url);
    const { matRoughness, matMetallic } = useStore();

    useEffect(() => {
        scene.traverse((child: any) => {
            if (child.isMesh && child.material) {
                child.material.roughness = matRoughness;
                child.material.metalness = matMetallic;
                child.material.needsUpdate = true;
            }
        });
    }, [scene, matRoughness, matMetallic]);

    return (
        <Center>
            <primitive object={scene} castShadow receiveShadow />
        </Center>
    );
};
