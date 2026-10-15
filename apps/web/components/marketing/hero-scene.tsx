'use client';
import { Canvas, useFrame } from '@react-three/fiber';
import { RoundedBox } from '@react-three/drei';
import { useEffect, useMemo, useRef, useState } from 'react';
import * as THREE from 'three';

const MILESTONES = 4;
const LOOP_SECONDS = 12;

function readColors() {
  const css = getComputedStyle(document.documentElement);
  const get = (v: string, fallback: string) => css.getPropertyValue(v).trim() || fallback;
  return {
    surface: new THREE.Color(get('--gw-surface-2', '#12241d')),
    border: new THREE.Color(get('--gw-border', '#1e3a2f')),
    primary: new THREE.Color(get('--gw-primary', '#19c784')),
  };
}

/** One milestone pane. `fill` 0..1 lerps from a calm glass to the emerald "done" state. */
function Pane({
  index,
  progress,
  colors,
}: {
  index: number;
  progress: React.RefObject<number>;
  colors: ReturnType<typeof readColors>;
}) {
  const mesh = useRef<THREE.Mesh>(null);
  const mat = useRef<THREE.MeshStandardMaterial>(null);
  const x = (index - (MILESTONES - 1) / 2) * 2.7;
  useFrame(() => {
    const p = progress.current * MILESTONES;
    const fill = THREE.MathUtils.clamp(p - index, 0, 1);
    if (mat.current) {
      mat.current.color.copy(colors.surface).lerp(colors.primary, fill * 0.85);
      mat.current.emissive.copy(colors.primary).multiplyScalar(fill * 0.35);
    }
    if (mesh.current) mesh.current.position.y = Math.sin(index + progress.current * 6) * 0.06 + fill * 0.18;
  });
  return (
    <group position={[x, 0, -Math.abs(index - 1.5) * 0.25]} rotation={[0.05, -0.28, 0]}>
      <RoundedBox ref={mesh} args={[2.2, 1.5, 0.16]} radius={0.12} smoothness={4}>
        <meshStandardMaterial
          ref={mat}
          color={colors.surface}
          roughness={0.35}
          metalness={0.2}
          transparent
          opacity={0.92}
        />
      </RoundedBox>
      <mesh position={[-0.55, 0.38, 0.09]}>
        <planeGeometry args={[0.9, 0.08]} />
        <meshBasicMaterial color={colors.border} />
      </mesh>
      <mesh position={[-0.3, 0.16, 0.09]}>
        <planeGeometry args={[1.4, 0.08]} />
        <meshBasicMaterial color={colors.border} />
      </mesh>
    </group>
  );
}

function Orb({
  progress,
  colors,
}: {
  progress: React.RefObject<number>;
  colors: ReturnType<typeof readColors>;
}) {
  const ref = useRef<THREE.Mesh>(null);
  useFrame(() => {
    if (!ref.current) return;
    const half = ((MILESTONES - 1) / 2) * 2.7;
    ref.current.position.x = THREE.MathUtils.lerp(-half, half, progress.current);
    ref.current.position.y = -1.15;
    ref.current.position.z = 0.3;
  });
  return (
    <mesh ref={ref}>
      <sphereGeometry args={[0.13, 24, 24]} />
      <meshBasicMaterial color={colors.primary} />
    </mesh>
  );
}

function Rig({ children }: { children: React.ReactNode }) {
  const group = useRef<THREE.Group>(null);
  useFrame((state) => {
    if (!group.current) return;
    group.current.rotation.y = THREE.MathUtils.lerp(group.current.rotation.y, state.pointer.x * 0.18, 0.04);
    group.current.rotation.x = THREE.MathUtils.lerp(group.current.rotation.x, -state.pointer.y * 0.08, 0.04);
  });
  return <group ref={group}>{children}</group>;
}

function Scene({ onReady }: { onReady: () => void }) {
  const progress = useRef(0);
  const colors = useMemo(readColors, []);
  const track = useMemo(() => {
    const half = ((MILESTONES - 1) / 2) * 2.7;
    return new THREE.Mesh(
      new THREE.BoxGeometry(half * 2, 0.025, 0.025),
      new THREE.MeshBasicMaterial({ color: colors.border }),
    );
  }, [colors]);
  useEffect(onReady, [onReady]);
  useFrame((state) => {
    // Eases in and out; holds briefly at 100% before looping.
    const t = (state.clock.elapsedTime % LOOP_SECONDS) / LOOP_SECONDS;
    const eased = THREE.MathUtils.smoothstep(Math.min(t / 0.85, 1), 0, 1);
    progress.current = eased;
  });
  return (
    <Rig>
      <ambientLight intensity={0.8} />
      <directionalLight position={[3, 4, 5]} intensity={1.6} />
      <pointLight position={[-4, -2, 3]} intensity={12} color={colors.primary} />
      {Array.from({ length: MILESTONES }, (_, i) => (
        <Pane key={i} index={i} progress={progress} colors={colors} />
      ))}
      <primitive object={track} position={[0, -1.15, 0.2]} />
      <Orb progress={progress} colors={colors} />
    </Rig>
  );
}

export default function HeroScene({ onReady }: { onReady: () => void }) {
  const [visible, setVisible] = useState(true);
  const wrap = useRef<HTMLDivElement>(null);
  useEffect(() => {
    const el = wrap.current;
    if (!el) return;
    const io = new IntersectionObserver(([e]) => setVisible(Boolean(e?.isIntersecting)));
    io.observe(el);
    return () => io.disconnect();
  }, []);
  return (
    <div ref={wrap} className="absolute inset-0">
      <Canvas
        frameloop={visible ? 'always' : 'never'}
        dpr={[1, 1.75]}
        camera={{ position: [0, 0.2, 8.2], fov: 38 }}
        gl={{ antialias: true, alpha: true, powerPreference: 'low-power' }}
        aria-hidden
      >
        <Scene onReady={onReady} />
      </Canvas>
    </div>
  );
}
