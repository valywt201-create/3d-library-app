import { useEffect, useMemo, useRef } from 'react'
import type { RefObject } from 'react'
import { Canvas, useFrame } from '@react-three/fiber'
import * as THREE from 'three'
import type { AnimatedThemeId, AnimationMode } from '../lib/settings'

function usePointerTarget(): RefObject<THREE.Vector2> {
  const pointer = useRef(new THREE.Vector2())

  useEffect(() => {
    const move = (event: PointerEvent): void => {
      const width = Math.max(1, window.innerWidth)
      const height = Math.max(1, window.innerHeight)
      pointer.current.set((event.clientX / width) * 2 - 1, -((event.clientY / height) * 2 - 1))
    }
    window.addEventListener('pointermove', move, { passive: true })
    return () => window.removeEventListener('pointermove', move)
  }, [])

  return pointer
}

function MotionDriver({ mode, pointer }: { mode: AnimationMode; pointer: RefObject<THREE.Vector2> }) {
  const target = useRef(new THREE.Vector2())
  useFrame(({ clock }, delta) => {
    if (mode !== 'auto') return
    const segmentDuration = 2.8
    const segment = Math.floor(clock.elapsedTime / segmentDuration)
    const progress = (clock.elapsedTime % segmentDuration) / segmentDuration
    const smooth = progress * progress * (3 - 2 * progress)
    const x0 = (seededUnit(segment, 91) - 0.5) * 1.6
    const x1 = (seededUnit(segment + 1, 91) - 0.5) * 1.6
    const y0 = (seededUnit(segment, 92) - 0.5) * 1.25
    const y1 = (seededUnit(segment + 1, 92) - 0.5) * 1.25
    target.current.set(
      x0 + (x1 - x0) * smooth,
      y0 + (y1 - y0) * smooth,
    )
    pointer.current.lerp(target.current, Math.min(1, delta * 1.4))
  })
  return null
}

function seededUnit(index: number, offset: number): number {
  const value = Math.sin((index + 1) * 127.1 + offset * 311.7) * 43758.5453
  return value - Math.floor(value)
}

function createCloudPositions(count: number, spreadX: number, spreadY: number, spreadZ: number, seed: number): Float32Array {
  const positions = new Float32Array(count * 3)
  for (let index = 0; index < count; index += 1) {
    positions[index * 3] = (seededUnit(index, seed) - 0.5) * spreadX
    positions[index * 3 + 1] = (seededUnit(index, seed + 1) - 0.5) * spreadY
    positions[index * 3 + 2] = (seededUnit(index, seed + 2) - 0.5) * spreadZ
  }
  return positions
}

function Stars({ color, pointer }: { color: string; pointer: RefObject<THREE.Vector2> }) {
  const ref = useRef<THREE.Points>(null!)
  const current = useRef(new THREE.Color(color))
  const target = useRef(new THREE.Color(color))
  const positions = useMemo(() => createCloudPositions(1400, 18, 12, 10, 4), [])

  useFrame(({ clock }, delta) => {
    target.current.set(color)
    current.current.lerp(target.current, Math.min(1, delta * 3))
    ;(ref.current.material as THREE.PointsMaterial).color.copy(current.current)
    ref.current.rotation.y += (pointer.current.x * 0.55 + clock.elapsedTime * 0.025 - ref.current.rotation.y) * 0.04
    ref.current.rotation.x += (pointer.current.y * 0.3 - ref.current.rotation.x) * 0.04
  })

  return (
    <points ref={ref}>
      <bufferGeometry><bufferAttribute attach="attributes-position" args={[positions, 3]} /></bufferGeometry>
      <pointsMaterial size={0.035} sizeAttenuation transparent opacity={0.82} depthWrite={false} color={color} />
    </points>
  )
}

const WAVE_SIDE = 36
const WAVE_COUNT = WAVE_SIDE * WAVE_SIDE

function createWavePositions(): Float32Array {
  const positions = new Float32Array(WAVE_COUNT * 3)
  for (let row = 0; row < WAVE_SIDE; row += 1) {
    for (let column = 0; column < WAVE_SIDE; column += 1) {
      const index = (row * WAVE_SIDE + column) * 3
      positions[index] = (column / (WAVE_SIDE - 1) - 0.5) * 13
      positions[index + 1] = 0
      positions[index + 2] = (row / (WAVE_SIDE - 1) - 0.5) * 9
    }
  }
  return positions
}

