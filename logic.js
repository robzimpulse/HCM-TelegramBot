// /**
//  * Created by robyarta on 04/05/18.
//  */

const _ = require('underscore');
const request = require('request-promise');
const admin = require('firebase-admin');
const serviceAccount = require('./hcm-telegrambot-a6db72963a37.json');
admin.initializeApp({
    credential: admin.credential.cert(serviceAccount),
    databaseURL: 'https://hcm-telegrambot.firebaseio.com'
});

const clientId = process.env.CLIENT_ID;
const clientSecret = process.env.CLIENT_SECRET;
const redirectUrl = 'https://us-central1-hcm-telegrambot.cloudfunctions.net/auth';
const Markup = require('telegraf/markup');
const { google }= require('googleapis');
const oauth2Client = new google.auth.OAuth2(clientId,clientSecret,redirectUrl);
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

const openingText = "Halo, kami dari Tim HCM Bukalapak. " +
    "Saat ini kami sedang melaksanakan Employee Survey sebagai salah satu masukan untuk Bukalapak. " +
    "Apabila Anda tidak menjawab dalam waktu 5 menit, maka saya akan mengirimkan pertanyaan lanjutan.";

const replySurveyText = "Terima kasih sudah menjawab survey ini.";

const questionRef = admin.database().ref('questions');
const userRef = admin.database().ref('users');
const authRef = admin.database().ref('auth');

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

const getQuestionId = (question) => {
    return questionRef.orderByChild('question').equalTo(question).limitToFirst(1).once('value')
};

const getUserChatId = (username) => {
    return userRef.orderByChild('username').equalTo(username).limitToFirst(1).once('value');
};

module.exports =  {

    error: (error) => { console.log("Error: "+error); },

    greeting: ctx => ctx.replyWithHTML(startText),

    triggerCurrentProfile: ctx => {
        console.log("triggerCurrentProfile: "+ctx.message.chat.id+" - @"+ctx.message.chat.username);
        userRef.child(ctx.message.chat.id).once('value').then(snapshot => {
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
        userRef.child(ctx.message.chat.id).update({ username: "@"+ctx.message.chat.username });
        return next()
    },

    triggerAuthorizeEmail: (ctx, next) => {
        console.log("triggerAuthorizeEmail: "+ctx.message.chat.id+" - @"+ctx.message.chat.username);
        setTimeout(() => {
            userRef.child(ctx.message.chat.id).once('value').then(snapshot => {
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
        authRef.child(command.splitArgs[0]).once('value').then(snapshot => {
            getEmail(snapshot.val().code, email => {
                authRef.child(command.splitArgs[0]).remove();
                userRef.child(ctx.message.chat.id).update({ email: email })
                    .then(() => ctx.replyWithHTML(emailUpdateSuccess + " <b>"+email+"</b>"))
            })
        });
        return next()
    },

    triggerAnswerSurvey: (ctx) => {
        getQuestionId(ctx.callbackQuery.message.text).then((snapshot) => {
            const questionKey = Object.keys(snapshot.val())[0];
            if (!questionKey ) { return }
            getUserChatId('@'+ctx.callbackQuery.from.username).then((snapshot) => {
                const userKey = Object.keys(snapshot.val())[0];
                if (!userKey ) { return }
                userRef.child(userKey).child('answers').child(questionKey).set(ctx.callbackQuery.data).then(() => {
                    let chatId = ctx.callbackQuery.message.chat.id;
                    let username = "@"+ctx.callbackQuery.message.chat.username;
                    console.log("triggerAnswerSurvey: "+chatId+" - "+username);
                });
            });
        });
        ctx.reply(replySurveyText);
        return ctx.answerCbQuery();
    },

    triggerSurvey: (date) => {
        questionRef.once('value').then((snapshot) => {
            console.log("run survey at "+date);
            userRef.once('value').then(userSnapshot => {
                userSnapshot.forEach(child => {
                    userRef.child(child.key).once('value').then((userSnapshot) => {
                        let unansweredQuestionIds = Object.keys(snapshot.val())
                            .filter((element, index) => !userSnapshot.child('answers').hasChild(element));
                        if (unansweredQuestionIds.length < 1) { return }
                        let questionId = _.first(_.shuffle(unansweredQuestionIds));
                        let buttons = snapshot.child(questionId).val().choices
                            .map((element, index) => Markup.callbackButton(element, index));
                        const choices = Markup.inlineKeyboard(_.chunk(buttons,2)).extra();
                        Api.sendMessage(child.key,snapshot.child(questionId).val().question, choices);
                    });
                })
            });



        });

    },

    stageSurvey: () => {
        let key = "";
        const survey = new Scene('add_question_survey');
        survey.enter((ctx) => ctx.reply('What is your question?'));
        survey.on('message', ctx => {
            return questionRef.push({ question: ctx.message.text }).then(ref => {
                key = ref.key;
                return ctx.scene.enter('survey_choice_count');
            });
        });

        const choices = new Scene('survey_choice_count');
        choices.enter((ctx) => ctx.reply('Submit your choices separated by - character'));
        choices.leave((ctx) => ctx.reply('Your question and choices already noted.'));
        choices.on('message', ctx => {
            return questionRef.child(key)
                .update({ choices: ctx.message.text.split('-') })
                .then(() => ctx.scene.leave());
        });

        return new Stage([survey, choices]);
    }

};