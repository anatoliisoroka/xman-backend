const _ = require('lodash')
const faker = require('faker')
const moment = require('moment')
const mongodb = require('../driver')
const image = require('./assets/image')

mongodb.connect()
  .then(connect => {
    connect.db.collection('sequences')
      .find()
      .toArray()
      .then(sequences => {
        sequences.forEach(sequence => generate(sequence))
      })
      .catch(error => console.log('Error', error))

    function generate (sequence) {
      const count = _.random(1, 5)
      const isImage = faker.random.boolean()

      _.forEach(_.range(count), loop => {
        connect.db.collection('sequenceMessages')
          .insertOne({
            customerId: sequence.customerId,
            sequenceId: sequence._id.toString(),
            name: faker.random.words(3),
            message: faker.random.words(10),
            photo: {
              data: isImage ? image : '',
              filename: isImage ? 'image.png' : ''
            },
            schedule: [_.random(1, 100), faker.helpers.randomize(['weeks', 'days', 'minutes', 'seconds'])], // moment.add() compatible
            isEnabled: faker.random.boolean(),
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
