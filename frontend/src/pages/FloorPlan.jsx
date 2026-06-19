import { useState, useEffect, useRef, useCallback, Suspense, useMemo } from 'react'
import { Canvas, useThree, useFrame, useLoader } from '@react-three/fiber'
import { OrbitControls, RoundedBox, Plane, Html, Text, Line, Environment, ContactShadows, SoftShadows, useTexture, useGLTF } from '@react-three/drei'
import { EffectComposer, SSAO, Bloom, ToneMapping, N8AO } from '@react-three/postprocessing'
import { BlendFunction } from 'postprocessing'
import * as THREE from 'three'
import { Box, Sofa, Armchair, Monitor, Refrigerator, WashingMachine, Wind, CookingPot, Sparkles, Bath, Toilet, DoorClosed, Flower2, Lamp, Footprints, PaintBucket } from 'lucide-react'

// ═══════════════════════ CUSTOM ICONS ═══════════════════════
function BedIcon() { return <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><path d="M2 4v16"/><path d="M2 8h18a2 2 0 0 1 2 2v10"/><path d="M2 17h20"/><path d="M6 8v9"/></svg> }
function TableIcon() { return <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><path d="M12 3v18"/><rect x="2" y="3" width="20" height="4" rx="1"/><rect x="4" y="14" width="16" height="4" rx="1"/></svg> }

// ═══════════════════════ ICONS ═══════════════════════
const ICON_MAP = {
  '沙发': Sofa, '床': BedIcon, '餐桌': TableIcon, '椅子': Armchair,
  '茶几': TableIcon, '书桌': TableIcon, '衣柜': DoorClosed,
  '冰箱': Refrigerator, '洗衣机': WashingMachine, '电视': Monitor,
  '空调': Wind, '烤箱': CookingPot, '洗碗机': Sparkles,
  '浴缸': Bath, '马桶': Toilet, '淋浴房': Bath,
  '橱柜': DoorClosed, '植物': Flower2, '地毯': Footprints, '灯': Lamp,
}

function FurnitureIcon({ type, size = 20 }) { const I = ICON_MAP[type] || Box; return <I size={size} /> }

const FURNITURE_CATEGORIES = [
  { name: '客餐厅', items: ['沙发', '茶几', '餐桌', '椅子', '电视', '空调', '地毯', '灯', '植物'] },
  { name: '卧室', items: ['床', '衣柜', '书桌', '椅子', '灯', '植物'] },
  { name: '厨房', items: ['冰箱', '烤箱', '洗碗机', '橱柜'] },
  { name: '卫生间', items: ['马桶', '浴缸', '淋浴房', '洗衣机'] },
  { name: '其他', items: ['灯', '植物', '地毯'] },
]

const FLOORS = ['1F', '2F', '3F', 'B1', 'B2']
const FLOOR_LABELS = { '1F': '一层', '2F': '二层', '3F': '三层', 'B1': '地下一层', 'B2': '地下二层' }

// ═══════════════════════ ROOM LAYOUTS (3D wall definitions) ═══════════════════════
// Each floor has rooms defined as { name, x, z, w, d, floorColor, wallColor }
// x,z = top-left corner; w,d = width/depth in meters
// Walls are generated automatically around each room

const FLOOR_CONFIGS = {
  width: 12,
  depth: 10,
  wallHeight: 2.8,
  wallThickness: 0.15,
}

