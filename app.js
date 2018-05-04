const token = '560008768:AAFAouOsURJYbt51HdqC7lFSdbFfycMMYgw';
const clientId = '478647044238-l1sfkd0h0ucf1a3lro374fjtssgetjmd.apps.googleusercontent.com';
const clientSecret = 'YeUTQEMP_Fi0XggWeTq6FsPf';

const sha1 = require('sha1');
const createError = require('http-errors');
const express = require('express');
const path = require('path');
const cookieParser = require('cookie-parser');
const logger = require('morgan');
const indexRouter = require('./routes/index');
const request = require('request-promise');
const Telegraf = require('telegraf');
const Markup = require('telegraf/markup');
const commandParts = require('telegraf-command-parts');
const admin = require('firebase-admin');
const serviceAccount = require('./hcm-telegrambot-a6db72963a37.json');
const { google }= require('googleapis');
const scope = ['https://www.googleapis.com/auth/userinfo.email'];
const oauth2Client = new google.auth.OAuth2(clientId,clientSecret,'http://localhost:3000/auth');
const url = oauth2Client.generateAuthUrl({access_type: 'offline', scope: scope});
const authButton = Markup.inlineKeyboard([ Markup.urlButton('Authorize️', url)]).extra();
const bot = new Telegraf(token);
const app = express();

admin.initializeApp({
    credential: admin.credential.cert(serviceAccount),
    databaseURL: 'https://hcm-telegrambot.firebaseio.com'
});

const startText = "Hello, Ada yang bisa aku bantu?";

const updateChatIDWithUsername = (ctx, next) => {
    console.log("save chat_id: " + ctx.message.chat.id + " to username @"+ctx.message.chat.username);
    admin.database().ref('users')
        .child(ctx.message.chat.id)
        .update({ username: "@"+ctx.message.chat.username })
        .catch( () => { console.log("Error updating chat_id") });

    const command = ctx.state.command;

    if (command.command !== 'start' || command.splitArgs[0].length < 1) { return next() }

    admin.database().ref('auth')
        .child(command.splitArgs[0])
        .on('value', snapshot => {
            oauth2Client.getToken(snapshot.val().code, (err, token) => {
                console.log(err);
                if (err) { return }
                oauth2Client.credentials = token;
                google
                    .plus({version: 'v1', auth: oauth2Client})
                    .people.get({ userId: 'me' }, (err, response) => {
                    console.log(err);
                    admin.database().ref('users')
                        .child(ctx.message.chat.id)
                        .update({ email: response.data.emails[0].value })
                        .catch( () => { console.log("Error updating email") });
                });
            });
        });

    next()
};

// bot setup
bot.use(commandParts());
bot.catch( err => { console.log('Error: ', err) });
bot.start(updateChatIDWithUsername, ctx => ctx.replyWithHTML(startText));
bot.command('update_email', updateChatIDWithUsername, ctx => {
    return ctx.reply("Mohon login menggunakan button dibawah ini", authButton)
});

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
    admin.database().ref('auth').child(hash).set({ code: req.query.code });
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
