import { useFrame, useThree } from '@react-three/fiber';
import * as THREE from 'three';
import { useStore } from '../../store';
import { useMemo } from 'react';

export const EnvironmentBaker = () => {
    const { gl, scene } = useThree();
    const isBakingEnv = useStore(state => state.isBakingEnv);
    const setIsBakingEnv = useStore(state => state.setIsBakingEnv);
    const setBakedEnvTexture = useStore(state => state.setBakedEnvTexture);
    const setBakedEnvPreview = useStore(state => state.setBakedEnvPreview);
    const videoElement = useStore(state => state.videoElement);
    const objPos = useStore(state => state.objPos);
    
    const [renderTarget, cubeCamera, previewCamera, previewRT] = useMemo(() => {
        const rt = new THREE.WebGLCubeRenderTarget(512, {
            generateMipmaps: true,
            minFilter: THREE.LinearMipmapLinearFilter,
            magFilter: THREE.LinearFilter,
        });
        const cam = new THREE.CubeCamera(0.1, 1000, rt);
        
        const pt = new THREE.WebGLRenderTarget(256, 128);
        const pCam = new THREE.PerspectiveCamera(120, 2, 0.1, 1000); // 120 degree FOV for a wide preview
        
        return [rt, cam, pCam, pt];
    }, []);

    useFrame(() => {
        if (isBakingEnv) {
            const hiddenObjects: { obj: THREE.Object3D, visible: boolean }[] = [];

            // Hide everything that isn't the raw Gaussian splat capture:
            //  - The Three.js Grid (InfiniteGridHelper) has no name so we match by type string
            //  - Custom model, crop box, transform controls, shadow catcher
            scene.traverse((child) => {
                const shouldHide =
                    child.type === 'InfiniteGridHelper' ||
                    child.type === 'TransformControls' ||
                    child.type === 'TransformControlsGizmo' ||
                    child.type === 'TransformControlsPlane' ||
                    child.name === 'custom-model-group' ||
                    child.name === 'editor-grid' ||
                    child.name === 'crop-cube' ||
                    child.name === 'shadow-catcher';

                if (shouldHide && child.visible) {
                    hiddenObjects.push({ obj: child, visible: true });
                    child.visible = false;
                }
            });

            // The object group in editorCanvas sits inside <group position={[0, -1.5, 0]}>.
            // Offset the bake origin by that same amount so the camera is level with the scene floor.
            const bakePos = new THREE.Vector3(
                objPos[0],
                objPos[1] - 1.5,    // compensate for the parent group offset
                objPos[2]
            );
            cubeCamera.position.copy(bakePos);
            
            const prevBackground = scene.background;
            
            if (videoElement && videoElement.readyState >= 2) {
                // Blur the video into a tiny canvas to use as a soft background sky
                const bgCanvas = document.createElement('canvas');
                bgCanvas.width = 128;
                bgCanvas.height = 64;
                const bgCtx = bgCanvas.getContext('2d');
                if (bgCtx) {
                    bgCtx.filter = 'blur(10px)';
                    bgCtx.drawImage(videoElement, 0, 0, bgCanvas.width, bgCanvas.height);
                    const bgTexture = new THREE.CanvasTexture(bgCanvas);
                    bgTexture.mapping = THREE.EquirectangularReflectionMapping;
                    bgTexture.colorSpace = THREE.SRGBColorSpace;
                    scene.background = bgTexture;
                }
            } else {
                scene.background = new THREE.Color(0x303030);
            }

            // Render the full 360 environment capture
            cubeCamera.update(gl, scene);
            setBakedEnvTexture(renderTarget.texture);

            // --- Preview render (forward-facing wide shot) ---
            previewCamera.position.copy(bakePos);
            previewCamera.lookAt(bakePos.x, bakePos.y, bakePos.z - 1);
            
            gl.setRenderTarget(previewRT);
            gl.render(scene, previewCamera);
            gl.setRenderTarget(null);

            const width = previewRT.width;
            const height = previewRT.height;
            const buffer = new Uint8Array(width * height * 4);
            gl.readRenderTargetPixels(previewRT, 0, 0, width, height, buffer);
            
            const canvas = document.createElement('canvas');
            canvas.width = width;
            canvas.height = height;
            const context = canvas.getContext('2d');
            if (context) {
                const imgData = context.createImageData(width, height);
                // Flip Y axis (WebGL reads bottom-up)
                for (let i = 0; i < height; i++) {
                    for (let j = 0; j < width * 4; j++) {
                        imgData.data[i * width * 4 + j] = buffer[(height - i - 1) * width * 4 + j];
                    }
                }
                context.putImageData(imgData, 0, 0);
                setBakedEnvPreview(canvas.toDataURL('image/jpeg', 0.8));
            }
            
            // Restore scene state
            scene.background = prevBackground;
            hiddenObjects.forEach(item => { item.obj.visible = item.visible; });
            setIsBakingEnv(false);
        }
    });

    return null;
};