const ROOM_LAYOUTS = {
  '1F': [
    // 玄关 (entry)
    { name: '玄关', x: 0, z: 0, w: 3, d: 3, floorColor: '#d4c5a9', wallColor: '#f5f0e8', noLeftWall: true },
    // 公卫 (guest bath)
    { name: '公卫', x: 3, z: 0, w: 2.5, d: 3, floorColor: '#e8e0d8', wallColor: '#f0ece6' },
    // 厨房 (kitchen)
    { name: '厨房', x: 5.5, z: 0, w: 3.5, d: 3, floorColor: '#e0d8d0', wallColor: '#f5f0e8', noRightWall: true },
    // 客餐厅 (living/dining) - open plan
    { name: '客餐厅', x: 0, z: 3, w: 9, d: 7, floorColor: '#c8b896', wallColor: '#f5f0e8', noTopWall: true },
  ],
  '2F': [
    { name: '次卧1', x: 0, z: 0, w: 4, d: 5, floorColor: '#d4c5a9', wallColor: '#f5f0e8', noRightWall: true },
    { name: '次卫', x: 4, z: 0, w: 2.5, d: 5, floorColor: '#e8e0d8', wallColor: '#f0ece6' },
    { name: '次卧2', x: 6.5, z: 0, w: 5.5, d: 5, floorColor: '#d4c5a9', wallColor: '#f5f0e8', noLeftWall: true },
    { name: '露台', x: 0, z: 5, w: 11, d: 5, floorColor: '#b8b8a8', wallColor: '#e8e4e0', noTopWall: true },
  ],
  '3F': [
    { name: '主卫', x: 0, z: 0, w: 3, d: 3, floorColor: '#e8e0d8', wallColor: '#f0ece6' },
    { name: '衣帽间', x: 0, z: 3, w: 3, d: 3, floorColor: '#d8d0c0', wallColor: '#f0ece6' },
    { name: '洗衣区', x: 0, z: 6, w: 3, d: 3, floorColor: '#e0d8d0', wallColor: '#f0ece6' },
    { name: '主卧套房', x: 3, z: 0, w: 9, d: 9, floorColor: '#c8b896', wallColor: '#f5f0e8' },
  ],
  'B1': [
    { name: '电梯厅', x: 0, z: 0, w: 3, d: 3, floorColor: '#d4c5a9', wallColor: '#e8e4e0' },
    { name: '吧台区', x: 0, z: 3, w: 3, d: 3, floorColor: '#c0b090', wallColor: '#e8e4e0' },
    { name: '茶室', x: 3, z: 0, w: 4.5, d: 5, floorColor: '#c8b896', wallColor: '#e8e4e0' },
    { name: '休闲区', x: 7.5, z: 0, w: 4.5, d: 6, floorColor: '#d0c0a0', wallColor: '#e8e4e0', noRightWall: true },
  ],
  'B2': [
    { name: '储物间', x: 0, z: 0, w: 4, d: 5, floorColor: '#c0b0a0', wallColor: '#e0dcd8' },
    { name: '设备间', x: 4, z: 0, w: 3, d: 5, floorColor: '#c0b0a0', wallColor: '#e0dcd8' },
    { name: '多功能区', x: 7, z: 0, w: 5, d: 8, floorColor: '#c8b8a8', wallColor: '#e0dcd8', noRightWall: true },
    { name: '通道/楼梯', x: 0, z: 5, w: 7, d: 3, floorColor: '#b0a090', wallColor: '#e0dcd8' },
  ],
}

// ═══════════════════════ 3D WALL SYSTEM ═══════════════════════
function WallSegment({ position, size, color, hasWindow, hasDoor, windowOffset }) {
  const [w, h, d] = size
  const [px, py, pz] = position

  if (hasDoor) {
    // Wall with door cutout: two wall segments (left + right of door, + top header)
    const doorW = 1.0
    const doorH = 2.2
    const leftW = (w - doorW) / 2
    const rightW = (w - doorW) / 2
    const headerH = h - doorH

    // Determine which axis the wall runs along
    const isXWall = d < 0.3

    return (
      <group>
        {/* Left pillar */}
        <mesh position={isXWall ? [px - rightW / 2 - doorW / 2, py, pz] : [px, py, pz - rightW / 2 - doorW / 2]} castShadow receiveShadow>
          <boxGeometry args={isXWall ? [leftW, h, d] : [w, h, leftW]} />
          <meshPhysicalMaterial color={color} roughness={0.55} metalness={0.02} />
        </mesh>
        {/* Right pillar */}
        <mesh position={isXWall ? [px + leftW / 2 + doorW / 2, py, pz] : [px, py, pz + leftW / 2 + doorW / 2]} castShadow receiveShadow>
          <boxGeometry args={isXWall ? [rightW, h, d] : [w, h, rightW]} />
          <meshPhysicalMaterial color={color} roughness={0.55} metalness={0.02} />
        </mesh>
        {/* Header above door */}
        <mesh position={isXWall ? [px, h - headerH / 2, pz] : [px, h - headerH / 2, pz]} castShadow receiveShadow>
          <boxGeometry args={isXWall ? [w, headerH, d] : [w, headerH, d]} />
          <meshPhysicalMaterial color={color} roughness={0.55} metalness={0.02} />
        </mesh>
        {/* Door */}
        <mesh position={isXWall ? [px, doorH / 2, pz] : [px, doorH / 2, pz]} castShadow>
          <boxGeometry args={isXWall ? [doorW - 0.1, doorH - 0.02, d * 0.6] : [w * 0.15, doorH - 0.02, doorW - 0.1]} />
          <meshPhysicalMaterial color="#8B6B4A" roughness={0.3} metalness={0.05} />
        </mesh>
      </group>
    )
  }

  if (hasWindow && windowOffset !== undefined) {
    const winW = 1.4
    const winH = 1.2
    const winBottom = 1.0
    const isXWall = d < 0.3

    // Wall below window
    const belowH = winBottom
    return (
      <group>
        <mesh position={isXWall ? [px, belowH / 2, pz] : [px, belowH / 2, pz]} castShadow receiveShadow>
          <boxGeometry args={isXWall ? [w, belowH, d] : [w, belowH, d]} />
          <meshPhysicalMaterial color={color} roughness={0.55} metalness={0.02} />
        </mesh>
        {/* Window cutout area: left + right pillars + top */}
        {isXWall ? (
          <>
            {/* Left of window */}
            <mesh position={[px - winW / 2 - (w - winW) / 4, winBottom + winH / 2, pz]} castShadow receiveShadow>
              <boxGeometry args={[(w - winW) / 2, winH, d]} />
              <meshPhysicalMaterial color={color} roughness={0.55} metalness={0.02} />
            </mesh>
            {/* Right of window */}
            <mesh position={[px + winW / 2 + (w - winW) / 4, winBottom + winH / 2, pz]} castShadow receiveShadow>
              <boxGeometry args={[(w - winW) / 2, winH, d]} />
              <meshPhysicalMaterial color={color} roughness={0.55} metalness={0.02} />
            </mesh>
            {/* Above window */}
            <mesh position={[px, winBottom + winH + (h - winBottom - winH) / 2, pz]} castShadow receiveShadow>
              <boxGeometry args={[w, h - winBottom - winH, d]} />
              <meshPhysicalMaterial color={color} roughness={0.55} metalness={0.02} />
            </mesh>
            {/* Glass */}
            <mesh position={[px, winBottom + winH / 2, pz]}>
              <boxGeometry args={[winW - 0.05, winH - 0.05, 0.03]} />
              <meshPhysicalMaterial color="#b8d8f0" roughness={0.05} metalness={0.1} transparent opacity={0.4} />
            </mesh>
          </>
        ) : (
          <>
            <mesh position={[px, winBottom + winH / 2, pz - winW / 2 - (d - winW) / 4]} castShadow receiveShadow>
              <boxGeometry args={[w, winH, (d - winW) / 2]} />
              <meshPhysicalMaterial color={color} roughness={0.55} metalness={0.02} />
            </mesh>
            <mesh position={[px, winBottom + winH / 2, pz + winW / 2 + (d - winW) / 4]} castShadow receiveShadow>
              <boxGeometry args={[w, winH, (d - winW) / 2]} />
              <meshPhysicalMaterial color={color} roughness={0.55} metalness={0.02} />
            </mesh>
            <mesh position={[px, winBottom + winH + (h - winBottom - winH) / 2, pz]} castShadow receiveShadow>
              <boxGeometry args={[w, h - winBottom - winH, d]} />
              <meshPhysicalMaterial color={color} roughness={0.55} metalness={0.02} />
            </mesh>
            <mesh position={[px, winBottom + winH / 2, pz]}>
              <boxGeometry args={[0.03, winH - 0.05, winW - 0.05]} />
              <meshPhysicalMaterial color="#b8d8f0" roughness={0.05} metalness={0.1} transparent opacity={0.4} />
            </mesh>
          </>
        )}
      </group>
    )
  }

  return (
    <mesh position={position} castShadow receiveShadow>
      <boxGeometry args={size} />
      <meshPhysicalMaterial color={color} roughness={0.55} metalness={0.02} />
    </mesh>
  )
}

