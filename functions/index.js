const functions = require('firebase-functions');
const admin = require('firebase-admin');
const sha1 = require('sha1');
// // Create and Deploy Your First Cloud Functions
// // https://firebase.google.com/docs/functions/write-firebase-functions
//

admin.initializeApp();

exports.auth= functions.https.onRequest((request, response) => {
    const hash = sha1(request.query.code);
    admin.database().ref('auth').child(hash).set({ code: request.query.code });
    response.redirect('http://t.me/bl_hcm_bot?start='+hash);
});
