const faker = require('faker')
const moment = require('moment')
const _ = require('lodash')
const mongodb = require('../driver')

mongodb.connect()
  .then(connect => {
    connect.db.collection('customers')
      .find()
      .toArray()
      .then(customers => {
        customers.forEach(customer => generate(customer))
      })
      .catch(error => console.log('Error', error))

    function generate (customer) {
      const customerId = customer._id.toString()
      const count = _.random(1, 5)
      
      _.forEach(_.range(count), loop => {
        connect.db.collection('tags')
          .insertOne({
            customerId,
            name: faker.random.word(),
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
