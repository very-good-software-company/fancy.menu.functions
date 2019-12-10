const functions = require('firebase-functions');

// // Create and Deploy Your First Cloud Functions
// // https://firebase.google.com/docs/functions/write-firebase-functions
//
// exports.helloWorld = functions.https.onRequest((request, response) => {
//  response.send("Hello from Firebase!");
// });

exports.onMenuCreate = functions
.firestore
.document('/businesses/{businessId}/{menusCollectionId}/{menuId}')
.onCreate((snap, context) => {
  const menuData = snap.data();
  const businessId = snap.ref.parent.parent.id;
  console.log(menuData, businessId);
  return null;
});