import { describe, it, before, beforeEach, mock } from 'node:test'
import assert from 'node:assert/strict'
import actionConfigFixture from './fixtures/action-config.js'
import actionMessage from '../src/action-message.js'
import rulesFixture from './fixtures/commitlint.rules.js'

const mockCore = {
  info: mock.fn(),
  warning: mock.fn(),
  error: mock.fn(),
  setFailed: mock.fn()
}

mock.module('@actions/core', { exports: mockCore })

let getLintRules

before(async () => {
  ;({ default: getLintRules } = await import('../src/lint-rules.js'))
})

describe('lint-rules', () => {
  beforeEach(() => {
    for (const fn of [mockCore.info, mockCore.warning, mockCore.error, mockCore.setFailed]) {
      fn.mock.resetCalls()
    }
  })

  it('warns when RULES_PATH is set without github checkout action', async () => {
    await getLintRules({
      ...actionConfigFixture,
      GITHUB_WORKSPACE: undefined,
      RULES_PATH: './fixtures/commitlint.rules.js'
    })

    assert.ok(
      mockCore.warning.mock.calls.some((c) => c.arguments[0] === actionMessage.warning.action.checkout)
    )
  })

  it('warns if rules module is not found', async () => {
    await getLintRules({
      ...actionConfigFixture,
      GITHUB_WORKSPACE: './',
      RULES_PATH: '/invalid/path/to/rules'
    })

    assert.ok(
      mockCore.warning.mock.calls.some((c) => c.arguments[0] === actionMessage.warning.action.rules_not_found)
    )
  })

  it('overrides config-conventional rules with lint rules in rules module', async () => {
    const rules = await getLintRules({
      ...actionConfigFixture,
      GITHUB_WORKSPACE: './',
      RULES_PATH: './test/fixtures/commitlint.rules.js'
    })

    assert.strictEqual(mockCore.warning.mock.callCount(), 0)
    assert.deepEqual(rules['some-overriden-rule'], rulesFixture.rules['some-overriden-rule'])
  })

  it('applies config conventional rules and rules module rules', async () => {
    const rules = await getLintRules({
      ...actionConfigFixture,
      GITHUB_WORKSPACE: './',
      RULES_PATH: './test/fixtures/commitlint.rules.js'
    })

    assert.strictEqual(mockCore.warning.mock.callCount(), 0)
    assert.ok(Array.isArray(rules['header-max-length']))
    assert.ok(Array.isArray(rules['only-rules-module-rule']))
    assert.ok(Array.isArray(rules['some-overriden-rule']))
  })
})
