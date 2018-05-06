const logic = require('./logic');
const createError = require('http-errors');
const express = require('express');
const path = require('path');
const schedule = require('node-schedule');
const cookieParser = require('cookie-parser');
const logger = require('morgan');
const indexRouter = require('./routes/index');
const Telegraf = require('telegraf');
const commandParts = require('telegraf-command-parts');
const Session = require('telegraf/session');
const Stage = require('telegraf/stage');
const bot = new Telegraf(process.env.TOKEN);
const app = express();

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

// view engine setup
app.set('views', path.join(__dirname, 'views'));
app.set('view engine', 'ejs');

app.use(logger('dev'));
app.use(express.json());
app.use(express.urlencoded({ extended: false }));
app.use(cookieParser());
app.use(express.static(path.join(__dirname, 'public')));

app.use('/', indexRouter);

// catch 404 and forward to error handler
app.use(function(req, res, next) {
    next(createError(404));
});

// error handler
app.use(function(err, req, res, next) {
    // set locals, only providing error in development
    res.locals.message = err.message;
    res.locals.error = req.app.get('env') === 'development' ? err : {};

    // render the error page
    res.status(err.status || 500);
    res.render('error');
});

bot.startPolling();
module.exports = app;
