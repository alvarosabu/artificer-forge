import { defineBuildConfig } from 'unbuild'

export default defineBuildConfig({
  externals: ['@vue-flow/core', '@vue-flow/background', '@vue-flow/controls', '@vue-flow/minimap'],
})