function Room({ room, floorIdx }) {
  const { x, z, w, d, name, floorColor, wallColor, noLeftWall, noRightWall, noTopWall, noBottomWall } = room
  const wh = FLOOR_CONFIGS.wallHeight
  const wt = FLOOR_CONFIGS.wallThickness
  const isBath = name.includes('卫') || name.includes('浴')
  const isKitchen = name.includes('厨房')
  const isBedroom = name.includes('卧')
  const hasDoor = name !== '露台' && name !== '客餐厅' && name !== '休闲区'

  return (
    <group>
      {/* Floor */}
      <Plane args={[w, d]} rotation={[-Math.PI / 2, 0, 0]} position={[x + w / 2, 0.001, z + d / 2]} receiveShadow>
        {isBath || isKitchen ? (
          <meshPhysicalMaterial color={floorColor} roughness={0.25} metalness={0.05} />
        ) : (
          <meshPhysicalMaterial color={floorColor} roughness={0.45} metalness={0.02} />
        )}
      </Plane>

      {/* Tile grid lines for kitchen/bath */}
      {(isBath || isKitchen) && (
        <Plane args={[w, d]} rotation={[-Math.PI / 2, 0, 0]} position={[x + w / 2, 0.002, z + d / 2]}>
          <meshBasicMaterial color="#000000" transparent opacity={0.06} wireframe />
        </Plane>
      )}

      {/* Left wall */}
      {!noLeftWall && (
        <WallSegment
          position={[x, wh / 2, z + d / 2]}
          size={[wt, wh, d]}
          color={wallColor}
          hasDoor={false}
          hasWindow={(name === '主卧套房' || name === '次卧1' || name === '次卧2') && floorIdx === 0}
          windowOffset={0}
        />
      )}

      {/* Right wall */}
      {!noRightWall && (
        <WallSegment
          position={[x + w, wh / 2, z + d / 2]}
          size={[wt, wh, d]}
          color={wallColor}
          hasDoor={false}
          hasWindow={name === '客餐厅'}
          windowOffset={0}
        />
      )}

      {/* Top wall (back wall, often has window) */}
      {!noTopWall && (
        <WallSegment
          position={[x + w / 2, wh / 2, z]}
          size={[w, wh, wt]}
          color={wallColor}
          hasDoor={hasDoor}
          hasWindow={!hasDoor && isBedroom}
          windowOffset={0}
        />
      )}

      {/* Bottom wall (front) */}
      {!noBottomWall && (
        <WallSegment
          position={[x + w / 2, wh / 2, z + d]}
          size={[w, wh, wt]}
          color={wallColor}
          hasDoor={false}
          hasWindow={false}
          windowOffset={0}
        />
      )}

      {/* Baseboards */}
      {!noLeftWall && (
        <mesh position={[x + wt / 2, 0.05, z + d / 2]} receiveShadow>
          <boxGeometry args={[wt + 0.03, 0.1, d]} />
          <meshPhysicalMaterial color="#f0ebe4" roughness={0.4} metalness={0.02} />
        </mesh>
      )}
      {!noRightWall && (
        <mesh position={[x + w - wt / 2, 0.05, z + d / 2]} receiveShadow>
          <boxGeometry args={[wt + 0.03, 0.1, d]} />
          <meshPhysicalMaterial color="#f0ebe4" roughness={0.4} metalness={0.02} />
        </mesh>
      )}

      {/* Room label — floating slightly above floor */}
      <Text
        position={[x + w / 2, 0.02, z + d / 2]}
        rotation={[-Math.PI / 2, 0, 0]}
        fontSize={0.28}
        color={isBath || isKitchen ? '#aaaaaa' : '#b0b0a8'}
        anchorX="center"
        anchorY="middle"
        outlineWidth={0.02}
        outlineColor="#00000010"
      >
        {name}
      </Text>
    </group>
  )
}

