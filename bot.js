/**
 * Created by robyarta on 04/05/18.
 */

const Telegraf = require('telegraf');
const commandParts = require('telegraf-command-parts');
const bot = new Telegraf('560008768:AAFAouOsURJYbt51HdqC7lFSdbFfycMMYgw');

const startText = "Hello, Ada yang bisa aku bantu?";

const helpText = "Berikut adalah command yang bisa digunakan: \n\n" +
             "-\/help (Bantuan)"+
             "-\/complain (Submit Complain)\n" +
             "-\/profile (Update Data Pegawai)\n";

const responseText = "Baik kak, Keluhannya akan kami tindak lanjuti";

const updateChatIDWithUsername = (ctx, next) => {
    console.log("save chat_id: " + ctx.message.chat.id + " to username @"+ctx.message.chat.username);
    next();
};

bot.use(commandParts());

bot.start(updateChatIDWithUsername, ctx => ctx.replyWithHTML(startText) );
bot.help(updateChatIDWithUsername, ctx => ctx.replyWithHTML(helpText));

bot.command('complain', updateChatIDWithUsername, ctx => ctx.replyWithHTML(responseText));
bot.command('profile', updateChatIDWithUsername, ctx => ctx.replyWithHTML(responseText));

bot.startPolling();