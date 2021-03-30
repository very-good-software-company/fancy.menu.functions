// TODO check for status of github calls, if error report it. Also send back status to client
// TODO Refactor promises to be readable


// TODO Sean?? can we update the data base as each function completes or fails , and have our clients subscribe to that data if it pertains to them. as a way to show updates on menu create??? !!! 


const functions = require('firebase-functions');
const admin = require('firebase-admin');
const Octokit = require('@octokit/rest');
const axios = require('axios');
const serviceAccount = require('./fancymenu-f86d3-firebase-adminsdk-g52lc-45b5065772.json');

admin.initializeApp({
  credential: admin.credential.cert(serviceAccount),
  databaseURL: 'https://fancymenu-f86d3.firebaseio.com',
});

const octokit = Octokit({
  auth: functions.config().github.token,
  userAgent: 'githubTest v1.2.3',
  baseUrl: 'https://api.github.com',
});

const owner = functions.config().github.owner;
const repo = functions.config().github.repo;
const netlifyAPI = functions.config().netlify.api;
const netlifyToken = functions.config().netlify.token;


function handleError(message, err) {

  console.log(message+' '+err);

}

// TODO Add logic to use user selected template stored in menu data
const template = 'simplemenu';

const tomlContent = `
  [build]
    command = "CI= npm run build"
    publish = "${template}/public"
    base = "${template}"

  [context.branch-deploy]
    command = "CI= npm run build"
    publish = "${template}/public"
    base = "${template}"
`;

exports.netlifyHook = functions.https.onRequest((req, res) => {
  if(req.body.title === 'netlify.toml') {
    const netlifyBody = {
      type: "NETLIFYv6",
      site_id: functions.config().netlify.siteid,
      managed: true,
      hostname: `${encodeURIComponent(req.body.branch)}.fancy.menu`,
      value: req.body.deploy_ssl_url,
    }

    return axios.post(netlifyAPI, netlifyBody, {
      headers: {
        Authorization: `Bearer ${netlifyToken}`,
        'Content-Type': 'application/json',
      }
    })
    .then(result => {
      console.log(result);
      console.log('CREATED A MENU SITE!!!!!!');
    })
    .catch(err => {
      console.log('Failed at netlify post', err);
    })
  }

  return res.send(false);
});

exports.onMenuCreate = functions
.firestore
.document('/businesses/{businessId}/{menusCollectionId}/{menuId}')
.onCreate(async (snap, context) => {


  // context.auth.uid



  // Menu data on create
  const menuData = snap.data();
  const menuId = snap.id;
  const businessId = snap.ref.parent.parent.id;

  // Fetch Business
  const parentSnap = await admin.firestore()
  .collection('businesses')
  .doc(businessId)
  .get().catch(err => handleError('Failed at fetching business data', err));


  // Set and encode business name for branch creation
  const business = parentSnap.data();
  const encodedBusinessName = encodeURIComponent(business.name);
  
  // Fetch reference to master branch - fancy.menu
  const masterRef = await octokit.git.getRef({
    owner,
    repo,
    ref: 'heads/master',
  }).catch(err => handleError('Failed at fetching master', err));;

  // Use master branch sha to create new branch
  // based on encoded business name
  const masterSha = masterRef.data.object.sha;

  // here we will fetch our id_data.json and then update that, and then we will fetch and update our json
  await octokit.git.createRef({
    owner,
    repo,
    ref: `refs/heads/${encodedBusinessName}`,
    sha: masterSha,
  }).catch(err => handleError('Failed at creating branch', err));;

  const idContent = `
    {
      "business": "${businessId}",
      "menu": "${menuId}"
    }
  `;

  // Get sha reference to branch netlify config file
  const netlifyConfig = await octokit.repos.getContents({
    owner,
    repo,
    path: 'id_data.json',
    ref: encodedBusinessName,
  }).catch(err => handleError('Failed at fetching id_data.json', err));;

  // Use reference to id_data.json on branch
  // to update same file with different build directory
  const { sha } = netlifyConfig.data;

  await octokit.repos.createOrUpdateFile({
    owner,
    repo,
    path: 'id_data.json',
    branch: encodedBusinessName,
    // message: `Changing netlify config with ${encodedBusinessName} with menu data`,
    message: 'id_data.json',
    sha,
    content: Buffer.from(idContent.trim()).toString('base64'),

  }).catch(err => handleError('Failed at updating id_data.json', err));;

  // Get sha reference to branch netlify config file
  const netlifyToml = await octokit.repos.getContents({
    owner,
    repo,
    path: 'netlify.toml',
    ref: encodedBusinessName,
  }).catch(err => handleError('Failed at fetching netlify toml', err));;


  // Use reference to netlify.toml on branch
  // to update same file with different build directory
  const { sha } = netlifyToml.data;

  await octokit.repos.createOrUpdateFile({
    owner,
    repo,
    path: 'netlify.toml',
    branch: encodedBusinessName,
    // message: `Changing netlify config with ${encodedBusinessName} with menu data`,
    message: 'netlify.toml',
    sha,
    content: Buffer.from(tomlContent.trim()).toString('base64'),
  }).catch(err => handleError('Failed at updating netlify toml', err));

});