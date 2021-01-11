const admin = require('firebase-admin')
const dauria = require('dauria')

class Storage {
  put (data, filepath, mimeType) {
    const file = dauria.parseDataURI(data).buffer
    const bucket = admin.storage().bucket()
    return new Promise((resolve, reject) => {
      bucket.file(filepath)
        .save(file, { metadata: { contentType: mimeType } })
        .then(() => {
          bucket.file(filepath).makePublic()
            .then(() => {
              const url = `https://storage.googleapis.com/${process.env.FIREBASE_STORAGE_BUCKET}/${filepath}`
              resolve(url)
            }).catch(error => reject(error))
        }).catch(error => reject(error))
    })
  }
}

module.exports = Storage
