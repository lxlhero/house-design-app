import { Construction } from 'lucide-react'

export default function FloorPlan() {
  return (
    <div className="flex flex-col items-center justify-center py-20 text-center">
      <div className="w-20 h-20 rounded-2xl bg-amber-50 flex items-center justify-center mb-6">
        <Construction size={36} className="text-amber-500" strokeWidth={1.5} />
      </div>
      <h2 className="text-xl font-bold text-zinc-800 mb-2">3D 户型</h2>
      <p className="text-sm text-zinc-500 max-w-sm leading-relaxed">
        正在调试中，暂不可用。
      </p>
      <p className="text-xs text-zinc-400 mt-3">
        Blender 3D 渲染引擎适配中，敬请期待。
      </p>
    </div>
  )
}
