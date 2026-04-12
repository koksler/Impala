import { useGLTF, useAnimations } from '@react-three/drei';
import { useFrame, useThree } from '@react-three/fiber';
import { useEffect } from 'react';
import { useStore } from '../../store';

export const GltfCamera = ({ url }: { url: string }) => {
  const { scene, animations } = useGLTF(url);
  const { set } = useThree();
  const { mixer } = useAnimations(animations, scene);
  const { currentFrame, totalFrames } = useStore();

  useEffect(() => {
    const glbCamera = scene.getObjectByName('camera_0') || scene.children.find(c => (c as any).isCamera);
    if (glbCamera) {
      set({ camera: glbCamera as any });
    }
  }, [scene]);

  useFrame(() => {
    if (mixer && totalFrames > 0) {
      const time = (currentFrame / 24); // 24 FPS
      mixer.setTime(time);
    }
  });

  return <primitive object={scene} />;
};