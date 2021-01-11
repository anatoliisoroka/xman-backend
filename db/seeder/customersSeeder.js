const faker = require('faker')
const _ = require('lodash')
const bcrypt = require('bcryptjs')
const moment = require('moment')
const mongodb = require('../driver')

const count = _.random(1, 5)

mongodb.connect()
  .then(connect => {
    _.forEach(_.range(count), loop => {
      const email = faker.internet.email()
      const isAvailable =  faker.random.boolean()
      const photo = faker.image.dataUri()

      function createTeammateAccountForCustomer(customerId) {
        connect.db.collection('teammates')
          .insertOne({
            name: faker.name.findName(),
            email,
            isAvailable,
            customerId,
            photo,
            isCustomer: true,
            createdAt: moment().format()
          })
      }

      connect.db.collection('customers')
        .insertOne({
          email,
          password: bcrypt.hashSync('password', 10),
          photo,
          isAvailable,
          businessName: faker.company.companyName(),
          offlineContactEmail: faker.internet.email(),
          whatsappApiUrl: 'https://eu8.chat-api.com/instance22977',
          whatsappApiToken: '7w59an58nr3ppden',
          whatsappApiInstanceId: _.random(10000, 99999),
          createdAt: moment().format()
        })
        .then(result => {
          const customer = _.first(result.ops)
          createTeammateAccountForCustomer(customer._id.toString())
          if (loop === (count - 1)) {
            console.log('Seeded! 🎉')
          }
        })
        .catch(error => console.log('Error', error))
    })
  }).catch(error => console.log('Error', error))
