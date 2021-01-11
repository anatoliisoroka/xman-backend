const _ = require('lodash')
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
      const count = 1
      _.forEach(_.range(count), loop => {
        function job(type) {
          return {
            type,
            customerId,
            isRunning: false,
            updatedAt: moment().format()
          }
        }
        connect.db.collection('jobs')
          .insertMany([job('whatsappContactsSync'), job('whatsappConversationsSync')])
          .then(() => {
            if (loop === (count - 1)) console.log('Seeded! 🎉')
            connect.close()
          })
          .catch(error => console.log('Error', error))
      })
    }
  }).catch(error => console.log('Error', error))
