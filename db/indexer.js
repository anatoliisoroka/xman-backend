const mongodb = require('./driver')

const creates = [
  ['teammates', { customerId: 1 }],
  ['contacts', { customerId: 1, teammateId: 1, name: 1, email: 1, whatsapp: 1, isArchived: 1, hasUnread: 1 }],
  ['contactRemarks', { customerId: 1, teammateId: 1, contactId: 1 }],
  ['conversations', { customerId: 1, teammateId: 1, contactId: 1, isRead: 1 }],
  ['groups', { customerId: 1, whatsappGroupId: 1 }],
  ['groupConversations', { customerId: 1, groupId: 1, teammateId: 1 }],
  ['sequences', { customerId: 1 }],
  ['sequenceMessages', { customerId: 1, sequenceId: 1 }],
  ['scheduledMessages', { customerId: 1, contactId: 1 }],
  ['subscriptions', { customerId: 1, contactId: 1, sequenceId: 1 }],
  ['subscriptionJobs', { customerId: 1, subscriptionId: 1 }],
  ['tags', { customerId: 1 }],
  ['contactTags', { customerId: 1, teammateId: 1, contactId: 1, tagId: 1 }],
  ['broadcasts', { customerId: 1 }],
  ['keywords', { customerId: 1 }],
  ['snoozeContactJobs', { customerId: 1, contactId: 1 }],
  ['whatsappJobs', { customerId: 1, isRunning: 1 }],
  ['broadcastJobs', { customerId: 1, broadcastId: 1, messageId: 1 }],
  ['mentions', { customerId: 1, contactId: 1, conversationId: 1, fromId: 1, toId: 1 }],
  ['faqs', { customerId: 1 }],
  ['assignmentRules', { customerId: 1, assigneeId: 1 }]
]
const drops = [
  // ['customers', { whatsapp: 1 }]
]
function createIndexes (db) {
  function create (data) {
    return new Promise((resolve, reject) => {
      const [collection, indexes] = data
      db.collection(collection)
        .createIndex(
          indexes,
          { background: true }
        ).then(() => resolve(`📍  Indexing ${collection}...`))
        .catch(error => reject(error))
    })
  }
  const bulk = () => creates.map(data => create(data))
  return Promise.all(bulk())
}
function dropIndexes (db) {
  function drop (data) {
    return new Promise((resolve, reject) => {
      const [collection, indexes] = data
      db.collection(collection)
        .dropIndex(indexes)
        .then(() => resolve(`📍  Dropping ${collection}...`))
        .catch(error => reject(error))
    })
  }
  const bulk = () => drops.map(data => drop(data))
  return Promise.all(bulk())
}
mongodb.connect()
  .then(connect => {
    const { close, db } = connect
    console.log('\n📦  Connected to database')
    console.log(`⌛️  Indexer going to start...\n`)
    Promise.all([createIndexes(db), dropIndexes(db)])
      .then(results => {
        const [creates, drops] = results
        creates.forEach(create => console.log(create))
        drops.forEach(drop => console.log(drop))
        console.log('\n🍺  Done!\n')
        close()
        process.exit(0)
      }).catch(error => {
        console.error(error.message)
        close()
      })
  }).catch(error => console.error(error.message))