function Floor3D({ floor }) {
  const rooms = ROOM_LAYOUTS[floor] || ROOM_LAYOUTS['1F']

  return (
    <group>
      {/* Base ground */}
      <Plane args={[15, 13]} rotation={[-Math.PI / 2, 0, 0]} position={[6, -0.01, 5]} receiveShadow>
        <meshPhysicalMaterial color="#d0ccc8" roughness={0.8} metalness={0} />
      </Plane>

      {/* Grid pattern on ground */}
      <gridHelper args={[16, 16, '#c8c4c0', '#c8c4c0']} position={[6, 0.002, 5]} />

      {/* Rooms with 3D walls */}
      {rooms.map((room, i) => (
        <Room key={i} room={room} floorIdx={i} />
      ))}
    </group>
  )
}

// ═══════════════════════ FURNITURE 3D MODEL ═══════════════════════
function FurnitureModel({ item, isSelected, onSelect, onDragEnd, color, width, depth, height }) {
  const groupRef = useRef()
  const [isDragging, setIsDragging] = useState(false)
  const dragStart = useRef(null)
  const clickTimer = useRef(null)
  const clickCount = useRef(0)

  const type = item.furniture_type
  const w = width || 1
  const d = depth || 1
  const h = height || 0.8

  const handlePointerDown = useCallback((e) => {
    e.stopPropagation()
    // Track double-click
    clickCount.current += 1
    if (clickTimer.current) clearTimeout(clickTimer.current)
    clickTimer.current = setTimeout(() => { clickCount.current = 0 }, 350)

    if (clickCount.current >= 2) {
      // Double-click: select and highlight
      clickCount.current = 0
      onSelect(item)
      setIsDragging(false)
      return
    }

    // Single click: select first, then prepare for drag if already selected
    onSelect(item)

    if (isSelected) {
      // Already selected — enter drag mode
      setIsDragging(true)
      dragStart.current = {
        x: e.point.x,
        z: e.point.z,
        posX: item.pos_x,
        posZ: item.pos_z,
      }
    } else {
      setIsDragging(false)
    }
  }, [item, isSelected, onSelect])

  const handlePointerUp = useCallback((e) => {
    if (isDragging && dragStart.current) {
      e.stopPropagation()
      const dx = e.point.x - dragStart.current.x
      const dz = e.point.z - dragStart.current.z
      const newX = Math.max(0.5, Math.min(FLOOR_CONFIGS.width - 0.5, dragStart.current.posX + dx))
      const newZ = Math.max(0.5, Math.min(FLOOR_CONFIGS.depth - 0.5, dragStart.current.posZ + dz))
      onDragEnd(item.id, newX, newZ)
    }
    setIsDragging(false)
    dragStart.current = null
  }, [item, onDragEnd, isDragging])

  const isGlass = type === '淋浴房'
  const isRug = type === '地毯'

  return (
    <group
      ref={groupRef}
      position={[item.pos_x, item.pos_y || h / 2, item.pos_z]}
      rotation={[0, item.rot_y || 0, 0]}
      onPointerDown={handlePointerDown}
      onPointerUp={handlePointerUp}
    >
      {/* Invisible click target covering the whole furniture */}
      <mesh visible={false} position={[0, h / 2, 0]}>
        <boxGeometry args={[w + 0.4, h + 0.2, d + 0.4]} />
      </mesh>

      {/* Selection highlight */}
      {isSelected && (
        <mesh position={[0, h / 2, 0]} renderOrder={1}>
          <boxGeometry args={[w + 0.15, h + 0.1, d + 0.15]} />
          <meshBasicMaterial color="#6366f1" transparent opacity={0.15} wireframe depthTest={false} />
        </mesh>
      )}

      {/* Furniture body */}
      {isRug ? (
        <Plane args={[w, d]} rotation={[-Math.PI / 2, 0, 0]} position={[0, 0.011, 0]}>
          <meshStandardMaterial color={color || '#BE8575'} transparent opacity={0.85} />
        </Plane>
      ) : isGlass ? (
        <mesh position={[0, h / 2, 0]}>
          <boxGeometry args={[w, h, d]} />
          <meshStandardMaterial color={color || 'rgba(200,220,240,0.3)'} transparent opacity={0.25} />
        </mesh>
      ) : type === '椅子' ? (
        <ChairModel w={w} d={d} h={h} color={color} />
      ) : type === '餐桌' || type === '茶几' || type === '书桌' ? (
        <TableModel w={w} d={d} h={h} color={color} />
      ) : type === '床' ? (
        <BedModel w={w} d={d} h={h} color={color} />
      ) : type === '植物' ? (
        <PlantModel w={w} h={h} color={color} />
      ) : type === '灯' ? (
        <LampModel w={w} h={h} color={color} />
      ) : (
        <RoundedBox args={[w, h, d]} radius={0.03} castShadow>
          <meshPhysicalMaterial color={color || '#8B7355'} roughness={0.35} metalness={0.03} />
        </RoundedBox>
      )}

      {/* Label */}
      {isSelected && (
        <Html position={[0, h + 0.4, 0]} center>
          <div className="bg-indigo-600 text-white text-xs px-2 py-0.5 rounded whitespace-nowrap shadow-lg pointer-events-none">
            {item.label || item.furniture_type}
          </div>
        </Html>
      )}
    </group>
  )
}

