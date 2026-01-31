/**
 * Composable for querying entity templates from content/entities
 * Templates are the base definitions, instances are spawned at runtime
 */
export function useEntityTemplates() {
  // Get all entity templates
  async function getAll() {
    return queryCollection('entities').all()
  }

  // Get all character templates
  async function getCharacters() {
    return queryCollection('entities').where('type', '=', 'character').all()
  }

  // Get all enemy templates (hostile characters)
  async function getEnemies() {
    return queryCollection('entities')
      .where('type', '=', 'character')
      .where('hostile', '=', true)
      .all()
  }

  // Get all companion templates (controllable, non-hostile)
  async function getCompanions() {
    return queryCollection('entities')
      .where('type', '=', 'character')
      .where('controllable', '=', true)
      .where('hostile', '=', false)
      .all()
  }

  // Get all item templates
  async function getItems() {
    return queryCollection('entities').where('type', '=', 'item').all()
  }

  // Get weapons
  async function getWeapons() {
    return queryCollection('entities')
      .where('type', '=', 'item')
      .where('subtype', '=', 'weapon')
      .all()
  }

  // Get interactables
  async function getInteractables() {
    return queryCollection('entities').where('type', '=', 'interactable').all()
  }

  // Get template by templateId
  async function getTemplateById(templateId: string) {
    return queryCollection('entities').where('templateId', '=', templateId).first()
  }

  return {
    getAll,
    getCharacters,
    getEnemies,
    getCompanions,
    getItems,
    getWeapons,
    getInteractables,
    getTemplateById,
  }
}
