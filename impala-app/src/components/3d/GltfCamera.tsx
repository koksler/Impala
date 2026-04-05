import { useGLTF, useAnimations } from '@react-three/drei';
import { useFrame, useThree } from '@react-three/fiber';
import { useEffect } from 'react';
import { useStore } from '../../store';

export const GltfCamera = ({ url }: { url: string }) => {
  const { scene, animations } = useGLTF(url);
  const { setThree } = useThree();
  const { actions, mixer } = useAnimations(animations, scene);
  const { currentFrame, totalFrames, isPlaying } = useStore();

  useEffect(() => {
    const glbCamera = scene.getObjectByName('camera_0') || scene.children.find(c => c.isCamera);
    if (glbCamera) {
      setThree({ camera: glbCamera });
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