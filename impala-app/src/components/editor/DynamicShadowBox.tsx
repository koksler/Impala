import React, { useRef, useMemo, useEffect } from 'react';
import { useFrame, useThree } from '@react-three/fiber';
import * as THREE from 'three';
import { useStore } from '../../store';

const _box       = new THREE.Box3();
const _prevClear = new THREE.Color();
const _lightDir  = new THREE.Vector3();

const SILHOUETTE_MAT = new THREE.MeshBasicMaterial({ color: 0xffffff, side: THREE.DoubleSide });
const SHADOW_LAYER   = 28;

// ── 5-tap box blur (separable) ────────────────────────────────────────────────
// Applied multiple times with doubling step: creates smooth Gaussian-like result.
const BLUR_VERT = /* glsl */`
    varying vec2 vUv;
    void main() { vUv = uv; gl_Position = vec4(position.xy * 2.0, 0.0, 1.0); }
`;
const BLUR_FRAG = /* glsl */`
    uniform sampler2D tDiffuse;
    uniform vec2 uStep;
    varying vec2 vUv;
    void main() {
        vec4 c  = texture2D(tDiffuse, vUv) * 6.0;
        c += texture2D(tDiffuse, vUv - uStep * 2.0) * 1.0;
        c += texture2D(tDiffuse, vUv - uStep       ) * 4.0;
        c += texture2D(tDiffuse, vUv + uStep       ) * 4.0;
        c += texture2D(tDiffuse, vUv + uStep * 2.0) * 1.0;
        gl_FragColor = c / 16.0;
    }
`;

interface Props { modelId: string; }