function WaveField({ color, pointer }: { color: string; pointer: RefObject<THREE.Vector2> }) {
  const ref = useRef<THREE.Points>(null!)
  const positions = useMemo(() => createWavePositions(), [])

  useFrame(({ clock }) => {
    const attribute = ref.current.geometry.attributes.position as THREE.BufferAttribute
    const time = clock.elapsedTime * 0.55
    for (let index = 0; index < WAVE_COUNT; index += 1) {
      const x = positions[index * 3]
      const z = positions[index * 3 + 2]
      const interaction = pointer.current.x * x * 0.025 + pointer.current.y * z * 0.025
      attribute.setY(index, Math.sin(x * 0.8 + time + interaction) * 0.22 + Math.cos(z * 0.9 - time * 0.8) * 0.16)
    }
    attribute.needsUpdate = true
    ref.current.rotation.y += (pointer.current.x * 0.14 - ref.current.rotation.y) * 0.025
    ref.current.rotation.x += (pointer.current.y * 0.08 - ref.current.rotation.x) * 0.025
  })

  return (
    <points ref={ref}>
      <bufferGeometry><bufferAttribute attach="attributes-position" args={[positions, 3]} /></bufferGeometry>
      <pointsMaterial color={color} size={0.045} sizeAttenuation transparent opacity={0.68} depthWrite={false} />
    </points>
  )
}

function Orbit({ radius, speed, tilt, color, size }: { radius: number; speed: number; tilt: number; color: string; size: number }) {
  const ref = useRef<THREE.Group>(null!)
  useFrame(({ clock }) => { ref.current.rotation.z = clock.elapsedTime * speed })
  return (
    <group ref={ref} rotation={[tilt, tilt * 0.45, 0]}>
      <mesh rotation={[Math.PI / 2, 0, 0]}>
        <torusGeometry args={[radius, 0.009, 6, 128]} />
        <meshBasicMaterial color={color} transparent opacity={0.32} />
      </mesh>
      <mesh position={[radius, 0, 0]}>
        <sphereGeometry args={[size, 16, 12]} />
        <meshBasicMaterial color={color} />
      </mesh>
    </group>
  )
}

function OrbitScene({ color, pointer }: { color: string; pointer: RefObject<THREE.Vector2> }) {
  const ref = useRef<THREE.Group>(null!)
  const haloColor = useMemo(() => new THREE.Color(color).offsetHSL(0.18, 0.06, 0.12), [color])
  useFrame(({ clock }) => {
    ref.current.rotation.y += (pointer.current.x * 0.22 + clock.elapsedTime * 0.035 - ref.current.rotation.y) * 0.025
    ref.current.rotation.x += (pointer.current.y * 0.12 - ref.current.rotation.x) * 0.025
  })
  return (
    <group ref={ref}>
      <mesh><sphereGeometry args={[0.72, 32, 24]} /><meshBasicMaterial color={color} transparent opacity={0.12} wireframe /></mesh>
      <Orbit radius={1.35} speed={0.16} tilt={0.3} color={color} size={0.075} />
      <Orbit radius={2.05} speed={-0.11} tilt={1.1} color={haloColor.getStyle()} size={0.055} />
      <Orbit radius={2.8} speed={0.075} tilt={0.7} color={color} size={0.045} />
    </group>
  )
}

function LiquidVelvet({ pointer }: { pointer: RefObject<THREE.Vector2> }) {
  const ref = useRef<THREE.Group>(null!)
  useFrame(({ clock }) => {
    ref.current.rotation.z = Math.sin(clock.elapsedTime * 0.13) * 0.08 + pointer.current.x * 0.07
    ref.current.rotation.x = pointer.current.y * 0.05
  })
  const blobs = [
    { position: [-2.1, 0.9, -1.2] as [number, number, number], scale: [3.1, 1.6, 0.18] as [number, number, number], color: '#d78bb8', opacity: 0.22 },
    { position: [1.4, -0.8, -0.7] as [number, number, number], scale: [3.4, 1.8, 0.18] as [number, number, number], color: '#978be8', opacity: 0.2 },
    { position: [0.2, 1.45, -1.8] as [number, number, number], scale: [2.8, 1.2, 0.18] as [number, number, number], color: '#efa9c5', opacity: 0.17 },
  ]
  return <group ref={ref}>{blobs.map(blob => <mesh key={blob.color} position={blob.position} scale={blob.scale}><sphereGeometry args={[1, 40, 28]} /><meshBasicMaterial color={blob.color} transparent opacity={blob.opacity} depthWrite={false} /></mesh>)}</group>
}

