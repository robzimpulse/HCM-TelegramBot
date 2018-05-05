const logic = require('./logic');
const sha1 = require('sha1');
const createError = require('http-errors');
const express = require('express');
const path = require('path');
const cookieParser = require('cookie-parser');
const logger = require('morgan');
const indexRouter = require('./routes/index');
const Telegraf = require('telegraf');
const commandParts = require('telegraf-command-parts');

const bot = new Telegraf(process.env.TOKEN);
const app = express();

// bot setup
bot.use(commandParts());
bot.catch(logic.error);
bot.start(
    logic.triggerSaveUsername,
    logic.triggerAuthorizeEmail,
    logic.triggerUpdateEmail,
    logic.greeting
);

// bot.command('update_email', logic.updateUsername, ctx => {
//     return ctx.reply("Mohon login menggunakan button dibawah ini", authButton)
// });

// view engine setup
app.set('views', path.join(__dirname, 'views'));
app.set('view engine', 'ejs');

app.use(logger('dev'));
app.use(express.json());
app.use(express.urlencoded({ extended: false }));
app.use(cookieParser());
app.use(express.static(path.join(__dirname, 'public')));

app.use('/', indexRouter);
app.all('/auth', function (req, res) {
    const hash = sha1(req.query.code);
    logic.createHash(hash, req.query.code);
    res.redirect('http://t.me/bl_hcm_bot?start='+hash);
});

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