export const DynamicShadowBox: React.FC<Props> = ({ modelId }) => {
    const planeGroupRef = useRef<THREE.Group>(null);
    const planeRef      = useRef<THREE.Mesh>(null);
    const matRef        = useRef<THREE.MeshBasicMaterial>(null);
    const { gl, scene } = useThree();
    const { shadowOpacity, shadowColor, shadowBlur, lightElevation, envRotation, shadowResolution } = useStore();

    const size = shadowResolution ?? 512;

    // Three RTs: silhouette, ping, pong (for iterative blur)
    const [rtRaw, rtPing, rtPong] = useMemo(() => {
        const o = { format: THREE.RGBAFormat, minFilter: THREE.LinearFilter, magFilter: THREE.LinearFilter };
        return [
            new THREE.WebGLRenderTarget(size, size, o),
            new THREE.WebGLRenderTarget(size, size, o),
            new THREE.WebGLRenderTarget(size, size, o),
        ] as const;
    // eslint-disable-next-line react-hooks/exhaustive-deps
    }, [size]);

    useEffect(() => () => { rtRaw.dispose(); rtPing.dispose(); rtPong.dispose(); }, [rtRaw, rtPing, rtPong]);

    const orthoCamera = useMemo(() => {
        const c = new THREE.OrthographicCamera(-1, 1, 1, -1, 0.01, 500);
        c.layers.set(SHADOW_LAYER);
        return c;
    }, []);

    const [blurScene, blurCamera, blurMatH, blurMatV] = useMemo(() => {
        const mkMat = (axis: 'x' | 'y') => new THREE.ShaderMaterial({
            uniforms: { tDiffuse: { value: null }, uStep: { value: new THREE.Vector2(axis === 'x' ? 1 / size : 0, axis === 'y' ? 1 / size : 0) } },
            vertexShader: BLUR_VERT, fragmentShader: BLUR_FRAG,
            depthTest: false, depthWrite: false,
        });
        const mH  = mkMat('x');
        const mV  = mkMat('y');
        const geo = new THREE.PlaneGeometry(1, 1);
        const msh = new THREE.Mesh(geo, mH);
        const sc  = new THREE.Scene(); sc.add(msh);
        const cam = new THREE.OrthographicCamera(-0.5, 0.5, 0.5, -0.5, 0, 1);
        return [sc, cam, mH, mV, msh] as const;
    // eslint-disable-next-line react-hooks/exhaustive-deps
    }, [size]);

    useEffect(() => () => { blurMatH.dispose(); blurMatV.dispose(); }, [blurMatH, blurMatV]);

    const lightPos = useMemo(() => {
        const theta = envRotation    * (Math.PI / 180);
        const phi   = lightElevation * (Math.PI / 180);
        return new THREE.Vector3(
            Math.sin(theta) * Math.cos(phi),
            Math.max(0.05,   Math.sin(phi)),
            Math.cos(theta) * Math.cos(phi),
        ).normalize();
    }, [envRotation, lightElevation]);

    useFrame(() => {
        const modelNode = scene.getObjectByName(`custom-model-${modelId}`);
        if (!modelNode || !planeGroupRef.current || !planeRef.current || !matRef.current) return;

        // Force the world transform to be current before computing the bounding box.
        // useFrame runs before Three.js re-renders, so matrixWorld may still reflect
        // the previous frame's rotation/position.
        modelNode.updateMatrixWorld(true);
        _box.setFromObject(modelNode);
        if (_box.isEmpty() || !isFinite(_box.min.y)) return;

        const cx    = (_box.min.x + _box.max.x) / 2;
        const cz    = (_box.min.z + _box.max.z) / 2;
        const cy    = (_box.min.y + _box.max.y) / 2;
        const objH  = Math.max(_box.max.y - _box.min.y, 0.05);
        const footW = Math.max(_box.max.x - _box.min.x, 0.05);
        const footD = Math.max(_box.max.z - _box.min.z, 0.05);
        const floorY = _box.min.y;
        // ── Shadow plane: offset + stretch from light direction ──────────────
        // We project the model's vertical center onto the floor along the light ray.
        // shadow_offset = -(lightDir.xz / lightDir.y) * heightAboveFloor
        const ly          = Math.max(lightPos.y, 0.05);
        const shadowOffX  = -(lightPos.x / ly) * (cy - floorY);
        const shadowOffZ  = -(lightPos.z / ly) * (cy - floorY);

        // Shadow footprint stretches in the horizontal light direction
        const stretchW = footW + Math.abs(lightPos.x / ly) * objH;
        const stretchD = footD + Math.abs(lightPos.z / ly) * objH;
        const pad      = 1.5;

        planeGroupRef.current.position.set(cx + shadowOffX, floorY + 0.005, cz + shadowOffZ);
        planeRef.current.scale.set(stretchW * pad, stretchD * pad, 1);

        // ── Ortho camera: ALWAYS look straight down ──────────────────────────
        // Key fix: an angled camera has a right-axis that doesn't align with
        // World +X (the shadow plane's U-axis). This rotates the captured silhouette
        // in texture space, making it not match the shadow plane UV.
        //
        // By looking straight down with up=(0,0,-1), the camera's right-axis = World +X
        // and up-axis = World +Z, which exactly matches the shadow plane's UV layout.
        // Shadow direction/stretch is handled analytically on the plane above.
        orthoCamera.up.set(0, 0, -1);  // avoid gimbal lock (up ≠ forward)
        orthoCamera.position.set(cx, _box.max.y + 20, cz);
        orthoCamera.lookAt(cx, 0, cz);

        // Frustum covers the full shadow footprint so the silhouette isn't cropped
        orthoCamera.left   = -(stretchW * pad) / 2;
        orthoCamera.right  =  (stretchW * pad) / 2;
        orthoCamera.top    =  (stretchD * pad) / 2;
        orthoCamera.bottom = -(stretchD * pad) / 2;
        orthoCamera.updateProjectionMatrix();

        // ── Swap meshes to isolated layer + white material ───────────────────
        const saved: Array<{ mesh: THREE.Mesh; mask: number; mat: THREE.Material | THREE.Material[] }> = [];
        modelNode.traverse((child) => {
            const m = child as THREE.Mesh;
            if (!m.isMesh) return;
            saved.push({ mesh: m, mask: m.layers.mask, mat: m.material });
            m.layers.set(SHADOW_LAYER);
            m.material = SILHOUETTE_MAT;
        });

        const prevRT    = gl.getRenderTarget();
        const prevAlpha = gl.getClearAlpha();
        gl.getClearColor(_prevClear);
        const prevBg    = scene.background;
        scene.background = null; // prevent HDRI/video bleeding into RTT

        // ── Render silhouette ────────────────────────────────────────────────
        gl.setRenderTarget(rtRaw);
        gl.setClearColor(0, 0, 0, 0);
        gl.clear();
        gl.render(scene, orthoCamera);

        scene.background = prevBg;
        saved.forEach(({ mesh, mask, mat }) => { mesh.layers.mask = mask; mesh.material = mat; });

        // ── Iterative separable box blur (ping-pong) ─────────────────────────
        // Number of passes doubles the effective radius each time.
        // shadowBlur 0→1 maps to 0→5 passes. Each pass: H then V.
        // Step doubles each iteration: 1→2→4→8→16 texels.
        const blurMesh = blurScene.children[0] as THREE.Mesh;
        const passes   = Math.round(shadowBlur * 5); // 0–5 passes
        let   src      = rtRaw;

        gl.setClearColor(0, 0, 0, 0);

        for (let p = 0; p < passes; p++) {
            const step = (1 << p) / size; // 1, 2, 4, 8, 16 texels in UV

            // Horizontal pass: src → rtPing
            blurMatH.uniforms.tDiffuse.value = src.texture;
            blurMatH.uniforms.uStep.value.set(step, 0);
            blurMesh.material = blurMatH;
            gl.setRenderTarget(rtPing);
            gl.clear();
            gl.render(blurScene, blurCamera);

            // Vertical pass: rtPing → rtPong
            blurMatV.uniforms.tDiffuse.value = rtPing.texture;
            blurMatV.uniforms.uStep.value.set(0, step);
            blurMesh.material = blurMatV;
            gl.setRenderTarget(rtPong);
            gl.clear();
            gl.render(blurScene, blurCamera);

            src = rtPong;
        }

        gl.setRenderTarget(prevRT);
        gl.setClearColor(_prevClear, prevAlpha);

        const finalTex = passes > 0 ? rtPong.texture : rtRaw.texture;
        if (matRef.current.alphaMap !== finalTex) {
            matRef.current.alphaMap    = finalTex;
            matRef.current.needsUpdate = true;
        }
    });

    return (
        <group ref={planeGroupRef}>
            <mesh ref={planeRef} name={`shadow-catcher-${modelId}`}
                renderOrder={101} rotation={[-Math.PI / 2, 0, 0]}
                receiveShadow={false} castShadow={false}
            >
                <planeGeometry args={[1, 1]} />
                <meshBasicMaterial ref={matRef} color={shadowColor} transparent
                    opacity={shadowOpacity} depthTest depthWrite={false}
                    polygonOffset polygonOffsetFactor={-1} polygonOffsetUnits={-1} />
            </mesh>
        </group>
    );
};