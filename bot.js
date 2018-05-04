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

bot.use(commandParts());

bot.start((ctx) => ctx.replyWithHTML(startText));
bot.help((ctx) => ctx.replyWithHTML(helpText));

bot.command('complain', (ctx) => {
    console.log(ctx.state.command.splitArgs);
    // setTimeout(() => { ctx.replyWithHTML(responseText) }, 3000);
    return ctx.replyWithHTML(responseText);
});

bot.command('profile', (ctx) => {
    console.log(ctx.message.text.split(' ').shift().join(' '));
    return ctx.replyWithHTML(responseText);
});

bot.startPolling();
