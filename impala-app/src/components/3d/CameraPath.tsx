import { useMemo } from 'react';
import * as THREE from 'three';
import { Line } from '@react-three/drei';
import { useStore } from '../../store';

const WORLD_ROTATION = new THREE.Matrix4().makeRotationX(-Math.PI / 2);

export const CameraPath = () => {
    const { cameraData, currentFrame, isExporting } = useStore();

    if (isExporting) return null;

    const points = useMemo(() => {
        if (!cameraData || !Array.isArray(cameraData)) return [];

        return cameraData.map((frame: any) => {
            const raw = frame.transform || frame.camera_to_world || frame.transform_matrix;
            if (!raw) return null;

            const f = Array.isArray(raw[0]) ? raw.flat() : raw;
            if (f.length < 12) return null;

            const mat = new THREE.Matrix4().set(
                f[0], f[1], f[2],  f[3],
                f[4], f[5], f[6],  f[7],
                f[8], f[9], f[10], f[11],
                0,    0,    0,     1
            );
            
            const finalMatrix = new THREE.Matrix4().multiplyMatrices(WORLD_ROTATION, mat);

            const pos = new THREE.Vector3();
            pos.setFromMatrixPosition(finalMatrix);
            return pos;
        }).filter((p): p is THREE.Vector3 => p !== null);
    }, [cameraData]);

    const currentLookVector = useMemo(() => {
        if (!cameraData || !cameraData[currentFrame]) return null;
        
        const frame = cameraData[currentFrame];
        const raw = frame.transform || frame.camera_to_world || frame.transform_matrix;
        if (!raw) return null;

        const f = Array.isArray(raw[0]) ? raw.flat() : raw;
        if (f.length < 12) return null;

        const mat = new THREE.Matrix4().set(
            f[0], f[1], f[2],  f[3],
            f[4], f[5], f[6],  f[7],
            f[8], f[9], f[10], f[11],
            0,    0,    0,     1
        );
        
        const finalMatrix = new THREE.Matrix4().multiplyMatrices(WORLD_ROTATION, mat);

        const pos = new THREE.Vector3();
        pos.setFromMatrixPosition(finalMatrix);

        // OpenGL camera looks down its local -Z axis
        const lookDir = new THREE.Vector3(0, 0, -1);
        lookDir.transformDirection(finalMatrix).normalize();
        
        // Length of the look vector
        const lookTarget = pos.clone().add(lookDir.multiplyScalar(0.4));
        
        return [pos, lookTarget];
    }, [cameraData, currentFrame]);

    if (points.length < 2) return null;

    return (
        <group>
            <Line points={points} color="#FF763B" lineWidth={3} transparent opacity={0.7} />
            <mesh position={points[0]}>
                <sphereGeometry args={[0.05, 16, 16]} />
                <meshBasicMaterial color="red" />
            </mesh>
            {points[currentFrame] && (
                <mesh position={points[currentFrame]}>
                    <sphereGeometry args={[0.07, 16, 16]} />
                    <meshBasicMaterial color="white" />
                </mesh>
            )}
            {currentLookVector && (
                <Line points={currentLookVector} color="white" lineWidth={4} />
            )}
        </group>
    );
};