function PastelWaves({ pointer }: { pointer: RefObject<THREE.Vector2> }) {
  return (
    <group position={[0, -0.35, 0]}>
      <WaveField color="#f2a9cf" pointer={pointer} />
      <group position={[0, 0.12, -0.18]}><WaveField color="#b5a9fa" pointer={pointer} /></group>
      <group position={[0, 0.24, -0.36]}><WaveField color="#8fd8dc" pointer={pointer} /></group>
    </group>
  )
}

const LEAF_LAYOUT = Array.from({ length: 34 }, (_, index) => {
  const angle = index * 2.399
  const radius = 0.55 + seededUnit(index, 18) * 2.6
  return {
    position: [Math.cos(angle) * radius, Math.sin(angle) * radius * 0.72, (seededUnit(index, 21) - 0.5) * 1.2] as [number, number, number],
    rotation: [0.2 + seededUnit(index, 22) * 0.8, 0, angle] as [number, number, number],
    scale: 0.5 + seededUnit(index, 24) * 0.75,
  }
})

function BotanicalFlow({ pointer }: { pointer: RefObject<THREE.Vector2> }) {
  const ref = useRef<THREE.Group>(null!)
  useFrame(({ clock }) => {
    ref.current.rotation.z = Math.sin(clock.elapsedTime * 0.17) * 0.08 + pointer.current.x * 0.05
    ref.current.rotation.x = pointer.current.y * 0.04
  })
  return (
    <group ref={ref}>
      <mesh position={[0, 0, -0.8]}><sphereGeometry args={[0.45, 24, 16]} /><meshBasicMaterial color="#a4d7ad" transparent opacity={0.12} /></mesh>
      {LEAF_LAYOUT.map((leaf, index) => <mesh key={index} position={leaf.position} rotation={leaf.rotation} scale={[leaf.scale, leaf.scale * 0.38, 0.12]}>
        <sphereGeometry args={[0.55, 14, 10]} />
        <meshBasicMaterial color={index % 3 === 0 ? '#9dd7b0' : index % 3 === 1 ? '#c3ddb0' : '#83c7b6'} transparent opacity={0.32} depthWrite={false} />
      </mesh>)}
    </group>
  )
}

function ParticleCloud({ color, pointer, seed, count = 950 }: { color: string; pointer: RefObject<THREE.Vector2>; seed: number; count?: number }) {
  const ref = useRef<THREE.Points>(null!)
  const positions = useMemo(() => createCloudPositions(count, 11, 7, 5, seed), [count, seed])
  useFrame(({ clock }) => {
    ref.current.rotation.y = pointer.current.x * 0.2 + clock.elapsedTime * 0.018
    ref.current.rotation.x = pointer.current.y * 0.12
  })
  return <points ref={ref}><bufferGeometry><bufferAttribute attach="attributes-position" args={[positions, 3]} /></bufferGeometry><pointsMaterial color={color} size={0.05} sizeAttenuation transparent opacity={0.72} depthWrite={false} /></points>
}

function RoseNebula({ pointer }: { pointer: RefObject<THREE.Vector2> }) {
  return <group><ParticleCloud color="#f39ac6" pointer={pointer} seed={27} /><group position={[0.45, 0.15, -0.35]}><ParticleCloud color="#a897eb" pointer={pointer} seed={39} count={720} /></group><mesh><sphereGeometry args={[0.55, 24, 18]} /><meshBasicMaterial color="#efa0d0" transparent opacity={0.11} wireframe /></mesh></group>
}

