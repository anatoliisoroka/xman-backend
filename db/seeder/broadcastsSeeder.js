const faker = require('faker')
const _ = require('lodash')
const moment = require('moment')
const mongodb = require('../driver')
const image = require('./assets/image')

mongodb.connect()
  .then(connect => {
    function collectCustomers () {
      return connect.db.collection('customers')
        .find()
        .toArray()
    }
    function collectTags () {
      return connect.db.collection('tags')
        .find()
        .toArray()
    }
    Promise.all([collectCustomers(), collectTags()])
      .then(results => {
        const customers = results[0]
        var tags = results[1]
        if (_.isEmpty(customers) || _.isEmpty(tags)) throw new Error()
        customers.forEach(customer => {
          var customerTags = _.filter(tags, { 'customerId': customer._id.toString() })
          var tagIds = _.map(customerTags, customerTag => customerTag._id.toString())
          var randomLength = _.random(1, tagIds.length)
          var sampleTags = _.sampleSize(tagIds, randomLength)
          generate(customer, sampleTags)
        })
      }).catch(error => console.log('Error', error))

    function generate (customer, sampleTags) {
      const count = _.random(1, 5)
      _.forEach(_.range(count), loop => {
        const isImage = faker.random.boolean()

        connect.db.collection('broadcasts')
          .insertOne({
            customerId: customer._id.toString(),
            tags: sampleTags,
            message: faker.lorem.sentence(),
            schedule: [_.random(1, 10), ['minutes', 'hours', 'days'][_.random(0, 2)]],
            sent: 0,
            photo: {
              data: isImage ? image : '',
              filename: isImage ? 'image.png' : ''
            },
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
