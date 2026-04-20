import React, { useRef } from 'react';
import { useFrame } from '@react-three/fiber';
import * as THREE from 'three';
import { useStore } from '../../store';

interface DynamicShadowBoxProps {
    cube: THREE.Object3D | null;
}

export const DynamicShadowBox: React.FC<DynamicShadowBoxProps> = ({ cube }) => {
    const groupRef = useRef<THREE.Group>(null);
    const { shadowOpacity, shadowColor } = useStore();

    useFrame(() => {
        if (cube && groupRef.current) {
            const box = new THREE.Box3().setFromObject(cube);

            // Guard against unloaded geometry causing Infinity bounds
            if (box.isEmpty() || !isFinite(box.min.y)) return;

            groupRef.current.position.set(
                (box.min.x + box.max.x) / 2,
                box.min.y + 0.005,
                (box.min.z + box.max.z) / 2,
            );
        }
    });

    return (
        <group ref={groupRef}>
            <mesh
                name="shadow-catcher"
                /*
                 * Draw order:
                 *   0   → 3D model          (writes depth)
                 *   100 → SplatMesh         (writes depth! Forced in GaussianScene.tsx)
                 *   101 → shadow plane      (depthTest=true, depthWrite=false)
                 *
                 * By forcing the SplatMesh to write depth, we can render the shadow AFTER
                 * the splats. The shadow correctly tests against the splats' depth, allowing
                 * splats in front (e.g. a chair) to seamlessly occlude the shadow, while drawing
                 * properly over splats behind (e.g. the floor).
                 */
                renderOrder={101}
                rotation={[-Math.PI / 2, 0, 0]}
                receiveShadow
            >
                <planeGeometry args={[10, 10]} />
                <shadowMaterial
                    transparent
                    opacity={shadowOpacity}
                    color={shadowColor}
                    depthTest={true}
                    depthWrite={false}
                    polygonOffset
                    polygonOffsetFactor={-1.0}
                    polygonOffsetUnits={-1.0}
                    customProgramCacheKey={() => 'shadow-under-splat'}
                    onBeforeCompile={(shader: any) => {
                        shader.fragmentShader = shader.fragmentShader.replace(
                            '#include <fog_fragment>',
                            '#include <fog_fragment>\nif (gl_FragColor.a < 0.01) discard;'
                        );
                    }}
                />
            </mesh>
        </group>
    );
};