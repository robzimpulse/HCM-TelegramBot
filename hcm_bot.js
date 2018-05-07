const logic = require('./hcm_bot_logic/');
const Telegraf = require('telegraf');
const commandParts = require('telegraf-command-parts');
const Session = require('telegraf/session');
const Stage = require('telegraf/stage');
const bot = new Telegraf(process.env.TOKEN);

const { enter, leave } = Stage;

// bot setup
bot.use(Session());
bot.use(commandParts());
bot.use(logic.stageSurvey().middleware());
bot.catch(logic.error);
bot.start(logic.triggerSaveUsername, logic.triggerAuthorizeEmail, logic.triggerUpdateEmail, logic.greeting);
bot.command('my_profile', logic.triggerSaveUsername, logic.triggerAuthorizeEmail, logic.triggerCurrentProfile);
bot.command('add_question_survey', logic.triggerSaveUsername, logic.triggerAuthorizeEmail, enter('add_question_survey'));
bot.on('callback_query', logic.triggerAnswerSurvey);

// 0 0 13 * * FRI // run every friday at 13:00:00
// 0 0 */1 * * * // run every 1 hour
// */5 * * * * * // run every 5 seconds
schedule.scheduleJob('0 0 */1 * * *', (date) => { logic.triggerSurvey(date) });

bot.startPolling();