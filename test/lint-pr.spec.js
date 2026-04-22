import { describe, it, before, beforeEach, mock } from 'node:test'
import assert from 'node:assert/strict'
import actionConfigFixture from './fixtures/action-config.js'
import actionMessage from '../src/action-message.js'

const commitFixture = {
  message: `feat: some commit message

this is a commit message body that contains
information about this commit`
}

const contextPrFixture = {
  number: 1,
  base: {
    user: { login: 'some-owner' },
    repo: { name: 'some-repo' }
  }
}

const prFixture = {
  commits: 1,
  title: 'feat: some commit message'
}

let pullsGetResponse = { data: prFixture }
let listCommitsResponse = { data: [{ commit: commitFixture }] }
let actionConfigResponse = actionConfigFixture

const mockCore = {
  info: mock.fn(),
  warning: mock.fn(),
  error: mock.fn(),
  setFailed: mock.fn()
}

const githubClient = {
  rest: {
    pulls: {
      get: mock.fn(() => pullsGetResponse),
      listCommits: mock.fn(() => listCommitsResponse)
    }
  }
}

const mockGetActionConfig = mock.fn(() => actionConfigResponse)

mock.module('@actions/core', { namedExports: mockCore })
mock.module('@actions/github', {
  exports: {
    getOctokit: mock.fn(() => githubClient),
    context: { payload: { pull_request: contextPrFixture } }
  }
})
mock.module(import.meta.resolve('../src/utils.js'), {
  exports: {
    getActionConfig: mockGetActionConfig,
    getCommitSubject: (msg = '') => msg.split('\n')[0]
  }
})

let lintPR

before(async () => {
  ;({ lintPR } = await import('../src/lint-pr.js'))
})

function resetMocks() {
  pullsGetResponse = { data: prFixture }
  listCommitsResponse = { data: [{ commit: commitFixture }] }
  actionConfigResponse = actionConfigFixture
  for (const fn of [
    mockCore.info, mockCore.warning, mockCore.error, mockCore.setFailed,
    githubClient.rest.pulls.get, githubClient.rest.pulls.listCommits,
    mockGetActionConfig
  ]) fn.mock.resetCalls()
}

function calledWith(fn, arg) {
  return fn.mock.calls.some((c) => c.arguments[0] === arg)
}

describe('lintPR', () => {
  beforeEach(resetMocks)

  it('lints with config-conventional parser options', async () => {
    const commitMeetsSpec = 'feat!: exclamation mark will pass'
    listCommitsResponse = { data: [{ commit: { ...commitFixture, message: commitMeetsSpec } }] }
    pullsGetResponse = { data: { ...prFixture, commits: 1, title: commitMeetsSpec } }

    await lintPR()
    assert.strictEqual(mockCore.setFailed.mock.callCount(), 0)
  })

  it('skips linting for dependabot PRs', async () => {
    pullsGetResponse = {
      data: { ...prFixture, title: 'bump lodash from 4.0.0 to 4.1.0', user: { login: 'dependabot[bot]' } }
    }

    await lintPR()
    assert.strictEqual(mockCore.setFailed.mock.callCount(), 0)
    assert.ok(calledWith(mockCore.info, 'Skipping lint for dependabot PR'))
  })

  describe('when pull request has one commit', () => {
    describe('when IGNORE_COMMITS is true', () => {
      it('passes if commit message is not conventional', async () => {
        actionConfigResponse = { ...actionConfigFixture, IGNORE_COMMITS: true }
        listCommitsResponse = { data: [{ commit: { ...commitFixture, message: 'not conventional' } }] }

        await lintPR()
        assert.strictEqual(mockCore.setFailed.mock.callCount(), 0)
      })
    })

    describe('when COMMIT_TITLE_MATCH is true', () => {
      it('fails when pr title does not match the commit subject', async () => {
        pullsGetResponse = { data: { ...prFixture, title: 'feat: does not match commit' } }

        await lintPR()
        assert.ok(calledWith(mockCore.setFailed, actionMessage.fail.commit.commit_title_match))
      })
    })

    describe('when COMMIT_TITLE_MATCH is false', () => {
      it('passes when pr title does not match the commit subject', async () => {
        actionConfigResponse = { ...actionConfigFixture, COMMIT_TITLE_MATCH: false }
        pullsGetResponse = { data: { ...prFixture, title: 'feat: does not match commit' } }

        await lintPR()
        assert.strictEqual(mockCore.setFailed.mock.callCount(), 0)
      })
    })

    it('does not fail when commit message is to spec and pr title matches commit subject', async () => {
      await lintPR()
      assert.strictEqual(mockCore.setFailed.mock.callCount(), 0)
    })

    it('fetches pr commit', async () => {
      await lintPR()
      assert.strictEqual(githubClient.rest.pulls.listCommits.mock.callCount(), 1)
    })

    it('fails when commit message is not conventional', async () => {
      listCommitsResponse = { data: [{ commit: { ...commitFixture, message: 'not conventional' } }] }

      await lintPR()
      assert.ok(calledWith(mockCore.setFailed, actionMessage.fail.commit.lint))
    })
  })

  describe('when pull request has two or more commits', () => {
    it('does not fail when a PR title is to spec', async () => {
      pullsGetResponse = { data: { ...prFixture, commits: 2 } }

      await lintPR()
      assert.strictEqual(mockCore.setFailed.mock.callCount(), 0)
    })

    it('does not fail when a commit message is not conventional', async () => {
      listCommitsResponse = { data: [{ commit: { ...commitFixture, message: 'not conventional' } }] }
      pullsGetResponse = { data: { ...prFixture, commits: 2 } }

      await lintPR()
      assert.strictEqual(mockCore.setFailed.mock.callCount(), 0)
    })

    it('fails when the PR title is not conventional', async () => {
      pullsGetResponse = { data: { ...prFixture, commits: 2, title: 'not conventional' } }

      await lintPR()
      assert.ok(calledWith(mockCore.setFailed, actionMessage.fail.pull_request.lint))
    })
  })
})
