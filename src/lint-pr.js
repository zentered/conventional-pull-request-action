import * as core from '@actions/core'
import { context as githubContext, getOctokit } from '@actions/github'
import lint from '@commitlint/lint'
import parserPreset from 'conventional-changelog-conventionalcommits'

import { getActionConfig, getCommitSubject } from './utils.js'
import actionMessage from './action-message.js'
import getLintRules from './lint-rules.js'

export async function lintPR() {
  const actionConfig = getActionConfig()
  const { GITHUB_TOKEN, COMMIT_TITLE_MATCH, IGNORE_COMMITS } = actionConfig

  const client = getOctokit(GITHUB_TOKEN)

  if (!githubContext.payload.pull_request) {
    core.setFailed(actionMessage.fail.pull_request.not_found)
    return
  }

  const {
    number: pull_number,
    base: {
      user: { login: owner },
      repo: { name: repo }
    }
  } = githubContext.payload.pull_request

  const { data: pullRequest } = await client.rest.pulls.get({
    owner,
    repo,
    pull_number
  })
  core.info(`Found PR title: ${pullRequest.title}`)

  if (pullRequest.user?.login === 'dependabot[bot]') {
    core.info('Skipping lint for dependabot PR')
    return
  }

  const lintRules = await getLintRules(actionConfig)
  const { parser: parserOpts } = parserPreset()

  if (!IGNORE_COMMITS && pullRequest.commits <= 1) {
    const {
      data: [{ commit }]
    } = await client.rest.pulls.listCommits({
      owner,
      repo,
      pull_number,
      per_page: 1
    })

    const commitMessageSubject = getCommitSubject(commit.message)

    const commitReport = await lint(commitMessageSubject, lintRules, {
      parserOpts
    })

    commitReport.warnings.forEach((warn) =>
      core.warning(`Commit message: ${warn.message}`)
    )
    commitReport.errors.forEach((err) =>
      core.error(`Commit message: ${err.message}`)
    )

    if (!commitReport.valid) {
      core.setFailed(actionMessage.fail.commit.lint)
    }

    if (COMMIT_TITLE_MATCH && pullRequest.title !== commitMessageSubject) {
      core.setFailed(actionMessage.fail.commit.commit_title_match)
    }
  } else {
    const titleReport = await lint(pullRequest.title, lintRules, {
      parserOpts
    })
    titleReport.warnings.forEach((warn) =>
      core.warning(`PR title: ${warn.message}`)
    )
    titleReport.errors.forEach((err) => core.error(`PR title: ${err.message}`))

    if (!titleReport.valid) {
      core.setFailed(actionMessage.fail.pull_request.lint)
    }
  }
}
