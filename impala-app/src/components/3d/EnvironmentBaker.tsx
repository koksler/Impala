import { useFrame, useThree } from '@react-three/fiber';
import * as THREE from 'three';
import { useStore } from '../../store';
import { useMemo, useEffect } from 'react';

export const EnvironmentBaker = () => {
    const { gl, scene } = useThree();
    const isBakingEnv = useStore(state => state.isBakingEnv);
    const setIsBakingEnv = useStore(state => state.setIsBakingEnv);
    const setBakedEnvTexture = useStore(state => state.setBakedEnvTexture);
    const setBakedEnvPreview = useStore(state => state.setBakedEnvPreview);
    const videoElement = useStore(state => state.videoElement);
    const objPos = useStore(state => state.objPos);
    
    const [renderTarget, cubeCamera, previewCamera, previewRT] = useMemo(() => {
        const rt = new THREE.WebGLCubeRenderTarget(1024, {
            generateMipmaps: true,
            minFilter: THREE.LinearMipmapLinearFilter,
            magFilter: THREE.LinearFilter,
        });
        const cam = new THREE.CubeCamera(0.1, 1000, rt);
        
        const pt = new THREE.WebGLRenderTarget(512, 256);
        const pCam = new THREE.PerspectiveCamera(120, 2, 0.1, 1000); // 120 degree FOV for a wide preview
        
        return [rt, cam, pCam, pt];
    }, []);

    // Dispose GPU resources on unmount
    useEffect(() => () => {
        renderTarget.dispose();
        previewRT.dispose();
    }, [renderTarget, previewRT]);

    useFrame(() => {
        if (isBakingEnv) {
            const hiddenObjects: { obj: THREE.Object3D, visible: boolean }[] = [];

            // Traverse and hide editor elements / models that shouldn't be baked
            scene.traverse((child) => {
                if (child.name === 'custom-models-container' ||
                    child.name === 'custom-model-group' || 
                    child.name.startsWith('custom-model-') ||
                    child.name === 'editor-grid' || 
                    child.name === 'crop-cube' ||
                    child.name.startsWith('shadow-catcher') ||
                    child.name === 'splat-bounds' ||
                    child.name === 'camera-path' ||
                    child.type === 'TransformControls' ||
                    child.type === 'DirectionalLightHelper' ||
                    child.type === 'AxesHelper') {
                    
                    hiddenObjects.push({ obj: child, visible: child.visible });
                    child.visible = false;
                }
            });

            // Position cube camera at the object's position
            cubeCamera.position.set(objPos[0], objPos[1], objPos[2]);
            
            const prevBackground = scene.background;
            
            if (videoElement && videoElement.readyState >= 2) {
                // We use the video completely blurred out as the BACKGROUND *behind* the splat!
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
                scene.background = new THREE.Color(0x303030); // Neutral dark grey
            }

            // Bake the full Splat 360 scene over the filler background!
            cubeCamera.update(gl, scene);
            
            // Set the generated texture as the new environment map
            setBakedEnvTexture(renderTarget.texture);

            // Also render a flat snapshot for the UI preview
            previewCamera.position.set(objPos[0], objPos[1], objPos[2]);
            // Look straight ahead horizontally to provide a natural 360 environment panorama feel
            previewCamera.lookAt(objPos[0], objPos[1], objPos[2] - 1);
            
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
                for (let i = 0; i < height; i++) {
                    for (let j = 0; j < width * 4; j++) {
                        imgData.data[i * width * 4 + j] = buffer[(height - i - 1) * width * 4 + j];
                    }
                }
                context.putImageData(imgData, 0, 0);
                setBakedEnvPreview(canvas.toDataURL('image/jpeg', 0.8));
            }
            
            // Cleanup and restore
            scene.background = prevBackground;
            
            // Restore visibility of hidden objects
            hiddenObjects.forEach(item => {
                item.obj.visible = item.visible;
            });
            
            setIsBakingEnv(false);
        }
    });

    return null;
};
