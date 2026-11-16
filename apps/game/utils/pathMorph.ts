const NUMBER = /-?\d+(?:\.\d+)?/g

/** Maps a loop phase (0 to 1) to a path that eases through `shapes` and back. The shapes must share their commands. */
export function createPathMorph(shapes: readonly string[]) {
  const template = shapes[0]!.split(NUMBER)
  const numbers = shapes.map(shape => shape.match(NUMBER)!.map(Number))
  if (numbers.some(list => list.length !== numbers[0]!.length)) {
    throw new Error('createPathMorph: the shapes do not use the same commands')
  }

  return (phase: number) => {
    const position = (phase - Math.floor(phase)) * shapes.length
    const index = Math.floor(position)
    const from = numbers[index]!
    const to = numbers[(index + 1) % shapes.length]!
    const linear = position - index
    const t = linear * linear * (3 - 2 * linear)
    let path = template[0]!
    for (let i = 0; i < from.length; i++) {
      path += +(from[i]! + (to[i]! - from[i]!) * t).toFixed(2) + template[i + 1]!
    }
    return path
  }
}
