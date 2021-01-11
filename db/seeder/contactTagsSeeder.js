const moment = require('moment')
const _ = require('lodash')
const mongodb = require('../driver')

mongodb.connect()
  .then(connect => {
    function collectTags () {
      return connect.db.collection('tags')
        .find()
        .toArray()
    }

    function collectContacts () {
      return connect.db.collection('contacts')
        .find()
        .toArray()
    }

    Promise.all([collectTags(), collectContacts()])
      .then(results => {
        var allTags = results[0]
        const contacts = results[1]

        contacts.forEach(contact => generate(contact))

        function generate(contact) {
          var tags = _.filter(allTags, { customerId: contact.customerId })
          tags = _.sampleSize(tags, _.random(1, _.size(tags)))

          const contactId = contact._id.toString()
          const customerId = contact.customerId
          const teammateId = contact.teammateId

          tags.forEach(tag => {
            const tagId = tag._id.toString()
            insertContactTag(tagId)
              .then(() => {
                console.log('Seeded! 🎉')
                connect.close()
              })
              .catch(error => console.log('Error', error))
          })

          function insertContactTag(tagId) {
            return connect.db.collection('contactTags')
              .insertOne({
                customerId,
                teammateId,
                contactId,
                tagId,
                createdAt: moment().format()
              })
          }
        }
      })
      .catch(error => console.log('Error', error))
  }).catch(error => console.log('Error', error))
