const _ = require('lodash')
const moment = require('moment')
const mongodb = require('../driver')

mongodb.connect()
  .then(connection => {
    function collectTeammates() {
      return connection.db.collection('teammates')
        .find()
        .toArray()
    }

    function collectInternalConversations() {
      return connection.db.collection('conversations')
        .find({ isInternal: true })
        .toArray()
    }

    Promise.all([collectTeammates(), collectInternalConversations()])
      .then(results => {
        const allTeammates = results[0]
        var conversations = results[1]

        conversations = _.sampleSize(conversations, _.size(conversations) / 2)

        conversations.forEach(conversation => {
          var teammates = _.filter(allTeammates, { customerId: conversation.customerId })
          teammates = teammates.map(teammate => {
            return teammate._id.toString()
          })

          insertMention(conversation, teammates)
            .then(() => {
              console.log('Seeded! 🎉')
              connection.close()
            })
            .catch(error => console.log('Error', error))
        })
      })
      .catch(error => console.log('Error', error))

    function insertMention (conversation, teammates) {
      return connection.db.collection('mentions')
        .insertOne({
          customerId: conversation.customerId,
          contactId: conversation.contactId,
          conversationId: conversation._id.toString(),
          fromId: _.sample(teammates),
          toId: _.sample(teammates),
          createdAt: moment().format()
        })
    }
  }).catch(error => console.log('Error', error))
