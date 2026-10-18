// 极简类型化事件总线：内核各模块之间的神经系统
export type Handler<T> = (payload: T) => void

export class EventBus<E extends Record<string, unknown>> {
  private map = new Map<keyof E, Set<Handler<never>>>()

  on<K extends keyof E>(event: K, fn: Handler<E[K]>): () => void {
    let set = this.map.get(event)
    if (!set) {
      set = new Set()
      this.map.set(event, set)
    }
    set.add(fn as Handler<never>)
    return () => set!.delete(fn as Handler<never>)
  }

  emit<K extends keyof E>(event: K, payload: E[K]): void {
    const set = this.map.get(event)
    if (!set) return
    for (const fn of [...set]) (fn as Handler<E[K]>)(payload)
  }

  clear(): void {
    this.map.clear()
  }
}
