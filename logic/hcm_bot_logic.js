// /**
//  * Created by robyarta on 04/05/18.
//  */

const _                   = require('underscore');
const request             = require('request-promise');
const admin               = require('firebase-admin');
const Markup              = require('telegraf/markup');
const Telegram            = require('telegraf/telegram');
const Stage               = require('telegraf/stage');
const Scene               = require('telegraf/scenes/base');
const Composer            = require('telegraf/composer');
const WizardScene         = require('telegraf/scenes/wizard');
const { google }          = require('googleapis');
const { enter, leave }    = Stage;
const serviceAccount      = require('./hcm-telegrambot-a6db72963a37.json');

const oauth2Client = new google.auth.OAuth2(process.env.CLIENT_ID,process.env.CLIENT_SECRET,'https://us-central1-hcm-telegrambot.cloudfunctions.net/auth');
const scope = ['https://www.googleapis.com/auth/userinfo.email','https://www.googleapis.com/auth/userinfo.profile'];
const url = oauth2Client.generateAuthUrl({access_type: 'offline', scope: scope});

admin.initializeApp({
  credential: admin.credential.cert(serviceAccount),
  databaseURL: 'https://hcm-telegrambot.firebaseio.com'
});
const questionRef = admin.database().ref('questions');
const userRef = admin.database().ref('users');
const authRef = admin.database().ref('auth');

const authButton = Markup.inlineKeyboard([ Markup.urlButton('Authorize️', url)]).extra();
const Api = new Telegram(process.env.TOKEN);

const emailUpdateSuccess = "Sukses menambahkan email kakak ";
const emailNotFoundText = "Mohon maaf, Email kakak setelah di cek masih kosong. Mohon login yak.";
const responseProfile = "Berikut ini adalah data profile kakak, apabila ada yang kosong mohon di lengkapi ya.\n\n";
const replySurveyText = "Terima kasih sudah menjawab survey ini.";

const getEmail = (token, next) => {
  return oauth2Client.getToken(token, (err, credentials) => {
    if (err) {
      return next(null);
    }
    oauth2Client.credentials = credentials;
    google.plus({
      version: 'v1',
      auth: oauth2Client
    }).people.get({
      userId: 'me'
    }, (err, response) => {
      if (err) {
        return next(null);
      }
      return next(response.data);
    });
  });
};

const getQuestionId = (question) => questionRef.orderByChild('question').equalTo(question).limitToFirst(1).once('value');
const getUserChatId = (username) => userRef.orderByChild('username').equalTo(username).limitToFirst(1).once('value');

module.exports = {

  error: (error) => {
    console.log("Error: " + error);
  },

  triggerCurrentProfile: ctx => {
    const username = '@'+ctx.message.chat.username;
    const chatId = ctx.message.chat.id;
    console.log("triggerCurrentProfile: " + username + ' - ' + chatId);
    return userRef.child(chatId).once('value').then(snapshot => {
      if (!snapshot.hasChild('email')) { return ctx.replyWithHTML(emailNotFoundText, authButton); }
      const email = snapshot.val().email;
      const name = snapshot.val().name.givenName;
      return ctx.replyWithHTML(
        responseProfile +
        "name: <b>" + name + "</b>\n" +
        "email: <b>" + email + "</b>"
      );
    });
  },

  triggerStart: ctx => {
    const username = '@'+ctx.message.chat.username;
    const chatId = ctx.message.chat.id;
    const hash = ctx.state.command.splitArgs[0];
    console.log("triggerStart: " + username + ' - ' + chatId + ' - ' + hash);

    if (hash.length < 1) {
      return userRef.child(chatId).once('value').then(snapshot => {
        if (!snapshot.hasChild('email')) { return ctx.replyWithHTML(emailNotFoundText, authButton); }
        const email = snapshot.val().email;
        const name = snapshot.val().name.givenName;
        return ctx.replyWithHTML("Hello, "+name+" ada yang bisa aku bantu?")
      });
    }

    authRef.child(hash).once('value').then(snapshot => {
      if (!snapshot.hasChild('code')) { return }
      getEmail(snapshot.val().code, data => {
        const profile = { email: data.emails[0].value, name: data.name, username: username };
        authRef.child(hash).remove().then(() => userRef.child(chatId).update(profile));
        ctx.replyWithHTML(emailUpdateSuccess + "<b>" + profile.email + "</b>")
      })
    });
  },

  triggerAnswerSurvey: (ctx) => {
    getQuestionId(ctx.callbackQuery.message.text).then((snapshot) => {
      const questionKey = Object.keys(snapshot.val())[0];
      if (!questionKey) {
        return
      }
      getUserChatId('@' + ctx.callbackQuery.from.username).then((snapshot) => {
        const userKey = Object.keys(snapshot.val())[0];
        if (!userKey) {
          return
        }
        userRef.child(userKey).child('answers').child(questionKey).set(ctx.callbackQuery.data).then(() => {
          let chatId = ctx.callbackQuery.message.chat.id;
          let username = "@" + ctx.callbackQuery.message.chat.username;
          console.log("triggerAnswerSurvey: " + chatId + " - " + username);
        });
      });
    });
    ctx.reply(replySurveyText);
    return ctx.answerCbQuery();
  },

  triggerSurvey: (date) => {
    questionRef.once('value').then((snapshot) => {
      console.log("run survey at " + date);
      userRef.once('value').then(userSnapshot => {
        userSnapshot.forEach(child => {
          userRef.child(child.key).once('value').then((userSnapshot) => {
            let unansweredQuestionIds = Object.keys(snapshot.val())
              .filter((element, index) => !userSnapshot.child('answers').hasChild(element));
            if (unansweredQuestionIds.length < 1) {
              return
            }
            let questionId = _.first(_.shuffle(unansweredQuestionIds));
            let buttons = snapshot.child(questionId).val().choices
              .map((element, index) => Markup.callbackButton(element, index));
            const choices = Markup.inlineKeyboard(_.chunk(buttons, 2)).extra();
            Api.sendMessage(child.key, snapshot.child(questionId).val().question, choices);
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
      return questionRef.push({
        question: ctx.message.text
      }).then(ref => {
        key = ref.key;
        return ctx.scene.enter('survey_choice_count');
      });
    });

    const choices = new Scene('survey_choice_count');
    choices.enter((ctx) => ctx.reply('Submit your choices separated by - character'));
    choices.leave((ctx) => ctx.reply('Your question and choices already noted.'));
    choices.on('message', ctx => {
      return questionRef.child(key)
        .update({
          choices: ctx.message.text.split('-')
        })
        .then(() => ctx.scene.leave());
    });

    return new Stage([survey, choices]);
  }

};