// Sub-models (all use meshPhysicalMaterial for PBR quality)
function ChairModel({ w, d, h, color }) {
  return (
    <group>
      <mesh position={[0, h * 0.55, 0]} castShadow>
        <boxGeometry args={[w, 0.06, d]} />
        <meshPhysicalMaterial color={color || '#8B7355'} roughness={0.35} metalness={0.02} />
      </mesh>
      <mesh position={[0, h * 0.75, -d / 2 + 0.05]} castShadow>
        <boxGeometry args={[w, h * 0.5, 0.04]} />
        <meshPhysicalMaterial color={color || '#8B7355'} roughness={0.35} metalness={0.02} />
      </mesh>
      {[[-w / 2 + 0.1, 0.2, -d / 2 + 0.1], [w / 2 - 0.1, 0.2, -d / 2 + 0.1],
        [-w / 2 + 0.1, 0.2, d / 2 - 0.1], [w / 2 - 0.1, 0.2, d / 2 - 0.1]].map((p, i) => (
        <mesh key={i} position={p} castShadow>
          <cylinderGeometry args={[0.03, 0.03, 0.4, 8]} />
          <meshPhysicalMaterial color="#4a3728" roughness={0.25} metalness={0.3} />
        </mesh>
      ))}
    </group>
  )
}

function TableModel({ w, d, h, color }) {
  return (
    <group>
      <RoundedBox args={[w, 0.06, d]} radius={0.02} position={[0, h - 0.03, 0]} castShadow>
        <meshPhysicalMaterial color={color || '#8B7355'} roughness={0.28} metalness={0.03} />
      </RoundedBox>
      {[[-w / 2 + 0.15, h / 2 - 0.05, -d / 2 + 0.15], [w / 2 - 0.15, h / 2 - 0.05, -d / 2 + 0.15],
        [-w / 2 + 0.15, h / 2 - 0.05, d / 2 - 0.15], [w / 2 - 0.15, h / 2 - 0.05, d / 2 - 0.15]].map((p, i) => (
        <mesh key={i} position={p} castShadow>
          <cylinderGeometry args={[0.04, 0.04, h - 0.06, 8]} />
          <meshPhysicalMaterial color="#4a3728" roughness={0.25} metalness={0.3} />
        </mesh>
      ))}
    </group>
  )
}

function BedModel({ w, d, h, color }) {
  return (
    <group>
      <RoundedBox args={[w, h, d]} radius={0.04} position={[0, h / 2, 0]} castShadow>
        <meshPhysicalMaterial color={color || '#8B7355'} roughness={0.4} metalness={0.02} />
      </RoundedBox>
      <mesh position={[0, h * 0.85, -d / 2 + 0.08]} castShadow>
        <boxGeometry args={[w, h * 0.5, 0.08]} />
        <meshPhysicalMaterial color={color || '#8B7355'} roughness={0.3} metalness={0.02} />
      </mesh>
      <RoundedBox args={[w - 0.15, 0.15, d - 0.3]} radius={0.02} position={[0, h + 0.02, 0.05]} castShadow>
        <meshPhysicalMaterial color="#F5F5F0" roughness={0.6} metalness={0} />
      </RoundedBox>
    </group>
  )
}

