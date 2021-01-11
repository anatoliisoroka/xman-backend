const dauria = require('dauria')

function isValidWhatsappFileSize (dataURI) {
  const buffer = dauria.parseDataURI(dataURI).buffer
  return buffer.byteLength < 1024 * 1024 // 1 MB
}

module.exports = isValidWhatsappFileSize
