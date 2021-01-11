const _ = require('lodash')
const faker = require('faker')
const moment = require('moment')
const mongodb = require('../driver')

mongodb.connect()
  .then(connect => {
    connect.db.collection('customers')
      .find()
      .toArray()
      .then(customers => {
        customers.forEach(customer => generate(customer._id.toString()))
      })
      .catch(error => console.log('Error', error))

    function generate(customerId) {
      const count = _.random(1, 25)
      _.forEach(_.range(count), loop => {
        connect.db.collection('sequences')
          .insertOne({
            customerId,
            name: faker.random.words(3),
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
