function formatJoiError (error) {
  return error.details[0]
}

module.exports = formatJoiError
