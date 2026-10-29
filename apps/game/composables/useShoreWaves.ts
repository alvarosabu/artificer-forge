/** One set per canvas: the ocean lifts the water and the terrain wets the sand from the same uniforms. */
export function useShoreWaves(): ShoreWaves {
  return useUniforms(SHORE_WAVE_DEFAULTS, 'waves')
}
