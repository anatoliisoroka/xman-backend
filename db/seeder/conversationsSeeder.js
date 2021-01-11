const faker = require('faker')
const moment = require('moment')
const _ = require('lodash')
const mongodb = require('../driver')
const image = require('./assets/image')

mongodb.connect()
  .then(connect => {
    connect.db.collection('contacts')
      .find()
      .toArray()
      .then(contacts => {
        contacts.forEach(contact => generate(contact))
      })
      .catch(error => console.log('Error', error))

    function generate (contact) {
      const contactId = contact._id.toString()
      const { teammateId, customerId } = contact
      const count = _.random(1, 50)
      
      _.forEach(_.range(count), loop => {
        const isFromTeammate = faker.random.boolean()
        var isImage = faker.random.boolean()
        const caption = [null, faker.random.words(3)]

        connect.db.collection('conversations')
          .insertOne({
            messageId: _.uniqueId(),
            customerId,
            teammateId,
            contactId,
            message: isImage ? image : faker.random.words(),
            type: isImage ? 'image' : "chat",
            caption: isImage ? _.sample(caption) : null,
            createdAt: moment().subtract(_.random(0, 6), 'days').format(),
            isFromTeammate,
            isInternal: (isFromTeammate && !isImage) ? faker.random.boolean() : false,
            isRead: faker.random.boolean()
          })
          .then(() => {
            if (loop === (count - 1)) console.log('Seeded! 🎉')
            connect.close()
          })
          .catch(error => console.log('Error', error))
      })
    }
  }).catch(error => console.log('Error', error))
