const faker = require('faker')
const _ = require('lodash')
const bcrypt = require('bcryptjs')
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
      const count = _.random(1, 5)
      _.forEach(_.range(count), loop => {
        connect.db.collection('teammates')
          .insertOne({
            name: faker.name.findName(),
            email: faker.internet.email(),
            password: bcrypt.hashSync('password', 10),
            isAvailable: faker.random.boolean(),
            customerId,
            isCustomer: false,
            photo: faker.image.dataUri(),
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
