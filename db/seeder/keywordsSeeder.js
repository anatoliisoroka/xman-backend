const _ = require('lodash')
const faker = require('faker')
const moment = require('moment')
const mongodb = require('../driver')
const image = require('./assets/image')

mongodb.connect()
  .then(connect => {
    connect.db.collection('customers')
      .find()
      .toArray()
      .then(customers => {
        customers.forEach(customer => generate(customer._id.toString()))
      })
      .catch(error => console.log('Error', error))

    function generate (customerId) {
      const count = _.random(1, 25)
      const isImage = faker.random.boolean()

      _.forEach(_.range(count), loop => {
        connect.db.collection('keywords')
          .insertOne({
            customerId,
            isEnabled: faker.random.boolean(),
            reply: faker.random.words(10),
            photo: {
              data: isImage ? image : '',
              filename: isImage ? 'image.png' : ''
            },
            keywords: _.map(_.range(_.random(1, 3)), () => _.toLower(_.first(faker.random.word().split(' ')))),
            action: loop === 0 ? 'subscribe' : loop === 1 ? 'unsubscribe' : 'reply',
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
