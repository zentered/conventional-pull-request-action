import path from 'path'
import configConventional from '@commitlint/config-conventional'
import * as core from '@actions/core'

import actionMessage from './action-message.js'

export default async function getLintRules(actionConfig) {
  const { RULES_PATH, GITHUB_WORKSPACE } = actionConfig

  let overrideRules = {}

  // if $GITHUB_WORKSPACE is not set, the checkout action has not run so we can't import the rules file
  if (RULES_PATH && !GITHUB_WORKSPACE) {
    core.warning(actionMessage.warning.action.checkout)
  } else if (RULES_PATH && GITHUB_WORKSPACE) {
    const configPath = path.resolve(GITHUB_WORKSPACE, RULES_PATH)
    try {
      const localRules = await import(configPath)
      overrideRules = localRules.default?.rules ?? localRules.rules ?? {}
    } catch (e) {
      if (e.code === 'MODULE_NOT_FOUND' || e.code === 'ERR_MODULE_NOT_FOUND') {
        core.warning(actionMessage.warning.action.rules_not_found)
      } else {
        throw e
      }
    }
  }
  return { ...configConventional.rules, ...overrideRules }
}
