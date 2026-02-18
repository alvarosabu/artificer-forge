import { createSharedComposable } from '@vueuse/core'

export const useSharedLechesControls = createSharedComposable(() => {
  const route = useRoute()

  const uuid = route.path.split('/').pop() ?? ''

  console.log('uuid', uuid)

  useControls('fpsgraph', {
    uuid
  })

  function addControl(control: string, options: Record<string, any>) {
    return useControls(control, { ...options, uuid })
  }

  function addFolder(folder: string, controls: Record<string, any>, options: Record<string, any> = {}) {
    return useControls(folder, controls, { ...options, uuid })
  }


  return {
    uuid,
    addControl,
    addFolder,
  }
})