function PlantModel({ w, h, color }) {
  return (
    <group>
      <mesh position={[0, 0.15, 0]} castShadow>
        <cylinderGeometry args={[w * 0.4, w * 0.5, 0.3, 16]} />
        <meshPhysicalMaterial color="#8B4513" roughness={0.6} metalness={0} />
      </mesh>
      <mesh position={[0, 0.15 + h / 2, 0]} castShadow>
        <sphereGeometry args={[w * 0.9, 8, 6, 0, Math.PI * 2, 0, Math.PI / 2]} />
        <meshPhysicalMaterial color={color || '#2D5A27'} roughness={0.7} metalness={0} />
      </mesh>
    </group>
  )
}

function LampModel({ w, h, color }) {
  return (
    <group>
      <mesh position={[0, 0.1, 0]} castShadow>
        <cylinderGeometry args={[0.05, 0.08, 0.2, 12]} />
        <meshPhysicalMaterial color="#4A4A4A" roughness={0.2} metalness={0.6} />
      </mesh>
      <mesh position={[0, 0.2, 0]} castShadow>
        <cylinderGeometry args={[0.02, 0.02, h - 0.3, 8]} />
        <meshPhysicalMaterial color="#4A4A4A" roughness={0.2} metalness={0.6} />
      </mesh>
      <mesh position={[0, h - 0.1, 0]}>
        <sphereGeometry args={[w * 0.5, 16, 8]} />
        <meshPhysicalMaterial color={color || '#FFE4B5'} roughness={0.1} metalness={0} emissive={color || '#FFE4B5'} emissiveIntensity={0.6} />
      </mesh>
    </group>
  )
}

// ═══════════════════════ BLENDER + FURNITURE SCENE ═══════════════════════
function BlenderScene({ furniture, selectedId, onSelect, onDragEnd, presets }) {
  const gltf = useGLTF('/models/villa_1F.glb')
  const { camera } = useThree()

  useEffect(() => {
    camera.position.set(6, 10, 12)
    camera.lookAt(0, 0, 0)
  }, [camera])

  return (
    <group>
      {/* Lighting */}
      <ambientLight intensity={0.45} color="#fff5eb" />
      <directionalLight
        position={[8, 15, 3]}
        intensity={0.9}
        color="#fff8f0"
        castShadow
        shadow-mapSize-width={2048}
        shadow-mapSize-height={2048}
        shadow-camera-far={40}
        shadow-camera-left={-15}
        shadow-camera-right={15}
        shadow-camera-top={15}
        shadow-camera-bottom={-15}
        shadow-bias={-0.0001}
      />
      <directionalLight position={[-3, 6, 12]} intensity={0.25} color="#d0e0ff" />
      <hemisphereLight args={['#d4e0ff', '#c8b898', 0.25]} />

      {/* Blender GLB building shell */}
      <primitive object={gltf.scene} position={[0, 0, 0]} scale={1} />

      {/* Furniture layer */}
      {furniture.map((item) => {
        const preset = presets[item.furniture_type]
        const color = preset?.colors?.[item.style] || preset?.colors?.default || '#8B7355'
        const w = item.custom_width || 1
        const d = item.custom_depth || 1
        const h = item.custom_height || 0.8

        return (
          <FurnitureModel
            key={item.id}
            item={item}
            isSelected={selectedId === item.id}
            onSelect={onSelect}
            onDragEnd={onDragEnd}
            color={color}
            width={w}
            depth={d}
            height={h}
          />
        )
      })}

      <OrbitControls
        makeDefault
        maxPolarAngle={Math.PI / 2.1}
        minDistance={3}
        maxDistance={30}
        target={[0, 0, 1.5]}
        enableDamping
        dampingFactor={0.15}
      />
    </group>
  )
}

// ═══════════════════════ API ═══════════════════════
async function apiFetch(path, options = {}) {
  const res = await fetch(`/api${path}`, {
    headers: { 'Content-Type': 'application/json', ...options.headers },
    ...options,
  })
  if (!res.ok) throw new Error(`API Error: ${res.status}`)
  return res.json()
}

