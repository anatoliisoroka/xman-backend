const _ = require('lodash')
const moment = require('moment')
const mongodb = require('../driver')

mongodb.connect()
  .then(connect => {
    const collectContacts = connect.db.collection('contacts')
      .find()
      .toArray()
    const collectSequences = connect.db.collection('sequences')
      .find()
      .toArray()

    Promise.all([collectContacts, collectSequences])
      .then(data => {
        const contacts = _.first(data)
        const sequences = _.last(data)
        contacts.forEach(contact => generate(contact, sequences))
      })
      .catch(error => console.log('Error', error))

    function generate(contact, sequences) {
      const count = _.random(1, 3)

      _.forEach(_.range(count), loop => {
        connect.db.collection('subscriptions')
          .insertOne({
            customerId: contact.customerId,
            contactId: contact._id.toString(),
            sequenceId: sequences[_.random(0, (sequences.length - 1))]._id.toString(),
            createdAt: moment().format()
          })
          .then(() => {
            if (loop === (count - 1)) console.log('Seeded! 🎉')
            connect.close()
          })
          .catch(error => console.log('Error', error))
      })
    }
  }).catch(error => console.log('Error', error))
