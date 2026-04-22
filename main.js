import * as core from '@actions/core'
import { lintPR } from './src/lint-pr.js'

lintPR().catch((err) => {
  core.setFailed(err.message)
  throw err
})
