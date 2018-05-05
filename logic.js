// /**
//  * Created by robyarta on 04/05/18.
//  */

const request = require('request-promise');
const admin = require('firebase-admin');
const serviceAccount = require('./hcm-telegrambot-a6db72963a37.json');
admin.initializeApp({
    credential: admin.credential.cert(serviceAccount),
    databaseURL: 'https://hcm-telegrambot.firebaseio.com'
});

const clientId = process.env.CLIENT_ID;
const clientSecret = process.env.CLIENT_SECRET;
const Markup = require('telegraf/markup');
const { google }= require('googleapis');
const oauth2Client = new google.auth.OAuth2(clientId,clientSecret,'http://localhost:3000/auth');
const scope = ['https://www.googleapis.com/auth/userinfo.email'];
const url = oauth2Client.generateAuthUrl({access_type: 'offline', scope: scope});
const authButton = Markup.inlineKeyboard([ Markup.urlButton('Authorize️', url)]).extra();

const Telegram = require('telegraf/telegram');
const Api = new Telegram(process.env.TOKEN);
const Stage = require('telegraf/stage');
const Scene = require('telegraf/scenes/base');
const Composer = require('telegraf/composer');
const WizardScene = require('telegraf/scenes/wizard');
const { enter, leave } = Stage;

const emailUpdateSuccess = "Sukses menambahkan email kakak";
const emailNotFoundText = "Mohon maaf, Email kakak setelah di cek masih kosong. Mohon login yak.";
const startText = "Hello, Ada yang bisa aku bantu?";
const responseText = "Baik kak, Keluhannya akan kami tindak lanjuti";
const responseProfile = "Berikut ini adalah data profile kakak, apabila ada yang kosong mohon di lengkapi ya.\n\n";

const getEmail = (token, next) => {
    return oauth2Client.getToken(token, (err, credentials) => {
        if (err) { return next(null); }
        oauth2Client.credentials = credentials;
        google.plus({version: 'v1', auth: oauth2Client}).people.get({ userId: 'me' }, (err, response) => {
            if (err) { return next(null); }
            return next(response.data.emails[0].value);
        });
    });
};

module.exports =  {

    error: (error) => { console.log("Error: "+error); },

    createHash: (hash, code) => { admin.database().ref('auth').child(hash).set({ code: code }); },

    greeting: ctx => ctx.replyWithHTML(startText),

    triggerCurrentProfile: ctx => {
        console.log("triggerCurrentProfile: "+ctx.message.chat.id+" - @"+ctx.message.chat.username);
        admin.database().ref('users').child(ctx.message.chat.id).once('value').then(snapshot => {
            const username = snapshot.val().username;
            const email = snapshot.val().email;
            return ctx.replyWithHTML(responseProfile +
                "name: <b>"+username+"</b>\n" +
                "email: <b>"+email+"</b>"
            )
        });
    },

    triggerSaveUsername: (ctx, next) => {
        console.log("triggerSaveUsername: "+ctx.message.chat.id+" - @"+ctx.message.chat.username);
        admin.database().ref('users').child(ctx.message.chat.id).update({ username: "@"+ctx.message.chat.username });
        return next()
    },

    triggerAuthorizeEmail: (ctx, next) => {
        console.log("triggerAuthorizeEmail: "+ctx.message.chat.id+" - @"+ctx.message.chat.username);
        setTimeout(() => {
            admin.database().ref('users').child(ctx.message.chat.id).once('value').then(snapshot => {
                if (snapshot.hasChild('email')) {return}
                ctx.replyWithHTML(emailNotFoundText, authButton);
            });
        }, 1000);
        return next();
    },

    triggerUpdateEmail: (ctx, next) => {
        console.log("triggerUpdateEmail: "+ctx.message.chat.id+" - @"+ctx.message.chat.username);
        const command = ctx.state.command;
        if (command.command !== 'start' || command.splitArgs[0].length < 1) { return next(); }
        admin.database().ref('auth').child(command.splitArgs[0]).once('value').then(snapshot => {
            getEmail(snapshot.val().code, email => {
                admin.database().ref('auth').child(command.splitArgs[0]).remove();
                admin.database().ref('users').child(ctx.message.chat.id).update({ email: email })
                    .then(() => ctx.replyWithHTML(emailUpdateSuccess + " <b>"+email+"</b>"))
            })
        });
        return next()
    },

    stageSurvey: () => {
        const survey = new Scene('survey');
        survey.enter((ctx) => ctx.reply('What is your question? if you finish your question, type /done'));
        survey.leave((ctx) => ctx.reply('Your question already noted.'));
        survey.command('done', leave());
        survey.on('message', (ctx) => ctx.reply('Send `hi`'));
        const stage = new Stage([survey], {ttl: 10});
        stage.register(survey);
        return stage;
    }

};


//
//
//
//
//
//
//
//
//
//
//
//
// ctx.telegram.sendMessage(ctx.message.chat.id, url);
//
// const helpText = "Berikut adalah command yang bisa digunakan: \n\n" +
//              "-\/help (Bantuan)"+
//              "-\/complain (Submit Complain)\n" +
//              "-\/profile (Update Data Pegawai)\n";
//
//
//
//
//
//
//
//
//
// bot.use(Telegraf.log());
// bot.help(updateChatIDWithUsername, ctx => ctx.replyWithHTML(helpText));
//
//
//
