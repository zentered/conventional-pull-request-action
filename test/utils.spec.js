import { describe, it, beforeEach } from 'node:test'
import assert from 'node:assert/strict'
import { getActionConfig, getCommitSubject } from '../src/utils.js'

describe('getActionConfig', () => {
  beforeEach(() => {
    process.env.INPUT_COMMITTITLEMATCH = 'true'
    process.env.INPUT_IGNORECOMMITS = 'false'
    process.env.INPUT_COMMITLINTRULESPATH = './commitlint.rules.js'
    process.env.GITHUB_TOKEN = 'asdf'
    process.env.GITHUB_WORKSPACE = './'
  })

  describe('when parsing action config booleans', () => {
    for (const [key, expected] of [['COMMIT_TITLE_MATCH', true], ['IGNORE_COMMITS', false]]) {
      it(`casts ${key} to boolean`, () => {
        assert.strictEqual(getActionConfig()[key], expected)
      })
    }

    it('falls back to default boolean if on invalid value or parse failure', () => {
      process.env.INPUT_COMMITTITLEMATCH = '{}'
      assert.strictEqual(getActionConfig().COMMIT_TITLE_MATCH, true)

      assert.doesNotThrow(() => {
        process.env.INPUT_COMMITTITLEMATCH = '{'
        getActionConfig()
      })
    })
  })

  it('returns a valid config object', () => {
    const config = getActionConfig()
    assert.ok(typeof config.COMMIT_TITLE_MATCH === 'boolean')
    assert.ok(typeof config.IGNORE_COMMITS === 'boolean')
    assert.ok(typeof config.RULES_PATH === 'string')
    assert.ok(typeof config.GITHUB_TOKEN === 'string')
    assert.ok(typeof config.GITHUB_WORKSPACE === 'string')
  })
})

describe('getCommitSubject', () => {
  const commitWithSubjectOnly = 'feat(test): some commit message subject'
  const commitWithBody = `${commitWithSubjectOnly}

this is a commit message body that contains
information about this commit`

  describe('when the commit message only contains a subject', () => {
    it('returns the commit message subject', () => {
      assert.strictEqual(getCommitSubject(commitWithSubjectOnly), commitWithSubjectOnly)
    })
  })

  describe('when the commit message contains a body', () => {
    it('returns the commit message subject only, omitting the body', () => {
      assert.strictEqual(getCommitSubject(commitWithBody), commitWithSubjectOnly)
    })
  })
})
