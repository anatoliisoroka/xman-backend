const MongoClient = require('mongodb').MongoClient
const path = require('path')
const Papa = require('papaparse')
const fs = require('fs')

// Configurations
const MONGODB_URI = ''
const DB_NAME = ''

function query (db, close) {
  function execute () {
    // Write queries here
  }

  execute()
    .then(data => {
      data = Papa.unparse(data)
      fs.writeFile(path.join(__dirname, 'output.csv'), data, error => console.log(error))
      close()
    }).catch(() => close())
}

function init (callback) {
  MongoClient.connect(
    MONGODB_URI,
    { useNewUrlParser: true },
    (error, client) => {
      if (error) return console.log(error)
      const close = () => client.close()
      const db = client.db(DB_NAME)
      callback(db, close)
    })
}

init(query)