// ═══════════════════════ MAIN PAGE ═══════════════════════
export default function FloorPlanPage() {
  const [floor, setFloor] = useState('1F')
  const [presets, setPresets] = useState({})
  const [furniture, setFurniture] = useState([])
  const [selectedId, setSelectedId] = useState(null)
  const [expandedCategory, setExpandedCategory] = useState('客餐厅')
  const [loading, setLoading] = useState(true)

  useEffect(() => {
    apiFetch('/floorplan/presets').then(setPresets).catch(console.error)
  }, [])

  const loadFloor = useCallback(async (f) => {
    setLoading(true)
    try {
      const items = await apiFetch(`/floorplan/furniture/${f}`)
      setFurniture(items)
      setSelectedId(null)
    } catch (e) { console.error(e) }
    finally { setLoading(false) }
  }, [])

  useEffect(() => { loadFloor(floor) }, [floor, loadFloor])

  const handleSelect = useCallback((item) => {
    setSelectedId(item?.id || null)
  }, [])

  const handleDragEnd = useCallback(async (id, x, z) => {
    try {
      await fetch(`/api/floorplan/furniture/${id}`, {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ pos_x: x, pos_z: z }),
      })
      setFurniture(prev => prev.map(f => f.id === id ? { ...f, pos_x: x, pos_z: z } : f))
    } catch (e) { console.error(e) }
  }, [])

  const handleAddFurniture = useCallback(async (type) => {
    const preset = presets[type]
    if (!preset) return
    const sizeNames = Object.keys(preset.sizes)
    const defaultSize = sizeNames[0]
    const [w, d, h] = preset.sizes[defaultSize]

    try {
      const result = await fetch(`/api/floorplan/furniture/${floor}`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          furniture_type: type,
          style: 'default',
          label: `${type}(${defaultSize})`,
          pos_x: 6,
          pos_y: h / 2,
          pos_z: 5,
          custom_width: w,
          custom_depth: d,
          custom_height: h,
        }),
      }).then(r => r.json())

      const newItem = { ...result, custom_width: w, custom_depth: d, custom_height: h }
      setFurniture(prev => [...prev, newItem])
      setSelectedId(result.id)
    } catch (e) { console.error(e) }
  }, [floor, presets])

  const handleDelete = useCallback(async (id) => {
    if (!id) return
    try {
      await fetch(`/api/floorplan/furniture/${id}`, { method: 'DELETE' })
      setFurniture(prev => prev.filter(f => f.id !== id))
      setSelectedId(null)
    } catch (e) { console.error(e) }
  }, [])

  const handleChangeSize = useCallback(async (id, sizeName) => {
    const item = furniture.find(f => f.id === id)
    if (!item) return
    const preset = presets[item.furniture_type]
    if (!preset?.sizes?.[sizeName]) return
    const [w, d, h] = preset.sizes[sizeName]
    const data = { custom_width: w, custom_depth: d, custom_height: h, label: `${item.furniture_type}(${sizeName})` }
    try {
      await fetch(`/api/floorplan/furniture/${id}`, {
        method: 'PATCH', headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(data),
      })
      setFurniture(prev => prev.map(f => f.id === id ? { ...f, ...data } : f))
    } catch (e) { console.error(e) }
  }, [furniture, presets])

  const handleChangeStyle = useCallback(async (id, style) => {
    try {
      await fetch(`/api/floorplan/furniture/${id}`, {
        method: 'PATCH', headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ style }),
      })
      setFurniture(prev => prev.map(f => f.id === id ? { ...f, style } : f))
    } catch (e) { console.error(e) }
  }, [])

  const selectedItem = furniture.find(f => f.id === selectedId)
  const selectedPreset = selectedItem ? presets[selectedItem.furniture_type] : null

  return (
    <div className="flex h-[calc(100vh-5rem)] -m-8">
      {/* Left sidebar */}
      <div className="w-72 bg-white border-r border-zinc-200 flex flex-col flex-shrink-0 overflow-hidden">
        <div className="p-3 border-b border-zinc-100">
          <h3 className="text-xs font-semibold text-zinc-400 uppercase mb-2">楼层选择</h3>
          <div className="flex gap-1">
            {FLOORS.map(f => (
              <button
                key={f}
                onClick={() => setFloor(f)}
                className={`flex-1 py-1.5 text-xs font-medium rounded-md transition-all ${
                  floor === f ? 'bg-indigo-500 text-white shadow-sm' : 'bg-zinc-100 text-zinc-600 hover:bg-zinc-200'
                }`}
              >{f}</button>
            ))}
          </div>
          <p className="text-[10px] text-zinc-400 mt-2 truncate">{FLOOR_LABELS[floor]}</p>
        </div>

        <div className="flex-1 overflow-y-auto p-3">
          <h3 className="text-xs font-semibold text-zinc-400 uppercase mb-2">家具电器</h3>
          {FURNITURE_CATEGORIES.map(cat => (
            <div key={cat.name} className="mb-3">
              <button
                onClick={() => setExpandedCategory(prev => prev === cat.name ? '' : cat.name)}
                className="flex items-center gap-1.5 w-full text-left py-1.5 text-xs font-medium text-zinc-600 hover:text-zinc-900"
              >
                <span className={`transition-transform ${expandedCategory === cat.name ? 'rotate-90' : ''}`}>▸</span>
                {cat.name}
              </button>
              {expandedCategory === cat.name && (
                <div className="grid grid-cols-3 gap-1.5 ml-3">
                  {cat.items.map(type => (
                    <button
                      key={type}
                      onClick={() => handleAddFurniture(type)}
                      className="flex flex-col items-center gap-0.5 p-2 rounded-lg bg-zinc-50 hover:bg-indigo-50 hover:text-indigo-700 transition-all text-zinc-600 border border-zinc-100 hover:border-indigo-200"
                    >
                      <FurnitureIcon type={type} size={18} />
                      <span className="text-[10px]">{type}</span>
                    </button>
                  ))}
                </div>
              )}
            </div>
          ))}
        </div>

        <div className="p-3 border-t border-zinc-100 text-[10px] text-zinc-400 space-y-0.5">
          <p>🖱 单击选中 · 双击高亮 · 再拖移动</p>
          <p>🗑 选中后点删除按钮</p>
          <p>🔄 右键旋转 | 滚轮缩放</p>
        </div>
      </div>

      {/* 3D Canvas / Render View */}
      <div className="flex-1 bg-gradient-to-b from-slate-200 to-zinc-300 relative">
        {loading ? (
          <div className="flex items-center justify-center h-full text-zinc-400">加载中...</div>
        ) : (
          <Canvas
            shadows
            camera={{ position: [6, 10, 12], fov: 50 }}
            gl={{
              antialias: true,
              toneMapping: THREE.ACESFilmicToneMapping,
              toneMappingExposure: 1.1,
              shadowMap: { type: THREE.PCFSoftShadowMap },
            }}
            style={{ background: 'linear-gradient(to bottom, #bcc8d8, #d8dcd6)' }}
          >
            <Suspense fallback={<Html center><div className="text-zinc-400">加载模型...</div></Html>}>
              <BlenderScene
                furniture={furniture}
                selectedId={selectedId}
                onSelect={handleSelect}
                onDragEnd={handleDragEnd}
                presets={presets}
              />
            </Suspense>
          </Canvas>
        )}

        {/* Top controls bar */}
        <div className="absolute top-4 left-1/2 -translate-x-1/2 bg-white/85 backdrop-blur rounded-lg px-4 py-2 shadow-sm border border-zinc-200 text-xs text-zinc-500 flex items-center gap-4">
          <span>🏗 Blender 户型 — {FLOOR_LABELS[floor]}</span>
          <span>🖱 单击选择 | 再拖移动</span>
          <span>🗑 选中后删除</span>
          <span>🔄 右键旋转 | 滚轮缩放</span>
        </div>

        {/* Selected item properties panel */}
        {selectedItem && selectedPreset && (
          <div className="absolute bottom-4 right-4 bg-white/95 backdrop-blur rounded-xl shadow-lg border border-zinc-200 p-4 w-64 z-10">
            <div className="flex items-center justify-between mb-3">
              <h4 className="text-sm font-semibold text-zinc-800">{selectedItem.furniture_type}</h4>
              <button
                onClick={() => handleDelete(selectedId)}
                className="text-xs text-red-500 hover:text-red-700 px-2 py-1 rounded hover:bg-red-50 transition-colors"
              >
                🗑 删除
              </button>
            </div>

            {selectedPreset.sizes && Object.keys(selectedPreset.sizes).length > 1 && (
              <div className="mb-3">
                <label className="text-[10px] text-zinc-400 uppercase block mb-1">尺寸</label>
                <div className="flex gap-1 flex-wrap">
                  {Object.keys(selectedPreset.sizes).map(s => {
                    const [sw, sd] = selectedPreset.sizes[s]
                    const isActive = Math.abs((selectedItem.custom_width || 0) - sw) < 0.01
                    return (
                      <button
                        key={s}
                        onClick={() => handleChangeSize(selectedId, s)}
                        className={`text-[10px] px-2 py-1 rounded-md border transition-all ${
                          isActive ? 'bg-indigo-50 border-indigo-300 text-indigo-700' : 'border-zinc-200 text-zinc-500 hover:border-zinc-300'
                        }`}
                      >
                        {s}<span className="block text-[9px] opacity-60">{sw.toFixed(1)}×{sd.toFixed(1)}m</span>
                      </button>
                    )
                  })}
                </div>
              </div>
            )}

            {selectedPreset.styles && selectedPreset.styles.length > 1 && (
              <div className="mb-3">
                <label className="text-[10px] text-zinc-400 uppercase block mb-1">样式</label>
                <div className="flex gap-1 flex-wrap">
                  {selectedPreset.styles.map(s => (
                    <button
                      key={s}
                      onClick={() => handleChangeStyle(selectedId, s)}
                      className={`text-[10px] px-2 py-1 rounded-md border transition-all flex items-center gap-1 ${
                        selectedItem.style === s ? 'bg-indigo-50 border-indigo-300 text-indigo-700' : 'border-zinc-200 text-zinc-500 hover:border-zinc-300'
                      }`}
                    >
                      <span className="w-3 h-3 rounded-full inline-block border border-zinc-300"
                        style={{ background: selectedPreset.colors?.[s] || '#ccc' }} />
                      {s}
                    </button>
                  ))}
                </div>
              </div>
            )}

            <div className="text-[10px] text-zinc-400">
              <p>位置: ({selectedItem.pos_x.toFixed(1)}, {selectedItem.pos_z.toFixed(1)})</p>
              <p>尺寸: {(selectedItem.custom_width || 1).toFixed(2)}×{(selectedItem.custom_depth || 1).toFixed(2)}×{(selectedItem.custom_height || 1).toFixed(2)}m</p>
            </div>
          </div>
        )}
      </div>
    </div>
  )
}
