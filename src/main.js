import { setFailed } from '@actions/core'
import { lintPR } from './lint-pr.js'

lintPR().catch((err) => {
  setFailed(err.message)
  throw err
})
