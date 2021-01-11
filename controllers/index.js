const Auth = require('./AuthController')
const Availability = require('./AvailabilityController')
const Business = require('./BusinessController')
const Account = require('./AccountController')
const Reports = require('./ReportsController')
const Contacts = require('./ContactsController')
const Conversations = require('./ConversationsController')
const Tags = require('./TagsController')
const ContactTags = require('./ContactTagsController')
const Teammates = require('./TeammatesController')
const Keywords = require('./KeywordsController')
const Sequences = require('./SequencesController')
const SequenceMessages = require('./SequenceMessagesController')
const WhatsAppApi = require('./WhatsAppApiController')
const Subscriptions = require('./SubscriptionsController')
const Broadcasts = require('./BroadcastsController')
const Faqs = require('./FaqsController')
const Mentions = require('./MentionsController')
const GmailApi = require('./GmailApiController')
const ScheduledMessages = require('./ScheduledMessagesController')
const ContactRemarks = require('./ContactRemarksController')
const Webhook = require('./WebhookController')
const AssignmentRules = require('./AssignmentRulesController')
const Groups = require('./GroupsController')
const GroupConversations = require('./GroupConversationsController')
const CustomFields = require('./CustomFieldsController')

module.exports = {
  Auth,
  Availability,
  Business,
  Account,
  Reports,
  Contacts,
  Conversations,
  Tags,
  ContactTags,
  Teammates,
  Keywords,
  Sequences,
  SequenceMessages,
  WhatsAppApi,
  Subscriptions,
  Broadcasts,
  Faqs,
  Mentions,
  GmailApi,
  ScheduledMessages,
  ContactRemarks,
  Webhook,
  AssignmentRules,
  Groups,
  GroupConversations,
  CustomFields
}