function MoonlitBloom({ pointer }: { pointer: RefObject<THREE.Vector2> }) {
  const ref = useRef<THREE.Group>(null!)
  useFrame(({ clock }) => { ref.current.rotation.y = clock.elapsedTime * 0.035 + pointer.current.x * 0.16; ref.current.rotation.x = pointer.current.y * 0.1 })
  return (
    <group ref={ref}>
      <mesh><sphereGeometry args={[0.55, 32, 24]} /><meshBasicMaterial color="#f5e6c8" transparent opacity={0.56} /></mesh>
      <mesh scale={[0.58, 0.58, 0.58]} position={[0.28, 0.16, 0.15]}><sphereGeometry args={[0.55, 24, 18]} /><meshBasicMaterial color="#11162b" /></mesh>
      <Orbit radius={1.25} speed={0.1} tilt={0.5} color="#d8b7ff" size={0.06} />
      <Orbit radius={1.9} speed={-0.06} tilt={1.25} color="#f5c9df" size={0.05} />
      {[0, 1, 2, 3, 4, 5].map(index => <mesh key={index} position={[Math.cos(index * Math.PI / 3) * 2.45, Math.sin(index * Math.PI / 3) * 1.65, -0.1]} scale={[0.08, 0.08, 0.08]}><sphereGeometry args={[1, 12, 8]} /><meshBasicMaterial color={index % 2 ? '#f2bfdc' : '#d9ccff'} /></mesh>)}
    </group>
  )
}

function CyberGrid({ pointer }: { pointer: RefObject<THREE.Vector2> }) {
  const ref = useRef<THREE.Group>(null!)
  useFrame(({ clock }) => { ref.current.rotation.z = Math.sin(clock.elapsedTime * 0.12) * 0.025 + pointer.current.x * 0.035; ref.current.position.y = pointer.current.y * 0.16 })
  return (
    <group ref={ref}>
      <gridHelper args={[17, 36, '#21d4cf', '#155465']} rotation={[Math.PI / 2, 0, 0]} position={[0, 0, -1.2]} />
      <gridHelper args={[12, 24, '#185d81', '#123048']} rotation={[Math.PI / 2, 0, 0]} position={[0, 0, -1.18]} />
      <mesh position={[0, 0, -1.1]}><planeGeometry args={[15, 10]} /><meshBasicMaterial color="#062332" transparent opacity={0.14} depthWrite={false} /></mesh>
    </group>
  )
}

const CUBE_LAYOUT = Array.from({ length: 42 }, (_, index) => ({
  position: [((index % 7) - 3) * 1.15, (Math.floor(index / 7) - 2.5) * 0.88, (seededUnit(index, 44) - 0.5) * 2] as [number, number, number],
  size: 0.12 + seededUnit(index, 45) * 0.22,
  color: index % 3 === 0 ? '#5de5ae' : index % 3 === 1 ? '#43a7ca' : '#a1e56a',
}))

function GeometricMatrix({ pointer }: { pointer: RefObject<THREE.Vector2> }) {
  const ref = useRef<THREE.Group>(null!)
  useFrame(({ clock }) => { ref.current.rotation.y = Math.sin(clock.elapsedTime * 0.15) * 0.08 + pointer.current.x * 0.12; ref.current.rotation.x = pointer.current.y * 0.08 })
  return <group ref={ref}>{CUBE_LAYOUT.map((cube, index) => <mesh key={index} position={cube.position} rotation={[index * 0.05, index * 0.09, index * 0.03]}><boxGeometry args={[cube.size, cube.size, cube.size]} /><meshBasicMaterial color={cube.color} wireframe transparent opacity={0.58} /></mesh>)}</group>
}

function PulseRing({ index, color, pointer }: { index: number; color: string; pointer: RefObject<THREE.Vector2> }) {
  const ref = useRef<THREE.Mesh>(null!)
  useFrame(({ clock }) => {
    const pulse = 1 + Math.sin(clock.elapsedTime * 0.8 + index * 1.1) * 0.055
    ref.current.scale.setScalar(pulse)
    ref.current.rotation.x = Math.PI / 2 + pointer.current.y * 0.08
    ref.current.rotation.y = clock.elapsedTime * (index % 2 ? -0.08 : 0.08) + pointer.current.x * 0.12
  })
  const radius = 0.7 + index * 0.62
  return <mesh ref={ref}><torusGeometry args={[radius, 0.012, 8, 128]} /><meshBasicMaterial color={color} transparent opacity={0.28 + (index % 2) * 0.08} /></mesh>
}

