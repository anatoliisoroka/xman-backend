const request = require('request-promise')
const imageDataUri = require('image-data-uri')
const _ = require('lodash')
const $ = require('cheerio')

function previewParser (url) {
  return new Promise((resolve, reject) => {
    request(url)
      .then(html => {
        const title = $('title', html).text()
        const description = $('meta[name="description"]', html).attr('content') ? $('meta[name="description"]', html).attr('content') : title
        var image = $('link[rel="shortcut icon"]', html).attr('href')
        image = image.includes('://') ? image : image.includes('data:image') ? image : `${url}${image}`
        if (_.isEmpty(image) || _.isEmpty(title) || _.isEmpty(description)) throw new Error()

        if (image.includes('://')) {
          imageDataUri.encodeFromURL(image)
            .then(image => {
              const response = { title, description, image }
              resolve(response)
            }).catch(error => reject(error))
        } else {
          const response = { title, description, image }
          resolve(response)
        }
      }).catch(error => reject(error))
  })
}

module.exports = previewParser
