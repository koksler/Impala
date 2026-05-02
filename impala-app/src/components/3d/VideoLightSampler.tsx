import { useEffect, useRef, useMemo } from 'react';
import { useFrame, useThree } from '@react-three/fiber';
import * as THREE from 'three';
import { useStore } from '../../store';

const LERP_FACTOR = 0.05;

export const VideoLightSampler = () => {
    const { scene } = useThree();
    const videoElement = useStore(state => state.videoElement);
    const envIntensity = useStore(state => state.envIntensity);

    // Cached Three.js light refs — populated once on scene mount
    const hemiRef = useRef<THREE.HemisphereLight | null>(null);
    const ambRef = useRef<THREE.AmbientLight | null>(null);
    const dirRef = useRef<THREE.DirectionalLight | null>(null);

    // Tiny off-screen canvas for color extraction — created once
    const sampleCanvas = useMemo(() => {
        const c = document.createElement('canvas');
        c.width = 32;
        c.height = 18;
        return c;
    }, []);

    const sampleCtx = useMemo(
        () => sampleCanvas.getContext('2d', { willReadFrequently: true }),
        [sampleCanvas]
    );

    const frameCounter = useRef(0);
    // Track envIntensity in a ref so useFrame closure always sees the latest value
    const intensityRef = useRef(envIntensity);
    useEffect(() => { intensityRef.current = envIntensity; }, [envIntensity]);

    // Cache light references (runs when scene is ready)
    useEffect(() => {
        scene.traverse(obj => {
            if (obj instanceof THREE.HemisphereLight) hemiRef.current = obj;
            if (obj instanceof THREE.AmbientLight) ambRef.current = obj;
            if (obj instanceof THREE.DirectionalLight && obj.castShadow) dirRef.current = obj;
        });
    }, [scene]);

    useFrame(() => {
        frameCounter.current++;
        // Sample every 4 frames — imperceptible lag, significant CPU saving
        if (frameCounter.current % 4 !== 0) return;

        if (!videoElement || !sampleCtx) return;
        if (videoElement.readyState < 2 || !videoElement.videoWidth) return;

        try {
            sampleCtx.drawImage(videoElement, 0, 0, 32, 18);
        } catch {
            return; // CORS or decode error — skip silently
        }

        const data = sampleCtx.getImageData(0, 0, 32, 18).data;
        const pixPerHalf = 32 * 9; // 288 pixels per region

        let skyR = 0, skyG = 0, skyB = 0;
        let groundR = 0, groundG = 0, groundB = 0;
        let totalLuma = 0;

        for (let y = 0; y < 18; y++) {
            for (let x = 0; x < 32; x++) {
                const i = (y * 32 + x) * 4;
                const r = data[i], g = data[i + 1], b = data[i + 2];
                // Rec. 601 luma approximation
                totalLuma += 0.299 * r + 0.587 * g + 0.114 * b;
                if (y < 9) { skyR += r; skyG += g; skyB += b; }
                else { groundR += r; groundG += g; groundB += b; }
            }
        }

        const norm = pixPerHalf * 255;
        const avgLuma = totalLuma / (32 * 18 * 255); // 0–1

        // Brightness scale: neutral luma ≈ 0.45 maps to 1.0
        // Clamp so very dark or very bright scenes don't blow out
        const brightScale = Math.max(0.25, Math.min(1.8, avgLuma / 0.45));

        const skyNR = skyR / norm, skyNG = skyG / norm, skyNB = skyB / norm;
        const gndNR = groundR / norm, gndNG = groundG / norm, gndNB = groundB / norm;

        // Directional key light: tint sky color 30%, blend rest toward neutral white
        // This avoids harsh monochromatic tinting while still responding to scene hue
        const dirR = skyNR * 0.3 + 0.7;
        const dirG = skyNG * 0.3 + 0.7;
        const dirB = skyNB * 0.3 + 0.7;

        const intensity = intensityRef.current;

        if (hemiRef.current) {
            hemiRef.current.color.lerp(new THREE.Color(skyNR, skyNG, skyNB), LERP_FACTOR);
            hemiRef.current.groundColor.lerp(new THREE.Color(gndNR, gndNG, gndNB), LERP_FACTOR);
            hemiRef.current.intensity += (intensity * 0.35 * brightScale - hemiRef.current.intensity) * LERP_FACTOR;
        }

        if (ambRef.current) {
            ambRef.current.intensity += (intensity * 0.15 * brightScale - ambRef.current.intensity) * LERP_FACTOR;
        }

        if (dirRef.current) {
            dirRef.current.color.lerp(new THREE.Color(dirR, dirG, dirB), LERP_FACTOR);
            dirRef.current.intensity += (intensity * brightScale - dirRef.current.intensity) * LERP_FACTOR;
        }
    });

    return null;
};
