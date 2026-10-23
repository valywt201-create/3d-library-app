import { useMemo, useRef } from 'react'
import { Canvas, useFrame } from '@react-three/fiber'
import * as THREE from 'three'

function Stars({ color }: { color: string }) {
  const ref = useRef<THREE.Points>(null!)
  const cur = useRef(new THREE.Color(color))
  const target = useRef(new THREE.Color(color))
  const pos = useMemo(
    () => Float32Array.from({ length: 2400 * 3 }, () => (Math.random() - 0.5) * 14),
    [],
  )

  useFrame(({ pointer, clock }, dt) => {
    target.current.set(color)
    cur.current.lerp(target.current, Math.min(1, dt * 3))
    ;(ref.current.material as THREE.PointsMaterial).color.copy(cur.current)
    ref.current.rotation.y += (pointer.x * 0.6 + clock.elapsedTime * 0.03 - ref.current.rotation.y) * 0.04
    ref.current.rotation.x += (-pointer.y * 0.4 - ref.current.rotation.x) * 0.04
  })

  return (
    <points ref={ref}>
      <bufferGeometry>
        <bufferAttribute attach="attributes-position" args={[pos, 3]} />
      </bufferGeometry>
      <pointsMaterial size={0.03} sizeAttenuation transparent opacity={0.85} depthWrite={false} />
    </points>
  )
}

export default function SpaceBackground({ color }: { color: string }) {
  return (
    <div className="fixed inset-0 -z-10">
      <Canvas dpr={[1, 1.5]} camera={{ position: [0, 0, 6], fov: 60 }}>
        <Stars color={color} />
      </Canvas>
    </div>
  )
}