function TechPulse({ pointer }: { pointer: RefObject<THREE.Vector2> }) {
  const ref = useRef<THREE.Group>(null!)
  useFrame(({ clock }) => { ref.current.rotation.z = clock.elapsedTime * 0.025 + pointer.current.x * 0.045; ref.current.position.y = pointer.current.y * 0.12 })
  return <group ref={ref}><mesh><sphereGeometry args={[0.34, 24, 18]} /><meshBasicMaterial color="#ffba68" transparent opacity={0.24} wireframe /></mesh>{[0, 1, 2, 3].map(index => <PulseRing key={index} index={index} color={index % 2 ? '#ff8d45' : '#f3c45e'} pointer={pointer} />)}</group>
}

function NovaDrive({ pointer }: { pointer: RefObject<THREE.Vector2> }) {
  const ref = useRef<THREE.Group>(null!)
  useFrame(({ clock }) => { ref.current.rotation.y = clock.elapsedTime * 0.025 + pointer.current.x * 0.13; ref.current.rotation.x = pointer.current.y * 0.08 })
  return <group ref={ref}><mesh><sphereGeometry args={[0.55, 32, 24]} /><meshBasicMaterial color="#ff865e" transparent opacity={0.24} wireframe /></mesh><mesh><sphereGeometry args={[0.24, 20, 16]} /><meshBasicMaterial color="#ffd2a8" transparent opacity={0.25} /></mesh><Orbit radius={1.1} speed={0.19} tilt={0.25} color="#ff8a57" size={0.07} /><Orbit radius={1.7} speed={-0.14} tilt={1.05} color="#ffc66e" size={0.055} /><Orbit radius={2.5} speed={0.09} tilt={0.65} color="#d5a4ff" size={0.045} /><ParticleCloud color="#ffab68" pointer={pointer} seed={71} count={520} /></group>
}

function StarForge({ pointer }: { pointer: RefObject<THREE.Vector2> }) {
  const ref = useRef<THREE.Group>(null!)
  useFrame(({ clock }) => { ref.current.rotation.y = clock.elapsedTime * 0.035 + pointer.current.x * 0.15; ref.current.rotation.x = clock.elapsedTime * 0.018 + pointer.current.y * 0.09 })
  return <group ref={ref}><mesh><icosahedronGeometry args={[1.05, 1]} /><meshBasicMaterial color="#90c6ff" wireframe transparent opacity={0.36} /></mesh><mesh><octahedronGeometry args={[0.62, 0]} /><meshBasicMaterial color="#a8e7ff" wireframe transparent opacity={0.28} /></mesh><ParticleCloud color="#8ebcff" pointer={pointer} seed={84} count={620} /><Orbit radius={2.25} speed={0.07} tilt={1.15} color="#d0aaff" size={0.05} /></group>
}

export default function SpaceBackground({ color, theme, animationMode }: { color: string; theme: AnimatedThemeId; animationMode: AnimationMode }) {
  const pointer = usePointerTarget()
  let scene
  switch (theme) {
    case 'wave-field': scene = <WaveField color={color} pointer={pointer} />; break
    case 'orbit-drift': scene = <OrbitScene color={color} pointer={pointer} />; break
    case 'liquid-velvet': scene = <LiquidVelvet pointer={pointer} />; break
    case 'pastel-waves': scene = <PastelWaves pointer={pointer} />; break
    case 'botanical-flow': scene = <BotanicalFlow pointer={pointer} />; break
    case 'rose-nebula': scene = <RoseNebula pointer={pointer} />; break
    case 'moonlit-bloom': scene = <MoonlitBloom pointer={pointer} />; break
    case 'cyber-grid': scene = <CyberGrid pointer={pointer} />; break
    case 'geometric-matrix': scene = <GeometricMatrix pointer={pointer} />; break
    case 'tech-pulse': scene = <TechPulse pointer={pointer} />; break
    case 'nova-drive': scene = <NovaDrive pointer={pointer} />; break
    case 'star-forge': scene = <StarForge pointer={pointer} />; break
    default: scene = <Stars color={color} pointer={pointer} />
  }

  return (
    <div className="pointer-events-none fixed inset-0 -z-10" aria-hidden="true">
      <Canvas dpr={[1, 1.35]} camera={{ position: [0, 0, 6], fov: 60 }} gl={{ alpha: true, antialias: false, powerPreference: 'low-power' }}>
        <MotionDriver mode={animationMode} pointer={pointer} />
        {scene}
      </Canvas>
    </div>
  )
}
